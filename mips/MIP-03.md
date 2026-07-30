# MIP-03: Relay HTTP Interface

Status: `draft`

## Kind Allocation

This MIP defines transport operations and allocates no event kind.

## Abstract

This MIP defines the initial HTTP interface for Murm relays. Clients can
discover relay capabilities, submit signed events, fetch immutable events by
ID, and query indexed event fields with the safe and idempotent HTTP `QUERY`
method from RFC 10008.

## Motivation

Relays should behave as generic, verifiable event stores rather than
application-specific social APIs. The transport must support structured
filters, bounded resource use, deterministic pagination, and retries without
introducing protocol accounts or login.

`GET` is appropriate for exact immutable resources. Complex event searches need
a request body, so Murm uses `QUERY` rather than encoding large filters into a
URL or pretending a read is an unsafe operation.

## Specification

### Resources

Core-compatible relays expose:

```text
GET     /info
POST    /events
GET     /events/{id}
HEAD    /events/{id}
QUERY   /events
POST    /events/query
OPTIONS /events
OPTIONS /events/{id}
```

There are no protocol endpoints for registration, login, passwords, sessions,
JWTs, or API keys.

All request and response JSON uses UTF-8. Successful JSON responses use
`Content-Type: application/json`; problem responses use
`Content-Type: application/problem+json`.

MIP-03 JSON uses the MIP-01 JSON value and input restrictions, including
duplicate-name rejection, finite IEEE 754 numbers, safe integers, and valid
Unicode.

Every request object defined by this MIP is closed: an unknown member makes the
request an `invalid_request` unless a section explicitly defines that object as
extensible. Response objects are extensible, and clients MUST ignore response
members they do not understand. The `limits` and `features` objects returned by
`GET /info` are explicitly extensible.

Body limits apply to the decoded UTF-8 representation. Relays MUST reject an
oversized body before parsing it into unbounded memory and SHOULD also bound the
compressed representation.

### Relay Information

`GET /info` returns `200 OK` and:

```json
{
  "protocol": "murm",
  "versions": [1],
  "mips": [1, 2, 3, 4, 5],
  "limits": {
    "event_bytes": 2097152,
    "batch_events": 100,
    "batch_bytes": 8388608,
    "query_bytes": 65536,
    "query_conditions_per_group": 20,
    "query_groups": 10,
    "query_in_values": 100,
    "query_sort_fields": 3,
    "cursor_bytes": 4096,
    "query_limit": 100
  },
  "features": {
    "http_query": true,
    "post_query_fallback": true
  }
}
```

The response has these required rules:

- `protocol` is exactly `"murm"`;
- `versions` is a non-empty array of unique positive safe integers;
- `mips` is an array of unique non-negative safe integers;
- `limits` contains every limit shown above as a non-negative safe integer;
- `features.http_query` and `features.post_query_fallback` are booleans.

`versions` lists accepted event envelope versions. `mips` lists implemented
protocol MIPs. In version 1, `event_bytes`, `query_bytes`,
`query_conditions_per_group`, `query_groups`, `query_in_values`,
`query_sort_fields`, `cursor_bytes`, and `query_limit` have the exact values
shown above. A larger value requires a future protocol version that defines how
clients opt in.

`batch_events` and `batch_bytes` MAY vary. They state, respectively, the maximum
number of events and maximum decoded UTF-8 bytes accepted in one submission.
Both limits apply simultaneously. `batch_bytes` MUST be at least 4 MiB. A relay
MAY advertise additional integer limits and JSON-valued features. Clients MUST
ignore additional top-level information, limits, and features they do not
understand.

### Submit Events

`POST /events` accepts:

```ts
type SubmitRequest = {
  events: Event[]
}
```

The request MUST use `Content-Type: application/json`. A missing or different
media type MUST fail with `unsupported_media_type`.

`events` contains at least one item and no more than the relay's advertised
`batch_events` limit. The complete decoded request body MUST NOT exceed the
advertised `batch_bytes` limit. One item is a single-event submission; multiple
items form a batch.

`SubmitRequest` is closed. Each event object follows MIP-01, including its rule
that unknown top-level event members are invalid.

