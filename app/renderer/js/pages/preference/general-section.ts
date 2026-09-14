import type {OpenDialogOptions} from "electron/renderer";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

import * as remote from "@electron/remote";
import {app, dialog, session} from "@electron/remote";
import Tagify from "@yaireo/tagify";
import {z} from "zod";

import supportedLocales from "../../../../../public/translations/supported-locales.json";
import * as ConfigUtil from "../../../../common/config-util.ts";
import {html} from "../../../../common/html.ts";
import {
  type Hotkey,
  NO_HOTKEY,
  describeHotkey,
  describeKey,
  hotkeyFromEvent,
  isBound,
} from "../../../../common/push-to-talk-key.ts";
import * as t from "../../../../common/translation-util.ts";
import {ipcRenderer} from "../../typed-ipc-renderer.ts";

import {generateSelectHtml, generateSettingOption} from "./base-section.ts";

const currentBrowserWindow = remote.getCurrentWindow();

// The platforms whose screen share carries sound, and so the ones with
// something to turn off. What travels differs — Linux routes the application
// that was shared, Windows sends the whole desktop's output because that is all
// Electron's loopback capture can offer — but the choice of whether to send it
// is the same choice, and was missing on Windows, where sound has always gone
// out with every share and nothing on screen said so.
const sharesScreenAudio =
  process.platform === "linux" || process.platform === "win32";

// Where a key can be watched while the app is in the background, which is the
// only kind of push to talk worth having — the thing you are talking over is
// usually the thing you are looking at. Windows, for now; the Linux answer is a
// separate program gating the microphone for the whole machine, since Wayland
// has deliberately closed off the hook this would need. See
// docs/push-to-talk.md.
//
// Whether the machine can actually do it is asked of the main process below,
// which is the only side that knows whether the addon loaded. This decides
// whether to draw the section at all.
const canPushToTalk = process.platform === "win32";

type GeneralSectionProperties = {
  $root: Element;
};

