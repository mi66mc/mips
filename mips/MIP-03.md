# MIP-03: Relay Interface

Status: `draft`

## Abstract

This MIP defines the minimal relay interface for the Murm Protocol.

A relay is a verifiable event store. It accepts signed events, returns events by
identifier, and scans stored events by deterministic filters. The interface is
defined as transport-neutral operations with an initial HTTP binding.

## Motivation

murm is local-first. Clients may keep their own local event store and use relays
to publish, discover, and synchronize signed events.

The relay interface should not be designed as a social feed API. It should be a
small set of event-store primitives that can later be mapped to HTTP,
WebSocket, peer-to-peer transports, or local adapters without changing event
semantics.

## Specification

Relays expose three logical operations:

- `submit`: accept one or more signed events.
- `fetch`: return events by exact event id.
- `scan`: return events matching one or more filters.

Relays MUST validate events according to [MIP-01](MIP-01.md) and
[MIP-02](MIP-02.md) before storing them.
Relays MAY apply local policy such as rate limits, storage limits, moderation
rules, or accepted event kinds.

### Event Filter

An event filter is a JSON object with the following shape:

```ts
type EventFilter = {
  ids?: string[]
  authors?: string[]
  kinds?: number[]
  tags?: string[][]
  since?: number
  until?: number
}
```

Filter fields are optional.

Within a single filter:

- Different fields are combined with `AND`.
- Values inside `ids`, `authors`, and `kinds` are combined with `OR`.
- Tags inside `tags` are combined with `AND`.
- `since` matches events with `created_at >= since`.
- `until` matches events with `created_at <= until`.

When a request contains multiple filters, filters are combined with `OR`.

Each tag filter MUST contain at least two strings: a tag name and a tag value.
An event matches a tag filter when it contains a tag with the same name and the
same value in the first two positions.

For example, this filter:

```json
{
  "kinds": [1],
  "tags": [
    ["topic", "murm"],
    ["lang", "pt"]
  ]
}
```

matches events where:

```txt
kind is 1
AND tag ["topic", "murm"] exists
AND tag ["lang", "pt"] exists
```

### Ordering

Scan results MUST be ordered by `created_at`.

The default order is `desc`.

When two events have the same `created_at`, relays MUST order them by `id` in
ascending lexicographic order.

### Limits

If `limit` is omitted, relays SHOULD use a default limit of 20.

Relays MUST NOT return more than 100 events in a single `scan` response unless a
future MIP defines a larger negotiated limit.

Requests with `limit` greater than 100 MUST be rejected.

Relays MAY return fewer events than requested.

### Cursors

Scan pagination uses opaque cursors.

Clients MUST NOT parse or construct cursors. A cursor is meaningful only to the
relay that created it.

If `cursor` is `null` or omitted, the relay starts a new scan.

If more matching events may be available, the relay SHOULD return a non-null
`cursor`. If no more events are available, the relay SHOULD return `null`.

## HTTP Binding

The initial HTTP binding uses JSON request and response bodies.

All endpoints in this MIP use `POST`, including read operations. This keeps the
interface consistent with batch requests, structured filters, future transports,
and local-first synchronization.

### HTTP Status Codes

Relays SHOULD use HTTP status codes for request-level failures and structured
JSON for operation-level results.

- `200 OK`: request envelope is valid; operation results are returned in JSON.
- `400 Bad Request`: request body is not valid JSON or does not match the request shape.
- `413 Payload Too Large`: request body exceeds relay limits.
- `429 Too Many Requests`: request was rate-limited.
- `500 Internal Server Error`: relay failed unexpectedly.

For batch operations, one invalid event MUST NOT cause the entire request to
fail if the request envelope itself is valid. Per-event failures MUST be reported
inside the JSON response.

### POST /submit

Submits one or more signed events.

Request:

```ts
type SubmitRequest = {
  events: Event[]
}
```

Response:

```ts
type SubmitResponse = {
  results: SubmitResult[]
}

type SubmitResult = {
  id: string | null
  accepted: boolean
  status: "stored" | "duplicate" | "rejected"
  reason?: string
}
```

Rules:

- Relays MUST process each event independently.
- Relays MUST NOT store invalid events.
- Repeated submissions of the same valid event id MUST be idempotent.
- A duplicate event SHOULD return `accepted: true` and `status: "duplicate"`.
- `reason` SHOULD be a stable machine-readable string when `accepted` is false.

### POST /fetch

Fetches events by exact id.

Request:

