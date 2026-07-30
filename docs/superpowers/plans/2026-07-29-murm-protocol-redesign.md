# Murm Protocol Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current Nostr-shaped Murm drafts with a structured, testable protocol based on immutable signed events, MIP-defined `header` and `content` schemas, versioned documents, and a modern HTTP relay API using `QUERY`.

**Architecture:** The core MIPs define one fixed event envelope and deterministic cryptographic validation. Kind MIPs define all public headers and content bodies. Relays accept single or batch submissions through `POST`, fetch immutable events through `GET`, and execute structured safe queries through HTTP `QUERY`, with a `POST` compatibility fallback.

**Tech Stack:** Markdown specifications, JSON Schema 2020-12, JSON Canonicalization Scheme (RFC 8785), SHA-256, Ed25519, HTTP Semantics (RFC 9110), HTTP QUERY (RFC 10008), Problem Details (RFC 9457), Node.js built-ins for deterministic test-vector verification.

## Global Constraints

- There is no protocol login, password, session, JWT, account server, or trusted identity service.
- All protocol events are immutable.
- Kind numbers and semantics are allocated only through MIPs.
- The event envelope is `version`, `id`, `author`, `signer`, `authorization`, `created_at`, `kind`, `header`, `content`, and `signature`.
- `header` and `content` are validated by the MIP that owns the event kind.
- Core version 1 accepts only direct signatures: `signer == author` and `authorization == null`.
- The serialized event limit remains 2 MiB.
- Relays never query or index `/content` as part of the core compatibility profile.
- Cryptographic rules require deterministic, language-independent test vectors.
- Device authorization and encrypted messages are separate follow-up plans.

---

## Target File Structure

```text
README.md
docs/
  superpowers/
    specs/
      2026-07-29-murm-protocol-redesign-design.md
    plans/
      2026-07-29-murm-protocol-redesign.md
mips/
  README.md
  MIP-00.md
  MIP-01.md
  MIP-02.md
  MIP-03.md
  MIP-04.md
  MIP-05.md
  KIND-REGISTRY.md
schemas/
  event-v1.schema.json
  query-v1.schema.json
  relay-info-v1.schema.json
  kinds/
    profile-v1.schema.json
    publication-v1.schema.json
    comment-v1.schema.json
    reaction-v1.schema.json
test-vectors/
  mip-02-event-v1.json
tools/
  generate-vectors.mjs
```

The MIPs remain the normative prose. JSON Schemas are normative structural
artifacts. Test vectors are normative cryptographic artifacts. The Node tool
only reproduces and checks the committed vectors.

---

### Task 1: Establish the MIP process and kind registry

**Files:**

- Create: `mips/MIP-00.md`
- Create: `mips/KIND-REGISTRY.md`
- Modify: `mips/README.md`

**Interfaces:**

- Consumes: Existing MIP statuses and repository conventions.
- Produces: The required MIP structure, kind-allocation rules, and the stable
  initial allocation `0` through `3`.

- [ ] **Step 1: Write MIP-00**

Define these required sections for every proposal:

```text
Title
Status
Kind Allocation (when applicable)
Abstract
Motivation
Specification
Canonical Examples
Validation
Relay Indexing
Compatibility
Security Considerations
Test Vectors
```

Define statuses as `draft`, `accepted`, `final`, `deprecated`, and `rejected`.
A draft may reserve an unallocated kind number in the registry. Only accepted
or final MIPs are part of a compatibility profile. Breaking semantic changes
require a new kind number; editorial corrections do not.

- [ ] **Step 2: Create the kind registry**

Start `mips/KIND-REGISTRY.md` with:

| Kind | Name | Defining MIP | Status | Model |
| ---: | --- | --- | --- | --- |
| `0` | `profile` | MIP-04 | draft | versioned document |
| `1` | `publication` | MIP-04 | draft | versioned document |
| `2` | `comment` | MIP-04 | draft | immutable event |
| `3` | `reaction` | MIP-04 | draft | immutable event |

