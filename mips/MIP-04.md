# MIP-04: Initial Event Kinds

Status: `draft`

## Kind Allocation

This MIP reserves:

| Kind | Name | Model |
| ---: | --- | --- |
| `0` | `profile` | versioned document |
| `1` | `publication` | versioned document |
| `2` | `comment` | immutable event |
| `3` | `reaction` | immutable event |

The allocations are also recorded in
[`KIND-REGISTRY.md`](KIND-REGISTRY.md).

## Abstract

This MIP defines the initial Murm event kinds for public profiles, bounded short
and long-form Markdown-compatible publications, comments, and reactions.

## Motivation

The core event envelope intentionally carries no application semantics. A small
initial kind set is needed for publishing and discussion, while structured
headers avoid positional tags and leave later kinds free to define their own
data.

Short posts and long articles use the same `publication` kind. Their difference
is presentation, not protocol identity.

## Specification

Every object shape defined by this MIP is closed unless stated otherwise. This
includes nested `root` and `target` objects; unknown properties are invalid.
Event IDs, public keys, and 32-byte document identifiers use the lowercase
64-character hexadecimal encoding defined by MIP-01.

### Versioned Documents

Profile and publication events use:

```ts
type DocumentHeader = {
  document: string
  revision: number
  previous: string | null
}
```

`document` is a 64-character lowercase hexadecimal identifier. Unless a kind
defines deterministic derivation, the creator generates it from 32
cryptographically random bytes.

`revision` MUST be a positive safe integer. `previous` MUST be `null` or a
valid event ID.

The complete document identity is the tuple:

```text
(author, kind, document)
```

Revision rules are:

1. The first revision MUST use `revision: 1` and `previous: null`.
2. Revision `n`, for `n > 1`, MUST reference the event ID of revision `n - 1`.
3. The referenced event MUST have the same `author`, `kind`, and `document`.
4. A revision whose predecessor is unavailable is unresolved and MUST NOT be
   treated as current.
5. The valid event with the greatest revision is the current state.
6. If multiple valid branches have the same greatest revision, the event with
   the lexicographically lowest ID is current. Clients MAY expose other branches
   as conflicts.

Events are never overwritten. A document is the state resolved from its signed,
immutable revision events.

### Text Rendering

Publication and comment content is Markdown-compatible text.

Clients MAY render Markdown. They MUST NOT execute scripts or render raw HTML as
trusted HTML. Clients that do not render Markdown display the content as plain
text.

### Kind 0: Profile

A profile is the versioned public metadata for one author.

The profile document ID is deterministic:

```text
lowercase_hex(SHA-256(UTF-8("murm:profile:v1:" + author)))
```

An author MUST NOT create a second profile document ID.

The header is exactly `DocumentHeader`. Content is:

```ts
type ProfileContent = {
  name: string
  about?: string
  picture?: string
}
```

Rules:

- `name` contains 1 through 80 Unicode scalar values.
- `about`, when present, is a string no larger than 2 KiB in UTF-8.
- `picture`, when present, is an absolute RFC 3986 URI with the `https` scheme,
  a non-empty host, and no user-information component.
- `UTF-8(JCS(content))` is no larger than 8 KiB.
- Extra content or header properties are invalid.
- Names are display values and are not globally unique identifiers.

### Kind 1: Publication

A publication represents a public short post, note, essay, article, or other
Markdown-compatible written work.

```ts
type PublicationHeader = DocumentHeader & {
  title?: string
  summary?: string
  topics?: string[]
  language?: string
}
```

Rules:

- `title`, when present, contains 1 through 200 Unicode scalar values.
- `summary`, when present, contains at most 500 Unicode scalar values.
- `topics`, when present, contains at most 20 unique strings.
- Each topic contains 1 through 64 Unicode scalar values.
- Topic uniqueness compares exact Unicode scalar sequences without
  normalization.
- `language`, when present, is a syntactically well-formed BCP 47 language tag
  under the complete `Language-Tag` production in RFC 5646 Section 2.1,
  including private-use and grandfathered forms. Validation does not require a
  live lookup in the IANA Language Subtag Registry.
