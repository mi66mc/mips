# MIP-01: Event Format

Status: `draft`

## Abstract

This MIP defines the base `Event` object used by the Murm Protocol.

An event is the canonical unit of public content, metadata, and protocol actions
in murm. Events are authored by public keys, identified by content hashes, and
validated through cryptographic signatures.

## Motivation

murm needs a small, stable event format that can move across different transports
without changing meaning. The same event should be usable over HTTP relays,
future WebSocket relays, local storage, and future peer-to-peer transports.

The relay should not own user identity or session state. Instead, clients create
events locally and relays validate those events before storing or distributing
them.

## Specification

An event is a JSON object with the following fields:

```ts
type Event = {
  id: string
  pubkey: string
  created_at: number
  kind: number
  tags: string[][]
  content: string
  sig: string
}
```

### Fields

- `id`: lowercase hex-encoded hash of the canonical event payload.
- `pubkey`: lowercase hex-encoded public key of the event author.
- `created_at`: Unix timestamp in seconds.
- `kind`: numeric event kind.
- `tags`: ordered list of tag arrays.
- `content`: event body as a string.
- `sig`: lowercase hex-encoded signature proving that `pubkey` authored the event.

### Initial Rules

- Events MUST be valid JSON objects.
- Events MUST contain all required fields.
- Unknown extra fields SHOULD be ignored by protocol implementations.
- Unknown extra fields MUST NOT be included when calculating the event `id`.
- `created_at` MUST be represented as Unix time in seconds, in UTC.
- `created_at` MUST be an integer.
- `kind` MUST be an integer.
- `tags` MUST be an array of arrays of strings.
- `tags` MAY be an empty array.
- Each tag inside `tags` MUST contain at least two strings: a tag name and a tag value.
- Tag names SHOULD be explicit, readable names such as `event`, `pubkey`, or `topic`.
- `content` MUST be a string, including when it stores encoded structured data.
- The serialized event JSON MUST NOT exceed 1 MiB.
- Relays MUST validate `id` and `sig` before accepting an event.
- Relays SHOULD reject events with `created_at` more than 30 minutes in the future.
- Relays MUST treat repeated submissions of the same `id` as idempotent.

## Examples

```json
{
  "id": "<event-id>",
  "pubkey": "<author-public-key>",
  "created_at": 1710000000,
  "kind": 1,
  "tags": [
    ["topic", "murm"]
  ],
  "content": "hello murm",
  "sig": "<signature>"
}
```

An event without tags is valid:

```json
{
  "id": "<event-id>",
  "pubkey": "<author-public-key>",
  "created_at": 1710000000,
  "kind": 1,
  "tags": [],
  "content": "hello murm",
  "sig": "<signature>"
}
```

The following tag values are invalid because each tag must contain at least two
strings:

```json
{
  "tags": [
    [],
    ["topic"]
  ]
}
```

## Validation

Detailed hashing and signature validation rules are defined outside this MIP.
At minimum, an implementation must be able to:

1. Reconstruct the canonical payload.
2. Recalculate the event `id`.
3. Compare the calculated `id` with `event.id`.
4. Verify `event.sig` against `event.pubkey` and `event.id`.

## Security Considerations

Relays MUST NOT treat transport-level authentication as proof of authorship.
Authorship is established only by event signatures.

Clients SHOULD treat unsigned, invalid, or partially validated events as
untrusted data.

Relays SHOULD enforce size limits before doing expensive validation work.
