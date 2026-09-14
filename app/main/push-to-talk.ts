import {type WebContents, app, powerMonitor} from "electron/main";
import path from "node:path";
import process from "node:process";

import * as ConfigUtil from "../common/config-util.ts";
import {bundlePath} from "../common/paths.ts";
import {
  NO_HOTKEY,
  modifierMask,
  virtualKeyFor,
} from "../common/push-to-talk-key.ts";

import * as MicGate from "./mic-gate.ts";
import {send} from "./typed-ipc-main.ts";

// Push to talk: the key, and everything that hangs off pressing it.
//
// The gate itself is next door in mic-gate.ts, which is the half that lives in
// the page. This is the half that watches the key — see native/src/hotkey-win.cc
// for why that takes an addon — and the small amount of arbitration between
// them: what happens when the key is rebound mid-press, when the machine sleeps
// with a finger on it, and when a release goes missing.
//
// Windows only, for now. The key has to be watched while the app is in the
// background, which on Linux means either an X11-only hook that Wayland has
// deliberately closed off or a portal that does not exist yet; the answer there
// is a separate program gating the microphone for the whole machine rather than
// anything this file could grow into. See docs/push-to-talk.md.

type Addon = {
  isSupported: () => boolean;
  start: (onEdge: (down: boolean) => void) => boolean;
  setKey: (virtualKey: number, modifiers: number) => void;
  stop: () => void;
  isKeyDown: (virtualKey: number) => boolean;
};

// How often to check that the key is still physically down while the gate is
// open. The hook reports both edges and is reliable about it, but "reliable" is
// not the standard an open microphone should be held to: a release can be lost
// to a lock screen, to an elevated window taking the keystroke, or to a remote
// session changing hands. A quarter of a second is short enough that nobody
// says anything they meant to keep private and long enough to cost nothing.
const WATCHDOG_INTERVAL_MS = 250;

let addon: Addon | undefined;
let addonUnavailable = false;

/** Where the compiled addon is, which is not the same place twice. */
function addonPath(): string {
  return app.isPackaged
    ? path.join(process.resourcesPath, "native", "consort_hotkey.node")
    : path.join(bundlePath, "../../native/build/Release/consort_hotkey.node");
}

/**
 The native half, loaded the first time it is wanted.

 A missing or unloadable binary is a feature that is not there rather than an
 app that will not start: every caller treats undefined as "this machine cannot
 watch a key", and the setting is not offered.
 */
function load(): Addon | undefined {
  if (addon !== undefined || addonUnavailable) {
    return addon;
  }

  try {
    addon =
      // eslint-disable-next-line @typescript-eslint/no-require-imports, unicorn/prefer-module, @typescript-eslint/no-unsafe-type-assertion -- a native addon has neither an ESM form nor types
      require(addonPath()) as Addon;
  } catch (error: unknown) {
    console.error("could not load the hotkey addon", error);
    addonUnavailable = true;
  }

  return addon;
}

/** Whether this machine can watch a key at all. */
export function isAvailable(): boolean {
  if (process.platform !== "win32") {
    return false;
  }

  try {
    return load()?.isSupported() ?? false;
  } catch (error: unknown) {
    console.error("could not ask the hotkey addon what it supports", error);
    return false;
  }
}

let page: WebContents | undefined;
let watching = 0;
let hooked = false;
let open = false;
let watchdog: NodeJS.Timeout | undefined;

function tone(nowOpen: boolean): void {
  if (page === undefined || page.isDestroyed()) {
    return;
  }

  if (!ConfigUtil.getConfigItem("pushToTalkTones", true)) {
    return;
  }

  // Played by the app for the person holding the key, not sent to the call: it
  // is an answer to "did that register", which is a question only they are
  // asking. It goes out of the speakers, so a microphone on the same machine
  // can hear it — which is what echo cancellation is for, and why it is two
  // dozen milliseconds of a sine rather than anything with a tail.
  send(page, "push-to-talk-tone", nowOpen);
}

