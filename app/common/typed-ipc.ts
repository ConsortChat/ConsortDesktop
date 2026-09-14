import type {DndSettings} from "./dnd-util.ts";
import type {
  MenuProperties,
  ScreenShareSource,
  ServerConfig,
  ShareableApp,
} from "./types.ts";

export type MainMessage = {
  "clear-app-settings": () => void;
  // The push-to-talk settings changed. Sent rather than the new values: the
  // main process reads all three from the config anyway, and a message carrying
  // one of them is a message that can disagree with what was saved.
  "configure-push-to-talk": () => void;
  "configure-spell-checker": () => void;
  // Answering "no" to the offer of an app's sound. Worth telling the main
  // process rather than just closing the banner: on Wayland the share is being
  // held behind this answer, and without it the user waits out the deadline
  // for a decision they have already made.
  "decline-audio-share": () => void;
  // The chosen source's id, or null when the picker was dismissed. Dismissing
  // has to be an answer of its own: the page is waiting on a promise that only
  // this reply resolves.
  //
  // `audioKey` is Windows' whole answer about sound, and it travels here rather
  // than through a call of its own because it has to be in the hand that replies
  // to the display media request: that reply is the only place the choice can be
  // expressed, and it is sent the moment this arrives. Empty elsewhere, where
  // sound is routed instead — see `share-app-audio`.
  //
  // Empty means none, EVERYTHING_PLAYING means the machine's whole output, and
  // anything else is a process id whose sound is captured on its own.
  "display-media-callback": (
    displayMediaCallbackId: number,
    sourceId: string | null,
    audioKey: string,
  ) => void;
  "fetch-user-agent": () => string;
  "focus-app": () => void;
  "focus-this-webview": () => void;
  "new-clipboard-key": () => {key: Uint8Array; sig: Uint8Array};
  "permission-callback": (permissionCallbackId: number, grant: boolean) => void;
  "quit-app": () => void;
  "realm-icon-changed": (serverURL: string, iconURL: string) => void;
  "realm-name-changed": (serverURL: string, realmName: string) => void;
  "reload-full-app": () => void;
  "save-last-tab": (index: number) => void;
  "switch-server-tab": (index: number) => void;
  "toggle-app": () => void;
  "toggle-badge-option": (newValue: boolean) => void;
  "toggle-menubar": (showMenubar: boolean) => void;
  "unread-count": (unreadCount: number) => void;
  "update-badge": (messageCount: number) => void;
  "update-menu": (properties: MenuProperties) => void;
  "update-taskbar-icon": (data: string, text: string) => void;
};

export type MainCall = {
  "get-server-settings": (domain: string) => ServerConfig;
  "is-online": (url: string) => boolean;
  // Sending an app's sound with a screen share on Linux, where the portal that
  // grants one carries none. `share-app-audio` routes what the key names into
  // the sink the share's own audio track reads, and answers with what to say
  // about it, or an error to show.
  //
  // The status distinguishes "this machine has no sound" from "nothing is
  // making any", because an empty list is a misleading way to report the first,
  // and both from "the user turned this off".
  //
  // `suggested` is the key the app would have chosen by itself, for the picker
  // to start on. Empty for none. A default rather than a decision: it is on
  // screen next to the list, where it can be changed before anything is shared.
  //
  // `everything-only` is Windows, where the choice is all of the machine's
  // sound or none of it. Electron's display media reply takes `loopback`, which
  // means the default render device, and nothing narrower exists to offer: not
  // per window, not per application. So the picker offers the two answers there
  // actually are, rather than a list it cannot honour — and says which, because
  // "the sound of the window I picked" is what people assume they are getting.
  "audio-share-status": () =>
    | {kind: "unavailable"}
    | {kind: "off"}
    | {kind: "no-output-device"}
    | {kind: "everything-only"}
    | {kind: "ready"; apps: ShareableApp[]; suggested: string};
  "poll-clipboard": (key: Uint8Array, sig: Uint8Array) => string | undefined;
  // Whether this machine can watch a key while the app is in the background.
  // False on every platform but Windows, and on a Windows whose hotkey addon
  // did not load — which the settings page cannot tell from the outside, and
  // which is the difference between a switch that works and one that looks like
  // it does.
  "push-to-talk-available": () => boolean;
  "save-server-icon": (iconURL: string) => string | null;
  "share-app-audio": (key: string) =>
    | {
        ok: true;
        appName: string;
        /** Everything playing, which is named differently from an application. */
        everything: boolean;
      }
    | {ok: false; message: string};
  "stop-sharing-app-audio": () => void;
  // Switching start at login on or off, settled when the switch has been made.
  // A call rather than a message because the answer can be no: in the Store
  // build, Windows will not turn back on a startup task somebody switched off in
  // Task Manager, so the setting is put back to off — and the settings page has
  // to wait for that, or it draws a switch that is on for a task that is not.
  toggleAutoLauncher: (AutoLaunchValue: boolean) => void;
};

