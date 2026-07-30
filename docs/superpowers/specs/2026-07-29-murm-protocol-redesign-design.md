# Murm Protocol Redesign

## Objective

Redesign the Murm Protocol around a small, generic signed-event envelope without
copying Nostr's positional tag model. Official MIPs define every supported event
kind, including its public header, content schema, validation rules, and
indexable fields.

The redesign must support long-form publishing immediately and leave clean
extension points for device authorization and end-to-end encrypted messages.

## Design Principles

- Identity is cryptographic. There are no protocol accounts, passwords,
  sessions, JWTs, or trusted identity servers.
- Events are immutable and independently verifiable.
- Relays are untrusted storage, query, and delivery services.
- Event kinds are assigned and specified only through MIPs.
- The core envelope is generic; kind-specific semantics do not leak into the
  core specification.
- Public metadata is separated from the event body.
- Advanced messaging cryptography is specified separately from the core and
  must not be invented as an incidental part of the relay protocol.

## Core Event Envelope

```ts
type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue }

type Event = {
  version: number
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

The fixed fields have these responsibilities:

- `version`: version of the core event envelope.
- `id`: content-derived identifier of the complete unsigned event payload.
- `author`: public identity represented by the event.
- `signer`: public key that produced `signature`.
- `authorization`: authorization-event ID when `signer` acts for `author`;
  otherwise `null`.
- `created_at`: integer Unix timestamp in seconds.
- `kind`: numeric kind allocated by an accepted MIP.
- `header`: public, structured, kind-specific metadata.
- `content`: kind-specific body, represented by any JSON value permitted by the
  kind's MIP.
- `signature`: signature made by `signer`.

Directly authored events set `signer` equal to `author` and `authorization` to
`null`.

## Header and Content

The core does not define generic tags or a `content_type` field.

Each kind MIP defines:

- the exact JSON schema of `header`;
- the exact JSON schema of `content`;
- required, optional, and forbidden fields;
- size limits;
- semantic validation;
- header fields that relays may index;
- whether the kind is an isolated event or a versioned document.

`header` contains public information required for routing, references,
validation, and indexing. `content` contains the body. For an encrypted-message
kind, routing information such as the recipient remains in `header`, while
`content` contains ciphertext.

Unknown header or content fields are handled according to the event kind's MIP,
not by a global rule.

## Canonicalization, IDs, and Signatures

The canonical unsigned payload is:

```json
[
  1,
  "<author>",
  "<signer>",
  null,
  1710000000,
  100,
  {},
  "content"
]
```

Its fields appear in this exact order:

```text
version, author, signer, authorization, created_at, kind, header, content
```

Objects inside `header` and `content` use JSON Canonicalization Scheme
(RFC 8785). The resulting JSON is UTF-8 encoded without a byte-order mark.

```text
id = lowercase_hex(SHA-256(canonical_payload_bytes))
signature = lowercase_hex(Ed25519_sign(signer_private_key, raw_id_bytes))
```

Validation reconstructs the canonical payload, recalculates `id`, and verifies
`signature` over the raw 32-byte ID using `signer`.

## Versioned Documents

Events remain immutable. A kind MIP may define a document whose current state is
represented by a chain of immutable revision events.

All versioned document kinds use these header fields:

```ts
type DocumentHeader = {
  document: string
  revision: number
  previous: string | null
}
```

- `document` is a lowercase hexadecimal identifier generated from 32 random
  bytes by the document creator.
- `revision` starts at `1`.
- Revision `1` uses `previous: null`.
- Revision `n`, where `n > 1`, references a valid revision `n - 1` of the same
  document, kind, and author.
- A revision whose predecessor is unavailable remains unresolved and must not be
  treated as the current state.
- The valid event with the greatest revision is current.
- If valid branches have the same greatest revision, the event with the
  lexicographically lowest `id` is the deterministic current revision. Clients
  may expose the losing branch as a conflict.

Individual kind MIPs extend `DocumentHeader` with their own fields.

## Initial Kind Set

The first compatibility profile contains:

- `profile`: versioned public identity metadata;
- `publication`: versioned Markdown-compatible long-form or short-form content;
- `comment`: immutable reply to a publication or another comment;
- `reaction`: immutable lightweight response to another event.

The kind registry assigns the numeric values. The publication kind replaces the
distinction between a short social post and a long article; clients determine
presentation from the content and header metadata.

## Device Authorization

The core envelope includes `signer` and `authorization` so that device support
can be added without changing the event format.

The initial core requires direct signatures. A separate authorization MIP will
define:

- device authorization events signed by `author`;
- permitted scopes and expiration;
- authorization references from delegated events;
- revocation events;
- validation in partially synchronized environments.

Until that MIP is accepted, core-compatible implementations reject events where
`signer` differs from `author`.

## Encrypted Messages

Encrypted messages are a separate protocol subsystem and kind MIP.

The agreed baseline is:

- the relay may see sender, recipient, timing, and traffic volume;
- plaintext and private keys remain exclusively on clients;
- the event `header` carries public delivery metadata;
- the event `content` carries the encrypted envelope;
- the relay does not maintain encryption sessions or interpret ciphertext;
- BlackWire may inform the client-side model, but its user registry, inbox API,
  prekey storage, and Double Ratchet design are not copied wholesale.

The encryption construction, key discovery, multi-device behavior, and session
state require their own design and implementation plan after the core rewrite.

## Relay Responsibilities

A relay:

- validates the core event shape, canonical ID, and direct signature;
- applies kind-specific validation for the compatibility profile it claims;
- stores immutable events idempotently by `id`;
- fetches events by exact ID;
- scans events using core fields and MIP-declared indexable header fields;
- may refuse valid events for local policy without redefining protocol validity.

A relay does not authenticate authors with login credentials and does not become
an authority for identity or document state.

## HTTP Relay Interface

The initial transport binding uses HTTP and JSON. Its required resources are:

```text
GET     /info
POST    /events
GET     /events/{id}
QUERY   /events
POST    /events/query
OPTIONS /events
```

There are no registration, login, session, or token endpoints.

### Relay Information

`GET /info` returns supported envelope versions, MIPs, limits, and transport
capabilities:

```json
{
  "protocol": "murm",
  "versions": [1],
  "mips": [1, 2, 3, 4, 5],
  "limits": {
    "event_bytes": 2097152,
    "batch_events": 100,
    "query_conditions": 20,
    "query_groups": 10,
    "query_limit": 100
  },
  "features": {
    "http_query": true,
    "post_query_fallback": true
  }
}
```

### Submit Events

`POST /events` accepts:

```json
{
  "events": []
}
```

Sending one item submits a single event; sending multiple items submits a
batch. The request contains between 1 and the relay's advertised `batch_events`
limit.
The relay processes every event independently and returns `200 OK` when the
request envelope itself is valid:

```json
{
  "results": [
    {
      "id": "<event-id>",
      "accepted": true,
      "status": "stored"
    },
    {
      "id": "<event-id>",
      "accepted": false,
      "status": "rejected",
      "reason": "invalid_signature"
    }
  ]
}
```

The protocol defines stable rejection reasons. Batch submission is idempotent at
the event level because repeated IDs return `duplicate`.

### Fetch by ID

`GET /events/{id}` returns the exact event with `200 OK` or `404 Not Found`.
Successful responses include:

```text
ETag: "<event-id>"
Cache-Control: public, max-age=31536000, immutable
```

Relays support `If-None-Match` and return `304 Not Modified` when appropriate.

### Query Events

The primary query operation is `QUERY /events`, following RFC 10008. It is safe
and idempotent and carries a structured request body.

```text
Content-Type: application/vnd.murm.query+json
Accept: application/json
```

`POST /events/query` is a required compatibility fallback with the exact same
request and response semantics. Clients should use `QUERY` and retry with the
fallback only after `405 Method Not Allowed`, `501 Not Implemented`, or a local
transport failure that specifically rejects the method.

`OPTIONS /events` advertises:

```text
Allow: POST, QUERY, OPTIONS
Accept-Query: "application/vnd.murm.query+json"
```

`OPTIONS /events/{id}` advertises `GET`, `HEAD`, and `OPTIONS`.

The query body is:

```ts
type EventQuery = {
  where: QueryGroup[]
  sort?: SortField[]
  limit?: number
  cursor?: string | null
}

