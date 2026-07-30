import assert from "node:assert/strict";
import { createPrivateKey } from "node:crypto";
import { existsSync } from "node:fs";
import test from "node:test";

const generatorUrl = new URL("./generate-vectors.mjs", import.meta.url);

const author =
  "d75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a";
const documentId =
  "4f5f4c6b5e897c32217a32097510c8d67491c7c9200f2af22c568a5dc2363742";
const seed =
  "9d61b19deffd5a60ba844af492ec2cc44449c5697b326919703bac031cae7f60";

const baseEvent = {
  version: 1,
  author,
  signer: author,
  authorization: null,
  created_at: 1710000000,
  kind: 1,
  header: {
    title: "Hello Murm",
    revision: 1,
    previous: null,
    document: documentId,
  },
  content: "# Hello Murm\n\nA signed publication.",
};

const expectedCanonical =
  `[1,"${author}","${author}",null,1710000000,1,` +
  `{"document":"${documentId}","previous":null,"revision":1,"title":"Hello Murm"},` +
  '"# Hello Murm\\n\\nA signed publication."]';
const expectedId =
  "5b0b000dc2377e137aeaab36f7a5e2f82de104f1dac38162b08efe1bf7d71139";
const expectedSignature =
  "40adfc83597064286dd51ad195ca613a444b6f9ca8e554da58d0d1c4ae4f10427719c8f941c87a7b8d2b12e0c84bfb80e23f198d20a3c7cefaa68e4612227b03";

async function loadGenerator() {
  assert.equal(
    existsSync(generatorUrl),
    true,
    "tools/generate-vectors.mjs must exist",
  );
  return import(generatorUrl.href);
}

test("canonicalizes object keys recursively without changing array order", async () => {
  const { canonicalize } = await loadGenerator();

  assert.equal(
    canonicalize({ z: [{ b: 2, a: 1 }], a: "é" }),
    '{"a":"é","z":[{"a":1,"b":2}]}',
  );
});

test("builds the fixed event payload in protocol field order", async () => {
  const { canonicalPayload } = await loadGenerator();

  assert.equal(canonicalPayload(baseEvent).toString("utf8"), expectedCanonical);
});

test("calculates and signs the expected raw event id", async () => {
  const { calculateId, signId } = await loadGenerator();
  const privateKey = createPrivateKey({
    key: Buffer.concat([
      Buffer.from("302e020100300506032b657004220420", "hex"),
      Buffer.from(seed, "hex"),
    ]),
    format: "der",
    type: "pkcs8",
  });
  const id = calculateId(baseEvent);

  assert.equal(id.toString("hex"), expectedId);
  assert.equal(signId(id, privateKey), expectedSignature);
});

test("rejects negative zero and unsafe integers", async () => {
  const { canonicalize } = await loadGenerator();

  assert.throws(() => canonicalize(-0), /negative_zero/);
  assert.throws(() => canonicalize(9007199254740992), /unsafe_integer/);
});

test("rejects invalid numeric and Unicode values", async () => {
  const { canonicalize } = await loadGenerator();

  assert.throws(() => canonicalize(Number.NaN), /non_finite_number/);
  assert.throws(() => canonicalize(Number.POSITIVE_INFINITY), /non_finite_number/);
  assert.throws(() => canonicalize("\ud800"), /lone_surrogate/);
});

test("verifies expected valid and invalid vector outcomes", async () => {
  const { verifyVector } = await loadGenerator();

  assert.equal(
    verifyVector({
      name: "valid",
      valid: true,
      event: baseEvent,
      canonical: expectedCanonical,
      id: expectedId,
      signature: expectedSignature,
    }),
    true,
  );
  assert.equal(
    verifyVector({
      name: "invalid",
      valid: false,
      error_code: "negative_zero",
      event: { ...baseEvent, content: -0 },
    }),
    true,
  );
});
