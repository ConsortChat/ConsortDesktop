# Push to talk

Hold a key to speak. The microphone is shut the rest of the time, whatever a
call thinks its mute button is set to.

Windows only, for now — [see below](#why-windows-only).

## Where it is

**Settings → General → Push to Talk.** Three things:

- the switch,
- the key, chosen by clicking the button and pressing it,
- whether opening and shutting the gate makes a sound. It only does while
  something has the microphone — a call, almost always — so pressing the key
  outside one is silent.

The section is not shown on Linux or macOS.

## It sits in front of the call's mute button, not on it

This is the part worth understanding, because it decides what everything else
does.

The gate is **not** the call's mute button being pressed for you. The microphone
track a call receives is not the microphone: it is the output of a gain node
this app controls, with the real capture feeding it. Two shutters in series —
the call's mute button in front, doing exactly what it always did, and push to
talk behind it.

Consequences, all of them deliberate:

- **Muting yourself still mutes you.** Holding the key while muted sends
  nothing. Both shutters have to be open.
- **Nothing about your mute state is published while you talk.** Nobody sees
  your microphone icon flicker on and off with each sentence, and the server
  gets no presence traffic for it.
- **The speaking indicator follows the gate.** The level a call reads is the
  gated level, so a conversation in the room with the key up lights nothing up
  at the far end. That is the promise push to talk makes, and gating by pressing
  the mute button could not keep it.
- **Turning the feature off leaves your mute state exactly as it was**, because
  it was never touched.

## What key to choose

Any physical key, with or without Ctrl / Alt / Shift / Win. A modifier on its
own — right control, right alt — counts as a key, which is what most people
want.

**The key still types whatever it normally types.** Nothing is swallowed: the
hook reports the key and passes it on. Binding `V` means holding `V` types a
line of Vs into whatever has focus. Good choices are the keys nothing else
wants:

- **F13 to F24.** No keyboard sends them by accident, and any keyboard with a
  macro layer can be made to send them.
- **A modifier on its own**, if you can spare one.
- **A combination**, which must match exactly: with `Ctrl+V` bound, plain `V`
  does nothing, and with plain `V` bound, `Ctrl+V` does nothing either. That
  second rule is what stops every paste in the app opening your microphone.

Keys with no Windows virtual key behind them — media and browser keys — are
refused when you try to bind them, rather than stored and silently never
matched.

## What it cannot see

- **Windows running as administrator.** Windows refuses a keyboard hook any
  sight of input going to a higher integrity level, so with an elevated window
  focused the key does nothing. Nothing short of running the whole app elevated
  changes that, which is not a trade worth making for a microphone gate.
- **A key pressed before a call started.** The gate is installed when something
  asks for the microphone, so switching the feature on **during** a call reaches
  the next capture rather than the current one: the next call, or the next time
  the microphone is changed within this one. Switching it off opens the gate
  immediately.

## Missed releases

A release that never arrives is an open microphone nobody knows about, so the
key is also polled four times a second while the gate is open, and the gate
shuts the moment the key is not physically down. Sleep and the lock screen shut
it too. This has to be belt and braces; nothing else in the app has this failure
mode.

## Why an addon

Electron's `globalShortcut` reports a press and never a release. It is
`RegisterHotKey` underneath, so the only release it could offer is a guess from
the keyboard's auto-repeat — wrong by the repeat delay on Windows, and
impossible on macOS, where the hotkey does not repeat at all.

So `native/src/hotkey-win.cc` installs a `WH_KEYBOARD_LL` hook on a thread of
its own. It is shaped like the thing nobody wants running on their machine, so:
it is installed only while the feature is on **and** a key is bound; every
keystroke is compared against the one watched key inside the hook and discarded
there; and what leaves the addon is one boolean, twice per press. No key, no
character, no window, no other key.

## Why Windows only

The hook above is a Windows API. On Linux the equivalent is either an X11-only
grab, which Wayland has deliberately closed off, or a portal that does not
exist; on macOS it needs Accessibility permission and a second consent surface
to explain it.

The Linux answer is a separate program that gates the microphone for the whole
machine rather than for this app alone — which is the better shape for it there,
since it then works for every application at once.

## Where the code is

| File                                   | What it does                                                 |
| -------------------------------------- | ------------------------------------------------------------ |
| `native/src/hotkey-win.cc`             | The keyboard hook, and the two edges it reports              |
| `app/main/push-to-talk.ts`             | The key, the watchdog, the tones, the settings               |
| `app/main/mic-gate.ts`                 | The gate itself, injected into every frame of the call       |
| `app/common/push-to-talk-key.ts`       | Translating a key between the DOM's name and Windows' number |
| `app/renderer/js/push-to-talk-tone.ts` | The two blips                                                |

The injection route — into the page's own world, from the main process, on every
frame — is the one `app/main/linux-display-audio.ts` documents at length, and is
there for the same reasons: a preload cannot reach the page's `navigator`, and a
call runs in a cross-origin iframe that no preload of ours is in anyway.
