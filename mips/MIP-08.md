# MIP-08: Portability and Key Management Guidance

Status: `draft`

## Kind Allocation

No event kinds, endpoints, or backup formats are allocated.

## Abstract

This MIP gives non-normative guidance for applications and users. Protocol
identity is the public signing key; custody, recovery, backup, and device
management are higher-layer responsibilities.

## Motivation

Applications should explain what users control and what they can recover.
Those product choices must not become mandatory relay operations or a central
identity/recovery service.

## Specification

This is guidance, not additional wire-format conformance.

### Identity and signing

An app may hold a key locally or integrate with an external signer.
The protocol verifies the resulting event with `signer` regardless of where
the secret is managed. Another application using the same key has the same
protocol identity. A different key is another identity.

The protocol provides no password reset, key escrow, device registry,
delegation, or automatic reassignment of earlier publications to a new key.
A higher layer can offer its own key-management tools; the basic event format
does not claim to validate those tools or infer their authority.

### History and backup

Recovering an identity secret does not recreate discarded private-message
keys. A readable old device or a suitable application backup may recover
included history; relay ciphertext alone cannot recover missing secrets.

Applications may offer encrypted files, protected device transfer, external
key-management services, or no backup. Their formats, ciphers, passwords,
recovery secrets, and storage destinations are not standardized here.
There is no mandatory Murm backup package or cloud service.

Recommended application behavior includes authenticated encrypted backups,
clear descriptions of what data is included, and separation of history-recovery
secrets from the signing key where appropriate.

### Restore and application trust

Restoring stale live message-session state on multiple active devices can
break the session's security assumptions. Apps should coordinate with the
eventual MIP-07 session rules and establish fresh sessions where needed.
Murm does not expose an endpoint to upload private keys to a relay.

An application with access to a secret or plaintext can leak it.
Compatibility does not certify app honesty or require all apps to implement
every optional feature. Recovery material is useful only if the user has it
before access is lost. Recovering a lost key does not revoke a stolen copy.

## Canonical Examples

Ana switches apps and uses the same key through an external signing tool.
Her new events have the same `signer`. Previously published events remain
verifiable where retained copies exist.

If Ana imports only her signing key, the new app cannot reconstruct old
message keys already erased. If she has a usable application backup, it can
restore the data that backup contains, according to that application's rules.

## Validation

No backup conformance test is imposed by the protocol. Protocol implementations
continue to validate event envelopes, hashes, signatures, and implemented kinds.
Apps can independently test export/import, wrong-password rejection, corrupted
backup handling, and safe session restoration.

## Relay Indexing

No indexes or relay operations are added.

## Compatibility

No application needs a central token or approval to implement Murm.
This guidance replaces the earlier draft proposal for a protocol-defined
interoperable backup format. That format is deliberately outside current scope,
not an unresolved blocker for publication-protocol implementation.

## Security Considerations

An identity backup can restore control after loss but cannot exclude an attacker
who also has the secret. A readable history backup can expose old messages even
when the live session erased earlier keys. Users and applications choose how
to balance recoverability and exposure.
