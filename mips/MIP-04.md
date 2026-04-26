# MIP-04: Event Kinds

Status: `draft`

## Abstract

This MIP defines the initial event kinds for the Murm Protocol.

Event kinds describe how clients should interpret an event's `content` and
`tags`. Relays are not required to understand every kind, but relays MUST still
validate event shape, identifiers, and signatures according to
[MIP-01](MIP-01.md) and [MIP-02](MIP-02.md).

## Motivation

The base event format is intentionally generic. Kinds give applications a shared
meaning for common event types such as profiles, posts, comments, and reactions.

The initial kind set should be small enough for a first implementation while still supporting a
basic publishing and discussion flow.

## Specification

This MIP defines the following event kinds:

| Kind | Name | Description |
| --- | --- | --- |
| `0` | `profile` | Author profile metadata |
| `1` | `post` | Public post or article |
| `2` | `comment` | Reply to a post or another comment |
| `3` | `reaction` | Reaction to an event |

Kinds not defined by this MIP are reserved for future MIPs or implementation
experiments.

### Text Rendering

Post and comment content SHOULD be Markdown-compatible plain text.

Clients MAY render Markdown syntax.

Clients MUST NOT render raw HTML contained in post or comment content as trusted
HTML.

Clients that do not render Markdown SHOULD display content as plaintext.

### Kind 0: Profile

A profile event describes the author identified by `pubkey`.

Profile `content` MUST be a JSON object serialized as a string.

The initial profile schema is:

```ts
type ProfileContent = {
  name: string
}
```

Profile `content` MUST contain `name` as a string.

This MIP does not define profile tags.

For each `pubkey`, the latest valid profile event is considered the current
profile. Relays MAY discard older profile events for the same `pubkey`.

If two profile events for the same `pubkey` have the same `created_at`, the event
with the lexicographically lowest `id` SHOULD be considered current.

Profile `content` MUST NOT exceed 8 KiB.

Example:

```json
{
  "kind": 0,
  "tags": [],
  "content": "{\"name\":\"alice\"}"
}
```

### Kind 1: Post

A post event represents a public note, essay, article, or publication.

Post `content` SHOULD be Markdown-compatible plain text.

Post `tags` MAY include indexable metadata such as:

```json
[
  ["topic", "murm"],
  ["lang", "pt"]
]
```

Post `content` MUST NOT exceed 1 MiB.

Example:

```json
{
  "kind": 1,
  "tags": [
    ["topic", "murm"],
    ["lang", "pt"]
  ],
  "content": "# Hello murm\n\nThis is a post."
}
```

### Kind 2: Comment

A comment event represents a reply within a post discussion.

Comment `content` SHOULD be Markdown-compatible plain text.

Comment events MUST include a `root` tag:

```json
["root", "<root-post-event-id>"]
```

The `root` tag points to the post that owns the discussion thread.

Comment events MAY include a `parent` tag:

```json
["parent", "<parent-comment-event-id>"]
```

The `parent` tag points to the event being directly replied to.

A direct reply to a post uses only `root`:

```json
[
  ["root", "<post-id>"]
]
```

A reply to another comment uses both `root` and `parent`:

```json
[
  ["root", "<post-id>"],
  ["parent", "<comment-id>"]
]
```

Comment `content` MUST NOT exceed 128 KiB.

Example:

```json
{
  "kind": 2,
  "tags": [
    ["root", "<post-id>"],
    ["parent", "<comment-id>"]
  ],
  "content": "I agree with this point."
}
```

### Kind 3: Reaction

A reaction event represents a lightweight response to another event.

Reaction events MUST include a `target` tag:

```json
["target", "<target-event-id>"]
```

Reaction `content` SHOULD be one of:

- `+`
- `-`
- a single emoji

Clients SHOULD interpret `+` as a positive reaction.

Clients SHOULD interpret `-` as a negative reaction.

Clients MAY render emoji reactions as display-only reactions without assigning a
positive or negative meaning.

Reaction `content` MUST NOT exceed 32 Unicode scalar values.

Example:

```json
{
  "kind": 3,
  "tags": [
    ["target", "<event-id>"]
  ],
  "content": "+"
}
```

## Validation

Clients and relays that understand a kind SHOULD validate kind-specific rules in
addition to [MIP-01](MIP-01.md) and [MIP-02](MIP-02.md).

Relays MAY reject events that violate kind-specific size limits.

Relays MAY store and distribute events with unknown kinds if they are otherwise
valid according to [MIP-01](MIP-01.md) and [MIP-02](MIP-02.md).

Clients SHOULD ignore kind-specific fields they do not understand.

## Security Considerations

Clients MUST treat `content` as untrusted user-generated text.

Clients MUST NOT execute scripts from event content.

Clients MUST NOT render raw HTML from post or comment content as trusted HTML.

Clients SHOULD sanitize rendered Markdown output.

Profile names are user-controlled and MUST NOT be treated as globally unique
identifiers.
