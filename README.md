# Murm Protocol MIPs

Murm is a decentralized, local-first protocol for immutable signed events.
Clients publish to relays; relays store, serve, and may propagate events;
other clients retrieve and verify them later.

There is no protocol login, central identity server, or mandatory direct
connection between users. Each MIP defines its kinds and application semantics.

This repository contains **specification drafts, not a relay or client
implementation**. The October 2026 redesign is now reflected in the MIPs.
It replaces the earlier experimental draft and is not wire-compatible with it.

For a Portuguese explanation of the design, examples, and remaining decisions,
see [the architecture overview](ARCHITECTURE-DRAFT.md). For protocol rules,
start with [the MIP index](mips/README.md).

## Trust and limits

- Signatures verify integrity and control of the signing key, not content truth.
- Relays can reject, omit, delete, censor, or stop serving data.
- Local storage confirmation does not prove replication, delivery, or retention.
- Replaceable relays and apps reduce dependence on one operator.
- Availability still requires a reachable copy.
- HTTPS, alternate contacts, and optional user VPN/proxy use do not solve all
  provider or government blocking.

No complete private-messaging cryptographic profile or strong anti-blocking
transport is claimed yet. See the [readiness table](mips/MIP-05.md#draft-readiness).

## Event model

```ts
type JsonValue =
  | null | boolean | number | string
  | JsonValue[]
  | { [key: string]: JsonValue }

type Event = {
  version: 1
  id: string
  signer: string
  created_at: number
  kind: number
  header: { [key: string]: JsonValue }
  content: JsonValue
  signature: string
}
```

Exactly these eight top-level fields are allowed in version 1. `header` is
public, structured metadata; `content` is a JSON value defined by the kind.
No universal attachment, recipient, device, or delegation field is imposed.

```text
unsigned = { version, signer, created_at, kind, header, content }
raw_id = SHA256(UTF8(JCS(unsigned)))
id = lowercase_hex(raw_id)
signature = lowercase_hex(Ed25519_sign(private_key, raw_id))
```

The hash input is an object, not an array. Ed25519 signs the raw 32-byte digest,
not the hex string or a second event serialization.
[MIP-02](mips/MIP-02.md) contains a complete recomputable example.

## HTTP interface

| Operation | Method and path |
| --- | --- |
| Publish one event | `POST /events` |
| Retrieve a local event | `GET /events/{id}` |
| Query local events | `QUERY /events` |
| Query compatibility form | `POST /events/query` |
| Follow local admissions | `QUERY /events/sync` |
| Sync compatibility form | `POST /events/sync` |
| Capabilities and policy | `GET /info` |
| Public relay contacts | `GET /relays` |
| Explicit optional exact-ID lookup | `GET /events/{id}?lookup=true` |

A new stored event returns `201` with `stored`. A valid duplicate still stored
returns `200` with `already_stored`. Responses declare `retain_until`; `null`
means no minimum promise. Duplicate submission does not renew retention or
restart propagation.

New accepted events enter bounded default propagation under relay policy.
There is no forwarding flag or user-facing replica-delivery report.

Example query body:

```json
{
  "filters": [{
    "kinds": [1],
    "header": [
      {"path": "/topics", "op": "contains", "value": "tecnologia"}
    ]
  }],
  "limit": 20
}
```

Conditions inside a filter are ANDed; filters are ORed. Header paths are relative
to `header` and must be supported by the relay. Replies contain full `events`
and `next_cursor`. Queries are local; only explicit supported exact-ID lookup
may ask other relays.

Sync follows local admission order, not author time. Its reply has `events`,
`cursor`, and `has_more`. Old events that arrive late can therefore be discovered.

## Publications and messages

Publications use full immutable revisions, identified by
`(signer, kind, publication)` in the current direct-signing draft.
Prefer the greatest revision, then greatest event ID. No predecessor chain is
required.

Withdrawal is another revision with `status: withdrawn` and `content: null`.
It changes current presentation, not the validity or availability of retained
history. `view: current` selects the preferred revision before filtering.

Private messages use their own MIP. The direction includes asynchronous signed
setup material, evolving session keys, and encrypted content, with sender and
recipient metadata visible. The exact cryptographic profile remains open.

## MIPs

| MIP | Responsibility | Status |
| --- | --- | --- |
| [MIP-00](mips/MIP-00.md) | Process, allocation, and evolution | `draft` |
| [MIP-01](mips/MIP-01.md) | Common event envelope | `draft` |
| [MIP-02](mips/MIP-02.md) | Canonical IDs and signatures | `draft` |
| [MIP-03](mips/MIP-03.md) | HTTP publication, query, sync, capabilities | `draft` |
| [MIP-04](mips/MIP-04.md) | Publications, revisions, and withdrawal | `draft` |
| [MIP-05](mips/MIP-05.md) | Compatibility, trust boundaries, and readiness | `draft` |
| [MIP-06](mips/MIP-06.md) | Relay discovery, propagation, recovery, lookup | `draft` |
| [MIP-07](mips/MIP-07.md) | Private-message architecture and security requirements | `draft` |
| [MIP-08](mips/MIP-08.md) | Portability and encrypted backup | `draft` |
| [MIP-09](mips/MIP-09.md) | Connectivity, privacy, and blocking resistance | `draft` |

See [KIND-REGISTRY.md](mips/KIND-REGISTRY.md) for draft and historical reservations.
Kind numbers do not imply behavior by range.

## Remaining work

The MIPs now contain the redesign, but important decisions are explicitly open:
identity/device lifecycle, publication content and current-state retention,
complete capability/error formats, relay-announcement authentication, the
private-message cryptographic profile, interoperable backup, and stronger
anti-blocking transports.

New concrete editorial choices in this rewrite are listed separately in the
[architecture overview](ARCHITECTURE-DRAFT.md#19-escolhas-concretas-desta-reescrita).
None of the MIPs is marked accepted or final. Do not treat architectural
agreement as a security review or a production interoperability claim.