export type RendererMessage = {
  // Captured PCM on its way to the hidden window that plays it, so that
  // Chromium can capture it back out of that frame as a screen share's audio.
  // Windows only, and only while a share is sending an application's sound —
  // see app/main/windows-app-audio.ts.
  "app-audio-chunk": (chunk: Uint8Array) => void;
  back: () => void;
  "copy-zulip-url": () => void;
  destroytray: () => void;
  "enter-fullscreen": () => void;
  focus: () => void;
  "focus-webview-with-id": (webviewId: number) => void;
  forward: () => void;
  "hard-reload": () => void;
  "leave-fullscreen": () => void;
  "log-out": () => void;
  logout: () => void;
  "new-server": () => void;
  "open-about": () => void;
  "open-help": () => void;
  "open-network-settings": () => void;
  "open-org-tab": () => void;
  "open-settings": () => void;
  // Wayland picks the video in the desktop's own dialog, so the app never shows
  // the picker that would otherwise carry the audio choice. This asks instead,
  // and only when the machine cannot work the answer out for itself — the share
  // waits on it, briefly.
  "offer-audio-share": (options: {apps: ShareableApp[]}) => void;
  // An app's sound is going out with the share and nobody was asked, which is
  // exactly why something has to say so. The banner is the whole disclosure.
  "audio-share-started": (options: {
    appName: string;
    everything: boolean;
  }) => void;
  // The routing stopped without being asked: the call let go of the device, or
  // the shared app exited. Whatever is on screen offering to stop it has to go
  // with it, or it outlives the thing it controls.
  "audio-share-ended": () => void;
  "display-media-request": (
    options: {sources: ScreenShareSource[]},
    rendererCallbackId: number,
  ) => void;
  // The pictures for a picker that is already open, by source id, sent after
  // the request because capturing them is what made the picker slow to appear.
  // Only while that request is still waiting; a picker that has been answered
  // has nothing to draw them in. Sources missing from the map stay blank.
  "display-media-thumbnails": (
    options: {thumbnails: Record<string, string>},
    rendererCallbackId: number,
  ) => void;
  "permission-request": (
    options: {
      webContentsId: number | null;
      origin: string;
      permission: string;
      // Chromium's own names — "audio", "video" — for a `media` request. The
      // permission string alone cannot tell a microphone request from a camera
      // one, and here they are separate decisions.
      mediaTypes: string[];
    },
    rendererCallbackId: number,
  ) => void;
  "play-ding-sound": () => void;
  // The push-to-talk gate opened (true) or shut (false), and the app should say
  // so out loud. Played here rather than in the main process because only a
  // renderer has an audio context to play it with, and in the app's own window
  // rather than the call's because it is feedback for the person pressing the
  // key and no business of the call's.
  "push-to-talk-tone": (open: boolean) => void;
  "reload-current-viewer": () => void;
  "reload-proxy": (showAlert: boolean) => void;
  "reload-viewer": () => void;
  "render-taskbar-icon": (messageCount: number) => void;
  "set-active": () => void;
  "set-idle": () => void;
  "show-keyboard-shortcuts": () => void;
  "show-notification-settings": () => void;
  "switch-server-tab": (index: number) => void;
  "tab-devtools": () => void;
  "toggle-autohide-menubar": (
    autoHideMenubar: boolean,
    updateMenu: boolean,
  ) => void;
  "toggle-dnd": (state: boolean, newSettings: Partial<DndSettings>) => void;
  "toggle-sidebar": (show: boolean) => void;
  "toggle-silent": (state: boolean) => void;
  "toggle-tray": (state: boolean) => void;
  toggletray: () => void;
  tray: (argument: number) => void;
  "update-realm-icon": (serverURL: string, iconURL: string) => void;
  "update-realm-name": (serverURL: string, realmName: string) => void;
  "webview-reload": () => void;
  zoomActualSize: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
};
