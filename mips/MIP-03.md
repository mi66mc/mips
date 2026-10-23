# MIP-03: Relay HTTP Interface

Status: `draft`

## Kind Allocation

This MIP allocates no event kind.

## Abstract

The HTTP interface publishes, retrieves, queries, and synchronizes signed events
without protocol accounts. Local storage, replication, and assisted lookup are
different operations with different guarantees.

## Motivation

Clients should be portable between relays. A relay may restrict its resources
but must not silently change filters, invent delivery guarantees, or make local
absence look like proof of global absence.

## Specification

### Operations and representation

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/events` | Submit one complete signed event. |
| `GET` | `/events/{id}` | Fetch one locally available event. |
| `QUERY` | `/events` | Filter local events. |
| `POST` | `/events/query` | Compatibility form of the same query. |
| `QUERY` | `/events/sync` | Follow the relay's local admission stream. |
| `POST` | `/events/sync` | Compatibility form of synchronization. |
| `GET` | `/info` | Discover capabilities, limits, and policies. |
| `GET` | `/relays` | Obtain public signed relay announcements under MIP-06. |
| `GET` | `/events/{id}?lookup=true` | Explicit, optional, bounded assisted lookup. |

There is no login, registration, session, API token, `PUT` update, or `forward`
operation. The body of `POST /events` is the event itself, not a batch wrapper.

Request bodies and successful JSON responses use UTF-8 and
`Content-Type: application/json`. JSON input follows MIP-01. Implementations
bound compressed input, decompressed bytes, parse depth, and response size.

Query, synchronization, filter, and condition request objects are closed:
unknown members are rejected. Response metadata is extensible; clients may
ignore unknown response metadata, but MUST preserve and verify complete events.

`QUERY` follows [RFC 10008](https://www.rfc-editor.org/rfc/rfc10008.html).
Its POST alternative has identical query and cursor semantics. Clients may
use the alternative when the method is rejected by their HTTP stack or an
intermediary, or receives `405`/`501`. They MUST NOT treat a semantic validation
error as a reason to bypass validation through the other endpoint.

Browser-facing relays need appropriate CORS configuration for the methods and
headers they offer. Additional standard HTTP methods do not alter Murm semantics.

### Capabilities and policy

`GET /info` returns `200`. This partial example fixes the names already used in
the design; it is not the complete capabilities wire format:

```json
{
  "versions": [1],
  "validated_kinds": [1],
  "accept_unknown_kinds": true,
  "limits": {
    "event_bytes": 1048576,
    "query_results": 100
  },
  "header_filters": [
    {"kind": 1, "path": "/publication", "ops": ["eq"]},
    {"kind": 1, "path": "/topics", "ops": ["contains"]},
    {"kind": 1, "path": "/language", "ops": ["eq"]}
  ]
}
```

The numbers are example relay policy, not universal protocol constants.
A kind may only be advertised as validated when its complete semantics are
implemented; the partial publication profile in this draft still needs the
MIP-04 decisions closed before such a claim is interoperable.

The complete announcement must also identify current-view kinds, lookup
support and budgets, retention, supported methods, synchronization, and resource
limits. Those additional field names remain open; clients cannot infer them
from `validated_kinds` or mere storage of a kind.

Announced limits describe capacity, not unconditional acceptance. Load,
moderation, storage pressure, and other local policy can still cause refusal.
A relay MUST distinguish opaque kind acceptance from semantic validation.

### Publication and retention

`POST /events` accepts one full event, verifies it, and applies local policy.
It does not require the connection's caller to be the signer.

For a new event accepted and stored:

```http
HTTP/1.1 201 Created
Location: /events/945708370d265a3825922c890b2ac7f09fb0d5a68fa5e12e9b768ec0e3790791
Content-Type: application/json
```

```json
{
  "id": "945708370d265a3825922c890b2ac7f09fb0d5a68fa5e12e9b768ec0e3790791",
  "status": "stored",
  "retain_until": 1800000000
}
```

For a valid duplicate still stored, return `200`:

```json
{
  "id": "945708370d265a3825922c890b2ac7f09fb0d5a68fa5e12e9b768ec0e3790791",
  "status": "already_stored",
  "retain_until": 1800000000
}
```

`retain_until` is the relay's declared retention deadline in Unix seconds.
`null` means no minimum retention promise, not forever. A dishonest or failed
relay can violate its promise; an acknowledgement is not a cryptographic proof
of future storage.

Duplicate submission does not automatically renew retention, add another
admission, or restart propagation. Reformatting equivalent JSON is not a new
event. Even a duplicate submission must pass event validation.

A seen-ID record without the content is not `already_stored`. If the relay
accepts and stores a previously evicted event again, it is a new local admission.

The acknowledgement confirms local storage only. It does not confirm replicas,
recipient delivery, or reading. Insufficient storage must cause refusal before
acknowledgement. Propagation exhaustion does not reverse a local storage success.
Automatic propagation and duplicate suppression follow MIP-06.

### Exact retrieval and assisted lookup

`GET /events/{id}` returns the full signed event with `200` when locally
available. Malformed IDs fail explicitly; a valid ID unavailable here returns
`404`. The client MUST independently verify the event.

The default request performs no network search. `lookup=true` explicitly asks
for MIP-06 bounded lookup if enabled. Disabled lookup returns an explicit error,
not a silent local-only answer. Queries and sync never acquire lookup behavior.

Exact copies may be cached and verified locally. Neither an old cached copy nor
a successful fetch proves present relay retention or the current state of a
publication.

### Query shape

```ts
type HeaderCondition = {
  path: string
  op: "eq" | "contains"
  value: JsonValue
}