If the request envelope is valid, the relay returns `200 OK` and one result in
input order for every item:

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

- Each item is validated and processed independently.
- A malformed item does not reject other items.
- An item larger than `event_bytes` is rejected with
  `reason: "content_too_large"` without rejecting other items. A complete
  request larger than `batch_bytes` is rejected before item processing with
  `413 Content Too Large` and code `content_too_large`.
- A newly stored event returns `accepted: true` and `status: "stored"`.
- An identical, previously stored ID returns `accepted: true` and
  `status: "duplicate"`.
- A refused event returns `accepted: false`, `status: "rejected"`, and a stable
  `reason`. The reason MUST be one of the stable MIP-03 codes defined under
  HTTP Errors.
- `id` is `null` only when the relay cannot obtain a syntactically valid event
  ID from the item.
- Event IDs provide application-level idempotency. Retrying the same request
  cannot create a second logical event.

Request-level rate limiting MAY reject the whole operation with `429`. A relay
that begins processing a valid batch MUST return an individual result for every
item rather than silently stopping midway.

### Fetch an Event

`GET /events/{id}` fetches one exact event ID. The response content is the
complete event serialized with RFC 8785 JCS, making the selected representation
byte-stable across successful fetches.

A found event returns `200 OK`, the complete event JSON, and:

```text
ETag: "<event-id>"
Cache-Control: public, max-age=31536000, immutable
```

The ETag uses the quoted lowercase event ID as a strong entity tag. Relays MUST
evaluate `If-None-Match` according to RFC 9110, including weak comparison,
comma-separated entity-tag lists, and `*`. A matching current representation
returns `304 Not Modified`.

A valid but unavailable ID returns `404 Not Found`. A malformed path ID returns
`400 Bad Request`.

`HEAD /events/{id}` is identical to `GET /events/{id}` except that it returns no
response content. It uses the same status, ETag, cache, content-type, and
conditional-request semantics.

### Query Discovery

`OPTIONS /events` returns:

```text
Allow: POST, QUERY, OPTIONS
Accept-Query: "application/vnd.murm.query+json"
```

`OPTIONS /events/{id}` returns:

```text
Allow: GET, HEAD, OPTIONS
```

Relays MAY include other standard discovery and CORS headers.

### Query Events

The primary search operation is:

```http
QUERY /events
Content-Type: application/vnd.murm.query+json
Accept: application/json
```

`QUERY` is safe and idempotent as defined by RFC 10008. A successful response
uses `200 OK`.

The `Content-Type` field is mandatory. A missing content type, an unsupported
media type, or content inconsistent with the declared media type returns
`415 Unsupported Media Type` with code `unsupported_media_type`, as required by
RFC 10008.

For compatibility with HTTP clients or intermediaries that reject unknown
methods, relays MUST also implement:

```http
POST /events/query
Content-Type: application/vnd.murm.query+json
Accept: application/json
```

The fallback has exactly the same request, validation, result, ordering, and
cursor semantics, including the mandatory content type. Clients SHOULD use
`QUERY` first and retry the fallback only after:

- `405 Method Not Allowed`;
- `501 Not Implemented`; or
- a local or intermediary failure that specifically rejects the method.

Clients MUST NOT send both operations concurrently for one logical page.

### Query Shape

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

`where` contains 1 through the advertised `query_groups` groups. Groups are
combined with `OR`. Each group's `all` contains 1 through the advertised
`query_conditions_per_group` conditions combined with `AND`.

`sort` contains at most the advertised `query_sort_fields` unique fields.
`limit` defaults to `20`, has a minimum of `1`, and MUST NOT exceed the
advertised `query_limit`. `cursor` is `null` or omitted for the first page.

The decoded UTF-8 query body MUST NOT exceed the advertised `query_bytes`. A
non-null cursor MUST contain at most the advertised `cursor_bytes` in UTF-8.
`EventQuery`, `QueryGroup`, `QueryCondition`, and `SortField` are closed
objects.

### Query Paths

Paths are RFC 6901 JSON Pointers into the complete event.

MIP-01 requires support for:

```text
/id
/author
/signer
/created_at
/kind
```

