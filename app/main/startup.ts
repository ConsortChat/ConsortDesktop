import {app} from "electron/main";
import path from "node:path";
import process from "node:process";

import AutoLaunch from "auto-launch";

import * as ConfigUtil from "../common/config-util.ts";
import {bundlePath} from "../common/paths.ts";

// The Store build's startup task, by the name packaging/appx-extensions.xml
// declares it under. Two files, one string: a mismatch is a task Windows cannot
// find.
const STARTUP_TASK_ID = "ConsortStartup";

type StartupTaskState =
  | "disabled"
  | "disabledByUser"
  | "enabled"
  | "disabledByPolicy"
  | "enabledByPolicy";

type Addon = {
  query: (taskId: string) => Promise<StartupTaskState>;
  enable: (taskId: string) => Promise<StartupTaskState>;
  disable: (taskId: string) => Promise<StartupTaskState>;
};

let addon: Addon | undefined;
let addonUnavailable = false;

/** Where the compiled addon is, which is not the same place twice. */
function addonPath(): string {
  return app.isPackaged
    ? path.join(process.resourcesPath, "native", "consort_startup.node")
    : path.join(bundlePath, "../../native/build/Release/consort_startup.node");
}

/**
 The native half, loaded the first time it is wanted.

 A missing or unloadable binary leaves the setting doing nothing and says so in
 the log, rather than an app that will not start.
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
    console.error("could not load the startup task addon", error);
    addonUnavailable = true;
  }

  return addon;
}

/**
 Make the setting say what Windows is going to do at login.

 In the Store build the answer is Windows' to keep, not the app's — see
 native/src/startup-task-win.cc — so whatever the setting asked for, it ends up
 holding the state the task is really in.
 */
function believe(state: StartupTaskState): void {
  const on = state === "enabled" || state === "enabledByPolicy";
  if (ConfigUtil.getConfigItem("startAtLogin", false) === on) {
    return;
  }

  if (state === "disabledByUser") {
    console.warn(
      "[consort] starting at login was switched off in Windows, and only " +
        "Windows Settings can switch it back on",
    );
  } else {
    console.warn(`[consort] the startup task is ${state}; the setting follows`);
  }

  ConfigUtil.setConfigItem("startAtLogin", on);
}

async function setStartupTask(wanted: boolean): Promise<void> {
  const loaded = load();
  if (loaded === undefined) {
    return;
  }

  try {
    believe(
      await (wanted
        ? loaded.enable(STARTUP_TASK_ID)
        : loaded.disable(STARTUP_TASK_ID)),
    );
  } catch (error: unknown) {
    console.error("could not change the startup task", error);
  }
}

export const setAutoLaunch = async (
  AutoLaunchValue: boolean,
): Promise<void> => {
  // Don't run this in development
  if (!app.isPackaged) {
    return;
  }

  const autoLaunchOption = ConfigUtil.getConfigItem(
    "startAtLogin",
    AutoLaunchValue,
  );

  // `setLoginItemSettings` doesn't support linux
  if (process.platform === "linux") {
    const autoLauncher = new AutoLaunch({
      name: app.name,
      isHidden: false,
    });
    await (autoLaunchOption ? autoLauncher.enable() : autoLauncher.disable());
  } else if (process.windowsStore) {
    // Packaged: the Run key `setLoginItemSettings` writes is one nothing at
    // login can see.
    await setStartupTask(autoLaunchOption);
  } else {
    app.setLoginItemSettings({
      openAtLogin: autoLaunchOption,
      openAsHidden: false,
    });
  }
};

/**
 Bring the setting into line with the startup task, in the Store build.

 Run at launch, because the task can be switched off in Settings or Task Manager
 while the app is not running, and a preferences page still showing it on would
 be a switch saying one thing while Windows does another.
 */
export async function syncStartupTask(): Promise<void> {
  if (!app.isPackaged || !process.windowsStore) {
    return;
  }

  const loaded = load();
  if (loaded === undefined) {
    return;
  }

  try {
    believe(await loaded.query(STARTUP_TASK_ID));
  } catch (error: unknown) {
    console.error("could not read the startup task", error);
  }
}
