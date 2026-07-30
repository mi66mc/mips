# MIP-00: MIP Process

Status: `draft`

## Abstract

This MIP defines how Murm Improvement Proposals are written, reviewed, assigned
event kind numbers, accepted, revised, and retired.

## Motivation

Murm implementations need one public source of truth for protocol behavior.
Event kinds cannot remain interoperable if separate applications assign their
own meanings to the same number or change an existing kind without a migration
path.

## Specification

### Required Sections

Every MIP MUST contain the following sections:

1. Title
2. Status
3. Kind Allocation, when the proposal defines an event kind
4. Abstract
5. Motivation
6. Specification
7. Canonical Examples
8. Validation
9. Relay Indexing
10. Compatibility
11. Security Considerations

A section MAY state that it has no applicable requirements, but it MUST NOT be
silently omitted.

### Statuses

MIPs use one of these statuses:

- `draft`: under active design and subject to incompatible changes.
- `accepted`: approved for compatible implementations.
- `final`: implemented, tested, and considered stable.
- `deprecated`: retained for compatibility but not recommended for new use.
- `rejected`: considered and intentionally not adopted.

Only `accepted` and `final` MIPs are part of a compatibility profile unless that
profile explicitly says otherwise.

The maintainers of the canonical Murm MIP repository are the change
controllers. Every status transition MUST be made through a reviewed repository
change that records its rationale.

- A new proposal starts as `draft`.
- A proposal becomes `accepted` after it satisfies this MIP's validation rules
  and the maintainers approve it for compatible implementation.
- A proposal becomes `final` after at least two independent implementations
  demonstrate interoperable behavior for its normative requirements.
- A proposal becomes `deprecated` only with a compatibility statement and,
  when applicable, a replacement or migration path.
- A proposal becomes `rejected` only with a recorded rationale.

### Changes

Editorial corrections MAY update an existing MIP without changing its event
kind.

A `draft` MIP MAY change incompatibly. Such a change MUST update its canonical
examples, registry entry, and compatibility section in the same repository
change.

After a MIP becomes `accepted` or `final`, a change is breaking when an event
valid under the old rules can acquire a different meaning, become invalid, or
produce a different canonical ID under the new rules.

- A breaking change to kind semantics MUST use a new kind allocation or a
  migration MIP.
- A breaking change to the event envelope, canonicalization, cryptography, or
  transport MUST define a new applicable protocol version in a new MIP or
  migration MIP.

## Kind Allocation

Event kind numbers are assigned in [KIND-REGISTRY.md](KIND-REGISTRY.md).

A draft MIP MAY reserve an unallocated number. The reservation prevents another
draft from using the same number but does not make the kind part of the core
compatibility profile.

Each registry entry MUST identify:

- the numeric kind;
- its protocol name;
- the defining MIP;
- the MIP status;
- whether events are immutable events or versioned documents.

An unlisted number has no Murm-defined meaning. It may still appear in an
otherwise structurally and cryptographically valid opaque event.

## Canonical Examples

A kind proposal SHOULD include at least one representative complete valid
event. Validation edge cases MAY be described directly in the proposal.

## Validation

Reviewers MUST confirm that:

1. every required section exists;
2. the requested kind number is unallocated or reserved for that MIP;
3. header and content shapes are unambiguous;
4. relay indexing requirements are bounded;
5. compatibility and migration behavior are explicit;
6. security-sensitive rules are explicit.

## Relay Indexing

This process MIP defines no event header and no indexable event paths.

Kind MIPs MUST list every `/header` JSON Pointer that core-compatible relays are
required to index or sort. Fields not listed there are not implicitly
queryable.

## Compatibility

Relays MAY store unlisted or unsupported kinds as opaque, validly signed
events. They MUST NOT claim to understand or semantically validate such a kind.

Clients MUST NOT infer semantics from an unregistered kind number.

## Security Considerations

Kind allocation is a protocol-governance mechanism, not an authorization
service. It does not grant control over identities, relays, or content.

A proposal MUST NOT redefine signature validity, authorship, or canonical event
IDs without explicitly replacing the relevant core MIP.
