# Murm Improvement Proposals

These MIPs contain the October 2026 redesign. They replace the previous
experimental draft rather than extending its ten-field event, array hash,
batch API, or predecessor chains.

All proposals remain `draft`. Some define concrete wire behavior; others record
architecture with explicit Open Decisions. No accepted compatibility profile
or complete private-message cryptographic suite is claimed.

## Reading order

1. [MIP-00](MIP-00.md): proposal process and kind ownership.
2. [MIP-01](MIP-01.md) and [MIP-02](MIP-02.md): envelope and verification.
3. [MIP-03](MIP-03.md): publication, local query, sync, and capability boundaries.
4. [MIP-04](MIP-04.md): articles, revision conflicts, withdrawal, and current view.
5. [MIP-06](MIP-06.md): discovery, propagation, recovery, and bounded lookup.
6. [MIP-07](MIP-07.md) and [MIP-08](MIP-08.md): private messages and portability.
7. [MIP-09](MIP-09.md): connectivity, privacy, and remaining blocking threats.
8. [MIP-05](MIP-05.md): candidate compatibility profile and readiness gaps.

## Proposal index

| MIP | Title | Status |
| --- | --- | --- |
| [MIP-00](MIP-00.md) | MIP Process | `draft` |
| [MIP-01](MIP-01.md) | Event Format | `draft` |
| [MIP-02](MIP-02.md) | Event IDs and Signatures | `draft` |
| [MIP-03](MIP-03.md) | Relay HTTP Interface | `draft` |
| [MIP-04](MIP-04.md) | Publications and Revisions | `draft` |
| [MIP-05](MIP-05.md) | Compatibility and Trust Boundaries | `draft` |
| [MIP-06](MIP-06.md) | Relay Discovery and Event Exchange | `draft` |
| [MIP-07](MIP-07.md) | Private Messaging | `draft` |
| [MIP-08](MIP-08.md) | Portability and Encrypted Backup | `draft` |
| [MIP-09](MIP-09.md) | Connectivity, Privacy, and Blocking Resistance | `draft` |

The [kind registry](KIND-REGISTRY.md) distinguishes active draft reservations
from historical reservations and unassigned future kinds.
The [Portuguese architecture overview](../ARCHITECTURE-DRAFT.md) explains the
decisions and records which additional choices this rewrite made explicit.

## Structure and review

Each MIP follows MIP-00: status, allocation, abstract, motivation, specification,
canonical examples, validation, relay indexing, compatibility, and security.
Incomplete drafts explicitly state what must be decided before acceptance.

Examples are inline. Fragments and placeholder values are labeled; only
complete cryptographic examples claim reproducible IDs/signatures.
There are no required external schemas, test-vector packages, or generators.

Review the protocol across MIP boundaries: storing a kind does not imply
semantic validation or indexed queries; local acknowledgement is not delivery;
a current view is not raw history; sync order is not author time; ciphertext
storage is not a complete private-message security profile.