```ts
type FetchRequest = {
  ids: string[]
}
```

Response:

```ts
type FetchResponse = {
  events: Event[]
  missing: string[]
}
```

Rules:

- `ids` MUST contain at least one event id.
- Relays SHOULD preserve request order when returning `events`.
- `missing` MUST contain requested ids that were not found.

### POST /scan

Scans stored events using one or more filters.

Request:

```ts
type ScanRequest = {
  filters: EventFilter[]
  limit?: number
  cursor?: string | null
  order?: "asc" | "desc"
}
```

Response:

```ts
type ScanResponse = {
  events: Event[]
  cursor: string | null
  has_more: boolean
}
```

Rules:

- `filters` MUST contain at least one filter.
- `order` defaults to `desc`.
- `limit` defaults to 20.
- `limit` MUST NOT exceed 100.
- Empty filter objects MAY be accepted only when `limit <= 20`.
- Relays MAY reject empty filter objects by policy.
- If `has_more` is false, `cursor` SHOULD be `null`.

## Examples

### Submit One Event

```http
POST /submit
Content-Type: application/json

{
  "events": [
    {
      "id": "7b0f8b8f5f5e9fd1a76dcf4db5a70fbb7d17c0464fdc2fa2be4d9e9b8e2d6c41",
      "pubkey": "9f2c4b6a0d8e1f3377a1b25c94f0e8d6aa11223344556677889900aabbccddeeff",
      "created_at": 1710000000,
      "kind": 1,
      "tags": [
        ["topic", "murm"]
      ],
      "content": "hello murm",
      "sig": "<64-byte-ed25519-signature-hex>"
    }
  ]
}
```

### Submit Batch

```http
POST /submit
Content-Type: application/json

{
  "events": [
    {
      "id": "<profile-event-id>",
      "pubkey": "<pubkey>",
      "created_at": 1710000000,
      "kind": 0,
      "tags": [],
      "content": "{\"name\":\"alice\",\"about\":\"writing about local-first software\"}",
      "sig": "<sig>"
    },
    {
      "id": "<post-event-id>",
      "pubkey": "<pubkey>",
      "created_at": 1710000100,
      "kind": 1,
      "tags": [
        ["topic", "murm"],
        ["lang", "pt"]
      ],
      "content": "# Primeiro post\n\nTexto do artigo...",
      "sig": "<sig>"
    }
  ]
}
```

### Fetch One Event

```http
POST /fetch
Content-Type: application/json

{
  "ids": [
    "7b0f8b8f5f5e9fd1a76dcf4db5a70fbb7d17c0464fdc2fa2be4d9e9b8e2d6c41"
  ]
}
```

### Fetch Multiple Events

```http
POST /fetch
Content-Type: application/json

{
  "ids": [
    "<profile-event-id>",
    "<post-event-id>",
    "<comment-event-id>"
  ]
}
```

### Scan Author Posts

```http
POST /scan
Content-Type: application/json

{
  "filters": [
    {
      "authors": [
        "9f2c4b6a0d8e1f3377a1b25c94f0e8d6aa11223344556677889900aabbccddeeff"
      ],
      "kinds": [1]
    }
  ],
  "limit": 20,
  "cursor": null,
  "order": "desc"
}
```

### Scan Posts By Topic And Language

```http
POST /scan
Content-Type: application/json

{
  "filters": [
    {
      "kinds": [1],
      "tags": [
        ["topic", "murm"],
        ["lang", "pt"]
      ]
    },
    {
      "kinds": [1],
      "tags": [
        ["topic", "local-first"],
        ["lang", "pt"]
      ]
    }
  ],
  "limit": 50,
  "cursor": null,
  "order": "desc"
}
```

This means:

```txt
(kind is 1 AND topic is murm AND lang is pt)
OR
(kind is 1 AND topic is local-first AND lang is pt)
```

## Validation

Relays SHOULD validate requests before performing storage or scan work.

Relays SHOULD reject malformed request bodies with a stable error response.

Relays MUST NOT return events that fail [MIP-01](MIP-01.md) or
[MIP-02](MIP-02.md) validation.

## Security Considerations

Relays SHOULD enforce request body size limits.

Relays SHOULD enforce rate limits for `submit`, `fetch`, and `scan`.

Relays SHOULD avoid exposing cursor internals, database ids, or storage topology.

Relays MAY reject expensive scans or require narrower filters.

Clients MUST treat relay responses as untrusted until event signatures are
verified locally.
