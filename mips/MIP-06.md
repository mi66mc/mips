# MIP-06: Relay Discovery and Event Exchange

Status: `draft`

## Kind Allocation

Signed relay announcements need a kind owned by this MIP. No number is allocated
until its wire schema and endpoint-authentication rules are complete.
See [KIND-REGISTRY.md](KIND-REGISTRY.md).

## Abstract

Relays discover contacts, copy accepted events automatically, recover after
outages, and optionally assist exact-ID retrieval. All work is local-policy
controlled, bounded, and independently verified.

## Motivation

A stored event should not depend on one server indefinitely. At the same time,
ordinary queries must not trigger an uncontrolled network-wide search or require
the user to direct every replication attempt.

## Specification

### Relay identity and announcements

A relay has a signing identity distinct from its network addresses. A public
announcement is an ordinary signed event describing its reachable addresses
and validity. One relay may announce multiple addresses under the same key.

`GET /relays` returns public signed relay announcement events, not unsigned
addresses represented as verified identities. The response container, paging,
announcement fields, validity, and update ordering remain open.

A signature authenticates the announcement's key, not the operator's honesty,
availability, ownership independence, or possession of particular content.
The future announcement profile must bind the contacted endpoint to that key;
TLS ownership of a URL alone is not that binding.

Private contacts imported manually MUST NOT be broadcast automatically as
public advertisements.

### Bootstrap and discovery

Clients and relays can start with saved contacts, replaceable default contacts,
or a contact imported from a link, file, or QR code. No central directory,
approval service, or distributed hash table is required.

A contact is a starting point for a connection, not a tunnel through a blocked
network. Multiple independent contact sources reduce dependence on one source;
many keys do not prove many independent operators.

Discovering a relay is not discovering an event. Announcements MUST NOT be
treated as proof of stored content.

### Default propagation

After a new event is accepted and stored, the relay confirms local storage
under MIP-03 and schedules bounded attempts to copy it to selected known peers.
No user forwarding flag, destination list, or delivery report is required.

The relay submits the original signed event using `POST /events`. It MUST NOT
change its ID, signer, timestamps, header, content, or signature. Serialization
may differ only as permitted by the canonical event model.

Each peer verifies the event and independently applies its own policy.
A relay chooses peers, fan-out, and budgets locally. Zero eligible peers or an
exhausted queue does not create a replica guarantee or undo acknowledged storage.
A relay that promises propagation should announce any policy restrictions.

Propagation is automatic best effort, not mandatory universal broadcast:
operators can limit kinds, destinations, capacity, or propagation availability.
This distinction must be visible in the final capability/policy announcement.

### Bounded retries and duplicate suppression

- An event already stored does not create another propagation round.
- Retry intervals increase and attempts eventually stop.
- Work is bounded **per event across all destinations**, including replacements
  for failed peers; a per-peer cap alone is not sufficient.
- Queues have finite size and lifetime. Failed work cannot accumulate forever.
- Exhausting attempts does not undo local storage.
- A relay may retain seen-ID memory after content eviction to suppress near-term
  recirculation. Seen-only state MUST NOT cause a false `already_stored` reply.
- Reaccepting an evicted event is a new local admission, but a still-active
  suppression record may prevent another outbound propagation wave.

The peer-selection algorithm, budgets, backoff values, and memory lifetime are
local policy. No particular count, such as three peers, is a protocol constant.
After all suppression memory disappears, old events may circulate again;
there is no eternal loop-elimination guarantee.

### Recovery using sync

A relay may automatically follow selected peers using MIP-03 sync. Keep a cursor
for each origin and filter set. Origin responses contain only local events and
do not trigger a lookup cascade.

After an outage:

1. Resume from the saved cursor and retrieve bounded batches.
2. Verify each event and apply local admission policy.
3. Persist accepted events and complete processing before advancing the cursor.
4. Replay an interrupted batch safely through ID deduplication.
5. On `cursor_expired`, rescan available retained history and deduplicate.