Kind MIPs declare additional indexable and sortable `/header` paths. Relays MUST
reject an undeclared path with `unsupported_filter`; they MUST NOT silently run
an unbounded scan.

`/content` and every descendant of `/content` are unavailable to the core query
interface.

### Operators

- `eq`: the field equals `value`.
- `in`: the field equals any item in the array `value`, which contains 1
  through the advertised `query_in_values` unique items.
- `contains`: the field is an array containing `value`.
- `exists`: field existence equals the boolean `value`.
- `gte`: the numeric field is greater than or equal to numeric `value`.
- `lte`: the numeric field is less than or equal to numeric `value`.

Equality for structured JSON values uses RFC 8785 canonical bytes. `contains`
does not perform substring or full-text search.

Path resolution distinguishes a missing field from a present field whose value
is `null`:

- `exists` with `true` matches only a present field;
- `exists` with `false` matches only a missing field;
- every other operator evaluates to false when the field is missing;
- a present `null` value can match `eq: null` or an `in` array containing
  `null`.

Uniqueness of `in` values uses the same RFC 8785 equality.

Relays MUST reject an operator that is incompatible with the declared type of a
path. Core path support is:

| Path | Required operators | Sortable |
| --- | --- | --- |
| `/id` | `eq`, `in` | yes |
| `/author` | `eq`, `in` | no |
| `/signer` | `eq`, `in` | no |
| `/created_at` | `eq`, `in`, `gte`, `lte` | yes |
| `/kind` | `eq`, `in` | no |

For MIP-04 header paths:

| Path | Required operators | Sortable |
| --- | --- | --- |
| `/header/document` | `eq`, `in` | no |
| `/header/revision` | `eq`, `in`, `gte`, `lte` | yes |
| `/header/topics` | `contains`, `exists` | no |
| `/header/language` | `eq`, `in`, `exists` | no |
| `/header/root/author` | `eq`, `in` | no |
| `/header/root/document` | `eq`, `in` | no |
| `/header/parent` | `eq`, `in`, `exists` | no |
| `/header/target/type` | `eq`, `in` | no |
| `/header/target/id` | `eq`, `in`, `exists` | no |
| `/header/target/author` | `eq`, `in`, `exists` | no |
| `/header/target/kind` | `eq`, `in`, `exists` | no |
| `/header/target/document` | `eq`, `in`, `exists` | no |

### Ordering

The default ordering is:

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

When caller-supplied sorting does not include `/id`, the relay appends `/id`
ascending as the final deterministic tie-breaker. If the caller supplies
`/id`, it MUST be the final sort field with direction `asc`; any other
placement or direction is an `invalid_request`.

A relay MUST reject sorting by a path not declared sortable. It MUST also reject
a kind-specific sort unless every branch constrains `/kind` to kinds that
declare the path sortable.

### Pagination

A query returns:

```ts
type QueryResponse = {
  events: Event[]
  page: {
    next: string | null
    has_more: boolean
  }
}
```

The response is a set of events keyed by `id`. An event that satisfies multiple
`OR` groups MUST appear exactly once.

Cursors are opaque and scoped to the relay that issued them. Clients MUST NOT
parse, edit, or construct cursors. Continuation uses live keyset pagination:
the relay re-evaluates the query against its currently visible event set and
returns only events whose complete sort tuple is strictly after the last tuple
represented by the cursor.

The relay binds a cursor to the RFC 8785 canonical query with `cursor` omitted.
Changing `where`, `sort`, or `limit` while reusing a cursor returns
`invalid_cursor`.

If `has_more` is false, `next` MUST be `null`. Relays MAY expire cursors; an
expired cursor returns `invalid_cursor`. A relay MUST NOT issue a non-null
`next` value larger than its advertised `cursor_bytes`.

An event returned on an earlier page MUST NOT repeat during the same traversal.
An event that becomes visible after a page was read is omitted if its sort tuple
is at or before that page's cursor boundary and MAY appear if its tuple is after
the boundary. An event that stops being visible is omitted. Cursors do not
promise a fixed snapshot.

Responses do not include a total count.

## Canonical Examples

### Submit One Event

