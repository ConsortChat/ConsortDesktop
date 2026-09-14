# Version History

All notable changes to the desktop app are documented in this file. Entries
below the first are inherited from Zulip Desktop, which this is a fork of.

### Unreleased

**Fixes**:

- Push to talk no longer beeps when you are not in a call. The tones confirming
  that the microphone opened and closed played on every press of the key,
  including while nothing was listening; they now play only while a call has
  the microphone, which is the only time the key does anything.

### Consort v5.12.4-19 --2026-09-13

**Fixes**:

- Releases are published from
  [ConsortChat/ConsortDesktop](https://github.com/ConsortChat/ConsortDesktop/releases),
  and the app's links to its releases page and issue tracker now go there. The
  release build still uploaded to the old Dyslectric/Consort-Desktop repository,
  so run from its new home it built everything and then failed to publish it.
  Releases up to 5.12.4-18 stay where they were.

### Consort v5.12.4-18 --2026-09-13

**Fixes**:

- The screen share picker opens straight away on Windows, where it could take
  five seconds to appear. Electron will not list the windows on offer until it
  has a picture of every one of them, and a window that never gives one — a
  password manager's, typically — is waited out on a timer. The picker now
  opens on the list alone and draws the pictures in as they arrive, so a window
  like that costs a blank tile rather than holding up every share.

### Consort v5.12.4-17 --2026-08-16

**Fixes**:

- Screen sharing a whole monitor is smoother, at around fifty frames a second
  where it managed thirty. Chromium captures a screen through Windows Graphics
  Capture by default, which is the right choice for sharing a single window and
  an expensive one for a whole panel: grabbing a 3440x1440 display that way costs
  about 15ms, and the capture loop will not spend more than half its time
  capturing, so it settled into one frame every 30ms no matter what the call
  asked for. Monitors are now captured through DXGI instead. Window shares are
  untouched, and where DXGI is unavailable Chromium still falls back on its own.

### Consort v5.12.4-16 --2026-08-15

**Features**:

- Push to talk, on Windows. Hold a key to speak, with the microphone shut the
  rest of the time — including while the app is in the background, which is the
  only kind worth having, since the thing you are talking over is usually the
  thing you are looking at. Off by default; the key is chosen in
  **Settings → General → Push to Talk**, and a tone can sound as the microphone
  opens and shuts.

  It is a layer in front of the call's mute button rather than that button being
  pressed for you. Muting yourself still mutes you, nothing about your mute
  state is published as you talk, and the speaking indicator follows the gate —
  so a conversation in the room with the key up lights nothing up at the far
  end. Turning the feature off leaves your mute state exactly as it was, having
  never touched it.

  The key still types whatever it normally types, nothing being swallowed, so a
  spare one works best: F13 and up, or a modifier on its own. A combination has
  to match exactly, which is what stops every Ctrl+V opening the microphone.
  Switching it on during a call reaches the next capture rather than the one
  already running. See docs/push-to-talk.md, including why it takes an addon and
  why Linux is getting a separate program instead.

### Consort v5.12.4-15 --2026-08-15

**Fixes**:

- The picker no longer starts on an application. With one thing playing, opening
  it and clicking a window sent that application sound without anybody choosing
  to. Both platforms now start on no sound; the question Wayland asks when it
  cannot work the answer out keeps its suggestion, being an explicit question
  rather than a default riding on a click meant for something else.

### Consort v5.12.4-14 --2026-08-15

**Fixes**:

- A Linux screen share sends the shared application sound again. The capture
  device is found by its description, and the description was cut short the
  moment it was set: the modules are loaded without a shell, so the quotes
  written around a value containing a space were taken literally and everything
  after the space was lost. The page looked for a name that had never existed,
  found nothing, and sent the share silent.
- The two places that used to end a share without sound and without a word now
  say so, one of them listing the devices it did see — the difference between
  the name expected and the names present being the whole of the answer.
- On Windows, the sound of a shared application reaches the call as the share own
  audio rather than through the microphone. The hidden window that carries it is
  opened in the same session as the page asking for the share, and starts its
  audio before the share is handed over; without either, the frame was never
  captured, and what reached the far end was the speakers being picked up by the
  microphone.
- Windows shared sound no longer clicks. Buffers are spent at the rate they
  arrive, with the playback rate trimmed by a fraction of a percent to hold the
  queue steady, because the capture clock and the audio clock are both nominally
  48 kHz and are not the same clock.

### Consort v5.12.4-11 --2026-08-15

**Fixes**:

- The sound of a shared application reaches the call. In 5.12.4-10 it was
  captured correctly and then dropped on the way to being sent: buffers crossing
  between processes arrive as plain byte arrays, and the code reading them
  expected a richer type, so every one of them failed and the share went out
  silent.

### Consort v5.12.4-10 --2026-08-15

Windows can send one application's sound now, instead of all of it or none.

**Features**:

- The picker lists the applications behind the windows it is offering, by name.
  Choose one and that application's sound goes to the call on its own: the far
  end receives it as the screen share's own source, with its own volume, apart
  from your microphone. "Everything this computer is playing" is still there for
  a whole screen, and no sound is still the default.
- The sound is captured from the application itself rather than from the
  speakers, so nothing else on the machine reaches the call — not the other
  window, not a notification, not the call's own audio.

**Known limits**:

- A browser sends every tab it is playing, not the tab you shared. Browsers
  render all their audio in one shared process, and Windows can only separate
  audio by process, so there is nothing to select the tab with.
- Windows 10 2004 or later. Older versions still offer everything or nothing.

### Consort v5.12.4-9 --2026-08-15

Sharing a window on Windows sent the sound of everything else as well, and said
nothing about it.

**Features**:

- The picker asks what sound to send on Windows, the way it already did on
  Linux. There are two answers, because there are only two: no sound, or
  everything the computer is playing. Nothing narrower can be captured there —
  the audio a screen share can carry is the default output device, not a window
  and not an application — so the option says what it sends rather than implying
  it is limited to what you picked.
- It starts on no sound. A share is usually one window, and the alternative puts
  every other window, every notification and whatever is playing elsewhere into
  the call — quietly, since the person sharing hears none of it happen. Linux
  still starts on the application it would have chosen by itself, where a wrong
  guess costs one window rather than the machine.

**Fixes**:

- Sharing a single window no longer sends the whole desktop's sound without
  asking.

### Consort v5.12.4-8 --2026-08-14

The sound of a share travels with the share now, the way it does on Windows and
in the web client, instead of arriving as a microphone.

**Features**:

- A shared application's sound is a second track on the screen share itself. The
  far end receives it as the share's audio rather than as somebody talking, so a
  listener can turn the application down without turning down the person sharing
  it. This works on Wayland as well as X11: the video is held back until the
  sound has been routed, so it joins the stream there too.
- Nothing changes your default input any more. The old route worked by pointing
  it at a virtual microphone for as long as a share lasted; that device, the
  microphone loopback feeding it and the sink behind it are gone.
- Which application — or which tab — is shared is unchanged. Only how it is
  delivered is different.

**Fixes**:

- A tab opened during a share joins it almost at once, rather than up to four
  seconds later, and a stream the session parks on Consort's sink is put back
  almost at once rather than being sent to the call in the meantime. Sink inputs
  are followed with `pactl subscribe` instead of a four-second poll.
- The question Wayland asks when it cannot work out which application was meant
  now waits twelve seconds rather than eight, and answering after that says so.
  There is no microphone route left to carry a late answer, so missing the
  deadline costs the sound.

### Consort v5.12.4-7 --2026-08-14

Sharing one tab sent every tab, and the move that sent it was never the problem.

**Fixes**:

- Streams the session parks on Consort's sink by itself are put back. Moving a
  stream is how PulseAudio's `module-stream-restore` — and WirePlumber's
  `restore-stream` on PipeWire — is taught where an application's sound goes, so
  sharing a browser once teaches the session that every stream that browser makes
  from then on belongs on our sink. They arrive there with no move behind them
  and were captured along with the tab that was chosen. That memory is the
  session's rather than the app's, which is why it survived reinstalling.
- The eviction runs when a share starts as well as on every round of the watch,
  since the first moment of a capture is the one where a call is handed the
  track.

### Consort v5.12.4-6 --2026-08-14

Sharing one Firefox window sent every tab in it, and every tab of every other
Firefox window as well.

**Fixes**:

- A window share takes the tab the window is showing, where the window's title
  says which. Firefox names its window after the page and names the sound after
  the same page, so the window itself says which tab it is — which is the only
  thing that can say so on GNOME and KDE under Wayland, where nothing will tell
  an application which process owns a window.
- An application is only taken whole when nothing inside it can be told apart.
  It used to be taken whole whenever it was the only thing playing, which is how
  one shared window came to send four tabs and the window next to it. Where the
  parts are distinguishable and the title did not say which was meant, it asks.
- The question it asks starts on a real answer again. It always selected
  "everything that is playing", an option that only appears when two
  applications are playing, so a single browser's question opened showing
  nothing at all.

### Consort v5.12.4-5 --2026-08-14

Windows has been sending sound with every screen share for as long as there have
been screen shares, and never asked. Now it can be told not to.

**Fixes**:

- **Settings → General → "Send your computer's sound when you share your
  screen"** appears on Windows, and off means off. The switch was added for
  Linux and hidden everywhere else, which left the one platform that always sent
  audio as the one platform with no way to stop it.

What Windows sends is still the whole desktop's output rather than the window
you picked, and that is not a setting away: `loopback` is the only audio
Electron's display-media reply accepts, and it means the default playback
device. One window's sound would need per-process capture, which Electron does
not expose. So the switch is all-or-nothing there — worth having regardless,
since a notification arriving mid-share has been going out with it all along.

### Consort v5.12.4-4 --2026-08-14

The sound of what you share now travels with the share, and nothing asks you
which application to send.

**Features**:

- The sound goes on the screen share itself, where Windows has always put it. A
  call receives it as the share's own audio rather than as somebody talking, so
  echo cancellation, noise suppression and gain control are off — the three
  microphone defaults that make a shared video sound underwater.
- Nothing asks first. A whole screen sends everything playing, including
  whatever starts afterwards; a window sends the application that owns it,
  identified by its title where the desktop will say which. A banner then says
  what is going out, and carries the way to stop it.
- The one case that cannot be worked out still asks: a window share with several
  applications playing, on GNOME or KDE under Wayland, where nothing will say
  which window belongs to which. The share waits about eight seconds for an
  answer and then goes without sound, rather than not going at all.
- The X11 picker's sound list starts on the answer the app would have chosen, so
  picking a window and picking silence are no longer the same gesture.
- **Settings → General → "Send an application's sound when you share your
  screen"** turns all of it off. Off leaves the audio graph alone entirely:
  nothing routed, no banner, and no list in the picker.

**Fixes**:

- A call taking its sound off the share is no longer mistaken for nobody
  listening. The idle check watched only the older of the two devices, so the
  routing was pulled out from under such a call a few seconds in.
- A whole-screen share survives silence. Ending a share after twelve seconds of
  quiet is right for an application that closed and wrong for a screen, where a
  video started a minute in would have arrived nowhere.
- Two shares starting at once no longer build the audio device twice, which left
  a second set of PulseAudio modules loaded with nothing pointing at them.

### Consort v5.12.4-3 --2026-08-13

All of this is the list of applications whose sound you can send into a call,
which said "Firefox, Firefox, Firefox" and left you to guess.

**Features**:

- The list offers applications rather than sounds. A browser playing in three
  tabs is one row, and sharing it sends all three — where before it sent one of
  them, chosen arbitrarily, with nothing on screen to say which.
- Anything the shared application starts afterwards joins it. Browsers destroy
  and rebuild their audio stream for every video, so without this a share went
  silent at the end of the first one.
- A browser's tabs are offered individually beneath it, named after the page:
  "Never Gonna Give You Up - YouTube". Firefox names each stream after what is
  playing, which is the only thing in the audio graph that tells one tab from
  another. Picking a tab shares that tab alone.
- Rows are named after the window making the sound, where the desktop will say
  which. Hyprland, sway and X11 will; GNOME and KDE will not, for reasons in
  `docs/linux-screen-sharing.md`, and there they keep the application names.

**Fixes**:

- Consort's own loopbacks are no longer offered as applications to share. They
  appeared as "loopback-1419-13 output" once a share was running, and sharing
  the one reading our own sink would have fed it back round.
- Pausing no longer ends a share. The stream disappearing was treated as the
  application closing, so a share ended between one video and the next.
- Two applications in separate containers are two rows. A containerised
  application reports the process id it has inside its container — Moonlight in
  a Flatpak calls itself pid 2 — so identifying a row by process alone could
  merge two unrelated ones.

### Consort v5.12.4-2 --2026-08-13

Everything here is about Linux, where the first packaging was thin.

**Features**:

- Screen sharing carries sound. The desktop cannot supply it —
  `org.freedesktop.portal.ScreenCast` has no audio in it at all — so Consort
  routes one application's output, mixed with your microphone, into the call as
  an input device named "Consort share". You still hear the application
  yourself, your own voice is not played back at you, and the call's own audio
  is never captured: sharing that would send the other participants back to
  themselves.
- On Wayland the desktop's own share dialog is left to do the choosing, instead
  of being followed by a second dialog asking the same question.

**Fixes**:

- `install.sh` makes the bundled libraries executable, not only the binary.
  Without it Chromium could not load its own graphics and media libraries.
- The installed tree is owned by root, and the sandbox helper is setuid to root
  rather than to whoever unpacked the archive — which looks identical in a
  listing and does not work.
- Applications that do not set `application.name` are offered for audio sharing
  too, by their binary or by what they are playing, instead of being silently
  absent.
- Sharing an application's sound ends when the call does, taking its banner
  with it, rather than outliving the call that asked for it.

### Consort v5.12.4-1 --2026-08-12

The first Consort release. It deliberately carries the version number of the
Zulip Desktop release it was forked from, with a `-1` revision suffix: this is
Consort's first packaging of upstream's 5.12.4, in the sense Debian means it,
so the entry immediately below describes the code this is built on rather than
an earlier release of this app.

**Features**:

- Screen sharing. Electron supplies no picker of its own, so calls could not
  share a screen at all; Consort draws one, outside every webview so a page
  cannot fake it. On Windows the chosen window's audio is shared with it.
- Calls ask before using the camera or microphone, and remember the answer per
  organization.

**Changes**:

- The Linux archive carries an icon, a desktop entry and an `install.sh` that
  installs to `/opt/Consort-Desktop`.
- Consort's own icons throughout: app, tray, installer, DMG, and the offline page.
- The window title, tray menu and About dialog name this app rather than Zulip.
- The About dialog credits its actual maintainer, links its licence to this
  repository, and says what it was forked from.
- Release notes, issue reporting and "create an organization" link here rather
  than to Zulip's equivalents.
- The enterprise config moves to `Consort-Desktop-Config` on Windows and
  `/etc/consort-desktop-config` elsewhere.

**Removals**:

- The auto-update machinery. This app does not update itself, so the menu item,
  the settings and the electron-updater dependency are gone.
- The Debian package no longer installs Zulip's APT repository and signing key,
  and removes them from machines that already have them.

### v5.12.4 --2026-06-25

**Enhancements**:

- Updated translations, including new languages Estonian, Hebrew, Norwegian, and Norwegian Nynorsk.
- The Linux Snap package has been updated with native Wayland support.

**Dependencies**:

- Upgraded all dependencies, including Electron 42.5.0.

**Fixes**:

- Fixed sorting of languages in the spellchecker languages setting.

### v5.12.3 --2025-12-12

**Enhancements**:

- Adjusted text contrast in settings panel.
- Updated translations.

**Dependencies**:

- Upgraded all dependencies, including Electron 39.2.7.

### v5.12.2 --2025-09-01

**Fixes**:

- Corrected broken translations in Chinese (simplified), Finnish, German, Greek, and Tamil that crashed the app.

### v5.12.1 --2025-08-29

**Enhancements**:

- Enabled macOS Writing Tools in the context menu.
- Marked untranslated strings for translation.
- Updated translations.

**Dependencies**:

- Upgraded all dependencies, including Electron 37.4.0.

### v5.12.0 --2025-03-13

**Enhancements**:

- Updated the icon in macOS with a native appearance.
- Marked untranslated strings for translation.
- Updated translations.

**Dependencies**:

- Upgraded all dependencies, including Electron 35.0.1.

**Removed features**:

- Removed support for macOS 10.15 and earlier, which reached end-of-life in 2022 and is [no longer supported](https://www.electronjs.org/blog/electron-33-0#removed-macos-1015-support) by Electron.

### v5.11.1 --2024-08-23

**Enhancements**:

- Updated translations.

**Dependencies**:

- Upgraded all dependencies, including Electron 32.0.1.

### v5.11.0 --2024-03-22

**Fixes**:

- Removed the popup dialog for certificate errors when loading subresources such as images.
- Allowed hiding the window from full screen mode on macOS.

**Enhancements**:

- Enabled zooming with Ctrl+mouse wheel on Linux and Windows.

**Dependencies**:

- Upgraded all dependencies, including Electron 29.1.5.

### v5.10.5 --2024-01-25

**Dependencies**:

- Upgraded all dependencies, including Electron 28.2.0.

**Enhancements**:

- Improved security hardening by setting a Content-Security-Policy for the app UI.

### v5.10.4 --2024-01-09

**Dependencies**:

- Upgraded all dependencies, including Electron 28.1.1.

### v5.10.3 --2023-09-30

**Fixes**:

- Fixed an error in the third-party `gatemaker` library that broke the display of notifications for completed downloads.

**Dependencies**:

- Upgraded all dependencies, including Electron 25.8.4.

### v5.10.2 --2023-09-14

**Dependencies**:

- Downgraded Electron to 25.8.1 to avoid a renderer process crash on Linux.

### v5.10.1 --2023-09-13

**Dependencies**:

- Upgraded all dependencies, including Electron 26.2.1.

### v5.10.0 --2023-05-05

**Removed features**:

- Removed support for Windows 8.1 and earlier, which reached end-of-life earlier this year and are [no longer supported](https://www.electronjs.org/blog/windows-7-to-8-1-deprecation-notice) by Electron.
- Removed support for Zulip Server 3.x and earlier, which have been obsolete for more than 18 months, in accordance with our [release lifecycle](https://zulip.readthedocs.io/en/latest/overview/release-lifecycle.html). A notice will now be displayed when connecting to a server with an unsupported version.

**Fixes**:

- Fixed display of the dropdown for the spellchecker languages setting.
- Fixed various bugs related to displaying and updating organization icons.
- Fixed settings to disable visual display of notifications.

**Dependencies**:

- Upgraded all dependencies, including Electron 24.2.0.

### v5.9.5 --2023-02-06

**Fixes**:

- Fixed a hang on startup when an organization cannot be connected at startup.

**Enhancements**:

- Enabled Chromium sandboxing in remote renderer processes for improved security hardening.

**Dependencies**:

- Upgraded all dependencies, including Electron 22.2.0.

### v5.9.4 --2023-01-04

**Fixes**:

- The `com.apple.quarantine` extended attribute is now correctly set for downloaded files on macOS.
- The external link handler ignores invalid URLs.

**Dependencies**:

- Upgraded all dependencies, including Electron 22.0.0.

### v5.9.3 --2022-04-28

**Fixes**:

- Fixed a bug in the automatic updater that would sometimes close the application instead of updating it.
  (As with most updater fixes, this fix will take effect when updating _from_ 5.9.3. If you're having trouble updating _to_ 5.9.3, a workaround is to click **Install Later** rather than **Install and Relaunch**, then **Quit** from the menu bar and re-open the application manually.)

**Dependencies**:

- Upgraded all dependencies, including Electron 18.2.0.

### v5.9.2 --2022-04-20

**Dependencies**:

- Upgraded all dependencies, including Electron 18.1.0. This fixes an upstream Electron bug that crashed the application when accessibility tools such as screen readers and grammar assistants are in use.

### v5.9.1 --2022-04-08

**Dependencies**:

- Upgraded all dependencies, including Electron 18.0.3.

### v5.9.0 --2022-04-01

**Fixes**:

- Fixed unread count display when viewing a topic with a parenthesized number.
- Fixed parsing of system proxy settings.

**Enhancements**:

- Removed fade-in animation on page load.

**Dependencies**:

- Upgraded all dependencies, including Electron 18.0.1.

### v5.8.1 --2021-07-29

**Fixes**:

- Downgraded electron-updater to fix automatic updates on macOS.
  (Note that 5.7.0 and 5.8.0 users may still trigger electron-updater bugs trying to automatically update _to_ 5.8.1; once updated, future updates _from_ 5.8.1 should work correctly.)

### v5.8.0 --2021-07-21

**Fixes**:

- Fixed the spell checker on macOS.
- Fixed `TypeError` after closing the About page.

**Enhancements**:

- Removed `Ctrl`+`L`/`⌘L` keyboard shortcut to prevent accidental logouts.

**Dependencies**:

- Upgraded all dependencies, including Electron 13.1.7.

### v5.7.0 --2021-04-30

**Fixes**:

- Fixed perpetual CPU usage on Windows after re-launching the app when it’s already open.
- Fixed shortcut display to avoid generating “Ctrl+10”.

**Dependencies**:

- Upgraded all dependencies, including Electron 12.0.6.

### v5.6.0 --2021-02-16

**Fixes**:

- Fixed zoom in keyboard shortcut not to zoom twice.

**Enhancements**:

- Restored hardware acceleration to the Electron default.

**Dependencies**:

- Upgraded all dependencies, including Electron 11.2.3.

### v5.5.0 --2020-12-01

**Removed features**:

- Removed legacy handling of custom certificates. Custom certificates can be configured in the same system certificate store that Chrome uses ([instructions](https://zulip.com/help/custom-certificates#desktop)).
- Removed the unmaintained notification inline replies feature on macOS. We believe the `node-mac-notifier` library used by this feature had been responsible for the grey screen crash issue.

**Fixes**:

- Fixed a regression with the factory reset function.
- Fixed the grey screen crash issue on macOS ([#1016](https://github.com/zulip/zulip-desktop/issues/1016)).
- Whitespace is now stripped from the organization URL when adding a new organization.

**Dependencies**:

- Upgraded all dependencies, including Electron 11.0.3.

### v5.4.3 --2020-09-10

**Security fixes**:

- CVE-2020-24582: Escape all strings interpolated into HTML to close cross-site scripting vulnerabilities that a malicious server could exploit.

**Dependencies**:

- Upgrade dependencies, including Electron 9.3.0.

### v5.4.2 --2020-08-12

**Dependencies**:

- Upgrade all dependencies, including Electron 9.2.0.

### v5.4.1-beta --2020-07-29

**Fixes**:

- Resized the large application icon on macOS dock to be coherent with other icons.

**Dependencies**:

- Upgrade all dependencies, including Electron 9.1.1.

### v5.4.0 --2020-07-21

**New features**:

- Added support for certificates from system store.
- Added support for Slovak as application language.

**Fixes**:

- Fix bug in _Copy Link_ and add _Copy Email_ option in context menu.
- Enable _Copy_ option in context menu only when copying is possible.
- Remove leading and trailing separators in context menu on non-mac systems.
- ignoreCerts: Accommodate WebSocket URLs in certificate-error handler.

**Dependencies**:

- Upgrade all dependencies, including Electron 8.4.0.

**Deprecations**:

- This release supports certificates from Zulip store as well as system store. Zulip certificate store will be deprecated in the next release.
  Users are hereby requested to move to system store. For more information, please see the [documentation](https://zulip.com/help/custom-certificates).

### v5.3.0 --2020-06-24

**Security fixes**:

- Remove the insecure ignoreCerts option.

**Fixes**:

- Windows: Turn off start at login by default.
- Fix zoom issues where some webviews would not get zoomed-out once zoomed-in.
- Fix overflowing contents on 'Add Organization' view.

**New features**:

- Add a cancel button in the report-issue modal.
- macOS: Use Electron API to get dark tray icon instead of the green icon for the light theme.
- Remove 'Reset App Data' option. Factory Reset option has been moved to Settings → General.
- Support pkg installer on macOS.
- Use Electron 8 built-in spellchecker. Linux and Windows users can now choose up to three spellchecker languages from Settings → General. On macOS, default spellchecker is used.
- Setup Transifex for better synchronization of translations. The application now supports 41 languages instead of 21.

**Dependencies**:

- Upgrade all dependencies, including Electron 8.3.3.

### v5.2.0 --2020-05-04

**Security fixes**:

- CVE-2020-12637: Do not ignore certificate errors in webviews unless the (unsupported, deprecated) `ignoreCerts` option is enabled.

**Fixes**:

- Avoid opening the file chooser dialog twice when downloading a file.

**New features**:

- Provide clipboard decryption helper for use in new social login flow.

**Dependencies**:

- Upgrade all dependencies, including Electron 8.2.5.

### v5.1.0 --2020-04-29

**Fixes**:

- macOS: If the app is in foreground, the app will no longer hide upon clicking on dock again.
- Synchronise debian scripts with electron-builder 22.4.1, thus fixing SUID sandbox binary issues.
- Dock icon on macOS used to be larger than the other applications, which is now updated to the appropriate size.
- Upon catching error in updating the server icon, the app will log the error and make a sentry report instead of triggering user-facing network error

**New features**:

- User can now set application language without changing the language on their operating system.

**Dependencies**:

- Upgrade all dependencies, including Electron 8.2.3.

### v5.0.0 --2020-03-30

**Security fixes**:

- CVE-2020-10856: Enable Electron context isolation. (Reported by Matt Austin.)
- CVE-2020-10857: Fix unsafe use of `shell.openExternal`/`shell.openItem`. (Reported by Matt Austin.)
  - Downloaded files will no longer be opened directly; the previous option to show downloaded files in the file manager is now always on.
- CVE-2020-10858: Add permission request handler to guard against audio/video recording by a malicious server. (Reported by Matt Austin.)

**New features**:

- Add an option to prompt for the location to save each downloaded file.

**Fixes**:

- Fix automatic launching at startup.
- Fix Undo and Redo functionality on macOS.

**Dependencies**:

- Upgrade all dependencies, including Electron 8.0.3.
- Remove `assert`, `cp-file`, `dotenv`, `electron-debug`, and `wurl`.

**Deprecations**:

- Since Electron upstream has discontinued support for 32-bit Linux, we will only provide 32-bit Linux builds on a best effort basis, and they will likely be removed in a future release.

### v4.0.3 --2020-02-29

**Security fixes**:

- CVE-2020-9443: Do not disable web security in the Electron webview. (Reported by Matt Austin.)

### v4.0.2-beta --2019-11-13

**New features**:

- Add support for MSI installers.
- Show badge count on Linux.
- Sync system presence info to web app.
- Add option to open notification settings from the context menu of organization icons in the sidebar.
- Tackle network issues with each Zulip organization independently.
- Add option to quit on closing the window.
- Make certificate location dynamic.
- Add option to specify network settings when adding a new organization.

**Enhancements**:

- Load last active tab before others, speeding up user experience and eliminating flashing of server icons.
- Improve UX for notification settings.
- Set User-Agent from the main process for communication with the Zulip API.
- Add SSL troubleshooting guide in error message when adding an organization fails.

**Fixes**:

- Fix translations for `ru` locales.
- Fix trailing brackets in settings page.
- Fix broken icon issue faced by the snap package on Linux.
- Reactivate `network.js` script.
- Enable notarization for macOS Catalina.

**Documentation**:

- Document enterprise configuration features.
- Update the Electron tutorial guide.
- Explicitly address where to report bugs in `README.md`.
- Fix typo in the link to server/web app repository in `README.md`.
- Add documentation for translation.

### v4.0.0 --2019-08-08

**New features**:

- Add enterprise support using a custom config file for all Zulip users on a given machine. Documentation can be found [here](https://github.com/zulip/zulip-desktop/blob/master/docs/Enterprise.md).
- Support specification of preset organizations and automatic update preferences.
- Show setting tooltip when trying to change an admin-locked setting.
- Change translation API to handle Google Translate's rate limits.
- Change menu and language of all settings pages based on system locale.
- Disable the Window sub-menu.

**Fixes**:

- Use newer Darwin notification API in `electron_bridge`.
- Revert to fallback character icon for an organization only when the icon is not available either on the Zulip server or stored offline on the disk.
- Fix issues with the Zoom In shortcut.
- Sync the sidebar loading indicator with the loading GIF in the main view.
- Fix shortcut symbol for Zoom In.

**Development**:

- Add meta key for ⌘ on macOS.

### v3.1.0-beta --2019-07-19

**New features**:

- Add option to find accounts by email.
- Add option to hide Menu bar to View menu.
- Show a loading indicator in the sidebar.
- Update Help Center to open help page of the currently active server.
- Improve auto-detection of spellchecker language.
- Disable menu items on non-server pages.
- Support dark mode on macOS.

**Fixes**:

- Updated, more robust server validation logic.
- Fix JSON DB errors observed when switching tabs.
- Remove unused `isLoading` function from `Tab`.
- Remove unused `defaultId` parameter.
- Fix syntax error in `proxy-util.js`.
- Fix issue with creation of large `.node` files in the `Temp` folder on Windows machines.
- Fix issue where drafts were not saved properly.

**Development**:

- Migrate codebase to TypeScript.
- Set the indent_size in `.editorconfig` to 4.
- Use `.env` file for reading Sentry DSN.

**Documentation**:

- Improve development guide.

**Module updates**:

- Upgrade xo to v0.24.0.
- Upgrade node-json-db to v0.9.2.
- Upgrade electron to v3.1.10.
- Add missing transitive dependencies.

### v3.0.0 --2019-05-20

**New features**:

- Add context menu in left sidebar.
- Enable per-user installation on Windows.
- Switch to next server on Ctrl+Tab.
- Add option to copy zulip URL.
- Allow zoom options from numpad.
- Use server language for spellchecker for all platforms.
- Allow installing app without admin privileges.
- Allow insecure requests on user request.
- Unify case across menus and settings.

**Enhancements**:

- Remove Found bug button.
- Set custom css to false by default.
- Disable beta updates if auto updates disabled
- Update menu items on setting page.
- Include certificates in all requests for icon.
- Document show sidebar shortcut properly.
- Improve organization page.
- Improve wording of adding a new org button.
- Increase width of add a new org button.
- Add eol for linebreaks on windows.
- Teach git to ignore unnecessary binary files.
- Send user-agent with request.
- Minimize to tray on startup.
- Update test config files.
- Ensure backward compatibility when using narrow.by_topic.
- Use path.sep for path separator to support Windows.
- Change the window title to contain active Realm's name.
- Use path.basename to get certificate file name.
- Disable pdf-viewer window.
- Default to starting app on login.
- Modify reset app data button.
- Add requestOptions to replace request instances.
- Workaround buggy focus switching in Electron 3.0.10.
- Reorder file menu and add option to Add Organization.
- Improve development guide.
- Implement CSS linting with stylelint.
- Add "role" key to webview property.
- Implement HTML Linting with htmlhint and fix indent.
- Limit the number of lines in log files.
- Fix focus after clicking back button.
- Remove minimize and close from File menu.
- Add config for installer name.

**Fixes**:

- Fix `request` ecdhCurve mismatch errors
- Fix typo in network error message.
- Fix context menu not working on adding new org.
- Fix reply from notification.
- Fix shortcut section horizontal alignment.
- Fix broken link in docs.
- Fix grammatical errors.
- Fix typo error in issue template.
- Fix text for Toggle DND in sidebar on hover.
- Fix focus after soft reload.
- Fix tip's place for Windows & Linux.

**Module updates**:

- Update node-json-db to v0.9.1.
- Update sentry to v0.12.1.
- Update electron-window-state to v5.0.3.
- Update electron to v3.0.10.
- Update electron-builder to v20.40.2.
- Update electron-sentry to v0.14.0.
- Update dependencies to fix minor dev security alerts.
- Update snap config.

### v2.3.82 --2018-09-25

**New features**:

- UI enhancements.
- Updated some menu items.

**Fixes**:

- Fix about page not opening up.

<hr>

### v2.3.8 --2018-09-25

**New features**:

- Auto hide menubar on Windows/Linux. Add a setting option for the same.
- Improve design of setting page.
- Toggle app on clicking the tray icon (Linux).
- Update sidebar realm name when it's changed in web app.
- left-sidebar: Add initial character of realm name instead of default icon.

**Fixes**:

- linux: Fix ALT+SHIFT opening menu items on Linux.
- sentry: Add ignore errors to sentry configuration.
- Linux: Add label for help menu item.
- file-attachments: Allow multiple downloads of same file name.

**Module Updates**

- electron: Update electron to v2.0.9.

<hr>

### v2.3.7-beta --2018-09-03

**New features**:

- Add a feature to show and view pdf file in the app.

**Fixes**:

- Use package reload instead of custom reload. This is an experimental fix for setting files getting corrupted issue.
- Unescape server name in window menu item.

<hr>

### v2.3.6 --2018-08-27

**New features**:

- Add proxy details while validating a server. This fixes the server validating issue for users who are using the proxy settings.

**Fixes**:

- Fix YouTube video not playing in lightbox.
- Fix realm name not escaped properly.

<hr>

### v2.3.5 --2018-08-03

**New features**:

- Add a setting option to show downloaded file in file manager.
- Added Electron bridge to communicate with web app in real time.

**Fixes**:

- Fix failing attached file downloads.
- Fix page_params error.
- gulpfile: Update syntax and methods for gulp v4.x.

<hr>

### v2.3.4-beta --2018-07-24

**Fixes**:

- Fix downloading functionality of file attachments.
- Fix null of downloadPath when settings.json fails.

<hr>

### v2.3.3 --2018-07-14

**Enhancements**:

- Add dock bounce effect on macOS
- Add a setting option to use the system proxy settings
- Add support for self/custom signed certificate
- Add Sentry support to get the bug reports
- Show a notification when a user clicks on file attachments and open the same in default native app

**Fixes**:

- Fix auto-updates on Windows
- Fix image attachments not opening up in the app
- Security fix - Do proper HTML escaping for server data to avoid XSS attacks
- Other minor fixes

**Updated dependencies**:

electron-builder: v20.20.4

electron-updater: v2.23.3

<hr>

### v2.3.2 --2018-05-28

This is a quick release since we recently updated the certificate for code signing the app and we want to make sure the previous versions of the app get auto-updates without any conflicts.

  <hr>

### v2.3.1 --2018-05-23

**Enhancements**:

- Add a new setting to disable auto-updates

- Add a menu item to check for updates manually

- Other minor improvements

**Fixes**:

- Fix app not rendering colors properly

- **Security fix** - Do proper HTML escaping for server data to avoid XSS attacks

- Fix loading indicator when server is loaded
- Other minor fixes

**Updated dependencies**:

electron - `v2.0.1`

electron-builder - `v20.13.4`

electron-updater - `v2.21.10`

<hr>

### v2.2.0-beta --2018-05-08

**Enhancements**:

- Added do not disturb feature

- New DMG installer image

- Minor improvements

**Fixes**:

- Fix download functionality of file attachment links

- Fix tray icon not showing unread counts

**Updated dependencies**:

electron - `v2.0.0`

electron-builder - `v2.21.10`

electron-updater - `v2.21.8`

<hr>

### v2.0.0 -- 2018-04-20

**Enhancements**:

- [Snap](https://snapcraft.io/zulip) support for Linux

- Add an option to download the file attachments instead of opening it in the browser

- Open image link in web app lightbox

- Add scrollbar for list of organizations on overflow

- Better report issue UX

- Add F5 shortcut for reloading the app

- Responsive UI for connected orgs in smaller window sizes

- Minor improvements

**Fixes**:

- Remove unused shortcuts

- Update toggle sidebar shortcut to CMD/CTRL+SHIFT+S

- Warning dialog box for Reset App Settings

- Fix reinstall script for working across all platforms

- Other minor fixes

**Updated dependencies**:

- Update electron-builder to `v20.8.1`
<hr>

### v1.9.0 --2018-03-23

**Enhancements**:

- Major UI changes in the add new server and setting page

- Some users wanted to change the look of the Zulip. Now you have the power. Feel free to add your own CSS using the all-new setting option **Add Custom CSS**

- Added i18n locale helper script. Internationalization is coming in the next release

- Added **What's new** in `help` submenu so that you can see all the latest changes in the app

- Other small improvements

**Fixes**:

- Add Zulip binary link to the bin. It was a regression we missed somehow. You can now start the app using `zulip` from a terminal \[Linux]

- Fix app settings overriding issue. This bug was unnoticed from `v1.4.0`. The bug was overriding the app settings which was pretty bad. Don't worry this works as expected now

- Prevent drag and drop events to avoid few security risks

- Do not allow running insecure contents in the app

- The ugly white flickering in the webview is now fixed

- Fix position of left-sidebar on toggle

- Fix actions tooltip not visible on hover

- Other small fixes

**Updated dependencies**:

- electron - `v1.8.4`

- Spectron - `v3.8.0`

<hr>

### v1.8.2 --2018-02-27

**Enhancements**:

- Add bots mention support to reply option

- Show a notification when a new update available \[Linux]

- Add back button in left-sidebar

- Add a Loading indication for new server button

- Improve help menu

- Add menu-item to reveal app logs in file manager

- Setting page and left-sidebar UI improvements

- Other minor improvements

**Fixes**:

- Fix broken last active tab

- Fix Zoom In shortcut

- Check whether the internet is working before reloading

- New organization link overlapping existing servers

- Disable electron-connect when it's run from npm start

- Do not auto-reload app when the system comes back from sleep

- Only toggle the setting state if the element is present

- Other minor fixes

**Updated dependencies**:

- electron - `v1.8.2`

<hr>

### v1.8.1 --2018-01-19

**Enhancements**:

- Reply from notifications \[macOS]

- Add a setting option to start the app in the background

- 32-bit Debian installer

- 32-bit AppImage installer

- Automatically add apt-repo and GPG public keys on installing Debian file \[Linux]

- Remove app data, config files etc on uninstalling Debian installer \[Linux]

- Add logger utility for debugging that makes easier to sharing the apps

**Fixes**:

- Handle corrupted config files

- Reload full app on system hibernation
- Load default icon if organization icon is not available

- Focus app when a notification is triggered

- Reflect changes in the preference page (#362)

- Set the default value of flash taskbar setting \[Windows]

- Rename Zoom In keyboard shortcut

- Fix checkDomain, so it checks all error codes

- Disable hardware acceleration to decrease the load on GPU

- Minor bug fixes

**Updated dependencies**:

- electron - `v1.7.10`

- electron-builder - `v19.53.6`

- electron-updater - `v2.18.2`

<hr>

### v1.7.0 --2017-11-24

**Enhancements**:

- Updated to Electron `v1.6.15`, electron-builder `v19.46.4`

- Improved setting page for new users

- On the developer side, we have added few tests to make sure app doesn't fail

- Minor improvements

<hr>

### 1.6.0-beta --2017-11-16

**Enhancements**:

- Added setting option to enable/disable spellcheck

- Added setting option to control Windows taskbar flashing \[Windows]

- Auto-updates for Linux \[AppImage]

- Better tray icons for retina display

- Reset app settings from Menu item

- Show detailed error message on invalid Zulip server

**Fixes**:

- Fixed a bug which was caused by app's shortcuts. From now on our shortcuts won't hijack other apps shortcuts

- Removed [electron-localshortcut](https://github.com/parro-it/electron-localshortcut) completely. Now we only depend on menu accelerators for keyboard shortcuts

- Handle certificate issue properly

- Other minor fixes

<hr>

### v1.5.0 --2017-10-11

**Enhancements**:

- Added an option to clear app data

- Added an option to show/hide desktop notifications

- Redesigned setting page

- Red dot over dock icon for PM \[macOS]

- Show server-info on hovering the server icon

**Fixes**:

- Fetch correct organization icon from server_settings API

- Minor improvements

<hr>

### v1.4.0 --2017-09-04

**Enhancements**:

- Added proxy support

- Added setting option for badges

- Start app at login setting option

- Added app category for Linux

- Minor improvements in settings page

- apt-repo on bintray for linux - [here](https://bintray.com/zulip/debian/zulip-elec)

**Fixes**

- Fixed auto-updates

- Better warning message on certificate error

- Don't allow duplicate servers

<hr>

### 1.3.0-beta -- 2017-08-09

**Enhancements**:

- Added back/forward option under `History` submenu

- Added taskbar overlay icon \[Windows]

- Added `Window` submenu by which users can switch to other servers

- Added flashing taskbar icon on incoming message \[Windows]

- Option to hide the left sidebar

- Staged rollouts

- Minor style improvements

**Fixes**

- Handle focus event properly

- Open external links in default browser

- Allow user to change installation directory

- Fixed server-icon path error \[Windows]

- Fixed server validation error

- Fetch server details from Zulip api

- Added tooltip in left sidebar

- Added publisher name in windows installer

**Updated dependencies**:

- electron - `v1.6.11`

- spellchecker - `v1.2.0`

- electron-builder - `v19.9.1`

<hr>

### v1.2.0-beta -- 2017-07-12

**Enhancements**:

- Added new setting page

- Setting for beta-updates. You can opt in for beta updates via selecting it from setting page

- Added Keyboard shortcuts to switch between multiple servers

- Desktop notifications support on Windows

**Fixes**

- Unregister keyboard shortcuts on windows close

- Show warning dialog while deleting server

- Allow server which is signed by root cert

- Other minor bug fixes

<hr>

### v1.1.0-beta --2017-06-23

**Enhancements**:

- New network error page. App will auto-reload once the network comes back
- Quit shortcut - CTRL+Q \[Windows]
- Improved preferences

**Fixes**:

- Fixed power-monitor module error
- Fixed code signing error \[macOS]

<hr>

### v1.0.0-beta --2017-06-21

**Enhancements**:

- Sign in to multiple teams
- Windows 7 desktop notification support
- Show badge count for each Zulip server
- Toggle window on clicking tray icon \[Windows]

- Windows installer is properly code signed using [DigiCert](https://www.digicert.com/) certificate. You may get a warning regarding the certificate, please make it false positive

**Fixes**:

- Close/hide app properly
- Keep app running in background on clicking X

<hr>

### v0.5.10 --2017-05-12

**Enhancements**:

- Added self-signed server support
- Unread message counts in tray icon

<hr>

### v0.5.9 --2017-04-12

**Enhancements**:

- Properly signed app for macOS
- Toggle tray icon
- Better error handling when no internet connection

**Fixes**:

- Fixed permission issue on windows
- Fixed wrong keyboard shortcuts

<hr>

### v0.5.8 --2017-02-13

**Enhancements**:
Smaller Windows installer size

<hr>

### v0.5.7 --2017-02-08

Minor improvements

<hr>

### v0.5.6 --2017-02-07

**Enhancement**:

- Using NSIS instead of [Squirrel.Windows](https://github.com/Squirrel/Squirrel.Windows) on Windows

- Autoupdates: now using [electron-updater](https://www.npmjs.com/package/electron-updater)

- Removed nuts dependency

**Fixes**:

- Windows installer error
- Compile and build error in native node modules + spellchecker \[Windows]
- Missing icon on installing \[Windows]

<hr>

### v0.5.4 --2017-01-09

**Fixes**:

- Fixed :
  - Auto-updates
  - Spellchecker
  - Zooming functionality

- Removed unused node modules
- Using stable version for node modules
- Added icon for AppImage

<hr>

### v0.5.3 --2016-12-24

**Enhancements**:

- 🎉 Added automatic update support on Windows

**Fixes**:

- Fixed javascript error when electron has been left running and try to right-click

- Fixed error - Unregister Spellchecker while window is closed

- Fixed - Keyboard shortcuts not getting unregistered

- Minor UI Changes

<hr>

### v0.5.2 --2016-12-13

**Enhancements**:

- ⚡️ Added automatic app updates for macOS
- Added windows installer for 32 bit machine

- Better tray icons

**Fixes**:

- Blurry Unity icon fixed

<hr>

### v0.5.1 --2016-11-23

**Enhancement**:

- Added Spellchecker support with correct spell suggestions

- Added Code-Signing on MAC

- Added Win/linux/Mac installers

- Added Continuous Integration on travis and appveyor

- Open internal links in app only and external in default browser

- Better icons

- Electron version updated to `v1.4.7`

- Using two package.json structure

- Node integration disabled in main window due to jQuery error

- Now using electron-builder for packaging instead of electron-packager

- Removed electron-context-menu and simple-spellchecker dependency

**Fixes**:

- Better error handling when user enters wrong zulip server

- Fixed close Zulip window JavaScript error

- Fixed opening image in default browser

- Fixed native notifications issue on linux

<hr>

### v0.0.1-alpha -- 2016-08-31

**Enhancement**:

- Added DMG installer for macOS
