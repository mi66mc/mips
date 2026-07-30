import assert from "node:assert/strict";
import { createHash, createPublicKey, verify } from "node:crypto";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

import { calculateId } from "./generate-vectors.mjs";

const hex32 = /^[0-9a-f]{64}$/;
const grandfathered = new Set(
  [
    "art-lojban",
    "cel-gaulish",
    "en-gb-oed",
    "i-ami",
    "i-bnn",
    "i-default",
    "i-enochian",
    "i-hak",
    "i-klingon",
    "i-lux",
    "i-mingo",
    "i-navajo",
    "i-pwn",
    "i-tao",
    "i-tay",
    "i-tsu",
    "no-bok",
    "no-nyn",
    "sgn-be-fr",
    "sgn-be-nl",
    "sgn-ch-de",
    "zh-guoyu",
    "zh-hakka",
    "zh-min",
    "zh-min-nan",
    "zh-xiang",
  ],
);

function isAlpha(value) {
  return /^[A-Za-z]+$/.test(value);
}

function isAlphanumeric(value) {
  return /^[A-Za-z0-9]+$/.test(value);
}

function isVariant(value) {
  return (
    (/^[A-Za-z0-9]{5,8}$/.test(value) ||
      /^[0-9][A-Za-z0-9]{3}$/.test(value))
  );
}

export function isWellFormedLanguageTag(value) {
  if (typeof value !== "string" || value.length === 0) {
    return false;
  }

  const lower = value.toLowerCase();
  if (grandfathered.has(lower)) {
    return true;
  }

  const parts = value.split("-");
  if (parts.some((part) => part.length === 0 || part.length > 8)) {
    return false;
  }

  if (parts[0].toLowerCase() === "x") {
    return (
      parts.length > 1 &&
      parts.slice(1).every((part) => isAlphanumeric(part))
    );
  }

  const language = parts[0];
  if (!isAlpha(language) || language.length < 2 || language.length > 8) {
    return false;
  }

  let index = 1;
  if (language.length <= 3) {
    let extlangs = 0;
    while (
      extlangs < 3 &&
      index < parts.length &&
      parts[index].length === 3 &&
      isAlpha(parts[index])
    ) {
      extlangs += 1;
      index += 1;
    }
  }

  if (
    index < parts.length &&
    parts[index].length === 4 &&
    isAlpha(parts[index])
  ) {
    index += 1;
  }

  if (
    index < parts.length &&
    ((parts[index].length === 2 && isAlpha(parts[index])) ||
      /^[0-9]{3}$/.test(parts[index]))
  ) {
    index += 1;
  }

  const variants = new Set();
  while (index < parts.length && isVariant(parts[index])) {
    const variant = parts[index].toLowerCase();
    if (variants.has(variant)) {
      return false;
    }
    variants.add(variant);
    index += 1;
  }

  const singletons = new Set();
  while (
    index < parts.length &&
    /^[0-9A-WY-Za-wy-z]$/.test(parts[index])
  ) {
    const singleton = parts[index].toLowerCase();
    if (singletons.has(singleton)) {
      return false;
    }
    singletons.add(singleton);
    index += 1;
    const extensionStart = index;
    while (
      index < parts.length &&
      parts[index].length >= 2 &&
      parts[index].length <= 8 &&
      isAlphanumeric(parts[index])
    ) {
      index += 1;
    }
    if (index === extensionStart) {
      return false;
    }
  }

  if (index < parts.length && parts[index].toLowerCase() === "x") {
    index += 1;
    const privateStart = index;
    while (
      index < parts.length &&
      parts[index].length >= 1 &&
      parts[index].length <= 8 &&
      isAlphanumeric(parts[index])
    ) {
      index += 1;
    }
    if (index === privateStart) {
      return false;
    }
  }

  return index === parts.length;
}

function sameRoot(left, right) {
  return (
    left?.author === right?.author &&
    left?.kind === right?.kind &&
    left?.document === right?.document
  );
}

export function classifyCommentReferences(event, resolveEvent) {
  if (event.header.parent === null) {
    return "resolved";
  }

  const parent = resolveEvent(event.header.parent);
  if (parent === undefined || parent === null) {
    return "unresolved";
  }

  if (
    parent.kind !== 2 ||
    !sameRoot(event.header.root, parent.header?.root)
  ) {
    return "invalid";
  }

  return "resolved";
}

