# MIP-02: Event IDs and Signatures

Status: `draft`

## Kind Allocation

This MIP allocates no event kind.

## Abstract

Murm hashes a canonical six-field JSON object with SHA-256 and signs the raw
digest with Ed25519. Every receiver can verify an event without trusting its
transport or storage provider.

## Motivation

Independent implementations must calculate the same ID. Fields unknown to one
implementation must remain authenticated rather than disappear during parsing.

## Specification

### Unsigned object

Build an object containing exactly these properties and their event values:

```json
{
  "version": 1,
  "signer": "d75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a",
  "created_at": 1710000000,
  "kind": 1,
  "header": {
    "publication": "hello-murm",
    "revision": 1,
    "status": "published"
  },
  "content": "Hello Murm."
}
```

The payload is an **object, not an ordered array**. Exclude `id` and `signature`.
Reject unknown top-level properties under MIP-01 before constructing it.
Include all nested header and content values without dropping unknown fields.

### Hashing

Canonicalization MUST follow
[RFC 8785 JCS](https://www.rfc-editor.org/rfc/rfc8785.html), with MIP-01 input
restrictions. JCS defines property ordering, number and string serialization,
and UTF-8 output. Ordinary object insertion order is not a substitute.

```text
unsigned = { version, signer, created_at, kind, header, content }
canonical_bytes = UTF8(JCS(unsigned))
raw_id = SHA256(canonical_bytes)
id = lowercase_hex(raw_id)
```

No additional domain-separation prefix is included in this draft.
Changing that decision changes every ID and requires explicit versioning.

### Signing

Use pure Ed25519 as defined in
[RFC 8032](https://www.rfc-editor.org/rfc/rfc8032.html), not Ed25519ph.

```text
signature_bytes = Ed25519_sign(private_signing_key, raw_id)
signature = lowercase_hex(signature_bytes)
```

The signature input is the **raw 32-byte digest**, not its 64-character hex
representation and not a serialization of the event with `id` added.

The signer key is 32 bytes and the signature is 64 bytes. Reject malformed
encodings and scalars outside the Ed25519 range. The draft retains strict
canonical point decoding: the public key is a non-identity prime-order-subgroup
point; the signature's R point is canonically encoded and in that subgroup.
Signature validity MUST NOT depend on a library's permissive decoding defaults.
Cross-library verification of these edge cases is required before acceptance.

## Canonical Examples

The MIP-01 example has this exact canonical unsigned JSON, with no trailing
newline in the hashed bytes:

```json
{"content":"Hello Murm.","created_at":1710000000,"header":{"publication":"hello-murm","revision":1,"status":"published"},"kind":1,"signer":"d75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a","version":1}
```

ID:

```text
945708370d265a3825922c890b2ac7f09fb0d5a68fa5e12e9b768ec0e3790791
```

Public RFC 8032 example seed, **never suitable for a real identity**:

```text
9d61b19deffd5a60ba844af492ec2cc44449c5697b326919703bac031cae7f60
```

Signature:

```text
8ab72b5776fbd22b5530c93e7262012b94a73b37c4e9f097d9bf4f8d0d738cb3f517c8b3ebb4e8c3ffb894769b5448a532b1674e2357caa0c051f7c725b4fc01
```

Formatting whitespace and object member order do not change the ID. Changing
a string, an array's order, or any signed metadata generally changes the ID.
Semantically equivalent JSON serializations need not have identical wire bytes.

## Validation

1. Validate MIP-01 input and field constraints.
2. Construct and canonicalize the six-field object.
3. Hash its UTF-8 bytes.
4. Compare the result with the declared ID.
5. Decode and validate the signer key and signature.
6. Verify Ed25519 against the recomputed raw digest.
7. Separately validate the kind and local policy.

A declared ID is never trusted as the signature input without recomputing it.
ID mismatch and signature failure are distinguishable validation failures.
There is no extra direct-author equality check or universal device certificate.

## Relay Indexing

This MIP adds no filter paths. MIP-03 uses the verified event ID for deduplication
and exact retrieval.

## Compatibility

The previous draft hashed an array with extra author-related fields. Its IDs
and signatures are not compatible with this object-based payload. Removing
fields from an old event does not migrate its signature.

The canonicalization, hash algorithm, signature algorithm, and signature input
are core-version rules, not options selected independently by each relay.

## Security Considerations

Real signing secrets require a cryptographically secure random generator and
protected local storage. Use maintained cryptographic implementations; this MIP
is not an instruction to implement curve arithmetic.

Do not normalize Unicode or discard nested fields. Canonicalization failure
must fail closed. A valid signature is not proof that a relay served the newest
event, all events, or any promised replica.

## Open Decisions

Before accepting this draft, verify the strict point-validation profile across
the chosen libraries and document its rejection cases in this MIP. Private
message key agreement and backup encryption are not specified by Ed25519 event
signatures; they belong to MIP-07 and MIP-08.