Freshly accepted imports enter normal bounded propagation. Duplicates do not
reopen propagation jobs. A receiver may decline data that the source accepts.

Peer choice, filter scope, polling frequency, concurrency, and traffic budgets
are local policy. This background activity is independent of user searches.

### Explicit assisted lookup

`GET /events/{id}?lookup=true` is optional. It requires both an explicit caller
request and a relay policy that enables it. MIP-03 defines local exact retrieval
as the default.

An enabled relay checks locally, then asks a bounded set of known peers by exact
ID. Those requests MUST use local-only retrieval without `lookup=true`.
A contacted peer MUST NOT be instructed to continue the search recursively.

Lookup does not accept general search filters and is not part of query or sync.
A disabled lookup request fails explicitly instead of silently being ignored.

Limits cover total peers, concurrency, retries, bytes, and time. Verify the ID
and signature of a result before returning it. A returned copy is not itself
a promise that the assisting relay has retained it. If it chooses to store the
copy, local admission and propagation rules apply separately.

No result means only that no usable copy was obtained within the consulted
scope. The final HTTP format must distinguish incomplete attempts from a
completed bounded search without claiming global nonexistence.

## Canonical Examples

### Offline reading

Bruno posts an event to A. A stores it, acknowledges, and tries B and C.
B accepts; C refuses. Ana can later read from B and verify the original signer.
A never promised that C accepted or that Ana read it.

### Outage recovery

C has a cursor for B, goes offline, and returns. Sync includes an older event
that entered B during the outage because admission order, not author time,
controls the stream. A repeated batch creates no second event or new duplicate
propagation wave.

### One-hop lookup

Ana explicitly asks A for a missing ID with lookup enabled. A tries local-only
GETs at B and C. If B has a valid copy, A can return it. Neither B nor C asks D
as a consequence of this lookup. Ordinary history searches at A remain local.

### Manual contact

A friend shares a QR code with a relay contact. Importing it adds a candidate
connection. The app still verifies the signed announcement, its validity, and
the endpoint binding under the future announcement profile.

## Validation

Before acceptance, demonstrate:

- Announcement authenticity, expiration, address binding, and update ordering.
- Separation of public announcements from private imported contacts.
- Duplicate suppression including reformatting and post-eviction reacceptance.
- Finite work under total peer failure and changing destination lists.
- Recovery after restart, expired cursors, replay, and local policy rejection.
- Local-only peer requests in lookup and no search or sync cascades.
- No local-storage or delivery success fabricated from propagation outcomes.

## Relay Indexing

Event deduplication uses MIP-02 IDs. Admission cursors, peer queues, seen-ID
records, and local retention state are not part of signed events.

Announcement filter paths cannot be specified until the kind schema is fixed.
Endpoint discovery is not a required global content index.

## Compatibility

This adds network behavior around the common event and MIP-03 operations,
without a new event envelope, mandatory direct client-to-client connections, or
protocol login. Lookup remains optional; capabilities cannot be inferred from
a relay's mere presence in another relay's contact list.

## Security Considerations

Peers and imported addresses are untrusted. Automatic connections must defend
against server-side request forgery, unsafe schemes, credential-bearing URLs,
redirects into private services, and DNS changes that bypass address checks.
Exact permitted-address and redirect rules must be fixed before accepting the
announcement profile.

A contact source can supply many relays under one controller and isolate a
client's view. Key counts are not independence proofs. Discovery, propagation,
and lookup can disclose network relationships and requested event IDs.

Replication does not guarantee permanence. An operator can censor its own
storage and responses. Network diversity only helps when a reachable copy
actually exists.

## Open Decisions

Assign the announcement kind and finalize its fields, response container,
endpoint/key authentication, expiry, supersession, and anti-rollback rules.
Define public policy descriptors, retryable failure classes, full-queue
admission behavior, and lookup incomplete/not-found responses. Freeze safe
address handling and synchronization rejection behavior.