function documentRevisionState(input) {
  const { author, kind, header, predecessor } = input;
  if (header.revision === 1) {
    return header.previous === null ? "resolved" : "invalid";
  }
  if (header.revision < 1 || header.previous === null) {
    return "invalid";
  }
  if (!predecessor) {
    return "unresolved";
  }
  return predecessor.id === header.previous &&
    predecessor.author === author &&
    predecessor.kind === kind &&
    predecessor.header.document === header.document &&
    predecessor.header.revision === header.revision - 1
    ? "resolved"
    : "invalid";
}

function currentRevision(input) {
  return [...input]
    .filter((candidate) => candidate.resolved)
    .sort(
      (left, right) =>
        right.revision - left.revision || left.id.localeCompare(right.id),
    )[0]?.id;
}

function expectedProfileDocument(author) {
  return createHash("sha256")
    .update(`murm:profile:v1:${author}`, "utf8")
    .digest("hex");
}

function exactProperties(input) {
  const allowed = new Set(input.allowed);
  return input.actual.every((property) => allowed.has(property));
}

function validReactionTarget(target) {
  if (target?.type === "event") {
    return (
      Object.keys(target).length === 2 &&
      typeof target.id === "string" &&
      hex32.test(target.id)
    );
  }
  if (target?.type === "document") {
    return (
      Object.keys(target).length === 4 &&
      typeof target.author === "string" &&
      hex32.test(target.author) &&
      Number.isSafeInteger(target.kind) &&
      target.kind >= 0 &&
      typeof target.document === "string" &&
      hex32.test(target.document)
    );
  }
  return false;
}

function evaluateCase(vector) {
  switch (vector.rule) {
    case "document_revision":
      return documentRevisionState(vector.input);
    case "current_revision":
      return currentRevision(vector.input);
    case "profile_document":
      return (
        expectedProfileDocument(vector.input.author) === vector.input.document
      );
    case "scalar_range":
      return (
        vector.input.length >= vector.input.minimum &&
        vector.input.length <= vector.input.maximum
      );
    case "utf8_limit":
      return vector.input.bytes <= vector.input.maximum;
    case "https_url":
      try {
        const url = new URL(vector.input);
        return url.protocol === "https:" && url.hostname.length > 0;
      } catch {
        return false;
      }
    case "exact_properties":
      return exactProperties(vector.input);
    case "topics":
      return (
        vector.input.count <= 20 &&
        vector.input.unique &&
        vector.input.item_minimum >= 1 &&
        vector.input.item_maximum <= 64
      );
    case "language":
      return isWellFormedLanguageTag(vector.input);
    case "comment_reference":
      return classifyCommentReferences(
        vector.input.event,
        () => vector.input.parent,
      );
    case "reaction_target":
      return validReactionTarget(vector.input);
    default:
      throw new Error(`unknown_rule:${vector.rule}`);
  }
}

function verifySignedExample(event) {
  const idBytes = calculateId(event);
  assert.equal(idBytes.toString("hex"), event.id);
  const publicKey = createPublicKey({
    key: Buffer.concat([
      Buffer.from("302a300506032b6570032100", "hex"),
      Buffer.from(event.signer, "hex"),
    ]),
    format: "der",
    type: "spki",
  });
  assert.equal(
    verify(
      null,
      idBytes,
      publicKey,
      Buffer.from(event.signature, "hex"),
    ),
    true,
  );
}

export function verifyKindFixtureFile(path) {
  const file = JSON.parse(readFileSync(path, "utf8"));
  assert.equal(file.format, "murm-kind-validation-vectors");
  assert.equal(file.version, 1);
  assert.equal(file.signed_examples.length, 3);
  for (const event of file.signed_examples) {
    verifySignedExample(event);
  }
  for (const vector of file.cases) {
    assert.deepEqual(evaluateCase(vector), vector.expected, vector.name);
  }
  return file.cases.length;
}

const entryPoint = process.argv[1]
  ? pathToFileURL(process.argv[1]).href
  : undefined;
if (entryPoint === import.meta.url) {
  const fixtureUrl = new URL(
    "../test-vectors/mip-04-kind-validation-v1.json",
    import.meta.url,
  );
  const count = verifyKindFixtureFile(fixtureUrl);
  console.log(`${count} kind validation vectors verified`);
}