```http
POST /events
Content-Type: application/json

{
  "events": [
    {
      "version": 1,
      "id": "5b0b000dc2377e137aeaab36f7a5e2f82de104f1dac38162b08efe1bf7d71139",
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
      "content": "# Hello Murm\n\nA signed publication.",
      "signature": "40adfc83597064286dd51ad195ca613a444b6f9ca8e554da58d0d1c4ae4f10427719c8f941c87a7b8d2b12e0c84bfb80e23f198d20a3c7cefaa68e4612227b03"
    }
  ]
}
```

### Publications by One Author

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
          "value": "d75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a"
        }
      ]
    }
  ],
  "limit": 20,
  "cursor": null
}
```

### Publications Containing a Topic

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
          "path": "/header/topics",
          "op": "contains",
          "value": "protocol"
        }
      ]
    }
  ],
  "limit": 20
}
```

### Comments for a Publication

```json
{
  "where": [
    {
      "all": [
        {
          "path": "/kind",
          "op": "eq",
          "value": 2
        },
        {
          "path": "/header/root/author",
          "op": "eq",
          "value": "d75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a"
        },
        {
          "path": "/header/root/document",
          "op": "eq",
          "value": "4f5f4c6b5e897c32217a32097510c8d67491c7c9200f2af22c568a5dc2363742"
        }
      ]
    }
  ],
  "sort": [
    {
      "path": "/created_at",
      "direction": "asc"
    }
  ],
  "limit": 100
}
```

### Reactions Targeting an Event

```json
{
  "where": [
    {
      "all": [
        {
          "path": "/kind",
          "op": "eq",
          "value": 3
        },
        {
          "path": "/header/target/type",
          "op": "eq",
          "value": "event"
        },
        {
          "path": "/header/target/id",
          "op": "eq",
          "value": "5ba0981c33f11bc38a87c19c18a39a9534ed6141e5e85f9a73376dd55c1de594"
        }
      ]
    }
  ],
  "limit": 100
}
```

### Publication Revision History

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
          "value": "d75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a"
        },
        {
          "path": "/header/document",
          "op": "eq",
          "value": "4f5f4c6b5e897c32217a32097510c8d67491c7c9200f2af22c568a5dc2363742"
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
  "limit": 100
}
```

### Two OR Branches

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
          "path": "/header/language",
          "op": "eq",
          "value": "pt-BR"
        }
      ]
    },
    {
      "all": [
        {
          "path": "/kind",
          "op": "eq",
          "value": 1
        },
        {
          "path": "/header/language",
          "op": "eq",
          "value": "en"
        }
      ]
    }
  ],
  "limit": 20
}
```

### Next Page

```json
{
  "where": [
    {
      "all": [
        {
          "path": "/kind",
          "op": "eq",
          "value": 1
        }
      ]
    }
  ],
  "limit": 20,
  "cursor": "<opaque-cursor-from-page.next>"
}
```

## Validation

Relays validate request envelopes before storage or query work. Event
submission then applies MIP-01, MIP-02, and the known kind MIP.

Query validation rejects:

- empty groups or conditions;
- excessive groups, conditions, sort fields, or result limits;
- malformed JSON Pointers;
- unknown or non-indexed paths;
- incompatible operators and values;
- sort fields not declared sortable;
- cursors that are malformed, expired, or bound to another query.

Protocol request failures use the first applicable row below. Relay protection
may instead fail early with `policy_rejected`, `rate_limited`, or
`temporarily_unavailable`.

| Order | Condition | Code |
| ---: | --- | --- |
| `1` | Missing, unsupported, or inconsistent request media type | `unsupported_media_type` |
| `2` | Decoded batch or query body exceeds its advertised byte limit | `content_too_large` |
| `3` | JSON syntax, encoding, duplicate-name, or Unicode failure prevents parsing the request | `invalid_json` |
| `4` | Closed-object, required-member, member-type, JSON Pointer syntax, operator-value, or sort-composition failure | `invalid_request` |
| `5` | Group, condition, value-list, sort-field, result, or cursor-byte limit is exceeded | `limit_exceeded` |
| `6` | A filter or sort path is undeclared, unindexed, unsortable, or does not support the requested operator | `unsupported_filter` |
| `7` | A cursor is malformed, expired, or bound to another query | `invalid_cursor` |
| `8` | An event ID in the request path is not lowercase 32-byte hexadecimal | `invalid_id` |
| `9` | A valid requested event ID is unavailable | `not_found` |

