import {
  type Session,
  type WebFrameMain,
  app,
  webContents,
  webFrameMain,
} from "electron/main";

import {APP_DESCRIPTION} from "./linux-audio-share.ts";

// A shutter in front of the microphone, closed unless push to talk says
// otherwise.
//
// WHY not just mute the call: because the call's mute button is the user's, and
// this is not. A gate that worked by pressing that button would fight whoever
// pressed it last — releasing the key would un-mute somebody who had muted
// themselves, and muting yourself would be silently undone by the next press.
// Worse, in a call the mute state is *published*: the other participants see a
// microphone icon flicker on and off with every syllable, and the server sees a
// stream of presence updates for something that is nobody else's business.
//
// So the gate sits one layer in front. The microphone track a call receives is
// not the microphone: it is the output of a gain node this controls, with the
// real capture feeding it. Two shutters in series, and the sound gets out only
// if both are open — the call's mute button on top, doing exactly what it did
// before and knowing nothing about any of this, and push to talk underneath.
//
// It also means the level a call reads for its speaking indicator is the gated
// level. Holding a conversation with somebody in the room while the key is up
// lights nothing up at the far end, which is the promise push to talk makes and
// which muting-by-pressing-the-button could not keep.
//
// The injection route is the one linux-display-audio.ts documents at length: the
// wrapper runs in the page's own world, in every frame, evaluated from here.
// Neither the preload nor the main process can reach the object that matters —
// contextIsolation puts the preload's `navigator` somewhere no page code looks,
// a preload runs in the main frame while a call is a cross-origin iframe, and
// nothing in the main process holds a MediaStream at all.

declare global {
  // eslint-disable-next-line @typescript-eslint/consistent-type-definitions -- merging into a DOM interface, which only an interface can do
  interface MediaDevices {
    /**
     The gate, as the page holds it. Hung off `navigator.mediaDevices` because
     that is the one object both sides can name: the wrapper closes over it, and
     every later update finds it by this property.
     */
    consortMicrophoneGate?: {
      /** Returns how many microphone tracks in this frame are behind the gate. */
      set: (gating: boolean, open: boolean) => number;
    };
  }
}

/**
 The wrapper, as it runs inside the page.

 Serialised with `toString()` and evaluated there, so nothing in this module is
 in scope and everything it needs arrives as an argument.

 `shareDescription` is the one capture that must not be gated: on Linux a shared
 application's sound reaches the call through getUserMedia, from a device of our
 own making, and putting a push-to-talk gate across it would silence the music
 whenever nobody was speaking.
 */
function attachMicrophoneGate(
  this: undefined,
  shareDescription: string,
  gating: boolean,
  open: boolean,
): void {
  // An insecure origin has no navigator.mediaDevices at all, and no microphone
  // to gate either.
  const media: MediaDevices | undefined = navigator.mediaDevices;
  if (media === undefined) {
    return;
  }

  const installed = media.consortMicrophoneGate;
  if (installed !== undefined) {
    installed.set(gating, open);
    return;
  }

  // How quickly the gate opens and shuts. A step change in gain is a click —
  // audible, and on a codec built for speech an ugly one — so it is a ramp
  // instead, short enough that no syllable is lost to it.
  const rampSeconds = 0.01;

  type Gate = {context: AudioContext; gain: GainNode};
  const gates = new Set<Gate>();
  const state = {gating, open};

  const apply = (gate: Gate): void => {
    // Wide open when the feature is off, whatever the key is doing. A gate left
    // shut by a setting that has since been switched off is a microphone that
    // is broken until the next call.
    const level = !state.gating || state.open ? 1 : 0;
    gate.gain.gain.setTargetAtTime(
      level,
      gate.context.currentTime,
      rampSeconds,
    );
  };

  const gateTrack = (track: MediaStreamTrack): MediaStreamTrack => {
    const context = new AudioContext();
    const source = context.createMediaStreamSource(new MediaStream([track]));
    const gain = context.createGain();
    const sink = context.createMediaStreamDestination();
    gain.gain.value = state.open ? 1 : 0;
    source.connect(gain);
    gain.connect(sink);
    // The autoplay policy suspends a context with no gesture behind it, and a
    // suspended context passes no sound. There has been a gesture — somebody
    // joined a call — but asking is free and waiting is not.
    void context.resume();

    const [gated] = sink.stream.getAudioTracks();
    if (gated === undefined) {
      throw new Error("a destination node with no track in it");
    }

    const gate = {context, gain};
    gates.add(gate);

    // What the call asks the track about, it should learn about the
    // microphone. A destination node's track knows none of it: no device id, no
    // sample rate, no label, and a call that reads getSettings().deviceId to
    // work out which microphone is in use — as lib-jitsi-meet does — would find
    // nothing there and mishandle every device change afterwards.
    Object.defineProperty(gated, "label", {
      configurable: true,
      get: () => track.label,
    });
    gated.getSettings = () => track.getSettings();
    gated.getConstraints = () => track.getConstraints();
    gated.getCapabilities = () => track.getCapabilities();
    gated.applyConstraints = async (constraints) =>
      track.applyConstraints(constraints);

    const release = gated.stop.bind(gated);
    const close = (): void => {
      gates.delete(gate);
      release();
      track.stop();
      void context.close();
    };

    // Stopping the track a call was given has to stop the microphone. Without
    // this it stops a gain node and leaves the capture running: the device
    // stays busy and the recording light stays on after the call has ended,
    // which is the worst bug this file could have.
    gated.stop = close;

    // The other direction. A microphone that goes away — unplugged, taken by
    // another application, revoked — ends the real track, and nothing about the
    // gate ends with it, so the call would keep sending silence and never learn
    // why. stop() deliberately fires no event of its own, so this says it.
    track.addEventListener("ended", () => {
      close();
      gated.dispatchEvent(new Event("ended"));
    });

    return gated;
  };

  media.consortMicrophoneGate = {
    set(nowGating: boolean, nowOpen: boolean) {
      state.gating = nowGating;
      state.open = nowOpen;
      for (const gate of gates) {
        apply(gate);
      }

      // Answered with how many there are, which is how the main process learns
      // whether a press of the key reached a microphone at all.
      return gates.size;
    },
  };

  const capture = media.getUserMedia.bind(media);
  media.getUserMedia = async (options) => {
    const stream = await capture(options);

    // Nothing in the path at all when push to talk is off. The gate is cheap
    // but it is not free — an AudioContext, a resample, a few milliseconds of
    // buffer — and somebody who does not use this feature should not be paying
    // any of it.
    if (!state.gating) {
      return stream;
    }

    for (const track of stream.getAudioTracks()) {
      if (shareDescription !== "" && track.label.includes(shareDescription)) {
        continue;
      }

      try {
        const gated = gateTrack(track);
        stream.removeTrack(track);
        stream.addTrack(gated);
      } catch (error: unknown) {
        // The microphone is worth more than the gate. Anything unexpected here
        // leaves the capture exactly as it was — talking works, push to talk
        // does not — and says so, because a gate that silently is not there is
        // a person who thinks they are not being heard.
        console.error("[consort] could not gate the microphone", error);
      }
    }

    return stream;
  };
}