type QueryGroup = {
  all: QueryCondition[]
}

type QueryCondition = {
  path: string
  op: "eq" | "in" | "contains" | "exists" | "gte" | "lte"
  value: JsonValue
}

type SortField = {
  path: string
  direction: "asc" | "desc"
}
```

Groups in `where` are combined with `OR`. Conditions in a group's `all` array
are combined with `AND`.

Paths are JSON Pointers into the complete event. Core-compatible relays support
conditions on:

```text
/id
/author
/signer
/created_at
/kind
```

Kind MIPs declare additional indexable and sortable paths under `/header`.
Queries never address `/content` in the core compatibility profile.

Operator semantics are:

- `eq`: field equals `value`.
- `in`: field equals any element of the array in `value`.
- `contains`: array field contains `value`.
- `exists`: field existence equals the boolean in `value`.
- `gte`: numeric field is greater than or equal to `value`.
- `lte`: numeric field is less than or equal to `value`.

`where` contains 1 to 10 groups. Each group contains 1 to 20 conditions.
`limit` defaults to 20 and cannot exceed 100.

Default ordering is:

```json
[
  {
    "path": "/created_at",
    "direction": "desc"
  },
  {
    "path": "/id",
    "direction": "asc"
  }
]
```

Relays always append `/id` ascending as the final tie-breaker when the supplied
sort does not include it. A relay rejects unsupported or non-indexed paths
instead of silently scanning them.

Example: recent publication events by an author:

```json
{
  "where": [
    {
      "all": [
        {
          "path": "/kind",
          "op": "eq",
          "value": 1
        },
        {
          "path": "/author",
          "op": "eq",
          "value": "<author-public-key>"
        }
      ]
    }
  ],
  "sort": [
    {
      "path": "/created_at",
      "direction": "desc"
    }
  ],
  "limit": 20,
  "cursor": null
}
```

Example: publication revisions ordered newest first:

```json
{
  "where": [
    {
      "all": [
        {
          "path": "/kind",
          "op": "eq",
          "value": 1
        },
        {
          "path": "/header/document",
          "op": "eq",
          "value": "<document-id>"
        }
      ]
    }
  ],
  "sort": [
    {
      "path": "/header/revision",
      "direction": "desc"
    }
  ],
  "limit": 20
}
```

Successful query response:

```json
{
  "events": [],
  "page": {
    "next": null,
    "has_more": false
  }
}
```

Cursors are opaque and bound to the canonical query excluding `cursor`. A relay
rejects a cursor reused with a different query. The response does not include a
total count.

### HTTP Errors

Request-level failures use RFC 9457 Problem Details with
`Content-Type: application/problem+json`:

```json
{
  "type": "urn:murm:problem:unsupported-filter",
  "title": "Unsupported filter",
  "status": 422,
  "detail": "The requested path is not indexed by this relay.",
  "code": "unsupported_filter",
  "pointer": "/where/0/all/1/path"
}
```

The first relay-interface MIP defines stable codes for malformed JSON, invalid
request shape, unsupported filters, invalid cursors, excessive limits, invalid
events, policy refusal, rate limiting, and temporary relay failure.

## Compatibility and Evolution

- All kinds used by core-compatible clients are allocated through MIPs.
- A MIP includes a kind number, header schema, content schema, examples,
  validation, security considerations, and compatibility rules.
- Unknown kinds may be stored and forwarded but are not considered understood.
- Envelope changes increment `version`.
- Breaking changes to an existing kind require a new kind allocation or an
  explicit migration MIP.
- Every cryptographic rule ships with language-independent test vectors.

## Scope of the First Rewrite

The first implementation effort updates the documentation repository only:

1. Replace the event and signature drafts with the new envelope and canonical
   hashing rules.
2. Adapt the relay interface to structured-header filters.
3. Rewrite the initial kinds around versioned profiles and publications.
4. Update the compatibility profile and repository navigation.
5. Add deterministic cryptographic test vectors.

Device authorization and encrypted messages follow as independent MIPs and
independent plans.
