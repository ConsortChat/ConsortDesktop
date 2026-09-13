import {z} from "zod";

// https://github.com/colinhacks/zod/discussions/5983
export const exactPartial = <Shape extends z.ZodRawShape>(
  schema: z.ZodObject<Shape>,
) =>
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
  z.util.partial(z.ZodExactOptional, schema, undefined) as z.ZodObject<{
    -readonly [K in keyof Shape]: z.ZodExactOptional<Shape[K]>;
  }>;

export type MenuProperties = {
  tabs: TabData[];
  activeTabIndex?: number;
  enableMenu?: boolean;
};

export type NavigationItem =
  | "General"
  | "Network"
  | "AddServer"
  | "Organizations"
  | "Shortcuts";

export type ServerConfig = {
  url: string;
  alias: string;
  icon: string;
  zulipVersion: string;
  zulipFeatureLevel: number;
};

// One thing a user can choose to share: a whole screen, or a single window.
//
// Not Electron's DesktopCapturerSource, which carries a NativeImage and would
// not survive an IPC boundary. Thumbnails are rendered to data URLs in the main
// process, where the sources are enumerated, so the picker only ever handles
// values that can be sent.
export type ScreenShareSource = {
  id: string;
  name: string;
  kind: "screen" | "window";
  /**
   Absent when the picker first opens, and filled in by
   `display-media-thumbnails` once they have been captured. Enumerating the
   sources is quick; capturing a picture of each one can take seconds.
   */
  thumbnailDataUrl?: string | undefined;
  appIconDataUrl?: string | undefined;
  /**
   The application this window belongs to, where its sound can be sent on its
   own — Windows only, and absent for a screen, which is nobody's application.

   Resolved here rather than in the picker because it takes a window handle and
   a process, neither of which a renderer has any business holding.
   */
  application?: {processId: number; name: string} | undefined;
};

/**
 The key standing for everything playing at once, rather than for one
 application in the list.

 Shared between the two sides on purpose: the main process picks it by itself
 for a whole-screen share, and the picker offers it by name, and a key spelled
 two ways would silently mean "nothing".
 */
export const EVERYTHING_PLAYING = "everything";

/** An app currently playing audio, whose sound a call could be given. */
export type ShareableApp = {
  /**
   Opaque handle for the application, not for one of its sounds: picking it
   shares everything that application is playing. Stable only for as long as it
   keeps playing.
   */
  key: string;
  /**
   Sounds of its own that can be offered separately, each with its own key —
   a browser's tabs, which name their own streams after the page. Empty when
   nothing tells them apart.
   */
  streams: Array<{key: string; name: string}>;
  /** The window's title where the desktop will say, its application's name otherwise. */
  name: string;
};

export type TabRole = "server" | "function";
export type TabPage = "Settings" | "About";

export type TabData = {
  role: TabRole;
  page?: TabPage | undefined;
  label: string;
  index: number;
};
