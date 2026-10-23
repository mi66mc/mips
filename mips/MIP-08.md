# MIP-08: Portability and Encrypted Backup

Status: `draft`

## Kind Allocation

This MIP allocates no network event kind. A user-held backup is not automatically
a published event.

## Abstract

Users should be able to change compatible applications without obtaining a
central account or losing control of their identity. Identity recovery and
private-history recovery are distinct capabilities.

## Motivation

Decentralized storage alone does not prevent application lock-in. Users need
documented, interoperable export and recovery under their control, while backup
design must not undo message-key deletion or clone unsafe active session state.

## Specification

### Portable identity and data

Applications implement public, documented identity import/export and recovery
formats. Developing a compatible application requires no central API token or
approval service.

Changing applications does not inherently require a new identity. Public events
can be recovered from available copies and verified. Private history requires
the necessary local secrets, a protected device transfer, or an appropriate
backup; it cannot always be reconstructed from relay ciphertext.

Portability applies to capabilities both applications support. It does not
require every app to implement every kind, presentation, or optional feature.

The exact export formats remain open. Root/device-key delegation is not assumed.

### Identity versus private history

| Available material | What it can restore |
| --- | --- |
| Identity secret or identity recovery material | Identity control as defined by the future lifecycle rules; not automatically deleted message keys. |
| Old device with readable history | History that can be transferred through a protected procedure. |
| Encrypted backup and its recovery secret | The historical data included in that backup. |
| Relay ciphertext without required secrets | No recovery of otherwise undecryptable messages. |

Recovering a lost key does not revoke a stolen copy. Recovery after theft needs
a separately specified authority/rotation mechanism, not merely a backup file.

### Optional local backup

The starting point is an encrypted file held by the user. No cloud account,
backup server, or network publication is mandatory.

The backup is protected by a recovery secret separate from the identity signing
key. Possession of the identity secret alone must not be represented as enough
to decrypt private-history backups.

The format must authenticate its contents and version, bound resource use,
and define encryption and key derivation before interoperability is claimed.
This draft does not select a password scheme, recovery phrase format, cipher,
or key-derivation parameters.

A backup includes only its declared historical scope. Losing newer messages
than the last backup is possible; restored apps must not fabricate completeness.

### Transfer and restore

If the old device is available, a protected transfer can supply history.
Otherwise a usable backup may supply it. If neither exists and the needed
secrets have been erased, the history cannot be recovered from the network.

Restoring history must not clone a stale active session into multiple live
devices. Establish new messaging sessions under the eventual MIP-07 procedure.
How contacts learn of that session change still needs specification.

No private signing or decryption secret is sent to a relay as a routine step
of import, export, or recovery.

### Application trust

An application with access to secrets or plaintext can misuse them. Protocol
compatibility is not proof of application honesty. A malicious or unavailable
app may refuse to export; users need recovery material before access is lost.

Apps should make export scope and recovery consequences understandable:
identity, public data, historical private data, and live session state are not
interchangeable items.

## Canonical Examples

Ana has an encrypted history backup and its separate recovery secret. She
imports her identity into a new compatible app, opens the backup locally, and
recovers the history it includes. The app establishes new message sessions.

If she has only her identity key, it may let her continue signing under the
same identity, but does not reconstruct message keys previously discarded.
If someone obtains both the backup and its decryption secret, its included
history is exposed even if the live session deleted older keys.

## Validation

Before accepting a format, verify:

- Round-trip export/import across independent apps.
- Identity-only recovery does not claim private-history recovery.
- Wrong-secret, altered-file, truncation, and unsupported-version failure.
- Bounded parsing and key-derivation costs for hostile backup files.
- Recovery of the declared scope without silently activating stale session state.
- No secret upload to relays.
- Explicit treatment of unsupported optional MIPs and partial imports.

## Relay Indexing

No indexes or relay endpoints are added. Backup files are user-controlled
artifacts, not a new universal event attachment.

## Compatibility

MIP-08 records the portability contract, not a finalized file format.
Experimental formats must be identified as experimental. Applications cannot
claim cross-app backup compatibility until those formats and cryptography
are fixed and verified.

## Security Considerations

A backup creates an additional copy of sensitive history. Anyone obtaining it
and its recovery secret can access that history. Encrypting a backup does not
protect an already compromised device while it is unlocked.

Independent recovery secrets reduce some correlated compromise risks but
create another item the user must protect and preserve.

## Open Decisions

Define identity recovery/export encoding, optional history format, authenticated
encryption, key derivation, versioning, scope manifests, partial-import rules,
and protected device transfer. Resolve the MIP-07 session-reinitialization and
identity/device lifecycle dependencies without cloning live ratchet state.
