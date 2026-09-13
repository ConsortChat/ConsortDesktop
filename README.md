# Consort Desktop

[![XO code style](https://img.shields.io/badge/code_style-XO-5ed9c7.svg)](https://github.com/sindresorhus/xo)

Desktop client for [Consort](https://github.com/Dyslectric/consort). A fork of
[Zulip Desktop](https://github.com/zulip/zulip-desktop), which it otherwise still is: sign in to
several organizations at once, desktop notifications with inline reply, tray and dock integration,
spell checking.

The fork exists because Consort puts calls _inside_ the app. A call runs in an iframe served by the
organization's video server, so it asks for a camera, a microphone and a screen — and the stock
client answers no to everything except notifications, silently, which makes a call join with no
audio, no video and nothing on screen to explain it. Everything below follows from fixing that and
then finding out what a call in a desktop app can do that a call in a browser tab cannot.

## Installing

Builds are on the [releases page](https://github.com/ConsortChat/ConsortDesktop/releases).

**Windows** — download `Consort-Setup-<version>-x64.exe` and run it. It installs for your user
account and does not ask for administrator rights. Windows will show **"Windows protected your PC"**
first, because the installer is unsigned; [docs/windows-smartscreen.md](./docs/windows-smartscreen.md)
explains what that prompt is measuring, how to check the file yourself, and how to get past it.

**Linux** — download `Consort-<version>-x64.tar.xz`, unpack it, and run the bundled installer:

```bash
sudo sh install.sh
```

That puts the app in `/opt/Consort-Desktop`, adds a desktop entry and links `consort-desktop` onto
your path. `sudo sh install.sh --uninstall` reverses it. The archive has to be installed rather than
run in place because Chromium's sandbox helper must be setuid root, which does not survive an
ordinary unpack.

**macOS** — no build is published. The packaging targets exist and nothing in the app is deliberately
Windows- or Linux-only apart from where it says so below, but no release has ever been built or
tested there. Build it from source if you want to try.

## What is different from upstream

**Calls can ask for a camera and a microphone, and you are asked first.** The permission is per
organization and per device: an organization you run yourself and one you were invited to are not
the same decision, and neither is being heard and being seen.

The prompt is a banner drawn by the app above the page, not inside it — a prompt rendered by the
page is a prompt the page can forge, and this one exists precisely so it cannot be. When both
devices are asked for, "Allow microphone" is an answer as well as "Allow both".

Answers are remembered per organization and can be changed later in **Settings → Organizations**.
Disconnecting an organization forgets them, so reconnecting asks again rather than resuming a
decision made in a relationship that has ended.

**Screen sharing, with a picker that belongs to the app.** Electron supplies none of its own, so
calls could not share a screen here at all. Consort draws one, outside every webview for the same
reason the permission banner is: a chooser the page can paint is a chooser the page can lie about.

**The sound of what you share travels with the share.** Not through your microphone — as a second
audio track on the screen share itself, so the far end can turn a shared video down without turning
you down, and the three microphone defaults that make shared audio sound underwater (echo
cancellation, noise suppression, gain control) are off where they should be.

On Windows the picker lists the applications behind the windows it offers, and choosing one sends
that application's sound alone: not the other window, not a notification, not the call's own audio.
On Linux it goes finer still, offering a browser's tabs individually by page title, since that is the
only thing in the audio graph that tells one tab from another. Sharing sound is off by default in
both cases, and the option says what it will send rather than implying it is narrower than it is.
The reasoning, and what each desktop will and will not tell an application, is in
[docs/linux-screen-sharing.md](./docs/linux-screen-sharing.md).

**Push to talk.** Hold a key to speak, with the microphone shut the rest of the time, including while
the app is in the background — the only kind worth having, since what you are talking over is usually
what you are looking at. Off by default; the key is chosen in **Settings → General → Push to Talk**.

It is a gate in front of the call's microphone rather than the mute button being pressed for you, so
muting yourself still mutes you, nothing about your mute state is published as you talk, and the
speaking indicator follows the gate. See [docs/push-to-talk.md](./docs/push-to-talk.md), including
why it needs a native addon.

## Known limits

**Push to talk is Windows only.** Electron's `globalShortcut` cannot express it — the underlying
`RegisterHotKey` reports a press and never a release — so it takes a native keyboard hook, and only
the Windows one is written. Linux is getting a separate system-wide microphone program instead of an
addon here.

**A browser shares every tab it is playing on Windows**, rather than the tab you picked. Browsers
render all their audio in one process and Windows can only separate audio by process, so there is
nothing to select the tab with. Linux does not have this problem.

**Per-application share audio on Windows needs Windows 10 version 2004 or later.** Older versions
still offer everything the computer is playing, or nothing.

**GNOME and KDE under Wayland will not say which application owns a window**, so a window share with
several applications playing has to ask which sound was meant. It waits about twelve seconds and then
shares without sound rather than not sharing at all.

**Nothing is code-signed**, on any platform. See the SmartScreen note under Installing.

## Development

```bash
pnpm install
pnpm run dev
```

`pnpm run test` runs the same checks CI does: TypeScript, XO, stylelint, htmlhint and Prettier.
`pnpm run dist` builds installers, which additionally compiles the native addons under `native/`.
See [development.md](./development.md).

## Reporting issues

Most of what you see in an organization's window comes from the Consort server and its web app, not
from this client. Problems with channels, messages, or the call panel itself belong in the
[Consort project](https://github.com/Dyslectric/consort/issues/new); problems with the desktop shell
— window handling, notifications, the tray, permission prompts, screen sharing, push to talk,
updates — belong here.

## License

Released under the [Apache-2.0](./LICENSE) license, as is the Zulip Desktop client it is derived
from. Zulip is a trademark of Kandra Labs, Inc.; this is an independent fork and is not affiliated
with or endorsed by them.