type Filter = {
  kinds?: number[]
  signers?: string[]
  since?: number
  until?: number
  header?: HeaderCondition[]
}

type EventQuery = {
  filters: Filter[]
  limit: number
  cursor?: string | null
  view?: "current"
}
```

Concrete query defaults in this rewrite:

- `filters` is a non-empty array; `[{}]` explicitly requests all locally
  queryable events, subject to policy. An empty `filters` array is invalid.
- If present, `kinds` and `signers` are non-empty arrays of valid values.
- `since` and `until` are non-negative safe-integer timestamps; when both are
  present, `since` must be less than `until`.
- `header`, if present, is a non-empty array of conditions.
- `limit` is a required positive safe integer within the advertised result limit.
- `cursor` is omitted or `null` for the first page.
- `view` is omitted for raw events; the only defined explicit value is `current`.

All conditions inside one filter are ANDed. Filter objects are ORed.
Values within `kinds` or `signers` are alternatives. Matching several filters
does not duplicate an event in the result.

`since` is inclusive and `until` is exclusive, using the author's declared
`created_at`. They are not admission-time filters.

### Header filtering

`path` uses [RFC 6901 JSON Pointer](https://www.rfc-editor.org/rfc/rfc6901.html),
relative to `header`. `/topics` addresses `header.topics`, not a top-level field
and not `header.header.topics`.

- `eq` is exact typed JSON equality without string/number coercion.
- Structured equality compares JCS representations.
- `contains` is exact membership of an array, not substring or full-text search.
- Missing fields do not match, including `eq` with `null`.
- A present `null` can equal `null`.
- An incompatible field type does not match; an unsupported requested
  path/operator combination rejects the whole request.

A filter using header conditions must explicitly restrict `kinds` to kinds
for which every requested path/operator is advertised. This avoids ambiguous
cross-kind interpretation. Unsupported conditions MUST NOT be ignored, dropped
from an OR branch, or replaced by an unbounded scan.

The core interface does not search `content`, including encrypted plaintext.
It defines no arbitrary sorting or additional legacy operators.

### Ordering and raw pagination

This rewritten draft chooses `created_at` descending, then hexadecimal ID
descending, for raw and current query results. This resolves the previously
open generic-query tie direction; it is not proof of chronological creation.

A successful query returns:

```ts
type QueryResponse = {
  events: Event[]
  next_cursor: string | null
}
```

`next_cursor: null` means the traversal has ended. A non-null cursor is opaque,
bound to that relay and the canonical request with `cursor` omitted, including
filters, limit, and view. Reuse with a different query is invalid.

Raw queries use live keyset continuation: return matching events strictly after
the previous sort boundary. New arrivals before that boundary are missed by
this traversal; later ones can appear. Removed events disappear. Results do
not form a fixed snapshot, and IDs already passed do not repeat.

Expired cursors fail explicitly; they MUST NOT silently restart. Pagination
does not replace the admission-based synchronization operation.

### Current view

`view: current` is optional per kind and must be advertised. Every filter must
explicitly list supported kinds in this mode. A requested unsupported kind
rejects the query rather than falling back to raw results.

For each supported logical publication, first choose the preferred valid
revision using its MIP, then apply the result filters. No filter, including
status, topic, revision, or date, may eliminate a newer revision before this
selection and thereby resurrect an older matching one.

A withdrawn preferred revision is returned unless the filters exclude it.
A published-only filter excludes that publication; it does not return an older
published revision. Raw queries and exact retrieval remain available.

The draft chooses a first-page snapshot of selected current-event IDs for
current-view pagination. New revisions belong to a new traversal. If a selected
event is no longer servable, omit it, never substitute another revision.
Cursors must advance through omitted positions; bounded snapshot expiration
returns an explicit cursor error. A relay unable to provide this behavior must
not advertise current-view pagination.

MIP-04's retention/anti-rollback requirement also applies before selection.
Snapshotting is not permission to forget a known withdrawal and call a lower
retained revision current in a later traversal.

This is a local projection, not a claim to know the global newest revision.

### Synchronization

Both sync methods accept:

```ts
type SyncRequest = {
  filters: Filter[]
  cursor: string | null
  limit: number
}

