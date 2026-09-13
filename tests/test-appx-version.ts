import test from "tape";

import {rewriteManifest, storeVersion} from "../tools/appx-manifest.ts";

/** Negative, zero or positive, as the Store orders two package versions. */
function compare(earlier: string, later: string): number {
  const left = storeVersion(earlier).split(".").map(Number);
  const right = storeVersion(later).split(".").map(Number);
  const index = left.findIndex((part, i) => part !== right[i]);
  return index === -1 ? 0 : (left[index] ?? 0) - (right[index] ?? 0);
}

test("a Consort release folds into the third part", (t) => {
  t.equal(storeVersion("5.12.4-19"), "5.12.419.0");
  t.equal(storeVersion("5.12.4-3"), "5.12.403.0");
  t.equal(storeVersion("5.12.4"), "5.12.400.0");
  t.equal(storeVersion("6.0.0-1"), "6.0.1.0");
  t.end();
});

test("Store versions keep the order releases were made in", (t) => {
  const released = [
    "5.12.4",
    "5.12.4-3",
    "5.12.4-19",
    "5.12.4-99",
    "5.12.5",
    "5.12.5-1",
    "5.13.0-1",
    "6.0.0",
  ];

  for (const [index, earlier] of released.slice(0, -1).entries()) {
    const later = released[index + 1] ?? "";
    t.ok(compare(earlier, later) < 0, `${earlier} sorts before ${later}`);
  }

  t.end();
});

test("a version that cannot be kept in order fails the build", (t) => {
  t.throws(() => {
    storeVersion("5.12.4-100");
  }, /hundredth/v);
  t.throws(() => {
    storeVersion("5.12.656");
  }, /parts stop at/v);
  t.throws(() => {
    storeVersion("5.12.4-beta.1");
  }, /not a version/v);
  t.throws(() => {
    storeVersion("5.12");
  }, /not a version/v);
  t.end();
});

test("only the package identity's version is rewritten", (t) => {
  // The shape electron-builder's template generates, attributes on their own
  // lines and the publisher in single quotes.
  const manifest = `<Package>
  <Identity Name="Consort"
    ProcessorArchitecture="x64"
    Publisher='CN=00000000-0000-0000-0000-000000000000'
    Version="5.12.4.0" />
  <Dependencies>
    <TargetDeviceFamily Name="Windows.Desktop" MinVersion="10.0.14316.0" MaxVersionTested="10.0.14316.0" />
  </Dependencies>
</Package>`;

  const rewritten = rewriteManifest(manifest, "5.12.4-19");
  t.ok(rewritten.includes('Version="5.12.419.0" />'));
  t.ok(rewritten.includes('MinVersion="10.0.14316.0"'));
  t.ok(rewritten.includes('MaxVersionTested="10.0.14316.0"'));
  t.throws(() => {
    rewriteManifest("<Package />", "5.12.4-19");
  }, /no package/v);
  t.end();
});