/**
 Sound an edge, once the gate has said there is a microphone behind it.

 Nothing otherwise. The tone means "the key reached your microphone", and with
 nothing capturing — no call — there is no microphone for it to have reached:
 every press would blip at somebody who is not talking to anyone, and a key
 bound to something that also has another use would blip all day.
 */
async function toneWhenLive(
  change: Promise<boolean>,
  nowOpen: boolean,
): Promise<void> {
  if (await change) {
    tone(nowOpen);
  }
}

function openGate(): void {
  if (open) {
    return;
  }

  open = true;
  void toneWhenLive(MicGate.setOpen(true), true);

  watchdog ??= setInterval(() => {
    const loaded = addon;
    if (loaded === undefined || watching === 0) {
      closeGate();
      return;
    }

    try {
      if (!loaded.isKeyDown(watching)) {
        closeGate();
      }
    } catch (error: unknown) {
      // An addon that has started refusing to answer is not one to leave a
      // microphone open on the word of.
      console.error("could not check the push-to-talk key", error);
      closeGate();
    }
  }, WATCHDOG_INTERVAL_MS);
}

function closeGate(): void {
  if (watchdog !== undefined) {
    clearInterval(watchdog);
    watchdog = undefined;
  }

  if (!open) {
    return;
  }

  open = false;
  void toneWhenLive(MicGate.setOpen(false), false);
}

/**
 Read the settings and make the machine match them.

 Called at startup and whenever the preferences change. It is deliberately the
 only way in: enabling the feature, rebinding the key and disabling it again are
 the same operation with different answers, and three separate paths through
 them is three chances to leave the hook installed for a feature that is off.
 */
export function configure(): void {
  const loaded = load();
  if (!isAvailable() || loaded === undefined) {
    return;
  }

  // Whatever the change is, a gate open at this moment is open on the strength
  // of a key that may no longer be the key. It shuts, and the next press opens
  // it on the new answer.
  closeGate();

  const enabled = ConfigUtil.getConfigItem("pushToTalk", false);
  const hotkey = ConfigUtil.getConfigItem("pushToTalkKey", NO_HOTKEY);
  const virtualKey = enabled ? virtualKeyFor(hotkey.code) : undefined;

  if (virtualKey === undefined) {
    // Off, or on with no key chosen — which is off with a warning in the
    // settings, not a hook left installed for a key that is never coming.
    watching = 0;
    if (hooked) {
      loaded.stop();
      hooked = false;
    }

    void MicGate.setGating(false);
    return;
  }

  if (!hooked) {
    try {
      hooked = loaded.start((down) => {
        if (down) {
          openGate();
        } else {
          closeGate();
        }
      });
    } catch (error: unknown) {
      console.error("could not start watching for the push-to-talk key", error);
      hooked = false;
    }

    if (!hooked) {
      // Windows refused the hook. Said out loud because the alternative is a
      // setting that is switched on, a key that is bound, and a microphone that
      // never opens, with nothing anywhere to say why.
      console.error(
        "[consort] Windows would not install the push-to-talk hook; the key " +
          "will do nothing",
      );
      void MicGate.setGating(false);
      return;
    }
  }

  watching = virtualKey;
  loaded.setKey(virtualKey, modifierMask(hotkey));
  void MicGate.setGating(true);
}

/** Take the hook down, and the gate with it. */
export function stop(): void {
  closeGate();
  watching = 0;

  if (hooked) {
    addon?.stop();
    hooked = false;
  }
}

/**
 Start watching, if this machine and these settings ask for it.

 The gate is installed separately and earlier — see the call to
 `MicGate.install` — because it has to be in place before any server page loads,
 and this needs a window to play tones into that does not exist by then.
 */
export function install(mainPage: WebContents): void {
  if (!isAvailable()) {
    return;
  }

  page = mainPage;

  // A key held while the machine goes to sleep is a key nobody is holding when
  // it wakes, and the release happened somewhere the hook was not running.
  powerMonitor.on("suspend", closeGate);
  powerMonitor.on("lock-screen", closeGate);
  app.on("before-quit", stop);

  configure();
}
