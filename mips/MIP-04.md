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
  title?: string
  summary?: string
  topics?: string[]
  language?: string
}
```

`publication` is a stable identifier of 1–128 ASCII characters matching
`[A-Za-z0-9][A-Za-z0-9._~-]{0,127}`, chosen by the author. Comparison is
case-sensitive. Reusing it means revising the same work, not creating another.
It need not equal the title, and a title change must not change this identity.

`title` and `summary` are optional strings of at most 200 and 1000 Unicode
scalar values respectively. `topics` is an optional array of at most 20 unique
strings, each with 1–64 Unicode scalar values. `language` is an optional
non-empty string of at most 64 Unicode scalar values; apps SHOULD use a BCP 47
language tag, but relay validation only checks its string bounds. Compare all
metadata exactly without normalization.

Unknown header members are allowed as optional metadata and remain signed.
Receivers preserve them but do not infer unsupported behavior. An extension
that changes revision preference, authorization, or other security semantics
requires a separately specified compatible mechanism or a new kind under MIP-00.

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

### Published content

When `status` is `published`, `content` MUST be a JSON string containing the
complete article in [Pandoc Markdown](https://pandoc.org/MANUAL.html#pandocs-markdown).
This is the default format for publications and requires no format field.
Use the original Markdown source as the signed value; do not replace it with
rendered HTML or reformat the source before verifying the event. Other kinds
continue to define their own content.

The publication profile is intended to cover tables and captions, footnotes,
math, and [citations with a generated bibliography](https://pandoc.org/MANUAL.html#citation-syntax).
An article that uses citation keys MUST include their bibliographic data in
`references` in the article's YAML metadata. Rendering citations must not
depend on fetching an external bibliography. Bibliographic URLs may still
be displayed as links to the sources.

Reference completeness is an authoring/rendering check. Relay event validation
checks the body type and bounded metadata, without parsing Markdown or YAML;
the validated-kind claim does not certify that citations exist or are correct.

The MIP defines the interchange format, not the editor, renderer, or a
dependency on the Pandoc executable. The exact dialect version, required
extensions, default citation style, and fallback for unsupported syntax
remain open before acceptance of a complete rendering profile. Relays validate
the signed string and bounded metadata; they do not render articles.

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

Persist a high-water record for each known publication: greatest validated
`(revision, id)` and its published/withdrawn status. This is local metadata
derived from a verified event; it is never a fabricated signed event.
Keep it across ordinary restarts even when the winning content expires.
It remains until an explicit store reset, and must not be evicted silently
while offering current view.

If the winner is no longer servable, omit the publication from current results
without substituting a lower revision. Raw history and exact retrieval may
still serve retained older editions. A higher valid revision can become current.
If the preference-state budget is full, reject a new publication before
acknowledging storage or disable the current-view capability with an explicit
error; do not forget a winner to make room. An explicit store reset invalidates
all cursors and cached current-view knowledge of that instance.

Clients with known higher revisions keep the same anti-rollback rule locally.
A fresh client cannot prove a relay has not omitted a newer event.
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
  "content": "---\nreferences:\n  - id: rfc9505\n    type: report\n    title: A Survey of Worldwide Censorship Techniques\n    number: RFC 9505\n    URL: https://www.rfc-editor.org/rfc/rfc9505.html\n---\n\n## Network blocking\n\nDNS interference and IP blocking target different parts of a connection [@rfc9505, sec. 5]."
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
revision, explicit status, and content type: a string for `published` or
`null` for `withdrawn`. Relays do not need to render the article or fetch its
sources to validate an event. Do not require missing previous editions or
trust `created_at` to break conflicts.

Before accepting this MIP, verify the content and metadata constraints with
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
and bundled social-kind profile. Published content now uses Pandoc Markdown.
Migration requires newly signed events; the old event's identity cannot survive
a change to its signed structure.

## Security Considerations

A high revision is an author's declared preference, not a network consensus
result. Malicious authors can publish extreme revision values; other signers
cannot take over that publication by doing so.

Render content as untrusted input. Clients MUST NOT render raw HTML from the
source as active HTML, execute scripts or filters requested by the document,
or read local files on its behalf. External media can reveal reader
information. Withdrawal cannot revoke copies, screenshots, caches, backups,
or someone else's independently signed republication.

## Open Decisions

Finalize the full interoperable Pandoc Markdown rendering profile (version,
supported extensions, citation style, and fallback) and stable link syntax.
The relay prototype validates signed metadata and string/null bodies without
rendering articles. Identity is the signing key; moving authorship between
different keys is not an implicit operation.
