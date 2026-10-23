# MIP-09: Connectivity, Privacy, and Blocking Resistance

Status: `draft`

## Kind Allocation

This MIP allocates no event kind. Signed relay contacts belong to MIP-06.

## Abstract

Clients use replaceable relay contacts and bounded connection failover, with
explicit treatment of IP visibility and offline operation. This is an initial
resilience layer, not a claim that HTTPS alone defeats government or provider
blocking.

## Motivation

Decentralized data is still inaccessible when a client depends on one blocked
address, one bootstrap service, or a malicious application. Network availability,
content replication, identity portability, and IP privacy are related but
different problems.

## Specification

### Client-to-relay connectivity

Clients connect outward to relays. They do not need to accept inbound
connections, expose an application port, host content for strangers, or be
online at the same time as the recipient.

A relay is a service, whether hosted on a server or a suitably configured
personal computer. Running a client does not automatically make it a relay.

The initial transport permits HTTPS. There is no mandatory Tor service,
external anonymity network, direct user-to-user link, or newly invented
anonymous-routing protocol.

### Default failover behavior

Clients should implement this initial resilience behavior by default:

1. Cache verified relay contacts; do not require a single bootstrap server
   on every startup.
2. Try alternative announced addresses for a known relay within finite budgets.
3. Be able to use other configured relays when one is unavailable.
4. Retry publication using the same signed event, not a rewritten event.
5. Allow new contacts to be imported manually by link, file, or QR code.
6. When no path works, preserve local data and queued sends without reporting
   remote storage success.

A connection failure is not proof of censorship. Timeouts and retries must
be bounded and use backoff; failover must not create unlimited fan-out.

For reading, a reachable relay needs a copy or an explicitly requested and
supported lookup path. An alternative address is not a guarantee that content
exists there.

### Real diversity

Multiple domains on one blocked IP do not avoid that IP block. Many relay keys
can belong to one operator. Address, provider, jurisdiction, and contact-source
diversity must be evaluated rather than inferred from simple counts.

A user's inability to contact A does not imply B cannot contact A from a
different network. Propagation can exploit that difference when a path exists,
but cannot guarantee it.

### IP privacy and proxies

A directly contacted relay sees the connecting IP. Users who want a different
network origin can choose a VPN or proxy; the core does not promise anonymity.

When a client offers a proxy mode, it must honor that choice for all relevant
traffic: relay requests, contact discovery, alternate addresses, and associated
network lookups. It must not silently fall back to a direct connection.
Remote media and other external fetches must not bypass the user's privacy
setting.

VPN/proxy use changes trust and connectivity, not signed-event validity.
It does not guarantee anonymity or successful access under every block.

### Threats not yet solved

The [RFC 9505 censorship survey](https://www.rfc-editor.org/rfc/rfc9505.html)
distinguishes blocking by names or destinations from traffic classification and
active probing. Multiple relay addresses do not solve all of these.

The current design has not selected a concrete transport resistant to protocol
identification, active probing, or broad destination blocking. Such transport
work needs a defined threat model, measurements, deployment strategy, and
interoperable negotiation before it becomes a protocol guarantee.

### Application and server censorship

A relay owner can refuse to serve content. Other retained reachable copies can
reduce that operator's control over availability. Another compatible app and
MIP-08 recovery can reduce dependence on an application owner.

Neither is automatic: users need usable contacts, data copies, and recovery
material. A hostile app can steal secrets or refuse export. Cryptographic
verification does not make every implementation trustworthy.

## Canonical Examples

### A is blocked, B is reachable

Bruno cannot contact A but can contact B. He submits the original signed article
to B. B may be able to propagate it to A through its own network.
Bruno's UI only confirms B's acknowledged local storage.

### No route exists

All configured addresses fail. The app keeps the signed event queued locally
and marks it pending. Importing a new relay contact can give it another address
to try; it does not guarantee a working network path.

### Proxy failure

The user selects a proxy and the proxy becomes unavailable. The client reports
the connection problem or remains offline. It does not quietly expose the
user's direct IP by retrying without the proxy.

## Validation

Before claiming these client behaviors, test cached-contact startup, bounded
address and relay failover, identical-ID publication retries, unavailable
copies, and offline queue state.

Check for proxy bypass in relay traffic, DNS resolution, imported contacts,
redirects, and external media. Separate measured failures from assumptions
about censorship.

Stronger blocking-resistance claims need tests against a concrete adversary
model; a successful ordinary HTTPS connection is not such evidence.

## Relay Indexing

No event indexes are added. Local connectivity state is not signed event data.
Relay identities and addresses follow MIP-06.

## Compatibility

These behaviors do not alter event IDs, require client hosting, or impose an
external anonymity service. Future transports must preserve event verification
and specify their negotiation without silently downgrading privacy settings.

## Security Considerations

Transport encryption does not hide every network destination or public event
relationship. Failover can disclose requests to additional operators.
Cached contacts can become stale or malicious; verify their identity and
validity under the eventual MIP-06 profile.

When all paths are blocked or all copies are gone, the protocol cannot promise
remote access. “Censorship resistant” must be stated with these limitations,
not as “impossible to censor.”

## Open Decisions

Choose stronger transport mechanisms and a concrete censorship threat model;
define transport capability negotiation and downgrade handling. Finalize
contact expiry/address authentication in MIP-06 and evaluate operational
diversity, safe proxy integration, and privacy of failover defaults.
