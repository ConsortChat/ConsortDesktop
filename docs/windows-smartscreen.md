# "Windows protected your PC"

Windows shows a blue box the first time you run the Consort installer, offering
one button, **Don't run**. The way past it is **More info → Run anyway**, and
the rest of this page is what that button means and what to check before you
press it.

## What the prompt is actually saying

That box is Microsoft Defender SmartScreen, and it is not the result of scanning
the file and finding something. It is a reputation check: SmartScreen asks
whether this exact file, and the certificate it was signed with, have been seen
enough times on enough machines to be considered established. Consort's
installer is signed with nothing at all, so there is no certificate to have a
reputation, and each new release is a file the world has never seen. The answer
comes back "unknown", every time, for every version.

So the prompt is accurate but narrower than it sounds. It does not say the file
is dangerous. It says nothing vouches for it — which is true, and stays true
until there is a code-signing certificate to vouch with. That is a purchase and
a stored secret rather than a build flag, which is why
[the release workflow](../.github/workflows/release.yml) says so plainly and
ships unsigned.

Signing would not silence it immediately either. Reputation accrues to a
certificate over downloads and time, so a newly bought one warns for a while too
— less loudly, and it eventually stops.

## Check the file before you skip the warning

Skipping a warning about an unvouched-for file is reasonable exactly when you
have vouched for it yourself. Two things establish that, and both take under a
minute.

**Where it came from.** The only place these builds exist is the releases page
of this repository:

```text
https://github.com/ConsortChat/ConsortDesktop/releases
```

Download the `.exe` from a release's own assets list, not from a mirror, a
search result, or a link somebody sent you. If your copy came from anywhere
else, the warning is the least of the problem — delete it and download it again
from there.

**That it arrived intact.** Every release carries a `latest.yml` alongside the
installer, holding the SHA-512 of the file the build produced, base64-encoded.
Download it, open it in any text editor, and compare its `sha512:` line against
your own copy. In PowerShell:

```powershell
$file = "$HOME\Downloads\Consort-Setup-5.12.4-16-x64.exe"
$stream = [IO.File]::OpenRead($file)
[Convert]::ToBase64String([Security.Cryptography.SHA512]::Create().ComputeHash($stream))
$stream.Close()
```

The two strings match or they do not. If they do not, something changed the file
between GitHub and your disk, and no amount of clicking through is the right
response.

## Getting past it

With the file checked:

1. Run the installer. The blue box appears.
2. Click **More info** — the small link, easy to miss, above the button.
3. The publisher and file name appear, and a second button with them.
4. Click **Run anyway**.

The installer is per-user and does not install for the whole machine, so it
should not ask for administrator rights at any point. If something asks you to
elevate, stop: that is not this installer behaving normally.

### If there is no "More info" link

The link is missing when the file still carries its download marker and
something has already decided about it, or when SmartScreen is enforced by
policy on a managed machine. On your own machine you can clear the marker,
which is a separate mechanism from SmartScreen's verdict — it is the flag
Windows attaches to anything that came from the internet:

```powershell
Unblock-File "$HOME\Downloads\Consort-Setup-5.12.4-16-x64.exe"
```

Then run it again. On a machine managed by an employer or a school, the policy
is the answer and it is not yours to change — ask whoever administers it.

## Two things not to do

**Do not turn SmartScreen off.** It is a per-file decision by design, and this
is one file. Disabling the feature to install one program leaves it disabled for
every file afterwards, including the ones you did not choose to download.

**Do not add a blanket antivirus exclusion for your Downloads folder.** If your
antivirus quarantines the installer specifically — a separate event from
SmartScreen, with a different dialog — the narrow fix is an exclusion for that
one file, after the hash check above. Unsigned installers that bundle a
compiled runtime draw heuristic false positives regularly; that makes them
plausible, not proven, so verify first and exclude nothing broader.

## The Linux archive has no equivalent

Nothing on Linux asks, which makes the same decision without showing it to you.
The `tar.xz` is unsigned too, and `latest-linux.yml` carries its hash in the
same base64 SHA-512 that `sha512sum` does not print, so the comparison needs one
conversion:

```sh
sha512sum -b Consort-5.12.4-16-x64.tar.xz | cut -d' ' -f1 | xxd -r -p | base64 -w0
```

Worth doing there for the same reason it is worth doing here.
