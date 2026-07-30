# MIP-01: Event Format

Status: `draft`

## Kind Allocation

This MIP defines the common event envelope and allocates no event kind.

## Abstract

This MIP defines version 1 of the immutable Murm `Event`. Every event identifies
an author, carries a kind-specific public header and content body, and can be
verified without trusting the relay that delivered it.

## Motivation

Murm needs one small envelope that can represent publications, profiles,
messages, and future protocol actions without relying on positional tags.
Applications should be able to add new behavior through MIPs while relays keep a
stable storage and validation model.

## Specification

### JSON Values

Murm uses the I-JSON subset required by the JSON Canonicalization Scheme:

```ts
type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue }
```

JSON objects MUST NOT contain duplicate property names. Strings MUST contain
valid Unicode and MUST preserve their original code points without
normalization. Numbers MUST be finite IEEE 754 values. Fields that this MIP
defines as integers MUST be safe integers from `0` through
`9007199254740991`.

### Event

```ts
type Event = {
  version: 1
  id: string
  author: string
  signer: string
  authorization: string | null
  created_at: number
  kind: number
  header: Record<string, JsonValue>
  content: JsonValue
  signature: string
}
```

Unknown top-level fields are invalid in version 1.

### Fields

- `version` MUST be the integer `1`.
- `id` MUST be a lowercase hexadecimal encoding of a 32-byte event hash.
- `author` MUST be a lowercase hexadecimal encoding of the 32-byte Ed25519
  public key representing the event author.
- `signer` MUST be a lowercase hexadecimal encoding of the 32-byte Ed25519
  public key that produced `signature`.
- `authorization` MUST be `null` for direct authorship. A future MIP may define
  a 32-byte event ID authorizing a different `signer`.
- `created_at` MUST be a non-negative safe integer containing Unix time in UTC
  seconds.
- `kind` MUST be a non-negative safe integer allocated through MIP-00.
- `header` MUST be a JSON object containing public, kind-specific metadata.
- `content` MUST be a JSON value allowed by the MIP that defines `kind`.
- `signature` MUST be a lowercase hexadecimal encoding of a 64-byte Ed25519
  signature.

### Direct Authorship

Core version 1 supports direct signatures:

```text
signer == author
authorization == null
```

An event that does not satisfy both conditions is invalid under the core version
1 compatibility profile. The two fields are separate so a future
device-authorization MIP can define delegated signatures without changing the
event envelope.

### Kind Ownership

MIP-01 only requires `header` to be an object and `content` to be a JSON value.
The MIP that owns `kind` MUST define:

- the exact header schema;
- the exact content schema;
- required and optional properties;
- whether extra properties are accepted;
- size and semantic limits;
- indexable and sortable header paths;
- whether events form a versioned document.

There is no generic `tags` or `content_type` field.

### Size

The complete event JSON received on the wire MUST NOT exceed 2 MiB
(`2097152` bytes) when encoded as UTF-8. Relays SHOULD enforce the wire-size
limit before cryptographic or kind-specific validation.

### Immutability

An event is immutable after its ID and signature are created. Changing any
signed field creates a different event ID.

Repeated submissions of the same valid ID MUST be idempotent. A relay MUST NOT
replace stored bytes for an existing ID with different bytes.

## Canonical Examples

The normative, cryptographically valid version 1 examples are stored in
[`../test-vectors/mip-02-event-v1.json`](../test-vectors/mip-02-event-v1.json).

The unsigned portion of a publication event has this shape:

```json
{
  "version": 1,
  "author": "d75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a",
  "signer": "d75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a",
  "authorization": null,
  "created_at": 1710000000,
  "kind": 1,
  "header": {
    "document": "4f5f4c6b5e897c32217a32097510c8d67491c7c9200f2af22c568a5dc2363742",
    "revision": 1,
    "previous": null,
    "title": "Hello Murm"
  },
  "content": "# Hello Murm\n\nA signed publication."
}
```

`id` and `signature` are added using MIP-02.

## Validation

An implementation validates an event in this order:

1. Enforce the request and event byte limits.
2. Parse one JSON object while rejecting duplicate property names and invalid
   Unicode.
3. Validate the fixed event shape.
4. Require `signer == author` and `authorization == null`.
5. Validate the ID and signature using MIP-02.
6. Find the accepted MIP that defines `kind`.
7. Validate `header` and `content` using that MIP.

Relays SHOULD refuse events whose `created_at` is more than 30 minutes in the
future, but clock policy does not change the event's cryptographic validity.

The normative structural schema is
[`../schemas/event-v1.schema.json`](../schemas/event-v1.schema.json).

## Relay Indexing

Core-compatible relays MUST index:

```text
/id
/author
/signer
/created_at
/kind
```

These are JSON Pointers into the complete event. MIP-01 defines no indexable
paths under `/header`; kind MIPs define them.

Relays MUST NOT index or query `/content` as part of the core compatibility
profile.

## Compatibility

An implementation that only supports envelope version 1 MUST reject other
versions with a stable `unsupported_version` result.

Unknown kinds MAY be stored as opaque events when the envelope, ID, and
signature are valid. Unknown kinds are not semantically valid under a
compatibility profile unless that profile includes their defining MIP.

## Security Considerations

Transport authentication, IP addresses, API keys, relay accounts, and relay
acceptance are not proof of authorship. Authorship comes only from a valid event
signature.

Relays SHOULD reject oversized input before hashing or signature verification.
Clients MUST treat relay responses as untrusted and validate events locally.

Applications MUST treat `header` and `content` as untrusted user-controlled
data. Rendering and execution rules belong to the relevant kind MIP.

## Test Vectors

MIP-02 defines the normative version 1 hashing and signature vectors in
[`../test-vectors/mip-02-event-v1.json`](../test-vectors/mip-02-event-v1.json).
