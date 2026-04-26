# MIP-05: Relay Compatibility

Status: `draft`

## Abstract

This MIP defines the minimum behavior required for a relay to be considered
core-compatible with the Murm Protocol.

Relay compatibility is not the same as relay policy. Protocol validity is
defined by the MIPs. A relay may refuse storage for operational reasons, but it
must not redefine whether an event is valid.

## Motivation

murm should not become a network where every relay behaves like a different
protocol. If relay behavior diverges too much, clients cannot reliably publish,
sync, or discover events across relays.

This MIP defines a compatibility baseline. A relay that claims core compatibility
must support the base event format, signatures, relay interface, and initial
event kinds.

## Specification

A Murm Protocol core-compatible relay MUST implement:

- [MIP-01](MIP-01.md): event format.
- [MIP-02](MIP-02.md): signatures.
- [MIP-03](MIP-03.md): relay interface.
- [MIP-04](MIP-04.md): event kinds.

### Required Operations

A compatible relay MUST support the HTTP binding defined by [MIP-03](MIP-03.md):

- `POST /submit`
- `POST /fetch`
- `POST /scan`

### Required Event Kinds

A compatible relay MUST accept valid events for all base kinds defined by
[MIP-04](MIP-04.md):

- `0`: `profile`
- `1`: `post`
- `2`: `comment`
- `3`: `reaction`

A compatible relay MAY also accept unknown or experimental kinds if the events
are valid according to [MIP-01](MIP-01.md) and [MIP-02](MIP-02.md).

### Event Validity

Event validity is protocol-level.

An event is valid when it satisfies:

- the base event format in [MIP-01](MIP-01.md);
- the signature and id rules in [MIP-02](MIP-02.md);
- any kind-specific rules understood by the relay.

A relay MUST NOT treat transport authentication, IP address, API keys, or local
accounts as proof of event authorship.

Authorship is established only by event signatures.

### No Protocol Login

A compatible relay MUST NOT require email, password, JWT, account login, or API
key authentication as part of the base Murm Protocol.

Clients publish authorship by submitting signed events.

Relays MAY use non-protocol operational protections such as rate limiting,
temporary bans, or abuse prevention. These protections MUST NOT change the event
format or signature model.

### Relay Refusal

A relay MAY refuse to store or return an otherwise valid event for operational,
abuse-prevention, storage, moderation, or legal reasons.

Refusal does not make the event invalid.

A relay SHOULD report refusal using the structured result format defined by
[MIP-03](MIP-03.md).

### Limits

A compatible relay MUST support the event size limit defined by
[MIP-01](MIP-01.md).

A compatible relay MUST support scan requests with `limit <= 100`, subject to
rate limits and operational abuse prevention.

A compatible relay MUST enforce or respect the kind-specific content limits
defined by [MIP-04](MIP-04.md) for known base kinds.

### Interoperability

Relays SHOULD keep compatibility behavior stable across deployments.

Relays SHOULD avoid rejecting valid base events only because the relay does not
need or display that kind locally.

Relays SHOULD avoid introducing required custom fields, custom authentication, or
custom event validation that prevents ordinary Murm Protocol clients from
publishing base events.

## Examples

### Valid Event Rejected By Policy

A relay may reject a valid post because a client exceeded a rate limit.

The event remains valid according to [MIP-01](MIP-01.md) and
[MIP-02](MIP-02.md), but the relay is not required to store it.

```json
{
  "results": [
    {
      "id": "<event-id>",
      "accepted": false,
      "status": "rejected",
      "reason": "rate_limited"
    }
  ]
}
```

### Invalid Event Rejected By Protocol

A relay must reject an event with an invalid signature.

```json
{
  "results": [
    {
      "id": "<event-id>",
      "accepted": false,
      "status": "rejected",
      "reason": "invalid_signature"
    }
  ]
}
```

## Validation

Clients MAY treat a relay as core-compatible when it supports the required MIPs,
required operations, and required base kinds defined in this document.

Relays SHOULD document deviations from this compatibility profile.

Relays that require protocol-level login or reject base kinds by design SHOULD
NOT claim core compatibility.

## Security Considerations

Compatibility does not require a relay to store spam, abusive traffic, or illegal
content.

Relays SHOULD protect themselves with rate limits and abuse controls.

Clients SHOULD publish important events to more than one relay.

Clients SHOULD verify event signatures locally even when events come from a
compatible relay.
