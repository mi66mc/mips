# Murm Improvement Proposals

This directory contains the normative protocol documents for Murm.

## Reading Order

1. [MIP-00](MIP-00.md) defines proposal governance and kind allocation.
2. [MIP-01](MIP-01.md) defines the core event envelope.
3. [MIP-02](MIP-02.md) defines canonical IDs and signatures.
4. [MIP-04](MIP-04.md) defines the initial event kinds.
5. [MIP-03](MIP-03.md) defines the relay HTTP interface.
6. [MIP-05](MIP-05.md) defines the core compatibility profile.

See the [Event Kind Registry](KIND-REGISTRY.md) for all allocated kind numbers.
Normative machine-readable artifacts are stored in
[`../schemas/`](../schemas/), and cryptographic examples are stored in
[`../test-vectors/`](../test-vectors/).

## Current Proposals

| MIP | Title | Status |
| --- | --- | --- |
| [MIP-00](MIP-00.md) | MIP process | `draft` |
| [MIP-01](MIP-01.md) | Event format | `draft` |
| [MIP-02](MIP-02.md) | Signatures | `draft` |
| [MIP-03](MIP-03.md) | Relay interface | `draft` |
| [MIP-04](MIP-04.md) | Event kinds | `draft` |
| [MIP-05](MIP-05.md) | Relay compatibility | `draft` |

## Required MIP Structure

Every proposal follows [MIP-00](MIP-00.md) and contains:

1. Title
2. Status
3. Kind Allocation, when applicable
4. Abstract
5. Motivation
6. Specification
7. Canonical Examples
8. Validation
9. Relay Indexing
10. Compatibility
11. Security Considerations
12. Test Vectors

Each MIP should remain small enough to implement independently and precise
enough to produce compatible implementations in different programming
languages.