- `content` is a string no larger than 1 MiB in UTF-8.
- Extra header properties are invalid.

`title` is optional so the same kind supports brief posts and long-form
publications.

### Kind 2: Comment

A comment is an immutable reply in a publication discussion.

```ts
type CommentHeader = {
  root: {
    author: string
    kind: 1
    document: string
  }
  parent: string | null
}
```

`root` identifies the stable publication document rather than one revision.
`parent` is `null` for a direct reply to the publication. A nested reply sets
`parent` to a comment event ID. When available, the parent MUST be a kind `2`
comment with the same `root`.

The publication root is `resolved` when at least one valid kind `1` revision
for `(root.author, 1, root.document)` is available and `unresolved` otherwise.
An unavailable root does not make the comment malformed or cryptographically
invalid. A relay MAY store and return an unresolved-root comment and MUST
re-evaluate its root state when matching publication revisions arrive.
A malformed `root` object makes the comment invalid.

A nested comment has one of three reference states:

- `resolved`: the parent is available, is a kind `2` comment, and has the same
  `root`;
- `unresolved`: the parent is unavailable;
- `invalid`: the parent is available but has another kind or `root`.

An unresolved comment is not malformed solely because synchronization is
incomplete. A relay MAY store and return it, but MUST preserve its unresolved
state for validation. When the parent later becomes available, the relay MUST
re-evaluate the comment. An invalid comment MUST NOT be included in
core-compatible kind `2` query results. A relay MAY retain it as opaque
diagnostic data, but MUST NOT claim that it satisfies MIP-04.

Comment `content` is a non-empty Markdown-compatible string no larger than
128 KiB in UTF-8. Extra header properties are invalid.

### Kind 3: Reaction

A reaction is an immutable lightweight response to an event or a stable
document.

```ts
type ReactionHeader = {
  target:
    | {
        type: "event"
        id: string
      }
    | {
        type: "document"
        author: string
        kind: number
        document: string
      }
}
```

For a document target, `kind` MUST be a non-negative safe integer. A target
object is invalid if its fields do not have the identifier encodings declared
above. Target availability is not part of reaction validity: a well-formed
reaction may reference an event or document the receiver has not synchronized.

Reaction `content` is:

- `+` for a positive reaction;
- `-` for a negative reaction; or
- a display reaction string, normally emoji, containing at most 32 Unicode
  scalar values.

Content MUST NOT be empty. Extra header properties are invalid.

## Canonical Examples

All examples use the Ed25519 key from the MIP-02 canonical example.

### Profile

```json
{
  "version": 1,
  "id": "389923c44a36dad91d2187c895f0851fd435d5e6a63d5933aa94834e5813ddfa",
  "author": "d75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a",
  "signer": "d75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a",
  "authorization": null,
  "created_at": 1710000000,
  "kind": 0,
  "header": {
    "document": "c62282550ba41b44faf722b5c8606a8008ddc4151ab2afc8e1aa1417079e0666",
    "revision": 1,
    "previous": null
  },
  "content": {
    "name": "Alice",
    "about": "Writing on Murm."
  },
  "signature": "19524e14b7e4e4acc4619a8b5d627f773691832fe3bcb8c49a7090eca029e1c76d397687818122d57b1723c1f285cab3aedcdc8ef7f7038f9a177b8843ab2e03"
}
```

### Publication

```json
{
  "version": 1,
  "id": "5b0b000dc2377e137aeaab36f7a5e2f82de104f1dac38162b08efe1bf7d71139",
  "author": "d75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a",
  "signer": "d75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a",
  "authorization": null,
  "created_at": 1710000000,
  "kind": 1,
  "header": {
    "document": "4f5f4c6b5e897c32217a32097510c8d67491c7c9200f2af22c568a5dc2363742",
    "revision": 1,
    "previous": null,
    "title": "Hello Murm"
  },
  "content": "# Hello Murm\n\nA signed publication.",
  "signature": "40adfc83597064286dd51ad195ca613a444b6f9ca8e554da58d0d1c4ae4f10427719c8f941c87a7b8d2b12e0c84bfb80e23f198d20a3c7cefaa68e4612227b03"
}
```