let watched: Session | undefined;
let gating = false;
let open = false;
// Whether the last update found a microphone behind the gate in any frame:
// something capturing while push to talk is on, which is a call almost always.
let live = false;

function attachScript(): string {
  return `(${attachMicrophoneGate.toString()})(${JSON.stringify(
    APP_DESCRIPTION,
  )}, ${JSON.stringify(gating)}, ${JSON.stringify(open)})`;
}

/**
 The short form, for the hundreds of times a day the key is pressed.

 Re-evaluating the whole wrapper would work — it updates an installed gate and
 returns — but it is a couple of kilobytes to parse in every frame on every
 press, and this is the one path where a few milliseconds are audible as the
 front of a word.
 */
function updateScript(): string {
  return `navigator.mediaDevices?.consortMicrophoneGate?.set(${JSON.stringify(
    gating,
  )}, ${JSON.stringify(open)})`;
}

async function run(frame: WebFrameMain, script: string): Promise<unknown> {
  try {
    return await frame.executeJavaScript(script);
  } catch (error: unknown) {
    // A frame that navigated or died while this was in flight, most often.
    // Nothing here is worth failing a call over.
    console.error("could not reach a frame with the microphone gate", {
      url: frame.url,
      error,
    });
  }
}

function frames(): WebFrameMain[] {
  const ses = watched;
  if (ses === undefined) {
    return [];
  }

  return webContents.getAllWebContents().flatMap((contents) => {
    if (contents.isDestroyed() || contents.session !== ses) {
      return [];
    }

    // Including the main frame, which is what `framesInSubtree` means.
    return contents.mainFrame.framesInSubtree;
  });
}

/**
 Put the gate in every frame of the servers' session, as each one loads.

 Every frame rather than the call's, for the reason the screen share wrapper
 gives: nothing here can tell which frame a call is in until it asks for the
 microphone, and by then it is too late to wrap the function it asked with. It
 is inert in all the others, which never ask.

 On navigation rather than when the key is first pressed, for the same reason
 again — wrapping getUserMedia after a call has already called it changes
 nothing about the track it is already sending.
 */
export function install(ses: Session): void {
  watched = ses;
  app.on("web-contents-created", (_event, contents) => {
    contents.on(
      "did-frame-navigate",
      (
        _navigation,
        _url,
        _code,
        _status,
        _isMainFrame,
        processId,
        routingId,
        // eslint-disable-next-line max-params
      ) => {
        if (contents.session !== ses) {
          return;
        }

        const frame = webFrameMain.fromId(processId, routingId);
        if (frame !== undefined) {
          void run(frame, attachScript());
        }
      },
    );
  });
}

/**
 Whether the microphone is gated at all.

 Turning it off opens every gate that exists, rather than leaving them shut on
 the last answer they were given.

 Turning it on reaches microphones captured from now on. A call that is already
 running holds a track that was handed to it ungated, and there is no way to
 exchange that track for another from out here — the gate applies from the next
 time something asks for the microphone, which is the next call, or the next
 device change within this one.
 */
export async function setGating(nowGating: boolean): Promise<void> {
  if (nowGating === gating) {
    return;
  }

  gating = nowGating;
  if (!gating) {
    open = false;
  }

  await update();
}

/**
 Open or shut the gate, which is what pressing the key does.

 Settles with whether any microphone is behind the gate, so that the caller can
 tell a press that reached a call from one that reached nothing.
 */
export async function setOpen(nowOpen: boolean): Promise<boolean> {
  if (nowOpen === open) {
    return live;
  }

  open = nowOpen;
  return update();
}

async function update(): Promise<boolean> {
  const script = updateScript();
  const counts = await Promise.all(
    frames().map(async (frame) => run(frame, script)),
  );
  live = counts.some((count) => typeof count === "number" && count > 0);
  return live;
}
