# MIP-05: Compatibility and Trust Boundaries

Status: `draft`

## Kind Allocation

This MIP allocates no event kind.

## Abstract

This MIP separates core event verification, optional application capabilities,
and local relay policy. It records the intended compatibility baseline without
claiming that the remaining draft formats are ready for interoperable release.

## Motivation

Storing a signed object, understanding its kind, and offering an indexed current
view are different capabilities. A generic protocol must not require every
application to implement every feature or trust a relay's assertions.

## Specification

### Candidate baseline

A baseline relay is intended to offer:

- MIP-01 envelope verification and MIP-02 hashing/signatures.
- MIP-03 single-event submission, local exact retrieval, local filtered query,
  incremental sync, and capability discovery.
- The HTTP QUERY and POST query/sync alternatives with equal semantics.
- MIP-06 relay contacts and bounded default propagation of new accepted events.
- Explicit policy and overload refusals without redefining signature validity.
- No protocol registration, login, password, session, JWT, or API key.

MIP-04 publications, MIP-07 private messages, and MIP-08 portability are separate
features. No fixed set of four social kinds is mandatory in the generic core.
A relay can support a kind without requiring every client to render it.

Current-view kinds and assisted lookup are optional advertised capabilities.
The required baseline and complete capability vocabulary must be finalized
before any implementation claims accepted core compatibility.

### What verification means

Event validity has separate layers:

1. Parse and envelope validity.
2. Correct hash and valid signature.
3. Known-kind semantic validity, when the implementation knows that kind.
4. Local admission and retention policy.

A relay may accept an unknown kind opaquely after the first two layers. It must
not present it as semantically validated. Refusal at layer 4 does not make a
cryptographically valid event invalid at layer 2.

The connection's IP, a relay account, or transport encryption is not event
authorship. Clients and relays independently verify received events.

### Local policy

Relays control their own storage, query capacity, moderation, replication peers,
and operational limits. They may refuse a valid event or stop serving it.
A declared retention deadline describes a commitment, not proof of compliance;
MIP-03 must define any exceptions before acceptance.

Prevent abuse with finite aggregate and per-origin budgets. No mandatory
CAPTCHA, payment, proof of work, or central ban list is part of this baseline.
No guarantee is made against volumetric network attacks.

### Clients, identity, and devices

Users generate and control cryptographic secrets locally. Compatible clients
need no central permission to participate. Events can be signed, cached, and
checked before an Internet connection is available.

The present direct-signing examples use `signer` as the author key. The redesign
has not adopted root/device delegation, a universal authorization field, key
rotation, revocation, or a recovery authority.

Identity loss and theft need explicit rules. A backup may restore a lost secret;
it cannot undo the fact that an attacker also has a stolen secret. Author-set
timestamps cannot prove a signature predates compromise. These issues are open
design work, not automatic properties of “zero trust.”

MIP-08 distinguishes identity recovery from private-history recovery.
MIP-09 defines the initial failover/privacy expectations.

### Draft readiness

| Area | Written behavior | Still blocks acceptance |
| --- | --- | --- |
| Event envelope and signatures | Eight fields, object-based JCS hash, raw-digest Ed25519. | Cross-library edge-case verification and complete resource policy. |
| HTTP | Publication, local query, sync, and explicit optional lookup. | Full capabilities/error formats and retention commitments. |
| Publications | Complete revisions, conflicts, withdrawal, current selection. | Content profile and anti-rollback retention. |
| Relay network | Best-effort propagation, contacts, bounded lookup, recovery. | Announcement wire schema, key/address authentication, allocations. |
| Private messages | Asynchronous setup, ratcheting direction, metadata limits. | Complete reviewed cryptographic profile and wire format. |
| Portability | Local encrypted backup, history/identity separation. | Interoperable export/import and backup cryptography. |
| Blocking resistance | Cached contacts, alternate relays/addresses, proxy policy. | Concrete stronger transports and evaluation. |
| Identity lifecycle | No central account; keys under user control. | Loss/theft, rotation, revocation, recovery, devices. |

“Draft” is not a security certification. Applications must identify any
experimental choices they add instead of presenting private extensions as a
final Murm profile.

## Canonical Examples

A relay can verify and store an unknown-kind event but reject a request to
filter one of its headers. It can support publication history while not
supporting current view. It can propagate events while declining assisted
lookup. These are separate advertised choices, not contradictions.

If relay A acknowledges storage and relay B later rejects a copy, A's local
acknowledgement remains true at the time it was made. It never implied B's
acceptance or a recipient's delivery.

## Validation

Before a profile is accepted, check the defining MIPs for:

1. Reproducible event IDs and signature rejection behavior.
2. New versus duplicate submission, truthful local storage results, and limits.
3. Filter semantics and explicit unsupported-capability errors.
4. Cursor scope, replay, expiry, late arrivals, and retention loss.
5. Bounded propagation, one-hop explicit lookup, and relay recovery.
6. No silent direct connection when a proxy is selected.
7. No claims of plaintext confidentiality, history recovery, or revocation
   that the chosen cryptographic profile does not provide.
8. Compatibility with ordinary clients that do not implement optional kinds.

## Relay Indexing

The core identifies events by ID and queries signer, kind, and declared time.
Header indexes belong to kind MIPs and relay capability advertisements.
A database implementation is not prescribed.

## Compatibility

This draft replaces the old “all kinds 0–3, fixed limits, batch API” profile.
There is currently no accepted or final compatibility profile. In particular,
the earlier draft's compatibility claims must not be reused for this redesign.

## Security Considerations

Replaceable relays and independent verification reduce dependence on operators;
they do not prevent every operator from censoring its own service. Availability
requires a reachable retained copy. Signatures do not hide IP addresses,
metadata, or plaintext public content, and do not prove response completeness.

No protocol can promise delivery when all paths are blocked or all copies are
gone. No application is made trustworthy merely by implementing the protocol.

## Open Decisions

Close the readiness gaps above, choose the exact minimum interoperable profile,
and define migration/version signaling before acceptance. No root/device-key
authorization or recovery model is selected by this profile.
