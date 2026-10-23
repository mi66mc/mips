# MIP-07: Private Messaging

Status: `draft`

## Kind Allocation

This MIP will own private-message and signed setup/receiving-information kinds.
Their numbers and complete wire formats are not allocated yet.

## Abstract

Clients encrypt messages locally and use relays for asynchronous storage and
delivery attempts. The design includes evolving session keys and signed
prepublished initialization material, while accepting public sender/recipient
metadata in the initial version.

## Motivation

A private conversation cannot simply be a public article whose body is hidden.
It needs authenticated key setup, message-key evolution, replay and ordering
rules, and carefully separated identity and history recovery.

## Specification

### Scope and visibility

A private-message event uses the common MIP-01 envelope. Its MIP-defined public
header identifies the recipient; its content carries the encrypted package.
This does not create a recipient field for unrelated kinds.

The outer signer, recipient identity, declared time, and approximate packet
size are public in this initial direction. Relays may store and replicate
ciphertext but should not possess plaintext or private decryption secrets.

This is content confidentiality, not relationship anonymity. MIP-09 separately
describes IP visibility and user-selected VPN/proxy use.

### Receiving relays and recipient identity

The recipient publishes receiving information and encryption-key material
authenticated by the intended identity. The exact announcement schema and
update rules remain open.

A sending app attempts normal `POST /events` submission to at least one relay
the recipient says they monitor; it does not rely exclusively on random
propagation reaching an arbitrary destination.

The sender must establish which identity belongs to the intended person.
A valid signature from an unknown key is not proof that it belongs to “Ana.”
Key-substitution protection and the binding between signing identity and
encryption keys must be part of the final profile.

A storage acknowledgement is not delivery or reading. Offline receipt depends
on reachable retained copies and the recipient still possessing the necessary
secrets.

### Evolving sessions

Use an established session/ratchet construction with evolving per-message keys
and deletion of secrets that are no longer required. Do not invent a new cipher
from this architecture description.

[Double Ratchet](https://signal.org/docs/specifications/doubleratchet/) is a
design reference, not a complete selected Murm cryptographic profile. It needs
authenticated initialization and concrete choices for algorithms, state,
serialization, and limits.

Using [HPKE alone](https://www.rfc-editor.org/rfc/rfc9180.html#section-9.7.4)
with a persistent receiving private key does not provide the desired protection
of old ciphertext against later compromise of that recipient key.

Forward-secrecy claims require actual deletion of the relevant secrets.
They do not protect plaintext history, readable backups, or a device while
an attacker controls it. Recovery after live compromise is a separate property,
not automatically guaranteed by mentioning a ratchet.

### Asynchronous initialization

The recipient can be offline when a conversation starts:

1. Publish signed public initialization material with validity before going offline.
2. Keep its private parts locally.
3. The sender verifies the intended identity, binding, and validity.
4. The first encrypted message identifies the announcement/material used.
5. The recipient later derives the initial session and advances it for subsequent
   messages according to the selected protocol.

The initial direction uses periodically renewed, reusable signed prekeys.
A prekey is initialization material published ahead of a conversation.
Replicated relays do not provide a global one-time-consumption guarantee.

[X3DH](https://signal.org/docs/specifications/x3dh/) is a reference for
authenticated asynchronous setup and its limitations. This does not adopt the
Signal service, nor automatically select a complete X3DH/Double Ratchet suite.

### Accepted initialization exposure window

While the private initialization secrets needed to reconstruct an initial
session are retained, their compromise can expose the relevant initial
messages. Erasing individual message keys alone does not eliminate this risk.
Protection also depends on deleting the relevant initialization secrets.

A grace period permits delayed initial messages but extends that exposure.
Once required secrets are erased, some sufficiently late messages may become
undecryptable. The MIP must define the lifetime/grace tradeoff explicitly;
it must not promise both indefinite delayed delivery and immediate deletion.

### State, replay, and restoration

The final profile must authenticate the intended identities and relevant outer
event context, reject replay, bound out-of-order key storage, and persist
session advancement safely across crashes.

Repeated transport delivery does not authorize repeated application processing.
Event ID deduplication is useful but cannot replace cryptographic replay rules.

MIP-08 restores historical data and establishes new sessions; restoring a stale
live ratchet into two active devices is not an approved backup procedure.
Concurrent-device messaging remains a separate unresolved design.

## Canonical Examples

This is an illustrative fragment, not an interoperable encrypted message:

```json
{
  "header": {"recipient": "<recipient identity key>"},
  "content": "<encrypted package>"
}
```

Ana publishes signed setup material and receiving-relay information, then goes
offline. Bruno verifies it, creates a first encrypted message, and posts it to
one of those relays. Ana retrieves it later and processes the session locally.

A relay can observe the public identities and store the packet. It cannot be
trusted to prove it delivered all messages. No example ciphertext is supplied
because the cryptographic profile has not been selected.

## Validation

Relays verify the outer event and any public structure that the final MIP
defines. This does not let a relay validate plaintext or successful decryption.

Clients additionally validate recipient identity, announcement validity,
authenticated context, initialization, and session messages. They fail closed
on authentication failure and must not silently downgrade encryption.

Before acceptance, review loss, replay, out-of-order arrival, old setup material,
crash recovery, secret deletion, restoration, and device compromise against the
exact chosen cryptographic construction.

## Relay Indexing

The intended public metadata includes a recipient identifier. Its final path,
type, announcement relationships, and kind allocation are still to be frozen.
Relays cannot query encrypted message text through the core interface.

## Compatibility

This is an architectural draft, not a wire-ready messaging specification.
Implementations cannot claim MIP-07 encryption interoperability by selecting
their own unadvertised package format or algorithms.

The core signature scheme is not the message key-agreement scheme. No root or
device-key authorization mechanism is implicitly added to the event envelope.

## Security Considerations

Relays can omit, delay, reorder, replay, or delete events. A malicious app with
access to local plaintext or secrets can leak them. Encrypted backups can expose
included history when their recovery secret is also compromised.

Public recipient and signer metadata permits correlation. Recipient relay
announcements can reveal where users receive messages. Encryption does not
prevent spam, traffic analysis, or all attacks against endpoints.

## Open Decisions

Choose and review the exact key-agreement/ratchet composition, algorithms,
encodings, identity bindings, associated authenticated data, setup-event
schema, announcement update rules, and kind allocations. Define prekey validity
and grace, replay identifiers, skipped-key bounds, crash-safe state transitions,
reinitialization, and multi-device behavior before implementing production DMs.
