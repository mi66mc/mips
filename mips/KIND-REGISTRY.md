# Murm Event Kind Registry

This registry assigns the numeric event kinds defined by Murm Improvement
Proposals.

| Kind | Name | Defining MIP | Status | Model |
| ---: | --- | --- | --- | --- |
| `0` | `profile` | [MIP-04](MIP-04.md) | `draft` | versioned document |
| `1` | `publication` | [MIP-04](MIP-04.md) | `draft` | versioned document |
| `2` | `comment` | [MIP-04](MIP-04.md) | `draft` | immutable event |
| `3` | `reaction` | [MIP-04](MIP-04.md) | `draft` | immutable event |

An unlisted kind number has no Murm-defined meaning.

Relays MAY store an event with an unknown kind when the event is otherwise
valid. They MUST NOT claim to understand or semantically validate that kind.

Draft allocations reserve their numbers against conflicting proposals. Only
allocations from `accepted` or `final` MIPs enter a compatibility profile unless
that profile explicitly includes drafts.
