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

`GET /info` returns `200` with the following required fields. This is a complete
example for the `publications-test-v1` experimental profile from MIP-05.
The numbers are configurable relay policy, not universal protocol constants.

```json
{
  "protocol": "murm",
  "versions": [1],
  "profiles": ["publications-test-v1"],
  "accepted_kinds": [1],
  "validated_kinds": [1],
  "accept_unknown_kinds": false,
  "features": {
    "http_query": true,
    "post_query": true,
    "sync": true,
    "post_sync": true,
    "current_kinds": [1],
    "relay_announcements": false,
    "lookup": false
  },
  "limits": {
    "event_bytes": 1048576,
    "request_bytes": 1048576,
    "json_depth": 32,
    "query_bytes": 65536,
    "query_results": 100,
    "response_bytes": 4194304,
    "filters": 10,
    "header_conditions": 20,
    "filter_values": 100,
    "cursor_bytes": 4096,
    "query_cursor_seconds": 1800,
    "sync_cursor_seconds": 604800,
    "snapshot_events": 10000,
    "publication_states": 100000,
    "future_skew_seconds": 1800
  },
  "kind_policies": {
    "default": {
      "event_bytes": 1048576,
      "retention_seconds": 604800,
      "max_retention_seconds": 2592000
    },
    "overrides": [
      {
        "kind": 1,
        "event_bytes": 1048576,
        "retention_seconds": 2592000,
        "max_retention_seconds": 7776000
      }
    ]
  },
  "rate_limits": [
    {"operation": "publish", "scope": "ip", "requests": 60, "window_seconds": 60},
    {"operation": "query", "scope": "ip", "requests": 120, "window_seconds": 60},
    {"operation": "sync", "scope": "global", "requests": 600, "window_seconds": 60}
  ],
  "policies": {
    "early_removal": ["policy", "legal"],
    "description": "Public articles; local storage and bounded peer propagation."
  },
  "propagation": {
    "enabled": true,
    "max_peers": 2,
    "max_attempts": 6,
    "max_age_seconds": 3600,
    "queue_events": 1000,
    "seen_seconds": 86400
  },
  "header_filters": [
    {"kind": 1, "path": "/publication", "ops": ["eq"]},
    {"kind": 1, "path": "/revision", "ops": ["eq"]},
    {"kind": 1, "path": "/status", "ops": ["eq"]},
    {"kind": 1, "path": "/topics", "ops": ["contains"]},
    {"kind": 1, "path": "/language", "ops": ["eq"]}
  ]
}
```

`protocol` is `murm`; `versions` lists supported envelope versions.
`profiles` lists implemented experimental or accepted profiles, not a security
certification. Arrays of kinds contain unique non-negative safe integers.
`accepted_kinds` lists kinds allowed by admission policy. `validated_kinds`
is its subset for which full public kind validation is implemented.
An accepted kind outside that subset is opaque. `accept_unknown_kinds` controls
admission of kinds absent from `accepted_kinds`; it does not assign semantics.

The four method flags advertise the operations named by them. `current_kinds`
is the subset of `validated_kinds` that supports current-view selection and
pagination. `relay_announcements` controls `GET /relays` under MIP-06.
`lookup` controls explicit exact-ID assisted lookup; its additional budgets and
incomplete-search responses are outside the initial test profile.

All limits above are positive safe integers, except `future_skew_seconds`
which may be zero. `json_depth` counts the outermost JSON object/array as depth
1; scalars add no container level. `event_bytes` bounds the decoded UTF-8 event
as received. `request_bytes` bounds decoded bodies; query and sync requests
also obey `query_bytes`. `response_bytes` bounds successful JSON bodies after
serialization. An accepted event must fit a one-event response with metadata;
a relay must leave sufficient overhead or reject it before storing.

`filters` bounds filter objects; `header_conditions` bounds conditions in
each filter; `filter_values` bounds each kinds/signers array.
`query_results` bounds `limit` for both query and sync.
`cursor_bytes` bounds cursor UTF-8 length. `query_cursor_seconds` and
`sync_cursor_seconds` bound validity from issuance, not from `created_at`.
`snapshot_events` bounds one current-view snapshot; an oversized selection
returns `limit_exceeded`, never a silently truncated view.
`publication_states` bounds durable MIP-04 publication high-water records.
Reject a new publication with `limit_exceeded` if no state slot is available;
do not discard remembered withdrawals to admit another work.
`future_skew_seconds` is the maximum accepted future timestamp offset against
the relay's clock; a refusal is policy, not a signature failure.

