# murm MIPs

This repository contains Murm Improvement Proposals (MIPs), the protocol
documents for the Murm Protocol.

murm is a local-first protocol for signed notes, public posts, and pseudonymous
publishing. Identity is based on cryptographic key pairs: a public key identifies
an author, and a private key signs events. Relays store and distribute signed
events, but they do not own user identity, passwords, or sessions.

## Protocol Shape

The core unit of the Murm Protocol is an `Event`.

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

At a high level:

- `id` identifies the exact event payload.
- `pubkey` identifies the author.
- `sig` proves that the author signed the event.
- `kind` defines how clients interpret the event.
- `tags` carry structured references and indexable metadata.
- `content` carries the main event body.

## Principles

- Local-first: clients can create, sign, store, and later sync events.
- Signed events: relays validate events, but do not authenticate users by login.

## Current MIPs

| MIP | Title | Status | Summary |
| --- | --- | --- | --- |
| [MIP-01](mips/MIP-01.md) | `event format` | `draft` | Defines the base event object and structural validation rules. |
| [MIP-02](mips/MIP-02.md) | `signatures` | `draft` | Defines canonical payloads, SHA-256 event ids, and Ed25519 signatures. |
| [MIP-03](mips/MIP-03.md) | `relay interface` | `draft` | Defines relay operations: `submit`, `fetch`, and `scan`. |
| [MIP-04](mips/MIP-04.md) | `event kinds` | `draft` | Defines initial event kinds: profile, post, comment, and reaction. |

## Reading Order

Start with:

1. [MIP-01](mips/MIP-01.md) for the event shape.
2. [MIP-02](mips/MIP-02.md) for ids and signatures.
3. [MIP-04](mips/MIP-04.md) for event semantics.
4. [MIP-03](mips/MIP-03.md) for relay behavior.

## Implementation Notes

A minimal implementation should be able to:

- build valid events;
- calculate event ids;
- sign events with Ed25519;
- verify event signatures;
- submit events to a relay;
- fetch events by id;
- scan events by filters.

Private keys must stay local to clients. Relays only receive public keys,
events, and signatures.

## Status Values

- `draft`: initial proposal under discussion.
- `accepted`: approved for implementation.
- `final`: stable and implemented by compatible software.
- `deprecated`: no longer recommended for new implementations.

## Conventions

The key words `MUST`, `MUST NOT`, `SHOULD`, `SHOULD NOT`, and `MAY` are used as
normative terms when describing protocol requirements.