### Comment

```json
{
  "version": 1,
  "id": "5ba0981c33f11bc38a87c19c18a39a9534ed6141e5e85f9a73376dd55c1de594",
  "author": "d75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a",
  "signer": "d75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a",
  "authorization": null,
  "created_at": 1710000100,
  "kind": 2,
  "header": {
    "root": {
      "author": "d75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a",
      "kind": 1,
      "document": "4f5f4c6b5e897c32217a32097510c8d67491c7c9200f2af22c568a5dc2363742"
    },
    "parent": null
  },
  "content": "Great article.",
  "signature": "616f1abbd4fd522bd58ff23e9ebb37f5b99d3c3fa8116d32214503314356815bf2758a81ee95131c8b7cd46c22e612c097d9562f5a6df70a42f6a48439b7430e"
}
```

### Reaction

```json
{
  "version": 1,
  "id": "0f4768ee5df9fbe807a89c7d406b9a9d5b84f885e71c6f0488b9d17f448ae5f2",
  "author": "d75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a",
  "signer": "d75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a",
  "authorization": null,
  "created_at": 1710000200,
  "kind": 3,
  "header": {
    "target": {
      "type": "document",
      "author": "d75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a",
      "kind": 1,
      "document": "4f5f4c6b5e897c32217a32097510c8d67491c7c9200f2af22c568a5dc2363742"
    }
  },
  "content": "+",
  "signature": "0e39c818ff60ae1c0ec6ad92d9a2627be0b5b667f9cd9a428481a6728bfa83dd3225e8b4e4fc648d452b59c9b80b42510a8f3be0c77bc16388dd50f312424609"
}
```

## Validation

Clients and core-compatible relays validate MIP-01 and MIP-02 before applying
kind rules.

Document validators MUST resolve and validate the complete predecessor chain
before treating a revision as current. Missing predecessors are an unresolved
state, not proof that the revision is malformed.

Comment validators MUST verify an available parent and MUST classify a missing
parent as unresolved. A relay MAY store an otherwise well-formed unresolved
comment. It MUST re-evaluate stored unresolved comments when their parents
arrive and exclude comments that become invalid from core-compatible kind `2`
query results.

Comment validators MUST also track whether the publication root is resolved.
An unresolved root or parent does not itself exclude the comment from kind `2`
queries, but clients and relays MUST NOT present the reference as resolved.

## Relay Indexing

Core-compatible relays index these exact JSON Pointer paths:

| Kind | Indexable paths | Sortable paths |
| ---: | --- | --- |
| `0` | `/header/document`, `/header/revision` | `/header/revision` |
| `1` | `/header/document`, `/header/revision`, `/header/topics`, `/header/language` | `/header/revision` |
| `2` | `/header/root/author`, `/header/root/document`, `/header/parent` | none |
| `3` | `/header/target/type`, `/header/target/id`, `/header/target/author`, `/header/target/kind`, `/header/target/document` | none |

Relays are not required to index profile names, publication titles, summaries,
or full text.

## Compatibility

Core-compatible version 1 relays MUST accept valid events for kinds `0` through
`3`, subject to local policy.

Relays MAY store unlisted or unsupported kinds but MUST NOT apply MIP-04
semantics to them.

Clients that do not understand a kind may preserve it as an opaque signed event.

## Security Considerations

All header and content fields are user-controlled. Clients MUST escape profile
text and sanitize rendered Markdown.

External profile picture URLs can reveal a reader's IP address and request
metadata. Clients SHOULD proxy remote media or ask before loading it.

Document revision ordering does not make an author's content trustworthy. It
only produces a deterministic current state among valid signed revisions.

Clients SHOULD limit recursive comment rendering and document-chain traversal
to avoid resource exhaustion.