`kind_policies.default` applies to all admitted kinds. Each unique override
has a required `kind` and replaces only its supplied policy fields. The effective
event size is the smaller of global `limits.event_bytes` and the kind limit.
The retention fields are non-negative safe integers or `null` and have the
meaning below. A finite maximum cannot be smaller than a finite default.
These values apply equally to raw and current views and to all ingress paths.

`policies.early_removal` contains unique values from `policy` and `legal`.
It declares exceptions to minimum retention, captured at admission.
Storage pressure is not an early-removal exception: refuse new storage instead.
`description` is human-readable text, not a substitute for structured policy.
Changing policy must not silently shorten existing commitments; a listed
exception can remove or stop serving an event early. Report `policy_rejected`
when refusing service for policy; do not claim the signature is invalid.

### Rate limits and propagation policy

Each rate rule has `operation` (`publish`, `fetch`, `query`, `sync`, `info`,
or `relays`), `scope` (`ip` or `global`), and positive safe integers `requests`
and `window_seconds`. Rules use fixed UTC-aligned windows:
`floor(unix_seconds / window_seconds)`. All matching rules apply.
Failed attempts count as requests too. QUERY and its POST alternative share
one operation budget; fallback cannot reset it. `fetch` includes lookup calls.

An omitted operation has no fixed advertised request quota; aggregate overload
controls still apply. `ip` means the connection's source IP, not an arbitrary
caller-supplied forwarding header. A deployment may use a trusted reverse
proxy to establish that IP. IP limits do not identify people or introduce login.

Return `429 rate_limited` with `Retry-After` in seconds until the blocking
window resets. If multiple rules block, use the longest applicable delay.
Temporary resource overload outside these quotas uses `503`.
Clients wait before retrying and do not switch HTTP aliases to evade limits.

`propagation` fields above are required when it is enabled.
They bound peers, total send attempts across peers, job lifetime, queued jobs,
and seen-ID memory. Values are non-negative safe integers; zero can disable
outbound work while retaining the declared feature. A full queue means no new
job is scheduled; it does not undo local storage. Retryable peer failures are
connection errors, `408`, `429`, and `5xx` responses, within the same finite
budget. Honor `Retry-After` and use increasing delays. A successful `201` or
`200 already_stored` completes that destination. Other `4xx` refusals are not
retried unchanged. Different peers' clocks and policies need not agree.

Announced policies are declarations, not proofs of honesty or unconditional
acceptance. Unknown response metadata remains extensible. Unknown request
members and unsupported filters still fail explicitly.

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


#### Retention lifecycle

Record the local admission time `a` durably when a new event is committed.
Effective `retention_seconds` gives the minimum promised duration. Return
`retain_until = a + retention_seconds`; `null` means no minimum promise.
Zero permits immediate expiration. Negative durations and timestamp overflow
are invalid configuration, not values to publish in `/info`.

`max_retention_seconds` is the upper bound for serving this admission locally;
`null` means no fixed upper bound, not an infinite minimum promise.
After the minimum deadline the relay may delete the content, or keep serving
it until the finite maximum. At that maximum it stops serving the content.
This does not promise deletion from third-party copies, user backups, or
anti-rollback metadata. Querying a retained edition remains possible even
after its publication has been withdrawn.

Both limits are fixed for that admission. There is no retention-request header,
signed TTL field, or renewal endpoint in this profile. A duplicate returns
the existing deadline without extending it. A new edition has its own admission
and deadline. After eviction, reaccepting an event starts a new admission;
the maximum is not a global lifetime for the signed event.

Persist content, admission sequence, and applicable publication preference
state atomically before `201`. Ordinary process restart must preserve acknowledged
events and commitments; host or disk loss cannot be prevented by this protocol.
The declared `early_removal` exceptions can override serving obligations.
Exhaustion of replication attempts cannot override them.

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

Query cursors expire at issuance plus the advertised query TTL, which is not
extended by reusing that cursor. Each next cursor has its own issuance time.
Persist raw cursor verification state across ordinary restart; a lost current
snapshot may return `cursor_expired`. A changed query, forged token, or marker
from a different relay returns `invalid_cursor`. Pagination
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

Persist admission ordering and sync cursor verification state across ordinary
restarts. A reset or history truncation that makes a marker unusable returns
`cursor_expired`. Expiration is issuance plus the advertised sync TTL.
A malformed, forged, or different-filter/relay token returns `invalid_cursor`,
not a marker for another subscription.

