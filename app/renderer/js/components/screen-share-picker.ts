import {html} from "../../../common/html.ts";
import * as t from "../../../common/translation-util.ts";
import {
  EVERYTHING_PLAYING,
  type ScreenShareSource,
  type ShareableApp,
} from "../../../common/types.ts";
import {ipcRenderer} from "../typed-ipc-renderer.ts";

import {generateNodeFromHtml} from "./base.ts";

// Every banner this module puts on screen, so they can all be taken down when
// the thing they describe stops existing. Without this an offer to share sound,
// or a notice that sound is being shared, outlives the call it belongs to and
// controls nothing.
const audioBanners = new Set<Element>();

function addAudioBanner($banner: Element): void {
  const $banners = document.querySelector("#permission-banners");
  if ($banners === null) {
    return;
  }

  $banners.append($banner);
  audioBanners.add($banner);
}

function removeAudioBanner($banner: Element): void {
  $banner.remove();
  audioBanners.delete($banner);
}

/** Take down anything this module has on screen. */
export function dismissAudioBanners(): void {
  for (const $banner of audioBanners) {
    $banner.remove();
  }

  audioBanners.clear();
}

// An application, and underneath it whichever of its sounds can be told apart.
//
// A browser's tabs each have their own stream and their own name for it, so
// they are offered individually as well as all together — but grouped under the
// application, because "(5) A video on - YouTube" sitting loose in the list
// says nothing about what is playing it.
function audioOption(app: ShareableApp) {
  return app.streams.length === 0
    ? html` <option value="${app.key}">${app.name}</option> `
    : html`
        <optgroup label="${app.name}">
          <option value="${app.key}">${t.__("All of its sound")}</option>
          ${html``.join(
            app.streams.map(
              (stream) => html`
                <option value="${stream.key}">${stream.name}</option>
              `,
            ),
          )}
        </optgroup>
      `;
}

// The applications, with "everything" above them where there is more than one
// of them to be above. It is what a whole screen share takes by itself and what
// Windows puts on every share, so it belongs in the list and not only in the
// answer the app arrives at on its own.
function audioOptions(apps: ShareableApp[], nothing: string) {
  return html`
    <option value="">${nothing}</option>
    ${apps.length > 1
      ? html`
          <option value="${EVERYTHING_PLAYING}">
            ${t.__("Everything that is playing")}
          </option>
        `
      : html``}
    ${html``.join(apps.map((app) => audioOption(app)))}
  `;
}

// Nothing here starts the list on an answer any more. Both surfaces that offer
// this — the picker and the banner the Wayland path shows — begin on no sound
// and wait to be told otherwise, so the helpers that chose a default for them
// are gone rather than left unused.

// While an app's sound is going out with a share, something has to say so and
// offer the way back. A Linux share takes the sound of what is being shared
// without asking, so this is the only place the user is told at all — which
// makes the wording of it the disclosure, and the button beside it the way out.
//
// Windows has no banner because it has nothing to put in one: its sound is part
// of the share rather than a routing of its own, so it stops when the share
// does, and the picker is where it was disclosed and agreed to.
export function showAudioBanner(appName: string, everything = false) {
  const $banner = generateNodeFromHtml(html`
    <div class="permission-banner">
      <span class="permission-banner-text"
        >${everything
          ? t.__("Sending the sound of everything playing with the share.")
          : t.__("Sending {{{app}}}'s sound with the share.", {
              app: appName,
            })}</span
      >
      <div class="permission-banner-actions">
        <button type="button" class="permission-banner-allow">
          ${t.__("Stop sharing sound")}
        </button>
      </div>
    </div>
  `);
  addAudioBanner($banner);
  $banner
    .querySelector(".permission-banner-allow")!
    .addEventListener("click", () => {
      removeAudioBanner($banner);
      void ipcRenderer.invoke("stop-sharing-app-audio");
    });
}

/**
 Ask which application's sound should go with a share.

 Used on Wayland, where the desktop's own dialog chose the video and the app's
 picker — which carries this choice everywhere else — never appeared. Only when
 the machine could not work the answer out for itself: a screen share takes
 everything and a window share takes the window's own application, so what
 reaches here is genuinely several applications and no way to tell which.

 The share is held behind this answer, because the sound can only join the video
 before the call is handed it — and there is no second route to fall back on any
 more. Not held indefinitely, though: after a while the video goes without sound
 rather than leaving somebody looking at a share that never began, and answering
 after that says so instead of quietly doing nothing.
 */
