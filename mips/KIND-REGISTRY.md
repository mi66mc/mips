# Murm Event Kind Registry

Kinds are assigned by their defining MIPs, not by numeric ranges. A reservation
does not imply accepted semantics or mandatory support by every relay.

## Active draft reservation

| Kind | Name | Defining MIP | Status | Model |
| ---: | --- | --- | --- | --- |
| `1` | `publication` | [MIP-04](MIP-04.md) | `draft` | Immutable complete revisions grouped into a publication |

The rewrite keeps `1` for publications to preserve the existing draft ownership,
not wire compatibility. The event envelope, revision header, and hash input
changed. Old publication events cannot be silently reinterpreted or converted.

## Historical reservations

| Kind | Earlier draft name | Disposition |
| ---: | --- | --- |
| `0` | `profile` | Reserved from the former MIP-04; no current redesigned schema. |
| `2` | `comment` | Reserved from the former MIP-04; no current redesigned schema. |
| `3` | `reaction` | Reserved from the former MIP-04; no current redesigned schema. |

Their previous definitions remain in repository history. These numbers are
not reassigned to unrelated meanings and are not required by the candidate
core profile. Reintroducing their behavior requires a reviewed MIP.

## Areas without allocated numbers

| Area | Owning draft | Remaining prerequisite |
| --- | --- | --- |
| Public signed relay announcements | [MIP-06](MIP-06.md) | Wire fields, identity/address binding, validity, updates. |
| Private-message initialization and receiving information | [MIP-07](MIP-07.md) | Cryptographic profile and announcement formats. |
| Encrypted messages | [MIP-07](MIP-07.md) | Full packet format and session rules. |

An unassigned or unsupported number has no semantics a receiver may infer.
A structurally and cryptographically valid event of such a kind may still be
stored opaquely under local policy, but that is not semantic validation.

Identity/device authorization is not allocated or implicitly introduced by any
of these reservations. Core changes and kind evolution follow [MIP-00](MIP-00.md).
