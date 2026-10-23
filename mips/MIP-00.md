# MIP-00: MIP Process

Status: `draft`

## Kind Allocation

This MIP allocates no event kind.

## Abstract

Murm Improvement Proposals define the common protocol and its extensible event
types. This MIP defines their structure, review, allocation, and evolution.

## Motivation

Applications need shared meanings for kinds without making the common envelope
depend on every application's features. Maintaining a specification does not
give its maintainers control over identities, relay admission, or the network.

## Specification

### Proposal structure

Every MIP includes: status, kind allocation, abstract, motivation,
specification, canonical examples, validation, relay indexing, compatibility,
and security considerations. A section may explicitly state that it adds no
requirements. Drafts with unresolved decisions also include Open Decisions.

Examples MUST distinguish complete verifiable events from illustrative
fragments. Examples and validation cases belong in the MIP itself; separate
schemas, generators, or test-vector directories are not required.

The uppercase terms MUST, MUST NOT, SHOULD, SHOULD NOT, and MAY express the
requirements of the proposal. In a draft they describe the proposed behavior,
not a claim that an interoperable implementation or accepted standard exists.

### Status and readiness

- `draft`: under discussion; incompatible changes are possible.
- `accepted`: reviewed and approved as an interoperable specification.
- `final`: stable, with interoperability demonstrated by independent implementations.
- `deprecated`: retained for compatibility but discouraged for new use.
- `rejected`: not adopted, with the reason recorded.

Changes in status require a reviewed repository change. Acceptance requires
unambiguous wire formats, validation, compatibility, and security rules.
A draft that only settles architecture MUST identify the missing decisions;
implementers MUST NOT invent private wire formats and call them interoperable.

### Kind ownership

Each kind has one defining MIP, recorded in [KIND-REGISTRY.md](KIND-REGISTRY.md).
That MIP defines its header, content, relationships, validation, and searchable
metadata. Numeric ranges do not imply storage, replacement, or routing behavior.

Draft allocations reserve numbers but do not make their semantics stable.
Historical reservations are not silently reassigned to unrelated behavior.
A MIP may describe an area before assigning its kinds; an unassigned kind MUST
NOT be represented by a made-up number in a purportedly valid wire example.

### Evolution

Optional additions are compatible only when an older implementation can ignore
them without changing the meaning or security of what it already understands.
Every field remains covered by the event hash, including unknown nested fields.

An incompatible change to a kind's accepted semantics requires a new kind.
Changes to the envelope, canonicalization, or signing rules require a new core
version once the current version is accepted. Transport extensions define their
own negotiation and MUST NOT silently reinterpret existing requests.

Draft changes may replace earlier drafts, but MUST update all affected
examples, indexes, registry entries, and compatibility statements together.

## Canonical Examples

A publication MIP owns its publication identifier and revision rules. A private
message MIP owns recipients and encrypted content. Neither requires a universal
recipient or revision field in every event.

## Validation

Review a proposal for:

1. Consistent fields and meanings across all examples.
2. A unique kind allocation or an explicit statement that allocation is pending.
3. Bounded validation and query work.
4. Explicit compatibility and failure behavior.
5. Security limits, including what a signature does not prove.
6. Complete wire rules before acceptance, or clearly listed draft gaps.

## Relay Indexing

Kind MIPs declare searchable paths relative to `header`, using JSON Pointer.
Relays advertise the subset they implement. Storage of a kind does not imply
semantic validation, indexing, or support for a current-publication view.

## Compatibility

The October 2026 rewrite replaces the previous unpublished draft design.
The old ten-field envelope, array hash payload, batch submission format,
query language, and predecessor-chain rules are not compatible with this draft.

Both drafts used envelope version `1` while under development. The number alone
cannot distinguish them. Existing experimental deployments must coordinate a
draft upgrade; old events cannot be converted while preserving their IDs and
signatures. A migration strategy is required before an accepted release.

## Security Considerations

Allocation is documentation governance, not an authorization service. Anyone
can implement a compatible application or operate a relay without a central
account or permission token. Relays still control their own resources.

New proposals MUST NOT silently change signature verification, signer identity,
or event IDs. A relay's acceptance is never proof that it is honest.