export function offerAudioShare(apps: ShareableApp[]): void {
  if (apps.length === 0) {
    return;
  }

  // Only ever one offer on screen. Sharing twice without answering the first
  // would otherwise stack them, each holding a stale list of applications.
  dismissAudioBanners();

  const $banner = generateNodeFromHtml(html`
    <div class="permission-banner">
      <span class="permission-banner-text"
        >${t.__("Which sound should go with the share?")}</span
      >
      <div class="permission-banner-actions">
        <select class="screen-share-audio-source">
          ${audioOptions(apps, t.__("No sound"))}
        </select>
        <button type="button" class="permission-banner-allow">
          ${t.__("Share sound")}
        </button>
        <button type="button" class="permission-banner-deny">
          ${t.__("No")}
        </button>
      </div>
    </div>
  `);
  addAudioBanner($banner);

  const $select = $banner.querySelector<HTMLSelectElement>(
    ".screen-share-audio-source",
  )!;
  // Starts on no sound, like every other surface here. This is the one the
  // Wayland path shows, and it is shown *because* the app could not be trusted
  // to choose — arriving with an application already selected turns "which?"
  // into "press the button", which is how sharing a window came to send
  // whatever was playing.
  $banner
    .querySelector(".permission-banner-allow")!
    .addEventListener("click", () => {
      const key = $select.value;
      removeAudioBanner($banner);
      void (async () => {
        if (key === "") {
          ipcRenderer.send("decline-audio-share");
          return;
        }

        const result = await ipcRenderer.invoke("share-app-audio", key);
        if (result.ok) {
          showAudioBanner(result.appName, result.everything);
        } else {
          showAudioFailure(result.message);
        }
      })();
    });
  $banner
    .querySelector(".permission-banner-deny")!
    .addEventListener("click", () => {
      removeAudioBanner($banner);
      // Told rather than merely closed: a share is waiting on this answer, and
      // without it the user sits out the deadline for a decision already made.
      ipcRenderer.send("decline-audio-share");
    });
}

function showAudioFailure(message: string) {
  const $banner = generateNodeFromHtml(html`
    <div class="permission-banner">
      <span class="permission-banner-text"
        >${t.__("Could not share the sound: {{{message}}}", {message})}</span
      >
      <div class="permission-banner-actions">
        <button type="button" class="permission-banner-allow">
          ${t.__("Dismiss")}
        </button>
      </div>
    </div>
  `);
  addAudioBanner($banner);
  $banner
    .querySelector(".permission-banner-allow")!
    .addEventListener("click", () => {
      removeAudioBanner($banner);
    });
}

/**
 What the picker was answered with: what to share, and whether to send sound.

 `systemAudio` is Windows only, and is the whole of the answer there — the reply
 to the display media request is the only place that choice can be expressed, so
 it has to travel back with the source rather than be arranged separately.
 Elsewhere it is false and the sound is routed instead, which has already
 happened by the time this resolves.
 */
export type ScreenShareChoice = {
  /** Null when the picker was dismissed, which is a refusal rather than a wait. */
  sourceId: string | null;
  /**
   Empty for no sound, EVERYTHING_PLAYING for the machine's whole output, and
   otherwise the process id of the application to capture on its own.
   */
  audioKey: string;
};

