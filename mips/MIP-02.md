# MIP-02: Event IDs and Signatures

Status: `draft`

## Kind Allocation

This MIP defines cryptographic processing for all events and allocates no event
kind.

## Abstract

This MIP defines how Murm version 1 events are canonicalized, hashed, signed,
and verified. Event IDs use SHA-256. Event signatures use Ed25519 over the raw
32-byte event ID.

## Motivation

Independent clients and relays must calculate the same ID for the same event,
regardless of programming language, object insertion order, or whitespace in
the received JSON. A single canonical payload also prevents fields from being
silently excluded from authorship.

## Specification

### Algorithms

- Canonical JSON MUST follow RFC 8785 JSON Canonicalization Scheme (JCS), with
  the additional input restrictions below.
- Event IDs MUST use SHA-256.
- Event signatures MUST use Ed25519.
- IDs, public keys, and signatures MUST use lowercase hexadecimal.

### Input Restrictions

Before canonicalization, implementations MUST reject:

- duplicate JSON object property names;
- `NaN`, positive infinity, and negative infinity;
- negative zero;
- integral numbers outside the safe integer range
  `-9007199254740991` through `9007199254740991`;
- strings or property names containing lone Unicode surrogates;
- values not representable in JSON.

Strings MUST preserve their original Unicode code points. Implementations MUST
NOT apply Unicode normalization.

### Canonical Unsigned Payload

The canonical unsigned payload is an array containing exactly:

```text
version
author
signer
authorization
created_at
kind
header
content
```

Example before canonicalization:

```json
[
  1,
  "d75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a",
  "d75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a",
  null,
  1710000000,
  1,
  {
    "title": "Hello Murm",
    "revision": 1,
    "previous": null,
    "document": "4f5f4c6b5e897c32217a32097510c8d67491c7c9200f2af22c568a5dc2363742"
  },
  "# Hello Murm\n\nA signed publication."
]
```

The payload MUST NOT contain `id`, `signature`, or unknown top-level fields.

JCS recursively sorts object properties, preserves array order, emits no
insignificant whitespace, and produces UTF-8 without a byte-order mark.

### Event ID

```text
canonical_bytes = UTF-8(JCS(unsigned_payload))
raw_id = SHA-256(canonical_bytes)
id = lowercase_hex(raw_id)
```

### Event Signature

```text
raw_signature = Ed25519_sign(signer_private_key, raw_id)
signature = lowercase_hex(raw_signature)
```

The signature input is the raw 32-byte hash, not the 64-character hexadecimal
string and not a second serialization of the event.

### Verification

To verify an event:

1. Validate the MIP-01 envelope and input restrictions.
2. Build the unsigned payload in the exact field order above.
3. Canonicalize the array with JCS.
4. Hash the UTF-8 bytes with SHA-256.
5. Compare the lowercase hexadecimal result with `event.id`.
6. Decode `event.signer` and `event.signature` from lowercase hexadecimal.
7. Verify the Ed25519 signature over the raw hash bytes.
8. Apply direct-authorship or authorization rules from the active compatibility
   profile.
9. Reject the event if any step fails.

## Canonical Examples

Using the first normative vector, the canonical payload is:

```json
[1,"d75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a","d75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a",null,1710000000,1,{"document":"4f5f4c6b5e897c32217a32097510c8d67491c7c9200f2af22c568a5dc2363742","previous":null,"revision":1,"title":"Hello Murm"},"# Hello Murm\n\nA signed publication."]
```

Its ID is:

```text
5b0b000dc2377e137aeaab36f7a5e2f82de104f1dac38162b08efe1bf7d71139
```

Using the fixed RFC 8032 seed from the vector generator, its signature is:

```text
40adfc83597064286dd51ad195ca613a444b6f9ca8e554da58d0d1c4ae4f10427719c8f941c87a7b8d2b12e0c84bfb80e23f198d20a3c7cefaa68e4612227b03
```

Reordering properties inside `header` does not change the canonical payload or
ID. Changing `content` changes the ID.

## Validation

An ID mismatch and a signature mismatch are separate failures:

- `invalid_id`: the declared `id` differs from the calculated hash.
- `invalid_signature`: Ed25519 verification fails for the calculated raw ID.

Implementations MUST calculate the ID before verifying the signature. They MUST
NOT verify a signature over an unvalidated, caller-supplied ID.

The executable vector checker is
[`../tools/generate-vectors.mjs`](../tools/generate-vectors.mjs).

## Relay Indexing

This MIP adds no indexable paths. Relays index the fixed fields declared by
MIP-01 and the header fields declared by kind MIPs.

## Compatibility

All core version 1 implementations MUST reproduce every valid ID and signature
in the normative test-vector file and reject every invalid vector with the
specified error.

Changing the canonical payload order, canonicalization scheme, hash algorithm,
signature algorithm, or signature input requires a new event envelope version.

## Security Considerations

Private keys MUST remain on clients and MUST be generated with a
cryptographically secure random number generator.

Implementations SHOULD use constant-time Ed25519 verification from a maintained
cryptographic library. They MUST NOT implement Ed25519 arithmetic solely from
this document.

Relay acceptance is not proof of validity. Clients SHOULD recalculate IDs and
verify signatures for events received from every relay.

Canonicalization errors MUST fail closed. An implementation MUST NOT fall back
to ordinary `JSON.stringify`, map iteration order, locale-sensitive sorting, or
Unicode normalization.

## Test Vectors

Normative vectors are stored in
[`../test-vectors/mip-02-event-v1.json`](../test-vectors/mip-02-event-v1.json).
They cover:

1. a valid publication;
2. reordered header keys producing the same ID;
3. preserved, non-normalized Unicode;
4. changed content producing a different ID;
5. a tampered signature;
6. negative zero;
7. an unsafe integer.

Run:

```text
node tools/generate-vectors.mjs --check
```

A compatible implementation SHOULD import the JSON vectors directly into its
own test suite rather than translating the example values by hand.
