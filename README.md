# Murm Protocol MIPs

This repository contains Murm Improvement Proposals: the normative documents,
schemas, and test vectors for the Murm Protocol.

It specifies a protocol. It does not yet contain a relay or client
implementation.

## What Murm Is

Murm is a local-first protocol for immutable signed events, versioned public
documents, and future encrypted communication.

Identity is cryptographic:

- a public key identifies an author;
- a private key remains on the client;
- every event carries a verifiable signature;
- relays store and query events without owning user accounts;
- the protocol has no login, password, session, JWT, or identity server.

Relays remain untrusted. Clients can create, sign, store, and validate events
locally before synchronizing them.

## Event Model

```ts
type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue }

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

The fixed envelope is shared by every event.

- `header` contains public metadata needed for validation, relationships,
  routing, and indexed queries.
- `content` contains the kind-specific body.
- The MIP that owns `kind` defines the exact schema of both.

There are no positional event tags. Event kinds are allocated only through
MIPs and recorded in the [kind registry](mips/KIND-REGISTRY.md).

## IDs and Signatures

The unsigned payload is:

```text
[
  version,
  author,
  signer,
  authorization,
  created_at,
  kind,
  header,
  content
]
```

Objects use [RFC 8785 JSON Canonicalization](https://www.rfc-editor.org/rfc/rfc8785).

```text
id = lowercase_hex(SHA-256(canonical_payload_bytes))
signature = lowercase_hex(Ed25519_sign(private_key, raw_id_bytes))
```

The committed [test vectors](test-vectors/mip-02-event-v1.json) allow
independent implementations to verify that they produce identical results.

## Versioned Documents

Events are always immutable. Profiles and publications form documents through
signed revision events:

```ts
type DocumentHeader = {
  document: string
  revision: number
  previous: string | null
}
```

A document keeps a stable identity while every revision retains its own event
ID and signature.

## Initial Event Kinds

| Kind | Name | Model | Purpose |
| ---: | --- | --- | --- |
| `0` | `profile` | versioned document | Public author metadata |
| `1` | `publication` | versioned document | Short posts and long-form Markdown |
| `2` | `comment` | immutable event | Replies to a publication discussion |
| `3` | `reaction` | immutable event | Reactions to events or documents |

Short posts and long articles intentionally use the same publication kind.

## Relay HTTP Interface

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/info` | Discover versions, MIPs, limits, and features |
| `POST` | `/events` | Submit one or more signed events |
| `GET` | `/events/{id}` | Fetch one immutable event |
| `QUERY` | `/events` | Run a safe, structured event query |
| `POST` | `/events/query` | Compatibility fallback for `QUERY` |
| `OPTIONS` | `/events` | Discover query support |

`QUERY` is the safe and idempotent method defined by
[RFC 10008](https://www.rfc-editor.org/rfc/rfc10008).

Example:

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
  "sort": [
    {
      "path": "/created_at",
      "direction": "desc"
    }
  ],
  "limit": 20
}
```

Query groups are `OR`; conditions inside `all` are `AND`. Relays only expose
core fields and header paths declared indexable by kind MIPs. Core queries never
inspect event content.

## Current MIPs

| MIP | Title | Status |
| --- | --- | --- |
| [MIP-00](mips/MIP-00.md) | MIP process | `draft` |
| [MIP-01](mips/MIP-01.md) | Event format | `draft` |
| [MIP-02](mips/MIP-02.md) | Event IDs and signatures | `draft` |
| [MIP-03](mips/MIP-03.md) | Relay HTTP interface | `draft` |
| [MIP-04](mips/MIP-04.md) | Initial event kinds | `draft` |
| [MIP-05](mips/MIP-05.md) | Core compatibility profile | `draft` |

## Reading Order

1. [MIP-00](mips/MIP-00.md) for governance and allocations.
2. [MIP-01](mips/MIP-01.md) for the event envelope.
3. [MIP-02](mips/MIP-02.md) for IDs and signatures.
4. [MIP-04](mips/MIP-04.md) for initial event semantics.
5. [MIP-03](mips/MIP-03.md) for relay behavior.
6. [MIP-05](mips/MIP-05.md) for core compatibility.

## Normative Artifacts

- [JSON Schemas](schemas/) define structural request and event validation.
- [Cryptographic test vectors](test-vectors/mip-02-event-v1.json) define
  language-independent canonical IDs and signatures.
- [Vector generator and tests](tools/) reproduce those expected values using
  Node.js built-ins.

## Implementation Baseline

A minimal implementation can:

1. build a version 1 event;
2. canonicalize its unsigned payload;
3. calculate and sign its ID;
4. validate received events locally;
5. resolve versioned document revisions;
6. submit and fetch relay events;
7. execute bounded structured queries;
8. reproduce every normative test vector.

Private keys never leave clients.

## Status Values

- `draft`: under active design.
- `accepted`: approved for compatible implementations.
- `final`: stable and implemented.
- `deprecated`: retained but not recommended.
- `rejected`: intentionally not adopted.

The normative words `MUST`, `MUST NOT`, `SHOULD`, `SHOULD NOT`, and `MAY`
describe protocol requirements.
