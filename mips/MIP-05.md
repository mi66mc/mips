# MIP-05: Core Compatibility Profile

Status: `draft`

## Kind Allocation

This MIP defines a compatibility profile and allocates no event kind.

## Abstract

This MIP defines the minimum behavior required for a relay to claim Murm core
version 1 compatibility.

Compatibility describes protocol behavior, not relay policy. A relay can refuse
an otherwise valid event for operational reasons without redefining its
cryptographic validity.

## Motivation

Clients cannot publish, synchronize, or discover data reliably when every relay
uses a different envelope, kind schema, query language, or authentication
model. A compatibility profile creates a portable baseline while leaving
storage policy, moderation, and deployment choices local to each relay.

## Specification

### Required MIPs

A core version 1 relay implements:

- MIP-01: event envelope version 1;
- MIP-02: canonical IDs and direct Ed25519 signatures;
- MIP-03: relay HTTP interface;
- MIP-04: kinds `0` through `3`;
- MIP-05: this compatibility profile.

MIP-00 governs proposal and allocation documents but adds no relay operation.

### Required Event Kinds

A compatible relay understands and validates:

| Kind | Name |
| ---: | --- |
| `0` | `profile` |
| `1` | `publication` |
| `2` | `comment` |
| `3` | `reaction` |

It MAY store unknown kinds as opaque events after core envelope, ID, and
signature validation. It MUST NOT claim to understand their semantics.

### Required HTTP Interface

A compatible relay exposes:

```text
GET     /info
POST    /events
GET     /events/{id}
QUERY   /events
POST    /events/query
OPTIONS /events
OPTIONS /events/{id}
```

It MUST support RFC 10008 `QUERY` and the MIP-03 `POST /events/query`
compatibility fallback with identical result semantics.

### Relay Discovery

`GET /info` MUST advertise:

- event envelope version `1`;
- implemented MIPs;
- the version 1 event limit of exactly 2 MiB;
- a batch limit of at least 1 event;
- exactly 10 query groups in version 1;
- exactly 20 conditions per query group in version 1;
- a query result limit of exactly 100 in version 1;
- `http_query: true`;
- `post_query_fallback: true`.

Advertised limits are promises to accept requests within those bounds, subject
to rate limits and local policy. Increasing a fixed version 1 limit requires a
future protocol version and an explicit client opt-in.

### Event Validity

Core version 1 validity requires:

1. a valid MIP-01 envelope;
2. `signer == author`;
3. `authorization == null`;
4. a correct MIP-02 ID;
5. a valid Ed25519 signature over the raw ID;
6. valid MIP-04 header and content for known core kinds.

For nested comments, a missing parent is an unresolved synchronization state,
not immediate invalidity. A relay MUST re-evaluate the comment when the parent
arrives and MUST exclude it from core kind `2` query results if the available
parent has another kind or root.

Transport authentication, IP addresses, API keys, and relay-local identities
are not proof of event authorship.

### No Protocol Login

A compatible relay MUST NOT require an email address, password, account,
session, JWT, API key, or other login credential as part of the Murm protocol
operations.

Relays MAY apply transport-level abuse controls. Such controls MUST NOT change
the event envelope or authorship rules.

### Submission and Storage

A compatible relay:

- processes every event in a valid batch independently;
- stores valid events idempotently by `id`;
- returns `duplicate` for repeated valid IDs;
- never replaces stored bytes for one ID with different bytes;
- returns stable rejection reasons;
- distinguishes protocol invalidity from local policy refusal.

### Query Behavior

A compatible relay:

- supports every MIP-01 core indexed path;
- supports every MIP-04 indexed and sortable path;
- rejects unknown paths rather than silently scanning them;
- never exposes `/content` through core filtering;
- implements MIP-03 `AND`/`OR` semantics and operators;
- uses deterministic ordering with `/id` as the final tie-breaker;
- returns opaque, query-bound cursors;
- returns no more than 100 events per page.

### Errors

Request-level failures use RFC 9457 Problem Details and the stable MIP-03 error
codes. Batch item failures use `SubmitResult.reason`.

Error responses MUST NOT expose private keys, database identifiers, SQL,
cursor internals, storage topology, stack traces, or private moderation data.

### Relay Policy

A relay MAY refuse to store or return an otherwise valid event for:

- rate limiting;
- storage limits;
- abuse prevention;
- moderation;
- legal obligations;
- local kind policy;
- temporary operational failure.

Refusal does not make the event cryptographically invalid. Relays SHOULD report
the applicable stable policy or operational reason.

## Canonical Examples

A minimum-compatible discovery response is:

```json
{
  "protocol": "murm",
  "versions": [1],
  "mips": [1, 2, 3, 4, 5],
  "limits": {
    "event_bytes": 2097152,
    "batch_events": 1,
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

A policy refusal inside a valid batch can return:

```json
{
  "results": [
    {
      "id": "5b0b000dc2377e137aeaab36f7a5e2f82de104f1dac38162b08efe1bf7d71139",
      "accepted": false,
      "status": "rejected",
      "reason": "policy_rejected"
    }
  ]
}
```

The same event can remain valid according to MIP-01, MIP-02, and MIP-04.

## Validation

An implementation claiming core version 1 compatibility MUST satisfy:

1. MIP-02 ID, signature, and rejection rules;
2. MIP-04 validation rules for the four initial kinds;
3. single and batch submission, including duplicates and mixed results;
4. immutable fetch, ETag, and conditional fetch;
5. identical queries through `QUERY` and the fallback;
6. every required filter operator and path;
7. ordering ties and cursor continuation;
8. RFC 9457 errors for invalid requests;
9. absence of protocol login requirements.

A relay that fails any required item MUST NOT claim core version 1
compatibility.

## Relay Indexing

The compatibility profile requires all indexable and sortable paths listed by
MIP-01, MIP-03, and MIP-04.

Internal indexes are implementation details. A relay may use SQL, key-value,
document, or in-memory storage if externally visible query behavior remains
compatible.

## Compatibility

This profile is itself a draft while its required MIPs remain drafts. Production
software SHOULD state that compatibility is experimental until the required
MIPs are accepted.

A relay MAY advertise additional MIPs and features. Extensions MUST NOT alter
core behavior for clients that only use this profile.

Relays that require protocol login, omit a required kind, or replace `QUERY`
semantics with a different filter language are not core-compatible.

## Security Considerations

Compatibility does not require a relay to store spam, abusive traffic, or
illegal content.

Relays SHOULD enforce body, query, rate, cursor, and response limits before
performing expensive work.

Clients SHOULD publish important events to more than one relay and MUST verify
events locally. A compatible relay remains an untrusted transport and store.