export function initGeneralSection({$root}: GeneralSectionProperties): void {
  $root.innerHTML = html`
    <div class="settings-pane">
      <div class="title">${t.__("Appearance")}</div>
      <div id="appearance-option-settings" class="settings-card">
        <div class="setting-row" id="tray-option">
          <div class="setting-description">
            ${t.__("Show app icon in system tray")}
          </div>
          <div class="setting-control"></div>
        </div>
        <div
          class="setting-row"
          id="menubar-option"
          style="display:${process.platform === "darwin" ? "none" : ""}"
        >
          <div class="setting-description">
            ${t.__("Auto hide menu bar (Press Alt key to display)")}
          </div>
          <div class="setting-control"></div>
        </div>
        <div class="setting-row" id="sidebar-option">
          <div class="setting-description">
            ${t.__("Show sidebar")} (<span class="code"
              >${process.platform === "darwin"
                ? "Cmd+Shift+S"
                : "Ctrl+Shift+S"}</span
            >)
          </div>
          <div class="setting-control"></div>
        </div>
        <div class="setting-row" id="badge-option">
          <div class="setting-description">
            ${t.__("Show unread count badge on app icon")}
          </div>
          <div class="setting-control"></div>
        </div>
        <div
          class="setting-row"
          id="dock-bounce-option"
          style="display:${process.platform === "darwin" ? "" : "none"}"
        >
          <div class="setting-description">
            ${t.__("Bounce dock on new private message")}
          </div>
          <div class="setting-control"></div>
        </div>
        <div
          class="setting-row"
          id="flash-taskbar-option"
          style="display:${process.platform === "win32" ? "" : "none"}"
        >
          <div class="setting-description">
            ${t.__("Flash taskbar on new message")}
          </div>
          <div class="setting-control"></div>
        </div>
      </div>
      <div class="title">${t.__("Desktop Notifications")}</div>
      <div class="settings-card">
        <div class="setting-row" id="show-notification-option">
          <div class="setting-description">
            ${t.__("Show desktop notifications")}
          </div>
          <div class="setting-control"></div>
        </div>
        <div class="setting-row" id="silent-option">
          <div class="setting-description">
            ${t.__("Mute all sounds from Zulip")}
          </div>
          <div class="setting-control"></div>
        </div>
      </div>
      <div class="title">${t.__("Functionality")}</div>
      <div class="settings-card">
        <div class="setting-row" id="startAtLogin-option">
          <div class="setting-description">${t.__("Start app at login")}</div>
          <div class="setting-control"></div>
        </div>
        <div class="setting-row" id="start-minimize-option">
          <div class="setting-description">
            ${t.__("Always start minimized")}
          </div>
          <div class="setting-control"></div>
        </div>
        <div class="setting-row" id="quitOnClose-option">
          <div class="setting-description">
            ${t.__("Quit when the window is closed")}
          </div>
          <div class="setting-control"></div>
        </div>
        <div class="setting-row" id="enable-spellchecker-option">
          <div class="setting-description">
            ${t.__("Enable spellchecker (requires restart)")}
          </div>
          <div class="setting-control"></div>
        </div>
        <div
          class="setting-row"
          id="share-audio-option"
          style="display:${sharesScreenAudio ? "" : "none"}"
        >
          <div class="setting-description">
            ${process.platform === "win32"
              ? t.__("Send your computer's sound when you share your screen")
              : t.__("Send an application's sound when you share your screen")}
          </div>
          <div class="setting-control"></div>
        </div>
        <div
          class="setting-row"
          id="spellcheck-langs"
          style="display:${process.platform === "darwin" ? "none" : ""}"
        ></div>
        <div class="setting-row" id="note"></div>
      </div>

      <div
        class="title"
        id="push-to-talk-title"
        style="display:${canPushToTalk ? "" : "none"}"
      >
        ${t.__("Push to Talk")}
      </div>
      <div
        class="settings-card"
        id="push-to-talk-card"
        style="display:${canPushToTalk ? "" : "none"}"
      >
        <div class="setting-row" id="push-to-talk-option">
          <div class="setting-description">
            ${t.__(
              "Hold a key to speak, and keep the microphone shut the rest of the time",
            )}
          </div>
          <div class="setting-control"></div>
        </div>
        <div class="setting-row" id="push-to-talk-key-option">
          <div class="setting-description">${t.__("Key to hold")}</div>
          <button class="push-to-talk-key green w-150"></button>
        </div>
        <div class="setting-row setting-note" id="push-to-talk-note"></div>
        <div class="setting-row" id="push-to-talk-tones-option">
          <div class="setting-description">
            ${t.__("Play a tone when the microphone opens and closes")}
          </div>
          <div class="setting-control"></div>
        </div>
      </div>

      <div class="title">${t.__("Advanced")}</div>
      <div class="settings-card">
        <div class="setting-row" id="enable-error-reporting">
          <div class="setting-description">
            ${t.__("Enable error reporting (requires restart)")}
          </div>
          <div class="setting-control"></div>
        </div>

        <div class="setting-row" id="app-language">
          <div class="setting-description">
            ${t.__("App language (requires restart)")}
          </div>
          <div id="lang-div" class="lang-div"></div>
        </div>

        <div class="setting-row" id="add-custom-css">
          <div class="setting-description">${t.__("Add custom CSS")}</div>
          <button class="custom-css-button green">${t.__("Upload")}</button>
        </div>
        <div class="setting-row" id="remove-custom-css">
          <div class="setting-description">
            <div class="selected-css-path" id="custom-css-path">
              ${ConfigUtil.getConfigItem("customCSS", "")}
            </div>
          </div>
          <div class="action red" id="css-delete-action">
            <i class="material-icons">indeterminate_check_box</i>
            <span>${t.__("Delete")}</span>
          </div>
        </div>
        <div class="setting-row" id="download-folder">
          <div class="setting-description">
            ${t.__("Default download location")}
          </div>
          <button class="download-folder-button green">
            ${t.__("Change")}
          </button>
        </div>
        <div class="setting-row">
          <div class="setting-description">
            <div class="download-folder-path">
              ${ConfigUtil.getConfigItem(
                "downloadsPath",
                app.getPath("downloads"),
              )}
            </div>
          </div>
        </div>
        <div class="setting-row" id="prompt-download">
          <div class="setting-description">
            ${t.__("Ask where to save files before downloading")}
          </div>
          <div class="setting-control"></div>
        </div>
      </div>
      <div class="title">${t.__("Factory Reset Data")}</div>
      <div class="settings-card">
        <div class="setting-row" id="factory-reset-option">
          <div class="setting-description">
            ${t.__(
              "Reset the application, thus deleting all the connected organizations and accounts.",
            )}
          </div>
          <button class="factory-reset-button red w-150">
            ${t.__("Factory Reset")}
          </button>
        </div>
      </div>
    </div>
  `.html;

  updateTrayOption();
  updateBadgeOption();
  updateSilentOption();
  updateSidebarOption();
  updateStartAtLoginOption();
  factoryReset();
  showDesktopNotification();
  enableSpellchecker();
  minimizeOnStart();
  addCustomCss();
  showCustomCssPath();
  removeCustomCss();
  downloadFolder();
  updateQuitOnCloseOption();
  updatePromptDownloadOption();
  enableErrorReporting();
  setLocale();
  initSpellChecker();

  // Platform specific settings

  // Flashing taskbar on Windows
  if (process.platform === "win32") {
    updateFlashTaskbar();
  }
  // Dock bounce on macOS
  else if (process.platform === "darwin") {
    updateDockBouncing();
  }

  // Auto hide menubar on Windows and Linux
  if (process.platform !== "darwin") {
    updateMenubarOption();
  }

  // Sound with a screen share, where the platform sends any
  if (sharesScreenAudio) {
    updateShareAudioOption();
  }

  // Push to talk, where a key can be watched at all
  if (canPushToTalk) {
    initPushToTalk();
  }

  function updateTrayOption(): void {
    generateSettingOption({
      $element: $root.querySelector(":scope #tray-option .setting-control")!,
      value: ConfigUtil.getConfigItem("trayIcon", true),
      clickHandler() {
        const newValue = !ConfigUtil.getConfigItem("trayIcon", true);
        ConfigUtil.setConfigItem("trayIcon", newValue);
        ipcRenderer.send("forward-message", "toggletray");
        updateTrayOption();
      },
    });
  }

  function updateMenubarOption(): void {
    generateSettingOption({
      $element: $root.querySelector(":scope #menubar-option .setting-control")!,
      value: ConfigUtil.getConfigItem("autoHideMenubar", false),
      clickHandler() {
        const newValue = !ConfigUtil.getConfigItem("autoHideMenubar", false);
        ConfigUtil.setConfigItem("autoHideMenubar", newValue);
        ipcRenderer.send("toggle-menubar", newValue);
        updateMenubarOption();
      },
    });
  }

  function updateBadgeOption(): void {
    generateSettingOption({
      $element: $root.querySelector(":scope #badge-option .setting-control")!,
      value: ConfigUtil.getConfigItem("badgeOption", true),
      clickHandler() {
        const newValue = !ConfigUtil.getConfigItem("badgeOption", true);
        ConfigUtil.setConfigItem("badgeOption", newValue);
        ipcRenderer.send("toggle-badge-option", newValue);
        updateBadgeOption();
      },
    });
  }

  function updateDockBouncing(): void {
    generateSettingOption({
      $element: $root.querySelector(
        ":scope #dock-bounce-option .setting-control",
      )!,
      value: ConfigUtil.getConfigItem("dockBouncing", true),
      clickHandler() {
        const newValue = !ConfigUtil.getConfigItem("dockBouncing", true);
        ConfigUtil.setConfigItem("dockBouncing", newValue);
        updateDockBouncing();
      },
    });
  }

  function updateFlashTaskbar(): void {
    generateSettingOption({
      $element: $root.querySelector(
        ":scope #flash-taskbar-option .setting-control",
      )!,
      value: ConfigUtil.getConfigItem("flashTaskbarOnMessage", true),
      clickHandler() {
        const newValue = !ConfigUtil.getConfigItem(
          "flashTaskbarOnMessage",
          true,
        );
        ConfigUtil.setConfigItem("flashTaskbarOnMessage", newValue);
        updateFlashTaskbar();
      },
    });
  }

  function updateSilentOption(): void {
    generateSettingOption({
      $element: $root.querySelector(":scope #silent-option .setting-control")!,
      value: ConfigUtil.getConfigItem("silent", false),
      clickHandler() {
        const newValue = !ConfigUtil.getConfigItem("silent", true);
        ConfigUtil.setConfigItem("silent", newValue);
        updateSilentOption();
        ipcRenderer.send(
          "forward-to",
          currentBrowserWindow.webContents.id,
          "toggle-silent",
          newValue,
        );
      },
    });
  }

  // Off is a real answer, not a way of hiding the feature: it leaves the audio
  // graph alone on Linux, and on Windows it stops the desktop's own sound going
  // out with the video — which it did unconditionally, with no way to say no.
  function updateShareAudioOption(): void {
    generateSettingOption({
      $element: $root.querySelector(
        ":scope #share-audio-option .setting-control",
      )!,
      value: ConfigUtil.getConfigItem("shareApplicationAudio", true),
      clickHandler() {
        const newValue = !ConfigUtil.getConfigItem(
          "shareApplicationAudio",
          true,
        );
        ConfigUtil.setConfigItem("shareApplicationAudio", newValue);
        updateShareAudioOption();
      },
    });
  }

  /**
   The push-to-talk settings: the switch, the key, and the tones.

   One function rather than three of the shape above, because the three rows
   are not independent — the note under the key says different things depending
   on the switch, and recording a key is a small state machine that the other
   two have to be redrawn around.
   */
  function initPushToTalk(): void {
    const $key = $root.querySelector<HTMLButtonElement>(
      ":scope #push-to-talk-key-option .push-to-talk-key",
    )!;
    const $note = $root.querySelector(":scope #push-to-talk-note")!;

    // The key being recorded, when one is. `pending` holds a modifier that has
    // gone down and not yet come up: pressing Ctrl on the way to Ctrl+V must not
    // be recorded as Ctrl, and holding Ctrl on its own must be — the difference
    // only becomes clear on the next event, which is what this waits for.
    let recording = false;
    let pending: string | undefined;
    let complaint = "";

    const render = (): void => {
      const enabled = ConfigUtil.getConfigItem("pushToTalk", false);
      const hotkey = ConfigUtil.getConfigItem("pushToTalkKey", NO_HOTKEY);
      const bound = describeHotkey(hotkey);

      $key.textContent = recording
        ? pending === undefined
          ? t.__("Press a key…")
          : `${describeKey(pending)} …`
        : bound === ""
          ? t.__("Choose")
          : bound;
      $key.classList.toggle("recording", recording);

      $note.textContent =
        complaint === ""
          ? recording
            ? t.__("Press the key to hold, or Escape to cancel.")
            : enabled && bound === ""
              ? t.__(
                  "No key chosen yet, so nothing is holding the microphone shut.",
                )
              : t.__(
                  "The key still types whatever it normally types, so a spare one — F13 and up, or a modifier on its own — works best. The call’s own mute button keeps working on top of this.",
                )
          : complaint;
    };

    const stopRecording = (): void => {
      recording = false;
      pending = undefined;
      globalThis.removeEventListener("keydown", onKeyDown, {capture: true});
      globalThis.removeEventListener("keyup", onKeyUp, {capture: true});
      globalThis.removeEventListener("blur", stopRecording);
      render();
    };

    const choose = (hotkey: Hotkey): void => {
      if (!isBound(hotkey)) {
        // A key with no Windows virtual key behind it: the media keys, and
        // whatever a future keyboard invents. Refused here rather than stored
        // and silently never matched.
        complaint = t.__("That key cannot be used. Try another.");
        stopRecording();
        return;
      }

      complaint = "";
      ConfigUtil.setConfigItem("pushToTalkKey", hotkey);
      ipcRenderer.send("configure-push-to-talk");
      stopRecording();
    };

    function onKeyDown(event: KeyboardEvent): void {
      // Swallowed while recording, all of it: the point of the mode is that
      // keys mean nothing but themselves, and Escape in particular has a job
      // here that it does not have anywhere else on this page.
      event.preventDefault();
      event.stopPropagation();

      if (event.code === "Escape") {
        complaint = "";
        stopRecording();
        return;
      }

      if (/^(?:Control|Shift|Alt|Meta)(?:Left|Right)$/v.test(event.code)) {
        pending = event.code;
        render();
        return;
      }

      choose(hotkeyFromEvent(event));
    }

    function onKeyUp(event: KeyboardEvent): void {
      event.preventDefault();
      event.stopPropagation();

      // A modifier pressed and let go with nothing in between is the binding
      // somebody meant: right control, right alt, the keys nothing else on the
      // machine wants. A modifier let go after another key had already been
      // chosen never reaches here, the recording having ended with that key.
      if (recording && event.code === pending) {
        choose(hotkeyFromEvent(event));
      }
    }

    $key.addEventListener("click", () => {
      if (recording) {
        stopRecording();
        return;
      }

      recording = true;
      pending = undefined;
      complaint = "";
      globalThis.addEventListener("keydown", onKeyDown, {capture: true});
      globalThis.addEventListener("keyup", onKeyUp, {capture: true});
      // Recording with the window in the background would be recording
      // somebody else's typing.
      globalThis.addEventListener("blur", stopRecording);
      render();
    });

    // Redrawn rather than re-initialised when either switch is flipped: this
    // function is the one that adds the listener to the key button, and calling
    // it again would add a second.
    const drawSwitches = (): void => {
      generateSettingOption({
        $element: $root.querySelector(
          ":scope #push-to-talk-option .setting-control",
        )!,
        value: ConfigUtil.getConfigItem("pushToTalk", false),
        clickHandler() {
          ConfigUtil.setConfigItem(
            "pushToTalk",
            !ConfigUtil.getConfigItem("pushToTalk", false),
          );
          ipcRenderer.send("configure-push-to-talk");
          drawSwitches();
          render();
        },
      });

      generateSettingOption({
        $element: $root.querySelector(
          ":scope #push-to-talk-tones-option .setting-control",
        )!,
        value: ConfigUtil.getConfigItem("pushToTalkTones", true),
        clickHandler() {
          ConfigUtil.setConfigItem(
            "pushToTalkTones",
            !ConfigUtil.getConfigItem("pushToTalkTones", true),
          );
          drawSwitches();
        },
      });
    };

    drawSwitches();
    render();

    // Whether the machine can actually watch a key, which only the main process
    // knows: the addon may be missing from the package, or Windows may have
    // refused the hook. Asked after the section is drawn rather than before,
    // because the answer is nearly always yes and a settings page should not
    // wait on it.
    (async () => {
      if (!(await ipcRenderer.invoke("push-to-talk-available"))) {
        complaint = t.__(
          "This machine cannot watch a key in the background, so push to talk is unavailable here.",
        );
        render();
      }
    })();
  }

  function showDesktopNotification(): void {
    generateSettingOption({
      $element: $root.querySelector(
        ":scope #show-notification-option .setting-control",
      )!,
      value: ConfigUtil.getConfigItem("showNotification", true),
      clickHandler() {
        const newValue = !ConfigUtil.getConfigItem("showNotification", true);
        ConfigUtil.setConfigItem("showNotification", newValue);
        showDesktopNotification();
      },
    });
  }

  function updateSidebarOption(): void {
    generateSettingOption({
      $element: $root.querySelector(":scope #sidebar-option .setting-control")!,
      value: ConfigUtil.getConfigItem("showSidebar", true),
      clickHandler() {
        const newValue = !ConfigUtil.getConfigItem("showSidebar", true);
        ConfigUtil.setConfigItem("showSidebar", newValue);
        ipcRenderer.send("forward-message", "toggle-sidebar", newValue);
        updateSidebarOption();
      },
    });
  }

  function updateStartAtLoginOption(): void {
    generateSettingOption({
      $element: $root.querySelector(
        ":scope #startAtLogin-option .setting-control",
      )!,
      value: ConfigUtil.getConfigItem("startAtLogin", false),
      clickHandler() {
        const newValue = !ConfigUtil.getConfigItem("startAtLogin", false);
        ConfigUtil.setConfigItem("startAtLogin", newValue);
        updateStartAtLoginOption();
        // Drawn again once the main process is done, from the setting as it
        // then stands: Windows may have refused, and the setting been put back.
        void (async () => {
          await ipcRenderer.invoke("toggleAutoLauncher", newValue);
          updateStartAtLoginOption();
        })();
      },
    });
  }

  function updateQuitOnCloseOption(): void {
    generateSettingOption({
      $element: $root.querySelector(
        ":scope #quitOnClose-option .setting-control",
      )!,
      value: ConfigUtil.getConfigItem("quitOnClose", false),
      clickHandler() {
        const newValue = !ConfigUtil.getConfigItem("quitOnClose", false);
        ConfigUtil.setConfigItem("quitOnClose", newValue);
        updateQuitOnCloseOption();
      },
    });
  }

  function enableSpellchecker(): void {
    generateSettingOption({
      $element: $root.querySelector(
        ":scope #enable-spellchecker-option .setting-control",
      )!,
      value: ConfigUtil.getConfigItem("enableSpellchecker", true),
      clickHandler() {
        const newValue = !ConfigUtil.getConfigItem("enableSpellchecker", true);
        ConfigUtil.setConfigItem("enableSpellchecker", newValue);
        ipcRenderer.send("configure-spell-checker");
        enableSpellchecker();
        const spellcheckerLanguageInput: HTMLElement =
          $root.querySelector("#spellcheck-langs")!;
        const spellcheckerNote: HTMLElement = $root.querySelector("#note")!;
        spellcheckerLanguageInput.style.display =
          spellcheckerLanguageInput.style.display === "none" ? "" : "none";
        spellcheckerNote.style.display =
          spellcheckerNote.style.display === "none" ? "" : "none";
      },
    });
  }

  function enableErrorReporting(): void {
    generateSettingOption({
      $element: $root.querySelector(
        ":scope #enable-error-reporting .setting-control",
      )!,
      value: ConfigUtil.getConfigItem("errorReporting", true),
      clickHandler() {
        const newValue = !ConfigUtil.getConfigItem("errorReporting", true);
        ConfigUtil.setConfigItem("errorReporting", newValue);
        enableErrorReporting();
      },
    });
  }

  async function customCssDialog(): Promise<void> {
    const showDialogOptions: OpenDialogOptions = {
      title: t.__("Select file"),
      properties: ["openFile"],
      filters: [{name: t.__("CSS file"), extensions: ["css"]}],
    };

    const {filePaths, canceled} =
      await dialog.showOpenDialog(showDialogOptions);
    if (!canceled && filePaths[0] !== undefined) {
      ConfigUtil.setConfigItem("customCSS", filePaths[0]);
      ipcRenderer.send("forward-message", "hard-reload");
    }
  }

  function setLocale(): void {
    const langDiv: HTMLSelectElement = $root.querySelector(".lang-div")!;
    const langListHtml = generateSelectHtml(supportedLocales, "lang-menu");
    langDiv.innerHTML += langListHtml.html;
    // `langMenu` is the select-option dropdown menu formed after executing the previous command
    const langMenu: HTMLSelectElement = $root.querySelector(".lang-menu")!;

    // The next three lines set the selected language visible on the dropdown button
    let language = ConfigUtil.getConfigItem("appLanguage", "en");
    language =
      language !== null && langMenu.options.namedItem(language)
        ? language
        : "en";
    langMenu.options.namedItem(language)!.selected = true;

    langMenu.addEventListener("change", () => {
      ConfigUtil.setConfigItem("appLanguage", langMenu.value);
    });
  }

  function minimizeOnStart(): void {
    generateSettingOption({
      $element: $root.querySelector(
        ":scope #start-minimize-option .setting-control",
      )!,
      value: ConfigUtil.getConfigItem("startMinimized", false),
      clickHandler() {
        const newValue = !ConfigUtil.getConfigItem("startMinimized", false);
        ConfigUtil.setConfigItem("startMinimized", newValue);
        minimizeOnStart();
      },
    });
  }

  function addCustomCss(): void {
    const customCssButton = $root.querySelector(
      ":scope #add-custom-css .custom-css-button",
    )!;
    customCssButton.addEventListener("click", () => {
      void customCssDialog();
    });
  }

  function showCustomCssPath(): void {
    const customCss = ConfigUtil.getConfigItem("customCSS", null);
    if (customCss === null || customCss === false) {
      const cssPath: HTMLElement = $root.querySelector("#remove-custom-css")!;
      cssPath.style.display = "none";
    }
  }

  function removeCustomCss(): void {
    $root.querySelector("#css-delete-action")!.addEventListener("click", () => {
      ConfigUtil.setConfigItem("customCSS", "");
      ipcRenderer.send("forward-message", "hard-reload");
    });
  }

  async function downloadFolderDialog(): Promise<void> {
    const showDialogOptions: OpenDialogOptions = {
      title: t.__("Select Download Location"),
      properties: ["openDirectory"],
    };

    const {filePaths, canceled} =
      await dialog.showOpenDialog(showDialogOptions);
    if (!canceled && filePaths[0] !== undefined) {
      ConfigUtil.setConfigItem("downloadsPath", filePaths[0]);
      const downloadFolderPath: HTMLElement = $root.querySelector(
        ".download-folder-path",
      )!;
      downloadFolderPath.textContent = filePaths[0];
    }
  }

  function downloadFolder(): void {
    const downloadFolderButton = $root.querySelector(
      ":scope #download-folder .download-folder-button",
    )!;
    downloadFolderButton.addEventListener("click", () => {
      void downloadFolderDialog();
    });
  }

  function updatePromptDownloadOption(): void {
    generateSettingOption({
      $element: $root.querySelector(
        ":scope #prompt-download .setting-control",
      )!,
      value: ConfigUtil.getConfigItem("promptDownload", false),
      clickHandler() {
        const newValue = !ConfigUtil.getConfigItem("promptDownload", false);
        ConfigUtil.setConfigItem("promptDownload", newValue);
        updatePromptDownloadOption();
      },
    });
  }

  async function factoryResetSettings(): Promise<void> {
    const clearAppDataMessage = t.__(
      "When the application restarts, it will be as if you have just downloaded the Zulip app.",
    );
    const appDataPath = path.join(app.getPath("appData"), app.name);

    const {response} = await dialog.showMessageBox({
      type: "warning",
      buttons: [t.__("Yes"), t.__("No")],
      defaultId: 0,
      message: t.__("Are you sure?"),
      detail: clearAppDataMessage,
    });
    if (response === 0) {
      await fs.promises.rmdir(appDataPath, {recursive: true});
      setTimeout(() => {
        ipcRenderer.send("clear-app-settings");
      }, 1000);
    }
  }

  function factoryReset(): void {
    const factoryResetButton = $root.querySelector(
      ":scope #factory-reset-option .factory-reset-button",
    )!;
    factoryResetButton.addEventListener("click", () => {
      void factoryResetSettings();
    });
  }

  function initSpellChecker(): void {
    const note: HTMLElement = $root.querySelector("#note")!;
    // The Electron API is a no-op on macOS and macOS default spellchecker is used.
    if (process.platform === "darwin") {
      note.append(t.__("On macOS, the OS spellchecker is used."));
      note.append(document.createElement("br"));
      note.append(
        t.__(
          "Change the language from System Preferences → Keyboard → Text → Spelling.",
        ),
      );
    } else {
      note.append(
        t.__("You can select a maximum of 3 languages for spellchecking."),
      );
      const spellDiv: HTMLElement = $root.querySelector("#spellcheck-langs")!;
      spellDiv.innerHTML += html`
        <div class="setting-description">${t.__("Spellchecker Languages")}</div>
        <div id="spellcheck-langs-value">
          <input name="spellcheck" placeholder="${t.__("Enter Languages")}" />
        </div>
      `.html;

      const availableLanguages = session.fromPartition(
        "persist:webviewsession",
      ).availableSpellCheckerLanguages;
      let languagePairs = new Map<string, string>();
      for (const l of availableLanguages) {
        const locale = new Intl.Locale(l.replaceAll("_", "-"));
        let displayName = new Intl.DisplayNames([locale], {
          type: "language",
        }).of(locale.language);
        if (displayName === undefined) {
          continue;
        }

        displayName = displayName.replace(/^./v, (firstChar) =>
          firstChar.toLocaleUpperCase(locale),
        );
        if (locale.script !== undefined) {
          displayName += ` (${new Intl.DisplayNames([locale], {type: "script"}).of(locale.script)})`;
        }

        if (locale.region !== undefined) {
          displayName += ` (${new Intl.DisplayNames([locale], {type: "region"}).of(locale.region)})`;
        }

        languagePairs.set(displayName, l);
      }

      languagePairs = new Map(
        [...languagePairs].toSorted((a, b) => a[0].localeCompare(b[0])),
      );

      const tagField: HTMLInputElement = $root.querySelector(
        "input[name=spellcheck]",
      )!;
      const tagify = new Tagify(tagField, {
        whitelist: languagePairs.keys().toArray(),
        enforceWhitelist: true,
        maxTags: 3,
        dropdown: {
          enabled: 0,
          maxItems: Infinity,
          closeOnSelect: false,
          highlightFirst: true,
          position: "manual",
          classname: "settings-tagify-dropdown",
        },
      });
      tagify.DOM.input.addEventListener("focus", () => {
        tagify.dropdown.show();
        $root
          .querySelector("#spellcheck-langs-value")!
          .append(tagify.DOM.dropdown);
      });
      tagify.DOM.input.addEventListener("blur", () => {
        tagify.dropdown.hide(true);
        tagify.DOM.dropdown.remove();
      });

      const configuredLanguages: string[] = (
        ConfigUtil.getConfigItem("spellcheckerLanguages", null) ?? []
      ).map(
        (code: string) =>
          [...languagePairs].find((pair) => pair[1] === code)![0],
      );
      tagify.addTags(configuredLanguages);

      tagField.addEventListener("change", () => {
        if (tagField.value.length === 0) {
          ConfigUtil.setConfigItem("spellcheckerLanguages", []);
        } else {
          const data: unknown = JSON.parse(tagField.value);
          const spellLangs: string[] = z
            .array(z.object({value: z.string()}))
            .parse(data)
            .map((elt) => languagePairs.get(elt.value)!);
          ConfigUtil.setConfigItem("spellcheckerLanguages", spellLangs);
        }

        ipcRenderer.send("configure-spell-checker");
      });
    }

    // Do not display the spellchecker input and note if it is disabled
    if (!ConfigUtil.getConfigItem("enableSpellchecker", true)) {
      const spellcheckerLanguageInput: HTMLElement =
        $root.querySelector("#spellcheck-langs")!;
      const spellcheckerNote: HTMLElement = $root.querySelector("#note")!;
      spellcheckerLanguageInput.style.display = "none";
      spellcheckerNote.style.display = "none";
    }
  }
}