State that an unlisted number has no Murm-defined meaning. Relays may store an
unknown kind but must not claim to understand or validate its semantics.

- [ ] **Step 3: Update the MIP directory guide**

Replace the current “Suggested Structure” section with MIP-00's mandatory
structure and link the kind registry.

- [ ] **Step 4: Verify the registry**

Run:

```powershell
rg -n "\| `0`|\| `1`|\| `2`|\| `3`" mips/KIND-REGISTRY.md
```

Expected: exactly four allocation rows, each pointing to MIP-04.

- [ ] **Step 5: Commit**

```powershell
git add mips/MIP-00.md mips/KIND-REGISTRY.md mips/README.md
git commit -m "docs: define MIP governance and kind registry"
```

---

### Task 2: Rewrite the core event format

**Files:**

- Modify: `mips/MIP-01.md`
- Create: `schemas/event-v1.schema.json`

**Interfaces:**

- Consumes: Kind ownership rules from MIP-00.
- Produces: `Event` version 1 and the structural validation required by every
  later MIP and relay.

- [ ] **Step 1: Replace the event type**

Specify this exact envelope:

```ts
type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue }

type Event = {
  version: 1
  id: string
  author: string
  signer: string
  authorization: string | null
  created_at: number
  kind: number
  header: Record<string, JsonValue>
  content: JsonValue
  signature: string
}
```

Document lowercase hexadecimal lengths:

- `id`: 64 characters.
- `author`: 64 characters.
- `signer`: 64 characters.
- `authorization`: `null` or 64 characters.
- `signature`: 128 characters.

Require `created_at` and `kind` to be non-negative safe integers. Require
`version` to equal `1`. Reject unknown top-level fields. Limit the complete JSON
event received on the wire to 2 MiB.

- [ ] **Step 2: Define direct authorship**

For core version 1 require:

```text
signer == author
authorization == null
```

Explain that the fields are present now to avoid an envelope change when the
device-authorization MIP is introduced. Until then, a delegated event is
structurally recognizable but invalid under the core compatibility profile.

- [ ] **Step 3: Define kind-controlled data**

State that MIP-01 only requires `header` to be an object and `content` to be a
JSON value. The owning kind MIP controls required properties, extra properties,
data types, limits, and semantic validation. Remove positional tags and
`content_type`.

- [ ] **Step 4: Add the JSON Schema**

