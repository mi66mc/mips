# MIP-01: Event Format

Status: `draft`

## Kind Allocation

This MIP defines the envelope and allocates no kind.

## Abstract

A Murm event is an immutable, independently verifiable JSON object. The common
envelope is small; each kind's MIP defines its public metadata and content.

## Motivation

Articles, encrypted messages, relay announcements, and future applications
share integrity and transport rules without sharing an application schema.
There is no protocol login or identity server.

## Specification

### Envelope

```ts
type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue }

type Event = {
  version: 1
  id: string
  signer: string
  created_at: number
  kind: number
  header: { [key: string]: JsonValue }
  content: JsonValue
  signature: string
}
```

All eight properties are required. Extra top-level properties MUST be rejected,
not ignored. There are no universal fields for attachments, recipients,
logical authors, devices, delegations, or forwarding instructions.

| Field | Meaning |
| --- | --- |
| `version` | Core envelope version; not a publication revision. |
| `id` | Lowercase hexadecimal SHA-256 digest: exactly 64 characters. |
| `signer` | Ed25519 public signing key, encoded as 64 lowercase hexadecimal characters. |
| `created_at` | Non-negative safe integer, Unix seconds declared by the signer. |
| `kind` | Non-negative safe integer; its MIP assigns meaning. |
| `header` | Public JSON object; nested objects and arrays are allowed. |
| `content` | Any JSON value permitted by the defining MIP, not necessarily text. |
| `signature` | 64-byte Ed25519 signature, encoded as 128 lowercase hexadecimal characters. |

Lowercase hexadecimal encodings and safe-integer bounds are concrete choices of
this rewritten draft. They do not finalize the separate private-message format.

A signer identifies the signing key, not necessarily a human or a logical
author with multiple devices. Device authorization and identity recovery are
not defined by this envelope.

### JSON input

JSON is UTF-8. Implementations MUST reject duplicate object member names at any
depth, non-finite numbers, invalid Unicode, and lone surrogates. Strings MUST
NOT be Unicode-normalized during validation or signing.

Numbers use the IEEE 754 binary64 representation required by
[JCS](https://www.rfc-editor.org/rfc/rfc8785.html).
Integral values MUST be within `-9007199254740991` to `9007199254740991`.
Kinds and timestamps additionally require non-negative values. Larger exact
integers must be represented as strings if their MIP permits them.
Negative zero follows JCS normalization to zero; it has no distinct meaning.

These checks apply recursively, including to unknown fields. Parsing that
silently drops duplicate members before validation is not sufficient.

### Kind-defined behavior

The defining MIP specifies:

- Required, optional, and unknown-field behavior inside `header` and `content`.
- Semantic validation, relationships, and limits.
- Public header paths eligible for filtering.
- Any logical grouping, revision preference, or current-view behavior.

Unknown or unsupported kinds MAY be stored opaquely according to relay policy,
after envelope, ID, and signature verification. A relay MUST NOT describe such
storage as semantic validation or silently infer semantics from kind numbers.

### Immutability and local state

All of `header` and `content` participate in the hash. Removing an unknown
field before hashing or forwarding is invalid.

Changing signed data creates another ID. Formatting differences in JSON are not
different events when the canonical signed value is unchanged.

Retention deadlines, admission order, synchronization cursors, propagation
attempts, and delivery state are relay-local information, not signed fields.
Repeated valid submissions with the same ID do not create additional events.

### Limits and time

Relays publish their size and resource limits through MIP-03. There is no
universal 2 MiB limit inherited from the earlier draft. Enforce finite decoded
byte and nesting limits before expensive validation; local refusal is distinct
from an event's cryptographic validity.

`created_at` is not trusted evidence of creation time, arrival order, or whether
an event preceded a key compromise. Future-clock admission policy is local and
must not be mistaken for a global timestamp rule.

## Canonical Examples

This complete event uses the public example key from MIP-02. Its article body
is illustrative; the final publication content profile remains open in MIP-04.

```json
{
  "version": 1,
  "id": "945708370d265a3825922c890b2ac7f09fb0d5a68fa5e12e9b768ec0e3790791",
  "signer": "d75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a",
  "created_at": 1710000000,
  "kind": 1,
  "header": {
    "publication": "hello-murm",
    "revision": 1,
    "status": "published"
  },
  "content": "Hello Murm.",
  "signature": "8ab72b5776fbd22b5530c93e7262012b94a73b37c4e9f097d9bf4f8d0d738cb3f517c8b3ebb4e8c3ffb894769b5448a532b1674e2357caa0c051f7c725b4fc01"
}
```

## Validation

1. Bound wire size, decompression, and parse depth.
2. Parse one object using the JSON input rules.
3. Check the eight fields, types, version, and encodings.
4. Recompute the ID and verify the signature under MIP-02.
5. Validate known kinds under their MIP; otherwise apply opaque-kind policy.
6. Apply local acceptance policy before reporting storage.

Unknown versions MUST cause an explicit unsupported-version failure, not an
attempt to process the object as version 1. MIP-03 tracks the remaining error
wire-format decisions.

## Relay Indexing

Core operations address IDs and filter by `kind`, `signer`, and `created_at`.
MIP-03 defines their request syntax. Kind MIPs define header filters.

There is no universal `author` filter and no core filtering of `content`.
A future author/device relationship needs explicit semantics, not a hidden
alias for `signer`.

## Compatibility

This envelope replaces the previous draft's extra `author` and `authorization`
fields and its different hash input. Old signed events MUST NOT be rewritten
and passed off as valid events in the new format.

## Security Considerations

A valid signature proves integrity and control of a key. It does not prove
truth, human identity, non-spam behavior, complete search results, or retention.
Clients and relays MUST independently verify received events.

Application content and external URLs remain untrusted. Use local secret
storage and established cryptographic libraries. Public metadata is visible
even when the body contains ciphertext.

## Open Decisions

Before acceptance, define a common resource-limit advertisement, timestamp
policy vocabulary, and interoperability treatment of signature edge cases
across supported libraries. Logical identity and device management remain
separate design work; no device-key proposal is implicitly approved here.
