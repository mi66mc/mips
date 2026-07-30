import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import test from "node:test";

const validatorUrl = new URL("./verify-kind-vectors.mjs", import.meta.url);
const fixtureUrl = new URL(
  "../test-vectors/mip-04-kind-validation-v1.json",
  import.meta.url,
);

async function loadValidator() {
  assert.equal(
    existsSync(validatorUrl),
    true,
    "tools/verify-kind-vectors.mjs must exist",
  );
  return import(validatorUrl.href);
}

test("accepts all RFC 5646 language-tag forms used by the fixtures", async () => {
  const { isWellFormedLanguageTag } = await loadValidator();

  assert.equal(isWellFormedLanguageTag("pt-BR"), true);
  assert.equal(isWellFormedLanguageTag("x-private"), true);
  assert.equal(isWellFormedLanguageTag("i-klingon"), true);
  assert.equal(isWellFormedLanguageTag("en-a"), false);
});

test("classifies available mismatched comment parents as invalid", async () => {
  const { classifyCommentReferences } = await loadValidator();
  const root = {
    author: "a".repeat(64),
    kind: 1,
    document: "b".repeat(64),
  };
  const event = {
    kind: 2,
    header: {
      root,
      parent: "c".repeat(64),
    },
  };

  assert.equal(
    classifyCommentReferences(event, () => ({
      kind: 2,
      header: {
        root: { ...root, document: "d".repeat(64) },
        parent: null,
      },
    })),
    "invalid",
  );
  assert.equal(classifyCommentReferences(event, () => undefined), "unresolved");
});

test("verifies every committed MIP-04 kind fixture", async () => {
  const { verifyKindFixtureFile } = await loadValidator();

  assert.equal(existsSync(fixtureUrl), true);
  assert.equal(verifyKindFixtureFile(fixtureUrl), 47);
});