Create a JSON Schema 2020-12 object with:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://murm.dev/schemas/event-v1.schema.json",
  "type": "object",
  "required": [
    "version",
    "id",
    "author",
    "signer",
    "authorization",
    "created_at",
    "kind",
    "header",
    "content",
    "signature"
  ],
  "additionalProperties": false
}
```

Use `const: 1` for `version`, `^[0-9a-f]{64}$` for IDs and public keys,
`^[0-9a-f]{128}$` for signatures, `minimum: 0` for integers, and `type: object`
for `header`. Do not constrain `content` beyond valid JSON in the core schema.

- [ ] **Step 5: Validate the schema file**

Run:

```powershell
node -e "JSON.parse(require('fs').readFileSync('schemas/event-v1.schema.json','utf8')); console.log('valid JSON')"
```

Expected: `valid JSON`.

- [ ] **Step 6: Commit**

```powershell
git add mips/MIP-01.md schemas/event-v1.schema.json
git commit -m "docs: redesign the core event envelope"
```

---

### Task 3: Specify canonical IDs and signatures with reproducible vectors

**Files:**

- Modify: `mips/MIP-02.md`
- Create: `tools/generate-vectors.mjs`
- Create: `test-vectors/mip-02-event-v1.json`

**Interfaces:**

- Consumes: The MIP-01 event fields.
- Produces: `canonicalPayload(event) -> Uint8Array`,
  `eventId(event) -> 32 bytes`, and signature-validation vectors used by relay
  implementations.

- [ ] **Step 1: Define the canonical unsigned payload**

Specify the exact ordered array:

```json
[
  1,
  "<author>",
  "<signer>",
  null,
  1710000000,
  1,
  {},
  "hello murm"
]
```

The positions are:

```text
version, author, signer, authorization, created_at, kind, header, content
```

Apply RFC 8785 JCS recursively, encode the result as UTF-8 without a BOM, reject
duplicate object keys, reject `NaN`, infinities, unsafe integers, lone Unicode
surrogates, and negative zero.

- [ ] **Step 2: Define hashing and signing**

Use:

```text
id = lowercase_hex(SHA-256(canonical_payload_bytes))
signature = lowercase_hex(Ed25519_sign(private_signer_key, raw_id_bytes))
```

Validation recalculates the ID before verifying the signature. It never signs
the hexadecimal ID string and never includes `id` or `signature` in the
canonical payload.

- [ ] **Step 3: Implement the vector generator**

Create `tools/generate-vectors.mjs` using only `node:crypto`, `node:fs`, and
`node:assert`. Expose:

```js
canonicalize(value)
canonicalPayload(event)
calculateId(event)
signId(idBytes, privateKey)
verifyVector(vector)
```

Use the RFC 8032 test seed
`9d61b19deffd5a60ba844af492ec2cc44449c5697b326919703bac031cae7f60` and
public key
`d75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a`.
Construct Ed25519 PKCS#8 and SPKI keys from those fixed bytes. The script writes
the vector file by default and verifies the committed file when called with
`--check`.

- [ ] **Step 4: Add vector cases**

Commit cases named:

```text
basic_publication
reordered_header_keys_same_id
unicode_preserved
changed_content_changes_id
tampered_signature_rejected
negative_zero_rejected
unsafe_integer_rejected
```

Each valid case includes the input event without `id` and `signature`, canonical
UTF-8 text, expected ID, and expected signature. Invalid cases include
`error_code`.

- [ ] **Step 5: Verify deterministic output**

Run:

```powershell
node tools/generate-vectors.mjs --check
```

Expected: exit code `0` and `7 vectors verified`.

- [ ] **Step 6: Commit**

```powershell
git add mips/MIP-02.md tools/generate-vectors.mjs test-vectors/mip-02-event-v1.json
git commit -m "docs: define canonical event cryptography"
```

---

### Task 4: Rewrite the initial kinds and document model

**Files:**

- Modify: `mips/MIP-04.md`
- Create: `schemas/kinds/profile-v1.schema.json`
- Create: `schemas/kinds/publication-v1.schema.json`
- Create: `schemas/kinds/comment-v1.schema.json`
- Create: `schemas/kinds/reaction-v1.schema.json`

**Interfaces:**

- Consumes: MIP-01 `header`/`content` ownership and MIP-02 event IDs.
- Produces: Exact schemas and relay-indexable paths for kinds `0` through `3`.

- [ ] **Step 1: Define the common document header**

Use:

```ts
type DocumentHeader = {
  document: string
  revision: number
  previous: string | null
}
```

Require a 64-character lowercase hexadecimal document ID, revision `1` with
`previous: null`, and later revisions to reference revision `n - 1` from the
same `author`, `kind`, and `document`.

Resolve the current state by greatest valid revision, then lexicographically
lowest event ID for equal-height branches. An event with an unavailable
predecessor remains unresolved.

- [ ] **Step 2: Define kind 0 `profile`**

Use `DocumentHeader` without additional header fields. Derive the one allowed
profile document ID as:

```text
lowercase_hex(SHA-256(UTF-8("murm:profile:v1:" + author)))
```

Define content:

```ts
type ProfileContent = {
  name: string
  about?: string
  picture?: string
}
```

Limit `name` to 1–80 Unicode scalar values, `about` to 2 KiB UTF-8, `picture`
to an absolute `https` URL, and the complete content to 8 KiB.

- [ ] **Step 3: Define kind 1 `publication`**

Use:

```ts
type PublicationHeader = DocumentHeader & {
  title?: string
  summary?: string
  topics?: string[]
  language?: string
}
```

Make `content` a Markdown-compatible string up to 1 MiB UTF-8. Keep `title`
optional so one kind supports both short posts and long articles. Limit title
to 200 Unicode scalar values, summary to 500, topics to 20 unique strings of
1–64 scalar values, and language to a valid BCP 47 tag.

Declare these indexable paths:

```text
/header/document
/header/revision
/header/topics
/header/language
```

Declare `/header/revision` sortable. Do not require relays to index title or
full text.

- [ ] **Step 4: Define kind 2 `comment`**

Use immutable events with:

```ts
type CommentHeader = {
  root: {
    author: string
    kind: 1
    document: string
  }
  parent: string | null
}
```

`parent` is `null` for a direct reply and an event ID for a reply to a comment.
Content is Markdown-compatible text up to 128 KiB. Index
`/header/root/author`, `/header/root/document`, and `/header/parent`.

- [ ] **Step 5: Define kind 3 `reaction`**

Use:

```ts
type ReactionHeader = {
  target:
    | { type: "event"; id: string }
    | {
        type: "document"
        author: string
        kind: number
        document: string
      }
}
```

Content is `+`, `-`, or an emoji string containing at most 32 Unicode scalar
values. Index
`/header/target/type`, `/header/target/id`, and
`/header/target/document` when present.

- [ ] **Step 6: Create the four JSON Schemas**

Each schema references `../event-v1.schema.json`, fixes `kind` with `const`,
defines its exact `header` and `content`, and uses
`additionalProperties: false` for all kind-owned objects. Use `oneOf` for the
reaction target variants.

- [ ] **Step 7: Parse every schema**

Run:

```powershell
node -e "for(const f of require('fs').readdirSync('schemas/kinds')) JSON.parse(require('fs').readFileSync('schemas/kinds/'+f,'utf8')); console.log('4 schemas parsed')"
```

Expected: `4 schemas parsed`.

- [ ] **Step 8: Commit**

```powershell
git add mips/MIP-04.md schemas/kinds
git commit -m "docs: define structured initial event kinds"
```

---

### Task 5: Replace the relay API with resource-oriented HTTP and QUERY

**Files:**

- Modify: `mips/MIP-03.md`
- Create: `schemas/query-v1.schema.json`
- Create: `schemas/relay-info-v1.schema.json`

**Interfaces:**

- Consumes: MIP-01 validation, MIP-02 signatures, and MIP-04 indexable header
  paths.
- Produces: Relay discovery, storage, exact fetch, batch submission, structured
  query, pagination, and error contracts.

- [ ] **Step 1: Define relay discovery**

Specify `GET /info` returning:

```json
{
  "protocol": "murm",
  "versions": [1],
  "mips": [1, 2, 3, 4, 5],
  "limits": {
    "event_bytes": 2097152,
    "batch_events": 100,
    "query_conditions": 20,
    "query_groups": 10,
    "query_limit": 100
  },
  "features": {
    "http_query": true,
    "post_query_fallback": true
  }
}
```

Create `relay-info-v1.schema.json` with these required fields while allowing
additional future `features`.

- [ ] **Step 2: Define event submission**

Specify `POST /events` with `events` containing 1–100 items. A valid request
envelope receives `200` and a result for every input event. An array containing
one item is the single-event form; larger arrays are batches:

```ts
type SubmitResult = {
  id: string | null
  accepted: boolean
  status: "stored" | "duplicate" | "rejected"
  reason?: string
}
```

Malformed request envelopes use HTTP errors. Individual event failures remain
inside `results`. Repeating a previously accepted event returns `duplicate`, so
the event ID itself provides application-level idempotency.

- [ ] **Step 3: Define immutable fetch**

Specify `GET /events/{id}`, returning `200` or `404`. Successful responses use:

```text
ETag: "<event-id>"
Cache-Control: public, max-age=31536000, immutable
```

Require `If-None-Match` support with `304`.

- [ ] **Step 4: Define HTTP QUERY as the primary search method**

Specify `QUERY /events` according to RFC 10008 with:

```text
Content-Type: application/vnd.murm.query+json
Accept: application/json
```

Also require `POST /events/query` as the compatibility alias. Require clients
to prefer `QUERY` and fall back only after `405`, `501`, or a method-specific
transport rejection.

Specify `OPTIONS /events`:

```text
Allow: POST, QUERY, OPTIONS
Accept-Query: "application/vnd.murm.query+json"
```

Specify `OPTIONS /events/{id}` with
`Allow: GET, HEAD, OPTIONS`.

Document that browser clients will perform a CORS preflight for `QUERY`, and a
relay serving browsers must include `QUERY` in
`Access-Control-Allow-Methods`.

- [ ] **Step 5: Define the query language**

Use:

```ts
type EventQuery = {
  where: Array<{
    all: Array<{
      path: string
      op: "eq" | "in" | "contains" | "exists" | "gte" | "lte"
      value: JsonValue
    }>
  }>
  sort?: Array<{
    path: string
    direction: "asc" | "desc"
  }>
  limit?: number
  cursor?: string | null
}
```

`where` groups are OR; `all` conditions are AND. Paths are RFC 6901 JSON
Pointers. Core indexable paths are `/id`, `/author`, `/signer`,
`/created_at`, and `/kind`; MIP-04 contributes its declared `/header` paths.
Reject `/content` queries.

Limit the request to 10 groups, 20 conditions per group, 3 sort fields, and
100 returned events. Default to 20 results sorted by `/created_at` descending
then `/id` ascending. Always append `/id` ascending as a deterministic
tie-breaker.

- [ ] **Step 6: Define pagination**

Return:

```json
{
  "events": [],
  "page": {
    "next": null,
    "has_more": false
  }
}
```

Cursors are opaque, scoped to one relay, and bound to the RFC 8785 canonical
query with `cursor` omitted. Reusing a cursor with any changed filter, sort, or
limit returns `422 invalid_cursor`. Do not return a total count.

- [ ] **Step 7: Add normative query examples**

Include complete requests for:

1. publications by one author;
2. publications containing a topic;
3. comments for one publication document;
4. reactions targeting an event;
5. all revisions of one document sorted by revision;
6. two OR branches using separate `where` groups;
7. pagination using the returned cursor.

- [ ] **Step 8: Define Problem Details errors**

Use RFC 9457 `application/problem+json` with stable `code` and optional JSON
Pointer `pointer`. Define:

```text
invalid_json
invalid_request
invalid_event
invalid_signature
unsupported_version
unsupported_kind
unsupported_filter
invalid_cursor
limit_exceeded
policy_rejected
rate_limited
temporarily_unavailable
```

Do not expose stack traces, database identifiers, SQL, cursor internals, or
moderation internals.

- [ ] **Step 9: Create the query schema**

Create `query-v1.schema.json` with the exact group, condition, operator, sort,
limit, and cursor constraints above. Require `value` for every operator. For
`exists`, require a boolean; for `in`, require a non-empty array; for `gte` and
`lte`, require a number.

- [ ] **Step 10: Validate the HTTP schemas**

Run:

```powershell
node -e "for(const f of ['schemas/query-v1.schema.json','schemas/relay-info-v1.schema.json']) JSON.parse(require('fs').readFileSync(f,'utf8')); console.log('HTTP schemas parsed')"
```

Expected: `HTTP schemas parsed`.

- [ ] **Step 11: Commit**

```powershell
git add mips/MIP-03.md schemas/query-v1.schema.json schemas/relay-info-v1.schema.json
git commit -m "docs: define the HTTP QUERY relay interface"
```

---

### Task 6: Rebuild the compatibility profile and repository guide

**Files:**

- Modify: `mips/MIP-05.md`
- Modify: `README.md`
- Modify: `mips/README.md`

**Interfaces:**

- Consumes: MIP-00 through MIP-04 and all normative artifacts.
- Produces: One unambiguous definition of a core-compatible version 1 relay.

- [ ] **Step 1: Rewrite MIP-05**

Require a compatible relay to:

```text
validate MIP-01 envelope version 1
validate MIP-02 IDs and direct signatures
implement every required MIP-03 endpoint
support HTTP QUERY and its POST fallback
validate kinds 0 through 3 from MIP-04
advertise versions, MIPs, and limits through GET /info
return RFC 9457 request-level errors
store duplicate event IDs idempotently
apply deterministic query ordering and opaque cursors
```

Keep protocol validity separate from local relay policy. A relay may refuse
otherwise valid data, but it may not call that data cryptographically invalid.

- [ ] **Step 2: Rewrite the root overview**

Update the event example, remove positional tags, describe `header` and
`content`, add the HTTP endpoint table, and link schemas and test vectors.
State clearly that the repository specifies a protocol and does not yet contain
a relay or client implementation.

- [ ] **Step 3: Update reading order**

Use:

```text
MIP-00 — governance and allocations
MIP-01 — event envelope
MIP-02 — IDs and signatures
MIP-04 — initial kinds
MIP-03 — relay HTTP interface
MIP-05 — compatibility profile
```

- [ ] **Step 4: Check links and stale vocabulary**

Run:

```powershell
rg -n "tags:|EventFilter|POST /submit|POST /fetch|POST /scan|sig:" README.md mips
```

Expected: no matches outside migration/history explanations.

- [ ] **Step 5: Commit**

```powershell
git add README.md mips/MIP-05.md mips/README.md
git commit -m "docs: update Murm core compatibility profile"
```

---

### Task 7: Run the complete specification verification

**Files:**

- Modify only files that fail the checks above.

**Interfaces:**

- Consumes: Every artifact produced by Tasks 1–6.
- Produces: A self-consistent, reviewable version 1 draft.

- [ ] **Step 1: Parse all JSON artifacts**

Run:

```powershell
node -e "const fs=require('fs'),path=require('path'); function walk(d){for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,e.name);e.isDirectory()?walk(p):e.name.endsWith('.json')&&JSON.parse(fs.readFileSync(p,'utf8'))}} walk('schemas'); walk('test-vectors'); console.log('all JSON parsed')"
```

Expected: `all JSON parsed`.

- [ ] **Step 2: Verify cryptographic vectors**

Run:

```powershell
node tools/generate-vectors.mjs --check
```

Expected: `7 vectors verified`.

- [ ] **Step 3: Check formatting errors**

Run:

```powershell
git diff --check
```

Expected: no output.

- [ ] **Step 4: Check every event field is documented**

Run:

```powershell
rg -n "version|id|author|signer|authorization|created_at|kind|header|content|signature" mips/MIP-01.md mips/MIP-02.md README.md
```

Expected: every field appears in MIP-01, cryptographic fields appear in MIP-02,
and the complete envelope appears in README.

- [ ] **Step 5: Check endpoint consistency**

Run:

```powershell
rg -n "GET /info|POST /events|GET /events|QUERY /events|POST /events/query|OPTIONS /events" mips/MIP-03.md mips/MIP-05.md README.md
```

Expected: the same required endpoint set appears in all three documents.

- [ ] **Step 6: Review the final diff**

Run:

```powershell
git diff --stat
git diff
```

Confirm there are no undefined kinds, mismatched field names, positional tags,
login requirements, unbounded query clauses, or cryptographic examples without
test vectors.

- [ ] **Step 7: Commit verification corrections**

If verification required corrections:

```powershell
git add README.md mips schemas test-vectors tools
git commit -m "docs: align Murm protocol specifications"
```

If no corrections were needed, do not create an empty commit.

---

## Follow-up Plans

After this plan is implemented and reviewed, create separate designs and plans
in this order:

1. **Device authorization MIP:** scopes, expiration, revocation, partial-sync
   behavior, and delegated signature vectors.
2. **Encrypted direct-message MIP:** public recipient routing, client-side
   encryption, key discovery, replay handling, and known cryptographic test
   vectors; BlackWire is a reference, not a wire-compatible dependency.
3. **Reference relay:** event validation, storage indexes, HTTP handlers, cursor
   encoding, conformance tests, and live subscriptions.
4. **Reference client library:** event building, canonicalization, signatures,
   document resolution, query construction, and encrypted-message support.
