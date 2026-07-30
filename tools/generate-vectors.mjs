import assert from "node:assert/strict";
import {
  createHash,
  createPrivateKey,
  createPublicKey,
  sign,
  verify,
} from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

const seed =
  "9d61b19deffd5a60ba844af492ec2cc44449c5697b326919703bac031cae7f60";
const publicKeyHex =
  "d75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a";
const documentId =
  "4f5f4c6b5e897c32217a32097510c8d67491c7c9200f2af22c568a5dc2363742";
const vectorPath = fileURLToPath(
  new URL("../test-vectors/mip-02-event-v1.json", import.meta.url),
);

const privateKey = createPrivateKey({
  key: Buffer.concat([
    Buffer.from("302e020100300506032b657004220420", "hex"),
    Buffer.from(seed, "hex"),
  ]),
  format: "der",
  type: "pkcs8",
});

const publicKey = createPublicKey({
  key: Buffer.concat([
    Buffer.from("302a300506032b6570032100", "hex"),
    Buffer.from(publicKeyHex, "hex"),
  ]),
  format: "der",
  type: "spki",
});

function fail(code) {
  throw new TypeError(code);
}

function assertValidUnicode(value) {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) {
        fail("lone_surrogate");
      }
      index += 1;
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      fail("lone_surrogate");
    }
  }
}

export function canonicalize(value) {
  if (value === null) {
    return "null";
  }

  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      fail("non_finite_number");
    }
    if (Object.is(value, -0)) {
      fail("negative_zero");
    }
    if (Number.isInteger(value) && !Number.isSafeInteger(value)) {
      fail("unsafe_integer");
    }
    return JSON.stringify(value);
  }

  if (typeof value === "string") {
    assertValidUnicode(value);
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalize(item)).join(",")}]`;
  }

  if (typeof value === "object") {
    const keys = Object.keys(value).sort();
    const entries = keys.map((key) => {
      assertValidUnicode(key);
      if (value[key] === undefined) {
        fail("unsupported_json_value");
      }
      return `${JSON.stringify(key)}:${canonicalize(value[key])}`;
    });
    return `{${entries.join(",")}}`;
  }

  fail("unsupported_json_value");
}

export function canonicalPayload(event) {
  const payload = [
    event.version,
    event.author,
    event.signer,
    event.authorization,
    event.created_at,
    event.kind,
    event.header,
    event.content,
  ];
  return Buffer.from(canonicalize(payload), "utf8");
}

export function calculateId(event) {
  return createHash("sha256").update(canonicalPayload(event)).digest();
}

export function signId(idBytes, signingKey) {
  return sign(null, idBytes, signingKey).toString("hex");
}

function eventFromVector(vector) {
  return vector.event_json ? JSON.parse(vector.event_json) : vector.event;
}

export function verifyVector(vector) {
  try {
    const event = eventFromVector(vector);
    const canonical = canonicalPayload(event).toString("utf8");
    const idBytes = calculateId(event);
    const id = idBytes.toString("hex");

    if (!vector.valid && vector.error_code === "invalid_signature") {
      assert.equal(
        verify(
          null,
          idBytes,
          publicKey,
          Buffer.from(vector.signature, "hex"),
        ),
        false,
      );
      return true;
    }

    if (!vector.valid) {
      throw new Error(`expected_${vector.error_code}`);
    }

    assert.equal(canonical, vector.canonical);
    assert.equal(id, vector.id);
    assert.equal(
      verify(
        null,
        idBytes,
        publicKey,
        Buffer.from(vector.signature, "hex"),
      ),
      true,
    );
    if (vector.not_id) {
      assert.notEqual(id, vector.not_id);
    }
    return true;
  } catch (error) {
    if (
      !vector.valid &&
      error instanceof Error &&
      error.message.includes(vector.error_code)
    ) {
      return true;
    }
    throw error;
  }
}

function signedVector(name, event, extra = {}) {
  const idBytes = calculateId(event);
  return {
    name,
    valid: true,
    event,
    canonical: canonicalPayload(event).toString("utf8"),
    id: idBytes.toString("hex"),
    signature: signId(idBytes, privateKey),
    ...extra,
  };
}

function buildVectors() {
  const baseEvent = {
    version: 1,
    author: publicKeyHex,
    signer: publicKeyHex,
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
  const basic = signedVector("basic_publication", baseEvent);
  const negativeZeroJson = JSON.stringify({
    ...baseEvent,
    content: "__NEGATIVE_ZERO__",
  }).replace('"__NEGATIVE_ZERO__"', "-0");
  const unsafeIntegerJson = JSON.stringify({
    ...baseEvent,
    created_at: "__UNSAFE_INTEGER__",
  }).replace('"__UNSAFE_INTEGER__"', "9007199254740992");

  return {
    format: "murm-test-vectors",
    version: 1,
    algorithm: {
      canonicalization: "RFC 8785",
      id: "SHA-256",
      signature: "Ed25519 over raw id bytes",
    },
    public_key: publicKeyHex,
    vectors: [
      basic,
      signedVector("reordered_header_keys_same_id", {
        ...baseEvent,
        header: {
          document: documentId,
          previous: null,
          revision: 1,
          title: "Hello Murm",
        },
      }),
      signedVector("unicode_preserved", {
        ...baseEvent,
        created_at: 1710000001,
        content: "cafe\u0301 is not normalized to café",
      }),
      signedVector(
        "changed_content_changes_id",
        {
          ...baseEvent,
          content: "# Hello Murm\n\nA changed publication.",
        },
        { not_id: basic.id },
      ),
      {
        name: "tampered_signature_rejected",
        valid: false,
        error_code: "invalid_signature",
        event: baseEvent,
        id: basic.id,
        signature: `${basic.signature.slice(0, -2)}00`,
      },
      {
        name: "negative_zero_rejected",
        valid: false,
        error_code: "negative_zero",
        event_json: negativeZeroJson,
      },
      {
        name: "unsafe_integer_rejected",
        valid: false,
        error_code: "unsafe_integer",
        event_json: unsafeIntegerJson,
      },
    ],
  };
}

function verifyFile(path) {
  const file = JSON.parse(readFileSync(path, "utf8"));
  assert.equal(file.format, "murm-test-vectors");
  assert.equal(file.version, 1);
  assert.equal(file.public_key, publicKeyHex);
  assert.equal(file.vectors.length, 7);
  for (const vector of file.vectors) {
    verifyVector(vector);
  }
  return file.vectors.length;
}

function main() {
  if (process.argv.includes("--check")) {
    const count = verifyFile(vectorPath);
    console.log(`${count} vectors verified`);
    return;
  }

  const vectors = buildVectors();
  writeFileSync(vectorPath, `${JSON.stringify(vectors, null, 2)}\n`, "utf8");
  const count = verifyFile(vectorPath);
  console.log(`${count} vectors written`);
}

const entryPoint = process.argv[1]
  ? pathToFileURL(process.argv[1]).href
  : undefined;
if (entryPoint === import.meta.url) {
  main();
}
