{
  # The two things Windows can do that Electron cannot reach: capturing one
  # application's sound, and watching one key while the app is in the
  # background. Separate addons, sharing nothing but this file — a machine that
  # cannot load one has no reason to lose the other.
  #
  # Capturing one application's sound on Windows.
  #
  # WHY a native addon at all: Electron's screen share reply takes
  # `audio: "loopback"`, which means the default render device — the whole
  # machine. There is nothing per-window or per-application in it, and the
  # WebFrameMain form captures one of our own frames rather than somebody
  # else's program. Windows itself can do this, through WASAPI process
  # loopback, and nothing in Electron reaches that API.
  #
  # It builds everywhere so that `npm install` on Linux and macOS is not a
  # failure. There is simply nothing to capture there: those platforms compile
  # a stub whose start() throws, and the Linux screen share has its own route
  # to the same end anyway — see app/main/linux-audio-share.ts.
  "targets": [
    {
      "target_name": "consort_app_audio",
      "include_dirs": ["<!(node -p \"require('node-addon-api').include_dir\")"],
      # Exceptions are used for the COM error handling below, and node-addon-api
      # needs to know which it was built against.
      "defines": ["NAPI_VERSION=8", "NOMINMAX", "UNICODE", "_UNICODE"],
      "cflags!": ["-fno-exceptions"],
      "cflags_cc!": ["-fno-exceptions"],
      "conditions": [
        [
          "OS=='win'",
          {
            "sources": ["src/app-audio-win.cc"],
            # mmdevapi for ActivateAudioInterfaceAsync, ole32 for COM itself.
            "libraries": ["-lmmdevapi.lib", "-lole32.lib"],
            # No /std here on purpose: node-gyp's own toolchain already asks for
            # a newer standard than this needs, and stating one only overrides
            # it downwards with a warning to say so.
            #
            # No debug information either. A release build has no use for a
            # program database, and generating one makes every incremental build
            # after the first fail with LNK1103 "debugging information corrupt"
            # — which reads like a broken source file and is fixed by deleting
            # the build tree, so it costs a rebuild each time to learn nothing.
            "msvs_settings": {
              "VCCLCompilerTool": {
                "ExceptionHandling": 1,
                "DebugInformationFormat": "0"
              },
              "VCLinkerTool": {"GenerateDebugInformation": "false"}
            }
          },
          {"sources": ["src/app-audio-unsupported.cc"]}
        ]
      ]
    },
    # Watching the push-to-talk key, everywhere, on Windows.
    #
    # WHY a native addon: globalShortcut reports a press and never a release,
    # and a microphone gate needs both edges. See src/hotkey-win.cc.
    #
    # It builds everywhere for the same reason as its neighbour: elsewhere the
    # stub answers isSupported() with false and the setting is not offered.
    {
      "target_name": "consort_hotkey",
      "include_dirs": ["<!(node -p \"require('node-addon-api').include_dir\")"],
      "defines": ["NAPI_VERSION=8", "NOMINMAX", "UNICODE", "_UNICODE"],
      # Exceptions on, as next door. Nothing here throws deliberately, but
      # node-addon-api refuses to compile without an answer either way, and
      # std::thread's own failure is an exception — one worth being able to
      # unwind rather than terminate on.
      "cflags!": ["-fno-exceptions"],
      "cflags_cc!": ["-fno-exceptions"],
      "conditions": [
        [
          "OS=='win'",
          {
            "sources": ["src/hotkey-win.cc"],
            # user32 for the hook and the message loop it needs.
            "libraries": ["-luser32.lib"],
            # No program database, for the LNK1103 reason given above.
            "msvs_settings": {
              "VCCLCompilerTool": {
                "ExceptionHandling": 1,
                "DebugInformationFormat": "0"
              },
              "VCLinkerTool": {"GenerateDebugInformation": "false"}
            }
          },
          {"sources": ["src/hotkey-unsupported.cc"]}
        ]
      ]
    },
    # Starting at login, in the Microsoft Store build.
    #
    # WHY a native addon: a packaged app starts at login through a startup task
    # declared in its manifest, switched through a WinRT API Electron does not
    # reach. See src/startup-task-win.cc.
    #
    # It builds everywhere, like its neighbours, and into both Windows builds:
    # the installer build carries it unused, since only a packaged app asks.
    {
      "target_name": "consort_startup",
      "include_dirs": ["<!(node -p \"require('node-addon-api').include_dir\")"],
      "defines": ["NAPI_VERSION=8", "NOMINMAX", "UNICODE", "_UNICODE"],
      # Exceptions on: C++/WinRT reports every failure as one.
      "cflags!": ["-fno-exceptions"],
      "cflags_cc!": ["-fno-exceptions"],
      "conditions": [
        [
          "OS=='win'",
          {
            "sources": ["src/startup-task-win.cc"],
            # windowsapp for the WinRT runtime C++/WinRT calls into.
            "libraries": ["-lwindowsapp.lib"],
            # No program database, for the LNK1103 reason given above.
            "msvs_settings": {
              "VCCLCompilerTool": {
                "ExceptionHandling": 1,
                "DebugInformationFormat": "0"
              },
              "VCLinkerTool": {"GenerateDebugInformation": "false"}
            }
          },
          {"sources": ["src/startup-task-unsupported.cc"]}
        ]
      ]
    }
  ]
}