// Choose what to share, drawn by the app.
//
// Electron hands getDisplayMedia to the app with no picker of its own,
// so this is not decoration around a browser dialog — it is the only thing
// standing between a page asking for a screen and getting one. That makes it a
// consent surface, and the same rule applies as to the permission banner: a
// chooser the page could draw is a chooser the page could fake, so this one
// lives outside every webview and cannot be reached from inside one.
//
// Dismissing resolves to null rather than never resolving. The page is waiting
// on a promise that only this answer completes, and a cancelled share that
// leaves the call waiting for ever is worse than a refused one.
//
// `requestId` names this picker, so that the thumbnails sent after it opens
// reach this one and not a later one — see showScreenShareThumbnails.
export async function chooseScreenShareSource(
  sources: ScreenShareSource[],
  requestId: number,
): Promise<ScreenShareChoice> {
  const $root = document.querySelector("#screen-share-picker");
  if ($root === null) {
    return {sourceId: null, audioKey: ""};
  }

  const screens = sources.filter((source) => source.kind === "screen");
  const windows = sources.filter((source) => source.kind === "window");

  const tile = (source: ScreenShareSource) => html`
    <button
      type="button"
      class="screen-share-tile"
      data-source-id="${source.id}"
    >
      ${source.thumbnailDataUrl === undefined
        ? html`<img class="screen-share-thumbnail" />`
        : html`<img
            class="screen-share-thumbnail"
            src="${source.thumbnailDataUrl}"
          />`}
      <span class="screen-share-name" title="${source.name}"
        >${source.name}</span
      >
    </button>
  `;

  const group = (title: string, group_sources: ScreenShareSource[]) =>
    group_sources.length === 0
      ? html``
      : html`
          <div class="screen-share-group-title">${title}</div>
          <div class="screen-share-grid">
            ${html``.join(group_sources.map((source) => tile(source)))}
          </div>
        `;

  // Asked of both platforms now. Windows used to be skipped here and sent the
  // machine's whole output regardless, which is fine for a screen and wrong for
  // a window: picking one window and sending every sound the computer is making
  // is not what sharing that window means, and nothing on screen said otherwise.
  // It cannot be narrowed — see the note on `everything-only` — so it is offered
  // as the two answers there are. Linux keeps its list of applications, where
  // the sound travels with the share rather than as a microphone. See
  // docs/linux-screen-sharing.md.
  const audio = await ipcRenderer.invoke("audio-share-status");

  const audioSection = (() => {
    switch (audio.kind) {
      case "unavailable": {
        return html`
          <div class="screen-share-note">
            ${t.__("Sound from the shared window is not included.")}
          </div>
        `;
      }

      case "everything-only": {
        // The applications behind the windows on offer, each able to have its
        // sound captured on its own, and "everything" for the case that is not
        // one application — a whole screen, or something not in the list.
        //
        // Named by application rather than by window: several windows of one
        // program share its sound, and offering the same thing three times
        // under three window titles would suggest they could be told apart.
        const apps = new Map<number, string>();
        for (const source of sources) {
          if (source.application !== undefined) {
            apps.set(source.application.processId, source.application.name);
          }
        }

        return html`
          <label class="screen-share-audio">
            <span>${t.__("Also share sound")}</span>
            <select class="screen-share-audio-source">
              <option value="">${t.__("No sound")}</option>
              ${html``.join(
                [...apps].map(
                  ([processId, name]) => html`
                    <option value="${String(processId)}">${name}</option>
                  `,
                ),
              )}
              <option value="${EVERYTHING_PLAYING}">
                ${t.__("Everything this computer is playing")}
              </option>
            </select>
          </label>
        `;
      }

      case "off": {
        // Turned off in Settings, which is not a state to explain in the middle
        // of sharing: the user chose it, and the way back is where they chose.
        return html``;
      }

      case "no-output-device": {
        // Distinct from having nothing playing: telling someone to start their
        // audio when the machine has no sound card sends them in circles.
        return html`
          <div class="screen-share-note">
            ${t.__(
              "This machine has no audio output, so there is no sound to share.",
            )}
          </div>
        `;
      }

      case "ready": {
        return audio.apps.length === 0
          ? html`
              <div class="screen-share-note">
                ${t.__(
                  "Sound is not included. Start the audio first to share it.",
                )}
              </div>
            `
          : html`
              <label class="screen-share-audio">
                <span>${t.__("Also share sound from")}</span>
                <select class="screen-share-audio-source">
                  ${audioOptions(audio.apps, t.__("Nothing"))}
                </select>
              </label>
            `;
      }
    }
  })();

  const $overlay = generateNodeFromHtml(html`
    <div class="screen-share-overlay" data-request-id="${String(requestId)}">
      <div class="screen-share-dialog">
        <div class="screen-share-header">${t.__("Choose what to share")}</div>
        <div class="screen-share-body">
          ${group(t.__("Entire screen"), screens)}
          ${group(t.__("Window"), windows)}
        </div>
        <div class="screen-share-footer">
          ${audioSection}
          <button type="button" class="screen-share-cancel">
            ${t.__("Cancel")}
          </button>
        </div>
      </div>
    </div>
  `);
  $root.append($overlay);

  // Pictures that were ready before the picker was. It asks the main process a
  // question before drawing, and on a machine whose windows all answer promptly
  // the thumbnails can win that race. Anything else held is for a picker that
  // never opened, and this is the moment it stops being worth keeping.
  const early = earlyThumbnails.get(requestId);
  earlyThumbnails.clear();
  if (early !== undefined) {
    fillThumbnails($overlay, early);
  }

  // Neither platform starts on an answer any more. Linux used to start on the
  // application it would have chosen by itself, which reads as helpful and is
  // not: with one thing playing, opening the picker and clicking a window sends
  // that thing sound and nobody chose to. Sharing a window is not consenting to
  // send whatever happens to be making noise, on either platform, and the list
  // still says the sound is there and one click away.
  //
  // The question Wayland asks when it cannot work the answer out is a different
  // surface and keeps its suggestion: it is an explicit question with an
  // explicit button, not a default applied to a click meant for something else.

  return new Promise<ScreenShareChoice>((resolve) => {
    const answer = (sourceId: string | null) => {
      $overlay.remove();
      document.removeEventListener("keydown", onKeydown);

      // Route the chosen app's sound to the call, but never at the
      // expense of the share itself: if it fails, say so and share the video
      // anyway rather than refusing the whole thing over its audio.
      const $audio = $overlay.querySelector<HTMLSelectElement>(
        ".screen-share-audio-source",
      );
      const key = sourceId === null ? "" : ($audio?.value ?? "");

      // Windows routes nothing: the answer is the reply to the display media
      // request, so it goes back to be sent with the source rather than
      // arranged here. There is no banner either — the sound starts and stops
      // with the share itself, having nothing of its own to be stopped.
      if (audio.kind === "everything-only") {
        resolve({sourceId, audioKey: key});
        return;
      }

      if (key === "") {
        resolve({sourceId, audioKey: ""});
        return;
      }

      void (async () => {
        const result = await ipcRenderer.invoke("share-app-audio", key);
        if (result.ok) {
          showAudioBanner(result.appName, result.everything);
        } else {
          showAudioFailure(result.message);
        }

        resolve({sourceId, audioKey: ""});
      })();
    };

    function onKeydown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        answer(null);
      }
    }

    for (const $tile of $overlay.querySelectorAll<HTMLElement>(
      ".screen-share-tile",
    )) {
      $tile.addEventListener("click", () => {
        answer($tile.dataset.sourceId ?? null);
      });
    }

    $overlay
      .querySelector(".screen-share-cancel")!
      .addEventListener("click", () => {
        answer(null);
      });
    // Clicking the backdrop, but not the dialog sitting on it.
    $overlay.addEventListener("click", (event) => {
      if (event.target === $overlay) {
        answer(null);
      }
    });
    document.addEventListener("keydown", onKeydown);
  });
}