If any received event fails envelope, ID, or signature validation, reject that
response as an untrusted batch and do not save its cursor. After bounded
retries the receiver can stop that source and use another; it must not silently
skip cryptographically invalid input and claim a complete sync.
For cryptographically valid events refused by local policy or unsupported kind,
the receiver may record the decision and advance after processing the batch.
Apply implemented kind validation before storing a valid event or updating
publication preference state. A correctly signed event that fails known-kind
validation must never update that state. If the source advertises that kind as
validated, treat the response as an untrusted batch and do not save its cursor.
If the source only stores the kind opaquely, the receiver may record its local
semantic rejection and advance after processing the batch.
Temporary persistence failures must not advance the cursor; replay the batch.
The sender returns either a complete response within its limits or an HTTP
error, not a partial response with an ambiguous completion marker.

Response byte limits may produce fewer events than `limit`. Do not skip an
otherwise servable matching event merely because the current page is full;
continue from before that event on the next page. Query and sync continuation
must advance even across expired records and must never loop on an empty page.

To follow publications, subscribe using stable identity/type information, not
only a mutable topic or published-only status. Otherwise withdrawals and edits
that stop matching can be missed. MIP-06 uses the same sync for relay recovery.

### Failure classes and abuse controls

Distinguish invalid data, unsupported capability, local policy refusal, and
temporary overload. A valid event refused by one relay may be accepted elsewhere.

Use `429` for excessive requests, with `Retry-After` when an estimate exists,
as in [RFC 6585](https://www.rfc-editor.org/rfc/rfc6585.html#section-4).
Errors use [RFC 9457](https://www.rfc-editor.org/rfc/rfc9457.html)
Problem Details, `Content-Type: application/problem+json`, and these required
members: `type`, `title`, `status`, and `code`. `detail` is optional human text;
`pointer` is an optional JSON Pointer into the request. Clients branch on
`code`, never on translated prose. HTTP status and body `status` must agree.
The problem type is `urn:murm:problem:<code>`.

| Code | HTTP status | Meaning |
| --- | ---: | --- |
| `invalid_json` | 400 | Invalid JSON, duplicate members, or invalid Unicode. |
| `invalid_request` | 400 | Missing/unknown member, wrong request shape or value. |
| `invalid_event` | 422 | Envelope or implemented kind constraints fail. |
| `invalid_id` | 422 | An event's declared hash does not match its signed data. |
| `invalid_signature` | 422 | Signature verification fails. |
| `unsupported_version` | 422 | Envelope version not implemented. |
| `unsupported_kind` | 422 | Kind not accepted, including opaque-kind policy. |
| `unsupported_filter` | 422 | Header path or operator not advertised. |
| `unsupported_feature` | 422 | Explicit current view, lookup, or discovery not supported. |
| `invalid_cursor` | 400 | Malformed, forged, wrong relay, or wrong query/filter. |
| `cursor_expired` | 410 | Expired marker, discarded snapshot, or lost required history. |
| `limit_exceeded` | 422 | Query count/depth/limit or snapshot budget exceeded. |
| `content_too_large` | 413 | Body or event exceeds advertised decoded byte limit. |
| `unsupported_media_type` | 415 | Request body media type is absent or unsupported. |
| `not_found` | 404 | Valid exact ID is unavailable locally. |
| `policy_rejected` | 403 | Local policy refuses otherwise valid data or access. |
| `rate_limited` | 429 | Advertised request window exhausted. |
| `temporarily_unavailable` | 503 | Storage, capacity, or other transient failure. |

Malformed path IDs use `invalid_request`. Hash and signature failures are
distinct; calculate the hash before verifying the signature. Byte/overload
controls may reject before parsing. Otherwise validate media type, JSON,
request shape/version, envelope, ID, signature, implemented kind, then policy.
For multiple request defects use the first encountered in that order.
Unknown routes and unsupported HTTP methods use normal HTTP semantics.

```json
{
  "type": "urn:murm:problem:unsupported_filter",
  "title": "Unsupported filter",
  "status": 422,
  "code": "unsupported_filter",
  "detail": "The requested header path is not indexed.",
  "pointer": "/filters/0/header/0/path"
}
```

For `429` use the reset delay above. `503` SHOULD include `Retry-After` when
the relay can estimate recovery. No error proves global event absence.
If the HTTP stack rejects a request before Murm handles it, clients may receive
a generic HTTP error and must not assume a Problem Details body exists.

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

Before accepting this MIP, implementations must demonstrate:

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

The initial publication-test contract above is concrete. Complete the optional
lookup budget/result format and signed relay-discovery schema with MIP-06.
Validate these experimental choices against restart, eviction, overload, and
concurrent updates before accepting a general-purpose compatibility profile.