type SyncResponse = {
  events: Event[]
  cursor: string
  has_more: boolean
}
```

Filters have the same meaning and validation as ordinary query filters.
`view` is not a sync option. `cursor: null` starts from the matching retained
history available in the relay's local admission stream.

The stream is ordered by local admission, not `created_at`. It therefore includes
old events that arrive late. The order and cursor are local metadata outside
the event signature.

- `has_more: true` means continue immediately from the returned cursor.
- `has_more: false` means caught up at that instant; keep the returned cursor
  for later polling.
- A repeated submission while stored is not a new admission.
- An evicted event accepted again is a new admission; consumers deduplicate IDs.
- A marker is scoped to the relay and filters. A batch limit may change between
  sync requests without changing the subscription.
- An expired or invalidated history marker returns `cursor_expired`. Restart
  from retained history and deduplicate; do not jump silently to the present.
- The marker can advance over non-matching or no-longer-retained records.
  Empty batches may therefore still advance it.

Clients validate and process the batch, persist accepted events, and only then
save the returned marker. After interruption they may safely replay a batch.

Rejected or malformed peer events require a local bounded quarantine/skip
policy; they must not be stored as valid. A receiver that elects to stop must
not save the next marker. Exact interoperable error/recovery signaling for such
batches remains an open decision.

To follow publications, subscribe using stable identity/type information, not
only a mutable topic or published-only status. Otherwise withdrawals and edits
that stop matching can be missed. MIP-06 uses the same sync for relay recovery.

### Failure classes and abuse controls

Distinguish invalid data, unsupported capability, local policy refusal, and
temporary overload. A valid event refused by one relay may be accepted elsewhere.

Use `429` for excessive requests, with `Retry-After` when an estimate exists,
as in [RFC 6585](https://www.rfc-editor.org/rfc/rfc6585.html#section-4).
The code `cursor_expired` is reserved for an unusable sync history marker.
The remaining error envelope and code-to-status table are not frozen yet.

Do not impose mandatory login, CAPTCHA, payment, or proof of work in this core.
Combine per-origin controls with aggregate storage, CPU, request, bandwidth,
queue, and query-complexity budgets. Keys are cheap to create; IPs can represent
many people. Neither is a reliable one-person quota.

## Canonical Examples

### Articles by one signer, topic, and language

The kind is the current draft publication reservation. The header fields require
support advertised by the relay.

```json
{
  "filters": [{
    "kinds": [1],
    "signers": ["d75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a"],
    "since": 1710000000,
    "until": 1720000000,
    "header": [
      {"path": "/topics", "op": "contains", "value": "tecnologia"},
      {"path": "/language", "op": "eq", "value": "pt-BR"}
    ]
  }],
  "limit": 20
}
```

### Raw revision history

```json
{
  "filters": [{
    "kinds": [1],
    "signers": ["d75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a"],
    "header": [{"path": "/publication", "op": "eq", "value": "artigo-123"}]
  }],
  "limit": 20
}
```

Adding `view: current` requests the preferred revision only. Adding a `/revision`
equality condition without a view searches that historical revision number;
concurrent events may share that number. An exact ID identifies one edition.

### Empty query result

```json
{"events": [], "next_cursor": null}
```

### Start a sync that includes withdrawals

```json
{
  "filters": [{
    "kinds": [1],
    "signers": ["d75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a"]
  }],
  "cursor": null,
  "limit": 100
}
```

Illustrative caught-up response; the cursor string is a placeholder:

```json
{"events": [], "cursor": "<relay-and-filter-bound-marker>", "has_more": false}
```

## Validation

Before accepting this MIP, implementations must agree on the complete error and
capability formats and demonstrate:

- New storage versus valid duplicate, including equivalent JSON formatting.
- Refusal before acknowledging unavailable storage.
- AND/OR, typed equality, missing versus null, and inclusive/exclusive time bounds.
- Explicit rejection of unsupported filters, kinds in current view, and lookup.
- Local-only reads without explicit lookup.
- Current selection before filtering, conflicts, withdrawal, and retention loss.
- Cursor binding, expiry, empty batches, and concurrent arrivals.
- Late old events visible to sync despite being missed by raw pagination.
- Identical results and cursor meanings through both HTTP method forms.

## Relay Indexing

Indexing strategy is local. Externally visible semantics must match these
filters, the kind MIP, and advertised capabilities. No database collation may
introduce implicit case folding or other equality changes.

## Compatibility

This replaces the previous `where/all/sort` query language, batch publication,
and `page.next` responses. Supporting that earlier draft requires an explicit
separate compatibility interface, not silently accepting ambiguous objects.

The optional current view and lookup are independently advertised. No accepted
minimum profile exists until the open decisions in MIP-05 are resolved.

## Security Considerations

Returned events and announcements are untrusted until verified. Cursors must
not expose SQL, internal topology, or secrets. Error messages must not expose
private policy records, stack traces, or key material.

Searches reveal interests to the contacted relay; lookup reveals a requested ID
to additional peers. Signed events provide no completeness proof. Resource
limits mitigate work amplification but cannot guarantee survival of a network
link saturated by an attacker.

## Open Decisions

Freeze the complete `/info` vocabulary, error envelope/status table, retention
renewal and exceptions, query/sync/cursor budget descriptors, and failure
handling for partially processable sync batches. Validate the draft pagination
choices under concurrent updates and eviction. These are protocol decisions,
not missing implementation tasks to be guessed by clients.
