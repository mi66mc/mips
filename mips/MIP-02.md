# MIP-02: Signatures

Status: `draft`

## Abstract

This MIP defines how Murm Protocol events are identified and signed.

An event `id` is the SHA-256 hash of a canonical event payload. An event `sig` is
an Ed25519 signature over that hash. Relays and clients use these values to
verify that an event was not modified and that it was authored by the holder of
the private key corresponding to `pubkey`.

## Motivation

murm does not use email, passwords, sessions, or JWTs as the base identity
mechanism. Authorship is established by cryptographic signatures.

This requires all implementations to produce the same event `id` for the same
event data. A deterministic payload format is required before hashing and
signing.

## Specification

### Cryptographic Algorithms

- Event identifiers MUST use SHA-256.
- Event signatures MUST use Ed25519.
- `id`, `pubkey`, and `sig` MUST be encoded as lowercase hexadecimal strings.
- `pubkey` MUST encode a 32-byte Ed25519 public key.
- `id` MUST encode a 32-byte SHA-256 hash.
- `sig` MUST encode a 64-byte Ed25519 signature.

### Canonical Payload

The canonical event payload is a JSON array containing exactly these fields, in
this order:

```json
[
  "<pubkey>",
  1710000000,
  1,
  [["topic", "murm"]],
  "hello murm"
]
```

In TypeScript-like notation:

```ts
canonical_payload = canonical_json([
  event.pubkey,
  event.created_at,
  event.kind,
  event.tags,
  event.content
])
```

The canonical payload MUST NOT include:

- `id`
- `sig`
- unknown extra fields

### Canonical JSON Rules

The canonical JSON representation MUST follow these rules:

- The root value MUST be the payload array defined above.
- Object values MUST NOT appear in the canonical payload.
- Arrays MUST preserve their original order.
- Strings MUST preserve their exact Unicode content.
- Implementations MUST NOT apply Unicode normalization.
- Integers MUST be serialized in decimal form without leading zeroes.
- Whitespace outside strings MUST NOT be emitted.
- The canonical payload MUST be encoded as UTF-8 bytes before hashing.

The following compact JSON is an example canonical payload:

```json
["<pubkey>",1710000000,1,[["topic","murm"]],"hello murm"]
```

### Event ID

The event `id` is computed as:

```txt
id = lowercase_hex(sha256(canonical_payload_bytes))
```

### Event Signature

The signature input is the raw 32-byte hash represented by `id`, not the
hexadecimal string.

```txt
sig = lowercase_hex(ed25519_sign(private_key, raw_id_bytes))
```

### Validation

To validate an event, an implementation MUST:

1. Validate the event shape according to [MIP-01](MIP-01.md).
2. Decode `event.pubkey` from lowercase hexadecimal.
3. Decode `event.sig` from lowercase hexadecimal.
4. Rebuild the canonical payload from `pubkey`, `created_at`, `kind`, `tags`,
   and `content`.
5. Hash the canonical payload bytes with SHA-256.
6. Compare the lowercase hexadecimal hash with `event.id`.
7. Verify `event.sig` using Ed25519 with `event.pubkey` and the raw hash bytes.
8. Reject the event if any step fails.

## Examples

Given this unsigned event data:

```json
{
  "pubkey": "<32-byte-public-key-hex>",
  "created_at": 1710000000,
  "kind": 1,
  "tags": [
    ["topic", "murm"]
  ],
  "content": "hello murm"
}
```

The canonical payload is:

```json
["<32-byte-public-key-hex>",1710000000,1,[["topic","murm"]],"hello murm"]
```

The final signed event has the [MIP-01](MIP-01.md) event shape:

```json
{
  "id": "<32-byte-sha256-hex>",
  "pubkey": "<32-byte-public-key-hex>",
  "created_at": 1710000000,
  "kind": 1,
  "tags": [
    ["topic", "murm"]
  ],
  "content": "hello murm",
  "sig": "<64-byte-ed25519-signature-hex>"
}
```

## Security Considerations

Private keys MUST NOT be sent to relays.

Relays MUST NOT accept events with invalid `id` or `sig` values.

Clients SHOULD verify event signatures for events received from relays. Relay
acceptance alone MUST NOT be treated as proof that an event is valid.

Implementations SHOULD use constant-time cryptographic library functions where
available.

Implementations MUST use a cryptographically secure random number generator when
creating Ed25519 private keys.
