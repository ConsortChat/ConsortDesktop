// The version the Microsoft Store is told, which cannot be the version itself.
//
// An MSIX package's version is four integers, each below 65536, and the Store
// reserves the fourth for its own use: it must be zero. Consort's versions are
// upstream's three numbers and a Consort release after a hyphen — 5.12.4-19 —
// and electron-builder builds the manifest's version by reading each
// dot-separated part as an integer, which reads "4-19" as 4. Every release
// would be 5.12.4.0, and the Store refuses a package that is not newer than the
// last one it accepted.
//
// So the Consort release is folded into the third number: 5.12.4-19 becomes
// 5.12.419.0. That keeps every version in the order it was released — a newer
// upstream patch starts a new hundred, and a bare 5.12.5 is 5.12.500.0, below
// its own 5.12.5-1 — for as long as no one upstream version reaches a hundredth
// Consort release. That limit fails the build rather than wrapping around.
//
// Only the manifest is rewritten. Everywhere else, the About box and the logs
// included, the app still calls itself 5.12.4-19, which is the number people
// will quote back in bug reports.
//
// Run by electron-builder as the `appxManifestCreated` hook, on the generated
// manifest before it is packed.

import {readFile, writeFile} from "node:fs/promises";

import packageJson from "../package.json" with {type: "json"};

// Each part of a package version is a 16-bit unsigned integer.
const MAX_PART = 65_535;

/** The four-part Store version for a Consort version. */
export function storeVersion(version: string): string {
  const match = /^(\d+)\.(\d+)\.(\d+)(?:-(\d+))?$/v.exec(version);
  if (match === null) {
    throw new Error(
      `${version} is not a version a Store version can be made of`,
    );
  }

  const [, major = "", minor = "", patch = "", release = "0"] = match;
  if (Number(release) >= 100) {
    throw new Error(
      `${version} is a hundredth Consort release of one upstream version, ` +
        "which the Store version has no room for",
    );
  }

  const parts = [
    Number(major),
    Number(minor),
    Number(patch) * 100 + Number(release),
    0,
  ];
  if (parts.some((part) => part > MAX_PART)) {
    throw new Error(
      `${version} does not fit a Store version, whose parts stop at ${MAX_PART}`,
    );
  }

  return parts.join(".");
}

/** The manifest with its package identity carrying the Store version. */
export function rewriteManifest(manifest: string, version: string): string {
  // The Identity element's own attribute, not MinVersion or MaxVersionTested
  // further down, which are the Windows versions the package runs on.
  const identityVersion = /(<Identity\b[^>]*?\sVersion=")[^"]*(")/v;
  if (!identityVersion.test(manifest)) {
    // Failed loudly, because the quiet alternative is a package that builds,
    // uploads, and is then refused for not being newer.
    throw new Error("the manifest has no package identity version to rewrite");
  }

  return manifest.replace(identityVersion, `$1${storeVersion(version)}$2`);
}

export default async function appxManifestCreated(
  manifestPath: string,
): Promise<void> {
  const manifest = await readFile(manifestPath, "utf8");
  await writeFile(
    manifestPath,
    rewriteManifest(manifest, packageJson.version),
    "utf8",
  );
}
