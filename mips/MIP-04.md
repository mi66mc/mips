# MIP-04: Publications and Revisions

Status: `draft`

## Kind Allocation

This rewritten draft retains kind `1` as the `publication` reservation.
Its new semantics are not compatible with the earlier draft.

The earlier profile, comment, and reaction reservations remain recorded in
[KIND-REGISTRY.md](KIND-REGISTRY.md) but are not defined or required by this
redesign. They need separate reviewed specifications before reintroduction.

## Abstract

Short posts and long articles are publications with a stable identity and
immutable complete revisions. Withdrawal changes the preferred editorial state,
not the existence or cryptographic validity of historical copies.

## Motivation

An author should be able to revise, cite, withdraw, and restore an article
without depending on mutable records controlled by one application or relay.

## Specification

### Stable publication and complete revisions

The common publication header uses:

```ts
type PublicationHeader = {
  publication: string
  revision: number
  status: "published" | "withdrawn"
  topics?: string[]
  language?: string
}
```

`publication` is a non-empty stable identifier chosen for the work by its author.
Compare its string exactly, without normalization. Its final syntax and length
bound remain open. Reusing the identifier means revising the same work, not
creating another one.

For the direct-signing model in this draft, the logical identity is:

```text
(signer, kind, header.publication)
```

The conceptual author is the signer here. This draft does not define a
separate logical author or device-author relationship. A different signer
cannot revise or withdraw this author's publication by copying its identifier.

`revision` is a positive safe integer. Start at `1`; an editing client uses the
greatest known revision plus one. At the maximum representable value it must
report exhaustion rather than wrap around. Not knowing an existing higher
revision can cause a conflict; it does not establish an exclusive next number.

`status` is explicitly required in this rewritten draft. A published revision
contains the full article snapshot. A withdrawn revision has `content: null`.
There is no inherited `previous` field or predecessor-chain validation.
Receiving revision 5 without revisions 1–4 does not prevent validating its
complete signed snapshot.

The final published-content representation, media handling, additional
metadata, and unknown-header-field behavior are still open. Text examples below
do not choose Markdown, HTML, or a universal attachment format.

### Preferred revision and conflicts

Among valid events for the same publication:

1. Prefer the greatest revision number.
2. On a tie, prefer the greatest hexadecimal event ID.

Both conflicting revisions remain events. The tie-breaker is deterministic,
not chronological proof, a merge, or a way to determine the author's intent.
Clients that know a conflict SHOULD show it to the author. The author can
publish a consolidated complete revision with a higher number.

No predecessor retrieval or other-relay lookup is necessary to compare complete
known revisions. Equal known valid sets produce the same preference, but
different relays may know different sets or hide newer events.

### Withdrawal and restoration

A higher `withdrawn` revision stops the publication being presented as active
once that revision is preferred. It need not repeat the old article text.

A still higher `published` revision can restore the work with its complete
content. A withdrawal is therefore reversible. It is not a global deletion
command and does not invalidate historical event signatures.

Relays may retain and serve withdrawn or older revisions. Raw queries and
exact-ID fetches may find them; the user can ask for any retained revision.
A revision-number search may find several conflicting events, whereas an ID
identifies one exact signed event.

### Current view and retention

MIP-03 `view: current` selects the preferred revision before applying result
filters. A preferred withdrawal is returned unless excluded by a filter.
Filtering for published content must not fall back to an earlier revision.
The same applies to removed topics and changed metadata.

Evicting the preferred event MUST NOT silently promote a known older revision
to current. A relay needs enough verified preference state to suppress that
fallback, or must report that the current view cannot be provided. It must not
fabricate a replacement event from local metadata.

How long that state is retained, how its storage is bounded, and what resets
mean are unresolved. Implementations cannot claim an interoperable current
view until those rules and the content-validation profile are closed.
Current view is local knowledge, never a global latest-version proof.

### Links and subscriptions

Stable references name the signer, kind, and publication identifier. Citations
to a particular edition use its event ID. The URI spelling remains open.

Subscriptions should include edits and withdrawals using stable publication
identity, rather than only mutable status or topic filters.

## Canonical Examples

The complete signed example is in [MIP-01](MIP-01.md); the following are
unsigned fragments, not wire-ready events.

A published revision:

```json
{
  "header": {
    "publication": "artigo-123",
    "revision": 4,
    "status": "published",
    "topics": ["tecnologia"],
    "language": "pt-BR"
  },
  "content": "Complete article text for this edition."
}
```

A withdrawal:

```json
{
  "header": {
    "publication": "artigo-123",
    "revision": 5,
    "status": "withdrawn"
  },
  "content": null
}
```

A restoration uses revision `6`, `status: published`, and the full article.
All three are submitted through the same `POST /events` operation.

If revisions 4 and 5 are known, a raw history query can return both. A current
query returns 5. A current query restricted to `status = published` returns
neither, not revision 4.

## Validation

Verify MIP-01 and MIP-02 first. Validate the publication identity, positive
revision, explicit status, and withdrawal body. Do not require missing previous
editions or trust `created_at` to break conflicts.

Before accepting this MIP, add precise content and metadata constraints and
cases for concurrent revisions, unknown predecessors, other-signer withdrawal,
restoration, filtering before/after preference, and eviction of the winner.

## Relay Indexing

Paths are relative to `header`:

| Path | Operators | Purpose |
| --- | --- | --- |
| `/publication` | `eq` | Stable work identifier. |
| `/revision` | `eq` | A requested edition number, possibly with conflicts. |
| `/status` | `eq` | Published or withdrawn. |
| `/topics` | `contains` | Exact topic membership. |
| `/language` | `eq` | Exact stored language value. |

These are eligible capabilities, not mandatory indexes on every relay.
Combine them with a signer and kind filter to scope a publication.
Titles and article text are not implicitly searchable.

## Compatibility

This replaces the earlier `document/previous` chain, lowest-ID tie-break,
mandatory Markdown interpretation, and bundled social-kind profile.
Migration requires newly signed events; the old event's identity cannot survive
a change to its signed structure.

## Security Considerations

A high revision is an author's declared preference, not a network consensus
result. Malicious authors can publish extreme revision values; other signers
cannot take over that publication by doing so.

Render content as untrusted input and prevent script execution. External media
can reveal reader information. Withdrawal cannot revoke copies, screenshots,
caches, backups, or someone else's independently signed republication.

## Open Decisions

Finalize publication identifier bounds, published-content format, optional
metadata and extension rules, link syntax, and current-state retention under
eviction/reset. Future key rotation or device delegation must explicitly define
whether and how logical authorship survives a signer change.