// Thumbnails that arrived for a picker not yet on screen, by request id. At
// most one entry is worth anything, and the next picker to open clears the rest.
const earlyThumbnails = new Map<number, Record<string, string>>();

function fillThumbnails(
  $overlay: Element,
  thumbnails: Record<string, string>,
): void {
  for (const $tile of $overlay.querySelectorAll<HTMLElement>(
    ".screen-share-tile",
  )) {
    const {sourceId} = $tile.dataset;
    const $thumbnail = $tile.querySelector<HTMLImageElement>(
      ".screen-share-thumbnail",
    );
    if (
      sourceId !== undefined &&
      $thumbnail !== null &&
      Object.hasOwn(thumbnails, sourceId)
    ) {
      $thumbnail.src = thumbnails[sourceId]!;
    }
  }
}

/**
 Draw the pictures into a picker that opened without them.

 The picker opens on the list of sources alone, because capturing a picture of
 every window is what used to hold it back — for five seconds, with one window
 that never produced one. These follow once they exist.
 */
export function showScreenShareThumbnails(
  requestId: number,
  thumbnails: Record<string, string>,
): void {
  const $overlay = document.querySelector(
    `.screen-share-overlay[data-request-id="${CSS.escape(String(requestId))}"]`,
  );
  if ($overlay === null) {
    earlyThumbnails.set(requestId, thumbnails);
    return;
  }

  fillThumbnails($overlay, thumbnails);
}
