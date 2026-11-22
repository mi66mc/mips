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

MIP-04 publications and MIP-07 private messages are separate features.
MIP-08 gives non-normative application portability guidance.
No fixed set of four social kinds is mandatory in the generic core.
A relay can support a kind without requiring every client to render it.

Current-view kinds and assisted lookup are separately advertised capabilities.
The general baseline remains a candidate; the following test profile is the
concrete subset for the first implementation.

### Experimental publication test profile

`publications-test-v1` implements MIP-01, MIP-02, MIP-03, and publication
metadata/body validation from MIP-04. It MUST support:

- `GET /info` with the complete MIP-03 fields, policy, and error formats.
- `POST /events` and local `GET /events/{id}` with persistent storage.
- QUERY/POST query and sync alternatives with identical semantics.
- Kind `1`, all five MIP-04 header filters, and `view: current` for that kind.
- Durable admission order, retention deadlines, and publication high-water state.
- Automatic bounded propagation to manually configured peers using POST.
- Replay and recovery through sync after disconnect or ordinary process restart.

Initial configuration accepts and validates only kind `1` and rejects unknown
kinds. It advertises `relay_announcements: false` and `lookup: false`.
Explicit requests for those features return `unsupported_feature`.
No signed announcements need to be served by `GET /relays` in this test subset;
it returns the unsupported-feature error. Claiming this profile does not claim
the entire candidate network baseline is implemented.

A peer address is explicitly configured by the operator, not supplied by an
untrusted discovery response. Plain HTTP is permitted only for local loopback
tests. Other deployments use HTTPS. Fixed test peers are not signed discovery.

The prototype CLI imports a user-supplied signing key or uses a disposable
locally generated test key. It signs locally and never submits the secret to
the relay. Its article commands create, edit, withdraw, publish, fetch, query,
and sync. It can save/display Markdown source; rendering Pandoc bibliography
and selecting a citation style are not needed to test signed article transport.

Non-normative reference implementation choice: TypeScript on Node.js, SQLite
for persistent relay data, and a command-line client. The protocol does not
require those tools. Use two instances of the same relay and two separate
client directories for local tests; shared code alone does not demonstrate
independent-implementation interoperability.

Suggested starting configuration is the MIP-03 complete example. Test scripts
may use shorter retention/cursor windows if `/info` advertises the actual values.
Use a configurable finite publication-state budget and stop admitting new
publication identities when that budget is exhausted.

### First acceptance scenarios

1. Client publishes to A; A replicates to B; stop A; another client fetches and
   verifies the original event from B.
2. Repeat a valid POST without renewing retention or restarting propagation;
   reject a changed body with an unchanged ID or signature.
3. Publish edits, concurrent equal revisions, withdrawal, and restoration;
   resolve by revision then ID, with selection before result filters.
4. Expire the preferred body while retaining an older edition: raw retrieval
   can return history, but current view cannot resurrect the older edition.
5. Import a timestamp-old event late; sync must find it by admission order.
6. Disconnect/restart a relay, replay a batch, resume a persisted cursor, and
   explicitly reject expired or wrong-filter cursors.
7. Exercise kind/byte/filter/snapshot limits, fixed-window rate limits, and
   storage refusal before acknowledgement.

Measure publication/query/sync latency, validation cost, disk growth, memory,
and replication requests after correctness scenarios work. Record workload,
configuration, and failures; no performance target is claimed in this draft.

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
A declared retention deadline describes a commitment, not proof of compliance.
MIP-03 defines the per-admission limits and declared early-removal exceptions.

Prevent abuse with finite aggregate and per-origin budgets. No mandatory
CAPTCHA, payment, proof of work, or central ban list is part of this baseline.
No guarantee is made against volumetric network attacks.

### Clients, identity, and devices

Identity is the public signing key. Custody, signing integrations, backup,
recovery, and sharing a secret between devices belong to the user or higher-level
applications. There is no protocol account, device registry, recovery authority,
or implicit mapping of a replacement key to the previous author.

Another app can use the same identity key, including through an external signer.
A different signing key creates another protocol identity. Key loss without
usable recovery material can lose control; theft permits valid signatures by
the thief too. A backup does not revoke a stolen copy, and author-set timestamps
cannot establish a trusted compromise boundary.

MIP-08 gives application guidance without defining mandatory backup formats.
MIP-09 defines the initial failover/privacy expectations. These boundaries
settle the identity scope for the experimental profile.

### Draft readiness

| Area | Written behavior | Still blocks acceptance |
| --- | --- | --- |
| Event envelope and signatures | Eight fields, object-based JCS hash, raw-digest Ed25519. | Cross-library edge-case verification and complete resource policy. |
| HTTP | Complete test-profile capabilities, errors, retention, query, and sync. | Exercise restart, eviction, concurrent updates, and optional lookup behavior. |
| Publications | Complete revisions, Pandoc source, bounded metadata, durable anti-rollback state. | Full Markdown rendering profile and stable link syntax. |
| Relay network | Best-effort propagation, contacts, bounded lookup, recovery. | Announcement wire schema, key/address authentication, allocations. |
| Private messages | Double Ratchet, proposed asynchronous setup, visible sender and recipient. | Authenticated session setup, complete reviewed cryptographic profile, and wire format. |
| Portability | Same key across apps; recommendations for history and secrets. | Application-layer formats, outside protocol acceptance. |
| Blocking resistance | Cached contacts, alternate relays/addresses, proxy policy. | Concrete stronger transports and evaluation. |
| Identity | Exactly the signing public key. | Custody, recovery, and device management are application responsibilities. |

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

Exercise the experimental profile and close the remaining general-profile
readiness gaps before acceptance. Signed discovery, optional lookup, private
messaging, and stronger transports remain future protocol work.
Key custody and backup formats are higher-layer responsibilities.