### HTTP Errors

Request-level failures use RFC 9457 Problem Details with
`Content-Type: application/problem+json`.

```json
{
  "type": "https://github.com/mi66mc/mips/blob/main/mips/MIP-03.md#problem-unsupported_filter",
  "title": "Unsupported filter",
  "status": 422,
  "detail": "The requested path is not indexed by this relay.",
  "code": "unsupported_filter",
  "pointer": "/where/0/all/1/path"
}
```

Stable codes are:

```text
invalid_json
invalid_request
invalid_event
invalid_id
invalid_signature
unsupported_version
unsupported_kind
unsupported_filter
invalid_cursor
limit_exceeded
content_too_large
unsupported_media_type
not_found
policy_rejected
rate_limited
temporarily_unavailable
```

For every code, the problem `type` is:

```text
https://github.com/mi66mc/mips/blob/main/mips/MIP-03.md#problem-<code>
```

The `code` member MUST equal `<code>`. For request-level failures, both the HTTP
status and the problem `status` member MUST equal the status assigned below.
`pointer`, when present, is an RFC 6901 JSON Pointer into the request. Clients
use `type` or `code` as the machine-readable identifier and MUST NOT depend on
`title` or `detail`.

| Code | Title | Status |
| --- | --- | ---: |
| `invalid_json` | Invalid JSON | `400` |
| `invalid_request` | Invalid request | `400` |
| `invalid_event` | Invalid event | `422` |
| `invalid_id` | Invalid event ID | `400` |
| `invalid_signature` | Invalid signature | `422` |
| `unsupported_version` | Unsupported version | `422` |
| `unsupported_kind` | Unsupported kind | `422` |
| `unsupported_filter` | Unsupported filter | `422` |
| `invalid_cursor` | Invalid cursor | `422` |
| `limit_exceeded` | Protocol limit exceeded | `422` |
| `content_too_large` | Content too large | `413` |
| `unsupported_media_type` | Unsupported media type | `415` |
| `not_found` | Event not found | `404` |
| `policy_rejected` | Rejected by relay policy | `403` |
| `rate_limited` | Rate limited | `429` |
| `temporarily_unavailable` | Temporarily unavailable | `503` |

Relays SHOULD include `Retry-After` with `rate_limited` and
`temporarily_unavailable` when they can estimate a useful retry time.

Batch item failures use `SubmitResult.reason`, not separate HTTP responses.
After request parsing, event items use MIP-01's validation order and the most
specific applicable code: `content_too_large`, `unsupported_version`,
`invalid_event`, `invalid_id`, `invalid_signature`, `unsupported_kind`, or
`policy_rejected`.

## Relay Indexing

Relays MUST index the MIP-01 core paths and every MIP-04 path listed in this
MIP's operator tables.

Indexes MAY use any internal representation. Query results and comparison
semantics MUST remain independent of database-specific ordering, collation, and
identifiers.

Relays MAY advertise non-core query capabilities, but core clients MUST NOT
require them.

## Compatibility

A core-compatible relay implements every resource in this MIP, including
`QUERY /events` and `POST /events/query`.

Clients MAY cache exact `GET /events/{id}` responses indefinitely because
events are immutable. Query results represent a changing event set and SHOULD
NOT be reused as permanent snapshots without relay-provided cache metadata.

HTTP transport errors do not change event validity.

## Security Considerations

Relays SHOULD rate-limit submissions, queries, and failed validation attempts.
They SHOULD bound decoded request size, query complexity, response count,
cursor size, and cursor lifetime.

Cursors MUST NOT expose database IDs, SQL fragments, storage topology, or
unsigned client-controlled query state.

Problem details MUST NOT include stack traces, SQL, private moderation data, or
other implementation internals.

Browser-facing relays must account for CORS preflight because `QUERY` is not a
CORS-safelisted method. They include `QUERY` in
`Access-Control-Allow-Methods` when cross-origin access is allowed.

Clients MUST validate every returned event locally.
