========================================================================

GORKA — SYNC ARCHITECTURE

========================================================================



Document:    SYNC-ARCHITECTURE.md

Version:     1.2 (frozen)

Date:        September 19, 2026 (v1.2 amendment applied September 21, 2026)

Status:      FROZEN — approved by the founder on September 19, 2026.
             v1.1 amendment (Section 25.13 field-semantics
             specification) applied September 20, 2026.

Authority:   Subordinate to ARCHITECTURAL-LAW.md v1.3.
             Extends GORKA-MVP-SCOPE.md v1.1 (frozen).
             Extends MULTI-USER-CONCEPT.md v2.0 (frozen).


This document was frozen at v1.0 on September 19, 2026. A v1.1
amendment was applied on September 20, 2026: Section 25.13, which
v1.0 left as a checklist, was replaced with the actual
field-semantics specification. The specification was written
after LOCAL-TABLES.md was amended to include the eight sync
tables that Section 25 requires. No other section of this
document was changed by the v1.1 amendment.

A v1.2 amendment was applied on September 21, 2026. Section 22
was completed by restoration: subsections 22.7 through 22.19 were
inserted, completing the wire format. Two one-line amendments
were also applied: Section 18.2 records that ACCEPTED, DUPLICATE,
and REJECTED are all terminal delivery outcomes, and REJECTED is
terminal; Section 11.4 records that the first event originated by
a device instance has sequence number 1, and sequence number 0 is
the initial value of the counter before any event has been
originated. No other section of this document was changed by the
v1.2 amendment.


========================================================================

1\. PURPOSE AND STATUS OF THIS DOCUMENT

========================================================================



Purpose



This document defines how GORKA's multi-user synchronization

protocol works. It is the technical specification a developer

follows to implement the sync engine.



It answers the question "how do two client-owned machines converge

to the same logical state, while preserving the architectural

property that GORKA cannot decrypt the debtor data?" It does not

answer "what must the system accomplish?" That is

GORKA-MVP-SCOPE.md. This document takes the MVP scope as given and

specifies the mechanism.



Status



DRAFT — awaiting founder review.



Once approved, this document is frozen. Amendments follow the same

process as amendments to the multi-user concept: documented,

approved by the founder, recorded with reasoning.



Authority and Relationships



This document is subordinate to ARCHITECTURAL-LAW.md v1.3. Where

the two conflict, the law wins.



It extends GORKA-MVP-SCOPE.md v1.1 (frozen). Where the two

conflict, the MVP scope wins, and this document is corrected.

The MVP scope defines what the sync engine must do; this document

defines how.



It extends MULTI-USER-CONCEPT.md v2.0 (frozen). Where the two

conflict, MULTI-USER-CONCEPT.md wins, and this document is

corrected.



It is consistent with PHASE-PLAN.md v1.1 (Phases 9.5, 9.6, 9.7),

LOCAL-TABLES.md v1.2 (Category D, sync tables),

CLOUD-TABLES.md v1.2 (Section 20, Control Plane tables),

DATA-BOUNDARY-MATRIX.md v1.2 (Section 20, multi-user data types),

and BOUNDARY-TEST-PLAN.md v1.0 (Section 2.4, extended proof test).



What This Document Is



\- The technical specification of the sync protocol.

\- The document a developer follows to implement the sync engine.

\- The document that resolves every open technical question the

&#x20; MVP scope deliberately left to this document.

\- The document that defines the exact wire format, the exact

&#x20; ordering rule, the exact reconciliation rule, the exact

&#x20; duplicate detection rule, and the exact sync state machine.



What This Document Is Not



\- Not a scope document. Scope is GORKA-MVP-SCOPE.md.

\- Not a concept document. The concept is MULTI-USER-CONCEPT.md.

\- Not a law. The law is ARCHITECTURAL-LAW.md v1.3.

\- Not a threat model. The threat model is a separate document,

&#x20; written after this one. This document provides the inputs to

&#x20; that threat model in Section 29.

\- Not a schedule.



How to Read This Document



Part I — Foundation

&#x20; Sections 1 through 3. Defines the scope of the document, the

&#x20; overall architecture, and the model of nodes, devices, and

&#x20; peers.



Part II — Identity and Keys

&#x20; Sections 4 through 8. Defines who the participants are, how

&#x20; they authenticate, what the organization key is, how keys are

&#x20; stored and distributed, and how sessions are established.



Part III — The Protocol

&#x20; Sections 9 through 18. Defines the sync protocol itself: the

&#x20; event model, event identity, sequence numbers, logical

&#x20; ordering, state reconciliation, event reconciliation,

&#x20; duplicate detection, acknowledgements, the offline queue, and

&#x20; retry and recovery.



Part IV — Transport

&#x20; Sections 19 through 21. Defines how peers connect directly,

&#x20; how they connect through the encrypted relay, and what the

&#x20; relay may and may not know.



Part V — Message-Level Rules

&#x20; Sections 22 through 24. Defines encryption and authentication

&#x20; of messages, corruption and tampering handling, and protocol

&#x20; versioning.



Part VI — Application and Behavior

&#x20; Sections 25 through 27. Defines how messages are applied to the

&#x20; local database, the sync state machine, and every failure

&#x20; scenario the protocol knows about.



Part VII — Properties and Verification

&#x20; Sections 28 through 30. Defines what the protocol guarantees,

&#x20; what it does not, what is deferred to the funded phase, the

&#x20; inputs to the threat model, and the test vectors that

&#x20; demonstrate the protocol.



The Rule of Section 30



Section 30 (Test Vectors and Acceptance Implementation) may not

define architecture. It only demonstrates architecture already

defined in Sections 1 through 29.



If a test vector exposes an ambiguity or a gap in Sections 1

through 29, the fix is applied to the relevant earlier section,

not invented inside Section 30. The rule is:



&#x20;   Architecture  ->  precise rule  ->  test vector  ->  implementation test



Not:



&#x20;   implementation  ->  unexpected behavior  ->  invent a rule



This discipline prevents the document from drifting into

undefined behavior.



The Rule for Corrections



This document does not re-open settled decisions. The MVP scope

is frozen. The multi-user concept is frozen. The law is frozen at

v1.3.



If this document discovers a genuine contradiction between the

frozen documents, that is a defect to be escalated to the founder

and resolved through the amendment process for the relevant

document. It is not a license to redefine scope or architecture

in this document.



Source: GORKA-MVP-SCOPE.md v1.1 (frozen), Section 11.2;

MULTI-USER-CONCEPT.md v2.0 (frozen), §14.



========================================================================

2\. ARCHITECTURE OVERVIEW

========================================================================



This section is the whole picture in one page. Everything after it

is detail.



The Goal



Two or more client-owned machines belong to the same organization.

They hold the same organization's debtor data. Each machine holds

its own copy, encrypted at rest. The machines must converge toward

the same logical state.



GORKA's Control Plane helps the machines find each other. It never

reads the debtor data. It cannot decrypt the traffic the machines

exchange, even when that traffic passes through it.



The Two Planes



Control Plane — GORKA's own cloud infrastructure. Provides

authentication, organization membership, device registration and

presence, discovery and signaling, encrypted relay coordination,

licensing, customer accounts and billing, aggregate metrics, and

boundary proof logs. Never holds debtor data.



Data Plane — the client's own devices, and the encrypted

synchronization between them. Holds all debtor data, all

communications, all documents, all actions, and all local audit

records. GORKA is not a participant.



The Three Zones



Zone 1 — GORKA cloud. No debtor data in readable form.

Zone 2 — GORKA-provided mechanisms. GORKA's obligation is

prevention. The mechanism is the guard.

Zone 3 — Client-connected third parties. GORKA's obligation is

warning. The client decides.



The MVP topology is hub-and-spoke. The admin's machine is the hub.

Each agent's machine is a spoke. The hub is the designated

synchronization peer for the spokes in the MVP topology. Hub is a

topology role, not a data-model identity. The protocol does not

treat the hub as permanently special.



The Protocol's Job



The protocol's job is to make each device's replica of the

organization's data converge toward the same logical state.



Each device:



\- Records every change it produces as an event, in its own local

&#x20; sync\_events table.

\- Sends its events to its peer or peers, encrypted.

\- Receives events from its peer or peers, decrypts them, and

&#x20; applies them locally.



State changes are governed by a deterministic reconciliation rule.

Events accumulate.



The protocol never trusts wall-clock time. Ordering is logical.



The protocol never replaces a whole row with the sender's current

values. It applies logical events and deterministic state rules.



The protocol never writes debtor data to GORKA's cloud in readable

form.



The Picture



The Control Plane is not necessarily in the data path. The data

path is between the client's own devices.



When the network allows, the two devices connect directly, end-to-

end encrypted, and the Control Plane is not on the path at all:



&#x20;   HUB  <=========== direct E2EE ===========>  SPOKE



When a direct connection is not possible, the two devices connect

through GORKA's encrypted relay. The relay carries ciphertext it

cannot decrypt:



&#x20;   HUB  ==encrypted==>  RELAY  ==encrypted==>  SPOKE

&#x20;                        (cannot decrypt)



In both cases, the Control Plane helps the devices find each other

and authenticate. It is never a participant in the debtor-data

protocol.



The whole picture, in one diagram:



&#x20;   +----------------------------------------------+

&#x20;   |              GORKA CONTROL PLANE             |

&#x20;   |  (Zone 1: no debtor data in readable form)   |

&#x20;   |                                              |

&#x20;   |  Authentication                              |

&#x20;   |  Organization membership                     |

&#x20;   |  Device registration and presence            |

&#x20;   |  Discovery and signaling                     |

&#x20;   |  Licensing, billing, aggregates              |

&#x20;   |                                              |

&#x20;   |  Encrypted relay (optional; cannot decrypt)  |

&#x20;   +----------------------------------------------+

&#x20;                   ^                 ^

&#x20;                   |                 |

&#x20;         discovery/|                 |discovery/

&#x20;         signaling |                 |signaling

&#x20;                   |                 |

&#x20;   +---------------+                 +---------------+

&#x20;   |                                                 |

&#x20;   |       Data path (one of the two forms above)    |

&#x20;   |                                                 |

&#x20;   |   direct E2EE, or relay (encrypted, undecryptable)

&#x20;   |                                                 |

&#x20;   +---------------+                 +---------------+

&#x20;                   |                 |

&#x20;                   v                 v

&#x20;   +------------------+   +------------------+

&#x20;   |   HUB            |   |   SPOKE          |

&#x20;   |   Admin's machine|   |   Agent's machine|

&#x20;   |                  |   |                  |

&#x20;   |   SQLCipher      |   |   SQLCipher      |

&#x20;   |   (debtor data)  |   |   (debtor data)  |

&#x20;   |                  |   |                  |

&#x20;   |   Sync engine    |   |   Sync engine    |

&#x20;   |   Org key        |   |   Org key        |

&#x20;   |   (local only)   |   |   (local only)   |

&#x20;   +------------------+   +------------------+



The organization key exists only on the client's devices. It never

reaches the Control Plane. The relay carries only ciphertext it

cannot decrypt.



The MVP's Deliberate Limitations



The MVP uses a single organization key. Every authorized device

holds it. There is no per-device cryptographic revocation in the

MVP. This is a documented limitation (MVP scope §9.3).



The MVP uses user-account-based device identity. There is no

per-machine registration in the MVP. This is a documented

limitation (MVP scope §9.2).



The MVP synchronizes document metadata, not document contents.



The MVP does not synchronize AI prompts or responses.



These are scope decisions, not protocol defects. The protocol is

structured so they can be superseded in the funded phase without

redesigning the wire format.



What This Section Does Not Do



It does not define the exact wire format. That is Part III.

It does not define the exact cryptographic primitives. That is

Part V.

It does not define the exact state machine. That is Section 26.



It defines the shape of the whole so that every later section has

a place.



Source: GORKA-MVP-SCOPE.md v1.1 §3, §5.2, §8;

ARCHITECTURAL-LAW.md v1.3 §20.1, §21; MULTI-USER-CONCEPT.md v2.0

§3, §4, §6.



========================================================================

3\. NODE AND DEVICE MODEL

========================================================================



This section defines the vocabulary. Every later section uses these

words in exactly these meanings. If a later section uses one of

these words, it means what this section says.



The Words



User — a human or service account. A user has credentials and a

role (OWNER, CLIENT, or AGENT). A user is an identity, not a

device.



Organization — the customer's security and data-ownership

boundary. All debtor data belongs to exactly one organization.



Device — a physical installation of GORKA that runs the sync

engine. In the MVP, a device is a machine running the Client

Dashboard or the Agent App. In the funded phase, a device may

also be a mobile installation, a server-hosted installation, or

any other runtime.



Peer — a device that participates in synchronization with this

device. A peer is any device in the same organization that this

device is authorized to sync with. The hub is a peer. A spoke is

a peer. The words hub and spoke describe topology roles, not

distinct kinds of peer.



Node — a running instance of the sync engine. In the MVP, one

device runs one node. The word "node" is used when the protocol

perspective matters, and "device" is used when the operational

perspective matters. In the MVP they are one-to-one.



Hub — a topology role. In the MVP, the hub is the admin's

machine. The hub is the designated synchronization peer for the

spokes in the MVP topology. It is not a server. It is not

privileged in the data model. It is chosen at configuration time.



Spoke — a topology role. In the MVP, a spoke is an agent's

machine. It synchronizes with the hub.



The hub/spoke distinction is configuration, not architecture.

The protocol's events, state records, and peer records do not

treat the hub as permanently special. A peer is a peer.



A peer relationship is directional from the perspective of a local

node: "this node's peer X" is a distinct fact from "peer X's

peer Y." Synchronization itself is logically bidirectional unless

a later section explicitly defines otherwise. A peer is not a

remote server a node sends to; a peer is another node that both

sends to and receives from this node.



See Section 19 (Direct Connection) for how topology is

configured, and Section 26 (The Sync State Machine) for the

peer relationship states.



The Organization Boundary



In the MVP, a device belongs to exactly one organization for

synchronization purposes, and its synchronized debtor data belongs

to that organization. No MVP device holds data from two

organizations.



This is an MVP invariant, not a universal rule about all future

GORKA installations. A future multi-tenant installation may hold

data from more than one organization with strict tenant

isolation. The MVP does not attempt this. The MVP's organization

isolation is enforced in every part of this protocol.



The MVP Device Identity Is User-Account-Based



In the MVP:



\- A device's identity, for authentication and authorization, is

&#x20; derived from the authenticated user account that logged in on

&#x20; that device.

\- An agent can log in from any machine. The Control Plane sees

&#x20; the same user identity.

\- There is no per-machine registration in the MVP. The

&#x20; device\_registrations table records device entries, but the

&#x20; identity those entries carry is the user identity.

\- Removing an agent means disabling their user account. There is

&#x20; no way to remove a single machine without removing the user.



This is an MVP simplification. It is not the final device-

security model.



The final device-security model, in the funded phase, is

combined user + device identity. Each machine is a registered

entity within the organization. Each machine has its own

identity. Each machine is enrolled, listed, and can be

individually revoked. Removing one lost machine does not disable

the agent's other machines.



The protocol is designed so the migration is possible without

redesigning the wire format. Specifically:



\- Device identity and session keys are first-class concepts in

&#x20; the wire format. In the MVP, they are derived simply. In the

&#x20; funded phase, they are derived from per-device registration.

&#x20; The wire format does not change.

\- The peer records and session records already carry a device\_id

&#x20; field. In the MVP, that field is populated with a value

&#x20; derived from the user identity. In the funded phase, it is

&#x20; populated with the per-device identity.

\- The protocol version number (Section 24) allows the funded

&#x20; phase to introduce new fields or new identity semantics without

&#x20; breaking MVP peers.



This distinction must not be collapsed. In the MVP, "device

identity" and "user identity" are the same cryptographic

identity. In the funded phase, they are separate. Any code written

against this document must not assume the funded-phase model,

because the funded-phase model does not yet exist. Any code

written against this document must not assume the MVP model is

permanent, because the funded-phase model is the target.



What This Section Does Not Do



It does not define authentication. That is Section 5.

It does not define enrollment. That is Section 5.

It does not define the exact format of the device\_id field. That

is Section 10 (Event IDs) and Section 25 (Database Application

Rules).

It does not define how the hub is chosen. That is Section 19.



Source: GORKA-MVP-SCOPE.md v1.1 §5.2, §9.2;

MULTI-USER-CONCEPT.md v2.0 §4, §5; LOCAL-TABLES.md v1.2 Category D

(sync\_peers).



========================================================================

4\. IDENTITY — USER, ORGANIZATION, DEVICE

========================================================================



This section defines the identities the protocol deals with, how

they relate, and what the MVP does and does not do about each.



The Identity Model



User identity.

&#x20; A human or service account. Credentials: email and password,

&#x20; managed by the Control Plane. Role: OWNER, CLIENT, or AGENT.

&#x20; A user is authenticated by the Control Plane. A user is an

&#x20; identity, not a device.



Organization identity.

&#x20; The customer's security and data-ownership boundary. An

&#x20; organization is identified by a stable organization\_id issued

&#x20; by the Control Plane at registration time. All debtor data

&#x20; belongs to exactly one organization. All devices that hold the

&#x20; organization's debtor data belong to that organization.



Device identity.

&#x20; The identity of a running sync engine, used in the wire

&#x20; protocol. In the MVP, a device's identity is derived from the

&#x20; authenticated user account. In the funded phase, a device's

&#x20; identity is a separate, per-machine identity.



Peer identity (peer reference).

&#x20; The identity of another device, as known by this device. A

&#x20; peer is not an independent security identity. It is the local

&#x20; device's reference to another device in the same organization

&#x20; that this device is authorized to synchronize with. The peer

&#x20; identity the protocol uses is a device\_id (see Section 3 and

&#x20; Section 10).



How They Relate



&#x20; Organization

&#x20;   |

&#x20;   |  has members

&#x20;   v

&#x20; Users  ----  one user may be logged in on more than one device

&#x20;   |

&#x20;   |  when logged in on a device, gives rise to

&#x20;   v

&#x20; Device identity  (derived from the user identity in the MVP)

&#x20;   |

&#x20;   |  other devices see this device as

&#x20;   v

&#x20; Peer reference  (another device's view of this device)



The organization is the security boundary. Users belong to

organizations. Devices are extensions of users in the MVP.

Peers are the projections of other devices onto this device.



In the MVP, "device identity" and "user identity" are the same

cryptographic identity. In the funded phase, they are separate.



Why the MVP Uses User-Account-Based Device Identity



Three reasons, all recorded in the frozen documents:



\- The MVP's customer base has one agent per machine, typically.

&#x20; The distinction between "this agent" and "this machine" does

&#x20; not carry its weight yet.

\- The existing authentication flow (Phases 7 and 8) already

&#x20; issues JWTs per user. Reusing it for device identity is less

&#x20; work than introducing per-machine registration, and it fits

&#x20; the MVP timeline.

\- The migration to per-device identity is designed to be

&#x20; possible without a wire-format change. See Section 3 and

&#x20; Section 24.



What the MVP Does Not Do



\- It does not register individual machines.

\- It does not issue per-machine credentials.

\- It does not support per-machine revocation.

\- It does not distinguish "this device" from "this user" in the

&#x20; wire protocol.



Each of these is a funded-phase capability. Each is listed in

MVP scope §7.2 and §7.3.



What This Section Does Not Do



It does not define authentication. That is Section 5.

It does not define how the organization key is created. That is

Section 6.

It does not define how a device's identity is represented on the

wire. That is Section 10.



Source: GORKA-MVP-SCOPE.md v1.1 §9.2, §9.3;

MULTI-USER-CONCEPT.md v2.0 §5; ARCHITECTURAL-LAW.md v1.3 §15.



========================================================================

5\. AUTHENTICATION AND ENROLLMENT

========================================================================



This section defines two distinct things:



\- Authentication: how a user, and therefore a device, proves to

&#x20; the Control Plane that it is who it says it is.

\- Enrollment: how a new device becomes authorized to

&#x20; synchronize with an existing organization's other devices.



They are separate problems and they are solved separately.



5.1 Authentication



In the MVP, authentication is what already exists in Phases 7 and

8\.



The flow:



1\. The user opens the Client Dashboard or the Agent App.



2\. The user enters their email and password.



3\. The client sends the credentials to the Control Plane's

&#x20;  authentication endpoint (POST /api/auth/login, already

&#x20;  implemented).



4\. The Control Plane verifies the credentials, and issues a JWT.



5\. The Control Plane returns the JWT and the user's

&#x20;  organization\_id.



6\. The client stores the JWT locally.



7\. Every subsequent request to a Control Plane endpoint includes

&#x20;  the JWT in the Authorization header.



The device's identity, for the duration of the authenticated

session, is the user identity carried in the JWT.



What authentication proves:



\- The client holds valid user credentials.

\- The client is a member of exactly one organization.



What authentication does not prove:



\- The client is a specific physical device. (The MVP does not

&#x20; distinguish physical devices.)

\- The client holds the organization key. (The organization key

&#x20; is separate from the JWT. It is not issued by the Control

&#x20; Plane. See Section 6.)



The JWT does not carry the organization key. The JWT does not

carry any debtor data. The JWT identifies the user and the

organization; nothing more.



5.2 Organization Membership



A user belongs to exactly one organization. The organization\_id

is determined by the Control Plane at registration time and is

carried in the JWT.



The client never sends organization\_id as a parameter of a

request. The client never derives organization\_id from a

request body. The client uses the organization\_id that came

from the JWT, and only that.



This rule is restated in ARCHITECTURAL-LAW.md §7 (violation 8)

and is enforced by the backend's authenticateToken middleware.



If the JWT's organization\_id and the local database's

organization\_id disagree, the sync engine refuses to

synchronize and reports an error to the user. This is a hard

stop, not a warning.



5.3 What Authentication Does Not Give a Device



Authentication, by itself, does not authorize a device to

synchronize. Authentication tells the Control Plane who the user

is. It does not tell the other devices in the organization that

this device is allowed to talk to them.



Authorization to synchronize comes from enrollment.



5.4 Enrollment — the Problem



A new device is an agent's machine. The agent has logged in. The

agent is a member of the organization. But the new device does

not yet hold the organization key. Without the organization key,

the new device cannot decrypt any sync traffic, cannot read any

debtor data sent to it, and cannot encrypt any debtor data it

sends.



Enrollment is the process by which the new device obtains the

organization key, so that it can participate in synchronization.



5.5 Enrollment — the MVP Flow



The MVP uses an exported-and-imported key package. There is no

automatic enrollment. The admin exports the package, transmits

it to the agent by a channel the client chooses, and the agent

imports it.



The flow:



1\. The admin, on the hub machine, opens the Client Dashboard.

&#x20;  The admin is already logged in. The admin's local database is

&#x20;  already unlocked. The organization key is already on the hub

&#x20;  machine, in the local encrypted store.



2\. The admin chooses "Export Organization Enrollment Package"

&#x20;  from the sync settings.



3\. The client (the hub machine) creates an enrollment package.

&#x20;  The package contains:

&#x20;    - The organization\_id. This is a non-secret identifier.

&#x20;      It is included so that the importing client can verify

&#x20;      that the package belongs to the organization the agent

&#x20;      is logged into.

&#x20;    - The organization key, encrypted with a passphrase the

&#x20;      admin chooses at export time.

&#x20;    - The package format version.

&#x20;  That is all. The MVP package carries no signature and no

&#x20;  issuer field. The organization\_id is present, but it is not

&#x20;  signed; it is authenticated by the encryption itself (see

&#x20;  Section 7 for the exact construction, which will use

&#x20;  authenticated encryption and will treat the organization\_id

&#x20;  as part of the authenticated data).

&#x20;  The package is a single file.



4\. The admin chooses the passphrase. The Client Dashboard warns

&#x20;  the admin if the passphrase is weak. The warning is

&#x20;  informational; it does not block the export. The admin

&#x20;  decides.



5\. The admin transmits the package to the agent by any channel

&#x20;  the client chooses (email, shared drive, USB stick, secure

&#x20;  message). The choice of channel is the client's, not GORKA's.

&#x20;  GORKA does not see the package.



6\. The admin transmits the passphrase to the agent by a channel

&#x20;  the client chooses, and preferably a different one from the

&#x20;  channel used for the file. The choice of channel is the

&#x20;  client's.



7\. The agent, on the spoke machine, opens the Agent App. The

&#x20;  agent logs in with credentials provided by the admin.



8\. The agent chooses "Import Organization Enrollment Package"

&#x20;  from the sync settings.



9\. The agent selects the package file and enters the passphrase.



10\. The client (the spoke machine) decrypts the package with

&#x20;   the passphrase. It verifies:

&#x20;     - The package format version is supported.

&#x20;     - The organization\_id in the package matches the

&#x20;       organization\_id in the agent's JWT.

&#x20;   If either check fails, the import is rejected with a clear

&#x20;   error and no key is installed.

&#x20;   If both checks pass, the client stores the organization key

&#x20;   in the local encrypted store.



11\. The spoke machine is now enrolled. It can participate in

&#x20;   synchronization. It reports this to the Control Plane by

&#x20;   writing or updating a row in device\_registrations.



The package is deleted after successful import. It is not

retained.



Exporting does not rotate the key. Each export produces a copy

of the same organization key. Key rotation is a funded-phase

feature, recorded in MVP scope Tier 3.



Why the organization\_id is in the package:



Imagine the admin of Organization A exports a package. An agent

of Organization B accidentally imports it. Without the

organization\_id in the package, the importing client cannot

tell that the package belongs to a different organization. The

JWT/local-DB consistency check (Section 5.2) would catch the

mismatch later, at synchronization time, but that is too late

and too indirect. The package must be rejected at import.



The organization\_id is not debtor data. It is a non-secret

customer identifier. It stays inside the client-controlled

enrollment package and is never sent to GORKA's cloud. Including

it does not violate the boundary.



5.6 Wrong Passphrase



If the agent enters the wrong passphrase, the client returns a

clear error. The agent may retry immediately.



There is no lockout. There is no attempt counter. There is no

delay.



This is deliberate. The MVP's security model assumes the

passphrase is strong and the channel is controlled by the

client. An attempt counter adds state, adds failure modes, and

adds attack surface without a corresponding benefit in the MVP's

threat model. If the funded phase introduces automatic

enrollment, the funded-phase protocol will revisit this decision.



5.7 Key Loss



Key loss is not architecturally solvable in the MVP.



The organization key exists only on the client's devices. GORKA

does not hold it. GORKA cannot recover it. If the admin's

machine and every other device holding the key are lost, or if

every copy of the key is lost, the debtor data cannot be

decrypted.



The Client Dashboard encourages the admin to back up the

organization key in a safe place. The documentation states

plainly:



&#x20; If the admin's machine and the key are both lost, GORKA

&#x20; cannot recover the data, because GORKA does not have the key.



This is a property of the design, not a defect. It is the same

consequence as MULTI-USER-CONCEPT.md §8's revocation caveat,

applied to key loss rather than device loss. It must be stated

in the client-facing documentation.



Note on backups: a copy of the organization key is not a backup

of the debtor database. They are two separate things. A key

backup lets the client decrypt a database they still possess. A

database backup preserves the ciphertext. Both are needed for

recovery. This distinction will be restated in Section 25

(Database Application Rules).



5.8 What Enrollment Proves and Does Not Prove



Enrollment proves:



\- The agent's machine holds the organization key.

\- The agent's machine can decrypt sync traffic from the other

&#x20; devices in the organization.



Enrollment does not prove:



\- The agent's machine is a specific physical machine. (The MVP

&#x20; does not distinguish physical machines.)

\- The agent's machine has been reviewed or approved by anything

&#x20; other than the admin's decision to send the package.



The security of enrollment is exactly the security of the

client's choice of channel for transmitting the package and the

passphrase. If the client uses a channel an attacker can read,

the attacker can enroll a device. This is a property of the MVP

design, not a defect. The MVP's security model assumes the

client controls the enrollment channel.



To state the enrollment threat model plainly:



\- An attacker who obtains only the package cannot enroll a

&#x20; device. They do not have the passphrase.

\- An attacker who obtains only the passphrase cannot enroll a

&#x20; device. They do not have the package.

\- An attacker who obtains both the package and the passphrase

&#x20; can enroll a device in the organization. They will hold the

&#x20; organization key and will be able to decrypt any data they

&#x20; subsequently receive.



This is the actual limitation the future threat model must

analyze. It is not hidden. It is the honest consequence of the

MVP's manual enrollment design.



5.9 Enrollment Is a Client Decision



GORKA does not generate the organization key. GORKA does not

create the enrollment package. GORKA does not transmit the

package. GORKA does not transmit the passphrase. GORKA does not

choose the channel. GORKA does not know when the package is

created, transmitted, or imported. GORKA cannot recover the key

if it is lost.



The Control Plane may observe that an authenticated user or

device has subsequently registered or become available to it.

That is the only thing the Control Plane sees about enrollment.

It does not see the package contents. It does not see the

passphrase. It cannot reproduce the package, because it does not

have the organization key.



5.10 Why Enrollment Is Manual in the MVP



Automatic enrollment would require the Control Plane to play a

role in distributing the organization key. In the MVP, the

Control Plane is not on the path of the organization key at any

point. That is an MVP architectural decision, not a statement

about what cryptography can theoretically do.



The MVP does not use Control Plane-mediated key distribution.

The organization key never enters or passes through GORKA's

Control Plane.



Automatic enrollment is deferred to the funded phase. It is

possible that a funded-phase protocol could allow the Control

Plane to facilitate enrollment without learning the key. The

MVP does not attempt this. Any such design is a funded-phase

decision and will be evaluated on its own merits, against the

invariant, at that time.



5.11 What Enrollment Does Not Do



\- It does not synchronize any data. It authorizes future

&#x20; synchronization. The first sync happens after enrollment, in

&#x20; a separate step (see Section 18, Initial Synchronization).

\- It does not give the new device access to any specific debtor

&#x20; record. Every device in the organization has access to every

&#x20; record in the organization. The MVP does not support

&#x20; per-record access control.

\- It does not revoke any prior device. The MVP does not support

&#x20; revocation. See MVP scope §9.3.



5.12 What This Section Does Not Do



It does not define the exact format of the enrollment package.

That is Section 7.

It does not define the exact encryption used for the package.

That is Section 7.

It does not define the exact format of the device\_registrations

row that enrollment writes. That is Section 25.



Source: GORKA-MVP-SCOPE.md v1.1 §5.4, §9.3;

MULTI-USER-CONCEPT.md v2.0 §5, §6; ARCHITECTURAL-LAW.md v1.3 §7

(violation 8), §15, §20; CLOUD-TABLES.md v1.2 §20.1.



========================================================================

6\. THE ORGANIZATION KEY

========================================================================



This section defines the organization key: what it is, what it

protects, what it does not protect, and how it relates to the

rest of the protocol.



6.1 What the Organization Key Is



The organization key is a single symmetric secret shared by every

authorized device in an organization. It is a 256-bit key.



The organization key exists only on the client's devices. It never

enters GORKA's Control Plane. It never passes through GORKA's

relay in readable form. GORKA cannot reproduce it, cannot recover

it, and cannot decrypt any traffic that was encrypted with it.



The organization key is the root of the MVP's application-layer

protection of debtor data in transit. Everything the sync protocol

itself does to protect debtor data in transit derives from it.



6.2 What the Organization Key Protects



The organization key protects two things in the MVP:



1\. The confidentiality of debtor data in transit between the

&#x20;  client's devices.

&#x20;  Every sync payload is encrypted with a key derived from the

&#x20;  organization key (see Section 8 for session keys, and

&#x20;  Section 22 for the exact construction).



2\. The authentication of sync traffic.

&#x20;  Every sync message carries an authentication tag derived from

&#x20;  a key derived from the organization key. A peer that does not

&#x20;  hold the organization key cannot forge a valid message.



The organization key does not directly protect debtor data at

rest. Debtor data at rest is protected by SQLCipher, whose key

is derived from the user's local password (see Section 25 and

LOCAL-TABLES.md v1.2 for the details). The organization key and

the SQLCipher key are separate. This is deliberate and important.



6.3 What the Organization Key Does Not Protect



The organization key does not protect:



\- The SQLCipher database on each device. That is protected by

&#x20; the local password. The organization key does not unlock the

&#x20; local database, and the local password does not decrypt the

&#x20; sync traffic. They are independent.



\- The user's authentication credentials. Those are protected by

&#x20; the Control Plane's authentication (email and password over

&#x20; TLS).



\- The enrollment package's transmission. That is protected by

&#x20; the passphrase the admin chooses (see Section 7), not by the

&#x20; organization key itself.



\- Any debtor data that leaves the client's machine by a

&#x20; client-controlled path to a third party (the AI Copilot case;

&#x20; see MVP scope §9.9 and ARCHITECTURAL-LAW.md v1.3 §21). If the

&#x20; client sends debtor data to a third party, the organization

&#x20; key does not protect that data in the third party's hands.



\- The organization's identity. The organization\_id is public

&#x20; metadata. Anyone who sees a sync message can see which

&#x20; organization it belongs to, if the message format exposes the

&#x20; organization\_id (see Section 10 for whether it does, and

&#x20; Section 21 for what the relay sees).



The separation of the SQLCipher key from the organization key is

deliberate. It means:



\- The two secrets can be rotated independently. Key rotation is

&#x20; funded-phase, but the separation allows it.

\- A stolen device whose local database is locked does not expose

&#x20; the organization key, because the organization key is stored

&#x20; inside the SQLCipher database and cannot be read until the

&#x20; database is unlocked.

\- Synchronization cannot begin until the local database is

&#x20; unlocked. A device may possess an enrollment package before

&#x20; the local database is unlocked, but the installed organization

&#x20; key becomes available to the sync engine only after the

&#x20; SQLCipher database has been successfully unlocked. Before

&#x20; unlock, the sync engine cannot read the organization key and

&#x20; cannot sync. This is the correct order: no sync until the

&#x20; device is unlocked.



6.4 The MVP's Single-Key Model



In the MVP, one organization key is shared by every authorized

device in an organization. There is no per-device key. There is

no key rotation. There is no cryptographic revocation.



This is the MVP cryptographic limitation, stated in MVP scope

§9.3. It is restated here because this section is where it

matters most.



What the single-key model means in practice:



\- Every authorized device can decrypt any sync traffic in the

&#x20; organization, once it holds the organization key.

\- If a device is lost, the organization key it holds cannot be

&#x20; revoked. Key rotation (funded-phase) is the mechanism that

&#x20; would be used to make the lost device's key useless for

&#x20; future traffic.

\- If an agent leaves, disabling their user account prevents

&#x20; future authentication. It does not invalidate the

&#x20; organization key the agent's device may still hold. See

&#x20; Section 5 for enrollment, and MVP scope §9.4 for the

&#x20; revocation caveat.



6.5 The Organization Key Is the Same on Every Device



The organization key is a single value. Every authorized device

in the organization holds the same value. There is no derivation

that makes the key different per device.



This is what makes the MVP simple. It is also what makes the

single-key limitation real. Any design in which the key differs

per device is a funded-phase design.



6.6 How the Organization Key Is Created



The organization key is created on the admin's machine, at the

moment the admin first enables sync for the organization.



The flow:



1\. The admin opens the Client Dashboard.



2\. The admin navigates to the sync settings and chooses "Enable

&#x20;  synchronization for this organization."



3\. The client (the admin's machine) generates a 256-bit

&#x20;  organization key using a cryptographically secure random

&#x20;  number generator.



4\. The client stores the organization key in the local encrypted

&#x20;  store (see Section 7 for the exact location).



5\. The client reports to the Control Plane that the organization

&#x20;  has been enabled for sync. The Control Plane records this in

&#x20;  its own metadata. The Control Plane does not receive the key.



The organization key is never transmitted over any network during

creation. It is generated locally and stored locally. It is

transmitted only when the admin exports it for enrollment (see

Section 5 and Section 7).



If the admin's machine is lost before any export is made, no

other device has the key, and the organization cannot sync. This

is a consequence of the design. It is documented in Section 5.7

(Key Loss) and must be stated in the client-facing documentation.



6.7 How the Organization Key Is Destroyed



The MVP does not have a "destroy the key" operation. Deleting

the organization key from the local store, if a user does so,

only destroys that device's copy. Other devices retain their

copies. There is no way to destroy all copies from one place.

This is the same property as revocation: the MVP cannot reach

devices it does not have access to.



This is a funded-phase consideration. See MVP scope Tier 3.



6.8 What This Section Does Not Do



It does not define how the organization key is stored. That is

Section 7.

It does not define how a session key is derived from the

organization key. That is Section 8.

It does not define the exact cryptographic construction of the

messages. That is Section 22.



Source: GORKA-MVP-SCOPE.md v1.1 §9.3;

MULTI-USER-CONCEPT.md v2.0 §6; ARCHITECTURAL-LAW.md v1.3 §20;

LOCAL-TABLES.md v1.2 (SQLCipher section).





========================================================================

7\. KEY STORAGE AND KEY DISTRIBUTION

========================================================================



This section defines where the organization key lives on each

device, how it is protected at rest, and the exact format of the

enrollment package that distributes it.



7.1 Where the Organization Key Lives on a Device



The organization key is stored inside the device's SQLCipher

database. It lives in the local database, alongside the debtor

data it protects. It is not stored in the Tauri settings file

(settings.dat) and not in any plaintext file on disk.



The reason: the SQLCipher database is already encrypted at rest

with the local password. Storing the organization key inside it

means the organization key is protected by the same encryption

as the data it protects. There is one lock, not two, for the

organization key.



What this implies:



\- The organization key is readable only after the local database

&#x20; is unlocked.

\- Before unlock, the sync engine cannot read the organization

&#x20; key and cannot sync. This is the correct order: no sync until

&#x20; the device is unlocked.

\- The settings.dat file holds the JWT and the user's

&#x20; organization\_id, but never the organization key.



See LOCAL-TABLES.md v1.2 Category D for the sync tables. The

organization key will be stored in a small, single-row table in

the local database. Its exact schema is defined in Section 25.



7.2 How the Organization Key Is Protected at Rest



The organization key is protected by SQLCipher, which encrypts

the entire local database with a key derived from the user's

local password.



The local password is the user's. It is not the Control Plane

password. It is not the organization key. It is a separate

secret the user chooses on first setup, and it is used to

derive the SQLCipher key via Argon2id, as already implemented

in db.rs.



This means the organization key is protected by:



\- The SQLCipher encryption at rest.

\- The user's local password, which unlocks the SQLCipher

&#x20; database.

\- The device's operating system, which protects the on-disk

&#x20; database file from unauthorized local access while the device

&#x20; is powered off.



It does not mean the organization key is protected against a

user who has already unlocked the database. Once the database

is unlocked, the organization key is readable by the sync

engine. This is by design: the sync engine cannot function

without it.



7.3 How the Organization Key Is Distributed — the Enrollment Package



This is the one place the organization key leaves a device. It

leaves inside the enrollment package defined in Section 5.5.



The package is a single file. It has two parts: a public header

and an AEAD-protected payload.



Public header (readable without the passphrase):



\- The package format version (a small integer).

\- The Argon2id salt (16 random bytes).

\- The Argon2id parameters (memory, iterations, parallelism;

&#x20; small integers).

\- The AEAD nonce (24 random bytes).



AEAD-protected payload (readable only with the passphrase):



\- The organization\_id.

\- The organization key (32 bytes).



The public header is not secret. It is the input needed to

derive the package encryption key from the passphrase and to

decrypt the payload. The payload is encrypted with

XChaCha20-Poly1305, using the derived key, the nonce from the

header, and the package format version as associated data.



The organization\_id is part of the AEAD-protected payload, not

the public header. Its integrity is protected by the

authentication tag. Tampering with it fails decryption.



The exact byte-level serialization of the header and payload is

defined in Section 22. This section defines the logical

contents.



The Argon2id parameters are fixed protocol configuration values.

They are chosen and benchmarked for the supported GORKA desktop

environment at the time the implementation is written, and

recorded in the implementation notes and in Section 22. They

are not chosen dynamically at run time.



Why the package carries the organization\_id:



Section 5.5 explains this. The short version: so that an agent

who imports a package from the wrong organization gets a clean

rejection at import time, not a mysterious failure at sync time.



Why the package does not carry a signature:



The MVP does not sign the package. The package is

authenticated by the XChaCha20-Poly1305 authentication tag,

which requires the passphrase to verify. A party who does not

know the passphrase cannot forge or alter a valid package.



A signature would add a second authentication mechanism, with

its own key management. The MVP does not need it, because the

authentication tag already provides integrity. Signing is a

funded-phase consideration if the threat model later demands it.



Why the public header does not carry the organization\_id:



If the organization\_id were in the public header, anyone who

obtained the package file could see which organization it

belongs to, without knowing the passphrase. The MVP deliberately

keeps the organization\_id inside the encrypted payload, so that

the package file by itself reveals nothing about the

organization.



The importing client learns the organization\_id only after

successful decryption, which requires the passphrase.



7.4 How the Enrollment Package Is Imported



The import flow is defined in Section 5.5. The cryptographic

detail:



1\. The importing client reads the package file.



2\. It parses the package format version. If the version is not

&#x20;  supported, the import is rejected with a clear error.



3\. It reads the Argon2id salt and parameters, and derives the

&#x20;  package encryption key from the agent's entered passphrase

&#x20;  using Argon2id with those parameters.



4\. It decrypts the payload with XChaCha20-Poly1305, using the

&#x20;  derived key, the nonce from the header, and the package

&#x20;  format version as associated data.



5\. If decryption fails (wrong passphrase, tampered package,

&#x20;  corrupted file), the client returns a clear error. The agent

&#x20;  may retry. See Section 5.6.



6\. If decryption succeeds, the client reads the organization\_id

&#x20;  from the decrypted payload and compares it to the

&#x20;  organization\_id in the agent's JWT. If they differ, the

&#x20;  import is rejected with a clear error. No key is installed.



7\. If both match, the client stores the organization key in the

&#x20;  local database's organization\_keys row (see Section 25).



8\. The client deletes the package file.



9\. The client reports to the Control Plane that a device (in

&#x20;  the MVP, identified by user account) has registered. This is

&#x20;  the only thing the Control Plane learns from enrollment. See

&#x20;  Section 5.9.



7.5 What the Control Plane Sees About the Organization Key



Nothing. The Control Plane:



\- Does not generate the organization key.

\- Does not receive the organization key.

\- Does not receive the enrollment package.

\- Does not receive the passphrase.

\- Does not know when the package is created, transmitted, or

&#x20; imported. It may observe that an authenticated user has

&#x20; subsequently registered with the Control Plane (Section 5.9).



The Control Plane's device\_registrations table records which

devices (in the MVP, which user accounts) are authorized for

sync. It does not record any key material. See CLOUD-TABLES.md

v1.2 §20.1.



7.6 Key Loss and Key Backup



Section 5.7 defines the key loss consequence. It is restated

here in the context of key storage:



\- The organization key exists only on the client's devices.

\- GORKA does not hold a copy. GORKA cannot recover the key.

\- If every copy of the key is lost, the debtor data cannot be

&#x20; decrypted.



The Client Dashboard encourages the admin to back up the

organization key. The MVP does not provide a built-in key backup

mechanism. The admin can back up the key by exporting an

enrollment package and storing it in a safe place, or by any

other means the admin chooses. The documentation states this

plainly.



A key backup is not a database backup. See Section 5.7 and

Section 25.



7.7 Why the Organization Key Is Not Stored in the Settings File



The Tauri settings.dat file holds:



\- The JWT.

\- The user's organization\_id.

\- The local password's salt (see LOCAL-TABLES.md v1.2 and

&#x20; db.rs).



It does not hold the organization key. The organization key is

stored only inside the SQLCipher database.



Why: the settings file is not encrypted. It is protected only by

the operating system's file permissions. Storing the

organization key there would place it outside the SQLCipher

encryption. The design deliberately avoids this.



7.8 What This Section Does Not Do



It does not define the exact byte-level serialization of the

enrollment package. That is Section 22.

It does not define the exact Argon2id parameter values. Those

are fixed protocol configuration values, recorded in

Section 22 and in the implementation notes.

It does not define the exact schema of the organization\_keys

table. That is Section 25.



Source: MULTI-USER-CONCEPT.md v2.0 §6;

ARCHITECTURAL-LAW.md v1.3 §20; LOCAL-TABLES.md v1.2;

CLOUD-TABLES.md v1.2 §20.1.



========================================================================

8\. SESSION ESTABLISHMENT

========================================================================



This section defines what a session is, how two peers establish

one, and how session keys relate to the organization key.



8.1 What a Session Is



A session is a logical connection between two peers, during

which they exchange sync messages. A session has a beginning

and an end. Between the beginning and the end, the two peers

exchange an arbitrary number of messages.



A session is not a TCP connection. It is a protocol concept. It

may span multiple TCP connections, or it may be re-established

after a network interruption without losing its logical identity.

The relationship between the session concept and the underlying

transport is defined in Section 19 (Direct Connection) and

Section 20 (Relay Protocol).



A session's purpose is to exchange sync messages. It is not a

general-purpose channel. It does not carry application traffic,

file uploads, or anything other than sync messages.



8.2 How a Session Begins



A session begins when two peers agree to exchange sync messages.

The trigger is one of:



\- The hub (or a spoke, in the funded-phase mesh) decides to

&#x20; poll its peer for new events.

\- A peer has new events to send and wants to push them.

\- The Control Plane signals that two peers should connect (for

&#x20; example, when a spoke comes online and the hub is already

&#x20; connected).



In every case, the session begins with a handshake. The

handshake is defined here. The exact wire format is defined in

Section 22.



The handshake has three steps:



1\. Peer A and Peer B authenticate to each other at the

&#x20;  organization level.

2\. Peer A and Peer B agree on a session key.

3\. Peer A and Peer B agree on the starting point for the

&#x20;  exchange (the highest sequence number each has already seen

&#x20;  from the other).



If any step fails, the session does not begin. No sync messages

are exchanged. The failure is logged locally. The UI shows the

peer relationship as ERROR until the next attempt.



8.3 How Peers Authenticate to Each Other



In the MVP, peers authenticate to each other by proving that

they hold the organization key.



The exchange is a challenge-response proof of possession of the

organization key. The organization key itself is never

transmitted.



The protocol:



1\. Peer A sends a challenge to Peer B. The challenge contains:

&#x20;  - A random nonce.

&#x20;  - Peer A's organization\_id.

&#x20;  - Peer A's claimed device\_id.

&#x20;  - Peer A's protocol version.



2\. Peer B receives the challenge. It verifies:

&#x20;  - The organization\_id matches its own.

&#x20;  - The protocol version is supported.

&#x20;  - The claimed device\_id is one Peer B is willing to accept

&#x20;    as a peer (in the MVP, any device in the same organization;

&#x20;    see Section 5).



3\. Peer B responds with a challenge of its own, plus a proof

&#x20;  that it holds the organization key. The proof is an

&#x20;  authentication tag computed with a key derived from the

&#x20;  organization key (the handshake authentication key; see

&#x20;  Section 8.5), over the two nonces, the two

&#x20;  organization\_ids, and the two claimed device\_ids. The exact

&#x20;  construction is defined in Section 22.



4\. Peer A verifies Peer B's proof. It responds with its own

&#x20;  proof, over the same data.



5\. Both peers have now proven to each other that they hold the

&#x20;  organization key, and that neither is replaying a captured

&#x20;  message.



The proof does not reveal the organization key.



What this proves:



\- Each peer holds the organization key.

\- Each peer is a member of the organization (in the MVP,

&#x20; because the organization key is the membership test).



What this does not prove:



\- That the peer is a specific physical device. The MVP does not

&#x20; distinguish physical devices.

\- That the peer is the specific user whose device\_id it claims.

&#x20; In the MVP, all authorized devices in the organization share

&#x20; the same organization key. Possession of the organization key

&#x20; proves membership in the organization; it does not

&#x20; cryptographically bind a peer to the individual user or

&#x20; device identity it claims. This is a formal MVP limitation,

&#x20; stated in Section 8.6.

\- That the peer is currently authorized by the Control Plane.

&#x20; Authorization is separate. See Section 8.6.



8.4 How the Session Key Is Derived



After the handshake, Peer A and Peer B share a session key.



The session key is derived as follows:



1\. Both peers have a fresh random nonce (sent in the

&#x20;  handshake).



2\. Both peers compute a shared session key using HKDF-SHA256,

&#x20;  with:

&#x20;  - Input key material: the organization key.

&#x20;  - Salt: the two nonces, with a domain-separation prefix.

&#x20;  - Info: a domain-separation string, plus both

&#x20;    organization\_ids, plus both claimed device\_ids.



3\. The result is a 256-bit session key.



The session key is not transmitted. Both peers compute it

locally from the same inputs. Because both peers hold the

organization key and both have the same nonces and identifiers,

they arrive at the same session key.



This is not Diffie-Hellman key agreement. There is no

per-session asymmetric exchange. Both peers hold the same

long-lived symmetric key (the organization key), and they derive

a fresh session key from it plus fresh nonces. This is

appropriate for the MVP's single-key model.



The session key is used for the duration of the session. When

the session ends and a new one begins, a new session key is

derived from new nonces. A session key is never reused across

sessions.



The exact encoding of the salt, the info, and the domain

separation labels is defined in Section 22.



8.5 Key Domains



The organization key is not used directly for any

cryptographic operation other than derivation. It is the input

key material for two distinct derived keys, each with its own

purpose and its own domain-separation label.



The two derived keys:



\- The handshake authentication key. Used during session

&#x20; establishment, in the challenge-response proof. Domain

&#x20; separation label: a fixed string identifying the MVP

&#x20; handshake protocol.



\- The session key. Used for encrypting and authenticating sync

&#x20; messages during the session. Domain separation label: a

&#x20; fixed string identifying the MVP session protocol.



The two labels are distinct. Section 22 defines them exactly.

The purpose of the labels is to ensure that a key derived for

one purpose is never accidentally the same as a key derived

for another purpose, even if the inputs are similar.



The organization key itself is never used as an AEAD key, as

an HMAC key, or as any other direct cryptographic primitive.

It is used only as the input key material for HKDF-SHA256.



8.6 The MVP's Identity and Authorization Model



This subsection states the MVP's identity and authorization

model exactly, so that no later section, no implementation,

and no security review overclaims what the protocol provides.



What the protocol proves during session establishment:



\- Each peer holds the organization key. This is proven by the

&#x20; challenge-response handshake.

\- Each peer is a member of the organization. In the MVP, this

&#x20; follows from holding the organization key, because the

&#x20; organization key is the membership test.



What the protocol does not prove:



\- That a peer is the specific user it claims to be. In the

&#x20; MVP, all authorized devices in the organization share the

&#x20; same organization key. Possession of the organization key

&#x20; proves membership in the organization; it does not

&#x20; cryptographically bind a peer to the individual user

&#x20; identity it claims.

\- That a peer is a specific physical device. The MVP does not

&#x20; distinguish physical devices.

\- That a peer is currently authorized by the Control Plane.

&#x20; Control Plane authorization is separate from shared-key

&#x20; possession.



How the peer's Control Plane authorization is checked during

sync:



Before a session begins, each peer checks the Control Plane's

device\_registrations for the other peer. If the other peer is

listed and not revoked, the session proceeds. If it is not

listed or is revoked (in the funded phase, where revocation

exists), the session is refused.



This check provides coordination metadata, not cryptographic

identity. The Control Plane's device\_registrations tells a peer

which devices the organization has authorized for sync. It does

not cryptographically bind the remote peer to its claimed

identity. A peer that holds the organization key can present

any claimed device\_id and pass the handshake; the handshake

proves possession of the organization key, not possession of a

specific user identity.



This is a formal MVP limitation.



What this limitation means in practice:



\- If an attacker obtains the organization key, they can

&#x20; initiate sessions with any peer in the organization, and

&#x20; present any device\_id they choose. The other peers cannot

&#x20; detect the impersonation cryptographically.

\- Disabling a user's Control Plane account prevents that user

&#x20; from authenticating in the future. It does not prevent a

&#x20; device that already holds the organization key from

&#x20; initiating sessions, until the other peers check the Control

&#x20; Plane and refuse the session based on the account state.

\- Immediate cryptographic revocation is unavailable in the

&#x20; MVP. Key rotation is the funded-phase mechanism for

&#x20; cryptographic revocation.



The MVP's authorization model, stated precisely:



Control Plane account status governs whether a user is

currently recognized as an authorized organization member.

Disabling an account does not revoke the organization key from

an already-enrolled device. Therefore account disabling cannot

provide immediate cryptographic revocation in the MVP.



The MVP accepts this limitation. It is documented in MVP scope

§9.3, in this section, and in Section 28 (Security Properties

the Protocol Provides).



8.7 How a Session Ends



A session ends when:



\- One peer closes the connection cleanly, with a session-end

&#x20; message.

\- The underlying transport fails (network drop, peer crash,

&#x20; etc.).

\- The session times out because no messages have been exchanged

&#x20; for a configurable period.

\- The session is terminated by the Control Plane (in the

&#x20; funded phase, where the Control Plane may signal a peer to

&#x20; drop a session for administrative reasons).



The session key is discarded in every case. It is never

reused. A new session has a new key.



The sync state between the two peers is not lost when a session

ends. It is recorded in the local sync\_state table (see

LOCAL-TABLES.md v1.2 Category D). The next session picks up

where the previous one left off. See Section 18 (Retry and

Recovery After Interruption).



8.8 What a Session Does Not Do



\- It does not synchronize any specific data by itself. It

&#x20; establishes the channel. The data exchange is defined in

&#x20; Part III.

\- It does not persist across process restarts. A new process

&#x20; starts a new session.

\- It does not transfer the organization key. Both peers already

&#x20; hold the organization key before the session begins.

\- It does not prove physical device identity or individual user

&#x20; identity. See Section 8.6.



8.9 What This Section Does Not Do



It does not define the exact wire format of the handshake

messages. That is Section 22.

It does not define the exact HKDF-SHA256 parameters or the

domain-separation labels. Those are fixed protocol

configuration values, recorded in Section 22.

It does not define the exact session timeout value. That is a

configuration value, recorded in the implementation notes.

It does not define the relationship between sessions and the

underlying transport (direct or relay). That is Part IV.



8.10 The Nonce Invariant



This is a protocol invariant that applies to the whole document.



All AEAD nonces MUST NOT be reused with the same AEAD key. This

is a hard rule. It has no exceptions.



Handshake nonces are not AEAD nonces. They are fresh protocol

nonces used for handshake freshness, replay resistance, and

session-key derivation. They are subject to a different rule:

each handshake nonce MUST be freshly generated and MUST NOT be

reused within the same organization key's lifetime.



For XChaCha20-Poly1305, whose nonce is 192 bits, randomly

generated AEAD nonces are acceptable. The nonce space is large

enough that accidental collision is negligible. This does not

make deliberate reuse safe. Reuse is prohibited.



The protocol has several distinct uses of nonces, each with its

own key and its own generation rules:



\- The enrollment package AEAD nonce (Section 7.3). Used with

&#x20; the package encryption key. One per package. Random.

\- The handshake nonces (Section 8.3). One per peer, per

&#x20; handshake. Random. Used for handshake freshness, replay

&#x20; resistance, and session-key derivation. These are protocol

&#x20; nonces, not AEAD nonces.

\- The sync message AEAD nonces (Part III). One per message.

&#x20; Random. Used with the session key.



Each of these uses a different key, so a nonce collision

between two uses is not a problem. Within a single key's use,

nonce reuse is prohibited.



The exact nonce-generation rules for each use are defined in

Section 22.



Source: MULTI-USER-CONCEPT.md v2.0 §4, §6;

ARCHITECTURAL-LAW.md v1.3 §20.3, §21; LOCAL-TABLES.md v1.2

Category D; GORKA-MVP-SCOPE.md v1.1 §9.3.



========================================================================

9\. THE EVENT MODEL

========================================================================



This section defines what an event is, what state is, and the

relationship between them. It restates and refines the model in

MVP scope §8 in wire-level terms.



9.1 Two Kinds of Data



The sync protocol synchronizes two kinds of data:



State — mutable properties of a record.



&#x20; A debtor's current name. A debtor's current phone. A debtor's

&#x20; current status. An action's current assigned\_to. A debt's

&#x20; current amount.



&#x20; State is the "what the record looks like right now." It

&#x20; changes over time. A state value can be replaced by a newer

&#x20; state value.



Events — append-only business facts.



&#x20; A debtor was created. A communication was logged. An action

&#x20; was created. (In the funded phase, a payment was recorded, a

&#x20; promise was created, a status changed.)



&#x20; Events are the "what happened." They do not change. Once an

&#x20; event is recorded, it stays recorded. Two events of the same

&#x20; type both survive.



The two kinds are related but distinct. An event may cause a

state change; a state change is not itself an event unless the

protocol defines an event type for it.



9.2 The MVP Event Set



The MVP produces exactly four event types:



\- DEBTOR\_CREATED — a new debtor record was created on this

&#x20; device.

\- ENTITY\_UPDATED — a mutable property of an existing debtor was

&#x20; changed on this device.

\- ACTION\_CREATED — a new action was created on this device.

\- COMMUNICATION\_LOGGED — a new communication was logged on this

&#x20; device.



This is the MVP event set, from MVP scope §8.1. The MVP produces

no other event types.



The funded phase will add: PAYMENT\_RECORDED, PROMISE\_CREATED,

PROMISE\_BROKEN, CALL\_LOGGED, SMS\_SENT, EMAIL\_SENT, NOTE\_ADDED,

STATUS\_CHANGED, CONTACT\_ATTEMPTED. See MVP scope §8.2.



Deletion is not one of the MVP event types. But deletion must

still be synchronizable.



A state deletion that must propagate to other replicas MUST have

a corresponding synchronizable event or tombstone representation.

A state-table-only deletion is not sufficient for

synchronization. If Device A deletes a communication and only

modifies its own state table, Device B has no way to learn about

the deletion.



The exact MVP deletion mechanism is defined in Section 14

(Event Reconciliation) and Section 25 (Database Application

Rules). Section 9 does not choose the mechanism. It states the

requirement: every state change that must propagate must have a

synchronizable representation.



9.3 The Structure of an Event



Every event, regardless of type, has the following fields on the

wire:



\- event\_id — a globally unique identifier. See Section 10.

\- device\_id — the device instance that produced the event. See

&#x20; Section 4 and Section 11.

\- sequence — a monotonic per-device-instance sequence number.

&#x20; See Section 11.

\- logical\_clock — a causal timestamp assigned by the producing

&#x20; device instance. See Section 12.

\- event\_type — one of the event types in the MVP event set, or

&#x20; one of the funded-phase types.

\- entity\_type — the type of the entity the event concerns

&#x20; ('debtor', 'debt', 'action', 'communication', 'document').

\- entity\_id — the identifier of the entity the event concerns.

&#x20; This is a local identifier. It is not transmitted in the clear

&#x20; to the Control Plane. It travels only inside encrypted sync

&#x20; messages between peers.

\- payload — event-type-specific data. The exact structure per

&#x20; event type is defined in Section 25.

\- created\_at — the device-local wall-clock timestamp. This is

&#x20; informational only. It is not used for ordering. See

&#x20; Section 12.



The exact wire serialization of these fields is defined in

Section 22.



9.4 State Records and Event Records



The local database has both:



\- The state tables: debtors, debts, actions, communications,

&#x20; documents, plus the cache tables. These hold the current

&#x20; state of each record. LOCAL-TABLES.md v1.2 Category A

&#x20; describes them.

\- The event table: sync\_events. This is the append-only record

&#x20; of every valid event originated by or accepted by this

&#x20; device. LOCAL-TABLES.md v1.2 Category D.1 describes it. This

&#x20; document amends the wording in LOCAL-TABLES.md v1.2 D.1 from

&#x20; "produced" to "originated by or accepted by"; the amendment

&#x20; is recorded in Section 30 and in the amendments pass.



The distinction is important. sync\_events contains:



\- Every valid event this device has originated locally.

\- Every valid event this device has received from a peer and has

&#x20; accepted.



An event is accepted when it passes validation (Section 23) and

its effect is applied or reconciled (Sections 13, 14, 25). An

event that is malformed, that fails authentication, that has an

invalid event type, or that belongs to a different organization

is not accepted, and is not written to sync\_events.



Each event carries its originating device\_id. So a query can

distinguish locally-originated events (device\_id equals this

device instance's identifier) from received events (device\_id

differs). No separate table is needed for this distinction.



Important: no individual device is assumed to possess the

complete organization event history. Each device holds the

events it has originated and the events it has accepted. The

union of event sets across peers represents the events known by

those peers collectively. During normal operation, a device may

hold fewer events than the organization has produced, because

some events may not yet have reached it. See Section 14.



When a device originates a change (creates a debtor, updates a

debtor, logs a communication, creates an action), it does two

things in one transaction:



1\. It writes or updates the row in the appropriate state table.

2\. It appends a new row to the sync\_events table.



When a device receives a sync message containing one or more

events from a peer, it processes each event in this order:



1\. Decrypt and authenticate the message. See Section 22.

2\. Validate each event's structure and its fields. See

&#x20;  Section 23.

3\. Check the event\_id against the local sync\_events. If the

&#x20;  event\_id is already known, the event is a duplicate. The

&#x20;  device does not append it and does not apply it again. See

&#x20;  Section 15.

4\. If the event is not a duplicate, append it to sync\_events

&#x20;  and apply its effect to the appropriate state table,

&#x20;  according to the reconciliation rules in Section 13 and

&#x20;  Section 14.

5\. Send an acknowledgement to the peer. See Section 16.



All of these steps happen in one transaction per event. See

Section 25 for the transactional rules.



The state table reflects the current state. The event table

reflects the history (including accepted events from peers).

The event table is the source of truth for the sync protocol.

The state table is what the application reads.



9.5 Why Both



The application needs current state. It does not want to

recompute it from events on every query.



The sync protocol needs the event history. It cannot synchronize

"current state" alone, because two devices might have different

"current state" for the same record, and the protocol needs to

know how each arrived there.



Both are necessary. They are kept consistent by writing them in

the same transaction (Section 25).



9.6 Events Are Not Mutated



An event, once written to sync\_events, is never updated and

never deleted. This is the append-only property.



If an event is wrong (for example, a communication was logged

with a typo in the content), the correction is a new event, not

an edit of the old one. The MVP event set does not currently

have an event type for corrections. In the MVP, the correction

is made by:



\- Logging a new communication with the corrected content, or

\- Deleting the communication via the UI.



Deletion does not delete the event. It produces a

synchronizable representation of the deletion (an event or a

tombstone), which is appended to sync\_events like any other

event. The exact representation is defined in Section 14.



The point of this subsection: the sync protocol's history is

not rewritten. Corrections are new facts, not edits to old

facts. Deletions are new facts, not removals of old facts.



9.7 Events Are Not the Application Audit Log



The application audit log (local audit\_log table,

LOCAL-TABLES.md v1.2 Category A.6) is a separate thing. It

records who did what, for compliance and human review. It is

not the sync protocol's source of truth.



The sync\_events table is the sync protocol's source of truth.

It is separate from the audit log. Both exist. Neither replaces

the other.



This is restated from MVP scope §8.7.



9.8 What This Section Does Not Do



It does not define the exact wire format of an event. That is

Section 22.

It does not define event identity rules. That is Section 10.

It does not define sequence number rules. That is Section 11.

It does not define the logical clock. That is Section 12.

It does not define what happens when two events conflict. That

is Section 13 (State Reconciliation) and Section 14 (Event

Reconciliation).

It does not define the deletion mechanism in full. That is

Section 14.

It does not define the payload structure per event type. That

is Section 25.



Source: GORKA-MVP-SCOPE.md v1.1 §8;

MULTI-USER-CONCEPT.md v2.0 §7; LOCAL-TABLES.md v1.2 Category A

and Category D.1.



========================================================================

10\. EVENT IDS AND UNIQUENESS

========================================================================



This section defines how an event is uniquely identified, and

what guarantees that uniqueness.



10.1 The Rule



Every event has an event\_id. The event\_id is unique across the

entire organization, forever.



Two events with the same event\_id are the same event. No

exceptions. This is the foundational rule of duplicate detection

(Section 15) and of event reconciliation (Section 14).



10.2 The Format



The event\_id is a UUIDv7.



A UUIDv7 is a 128-bit identifier with the following structure:



\- The first 48 bits encode a Unix timestamp in milliseconds.

\- The next 4 bits are a version marker (0b0111 for version 7).

\- The next 12 bits are random.

\- The next 2 bits are a variant marker.

\- The remaining 62 bits are random.



UUIDv7 is defined in RFC 9562 (the successor to RFC 4122). It

is a standard, not a GORKA-specific construction.



RFC 9562 permits the 74 bits that follow the version marker to

be used for randomness or for implementation-defined

monotonicity mechanisms. GORKA's implementation uses randomness

only. The protocol does not depend on the optional monotonicity

mechanisms. Per-device-instance monotonicity is provided by the

separate sequence number (Section 11), not by the UUIDv7.



10.3 Why UUIDv7



UUIDv7 has three properties the protocol needs:



1\. Globally unique with overwhelming probability. The 74 random

&#x20;  bits make collision astronomically improbable. Two devices

&#x20;  generating UUIDv7s at the same millisecond will not collide,

&#x20;  in practice.



2\. Time-sortable. UUIDv7s sort in roughly chronological order,

&#x20;  because the high bits encode a timestamp. This is useful for

&#x20;  local database indexing and for debugging. It is not used

&#x20;  for protocol ordering.



3\. No coordination. A device can generate a UUIDv7 without

&#x20;  asking anyone. This fits the protocol's design: devices do

&#x20;  not coordinate their event IDs with each other or with the

&#x20;  Control Plane.



UUIDv7 does not provide strict per-device-instance monotonicity

in its default form. If a device's wall clock moves backward, a

later UUIDv7 can sort before an earlier one. GORKA does not rely

on UUIDv7 for per-device-instance ordering. It relies on the

sequence number. See Section 11.



10.4 The event\_id Is Not the Ordering Rule



The timestamp embedded in the UUIDv7 is the producing device's

wall-clock time. It is not a reliable ordering key. Two devices'

clocks may be skewed. The protocol does not use the timestamp

embedded in the UUIDv7 for ordering. It uses the sequence

number (Section 11) and the logical clock (Section 12).



The UUIDv7 timestamp is informational. It is useful for

debugging and for local index locality. It is not a protocol

input.



10.5 The device\_id Is a Separate Field



The event\_id does not encode which device produced the event.

The device\_id is a separate field on the event, per Section 9.3.



The reason: the protocol needs to know the originating device

for several purposes (sequence number scope, logical clock

scope, duplicate detection, conflict resolution). Embedding it

in the event\_id would require the protocol to parse the

event\_id to extract it. That is fragile, and it couples the

event identity format to the device identity format. Two

separate fields is cleaner.



10.6 Uniqueness Guarantees



The protocol guarantees event\_id uniqueness by:



\- Generating UUIDv7s with a cryptographically secure random

&#x20; number generator.

\- Not using the same UUIDv7 for two different events.

\- Not reusing UUIDv7s after they have been used once.



For a single pair of UUIDv7 values that share the same

timestamp, the probability that their 74 random bits collide is

approximately 2^-74. Across many generated values, the

probability of at least one collision grows with the number of

values generated (the birthday effect). For any realistic

number of events in an organization, the probability remains

negligible.



The protocol treats accidental collision as negligible. If a

collision is ever detected (two different events with the same

event\_id), the protocol treats it as a protocol violation. See

Section 23 (Corruption and Tampering Handling).



10.7 What Event IDs Are Not



\- They are not sequence numbers. Sequence numbers are per-

&#x20; device-instance and monotonic. Event IDs are global and

&#x20; random.

\- They are not logical clocks. Logical clocks are assigned per

&#x20; event by the producing device and are advanced by reception

&#x20; of other events. Event IDs are assigned once, at creation,

&#x20; and never change.

\- They are not content hashes. Two events with the same content

&#x20; have different event IDs. The event ID identifies the event,

&#x20; not the content.



10.8 What This Section Does Not Do



It does not define the wire serialization of the event\_id.

That is Section 22.

It does not define how duplicate events are detected and

handled. That is Section 15.

It does not define how the logical clock is computed. That is

Section 12.

It does not define the device\_id format. That is Section 11

and Section 25.



Source: RFC 9562 (UUIDv7);

GORKA-MVP-SCOPE.md v1.1 §8; MULTI-USER-CONCEPT.md v2.0 §7.



========================================================================

11\. SEQUENCE NUMBERS AND PER-DEVICE COUNTERS

========================================================================



This section defines the sequence number, which is the per-device-

instance ordering field.



11.1 The Rule



Every event originated by a device instance has a sequence

number. The sequence number is:



\- A non-negative integer.

\- Monotonic per device instance. Every event a device instance

&#x20; originates has a strictly greater sequence number than the

&#x20; previous event that same instance originated.

\- Never reset. It does not restart when the process restarts.

&#x20; It does not reset when the device instance goes offline. It

&#x20; does not reset when a new session begins.

\- Never reused. A device instance does not originate two events

&#x20; with the same sequence number.



11.2 The Scope



The sequence number is scoped to a device instance.



Device A's event with sequence 5 is a different fact from

Device B's event with sequence 5. They are not the same event.

Their event\_ids are different. Their device\_ids are different.



The pair (device\_id, sequence) is globally unique across the

organization. It identifies a single event. It is a secondary

key on the event, alongside the event\_id.



11.3 The Device Instance and the Sequence Namespace



The sequence number is scoped to a device instance, and the

device\_id identifies the device instance.



A device instance is created when a user first enrolls a new

local GORKA database. The device instance identifier is

generated once for that database instance, using a

cryptographically secure random number generator, and remains

unchanged for the lifetime of that database instance.



If the database instance is lost, deleted, or replaced by a new

one (for example, by reinstallation or a fresh setup), a new

device instance identifier is generated for the new database

instance. The old identifier is not reused.



The device instance identifier is stored in the SQLCipher

database. It is available to the sync engine after the database

is unlocked.



The device\_id used on the wire combines the user identity with

the device instance identifier. The exact format is defined in

Section 25.



The protocol invariant:



A device instance identifier MUST NOT be reused for a different

local database instance.



The reason: a device instance and its sequence namespace are

one-to-one. If the identifier is reused, the sequence numbers

may collide, and the protocol cannot distinguish an event from

the old instance from an event from the new instance.



This is an identifier, not a cryptographic device

authentication. Possession of the organization key proves

membership in the organization, not physical-device identity.

See Section 8.6.



11.4 The Counter



Each device instance maintains a sequence counter. The counter

is initialized to 0 when the device instance is created (at

enrollment time). The counter is stored in the local database,

in the sync\_state table (LOCAL-TABLES.md v1.2 Category D.2).



When the device instance originates an event:



1\. The transaction atomically allocates the next sequence

&#x20;  number (current counter + 1).

2\. The device writes the event to sync\_events, with the new

&#x20;  sequence number.

3\. The device updates the counter to the new value.

4\. Steps 1 through 3 happen in one transaction.



The counter is part of the device instance's persistent state.

It survives process restarts. See Section 25 for the

transactional rules.



The protocol requires that:



\- No committed transaction may contain an event without the

&#x20; corresponding counter advancement.

\- No committed counter advancement may exist without the

&#x20; corresponding event.



If a transaction fails mid-write, either both the event and the

counter update are committed, or neither is. Sequence numbers

may be skipped (an allocated number that was never committed),

but they are never reused.


The first event originated by a device instance has sequence number 1. Sequence number 0 is the initial value of the counter before any event has been originated; no event has sequence number 0.

11.5 Sequence Numbers Are Not Necessarily Contiguous



The sequence numbers a device instance produces are strictly

increasing but not necessarily contiguous. A gap can occur if a

transaction allocates a sequence number and then fails to

commit. The next event the device instance originates uses the

next value after the allocated-but-uncommitted one.



For example, if the counter was at 3 and a transaction allocates

4 and then fails, the counter is still at 3 (because the

transaction rolled back), and the next event uses 4. So the

sequence numbers might be 1, 2, 3, 4. There is no gap in that

case.



But if the counter was at 3 and a transaction allocates 4,

commits the counter but fails to commit the event (which is

architecturally forbidden but may occur under extreme

conditions such as a filesystem failure), the counter is at 4

and the next event uses 5. Then the sequence numbers are 1, 2,

3, 5. There is a gap at 4.



The protocol allows gaps. It does not require contiguity. The

rule is strict monotonicity, not contiguity. Gaps are harmless

and they simplify crash recovery.



11.6 Why Monotonic



Monotonic sequence numbers give the protocol a total order on

each device instance's events.



Given two events originated by the same device instance, one

has a smaller sequence number and one has a larger one. There

is no tie. There is no ambiguity. This is true even if the

device's wall clock is wrong, even if the device instance goes

offline for days, even if the device instance crashes and

restarts.



Sequence numbers do not depend on wall-clock time. They depend

only on the device instance's own counter, which is stored

locally and incremented locally.



11.7 Sequence and Causal Ordering Are Parallel Fields



Sequence numbers and logical clocks are two separate fields on

every event. They are both maintained by the originating device

instance, but they answer different questions:



\- Sequence answers: "In what order did this device instance

&#x20; originate its own events?"

\- Logical clock answers: "What causal position does this event

&#x20; have relative to the events this device instance has

&#x20; observed?"



They are parallel, not sequential. The sequence number is not

the input to the logical clock. The logical clock is a separate

per-device state variable, maintained by the protocol's clock

discipline (Section 12).



A device instance's logical clock may advance when it receives

a peer's event, even though no local event was originated. That

is why the logical clock cannot be derived from the sequence

number alone.



A logical clock represents causal position. It does not

establish a complete total ordering of concurrent events. Two

events that neither device has observed relative to the other

may have equal or otherwise incomparable logical clock values.

When the protocol needs a single winner among concurrent

events, it uses the deterministic tie-break rule defined in

Section 12.



Section 12 defines the logical clock discipline and the

tie-break rule exactly.



11.8 Sequence Numbers Are Not the State-Reconciliation Rule



The protocol does not use sequence numbers directly to decide

which state value wins. It uses the total order defined in

Section 12, which is built from the logical clock plus a

deterministic tie-breaker.



The sequence number is an input to the protocol's bookkeeping

(duplicate detection, reconciliation bookkeeping, recovery

after interruption). It is not the state-reconciliation rule.



Section 12 and Section 13 define the state-reconciliation rule

exactly.



11.9 Sequence Numbers Are Not Exposed to the Control Plane



Sequence numbers are part of the sync protocol between peers.

They travel inside encrypted sync messages. They are never sent

to the Control Plane. The Control Plane does not see them.



This is because sequence numbers, taken together, could reveal

how many events a device instance has originated. That is

business metadata the invariant does not permit the Control

Plane to see at per-device granularity. See

DATA-BOUNDARY-MATRIX.md v1.2 §20.



11.10 What This Section Does Not Do



It does not define how the sequence number relates to the

logical clock. That is Section 12.

It does not define the wire serialization of the sequence

number. That is Section 22.

It does not define the exact device\_id format. That is

Section 25.

It does not define what happens if the device instance's

counter is lost. That is Section 27 (Failure Scenarios).

It does not define the transactional rules in full. That is

Section 25.



Source: MULTI-USER-CONCEPT.md v2.0 §7;

LOCAL-TABLES.md v1.2 Category D.1, D.2; GORKA-MVP-SCOPE.md v1.1

§8.



========================================================================

12\. LOGICAL ORDERING AND "MOST RECENT"

========================================================================



This section defines the logical clock discipline and the

deterministic total order the protocol uses when a single winner

is required among concurrent events.



12.1 The Problem



Two devices in the same organization can both change the same

state. If they change it at roughly the same time, before either

has seen the other's change, the two changes are concurrent.



Example:



&#x20; Device A changes debtor D's phone to "111".

&#x20; Device B changes debtor D's phone to "222".



Neither device has seen the other's change.



The protocol needs a rule that answers: which value does the

converged state use?



12.2 What This Rule Is Not



It is not wall-clock time.



Wall-clock time is unreliable in a distributed system. Two

devices' clocks may be skewed by minutes or hours. A device's

clock may jump forward or backward when it synchronizes with an

NTP server. A device's clock may be wrong because the user set

it wrong. A device's clock may be wrong because the machine was

offline and the operating system's time service is not running.



The protocol does not use wall-clock time to order events. The

`created\_at` field on each event carries the originating

device's wall-clock timestamp. It is informational only.



It is not the UUIDv7 timestamp.



The UUIDv7 carries a millisecond timestamp in its high bits. It

is time-sortable in the same approximate sense that wall-clock

time is. It has the same unreliability. The protocol does not use

the UUIDv7 timestamp to order events.



It is not the sequence number alone.



The sequence number is per-device-instance. It orders events

originated by the same instance. It has no relationship to

events originated by a different instance. Sequence 5 on Device

A and sequence 5 on Device B are unrelated facts.



12.3 The Logical Clock



The protocol maintains a logical clock. Each device instance has

its own logical clock counter. The counter is a non-negative

integer. It is stored in the local database, in the sync\_state

table (LOCAL-TABLES.md v1.2 Category D.2).



The rules:



Rule 1 — When a device instance originates an event.



&#x20; The device sets the event's `logical\_clock` field to the

&#x20; current value of its logical clock counter.



&#x20; Then the device increments the counter by one.



Rule 2 — When a device instance accepts an event.



&#x20; The device sets its logical clock counter to:



&#x20;   max(current\_counter, received\_event.logical\_clock + 1)



&#x20; The counter is never decreased.



&#x20; An event that is not accepted does not affect the counter.

&#x20; Specifically:



&#x20; - A malformed or unauthenticated event does not affect the

&#x20;   counter.

&#x20; - A duplicate event (an event whose event\_id is already in

&#x20;   sync\_events) does not affect the counter.

&#x20; - An event that fails validation does not affect the counter.



&#x20; Only an event that is newly accepted advances the counter.



Rule 3 — The counter never decreases.



&#x20; Its value is monotonic. It only increases, by Rule 1 or by

&#x20; Rule 2.



Rule 4 — The counter is persistent.



&#x20; It is stored in the local database and survives process

&#x20; restarts.



Rule 5 — Atomicity.



&#x20; Rule 1 and Rule 2 are atomic with the event's commit. When

&#x20; the device originates an event, the state change, the event

&#x20; insertion, the sequence allocation, and the logical clock

&#x20; advancement are all committed in one transaction. When the

&#x20; device accepts an event, the event insertion, the logical

&#x20; clock update, and the state reconciliation are all committed

&#x20; in one transaction.



&#x20; See Section 25 for the full transactional rules.



12.4 What the Logical Clock Provides



The logical clock provides causal ordering.



If event A causally precedes event B (that is, B's originating

device had already accepted A when B was originated), then:



&#x20; A.logical\_clock < B.logical\_clock



This is guaranteed. It is the fundamental property of Lamport

clocks.



Causality in this protocol means:



\- A and B were originated by the same device instance, and A

&#x20; was originated before B.

\- A and B were originated by different device instances, and

&#x20; the originating device of B had already accepted A when B was

&#x20; originated.

\- A causally precedes some C, C causally precedes some B, and

&#x20; by transitivity A causally precedes B.



12.5 What the Logical Clock Does Not Provide



The logical clock does not provide a complete total order over

all events.



Two events that are concurrent (neither causally precedes the

other) may have:



\- The same logical clock value.

\- Different logical clock values, in either direction.



The logical clock is a conservative approximation. When the

protocol needs a single winner among concurrent events, it uses

the deterministic total order defined in Section 12.6.



12.6 The Deterministic Total Order



The protocol defines a total order over all events, called the

protocol order.



The protocol order is the tuple:



&#x20; (logical\_clock, device\_id, sequence)



compared lexicographically:



1\. Compare logical\_clock values as integers. The smaller value

&#x20;  precedes the larger.



2\. If the logical\_clock values are equal, compare device\_id

&#x20;  values as byte strings (the canonical serialization of the

&#x20;  device\_id; see Section 25). The lexicographically smaller

&#x20;  device\_id precedes the lexicographically larger.



3\. If the logical\_clock values are equal and the device\_id

&#x20;  values are equal, compare sequence numbers as integers. The

&#x20;  smaller sequence number precedes the larger.



Because (device\_id, sequence) is globally unique (Section

11.2), no two distinct events have the same tuple. The

lexicographic comparison therefore defines a strict total order

over all events.



The protocol order is not a causal order. It is a deterministic

total order. Two events that are concurrent can be ordered by

the protocol order even though neither caused the other. The

protocol order is used only when a single winner must be chosen;

it is not a claim about causality.



The protocol order is deterministic. Every device that sees the

same two events computes the same precedence between them,

regardless of the order in which the events arrived, regardless

of the devices' wall clocks, regardless of anything else.



12.7 "Most Recent" — the Precise Rule



When the protocol needs to decide which of two competing state

changes is "most recent," it uses the protocol order.



"Most recent" means: later in the protocol order.



Given two competing state changes S1 and S2:



\- If S1 < S2 in the protocol order, S2 is "more recent."

\- If S2 < S1 in the protocol order, S1 is "more recent."



This definition does not depend on wall-clock time. It does not

depend on the order in which events arrived at any device. It

does not depend on which device originated the events or when.



The definition is deterministic and total. Two devices with the

same set of accepted events compute the same "most recent"

answer.



12.8 What "Most Recent" Means for State Reconciliation



Section 13 uses the protocol order to determine the outcome of

competing state changes.



The rule for state reconciliation is:



When two competing state changes for the same field of the same

record exist, the state change that is "most recent" in the

protocol order determines the field's current value. The value

of the losing state change is recorded as the losing value in a

per-field history record, so that no information is silently

lost.



The precise mechanism (how the history is kept, how the losing

value is defined) is in Section 13.



12.9 The Order-Independence Invariant



Given the same set of accepted events, every device MUST derive

the same final state. The order in which the events were

received MUST NOT affect the final state.



This is the order-independence invariant. It is what allows

devices that have seen the same events to converge, even if

they saw those events in different orders.



The protocol order (Section 12.6) is what makes this invariant

hold. Without it, two devices could legitimately disagree about

the final state.



Note: the invariant is about final state, not about whether

every event can be applied immediately on arrival. An event may

be deferred if its referenced entity is not yet available (see

Section 14.5). Once all required events have been accepted, the

final state is determined by the protocol order, not by arrival

order.



12.10 What This Rule Does Not Do



It does not decide which state change is "correct" in any

business sense. It decides which state change wins. The losing

value is preserved so that a human can review the case if

needed.



It does not prevent conflicts. It resolves them

deterministically. The MVP's approach to conflicts is: resolve

deterministically, preserve the losing value, and let the

application or the user take it from there.



It does not define event reconciliation. Section 14 defines what

happens when two events are not competing state changes.



12.11 What This Section Does Not Do



It does not define the exact wire serialization of the

logical\_clock field. That is Section 22.

It does not define the exact format of the device\_id. That is

Section 25.

It does not define state reconciliation in full. That is

Section 13.

It does not define event reconciliation in full. That is

Section 14.



Source: MULTI-USER-CONCEPT.md v2.0 §7;

GORKA-MVP-SCOPE.md v1.1 §8.5, §8.6; RFC 9562.





========================================================================

13\. STATE RECONCILIATION

========================================================================



This section defines how competing state changes for the same

record resolve.



13.1 What State Reconciliation Is



State is the current value of a record's mutable fields.



For a debtor record, state includes: name, surname, email,

phone, and the fields inside the `data` JSON. For a debt: amount,

currency, status, due\_date, description, and the fields inside

`data`. For an action: type, status, assigned\_to, due\_date,

description, and the fields inside `data`.



State reconciliation is what happens when two devices have both

changed the same field of the same record, and the protocol

must converge on one value.



13.2 The Rule



When two competing state changes for the same field of the same

record exist, the protocol uses the protocol order (Section

12.6):



\- The state change that is "most recent" in the protocol order

&#x20; determines the field's current value.

\- The value of the losing state change is recorded as the

&#x20; losing value in a per-field history record.



The rule applies per field, not per record.



Example:



&#x20; Device A produces EA (ENTITY\_UPDATED, entity\_id=D,

&#x20; changes=\[phone="111", email="a@example.com"]).



&#x20; Device B produces EB (ENTITY\_UPDATED, entity\_id=D,

&#x20; changes=\[phone="222"]).



&#x20; The protocol reconciles D's phone to whichever of the two

&#x20; changes is "most recent" in the protocol order. The protocol

&#x20; reconciles D's email to "a@example.com", because B made no

&#x20; competing change to it.



Per-field reconciliation is deliberate. It means that two

devices that have changed different fields of the same record

do not lose each other's changes.



An ENTITY\_UPDATED event carries a set of field changes, not

necessarily a single field change. The whole event has one

event\_id, one sequence, and one logical\_clock. Per-field

reconciliation applies the event's protocol-order position to

each field it changes. Section 25 defines the payload structure.



13.3 The Losing Value



When a state change loses a reconciliation, its value is

preserved in a per-field history record. The history record

carries:



\- The record identifier (entity\_type, entity\_id).

\- The field name.

\- The losing value.

\- The event\_id of the state change that lost.

\- The event\_id of the state change that won.

\- The timestamp of the reconciliation.



The history record is stored locally. It is not synchronized in

the MVP. It is for the local application's use, and for

compliance review if a client needs to explain why a field has

its current value.



The history record is not a sync event. It does not travel

between peers. It is derived state, computed locally by each

device as it applies the protocol order.



The terminology used throughout this document and in the

history record is "losing value." It is not the "previous

value." The two are not the same. In a sequence of competing

changes, a value may lose more than once, and the immediately

preceding value may not be the value the current winner

defeated.



13.4 The Deterministic History Invariant



Given the same set of accepted events, a device MUST derive

the same synchronized state and the same conflict history,

regardless of event arrival order.



This is a strong invariant. It requires that:



\- The protocol order (Section 12.6) is used consistently.

\- The history record's content depends only on the events and

&#x20; their protocol-order positions, not on when they arrived.

\- No wall-clock time, no arrival order, and no local state

&#x20; beyond the accepted event set influences the history.



Two devices that have accepted the same events, in any order,

produce identical history records.



13.5 Example



Device A and Device B both have debtor D.



&#x20; D.phone = "000" (initial state, from D's creation).



Device A, offline, changes D.phone to "111".



&#x20; A produces event EA (ENTITY\_UPDATED, entity\_id=D,

&#x20; changes=\[phone="111"], logical\_clock=1).



Device B, offline, changes D.phone to "222".



&#x20; B produces event EB (ENTITY\_UPDATED, entity\_id=D,

&#x20; changes=\[phone="222"], logical\_clock=1).



Both devices come online.



Device A accepts EB. It compares EA and EB in the protocol

order.



&#x20; EA: logical\_clock=1, device\_id=A, sequence=1.

&#x20; EB: logical\_clock=1, device\_id=B, sequence=1.



&#x20; The protocol order compares logical\_clock first. Both are 1.

&#x20; Then it compares device\_id. Suppose A's device\_id sorts

&#x20; before B's.



&#x20; So EA < EB. EB is "more recent."



&#x20; D.phone becomes "222" on A's side.



&#x20; A records a history entry: field=phone, losing value="111",

&#x20; losing event\_id=EA.event\_id, winning event\_id=EB.event\_id.



Device B accepts EA. It compares EA and EB in the protocol

order. Same computation. EB is "more recent."



&#x20; D.phone remains "222" on B's side.



&#x20; B records a history entry with the same content as A's.



Both devices converge on D.phone = "222", and both have the

same history record.



13.6 What State Reconciliation Does Not Do



It does not resolve conflicts that are not state changes. Two

communication logs for the same debtor are separate business

facts, not competing state changes. Both survive. See

Section 14.



It does not decide which value is business-correct. It decides

which value the protocol uses. The losing value is preserved

for review.



It does not apply to the `deleted` field specially. The

`deleted` field is monotonic (see Section 14.3). It is not

subject to the protocol order, because there is nothing to

compete once it is true. See Section 14.3.



13.7 What This Section Does Not Do



It does not define the exact wire serialization of a state

change. That is Section 22.

It does not define how the history record is stored. That is

Section 25.

It does not define event reconciliation. That is Section 14.

It does not define the delete mechanism in full. That is

Section 14.



Source: MULTI-USER-CONCEPT.md v2.0 §7;

GORKA-MVP-SCOPE.md v1.1 §8.5, §8.8.



========================================================================

14\. EVENT RECONCILIATION AND DELETION

========================================================================



This section defines two things:



\- Event reconciliation: how events that are not competing state

&#x20; changes are handled when they arrive from a peer.

\- Deletion: how deletions propagate and converge.



14.1 What Event Reconciliation Is



Events are append-only business facts. Two events of the same

type are not competing. They are two facts. Both survive.



Example:



&#x20; Device A logs a communication with debtor D at 10:00.



&#x20; Device B logs a communication with debtor D at 10:05.



&#x20; These are two communications. They are not competing. Both

&#x20; exist. Both are recorded. Both are visible in the

&#x20; application.



Event reconciliation is what happens when a peer's events

arrive:



1\. For each event, the device checks the event\_id against its

&#x20;  local sync\_events. If the event\_id is already known, the

&#x20;  event is a duplicate. The device does not append it and

&#x20;  does not apply it. See Section 15.



2\. If the event is not a duplicate, the device validates it

&#x20;  (Section 23) and appends it to sync\_events.



3\. The device applies the event's effect to the state, according

&#x20;  to the event type:



&#x20;  - DEBTOR\_CREATED: insert a new debtor row with the payload's

&#x20;    initial state. If a row with the same entity\_id already

&#x20;    exists (created by a concurrent peer), the state

&#x20;    reconciliation rule (Section 13) applies to conflicting

&#x20;    fields.

&#x20;  - ENTITY\_UPDATED: apply the payload's field changes to the

&#x20;    entity's current state, using the protocol order for any

&#x20;    conflict. See Section 13.

&#x20;  - ACTION\_CREATED: insert a new action row with the payload's

&#x20;    initial state. If a row with the same entity\_id already

&#x20;    exists (created by a concurrent peer), the state

&#x20;    reconciliation rule (Section 13) applies to conflicting

&#x20;    fields. This is concurrent creation of the same

&#x20;    entity\_id, not event duplication. See Section 14.4.

&#x20;  - COMMUNICATION\_LOGGED: insert a new communication row.

&#x20;    Communications are append-only. No reconciliation is

&#x20;    needed; both communications survive.



4\. The device sends an acknowledgement to the peer. See

&#x20;  Section 16.



14.2 Arrival Order Does Not Affect Final State



The order in which events arrive does not affect the final

converged state.



An event may be temporarily deferred if its referenced entity

or prerequisite state is not yet available. Once all required

events have been accepted, the resulting state is determined by

the protocol rules, not by arrival order.



Example:



&#x20; Device A creates debtor D (DEBTOR\_CREATED).



&#x20; Device B has not yet received the creation but receives an

&#x20; ENTITY\_UPDATED for D (phone="222").



&#x20; Device B cannot apply the ENTITY\_UPDATED yet, because D does

&#x20; not exist in B's state. B defers the event.



&#x20; Later, B receives DEBTOR\_CREATED(D). B applies the creation,

&#x20; then applies the deferred ENTITY\_UPDATED.



The final state on B is the same as if the events had arrived

in the other order.



The deferred event is stored in sync\_events when it is accepted

(before it is applied). It is marked as pending application in

the local database. Section 25 defines the pending-application

mechanism.



14.3 Deletion



Deletion is a state change: an entity goes from active to

deleted. It is not a new business fact. It is represented in

the MVP as an ENTITY\_UPDATED event whose payload sets the

`deleted` field to true.



The `deleted` field is monotonic. Once true, it does not

return to false.



Rule: no event may set `deleted` from true back to false. The

protocol does not support resurrection in the MVP.



Why monotonic:



\- The MVP has no application-level operation for restoring a

&#x20; deleted record. There is no "undelete" button.

\- Monotonic deletion is simpler to reason about. Any event that

&#x20; sets `deleted = true` wins over any earlier event. Two

&#x20; concurrent deletes converge on `true` without needing the

&#x20; protocol order to compare them.

\- If the funded phase needs resurrection, it can be introduced

&#x20; as a new capability with its own semantics. The MVP does not

&#x20; need it.



The MVP's delete mechanism:



1\. The user deletes a record through the UI (a debtor, a debt,

&#x20;  an action, a communication, a document).



2\. The device writes a soft-delete marker in the state table.

&#x20;  The record is not physically removed. The field

&#x20;  `deleted = true` is set. An optional `deleted\_at` field may

&#x20;  be set for informational purposes. The `deleted\_at` field is

&#x20;  informational; it is not the synchronized conflict value. The

&#x20;  synchronized value is `deleted`.



3\. The device produces an ENTITY\_UPDATED event with:

&#x20;  - entity\_type: the type of the deleted entity.

&#x20;  - entity\_id: the identifier of the deleted entity.

&#x20;  - changes: \[deleted = true] (and optionally a

&#x20;    device-local informational `deleted\_at`).

&#x20;  - logical\_clock, sequence, event\_id, device\_id, created\_at:

&#x20;    as for any event.



4\. The device appends the event to sync\_events.



When a peer receives the ENTITY\_UPDATED event with `deleted =

true`:



1\. It checks the event\_id. If the event is a duplicate, no-op.



2\. It appends the event to sync\_events.



3\. It sets the local entity's `deleted` field to true. The

&#x20;  `deleted` field is monotonic; no protocol-order comparison

&#x20;  is needed.



4\. If a competing state change had set `deleted = true` on

&#x20;  another device concurrently, both devices converge on true

&#x20;  without needing to compare the two events. The two deletes

&#x20;  are both accepted, and the resulting state is the same on

&#x20;  both devices.



5\. It acknowledges the event to the peer. See Section 16.



14.4 Concurrent Creation of the Same entity\_id



Two ACTION\_CREATED events (or DEBTOR\_CREATED events) with the

same entity\_id but different event\_ids are not duplicates.

They are two distinct events that happen to refer to the same

entity\_id.



The protocol treats concurrent creation of the same entity\_id

as a state-reconciliation case, not an event-identity

duplicate. The two events are both accepted and appended to

sync\_events. The state reconciliation rule (Section 13) applies

to the fields they set.



Event duplicate detection remains exclusively by event\_id

(Section 15). It does not use entity\_id.



14.5 Deferred Application



An event whose referenced entity does not yet exist locally

cannot be applied immediately. It is stored in sync\_events but

marked as pending application.



The pending event is applied as soon as the referenced entity

becomes available (usually because the corresponding

DEBTOR\_CREATED or ACTION\_CREATED event has since been

accepted).



The exact mechanism for tracking pending events is defined in

Section 25.



An event is never dropped because it cannot be applied

immediately. It stays in sync\_events until it can be applied.



14.6 Physical Removal



In the MVP, records are never physically removed from the

state tables. Deletion sets `deleted = true`. The record

remains in the database.



The reasons:



\- Synchronization needs the record's identifier to remain

&#x20; available, so that a deletion event can refer to it.

\- If a record is physically removed and a peer later sends an

&#x20; event referring to it, the receiving device needs to be able

&#x20; to record the event without error.

\- The application audit log may need to show that the record

&#x20; once existed.



A separate, funded-phase feature may introduce physical

deletion for records that have been soft-deleted for a

sufficient period and whose events are no longer needed. The

MVP does not implement it.



14.7 What Event Reconciliation Does Not Do



It does not apply events in arrival order. It applies them

according to the protocol order for state changes and

independently for append-only events. The final state is

order-independent (Section 14.2). Individual events may be

deferred (Section 14.5).



It does not skip events because they are old. An old event that

was never seen before is applied normally. The protocol order

determines its effect, not the age of the event.



It does not silently drop events. Every accepted event is

appended to sync\_events and its effect is applied.



It does not prevent duplicates by content. Two events with the

same content but different event\_ids are two different events.

Both are applied. Duplicate detection is by event\_id (Section

15), not by content.



It does not support resurrection. Once `deleted = true`, the

field does not return to false (Section 14.3).



14.8 What This Section Does Not Do



It does not define the exact wire serialization of the

ENTITY\_UPDATED payload. That is Section 22.

It does not define the exact schema of the history record.

That is Section 25.

It does not define the exact soft-delete field names in the

state tables. That is Section 25.

It does not define the pending-application mechanism in full.

That is Section 25.

It does not define the payload structure per event type in

full. That is Section 25.

It does not define duplicate detection. That is Section 15.

It does not define acknowledgements. That is Section 16.



Source: MULTI-USER-CONCEPT.md v2.0 §7;

GORKA-MVP-SCOPE.md v1.1 §8.4, §8.5; LOCAL-TABLES.md v1.2

Category A, Category D.



========================================================================

15\. DUPLICATE DETECTION

========================================================================



This section defines how a device detects that it has already

seen an event, and what it does when it has.



15.1 The Rule



An event is a duplicate if and only if its event\_id is already

present in the local sync\_events table.



The protocol does not deduplicate by content, by device\_id, by

sequence number, by logical\_clock, or by any other key. Only

event\_id. This follows directly from Section 10.1:



&#x20; Two events with the same event\_id are the same event.

&#x20; No exceptions.



15.2 When Duplicate Detection Happens



Duplicate detection occurs only after the message has passed

message-level authentication and envelope validation, and before

the event is accepted into the local event/state transaction.



The pipeline for a received message:



1\. Decrypt and authenticate the message. See Section 22.



2\. Validate the message's envelope (protocol version, sender

&#x20;  identity, message format). See Section 23.



3\. For each event in the message:

&#x20;  a. Validate the event's structure and fields. See

&#x20;     Section 23.

&#x20;  b. Check the event\_id against sync\_events.

&#x20;  c. If the event\_id is present, the event is a duplicate.

&#x20;     Record the DUPLICATE outcome for the acknowledgement and

&#x20;     skip to the next event.

&#x20;  d. If the event\_id is not present, the event is new. Accept

&#x20;     it transactionally: append it to sync\_events, apply its

&#x20;     effect to state according to Sections 13 and 14, and

&#x20;     advance the logical clock (Section 12.3, Rule 2). Record

&#x20;     the ACCEPTED outcome.

&#x20;  e. Do not send any response for individual events. The

&#x20;     response is one acknowledgement for the whole message

&#x20;     (Section 16).



Duplicate detection is atomic with the accept transaction. If a

duplicate is detected, no append and no state change occurs for

that event.



15.3 Duplicates Do Not Advance the Logical Clock



A duplicate event does not advance the receiving device's

logical clock. See Section 12.3, Rule 2.



The reason: the logical clock advances when a device accepts a

new event. A duplicate is not a new event. It was already

accepted. Accepting it again would be double-counting.



15.4 Duplicates Do Not Modify State



A duplicate event does not modify any state table and does not

produce a new history record.



The event was applied the first time it was accepted. Applying

it again would produce the same state, but it would also

produce a redundant history record. The protocol avoids this by

skipping duplicates entirely.



15.5 Duplicates Are Still Acknowledged



A duplicate event is acknowledged. The acknowledgement message

reports that the event was seen and that it was a duplicate.

This lets the sender know that the event reached the receiver,

even though the receiver had already seen it.



For the sender's outbound bookkeeping, the outcomes have the

following meaning:



\- ACCEPTED — the receiver newly accepted the event.

\- DUPLICATE — the receiver already had the event.

\- REJECTED — the receiver does not have the event and did not

&#x20; accept it.



ACCEPTED and DUPLICATE both mean the event is successfully

delivered for synchronization purposes. The sender does not

resend either. REJECTED means the event was not delivered; the

sender logs the rejection locally (Section 23 defines the

reasons) and does not automatically resend.



15.6 Wire Corruption



Wire corruption or unauthorized modification is handled by

message authentication and authenticated decryption (Section

22). An event is not processed and is not duplicate-checked

unless the containing message has first passed those checks.



This section does not define the authentication mechanism. That

is Section 22. It states only that duplicate detection is

downstream of authentication.



15.7 Why This Design



The event\_id is the only durable, cross-device, deterministic

identifier of an event. It is generated once, at event

creation. It never changes. It travels with the event. Two

devices seeing the same event see the same event\_id.



Deduplicating by content would be fragile: two events that

happen to have the same content would be treated as one, even

though they are two distinct facts. Deduplicating by

(device\_id, sequence) would be redundant with event\_id and

would couple duplicate detection to the sequence mechanism.

Deduplicating by logical\_clock would be wrong, because logical

clocks are not unique.



Only event\_id gives the protocol the property it needs: a

single, durable, cross-device identifier that distinguishes

events.



15.8 What This Section Does Not Do



It does not define the wire format of the acknowledgement

message. That is Section 22.

It does not define acknowledgements in full. That is

Section 16.

It does not define the validation that happens before

duplicate detection. That is Section 23.

It does not define the transactional rules for the accept

pipeline. That is Section 25.



Source: GORKA-MVP-SCOPE.md v1.1 §8;

MULTI-USER-CONCEPT.md v2.0 §7.



========================================================================

16\. ACKNOWLEDGEMENTS

========================================================================



This section defines how peers confirm to each other that they

have durably accepted events, and what happens when an

acknowledgement is lost.



16.1 The Rule



Acknowledgements are per-message, not per-event.



When peer A sends peer B a sync message containing N events,

peer B responds with a single acknowledgement message covering

all N events.



The acknowledgement message lists, for each event in the

original message:



\- The event\_id.

\- The outcome: ACCEPTED, DUPLICATE, or REJECTED.



ACCEPTED means the event was newly accepted by B in this

message. DUPLICATE means B already had it. REJECTED means the

event was individually invalid and was not accepted (see

Section 23 for the reasons).



16.2 When an Acknowledgement Is Sent



An acknowledgement is sent after the receiving peer has

committed the transaction that processed all events in the

message. The acknowledgement reflects the committed outcome.



An acknowledgement is proof of durable acceptance. It is sent

only after the transaction containing the event's acceptance,

its sync\_events insertion, its logical-clock update (if it was

new), and its state/reconciliation effect has committed

successfully. If the transaction has not committed, no

acknowledgement is sent.



If the receiving peer cannot process the message at all — for

example, because message authentication fails, decryption

fails, or the outer envelope is malformed — the peer does not

send an event-level acknowledgement. The failure is handled as

a message-level or session-level error, per Section 22 and

Section 23.



The distinction is deliberate:



\- A message-level failure (authentication, decryption,

&#x20; envelope) produces a session error, not a normal

&#x20; acknowledgement. The receiver does not trust the message

&#x20; enough to ack it.

\- An authenticated message whose events are individually

&#x20; invalid produces a normal acknowledgement with REJECTED

&#x20; outcomes for the affected events. The receiver trusts the

&#x20; message's authentication, so it can safely respond.



16.3 What an Acknowledgement Proves



When peer A receives an acknowledgement from peer B that says

event E was ACCEPTED, peer A knows:



\- Peer B received E.

\- Peer B validated E.

\- Peer B committed a transaction that appended E to its

&#x20; sync\_events, advanced its logical clock, and applied E's

&#x20; effect to its state.



When peer A receives an acknowledgement that says event E was

DUPLICATE, peer A knows:



\- Peer B received E.

\- Peer B had already accepted and committed E at some earlier

&#x20; time.



Peer A treats ACCEPTED and DUPLICATE the same way for delivery

bookkeeping: E has durably reached B. Peer A does not resend E.



When peer A receives an acknowledgement that says event E was

REJECTED, peer A knows:



\- Peer B received E.

\- Peer B did not accept E.

\- Peer B did not apply E's effect to its state.



Peer A treats REJECTED as an error condition. The reasons for

rejection are defined in Section 23. Peer A logs the rejection

locally. Peer A does not resend E automatically; the event may

be permanently rejected (for example, because it fails an

individual validation that resending cannot fix).



16.4 What an Acknowledgement Does Not Mean



An acknowledgement does not mean that peer B's state has

converged to the same value as peer A's state. It means only

that peer B has committed the specific events that were

acknowledged. Convergence is the result of both peers

exchanging all their events and applying the protocol order to

whatever competing state changes exist.



An acknowledgement does not prove that peer B is currently

authorized by the Control Plane. Authorization is checked

separately (Section 8.6).



An acknowledgement does not prove that peer B's copy of the

event is byte-identical to peer A's copy. The event's identity

is its event\_id. The event's content is authenticated by the

message encryption (Section 22). Peer B's copy of the event is

whatever it decrypted and validated.



16.5 Lost Acknowledgements



If peer A sends a message to peer B and peer B's acknowledgement

never arrives (network failure, peer B crashes, etc.), peer A

does not know whether peer B received the message.



The protocol does not try to determine this. It retries.



Peer A's retry behavior is defined in Section 17 (Offline Queue)

and Section 18 (Retry and Recovery After Interruption).



When peer B eventually receives the retried message, it will

detect the duplicate events (Section 15) and acknowledge them

as DUPLICATE. Peer A will then know that the events reached

peer B. This is the protocol's answer to lost acknowledgements:

resend, and rely on duplicate detection to avoid double-

application.



16.6 Acknowledgement Message Structure



An acknowledgement message carries:



\- The protocol version.

\- The sender's device\_id.

\- The reference to the message being acknowledged (the

&#x20; message\_id).

\- The message-level result: OK or ERROR.

\- For each event in the original message (if the result is OK):

&#x20; the event\_id and the outcome (ACCEPTED, DUPLICATE, or

&#x20; REJECTED).



If the message-level result is ERROR (message authentication

failed, decryption failed, envelope invalid), the acknowledgement

carries no per-event entries. It carries a reason code from

Section 23.



The exact wire format is defined in Section 22.



16.7 What This Section Does Not Do



It does not define the wire format of the acknowledgement

message. That is Section 22.

It does not define what causes a REJECTED outcome. That is

Section 23.

It does not define the retry behavior when acknowledgements

are lost. That is Section 17.

It does not define the transactional rules. That is

Section 25.



Source: MULTI-USER-CONCEPT.md v2.0 §7;

GORKA-MVP-SCOPE.md v1.1 §8.



========================================================================

17\. OFFLINE QUEUE

========================================================================



This section defines what happens when a peer is offline, what

is queued, what is dropped, and what is retried.



17.1 The Situation



A peer may be offline for a period of time. This happens when:



\- The device is powered off.

\- The device has no network connectivity.

\- The device is running but the sync engine is not active

&#x20; (for example, the local database is locked).

\- The device's peer is offline (so a session cannot be

&#x20; established).

\- The Control Plane's discovery or relay services are

&#x20; temporarily unavailable.



In all these cases, the device continues to operate locally. It

originates events. It applies state changes to its own state

tables. It appends its own events to its own sync\_events. It

cannot exchange events with its peer.



17.2 What Is Queued



There is no separate outbound queue.



The sync\_events table is the durable event log and the source

of the outbound queue. When the device is offline, its

sync\_events table accumulates new locally-originated events.

When the device reconnects, it sends the events that its peer

has not yet acknowledged.



The sync\_events table is not literally a queue in the sense

that records leave it when consumed. Events remain in

sync\_events permanently, even after every peer has received

them. The outbound queue is derived from sync\_events, not

stored separately.



Why this design: a separate queue would duplicate state and

introduce the possibility of divergence between the queue and

sync\_events. The sync\_events table is append-only and durable.

It is the natural source of the outbound stream.



17.3 What Is Not Queued



State changes that result from applying a peer's events are not

queued. They are applied immediately when the event is accepted

(Section 14.1).



Acknowledgements to a peer's events are not queued in the sense

of being scheduled for later. If the peer is online, the

acknowledgement is sent immediately after processing. If the

peer goes offline between receiving a message and sending the

acknowledgement, the acknowledgement is lost, and the peer will

retry. See Section 16.5.



Application-level operations (deleting a record, editing a

debtor) are not queued. They take effect locally immediately,

and they produce events, which are then available in

sync\_events for outbound synchronization.



17.4 What Is Dropped



Nothing is dropped.



Events are not removed from sync\_events as part of normal

synchronization. Events remain available for retransmission

until the protocol determines that the peer has successfully

received them.



The only thing that is "dropped" is a lost acknowledgement (see

Section 16.5). The protocol responds to a lost acknowledgement

by retrying the original message. The retry is detected as a

duplicate by the receiver and acknowledged again. No event is

lost.



17.5 Delivery Bookkeeping



The device's sync\_state table records, for each peer, the

protocol's bookkeeping for that peer relationship. This

bookkeeping is used by the retry and recovery mechanism

(Section 18) to determine what needs to be sent.



The MVP's sync\_state table records:



\- The last successful sync timestamp with the peer.

\- The peer's status (IN\_SYNC, PENDING, OFFLINE, ERROR).

\- The delivery state of the peer, expressed as a set of

&#x20; acknowledged event identifiers or acknowledged per-origin

&#x20; sequence ranges. The exact representation is defined in

&#x20; Section 18.



The MVP does not assume that a highest sequence number implies

that all lower sequence numbers were delivered. Delivery state

is determined from acknowledged event ranges or identifiers, as

defined in Section 18.



Important semantic: sequence numbers belong to event origins,

not to peers. An event's sequence number is scoped to the

device instance that originated the event (Section 11.2). If a

peer forwards an event that originated elsewhere, the sequence

number on the event is the originator's, not the forwarder's.



Therefore, delivery bookkeeping is per (origin device, peer)

pair:



\- For each event origin (device\_id), synchronization state

&#x20; tracks delivery of that origin's sequence stream to each

&#x20; peer.



The exact representation of that bookkeeping is defined in

Section 18. Section 17 states only that the bookkeeping is

per-origin, not per-peer-sequence.



17.6 Why This Design



The design uses sync\_events as the durable source of outbound

events, sync\_state as per-peer delivery bookkeeping, and the

protocol order as the convergence rule.



This has four properties the protocol needs:



1\. Durable. sync\_events is stored in the SQLCipher database. It

&#x20;  survives process restarts, device crashes, and power loss.



2\. Append-only. sync\_events is never modified. Once an event is

&#x20;  in it, it is there permanently.



3\. Convergent. The protocol order guarantees that two devices

&#x20;  with the same accepted events converge to the same state.



4\. Simple. There is no separate queue to keep in sync with

&#x20;  sync\_events. There is one durable event log, and delivery

&#x20;  bookkeeping is separate.



17.7 What This Section Does Not Do



It does not define the retry mechanism when a session fails.

That is Section 18.

It does not define the exact schema of the sync\_state table.

That is Section 25.

It does not define the exact representation of delivery state.

That is Section 18.

It does not define the transport. That is Part IV.



Source: MULTI-USER-CONCEPT.md v2.0 §7;

LOCAL-TABLES.md v1.2 Category D.2; GORKA-MVP-SCOPE.md v1.1 §8.



========================================================================

18\. RETRY AND RECOVERY AFTER INTERRUPTION

========================================================================



This section defines how a session is established, how events are

sent, how acknowledgements are processed, how the delivery

bookkeeping is updated, and how recovery after interruption works.



18.1 The Delivery Model



The protocol provides at-least-once delivery and exactly-once

event application per receiving database instance.



At-least-once delivery: an event may be sent more than once to a

peer. Duplicate detection (Section 15) prevents an event from

being applied more than once.



Exactly-once event application per receiving database instance:

an accepted event is applied to that database at most once,

because duplicate event\_ids are rejected at the acceptance

boundary.



The protocol does not provide exactly-once transport. It

provides at-least-once delivery plus idempotent, deduplicated

application.



18.2 The Delivery Bookkeeping



For each (origin device\_id, peer) pair, the device maintains:



\- A watermark. The highest sequence number N such that every

&#x20; event from that origin with sequence number ≤ N has been

&#x20; acknowledged by that peer.

\- A gap set. A sparse set of acknowledged sequence numbers

&#x20; greater than the watermark (out-of-order deliveries). The gap

&#x20; set can be large if an early event remains undelivered while

&#x20; many later events are delivered. It is stored in the

&#x20; sync\_state table (LOCAL-TABLES.md v1.2 Category D.2). Its

&#x20; exact schema is defined in Section 25.



An event from origin O with sequence S is "not yet delivered to

peer P" if:



&#x20; S > watermark(O, P) AND S is not in gaps(O, P).



An event is "delivered to peer P" if:



&#x20; S <= watermark(O, P) OR S is in gaps(O, P).



When peer P acknowledges an event, the device updates its

bookkeeping:



1\. Look up the acknowledged event by event\_id in the device's

&#x20;  own durable sync\_events table. From that record, obtain the

&#x20;  event's origin device\_id (O) and sequence number (S).



&#x20;  The acknowledgement does not independently supply the origin

&#x20;  or sequence. The origin and sequence are derived from the

&#x20;  device's own sync\_events record. This is an integrity rule:

&#x20;  an acknowledgement cannot create or modify an event's origin

&#x20;  or sequence metadata. The wire ACK carries the event\_id; the

&#x20;  device's own record supplies the rest.



2\. Add S to gaps(O, P) if S > watermark(O, P). If S <=

&#x20;  watermark(O, P), the event was already considered delivered;

&#x20;  the acknowledgement is redundant.



3\. Advance the watermark: while (watermark + 1) is in

&#x20;  gaps(O, P), remove (watermark + 1) from gaps(O, P) and

&#x20;  increment watermark by 1.



The watermark advances only across a contiguous acknowledged

prefix of an origin's sequence stream. This is the invariant.


ACCEPTED, DUPLICATE, and REJECTED are all terminal delivery outcomes for the delivery bookkeeping defined in this subsection. REJECTED is terminal; the sender does not retry it automatically.



18.3 How an Outbound Message Is Composed



A device may synchronize any valid event present in its local

sync\_events table to another peer. This includes events the

device originated locally and events the device accepted from

another peer.



Delivery bookkeeping is therefore maintained per (origin

device, destination peer) pair, not only for events originated

locally. When a device forwards an event that originated

elsewhere, the delivery bookkeeping tracks delivery of that

origin's sequence stream to the destination peer.



This is what allows multi-hop synchronization in the MVP's

hub-and-spoke topology: an agent's event reaches the hub, and

the hub can forward it to other agents.



When peer A decides to send a message to peer B, it composes the

message from the events in its sync\_events that are "not yet

delivered to B" (per Section 18.2).



The order of events in the outbound message:



1\. Events are grouped by origin device\_id.



2\. Within each origin group, events are sent in ascending

&#x20;  sequence order.



3\. Origin groups are ordered by origin device\_id (byte-wise).



This ordering is deterministic. It is not required by the

protocol, but it makes messages reproducible and easier to

debug. The receiver does not depend on it.



A message has a size limit. The limit is a configuration value,

recorded in the implementation notes. When the number of

undelivered events exceeds the limit, the device sends multiple

messages.



18.4 How the Sender Processes an Acknowledgement



When peer A receives an acknowledgement from peer B, it processes

each event outcome:



\- ACCEPTED or DUPLICATE: update bookkeeping (Section 18.2) to

&#x20; mark the event's sequence number as delivered to B.



\- REJECTED: do not update bookkeeping. Log the rejection

&#x20; locally. The event is not considered delivered to B. Whether

&#x20; it is ever retried depends on the rejection reason (Section

&#x20; 23). Some rejections are permanent; the event will not be

&#x20; resent. Some are transient; the event will be resent on the

&#x20; next outbound message.



If the acknowledgement is a message-level ERROR (Section 16.2),

no per-event bookkeeping is updated. The message is treated as

if it was never delivered. The sender will retry according to

Section 18.6.



18.5 How the Session Begins



When peer A initiates a session with peer B, the first exchange

is the handshake (Section 8). After the handshake, the session

is established.



Peer A then determines what to send. It computes the set of

undelivered events per Section 18.2.



If the set is empty, peer A sends no event message. The session

may remain open for the peer to initiate transmission, or it

may close according to the session policy. There is no mandatory

"no new events" message.



If the set is non-empty, peer A sends the events in one or more

messages (Section 18.3).



Both peers can initiate sending. The protocol does not designate

one side as sender and the other as receiver. In the hub-and-

spoke topology, the hub is typically the coordinator, but the

protocol does not require it.



18.6 Recovery After Interruption



An interruption occurs when:



\- The network connection drops during a session.

\- One peer crashes.

\- The session times out.

\- The underlying transport fails.



The protocol's recovery is as follows:



1\. On the next session attempt, the peers re-run the handshake.



2\. The handshake is fresh. A new session key is derived

&#x20;  (Section 8.4). The old session key is discarded.



3\. After the handshake, each peer determines what to send based

&#x20;  on its bookkeeping. The bookkeeping reflects what was

&#x20;  acknowledged before the interruption. Events that were sent

&#x20;  but not acknowledged are considered not delivered and are

&#x20;  re-sent.



4\. The receiver detects the re-sent events as duplicates (by

&#x20;  event\_id) if they were actually received before the

&#x20;  interruption, and acknowledges them as DUPLICATE.



5\. The sender updates its bookkeeping based on the new

&#x20;  acknowledgements.



This is why the protocol has at-least-once delivery. The sender

does not know whether an un-acknowledged message reached the

peer. It re-sends. Duplicate detection handles the case where it

did.



18.7 What Happens If a Peer Never Comes Back



If a peer never comes back (the device is destroyed, the user

leaves the organization, etc.), the device's bookkeeping for

that peer stays in sync\_state. It is never cleaned up

automatically.



In the MVP, the device treats a peer that is not currently

available as OFFLINE. It may use the Control Plane's

presence/discovery information to decide whether to continue

attempting to connect.



The Control Plane's presence/discovery information is

coordination metadata. A missing or stale presence record does

not delete local synchronization state or events. The device's

own sync\_events and sync\_state remain intact regardless of what

the Control Plane reports.



The MVP does not remove stale peers. A future phase may

introduce a "peer has been offline for a long time, mark as

stale" mechanism. This is not in the MVP.



18.8 What Recovery Does Not Do



It does not recover events that were never originated. The

protocol synchronizes events that exist in sync\_events. It

does not synthesize events.



It does not recover state changes that were not captured as

events. Every state change that must propagate is represented

by an event (Section 9.6).



It does not guarantee that both peers converge in one session.

Convergence happens over one or more sessions, as events are

exchanged and acknowledged. Two peers that have exchanged all

their events and acknowledged each of them have converged, but

this may take several rounds.



It does not deal with lost events. In the MVP, an event that is

accepted into sync\_events stays there. Events do not disappear.



18.9 What This Section Does Not Do



It does not define the exact wire format of messages. That is

Section 22.

It does not define the exact schema of sync\_state. That is

Section 25.

It does not define the message size limit or the session

timeout. Those are configuration values, recorded in the

implementation notes.

It does not define the transport (direct or relay). That is

Section 19 and Section 20.



Source: MULTI-USER-CONCEPT.md v2.0 §7;

LOCAL-TABLES.md v1.2 Category D.2; GORKA-MVP-SCOPE.md v1.1 §8.





========================================================================

19\. DIRECT CONNECTION

========================================================================



This section defines how two peers connect directly, when this

succeeds, and how it relates to the relay.



19.1 What a Direct Connection Is



A direct connection is a network connection between two peers

that does not pass through GORKA's relay. The peers connect to

each other's currently available connection information and

exchange sync messages over the connection.



The connection is end-to-end encrypted (Section 22). The

Control Plane is not on the path. GORKA is not on the path.



19.2 When a Direct Connection Is Possible



A direct connection is possible when:



\- Both peers have connection information that is reachable from

&#x20; each other.

\- No firewall or NAT policy prevents the connection.

\- Both peers are online and have their sync engines running.



In real networks, these conditions are not always met. NATs and

firewalls may prevent direct connections. When a direct

connection is not possible, the protocol falls back to the

relay (Section 20).



19.3 How Peers Find Each Other



Peers find each other through the Control Plane's discovery

service. The discovery service is part of the Control Plane

(Section 2). It provides:



\- The list of devices in the organization that are currently

&#x20; online and available for sync.

\- For each online device, currently available connection

&#x20; information that the device has announced. The exact

&#x20; representation depends on the transport (see Section 19.4).

\- A signaling channel for peers to exchange connection

&#x20; information.



The discovery service does not see debtor data. It sees only

connection metadata: which devices are online, what connection

information they announce, when. See DATA-BOUNDARY-MATRIX.md

v1.2 §20.2 and CLOUD-TABLES.md v1.2 §20.1.



19.4 How a Direct Connection Is Established



Peer A obtains Peer B's currently available connection

information through the Control Plane's discovery service. The

representation is transport-specific. The MVP uses TCP, so the

connection information is an IP address and port. A future

transport may use NAT traversal assistance, a different protocol,

or another mechanism. The architecture does not depend on the

specific transport.



The MVP's direct connection procedure:



1\. Peer A obtains Peer B's currently available connection

&#x20;  information through the Control Plane's discovery service.



2\. Peer A attempts to connect to Peer B using the configured

&#x20;  direct connection method (TCP, in the MVP).



3\. If the connection succeeds, Peer A and Peer B perform the

&#x20;  session handshake (Section 8.2) over the connection.



4\. If the connection fails, Peer A falls back to the relay

&#x20;  (Section 20).



If both peers attempt to connect to each other simultaneously,

the protocol defines a deterministic tie-breaker to avoid

establishing two simultaneous sessions for the same peer pair:

the peer with the lexicographically smaller device\_id is

designated the connector; the other waits. The exact rule is

defined in Section 22.



The MVP uses TCP for direct connections. The exact port and

mechanism are configuration values, recorded in the

implementation notes.



19.5 What a Direct Connection Does Not Do



It does not bypass the handshake. Every direct connection begins

with the session handshake (Section 8.2). The organization key

proof is required whether the connection is direct or through

the relay.



It does not expose the peers' connection information to the

Control Plane in a way that reveals debtor data. The connection

information is connection metadata, not debtor data. See

DATA-BOUNDARY-MATRIX.md v1.2 §20.2.



It does not carry the organization key. The organization key

is already on each peer, stored locally. It is not sent over

the connection.



19.6 Why Direct Connection Is Preferred



Direct connection has two advantages over the relay:



1\. Lower latency. The peers communicate without an intermediate

&#x20;  hop.



2\. Fewer bytes through the Control Plane. The relay's bandwidth

&#x20;  is preserved for cases where a direct connection is not

&#x20;  possible.



The protocol prefers direct connections. It uses the relay only

as a fallback.



19.7 What This Section Does Not Do



It does not define the exact wire format of the handshake or

the messages. Those are Section 22.

It does not define the exact transport mechanism. That is a

configuration value, recorded in the implementation notes.

It does not define the relay protocol. That is Section 20.

It does not define the exact discovery message format. That is

Section 22.



Source: MULTI-USER-CONCEPT.md v2.0 §3, §4;

ARCHITECTURAL-LAW.md v1.3 §20.3; DATA-BOUNDARY-MATRIX.md v1.2

§20.2.



========================================================================

20\. RELAY PROTOCOL

========================================================================



This section defines the encrypted relay: what it does, what

it sees, and how it cannot decrypt the traffic it carries.



20.1 What the Relay Is



The relay is part of GORKA's Control Plane. It is a network

service that forwards encrypted traffic between two peers when a

direct connection is not possible.



The relay is an operational necessity, not an architectural

compromise. It exists because direct device-to-device

connections cannot always be established, due to NATs,

firewalls, and network policies.



The relay may transport ciphertext. It cannot decrypt it. It

cannot make unauthorized modifications pass authentication. Its

inability to decrypt, and its inability to make undetected

modifications, are the boundary.



20.2 What the Relay Does



The relay performs one function: it forwards encrypted bytes

from one peer to another.



The relay:



\- Accepts connections from peers who have authenticated to the

&#x20; Control Plane. This is Control Plane authentication, not

&#x20; peer-to-peer cryptographic authentication. See Section 20.6.

\- Receives encrypted sync messages from one peer.

\- Forwards the encrypted messages to the other peer.

\- Confirms delivery at the transport level (for example, TCP

&#x20; acknowledgement), not at the protocol level.



The relay does not:



\- Decrypt the messages.

\- Inspect the contents of the messages.

\- Intentionally transform the contents of the messages. Any

&#x20; modification of ciphertext by the relay is detected by

&#x20; authenticated decryption at the receiving peer (Section 22).

\- Provide ordering guarantees. The protocol does not depend on

&#x20; message arrival order.

\- Store the messages for later delivery. If the destination is

&#x20; offline, the message is dropped, and the sender will retry.

\- Correlate the messages with any business data.



The relay's behavior is defined in Section 21 (Relay Metadata

Minimization) from the perspective of what it is allowed to

know.



20.3 How the Relay Cannot Decrypt



The relay receives bytes. Those bytes are the ciphertext of the

session between the two peers (Section 22). The session key is

derived from the organization key (Section 8.4). The relay does

not hold the organization key. It cannot derive the session

key. It cannot decrypt the traffic.



The relay's inability to decrypt is not a policy. It is a

consequence of the keys the relay does not have. The relay is

designed so that no configuration of the relay — not

administrative override, not support access, not legal

compulsion — can make it decrypt traffic it was not given a key

for.



The relay's inability to make undetected modifications is also

a consequence of the keys it does not have. Any modification of

ciphertext fails authenticated decryption at the receiving peer.



These statements are in ARCHITECTURAL-LAW.md v1.3 §20.3.



20.4 How a Peer Uses the Relay



When a peer wants to send a message to another peer and a

direct connection is not possible:



1\. The peer establishes a connection to the relay, using the

&#x20;  Control Plane's signaling channel.



2\. The peer sends the encrypted message to the relay, tagging it

&#x20;  with the destination peer's identifier.



3\. The relay forwards the message to the destination peer, if

&#x20;  the destination is connected. If the destination is not

&#x20;  connected, the relay drops the message.



4\. The destination peer receives the message and processes it

&#x20;  (Sections 15, 16, 18).



5\. The destination peer sends its acknowledgement through the

&#x20;  relay (or through a direct connection, if one has been

&#x20;  established).



The peer does not need to know whether the message is going

directly or through the relay. The peer's encryption and

framing are the same in both cases.



20.5 What the Relay Is Not



\- It is not a message queue. It does not store messages for

&#x20; offline peers. The protocol's own store-and-forward is the

&#x20; sync\_events table, not the relay.

\- It is not a decryption point. It cannot decrypt.

\- It is not a modification point. Modifications to ciphertext

&#x20; are detected by the receiving peer.

\- It is not a replication point. It does not hold a copy of any

&#x20; peer's data.

\- It is not a data store. It holds no persistent state about the

&#x20; content of any message.

\- It is not a policy point. It does not enforce any rule about

&#x20; what peers may exchange.



20.6 Two Kinds of Authentication



There are two distinct authentication events in the protocol,

and they must not be confused.



Control Plane authentication:



\- Device/user → Control Plane.

\- Establishes that the client has a valid Control Plane session.

\- Used by the relay to authorize transport access.

\- Does not establish any peer-to-peer cryptographic identity.

\- Does not involve the organization key.



Peer-to-peer cryptographic authentication:



\- Peer A ↔ Peer B.

\- Establishes that both sides possess the organization key.

\- Used during the session handshake (Section 8.3).

\- Does not involve the Control Plane.

\- Does not establish a Control Plane session.



The relay knows enough to authorize transport access (Control

Plane authentication). The relay must not become the authority

that establishes the peer's cryptographic identity. That is

established only by the session handshake.



20.7 Why the Relay Is in the Control Plane



The relay is in the Control Plane because it is a coordination

service. It helps peers communicate. It does not participate in

the Data Plane.



The relay's presence in the Control Plane means the Control

Plane can observe connection metadata (Section 21). It does not

mean the Control Plane can decrypt the traffic. The Control

Plane does not hold the keys.



20.8 What This Section Does Not Do



It does not define the exact relay protocol on the wire. That

is Section 22.

It does not define what metadata the relay may observe. That

is Section 21.

It does not define how peers authenticate to the Control Plane.

That is part of the Control Plane's authentication (Section 5).

It does not define the relay's capacity or scaling. Those are

operational concerns, not protocol concerns.



Source: MULTI-USER-CONCEPT.md v2.0 §3;

ARCHITECTURAL-LAW.md v1.3 §20.3;

DATA-BOUNDARY-MATRIX.md v1.2 §20.1;

CLOUD-TABLES.md v1.2 §20.2.



========================================================================

21\. RELAY METADATA MINIMIZATION

========================================================================



This section defines what metadata the relay may hold, what it

may never hold, and how minimization is enforced

architecturally rather than by policy.



21.1 The Problem



The relay is in the Control Plane. It necessarily observes some

metadata in order to route ciphertext from one peer to another.

The question this section answers is: what metadata is the

relay permitted to collect and persist, and what is the rule

that keeps it from collecting or persisting more?



Two principles govern the answer:



1\. The relay must not be able to decrypt the traffic. (Section

&#x20;  20.3; ARCHITECTURAL-LAW.md v1.3 §20.3.)



2\. The relay persists only explicitly permitted operational

&#x20;  metadata required for routing, security, diagnostics, and

&#x20;  capacity operations. It does not receive or persist

&#x20;  debtor-derived metadata or plaintext-derived business

&#x20;  metadata.



Principle 2 is what this section defines. It is stated as an

architectural rule, not a policy.



A note on what the relay can and cannot do:



The relay cannot derive metadata from plaintext, because it

does not possess the keys required to decrypt the traffic.



The relay can nevertheless observe unavoidable transport-level

characteristics of the encrypted traffic it forwards:

connection timing, aggregate byte volume, message/frame sizes,

direction, and connection duration. These are inherent

properties of forwarding ciphertext over a network.



The architectural rule is about what the relay intentionally

collects and persists, not about eliminating all possible

traffic analysis. Section 21.5 defines the boundary precisely.



21.2 Metadata Minimization Is Not Metadata Elimination



The relay cannot operate with zero metadata. To route a

message, it must know:



\- Which peer is sending.

\- Which peer is receiving.

\- That a session exists.



These are operational facts. They are not debtor data. They do

not identify any individual debtor.



The architectural goal is therefore:



&#x20; Permitted operational metadata + no debtor-derived metadata.



Not:



&#x20; Zero metadata.



Promising zero metadata would be architecturally false. The

relay would have to be a transparent pipe with no state

whatsoever, which is not achievable for a real relay operating

in real networks. The honest statement is the one above: the

relay collects and persists only the permitted operational

metadata, and it collects and persists nothing derived from the

plaintext.



21.3 Permitted Operational Metadata



The relay may collect and persist the following metadata. Each

item is explicitly permitted. The list is exhaustive: the relay

must not collect or persist metadata beyond this list.



Per relay session:



\- Organization ID. Which organization the session belongs to.

&#x20; Necessary so that the relay can enforce organization-level

&#x20; routing rules and detect cross-organization attempts.



\- Device IDs of the two endpoints. Which two devices are

&#x20; connected. Necessary so that the relay can forward messages

&#x20; to the correct destination.



\- Session start time. When the session began. Necessary for

&#x20; capacity planning and abuse detection.



\- Session end time. When the session ended. Same purpose.



\- Session duration. Derived from start and end. Same purpose.



\- Bytes transferred. How much data was forwarded. Necessary

&#x20; for capacity planning. No content.



\- Session status. ACTIVE, ENDED, or FAILED. Necessary for

&#x20; operational monitoring.



\- Close reason (if the session ends unexpectedly). A code

&#x20; indicating why the session ended. Necessary for diagnostics.



Per connection attempt:



\- Success or failure.

\- A reason code for the failure, if applicable.

\- The time of the attempt.



These are the permitted operational facts. They are recorded in

the relay\_sessions table (CLOUD-TABLES.md v1.2 §20.2) and, for

aggregate connection attempts, in operational logs.



The category is named "permitted operational metadata" rather

than "metadata necessary for the relay's transport function"

because the list intentionally includes operational and

diagnostic information, not only the minimum required for

forwarding.



21.4 Debtor-Derived Metadata the Relay May Never Hold



The relay may never collect or persist:



\- Any debtor identifier, in any form. Not a debtor\_id, not a

&#x20; name, not any value that maps to an individual debtor.



\- Any debtor field, in any form. Not a phone number, not an

&#x20; email, not an address, not an individual debt amount, not a

&#x20; document filename.



\- Any message content, in any form. The relay does not see the

&#x20; plaintext of any sync message.



\- Any event content, in any form. The relay does not see the

&#x20; payload of any event.



\- Any document content. The relay does not see file contents

&#x20; or filenames.



\- Any organization key or session key material. The relay does

&#x20; not hold keys that could decrypt the traffic.



\- Any value derived from the plaintext of a sync message. The

&#x20; relay cannot derive such values, because it does not possess

&#x20; the keys required to decrypt the messages.



This list is a hard boundary. It is enforced by the relay's

inability to decrypt, not by a policy that says "do not look."



21.5 The Inference Boundary



The relay must not intentionally collect or persist metadata

whose purpose is to identify, describe, or track individual

debtors or individual debtor-related events.



This is the operative rule. It is stated in terms of what the

relay intentionally does, not in terms of what a sufficiently

clever observer could possibly infer from traffic

characteristics.



The distinction matters. If the relay knows:



&#x20; Organization X

&#x20; Device A ↔ Device B

&#x20; 22:00–22:15

&#x20; 8.7 MB transferred



there is always some theoretical possibility of inference about

business activity from traffic characteristics. No architecture

can guarantee that no observer can infer anything from traffic

metadata.



What the architecture guarantees:



\- Debtor data is not present in plaintext at the relay.

\- Debtor identifiers are not transmitted as protocol metadata.

\- The relay does not parse events.

\- The relay does not intentionally record per-event or

&#x20; per-debtor metadata.

\- Only the permitted operational metadata (Section 21.3) is

&#x20; collected and persisted.



The distinction between observable and persisted:



Some transport-level characteristics are inherently observable

while forwarding encrypted traffic: packet/frame arrival

times, message/frame sizes, direction, connection duration.



These are unavoidable properties of networking. They are

transient. They are not part of the relay's persistent metadata

model.



The relay does not parse or persist event-level timing or

event-level size metadata. Transport-level packet/frame timing

may be observable transiently as an unavoidable property of

networking, but it is not part of the relay's persistent

metadata model and is not interpreted as debtor-level

information.



The relay does not parse individual events or persist

event-level size metadata. It may observe encrypted

transport/message sizes as an unavoidable property of

forwarding ciphertext.



The architectural rule is: minimum operational metadata,

intentionally collected and persisted; no debtor-derived

metadata; no plaintext-derived business metadata.



21.6 How Minimization Is Enforced



The minimization rule is enforced architecturally, not by

policy. Specifically:



1\. The relay does not hold the organization key or any session

&#x20;  key. It cannot decrypt the traffic. Therefore it cannot

&#x20;  derive any metadata from the plaintext. This is the primary

&#x20;  enforcement.



2\. The relay's protocol (Section 22) defines exactly which

&#x20;  metadata fields the relay receives and stores. The protocol

&#x20;  does not include fields the relay does not need.



3\. The relay's metadata schema (CLOUD-TABLES.md v1.2 §20.2,

&#x20;  relay\_sessions) contains only the permitted operational

&#x20;  fields listed in Section 21.3. It does not contain

&#x20;  debtor-derived fields.



4\. The relay does not intentionally persist ciphertext.

&#x20;  Ciphertext may exist transiently in process memory and

&#x20;  normal transport buffers only for as long as required to

&#x20;  forward it. Relay application logs must not contain

&#x20;  ciphertext payloads. This is stated in ARCHITECTURAL-LAW.md

&#x20;  v1.3 §20.3.



5\. The relay does not know which events are in which messages.

&#x20;  It sees an encrypted byte stream. It does not parse the

&#x20;  stream to identify events.



6\. The relay's logs (if any) contain only the permitted

&#x20;  operational metadata listed in Section 21.3. They do not

&#x20;  contain plaintext, ciphertext, or any debtor-derived value.



Each of these is an architectural property, not a policy. A

future implementation of the relay cannot accidentally violate

them without changing the protocol, which requires an explicit

amendment to this document and the corresponding

architectural-law requirements.



21.7 What the Control Plane Can Observe About the Data



Restating, for clarity, what the Control Plane (including the

relay) can observe about the client's debtor data:



\- That two devices in the same organization communicated.

\- The session timing.

\- Aggregate traffic volume between them.

\- Which organization they belong to.

\- Which devices they were.



It does not observe:



\- What was communicated.

\- Which debtors were involved.

\- What any message said.

\- What any event's payload contained.



The distinction between "observes" and "persists" is important:



\- The Control Plane may observe operational metadata about the

&#x20; session (Section 21.3).

\- The Control Plane does not persist any debtor-derived

&#x20; metadata, because it cannot derive any (Section 21.4).

\- The Control Plane does not persist event-level timing, event-

&#x20; level sizes, or per-debtor activity patterns (Section 21.5).



This is stated in DATA-BOUNDARY-MATRIX.md v1.2 §20.2 and in

ARCHITECTURAL-LAW.md v1.3 §20.3. It is restated here because

this section is where the relay's knowledge boundary is

defined.



21.8 Honest Disclosure



The Control Plane's metadata visibility is a real fact about

the product. It must be stated plainly in client-facing

documentation. A sophisticated bank's security reviewer will

ask about it.



The honest statement:



&#x20; GORKA's Control Plane can observe that two of your devices

&#x20; communicated, the session timing, and aggregate traffic

&#x20; volume. It does not see the plaintext of what they

&#x20; communicated and does not possess the keys required to

&#x20; decrypt it.



This is the same statement as in ARCHITECTURAL-LAW.md v1.3

§20.4 and in the MVP scope §9.6, restated here for the relay

context.



21.9 What This Section Does Not Do



It does not define the relay's wire protocol. That is

Section 22.

It does not define the relay's capacity or scaling. Those are

operational concerns.

It does not define the relay's deployment architecture. That

is an implementation concern.

It does not attempt to solve traffic analysis by introducing

padding, fixed-size packets, artificial delays, batching, or

traffic obfuscation. Those are funded-phase considerations, if

the threat model later demands them. The MVP's architecture

establishes the boundary: plaintext debtor data never enters

the relay, and the relay forwards opaque ciphertext.

It does not weaken any rule in ARCHITECTURAL-LAW.md v1.3 §20 or

in DATA-BOUNDARY-MATRIX.md v1.2 §20.



Source: MULTI-USER-CONCEPT.md v2.0 §3;

ARCHITECTURAL-LAW.md v1.3 §20.3, §20.4;

DATA-BOUNDARY-MATRIX.md v1.2 §20.1, §20.2;

CLOUD-TABLES.md v1.2 §20.2.



========================================================================

22\. WIRE FORMAT

========================================================================



This section defines the exact byte-level format of every

message the protocol exchanges. It is the reference for any

developer implementing the protocol.



22.1 Encoding Conventions



The protocol uses a single canonical binary encoding for all

messages. The encoding is compact, deterministic, and

unambiguous. It is not JSON, not YAML, not any text-based

format.



The encoding is a length-prefixed TLV (type-length-value)

format. Every field is a TLV record. A message is a sequence

of TLV records.



The choice of a canonical binary encoding is deliberate. The

protocol needs one exact byte representation for each logical

message, because:



\- The AAD for authenticated encryption is derived from the

&#x20; message's bytes.

\- Test vectors must be reproducible.

\- Two independent implementations must produce the same bytes

&#x20; for the same logical message.

\- Nested messages (events inside sync messages) must serialize

&#x20; unambiguously.



The protocol does not use JSON, CBOR, MessagePack, Protobuf, or

any other established binary format. The TLV format defined in

this section is simple enough to be specified completely in a

few pages, which is preferable to depending on an external

format's versioning.



22.2 Byte Order



All multi-byte integers are big-endian (network byte order).



Unsigned integers:



\- u8: 1 byte.

\- u16: 2 bytes.

\- u32: 4 bytes.

\- u64: 8 bytes.



The protocol does not use signed integers in the wire format

except where explicitly stated (there is one case: a

close\_reason code, defined in Section 22.17).



There are no floats in the wire format. Any value that appears

as a float in the application is encoded as a string or as a

fixed-point integer, depending on the field's definition. The

exact representation per field is defined in Section 25.



22.3 Strings



A string is encoded as:



\- A u32 length (the number of bytes in the string, not the

&#x20; number of characters).

\- The UTF-8 bytes of the string.



Strings are not null-terminated. The length prefix is the only

way to know where a string ends.



Strings are UTF-8. The protocol does not use UTF-16, Latin-1,

or any other encoding. A string that is not valid UTF-8 is a

protocol violation (Section 23).



Strings are case-sensitive.



22.4 Binary Blobs



A binary blob (a byte sequence with no defined string encoding)

is encoded the same way as a string:



\- A u32 length (the number of bytes).

\- The bytes.



Binary blobs are used for:



\- AEAD ciphertext (including the tag).

\- Nonces.

\- Salts.

\- Key material.

\- UUIDs.

\- The canonical device\_id.



The distinction between a string and a binary blob is semantic,

not format. Both use the same length-prefixed encoding.



Fixed-size values:



Some binary blobs have a fixed size defined by the protocol.

The protocol defines the exact size for each such field. The

TLV length provides framing; the field definition provides

semantic validation. A field whose length does not match its

protocol-defined size is a protocol violation (Section 23).



The fixed sizes for the values the protocol uses:



\- event\_id: exactly 16 bytes (the binary representation of a

&#x20; UUIDv7, per RFC 9562).

\- device\_id: fixed-size, exact format defined in Section 25.

\- AEAD nonce: exactly 24 bytes.

\- AEAD tag: exactly 16 bytes.

\- Organization key: exactly 32 bytes.

\- Session key: exactly 32 bytes.

\- Handshake authentication key: exactly 32 bytes.

\- Argon2id salt: exactly 16 bytes.

\- SHA-256 hash: exactly 32 bytes.



The exact sizes for other fields are defined in their field

definitions in Sections 22.7 through 22.18 and in Section 25.



22.5 TLV Records



A TLV record is:



\- A u16 type code.

\- A u32 length.

\- The value (length bytes).



The type code identifies the field. The protocol defines a

fixed set of type codes. The type code is not extensible by

implementations; it is fixed by this document. Section 24

defines how new type codes become legal in a future protocol

version.



The length is the length of the value in bytes. For a TLV

record that wraps a string, the length is the length of the

string's length prefix plus the string's bytes. For a TLV

record that wraps a u32, the length is 4.



Nested structures (for example, a message that contains

multiple events) are encoded as TLV records whose value is

itself a sequence of TLV records. The length prefix makes the

nesting unambiguous.



TLV values contain exactly the bytes defined by the field.

Implementations MUST NOT insert alignment bytes or implicit

padding.



22.6 Message Framing



A message is a single TLV record whose type code identifies the

message type. The message's value is a sequence of TLV records

(the message's fields).



The complete message on the wire:



&#x20; +--------+--------+-------------------+

&#x20; | type   | length | value             |

&#x20; | (u16)  | (u32)  | (length bytes)    |

&#x20; +--------+--------+-------------------+



The message type codes are:



\- 0x0001 — ENROLLMENT\_PACKAGE (Section 22.7).

\- 0x0002 — HANDSHAKE\_HELLO (Section 22.8).

\- 0x0003 — HANDSHAKE\_REPLY (Section 22.9).

\- 0x0004 — HANDSHAKE\_CONFIRM (Section 22.10).

\- 0x0005 — SESSION\_ESTABLISHED (Section 22.11).

\- 0x0006 — SESSION\_END (Section 22.12).

\- 0x0010 — SYNC\_MESSAGE (Section 22.13).

\- 0x0011 — SYNC\_ACK (Section 22.14).

\- 0x0020 — DISCOVERY\_QUERY (Section 22.15).

\- 0x0021 — DISCOVERY\_RESPONSE (Section 22.16).

\- 0x0022 — SIGNAL\_MESSAGE (Section 22.17).

\- 0x0030 — ERROR (Section 22.18).



The type codes are grouped:



\- 0x0001–0x000F: enrollment and session control.

\- 0x0010–0x001F: synchronization.

\- 0x0020–0x002F: discovery and signaling.

\- 0x0030–0x003F: errors.



A message whose type code is not in this list is a protocol

violation (Section 23). Section 24 defines how a future

protocol version may add type codes.



A message that is received but is not valid TLV is a protocol

violation (Section 23).



A message whose declared length does not match the number of

bytes received is a protocol violation (Section 23).



22.6.1 Maximum Message Size



The maximum outer TLV value length is 16 MiB

(16,777,216 bytes).



The complete framed message therefore has a maximum size of

16,777,222 bytes: 2 bytes for the type, 4 bytes for the length,

and up to 16,777,216 bytes for the value.



A message whose declared length exceeds the maximum value

length is a protocol violation (Section 23).



A nested TLV's length is subject to the same parser bounds. The

outer message cap bounds the total size; nested TLV lengths are

not independently capped.



22.6.2 Session Context



Every message except the enrollment package is sent within a

session or within a discovery/signaling context.



Messages that are sent within an established session

(SYNC\_MESSAGE, SYNC\_ACK, SESSION\_END) are encrypted with the

session key (Section 8.4). Their outer TLV framing is visible

to the transport (and to the relay, if used), but the

encrypted payload is not.



Messages that are sent during the handshake (HANDSHAKE\_HELLO,

HANDSHAKE\_REPLY, HANDSHAKE\_CONFIRM, SESSION\_ESTABLISHED) are

protected by keys derived from the organization key. The exact

construction for each handshake message — which fields are

plaintext, which are authenticated, which are encrypted, and

which key protects each one — is defined in Sections 22.8

through 22.11.



Discovery and signaling messages (DISCOVERY\_QUERY,

DISCOVERY\_RESPONSE, SIGNAL\_MESSAGE) are sent between a peer

and the Control Plane, not between two peers. Their exact

protection is defined in Sections 22.15 through 22.17.



ERROR messages may be sent in any context. Their exact

protection depends on the context in which the error occurs.

Section 22.18 defines it.



22.6.3 The Encrypted Envelope



For messages that are encrypted (all session messages, and the

handshake messages that are defined as encrypted), the outer

TLV structure is:



&#x20; +--------+--------+-------------------+

&#x20; | type   | length | encrypted payload |

&#x20; | (u16)  | (u32)  |                   |

&#x20; +--------+--------+-------------------+



The encrypted payload is the AEAD output for the message's

inner content:



&#x20; +--------+-------------------+

&#x20; | nonce  | ciphertext+tag    |

&#x20; | (24 B) | (variable)        |

&#x20; +--------+-------------------+



The 24-byte nonce is prepended to the AEAD ciphertext and

tag.



The AAD for the AEAD is the exact 6-byte outer TLV header

(type || length) as transmitted on the wire. It is not a

reconstructed logical representation. The exact six bytes are

the AAD.



The reason for using the outer TLV header as AAD: it binds the

message type and the message length to the ciphertext. An

attacker cannot change the type code or the length without

failing authentication.



The outer length is calculated by the sender before encryption:



&#x20; outer\_length = 24                  // AEAD nonce

&#x20;              + plaintext\_length    // inner TLV content

&#x20;              + 16                  // AEAD tag



The exact construction (which fields are AAD beyond the outer

header, how the nonce is generated) is defined per message type

in Sections 22.7 through 22.18.



22.6.4 The Inner Content



The inner content (the plaintext that is encrypted) is itself a

sequence of TLV records. Its structure is defined per message

type.



22.6.5 Canonical Serialization



The TLV encoding is canonical: for a given logical message,

there is exactly one correct byte sequence.



The canonical serialization rules:



1\. TLV records appear in the order defined by the message type.

&#x20;  Implementations do not reorder fields.



2\. Every required field is present. Missing required fields are

&#x20;  a protocol violation (Section 23).



3\. Optional fields, if present, appear in the order defined by

&#x20;  the message type. Implementations do not reorder them.



4\. Field values are encoded canonically: integers big-endian,

&#x20;  strings as UTF-8 with a length prefix, fixed-size blobs at

&#x20;  their protocol-defined size, and so on, per Sections 22.2

&#x20;  through 22.4.



5\. There is no leading or trailing padding.



6\. There is no whitespace.



7\. A field defined as singular MUST occur at most once.

&#x20;  Duplicate occurrences of a singular field are a protocol

&#x20;  violation (Section 23). A field defined as repeatable MUST

&#x20;  have its ordering explicitly defined by the message type.



8\. TLV values contain exactly the bytes defined by the field.

&#x20;  Implementations MUST NOT insert alignment bytes or implicit

&#x20;  padding.



A message that is not canonically serialized is a protocol

violation (Section 23).



The reason for strict canonical serialization: it ensures that

different implementations produce exactly the same bytes for

the same logical message. This is required for deterministic

cryptographic processing (the AAD is the message's bytes), for

reproducible test vectors, and for interoperability between

implementations.



Canonical serialization is not the mechanism for duplicate

detection. Duplicate detection is by event\_id (Section 15).



22.6.6 What This Section Does Not Do



It does not define the inner content of any specific message

type. Those are Sections 22.7 through 22.18.

It does not define the cryptographic primitives. Those are

summarized in Section 22.6.7 and used in the message-specific

sections.

It does not define validation. That is Section 23.

It does not define the domain-separation labels used with

HKDF. Those are in Section 22.19.



22.6.7 Cryptographic Primitives



The protocol uses the following primitives. No custom

cryptography is used.



\- AEAD: XChaCha20-Poly1305. 24-byte nonce. 16-byte tag.

&#x20; Provided by libsodium.



\- KDF: HKDF-SHA256.



\- Password-based KDF: Argon2id, with the exact protocol

&#x20; parameters defined in Section 7. Implementations may use

&#x20; libsodium or another standards-compliant implementation,

&#x20; provided it produces the protocol-defined result.



\- HMAC: HMAC-SHA256. Used only as the internal pseudorandom

&#x20; function of HKDF. It is not an application-level message MAC.

&#x20; Message authentication is provided by the AEAD.



\- Hash: SHA-256.



\- Random: a cryptographically secure random number generator

&#x20; provided by the operating system or by libsodium.



\- Event identifier: UUIDv7 (RFC 9562). The wire representation

&#x20; of an event\_id is the 16-byte binary UUID, not its

&#x20; 36-character textual form.



The exact crate names and versions are recorded in the

implementation notes, not here, because they are an

implementation detail. The primitives are specified here so

that the protocol is unambiguous.



========================================================================
22.7 ENROLLMENT PACKAGE (type 0x0001)
========================================================================

The enrollment package is not a message in the protocol's usual
sense. It is a file that the admin exports from one device and
the agent imports on another. It is defined here because it is
part of the wire format: the file has a defined byte structure.

The enrollment package is the only place the organization key
leaves a device. It is created by the admin's device. It is
transmitted out-of-band by the client. It is imported by the
agent's device.

22.7.1 The Package Structure

The package is a single file with the following structure. It
is not framed as a TLV message; it has its own layout because
it must be parseable without any prior protocol context.

The package layout:

  +--------------------------+-----------+
  | field                    | size      |
  +--------------------------+-----------+
  | magic                    | 8 bytes   |
  | format_version           | 2 bytes   |
  | argon2_memory_kib        | 4 bytes   |
  | argon2_iterations        | 4 bytes   |
  | argon2_parallelism       | 1 byte    |
  | argon2_salt              | 16 bytes  |
  | aead_nonce               | 24 bytes  |
  | encrypted_payload_len    | 4 bytes   |
  | encrypted_payload        | variable  |
  +--------------------------+-----------+

Total fixed header size: 63 bytes.

The header size is calculated as:

  8 (magic)
+ 2 (format_version)
+ 4 (argon2_memory_kib)
+ 4 (argon2_iterations)
+ 1 (argon2_parallelism)
+ 16 (argon2_salt)
+ 24 (aead_nonce)
+ 4 (encrypted_payload_len)
= 63 bytes

This layout is consistent with Section 7.3's frozen description
of the package: a public header containing the format version,
the Argon2id salt, the Argon2id parameters, and the AEAD nonce;
and an AEAD-protected payload.

The magic is the 8 ASCII bytes:

  "GORKAEP\0"

The format_version is a u16. For this document, it is 0x0001.

The argon2_memory_kib is a u32: the memory cost in kibibytes.

The argon2_iterations is a u32: the number of passes.

The argon2_parallelism is a u8: the number of lanes.

The argon2_salt is 16 random bytes.

The aead_nonce is 24 random bytes.

The encrypted_payload_len is a u32: the number of bytes in the
encrypted_payload field.

The encrypted_payload is the AEAD output for the package's
inner content.

The Argon2id parameter values used for MVP package creation are
fixed protocol configuration values:

  argon2_memory_kib = [TO BE BENCHMARKED — see Section 22.19.2]
  argon2_iterations = [TO BE BENCHMARKED — see Section 22.19.2]
  argon2_parallelism = [TO BE BENCHMARKED — see Section 22.19.2]

These values MUST be used for all newly created MVP enrollment
packages. They are serialized into the package header. The
importer MUST use the values encoded in the header, not any
default value configured on the importing device.

The benchmarked values will be recorded here once chosen.

22.7.2 The Package Encryption

The package encryption key is derived from the admin's
passphrase using Argon2id, with the parameters and salt from
the package header.

The exact derivation:

  package_encryption_key =
      Argon2id(
          password = UTF-8 bytes of the admin's passphrase,
          salt = argon2_salt,
          memory = argon2_memory_kib,
          iterations = argon2_iterations,
          parallelism = argon2_parallelism,
          output_length = 32 bytes
      )

The package encryption key is 32 bytes.

The encrypted_payload is the AEAD output:

  encrypted_payload =
      XChaCha20-Poly1305(
          key = package_encryption_key,
          nonce = aead_nonce,
          aad = the 63-byte package header exactly as
                transmitted,
          plaintext = inner_content
      )

The AAD is the entire package header: the 8-byte magic, the
2-byte format_version, the 4-byte argon2_memory_kib, the 4-byte
argon2_iterations, the 1-byte argon2_parallelism, the 16-byte
argon2_salt, the 24-byte aead_nonce, and the 4-byte
encrypted_payload_len. That is exactly 63 bytes, as transmitted.

The output is the AEAD ciphertext followed by the 16-byte tag.
The encrypted_payload field contains both: ciphertext || tag.

The encrypted_payload_len is therefore:

  encrypted_payload_len = plaintext_length + 16

The sender computes it before encryption.

22.7.3 The Inner Content

The inner content (the plaintext that is encrypted) is the
package's payload: the organization_id and the organization
key.

The inner content layout:

  +--------------------------+-----------+
  | field                    | size      |
  +--------------------------+-----------+
  | organization_id_len      | 4 bytes   |
  | organization_id          | variable  |
  | organization_key         | 32 bytes  |
  +--------------------------+-----------+

The organization_id is UTF-8, length-prefixed.

The organization_key is exactly 32 bytes.

There are no other fields. The package carries no signed
metadata, no issuer field, no recipient field, no expiration
timestamp, and no nonce beyond what the AEAD requires.

22.7.4 Import Procedure

The import procedure is defined in Section 7.4. The byte-level
steps:

1. Read the file. Verify that it is at least 63 bytes.

2. Verify the first 8 bytes are "GORKAEP\0".

3. Read format_version. If it is not a supported version,
   reject with a clear error.

4. Read argon2_memory_kib, argon2_iterations,
   argon2_parallelism, argon2_salt, aead_nonce, and
   encrypted_payload_len.

5. Verify that the file is exactly 63 + encrypted_payload_len
   bytes.

6. Derive the package encryption key from the entered passphrase
   using Argon2id with the parameters from the header.

7. Decrypt the encrypted_payload using XChaCha20-Poly1305, with
   the derived key, the aead_nonce, and the AAD as defined in
   Section 22.7.2.

8. If decryption fails, reject with a clear error (wrong
   passphrase, tampered package, or corrupted file). The agent
   may retry (Section 5.6).

9. If decryption succeeds, parse the inner content: read the
   organization_id_len, then the organization_id, then the
   organization_key.

10. Compare the organization_id from the package to the
    organization_id in the agent's JWT. If they differ, reject
    with a clear error. No key is installed.

11. If they match, store the organization key in the local
    database's organization_keys row (Section 25).

12. Delete the package file.

22.7.5 Why the Package Is Not a TLV Message

The package is not framed as a TLV message because it must be
parseable without any prior protocol context. A device that is
receiving the package has not yet established a session, has
not yet derived any keys, and may have no protocol state at
all. The package is self-describing: its header carries the
parameters needed to derive the key that decrypts it.

The magic bytes are there so that an agent who is handed the
wrong file gets a clear error rather than a confusing failure.

========================================================================
22.8 HANDSHAKE_HELLO (type 0x0002)
========================================================================

HANDSHAKE_HELLO is the first message of a session handshake. It
is sent by the peer that initiates the session. It is sent in
plaintext (no AEAD), because the two peers have not yet agreed
on any session key.

The purpose of HANDSHAKE_HELLO is:

- To announce the initiating peer's organization_id and
  device_id.
- To provide a nonce for the handshake.
- To announce the protocol version.

22.8.1 The Message

HANDSHAKE_HELLO is a TLV message. Its inner content is:

  +--------------------------+-----------+
  | field                    | size      |
  +--------------------------+-----------+
  | protocol_version         | 2 bytes   |
  | organization_id_len      | 4 bytes   |
  | organization_id          | variable  |
  | device_id_len            | 4 bytes   |
  | device_id                | variable  |
  | nonce                    | 24 bytes  |
  +--------------------------+-----------+

The protocol_version is a u16. For this document, it is 0x0001.

The organization_id is UTF-8, length-prefixed.

The device_id is a binary blob, length-prefixed. Its exact
format is defined in Section 25.

The nonce is 24 random bytes. It is the initiating peer's
handshake nonce. It is used later in the session-key
derivation.

HANDSHAKE_HELLO is not encrypted and not authenticated at the
message level. Its contents are visible on the wire. This is
acceptable because HANDSHAKE_HELLO carries no secret
information:

- The organization_id is a non-secret identifier.
- The device_id is a non-secret identifier.
- The nonce is random and has no meaning until the handshake
  completes.
- The protocol_version is public.

If the receiving peer accepts the HANDSHAKE_HELLO, it responds
with HANDSHAKE_REPLY (Section 22.9).

If the receiving peer does not accept the HANDSHAKE_HELLO (for
example, because the organization_id does not match, or the
protocol_version is unsupported), it responds with an ERROR
message (Section 22.18), or it drops the connection. The
choice is defined in Section 23.

========================================================================
22.9 HANDSHAKE_REPLY (type 0x0003)
========================================================================

HANDSHAKE_REPLY is the second message of a session handshake. It
is sent by the peer that received the HANDSHAKE_HELLO. It is
sent in plaintext (no AEAD) for its identity and nonce fields,
but it carries an HMAC-SHA256 proof computed with the handshake
authentication key.

The purpose of HANDSHAKE_REPLY is:

- To provide the responding peer's organization_id and
  device_id.
- To provide the responding peer's nonce.
- To prove that the responding peer holds the organization key,
  via a challenge-response proof of possession.

22.9.1 The Message

HANDSHAKE_REPLY is a TLV message. Its inner content is:

  +--------------------------+-----------+
  | field                    | size      |
  +--------------------------+-----------+
  | protocol_version         | 2 bytes   |
  | organization_id_len      | 4 bytes   |
  | organization_id          | variable  |
  | device_id_len            | 4 bytes   |
  | device_id                | variable  |
  | nonce                    | 24 bytes  |
  | proof_tag                | 32 bytes  |
  +--------------------------+-----------+

The fields up through nonce are the same shape as
HANDSHAKE_HELLO.

The nonce is the responding peer's handshake nonce. It is 24
random bytes.

The proof_tag is 32 bytes. It is an HMAC-SHA256 output. It is
not an AEAD tag. Its length (32 bytes) distinguishes it from
the 16-byte AEAD tags the protocol uses elsewhere.

22.9.2 The Handshake Authentication Key

The handshake authentication key is a stable derived key. It
does not depend on per-session nonces. It is used only for
handshake authentication. It is never used as an AEAD key and
never used for session-message encryption.

The derivation:

  handshake_key =
      HKDF-SHA256(
          IKM = organization_key,
          salt = empty,
          info = "GORKA-MVP-HANDSHAKE-v1",
          output_length = 32 bytes
      )

The handshake_key is 32 bytes.

22.9.3 The Proof Tag

The proof_tag proves that the responding peer holds the
organization key. It is an HMAC-SHA256 output computed over a
canonical byte string that binds the complete handshake
transcript and the responding peer's role.

  proof_input =
      "GORKA-MVP-HANDSHAKE-REPLY-v1" ||
      protocol_version ||
      len(initiator_organization_id) ||
      initiator_organization_id ||
      len(initiator_device_id) || initiator_device_id ||
      initiator_nonce ||
      len(responder_organization_id) ||
      responder_organization_id ||
      len(responder_device_id) || responder_device_id ||
      responder_nonce

  proof_tag = HMAC-SHA256(handshake_key, proof_input)

The field order in proof_input is fixed:

1. Domain-separation string: "GORKA-MVP-HANDSHAKE-REPLY-v1"
   (ASCII, no length prefix).
2. protocol_version: u16, big-endian (2 bytes).
3. initiator_organization_id length: u16, big-endian, then the
   raw UTF-8 bytes of the initiator_organization_id.
4. initiator_device_id length: u16, big-endian, then the raw
   bytes of the initiator_device_id.
5. initiator_nonce: 24 bytes, as received in HANDSHAKE_HELLO.
6. responder_organization_id length: u16, big-endian, then the
   raw UTF-8 bytes of the responder_organization_id.
7. responder_device_id length: u16, big-endian, then the raw
   bytes of the responder_device_id.
8. responder_nonce: 24 bytes, the nonce in this message.

The domain-separation string binds the proof to the REPLY role
of the handshake. It includes the role in its name, so a
REPLY proof cannot be confused with a CONFIRM proof.

The transcript binding — protocol_version, both
organization_ids, both device_ids, both nonces — ensures that
the proof is valid only for this specific handshake. A proof
from one handshake cannot be replayed into another, because
the nonces differ.

The initiator's organization_id, device_id, and nonce are taken
from the HANDSHAKE_HELLO that this message is responding to.
The responder's organization_id, device_id, and nonce are taken
from this message.

Variable-length components (organization_ids, device_ids) are
preceded by a 2-byte big-endian length prefix (u16). Fixed-
length components (protocol_version, nonces) are not
length-prefixed.

22.9.4 Why It Is Not Encrypted

HANDSHAKE_REPLY is not encrypted because the responding peer
does not yet know that the initiating peer holds the
organization key. Encrypting with a key derived from the
organization key would require the responding peer to assume
the initiator is legitimate, which is what the handshake is
designed to verify.

The proof_tag is sufficient: it proves that the responding peer
holds the organization key. It does not reveal the organization
key. It does not reveal any session key. If the initiator does
not hold the organization key, it cannot verify the proof_tag,
and it will not proceed with the handshake.

If the initiating peer accepts the HANDSHAKE_REPLY, it responds
with HANDSHAKE_CONFIRM (Section 22.10).

If the initiating peer does not accept the HANDSHAKE_REPLY, it
responds with an ERROR message (Section 22.18), or it drops the
connection.

========================================================================
22.10 HANDSHAKE_CONFIRM (type 0x0004)
========================================================================

HANDSHAKE_CONFIRM is the third message of a session handshake.
It is sent by the peer that initiated the session (the peer
that sent HANDSHAKE_HELLO). It is sent in plaintext for its
proof field, and it carries an HMAC-SHA256 proof computed with
the handshake authentication key.

The purpose of HANDSHAKE_CONFIRM is:

- To prove that the initiating peer holds the organization key,
  via a challenge-response proof of possession.
- To confirm that the initiating peer has accepted the
  responding peer's HANDSHAKE_REPLY.

22.10.1 The Message

HANDSHAKE_CONFIRM is a TLV message. Its inner content is:

  +--------------------------+-----------+
  | field                    | size      |
  +--------------------------+-----------+
  | proof_tag                | 32 bytes  |
  +--------------------------+-----------+

That is the entire message. HANDSHAKE_CONFIRM carries one
field: the proof_tag. It is an HMAC-SHA256 output.

22.10.2 The Proof Tag

The proof_tag is computed the same way as the proof_tag in
HANDSHAKE_REPLY, except with a different domain-separation
string that binds it to the CONFIRM role.

  proof_input =
      "GORKA-MVP-HANDSHAKE-CONFIRM-v1" ||
      protocol_version ||
      len(initiator_organization_id) ||
      initiator_organization_id ||
      len(initiator_device_id) || initiator_device_id ||
      initiator_nonce ||
      len(responder_organization_id) ||
      responder_organization_id ||
      len(responder_device_id) || responder_device_id ||
      responder_nonce

  proof_tag = HMAC-SHA256(handshake_key, proof_input)

The fields are the same as in the HANDSHAKE_REPLY proof_input,
with the same fixed order. Only the leading
domain-separation string differs:

- In HANDSHAKE_REPLY, the string is
  "GORKA-MVP-HANDSHAKE-REPLY-v1".
- In HANDSHAKE_CONFIRM, the string is
  "GORKA-MVP-HANDSHAKE-CONFIRM-v1".

This difference is what binds each proof to its role. A
REPLY proof cannot be replayed as a CONFIRM proof, and vice
versa, because the HMAC inputs differ.

The protocol_version, organization_ids, device_ids, and
nonces are the same values used in the HANDSHAKE_REPLY proof.
They bind the CONFIRM proof to the same handshake transcript.

22.10.3 Why It Is Not Encrypted

Same reason as HANDSHAKE_REPLY: the initiating peer proves it
holds the organization key, without revealing it. The
proof_tag is sufficient.

After HANDSHAKE_CONFIRM is sent and accepted, both peers have
proven possession of the organization key to each other. The
session is established. The responder then sends
SESSION_ESTABLISHED (Section 22.11).

========================================================================
22.11 SESSION_ESTABLISHED (type 0x0005)
========================================================================

SESSION_ESTABLISHED is the fourth and final message of a session
handshake. It is sent by the peer that received HANDSHAKE_CONFIRM
(usually the responding peer from the handshake, but the roles
can be reversed if the responding peer initiates the next
session). It is AEAD-encrypted with the session key.

SESSION_ESTABLISHED is one-way. Only one peer sends it. The
sender is the peer that received HANDSHAKE_CONFIRM. The
receiver is the peer that sent HANDSHAKE_CONFIRM. The receiver
does not send a SESSION_ESTABLISHED in response.

The purpose of SESSION_ESTABLISHED is:

- To confirm that both peers have derived the same session key.
- To communicate the sender's current knowledge of its own
  origin sequence space, as a starting hint.
- To allow the peers to begin exchanging sync messages.

22.11.1 The Session Key Derivation

The session key is derived from the organization key, the two
nonces, and the two device_ids.

  session_key =
      HKDF-SHA256(
          IKM = organization_key,
          salt = initiator_nonce || responder_nonce,
          info = "GORKA-MVP-SESSION-v1" ||
                 len(organization_id) || organization_id ||
                 len(initiator_device_id) || initiator_device_id ||
                 len(responder_device_id) || responder_device_id,
          output_length = 32 bytes
      )

The salt is the concatenation of the two nonces, in the order:
initiator's nonce first, responder's nonce second. Each nonce
is 24 bytes, so the salt is 48 bytes.

The info is the domain-separation string
"GORKA-MVP-SESSION-v1" (ASCII, no length prefix) followed by
the organization_id, the initiator's device_id, and the
responder's device_id. Each variable-length component is
preceded by a 2-byte big-endian length prefix (u16).

The organization_id included in the info is the
organization_id of the session's organization. It is the same
value for both peers.

Both peers derive the same session key, because both have the
same inputs.

The ordering is role-based, not sorted: the initiator's nonce
and device_id always come first; the responder's always come
second. This is deterministic. Both peers know which role they
played in the handshake, so both compute the same ordering.

22.11.2 The Message

SESSION_ESTABLISHED is AEAD-encrypted with the session key. Its
outer TLV framing is:

  +--------+--------+------------------------------+
  | type   | length | nonce || ciphertext || tag    |
  | (u16)  | (u32)  | (24)   (variable)    (16)    |
  +--------+--------+------------------------------+

The AAD is the 6-byte outer TLV header (type || length), as
defined in Section 22.6.3.

The nonce is 24 random bytes, generated by the sender.

The inner content (the plaintext that is encrypted) is:

  +--------------------------+-----------+
  | field                    | size      |
  +--------------------------+-----------+
  | origin_sequence_hint     | 8 bytes   |
  +--------------------------+-----------+

The origin_sequence_hint is a u64. It is the highest sequence
number the sender has previously originated for the sender's
own origin device_id.

It is a hint, not a delivery assertion. It is not the same as
the sender's watermark or gap set (Section 18.2). It does not
assert that all sequence numbers below the reported value
exist, were sent, or were delivered. It is informational.

Actual delivery state is determined by the per-origin watermark
and sparse-gap state defined in Section 18.

If the sender has never originated an event, this field is 0.

22.11.3 Why the Hint Is a Hint

Section 18.2 established that delivery state is a per-origin
watermark plus a sparse gap set, not a highest sequence number.
The SESSION_ESTABLISHED message must not override that model.

The origin_sequence_hint is included as an optimization: it
tells the peer approximately how far the sender's own event
stream has advanced. It does not replace the delivery
bookkeeping the peers exchange in SYNC_ACK messages.

The two peers determine what to send based on their own
delivery bookkeeping (Section 18.2), not based on this hint.

22.11.4 After SESSION_ESTABLISHED

After SESSION_ESTABLISHED is received and accepted by the
initiator, the session is open. Both peers may send
SYNC_MESSAGE, SYNC_ACK, SESSION_END, and session-encrypted
ERROR messages. The handshake is complete.

The handshake authentication key is no longer used. It was used
only for the proof tags in HANDSHAKE_REPLY and HANDSHAKE_CONFIRM.
It is not used for session messages. It is not used as an AEAD
key.

The session key is used for all messages within the session:
SYNC_MESSAGE, SYNC_ACK, SESSION_END. It is discarded when the
session ends (Section 8.7).

========================================================================
22.12 SESSION_END (type 0x0006)
========================================================================

SESSION_END is sent when a peer wants to close the session
cleanly. It is AEAD-encrypted with the session key.

The purpose of SESSION_END is:

- To tell the other peer that the sender is closing the session.
- To give a reason code for the close.

22.12.1 The Message

SESSION_END is AEAD-encrypted with the session key. Its outer
TLV framing is the same as SESSION_ESTABLISHED:

  +--------+--------+------------------------------+
  | type   | length | nonce || ciphertext || tag    |
  | (u16)  | (u32)  | (24)   (variable)    (16)    |
  +--------+--------+------------------------------+

The AAD is the 6-byte outer TLV header.

The inner content (the plaintext that is encrypted) is:

  +--------------------------+-----------+
  | field                    | size      |
  +--------------------------+-----------+
  | close_reason             | 2 bytes   |
  +--------------------------+-----------+

The close_reason is a u16. It is one of:

- 0x0000 — NORMAL. The session is closing because the sender
  has no more events to send and is idle.

- 0x0001 — TIMEOUT. The session is closing because the session
  timed out (Section 8.7).

- 0x0002 — SHUTDOWN. The sender's process is shutting down.

- 0x0003 — RESTART. The sender is about to restart and will
  re-establish a session shortly.

- 0x0004 — ERROR. The sender encountered an error and is
  closing the session. Details may follow in a separate ERROR
  message (Section 22.18).

Values above 0x00FF are reserved for future use (Section 24).

22.12.2 After SESSION_END

After SESSION_END is sent, the sender closes the underlying
transport connection (if any) and discards the session key.

The receiver, upon receiving SESSION_END, discards its session
key and may close the transport connection.

The two peers' sync_state bookkeeping is not affected by
SESSION_END. It persists across sessions (Section 8.7).

Either peer may initiate a new session at any time after
SESSION_END. A new session will have a new handshake, new
nonces, and a new session key.


========================================================================
22.13 SYNC_MESSAGE (type 0x0010)
========================================================================

SYNC_MESSAGE carries a batch of events from one peer to another.
It is sent within an established session. It is AEAD-encrypted
with the session key.

22.13.1 The Message

SYNC_MESSAGE is AEAD-encrypted with the session key. Its outer
TLV framing is:

  +--------+--------+------------------------------+
  | type   | length | nonce || ciphertext || tag    |
  | (u16)  | (u32)  | (24)   (variable)    (16)    |
  +--------+--------+------------------------------+

The AAD is the 6-byte outer TLV header (type || length), as
defined in Section 22.6.3.

The nonce is 24 random bytes, generated by the sender. Fresh
for each SYNC_MESSAGE. It must not be reused with the same
session key (Section 8.10).

The inner content (the plaintext that is encrypted) is a
sequence of TLV records:

  +--------------------------+-----------+
  | field                    | type code |
  +--------------------------+-----------+
  | message_id               | 0x1001    |
  | event_count              | 0x1002    |
  | events                   | 0x1003    |
  +--------------------------+-----------+

The message_id is a TLV record with type code 0x1001. Its value
is the 16-byte binary UUIDv7 (Section 10).

The event_count is a TLV record with type code 0x1002. Its value
is a u32. It is the number of event records in the events field.

The events field is a TLV record with type code 0x1003. It is
repeatable: it appears event_count times, in the order defined
by Section 18.3. Each occurrence is an event record
(Section 22.13.2).

22.13.2 The Event Record

Each event record is a TLV record with type code 0x1003. Its
value is a sequence of TLV records.

  +--------------------------+-----------+
  | field                    | type code |
  +--------------------------+-----------+
  | event_id                 | 0x1101    |
  | device_id                | 0x1102    |
  | sequence                 | 0x1103    |
  | logical_clock            | 0x1104    |
  | event_type               | 0x1105    |
  | entity_type              | 0x1106    |
  | entity_id                | 0x1107    |
  | created_at               | 0x1108    |
  | payload                  | 0x1109    |
  +--------------------------+-----------+

The field type codes are defined in Section 22.13.4.

The event_id is a TLV record with type code 0x1101. Its value is
exactly 16 bytes (the binary UUIDv7).

The device_id is a TLV record with type code 0x1102. Its value
is the origin device_id, as raw bytes. Its exact format is
defined in Section 25. The TLV length provides the length.

The sequence is a TLV record with type code 0x1103. Its value is
a u64.

The logical_clock is a TLV record with type code 0x1104. Its
value is a u64.

The event_type is a TLV record with type code 0x1105. Its value
is a u16. The codes are in Section 22.13.3.

The entity_type is a TLV record with type code 0x1106. Its value
is a u8. It is one of:

- 0x01 — debtor.
- 0x02 — debt.
- 0x03 — action.
- 0x04 — communication.
- 0x05 — document.

The entity_type identifies the entity namespace. In the MVP,
only entity types 0x01 (debtor), 0x03 (action), and 0x04
(communication) are valid for accepted MVP sync events. Entity
types 0x02 (debt) and 0x05 (document) are reserved identifiers
in the MVP and MUST NOT appear in an accepted MVP sync event.
See Section 25.9.2.

The entity_id is a TLV record with type code 0x1107. Its value
is the entity identifier, as raw bytes. The TLV length provides
the length.

The created_at is a TLV record with type code 0x1108. Its value
is a u64: the originating device's wall-clock time in
milliseconds since the Unix epoch. Informational only.

The payload is a TLV record with type code 0x1109. Its value is
a TLV-encoded structure whose content depends on the
event_type. Its structure is defined in Section 25.

22.13.3 Event Type Codes

The MVP event types (Section 9.2) have the following codes:

- 0x0001 — DEBTOR_CREATED.
- 0x0002 — ENTITY_UPDATED.
- 0x0003 — ACTION_CREATED.
- 0x0004 — COMMUNICATION_LOGGED.

The funded-phase event types (Section 8.2) will be assigned
codes starting at 0x0100, defined in Section 24 when they are
introduced.

A received event whose event_type code is not in the currently
supported set is a protocol violation (Section 23).

22.13.4 TLV Type Codes

The TLV type codes for SYNC_MESSAGE and event records:

  SYNC_MESSAGE fields (inner content):
    0x1001 — message_id
    0x1002 — event_count
    0x1003 — event record (repeatable)

  Event record fields:
    0x1101 — event_id
    0x1102 — device_id
    0x1103 — sequence
    0x1104 — logical_clock
    0x1105 — event_type
    0x1106 — entity_type
    0x1107 — entity_id
    0x1108 — created_at
    0x1109 — payload

  Payload fields (per event type):
    Defined in Section 25.

A receiver validates required fields, field ordering,
multiplicity, and field-specific constraints according to the
event-type rules in Section 25. A required field that is
missing, a field that appears out of order, or a singular field
that appears more than once is a protocol violation
(Section 23).

22.13.5 Event Ordering Within the Batch

The events in a SYNC_MESSAGE are ordered by the composition
rules in Section 18.3:

1. Events are grouped by origin device_id.

2. Within each origin group, events are sent in ascending
   sequence order.

3. Origin groups are ordered by origin device_id (byte-wise).

This ordering is deterministic. It is not required by the
protocol's correctness. It makes messages reproducible and
easier to debug.

22.13.6 What a SYNC_MESSAGE Does Not Contain

A SYNC_MESSAGE does not contain:

- Any debtor data in the clear. The entire message is
  AEAD-encrypted.
- Any key material.
- Any acknowledgement.
- Any state that is not part of an event.

========================================================================
22.14 SYNC_ACK (type 0x0011)
========================================================================

SYNC_ACK is an acknowledgement of a SYNC_MESSAGE. It is sent
within an established session. It is AEAD-encrypted with the
session key.

22.14.1 The Message

SYNC_ACK is AEAD-encrypted with the session key. Its outer TLV
framing is the same as SYNC_MESSAGE:

  +--------+--------+------------------------------+
  | type   | length | nonce || ciphertext || tag    |
  | (u16)  | (u32)  | (24)   (variable)    (16)    |
  +--------+--------+------------------------------+

The AAD is the 6-byte outer TLV header.

The nonce is 24 random bytes, generated by the sender. Fresh
for each SYNC_ACK.

The inner content is a sequence of TLV records:

  +--------------------------+-----------+
  | field                    | type code |
  +--------------------------+-----------+
  | acknowledged_message_id  | 0x1201    |
  | outcome_count            | 0x1202    |
  | outcomes                 | 0x1203    |
  +--------------------------+-----------+

The acknowledged_message_id is a TLV record with type code
0x1201. Its value is exactly 16 bytes (the binary UUIDv7 of the
SYNC_MESSAGE being acknowledged).

The outcome_count is a TLV record with type code 0x1202. Its
value is a u32. It is the number of outcome records in the
outcomes field.

The outcomes field is a TLV record with type code 0x1203. It is
repeatable: it appears outcome_count times, in the order of the
events in the acknowledged SYNC_MESSAGE.

22.14.2 When SYNC_ACK Is Sent

SYNC_ACK is generated only after the receiver has:

1. Successfully authenticated and decrypted the SYNC_MESSAGE.
2. Successfully parsed the message's TLV content.
3. Obtained and validated the message_id.
4. Committed the transaction that processed the message's
   events.

This is a hard rule. A SYNC_ACK is never generated for a
message whose authentication or decryption failed, or whose
message_id could not be parsed, because the receiver has no
valid message_id to acknowledge.

If authentication or decryption of a SYNC_MESSAGE fails, the
receiver:

- Does not process any events.
- Does not send a SYNC_ACK.
- May send an ERROR message (Section 22.18) with class
  SESSION_ERROR, or may close the session.
- The choice is defined in Section 23.

This is consistent with Section 16.2's rule that message-level
failures are session errors, not per-event acknowledgements.

22.14.3 The Outcome Record

Each outcome record is a TLV record with type code 0x1203. Its
value is a sequence of TLV records:

  +--------------------------+-----------+
  | field                    | type code |
  +--------------------------+-----------+
  | event_id                 | 0x1211    |
  | outcome                  | 0x1212    |
  +--------------------------+-----------+

The event_id is a TLV record with type code 0x1211. Its value is
exactly 16 bytes (the binary UUIDv7 of the event being
acknowledged).

The outcome is a TLV record with type code 0x1212. Its value is
a u8:
- 0x00 — ACCEPTED. The event was newly accepted and committed.
- 0x01 — DUPLICATE. The event was already present in the
  receiver's sync_events.
- 0x02 — REJECTED. The event was individually invalid and was
  not accepted.

22.14.4 The Meaning of REJECTED for Delivery

REJECTED is a terminal delivery outcome as defined in
Section 18.2.

ACCEPTED, DUPLICATE, and REJECTED are all terminal delivery
outcomes for the delivery bookkeeping defined in Section 18.2.
The sender advances its watermark or gap set for the event in
all three cases.

The reasons for rejection are defined in Section 23. Some are
permanent (the event will never be valid). Some may be
transient (a temporary problem on the receiver). The MVP does
not distinguish; REJECTED is treated as terminal. If the funded
phase needs transient-rejection retry, it will be added then.

Section 18.2 is the authoritative source for the meaning of
delivery outcomes. This subsection defines only the wire
representation of the outcome in SYNC_ACK.

22.14.5 TLV Type Codes

The TLV type codes for SYNC_ACK:

  SYNC_ACK fields (inner content):
    0x1201 — acknowledged_message_id
    0x1202 — outcome_count
    0x1203 — outcome record (repeatable)

  Outcome record fields:
    0x1211 — event_id
    0x1212 — outcome

22.14.6 Validation Rules

A SYNC_ACK is valid if and only if:

- The acknowledged_message_id is exactly 16 bytes.
- The outcome_count equals the number of outcome records
  present.
- The outcomes appear in the order of the events in the
  acknowledged SYNC_MESSAGE.
- Each event_id in the outcomes corresponds to an event_id in
  the acknowledged message.

A SYNC_ACK whose outcome_count does not match the number of
outcome records, or whose outcomes do not correspond to the
acknowledged message's events, is a protocol violation
(Section 23).

========================================================================
22.15 DISCOVERY_QUERY (type 0x0020)
========================================================================

DISCOVERY_QUERY is sent by a peer to the Control Plane's
discovery service. It asks which devices in the organization
are currently online and available for sync.

DISCOVERY_QUERY is between a peer and the Control Plane, not
between two peers. It is authenticated by the Control Plane's
JWT mechanism (Section 5), not by the organization key.

22.15.1 The Message

DISCOVERY_QUERY is sent over the Control Plane's HTTPS API
(not over the peer-to-peer transport). Its payload is JSON,
because the Control Plane's API is JSON-based. The peer-to-peer
TLV format defined in Section 22 does not apply here.

The DISCOVERY_QUERY payload:

  {
    "organization_id": "...",
    "device_id": "...",
    "protocol_version": 1
  }

The organization_id is the caller's organization_id, from the
JWT. It must match the JWT's organization_id. The Control Plane
rejects the query if it does not.

The device_id is the caller's device_id. The Control Plane
validates that the authenticated user is authorized to act for
that device, per the MVP's device registration model.

The protocol_version is the caller's protocol version.

22.15.2 What the Control Plane Returns

The Control Plane returns a DISCOVERY_RESPONSE
(Section 22.16) listing the devices in the organization that
are currently online and available for sync.

The Control Plane excludes the caller's own device_id from the
response.

22.15.3 What the Control Plane Sees

The Control Plane sees the caller's organization_id (from the
JWT), the caller's device_id, the caller's protocol version,
and the time of the query. It does not see any debtor data.
See Section 21.

========================================================================
22.16 DISCOVERY_RESPONSE (type 0x0021)
========================================================================

DISCOVERY_RESPONSE is the Control Plane's response to a
DISCOVERY_QUERY. Its payload is JSON.

22.16.1 The Message

  {
    "devices": [
      {
        "device_id": "...",
        "connection_info": {
          "type": "tcp",
          "host": "...",
          "port": 12345
        },
        "last_seen": "2026-09-19T10:30:00Z"
      },
      ...
    ]
  }

The devices array contains one entry per online device in the
organization, excluding the caller.

The last_seen is the time the device last registered with the
Control Plane, in ISO 8601 format. It is operational metadata.

The exact JSON serialization is defined by the Control Plane's
HTTP API, not by this document. This document defines only the
fact that the discovery protocol exists and what it conveys.

22.16.2 What the Control Plane Does Not Return

The Control Plane does not return any debtor data, any events,
any key material, or any session state. See Section 21.

========================================================================
22.17 SIGNAL_MESSAGE (type 0x0022)
========================================================================

SIGNAL_MESSAGE is used by peers to exchange connection
information during a handshake. It is a Control Plane API
message exchanged between a peer and the Control Plane. The
Control Plane may relay its signaling payload to another peer,
but the peer-to-peer sync protocol does not treat that relayed
signaling exchange as a peer-to-peer protocol message.

SIGNAL_MESSAGE's payload is JSON, because the Control Plane's
API is JSON-based.

22.17.1 The Message

  {
    "to_device_id": "...",
    "from_device_id": "...",
    "signal_type": "...",
    "payload": { ... }
  }

The to_device_id is the destination peer's device_id.

The from_device_id is the sender's device_id.

The signal_type is a string:
- "offer" — the sender is offering to connect directly.
- "answer" — the recipient is accepting the offer.
- "candidate" — the sender is providing a connection candidate.

The payload is a JSON object whose content depends on the
signal_type. For the MVP's TCP transport, the offer and answer
payloads carry the host and port the sender is listening on.

22.17.2 What the Control Plane Sees

The Control Plane sees the sender's device_id, the
destination's device_id, the signal_type, and the payload
(connection metadata). It relays the message to the
destination. It does not store the message beyond the time
needed to relay it.

22.17.3 Why Signaling Is in the Control Plane

Signaling is in the Control Plane because peers must be able
to find each other. The Control Plane does not participate in
the session that follows.

22.17.4 What SIGNAL_MESSAGE Must Not Contain

The SIGNAL_MESSAGE payload is limited to connection and
signaling metadata. It MUST NOT contain:

- Organization keys.
- Session keys.
- Handshake secrets.
- Debtor data.
- Event data.
- Encrypted sync payloads.

Any SIGNAL_MESSAGE whose payload contains any of the above is
a protocol violation (Section 23).

========================================================================
22.18 ERROR (type 0x0030)
========================================================================

ERROR is sent when a peer wants to report an error to another
peer or to the Control Plane. Its protection depends on the
context in which it is sent.

22.18.1 The Message

ERROR's payload is a TLV-encoded structure:

  +--------------------------+-----------+
  | field                    | type code |
  +--------------------------+-----------+
  | error_class              | 0x1301    |
  | error_code               | 0x1302    |
  | context                  | 0x1303    |
  +--------------------------+-----------+

The error_class is a u8:
- 0x01 — SESSION_ERROR.
- 0x02 — EVENT_ERROR.
- 0x03 — PROTOCOL_ERROR.
- 0x04 — TRANSPORT_ERROR.
- 0x05 — INTERNAL_ERROR.

The error_code is a u16. Its meaning depends on the
error_class. The codes are defined in Section 23.

The context is an optional TLV-encoded structure carrying
additional information about the error. Its structure is
defined per error_class in Section 23.

22.18.2 Protection

The protection of ERROR depends on the context:

- If ERROR is sent within an established session (after
  SESSION_ESTABLISHED), it is AEAD-encrypted with the session
  key.

- If ERROR is sent during the handshake (between
  HANDSHAKE_HELLO and HANDSHAKE_CONFIRM), it is sent in
  plaintext. It carries no secret information.

- If ERROR is sent to the Control Plane, it is sent over the
  Control Plane's HTTPS API (JSON).

22.18.3 What ERROR Does Not Contain

ERROR does not contain any debtor data, any event payloads, any
key material, or any session key.

22.18.4 The Context Field

The context field may contain only:

- Protocol identifiers explicitly defined by Section 23.
- Operational diagnostic information explicitly defined by
  Section 23.
- A message_id (the id of the message that caused the error).
- An event_id (the id of the event that was rejected).

The context field MUST NOT contain:

- Event payloads.
- Debtor identifiers.
- Field values from any debtor record.
- Document names.
- Any other debtor-derived information.

An ERROR whose context contains any of the above is a protocol
violation (Section 23).

========================================================================
22.19 KEY DERIVATION LABELS AND NONCE GENERATION
========================================================================

22.19.1 HKDF Domain-Separation Labels

The protocol uses HKDF-SHA256 with the following
domain-separation labels.

  handshake_key:
      info = "GORKA-MVP-HANDSHAKE-v1"
      salt = empty

  session_key:
      info = "GORKA-MVP-SESSION-v1" ||
             len(organization_id) || organization_id ||
             len(initiator_device_id) || initiator_device_id ||
             len(responder_device_id) || responder_device_id
      salt = initiator_nonce || responder_nonce

The domain-separation labels are ASCII strings, used as the
leading bytes of the HKDF info parameter.

The session_key info includes the organization_id, the
initiator's device_id, and the responder's device_id. Each
variable-length component is preceded by a 2-byte big-endian
length prefix (u16), making the encoding unambiguous.

The salt is the concatenation of the two 24-byte nonces:
initiator_nonce first, responder_nonce second. The salt is
exactly 48 bytes.

The handshake proof tags use the handshake_key with additional
domain-separation in the HMAC input:

  HANDSHAKE_REPLY proof:
      proof_input =
          "GORKA-MVP-HANDSHAKE-REPLY-v1" ||
          protocol_version ||
          len(initiator_organization_id) ||
          initiator_organization_id ||
          len(initiator_device_id) || initiator_device_id ||
          initiator_nonce ||
          len(responder_organization_id) ||
          responder_organization_id ||
          len(responder_device_id) || responder_device_id ||
          responder_nonce

  HANDSHAKE_CONFIRM proof:
      proof_input =
          "GORKA-MVP-HANDSHAKE-CONFIRM-v1" ||
          protocol_version ||
          len(initiator_organization_id) ||
          initiator_organization_id ||
          len(initiator_device_id) || initiator_device_id ||
          initiator_nonce ||
          len(responder_organization_id) ||
          responder_organization_id ||
          len(responder_device_id) || responder_device_id ||
          responder_nonce

  proof_tag = HMAC-SHA256(handshake_key, proof_input)

Variable-length components (organization_ids, device_ids) are
preceded by a 2-byte big-endian length prefix (u16). Fixed-
length components (protocol_version, nonces) are not
length-prefixed.

22.19.2 Argon2id Parameters

The enrollment package uses Argon2id with the following
serialization in the package header:

- argon2_memory_kib: u32, big-endian.
- argon2_iterations: u32, big-endian.
- argon2_parallelism: u8.

These are the values carried in the package header (Section
22.7.1).

The Argon2id parameter values used for MVP package creation
are fixed protocol configuration values. They are chosen and
benchmarked for the supported GORKA desktop environment, then
recorded here and in Section 22.7.1:

  argon2_memory_kib = [TO BE BENCHMARKED]
  argon2_iterations = [TO BE BENCHMARKED]
  argon2_parallelism = [TO BE BENCHMARKED]

Until those values are recorded, the deterministic test vector
E1 in SYNC-TEST-VECTORS-v1 remains PENDING. The values are not
to be invented; they are to be benchmarked and selected for
the supported environment, then frozen.

The protocol depends only on the values encoded in the package
header, not on any default value configured in an
implementation. The importing device MUST use the values from
the header.

22.19.3 Nonce Generation

The protocol uses nonces in four places.

Enrollment package AEAD nonce:
- 24 bytes.
- Random, generated by the admin's device at export time.
- One per package.
- Never intentionally reused with the same package encryption
  key.

Handshake nonces:
- 24 bytes each.
- Random, generated by each peer at the start of the handshake.
- One per peer, per handshake.
- Implementations MUST NOT intentionally reuse a handshake
  nonce.
- Not AEAD nonces. They are protocol freshness nonces used for
  replay resistance and session-key derivation.

Session message AEAD nonces:
- 24 bytes each.
- Random, generated by the sender for each SYNC_MESSAGE,
  SYNC_ACK, SESSION_ESTABLISHED, SESSION_END, and session-
  encrypted ERROR message.
- Never intentionally reused with the same session key.
- Discarded when the session ends.

The protocol does not use counter-based nonces. All AEAD nonces
are random. The 192-bit nonce space of XChaCha20-Poly1305 makes
random nonces safe against accidental collision (Section 8.10).
Deliberate reuse is prohibited.

22.19.4 The Complete Key Hierarchy

  organization_key (32 bytes, generated at enrollment)
    |
    +-- HKDF("GORKA-MVP-HANDSHAKE-v1")
    |     -> handshake_key (32 bytes)
    |        Used for: HANDSHAKE_REPLY proof_tag,
    |                  HANDSHAKE_CONFIRM proof_tag
    |
    +-- HKDF("GORKA-MVP-SESSION-v1" ||
             org_id || device_ids,
             salt = nonces)
          -> session_key (32 bytes)
             Used for: SYNC_MESSAGE, SYNC_ACK,
                       SESSION_ESTABLISHED, SESSION_END,
                       session-encrypted ERROR

  package_encryption_key (32 bytes, derived from the admin's
  passphrase via Argon2id; independent of the organization key)

The organization key itself is never used as an AEAD key, as an
HMAC key, or as any other direct cryptographic primitive. It is
used only as input key material for HKDF.

The handshake_key is used only for the handshake proof tags. It
is never used as an AEAD key.

The session_key is used only for session messages. It is never
used as an HMAC key or as a KDF input.

This completes Section 22.


========================================================================

23\. CORRUPTION AND TAMPERING HANDLING

========================================================================



This section defines how the protocol detects and responds to

corrupted, tampered, malformed, or otherwise invalid messages

and events.



23.1 The Classes of Failure



The protocol recognizes five classes of failure. Each class has

its own error codes, its own handling rules, and its own effect

on session state and on the peer's delivery bookkeeping.



The classes:



1\. SESSION\_ERROR — the message could not be decrypted or

&#x20;  authenticated, or its outer envelope is malformed.



2\. PROTOCOL\_ERROR — the message was decrypted and

&#x20;  authenticated, but its inner structure violates the

&#x20;  protocol.



3\. EVENT\_ERROR — the message was decrypted, authenticated, and

&#x20;  structurally valid, but one or more individual events are

&#x20;  invalid.



4\. TRANSPORT\_ERROR — the underlying connection failed.



5\. INTERNAL\_ERROR — a peer or Control Plane internal failure.



The classification is important because it determines how the

protocol responds. Session and protocol errors affect the whole

message; event errors affect individual events; transport and

internal errors affect the session or the peer, not the message

content.



23.2 SESSION\_ERROR



A SESSION\_ERROR occurs when:



\- The AEAD authentication fails (this includes tag mismatch;

&#x20; with XChaCha20-Poly1305, authentication failure is what

&#x20; prevents authenticated decryption).

\- The outer TLV envelope is malformed: the declared length does

&#x20; not match the bytes received, the message exceeds the maximum

&#x20; size, or the framing is not valid TLV.

\- The session key cannot be derived.



A SESSION\_ERROR is detected before any event is parsed or

processed.



The boundary between SESSION\_ERROR and PROTOCOL\_ERROR:



\- An outer-envelope failure (the framing that precedes

&#x20; authenticated decryption) is a SESSION\_ERROR.

\- An authenticated message whose inner TLV structure is invalid

&#x20; is a PROTOCOL\_ERROR.



The outer envelope is the type + length framing and the AEAD

nonce. The inner content is what is decrypted. The outer

envelope is checked before decryption. The inner content is

checked after decryption.



Response:



\- The receiver does not process any events.

\- The receiver does not send a SYNC\_ACK. (Section 22.14.2)

\- The receiver may send an ERROR message with class

&#x20; SESSION\_ERROR and an error code below.

\- The receiver may close the session.



A SESSION\_ERROR does not affect the receiver's sync\_state or

the receiver's sync\_events. No events were accepted. The

receiver's state is unchanged.



A SESSION\_ERROR does not advance the sender's delivery

bookkeeping either, because no acknowledgement was received.



Error codes for SESSION\_ERROR:



\- 0x0001 — AEAD\_AUTHENTICATION\_FAILED. The AEAD authentication

&#x20; tag did not verify, or authenticated decryption otherwise

&#x20; failed.

\- 0x0002 — ENVELOPE\_MALFORMED. The outer TLV envelope is not

&#x20; valid.

\- 0x0003 — MESSAGE\_TOO\_LARGE. The message exceeds the maximum

&#x20; size.

\- 0x0004 — SESSION\_KEY\_UNAVAILABLE. The session key cannot be

&#x20; derived or is not present.



An internal failure in the crypto library (as opposed to an

authentication failure) is classified as INTERNAL\_ERROR

(Section 23.6), not as SESSION\_ERROR.



23.3 PROTOCOL\_ERROR



A PROTOCOL\_ERROR occurs when a message has been decrypted and

authenticated but its inner structure violates the protocol.

This class covers:



\- The inner content is not valid TLV.

\- A required field is missing.

\- A singular field appears more than once.

\- Fields appear out of the order defined by the message type.

\- A field's value does not match its protocol-defined type or

&#x20; size (for example, an event\_id that is not exactly 16 bytes).

\- A string is not valid UTF-8.

\- An integer is not canonically encoded.

\- A message type code is not in the supported set.

\- A protocol version is not supported.

\- The message violates a message-specific constraint (for

&#x20; example, an event\_count that does not match the number of

&#x20; event records present).

\- Padding or alignment bytes are present when they should not

&#x20; be.



A PROTOCOL\_ERROR is detected before any event is processed.



Response:



\- The receiver does not process any events.

\- The receiver does not send a SYNC\_ACK.

\- The receiver may send an ERROR message with class

&#x20; PROTOCOL\_ERROR and an error code below.

\- The receiver may close the session.



A PROTOCOL\_ERROR does not affect the receiver's sync\_state or

sync\_events. The receiver's state is unchanged.



A PROTOCOL\_ERROR does not advance the sender's delivery

bookkeeping.



Error codes for PROTOCOL\_ERROR:



\- 0x0101 — INNER\_NOT\_TLV. The inner content is not valid TLV.

\- 0x0102 — MISSING\_REQUIRED\_FIELD. A required field is absent.

\- 0x0103 — DUPLICATE\_SINGULAR\_FIELD. A singular field appears

&#x20; more than once.

\- 0x0104 — FIELD\_ORDER\_VIOLATION. Fields appear out of the

&#x20; defined order.

\- 0x0105 — FIELD\_SIZE\_MISMATCH. A fixed-size field has the

&#x20; wrong size.

\- 0x0106 — INVALID\_UTF8. A string field is not valid UTF-8.

\- 0x0107 — NONCANONICAL\_INTEGER. An integer is not canonically

&#x20; encoded.

\- 0x0108 — UNKNOWN\_MESSAGE\_TYPE. The message type code is not

&#x20; in the supported set.

\- 0x0109 — UNSUPPORTED\_PROTOCOL\_VERSION. The protocol version

&#x20; is not supported.

\- 0x010A — MESSAGE\_CONSTRAINT\_VIOLATION. A message-specific

&#x20; constraint is violated (for example, event\_count mismatch).

\- 0x010B — PADDING\_PRESENT. Unexpected padding or alignment

&#x20; bytes are present.

\- 0x010C — UNKNOWN\_EVENT\_TYPE. An event's event\_type code is

&#x20; not in the supported set.

\- 0x010D — UNKNOWN\_FIELD\_TYPE. A TLV field type code is not in

&#x20; the supported set for the message type.



23.4 EVENT\_ERROR



An EVENT\_ERROR occurs when a message has been decrypted,

authenticated, and structurally validated, but one or more

individual events inside it are invalid. The message is

processed; the invalid events are rejected; the valid events

are accepted.



Response:



\- The receiver processes the valid events normally (appends

&#x20; them to sync\_events, applies their effects, advances the

&#x20; logical clock).

\- The receiver does not process the invalid events.

\- The receiver sends a SYNC\_ACK with per-event outcomes:

&#x20; ACCEPTED, DUPLICATE, or REJECTED.

\- The REJECTED outcome is terminal for delivery (Section

&#x20; 22.14.4). The sender does not retry automatically.

\- The receiver may optionally send a separate ERROR message

&#x20; with class EVENT\_ERROR and an error code below, to give the

&#x20; sender more detail about the rejection. The ERROR message is

&#x20; not required.



An EVENT\_ERROR does not affect the receiver's sync\_state or its

handling of other events in the same message.



Error codes for EVENT\_ERROR:



\- 0x0201 — EVENT\_PAYLOAD\_INVALID. The event's payload does not

&#x20; match its event\_type's schema (Section 25).

\- 0x0202 — EVENT\_ENTITY\_REFERENCE\_INVALID. The event refers to

&#x20; an entity\_type or entity\_id that is not valid in the current

&#x20; context.

\- 0x0203 — EVENT\_FIELD\_INVALID. A field inside the event's

&#x20; payload is invalid.

\- 0x0204 — EVENT\_SEMANTIC\_INVALID. The event is structurally

&#x20; valid but violates a semantic rule (for example, an

&#x20; ENTITY\_UPDATED that sets `deleted` from true to false, which

&#x20; is forbidden by Section 14.3).



23.5 TRANSPORT\_ERROR



A TRANSPORT\_ERROR occurs when the underlying connection fails.

This is not a message-level error. It covers:



\- The TCP connection is dropped.

\- The connection times out.

\- The peer is unreachable.

\- The relay drops the connection.

\- The peer crashes mid-session.



Response:



\- The session ends.

\- The session key is discarded (Section 8.7).

\- The peers' sync\_state bookkeeping persists (Section 8.7).

\- On the next session, the peers re-run the handshake and

&#x20; re-send any events whose delivery was not acknowledged

&#x20; (Section 18.6).



A TRANSPORT\_ERROR is not signaled with an ERROR message, because

the transport is gone. It is detected by the transport layer

and handled by the session layer.



Error codes for TRANSPORT\_ERROR (used for logging, not for

protocol messages):



\- 0x0301 — CONNECTION\_DROPPED.

\- 0x0302 — CONNECTION\_TIMEOUT.

\- 0x0303 — PEER\_UNREACHABLE.

\- 0x0304 — RELAY\_CONNECTION\_FAILED.

\- 0x0305 — PEER\_CRASHED.



23.6 INTERNAL\_ERROR



An INTERNAL\_ERROR occurs when a peer or the Control Plane

encounters an internal failure that is not a protocol violation

on the other side's part. Examples:



\- The local database is locked or corrupted.

\- The local disk is full.

\- The crypto library fails for a reason other than

&#x20; authentication failure.

\- The Control Plane has an unexpected internal failure.



Response:



\- The peer logs the error locally.

\- The peer may send an ERROR message with class INTERNAL\_ERROR

&#x20; and an error code below.

\- If the error affects the session, the peer closes the

&#x20; session.



An INTERNAL\_ERROR is not the other peer's fault. The other peer

should not be penalized or rate-limited because of it.



Error codes for INTERNAL\_ERROR:



\- 0x0401 — DATABASE\_LOCKED.

\- 0x0402 — DATABASE\_CORRUPTED.

\- 0x0403 — DISK\_FULL.

\- 0x0404 — CRYPTO\_LIBRARY\_FAILURE.

\- 0x0405 — CONTROL\_PLANE\_INTERNAL.



23.7 The ERROR Message



The ERROR message (Section 22.18) carries:



\- error\_class (u8): one of the five classes (0x01–0x05).

\- error\_code (u16): the code within the class.

\- context (optional TLV structure): additional information.



The context field's structure depends on the class:



For SESSION\_ERROR:

\- message\_id, if the message\_id was recoverable before the

&#x20; error (usually not).

\- No other fields.



For PROTOCOL\_ERROR:

\- message\_id, if available.

\- The type code that caused the error, if applicable.

\- No event payloads, no debtor data.



For EVENT\_ERROR:

\- message\_id.

\- event\_id of the rejected event.

\- The error code that caused the rejection.

\- No event payloads, no debtor data.



For TRANSPORT\_ERROR:

\- Transport-level details (host, port, error reason).

\- No debtor data.



For INTERNAL\_ERROR:

\- A human-readable diagnostic string.

\- No debtor data.



The context field MUST NOT contain event payloads, debtor

identifiers, field values from any debtor record, document

names, or any other debtor-derived information

(Section 22.18.4).



23.8 What This Section Does Not Do



It does not define what a peer should log locally. That is an

implementation concern.

It does not define rate limiting or abuse prevention. Those are

operational concerns.

It does not define what the Control Plane does when it

observes errors. That is a Control Plane concern, not a

protocol concern.

It does not change any rule in Sections 15, 16, or 18. It

formalizes the failure classes those sections referenced.



Source: GORKA-MVP-SCOPE.md v1.1 §8;

MULTI-USER-CONCEPT.md v2.0 §7;

Section 16.2 of this document.



========================================================================

24\. PROTOCOL VERSIONING

========================================================================



This section defines how the protocol announces its version, how

version mismatches are handled, and how the protocol can evolve

without breaking older implementations.



24.1 The Version Number



The protocol has a single version number. It is a u16.



For the MVP, the version is 1 (0x0001).



The version number is carried in:



\- HANDSHAKE\_HELLO (Section 22.8.1).

\- HANDSHAKE\_REPLY (Section 22.9.1).

\- HANDSHAKE\_CONFIRM's proof\_input (Section 22.10.2).

\- DISCOVERY\_QUERY (Section 22.15.1).



Every peer announces its version at the start of every

handshake.



The MVP advertises one version only. A peer sends the version

it uses; it does not send a list of versions it supports, and

it does not advertise capability flags or feature bits. True

multi-version negotiation (a peer advertising multiple

supported versions and the two peers selecting the highest

mutual version) is a future amendment to this section. It is

not in the MVP.



24.2 The Meaning of Compatibility



A newer protocol version is compatible with an older protocol

version if and only if:



1\. A newer implementation is capable of operating using the

&#x20;  older version's complete wire format and semantics.



2\. The older version's byte format for every message type it

&#x20;  understands is unchanged in the newer version.



3\. The cryptographic constructions (XChaCha20-Poly1305,

&#x20;  HKDF-SHA256, Argon2id, SHA-256, UUIDv7) and their parameters

&#x20;  are unchanged.



4\. The semantics of every field the older version understands

&#x20;  are unchanged.



5\. Neither version removes a field that the older version

&#x20;  requires.



6\. Neither version changes the meaning of a field that the

&#x20;  older version uses.



Compatibility is not merely "the versions don't conflict."

Compatibility means that the newer implementation can operate

as the older version when communicating with an older peer.



A newer version is compatible with version 1 if it only:



\- Adds new event types (Section 22.13.3), using codes that

&#x20; version 1 does not use.

\- Adds new message types (Section 22.6), using codes that

&#x20; version 1 does not use.

\- Adds new optional fields, which version 1 can ignore.



A newer version is not compatible with version 1 if it:



\- Changes the wire format of any message that version 1

&#x20; understands.

\- Changes any cryptographic construction.

\- Changes the meaning of any field version 1 uses.

\- Removes any field version 1 requires.



24.3 Version Negotiation



During the handshake, each peer learns the other's version from

HANDSHAKE\_HELLO and HANDSHAKE\_REPLY.



If a common protocol version is supported by both peers, the

handshake proceeds using that version.



In the MVP, there is only one version (version 1), so a common

version always exists. Version mismatch is not possible. The

rule is defined here for future versions.



For future versions:



\- If Peer A uses version 1 and Peer B uses version 1, the

&#x20; negotiated version is 1.

\- If Peer A uses version 1 and Peer B uses version 2, and

&#x20; version 2 is compatible with version 1, then Peer B operates

&#x20; in version-1-compatible mode for the duration of the session.

&#x20; The negotiated version is 1.

\- If Peer A uses version 1 and Peer B uses version 2, and

&#x20; version 2 is not compatible with version 1, the handshake is

&#x20; refused.



The negotiated protocol version is an actual wire/protocol

version, not merely a capability compatibility relationship.

When the negotiated version is 1, both peers use the version 1

wire format and semantics for the entire session.



If no common version exists, the handshake is refused. The

refusing peer sends an ERROR message with class PROTOCOL\_ERROR

and error code 0x0109 (UNSUPPORTED\_PROTOCOL\_VERSION), or

closes the connection.



24.4 How the Protocol Evolves



The protocol evolves by increasing the version number. Each new

version is defined in an amendment to this document, following

the amendment process for the multi-user concept (documented,

approved by the founder, recorded with reasoning).



When a new version is introduced:



\- Version 1 remains supported if the new version is compatible

&#x20; with version 1 (per Section 24.2). Compatibility means a

&#x20; version 2 implementation can operate in version-1-compatible

&#x20; mode when communicating with a version 1 peer.

\- Version 1 is deprecated if the new version is not compatible

&#x20; with version 1. The deprecation is recorded in the amendment.

\- The old version is supported for a transition period defined

&#x20; in the amendment.



The exact deprecation policy is a funded-phase decision. The

MVP does not deprecate any version.



24.5 Forward Compatibility of Unknown Type Codes



Section 22.6 says: "A message whose type code is not in this

list is a protocol violation."



Section 22.13.4 says: "A received event whose event\_type code

is not in the currently supported set is a protocol violation."



These rules are strict. They mean that version 1 of the

protocol rejects messages and events with unknown type codes.



When version 2 adds a new message type or event type, version

1 implementations will reject it. This is acceptable because

version 1 implementations will not encounter version 2

messages: the peers will have negotiated a common version at

handshake time.



If a version 1 peer is talking to a version 2 peer, and the

negotiated version is 1 (because version 2 is compatible with

version 1 and operates in version-1-compatible mode), the

version 2 peer uses only the message and event types that

version 1 understands. No version 2 message type or event type

appears in the session.



If the negotiated version is 2 (because both peers support

version 2), both peers use the version 2 wire format and

semantics, including any new message types or event types.



The strict rejection is therefore correct: unknown type codes

appear only in mismatched-version sessions, and those sessions

are refused at handshake time.



24.6 What This Section Does Not Do



It does not define the transition policy for the funded phase.

That is a funded-phase decision.

It does not define what happens if a peer is upgraded mid-

session. The MVP assumes a peer's version is fixed for the

duration of a session.

It does not define a capability negotiation protocol. The MVP

has one version, one set of capabilities. True multi-version

negotiation is a future amendment.

It does not change Section 22.6 or Section 22.13.4. It

explains how their strict rejection rules interact with

versioning.



Source: GORKA-MVP-SCOPE.md v1.1 §11.2;

MULTI-USER-CONCEPT.md v2.0 §14.





========================================================================

25\. DATABASE APPLICATION RULES

========================================================================



This section defines how events are applied to the local SQLCipher

database, what the synchronization mechanism requires of the

local schema, and the exact payload structure of each MVP event

type.



It is the boundary between the event protocol (Sections 9–18)

and the local SQLite schema (LOCAL-TABLES.md v1.2).



25.1 Purpose and Scope



This section defines four things:



1\. What synchronization requires of the local database schema

&#x20;  (at the logical level, not the SQL level).

2\. How events are applied to the local database, transactionally.

3\. The exact byte-level payload structure of each MVP event type.

4\. The local schema amendments required to support the sync

&#x20;  mechanism.



It does not define SQL column types, indexes, or migration

code. Those live in LOCAL-TABLES.md v1.2 and in

`src-tauri/src/db.rs`. See Section 25.2 for the relationship

between this section and LOCAL-TABLES.md.



25.2 The Relationship Between This Section and LOCAL-TABLES.md



LOCAL-TABLES.md v1.2 is authoritative for the physical local

schema. It defines the tables, their fields, their types, their

indexes, and the migration version.



Section 25 is authoritative for synchronization behavior and

invariants. It defines what the synchronization mechanism

requires the local database to do: which tables participate,

what state must be durable across restarts, what must be

transactional, and how events are applied.



If LOCAL-TABLES.md and Section 25 contradict each other, the

contradiction MUST be resolved before implementation. Neither

document silently overrides the other. The resolution may

require an amendment to either document.



The reason for this split: the physical schema and the

synchronization behavior evolve for different reasons. The

schema changes when the application's data model changes. The

synchronization behavior changes when the protocol changes.

Keeping them separate makes each easier to maintain and review.



25.3 Tables That Participate in Synchronization



The MVP's synchronization mechanism uses the following local

tables. See LOCAL-TABLES.md v1.2 for their physical definitions.



Tables that hold debtor data (the Data Plane):



\- debtors — the current state of each debtor record.

\- debts — the current state of each debt record.

\- actions — the current state of each action record.

\- communications — the current state of each communication

&#x20; record (append-only in practice; see Section 25.11).

\- documents — the metadata of each document record (document

&#x20; contents are not synchronized in the MVP; see MVP scope

&#x20; §8.4).



Tables that hold synchronization state:



\- sync\_events — the append-only log of every valid event this

&#x20; device has originated or accepted. (LOCAL-TABLES.md v1.2

&#x20; Category D.1)

\- sync\_state — the per-peer delivery bookkeeping.

&#x20; (LOCAL-TABLES.md v1.2 Category D.2)

\- sync\_peers — the local cache of peer devices.

&#x20; (LOCAL-TABLES.md v1.2 Category D.3)



Tables required by the synchronization mechanism but not yet

present in LOCAL-TABLES.md:



\- organization\_keys — the single-row table that holds the

&#x20; organization key. Cryptographic state required by the sync

&#x20; mechanism, not an event-application table.

\- history\_records — the per-field losing-value records

&#x20; produced by state reconciliation. (Section 13.3)

\- pending\_events — the events that have been accepted but

&#x20; cannot yet be applied because their referenced entity does

&#x20; not yet exist. (Section 14.5)



These three tables are amendments to LOCAL-TABLES.md v1.2.

They are defined at the logical level in this section, and

their physical schema is recorded in the amendments pass

(Section 25.13).



Tables that are not used by synchronization:



\- audit\_log — the application audit log. It is separate from

&#x20; the sync protocol's event log (Section 9.7).

\- local\_connectors, local\_connector\_usage,

&#x20; connector\_sync\_state — connector state. Not synchronized.

\- local\_organization, local\_user, local\_templates — cache

&#x20; mirrors. Not synchronized.



The application audit log is not the sync protocol's memory.

It is written alongside the sync events for compliance and

human review, but the sync protocol does not read it and does

not depend on it.



25.4 Transactional Rules



The synchronization mechanism requires the following

transactional guarantees. Each is stated as an invariant that

the implementation must satisfy.



25.4.1 The Origination Transaction



When a device originates an event, the following happen in one

atomic transaction:



1\. The device allocates the next sequence number from its

&#x20;  sequence counter.

2\. The device writes or updates the row in the appropriate

&#x20;  state table.

3\. The device appends the new event row to sync\_events, with

&#x20;  the allocated sequence number.

4\. The device updates the sequence counter in sync\_state.

5\. The device advances its logical clock, and writes the

&#x20;  event's logical\_clock value.



Examples of origination: creating a debtor, updating a debtor,

creating an action, logging a communication.



Either all five happen, or none of them happen. There is no

state in which the state table has been updated but the event

has not been appended, or vice versa.



Under the transactional guarantee, a failed origination

transaction rolls back the sequence allocation and does not

consume the sequence number. The allocated sequence number is

available for the next origination attempt.



A sequence gap may nevertheless exist if the local database

was previously restored from an inconsistent backup, suffered

corruption, or otherwise violated its own durability

guarantees. Such a condition is a local database integrity

failure, not normal protocol behavior.



The protocol's invariant is:



\- Sequence reuse after a rolled-back transaction is permitted.

\- Sequence reuse after a committed event is forbidden.



The exact representation of the sequence counter and the

logical clock in sync\_state is defined in Section 25.5.



25.4.2 The Acceptance Transaction



When a device receives a message from a peer, it processes

each event in the message according to this transaction.



The event lifecycle has three states. They are distinct:



\- Accepted — the event has passed message and event

&#x20; validation, and has been durably recorded in sync\_events.

\- Applied — the event's domain effect has been successfully

&#x20; reconciled into the local state tables.

\- Pending — the event has been accepted and durably recorded,

&#x20; but its domain effect cannot yet be applied because a

&#x20; required prerequisite entity is unavailable.



Every applied event is accepted. Not every accepted event is

immediately applied. A pending event is already accepted; it

is not awaiting acceptance.



The acceptance transaction processes each event as follows:



1\. Validate the event's structure and fields (Section 23.3).



2\. Check the event\_id against sync\_events (duplicate

&#x20;  detection, Section 15).



3\. If the event is a duplicate, return DUPLICATE. No state

&#x20;  change of any kind. The logical clock is not advanced.



4\. Append the event to sync\_events.



5\. Advance the logical clock according to the Lamport rule

&#x20;  (Section 12.3, Rule 2).



6\. Determine whether the event can be applied immediately:



&#x20;  a. If the event's referenced entity exists locally, the

&#x20;     event is applicable. Reconcile its effect into the

&#x20;     state tables (Sections 13 and 14). Record any losing

&#x20;     values in history\_records (Section 13.3). The event

&#x20;     is APPLIED.



&#x20;  b. If the event's referenced entity does not yet exist,

&#x20;     the event is not yet applicable. Record the event in

&#x20;     pending\_events (Section 25.6). Do not apply its

&#x20;     domain effect. The event is ACCEPTED and PENDING.



7\. Commit the transaction.



Either the event is durably accepted and either applied or

durably pending, or none of these changes occur.



25.4.3 ACCEPTED Means Durable Acceptance



A SYNC\_ACK with an ACCEPTED outcome confirms that the event

has been durably accepted by the receiving database. It does

not necessarily confirm that the event's domain effect has

already been applied. An event may be ACCEPTED and remain

pending until its prerequisites become available.



This is a hard rule. The acknowledgement's meaning is durable

acceptance, not immediate application.



25.4.4 The ACK Commitment Rule



A SYNC\_ACK is sent only after the acceptance transaction (or

the duplicate detection, for duplicate events) has committed

successfully. The acknowledgement reflects the committed

state.



If the transaction has not committed, no acknowledgement is

sent for that event.



This is what makes the acknowledgement a proof of durable

acceptance (Section 16.2).



25.4.5 The Pending-Application Rule



An event whose referenced entity does not yet exist is not

dropped. It is stored in sync\_events (so that duplicate

detection works) and in pending\_events (so that it can be

applied later).



When the referenced entity becomes available, the pending

event is applied transactionally, using the same

reconciliation rules as immediate application (Sections 13

and 14). The append to sync\_events is not repeated; the event

is already there.



Given the same accepted event set, the resulting synchronized

state and deterministic history are independent of whether the

event was initially pending. See Sections 13.4 and 14.2.



25.4.6 Deterministic Ordering of Pending Application



When multiple pending events become applicable at the same

time, they are applied in deterministic protocol order:

(logical\_clock, device\_id, sequence), as defined in

Section 12.6.



The application order MUST NOT depend on the row order of the

pending\_events table, on SQLite's internal storage order, or

on any other implementation detail. Two implementations with

the same pending event set produce the same final state and

the same history records.



If an event's prerequisite requires a different order (for

example, an ENTITY\_UPDATED whose referenced entity is created

by a DEBTOR\_CREATED that is itself pending), the dependent

event becomes applicable only after the prerequisite is

applied. The ordering rule applies among events whose

prerequisites are already satisfied.



25.4.7 The Logical Clock Rule



The device's logical clock is a single persistent value,

stored in sync\_state. It is advanced by:



\- Origination: every time the device originates an event, the

&#x20; event's logical\_clock is set to the current value, and the

&#x20; value is incremented by one.

\- Acceptance: every time the device accepts a new event (not

&#x20; a duplicate), the value is set to:



&#x20;   max(current\_value, received\_event.logical\_clock + 1)



The logical clock is never decreased. It survives process

restarts.



A pending event still advances the logical clock, because it

is an accepted nonduplicate event. The advancement happens in

the acceptance transaction, before the event is determined to

be immediately applicable or pending.



A duplicate event does not advance the logical clock. An event

that fails validation does not advance the logical clock.



The exact representation of the logical clock in sync\_state

is defined in Section 25.5.



========================================================================

25.5 THE sync\_events TABLE — THE SYNC PROTOCOL'S EVENT LOG

========================================================================



This section defines, at the logical level, what sync\_events must

contain and what invariants the implementation must satisfy. The

physical schema is in LOCAL-TABLES.md v1.2 Category D.1.



25.5.1 Purpose



sync\_events is the sync protocol's append-only event log. It

contains every valid event this device has originated or

accepted. It is the protocol's source of truth for:



\- Duplicate detection (Section 15).

\- Delivery bookkeeping (Section 18).

\- Reconciliation input (Sections 13 and 14).

\- Convergence (Section 12.9).

\- Rebuilding local state if necessary.



sync\_events is not the application audit log. The application

audit log records who did what, for compliance and human review.

sync\_events records the events the sync protocol exchanges.

They are separate. Neither replaces the other.



25.5.2 Required Contents



Every row in sync\_events represents one accepted event. For

each event, the following must be durably stored:



\- event\_id — the event's UUIDv7, in binary form (16 bytes).

&#x20; This is the primary key for protocol purposes.

\- device\_id — the origin device instance. The device that

&#x20; originated the event.

\- sequence — the sequence number, scoped to the origin

&#x20; device\_id.

\- logical\_clock — the event's logical clock value.

\- event\_type — the event type code (Section 22.13.3).

\- entity\_type — the type of the affected entity.

\- entity\_id — the identifier of the affected entity.

\- payload — the event's payload, as received or as

&#x20; originated. The payload is stored in a form that allows the

&#x20; canonical event serialization to be reproduced exactly

&#x20; (Section 22.6.5). The implementation may store the payload

&#x20; in either wire form or a canonical local form, provided the

&#x20; canonical wire serialization can be produced.

\- created\_at — the originating device's wall-clock timestamp.

&#x20; Informational only.

\- local\_received\_at — the local wall-clock time at which this

&#x20; device accepted the event. Local metadata, not part of the

&#x20; wire format. Used for operational diagnostics. Not used for

&#x20; ordering.



The physical column names and types are in LOCAL-TABLES.md

v1.2. The logical fields above are the minimum the

synchronization mechanism requires.



25.5.3 Required Invariants



Invariant 1 — Append-only.



&#x20; Rows are never updated and never deleted. Once an event is

&#x20; in sync\_events, it stays there.



Invariant 2 — event\_id uniqueness.



&#x20; No two rows have the same event\_id.



Invariant 3 — (device\_id, sequence) uniqueness.



&#x20; No two rows have the same (device\_id, sequence) pair.



Invariant 4 — Locally originated events form a monotonic

sequence per device.



&#x20; For events originated by this device, sequence numbers are

&#x20; strictly increasing in origination order. Received events

&#x20; are not covered by this invariant; their sequence numbers

&#x20; are the origin's, not this device's.



Invariant 5 — Accepted events are durable.



&#x20; Once an event is committed to sync\_events, it survives

&#x20; process restarts, device crashes, and power loss.



Invariant 6 — The canonical event serialization can be

reproduced exactly.



&#x20; Given a row in sync\_events, the implementation can

&#x20; reproduce the exact canonical byte serialization of the

&#x20; event record, including its payload, as defined by Section

&#x20; 22.13.2 through 22.13.4. This is sufficient to retransmit

&#x20; the event in a new SYNC\_MESSAGE.



Invariant 7 — Received events are stored with their origin

metadata.



&#x20; An event received from a peer is stored with its origin

&#x20; device\_id and sequence, not with the receiving device's

&#x20; device\_id. The device\_id in the row is the origin's, not

&#x20; the receiver's.



25.5.4 Derived Queries



The synchronization mechanism performs the following queries

against sync\_events.



Query 1 — Duplicate check.



&#x20; Given an event\_id, is there a row with that event\_id?

&#x20; (Section 15)



Query 2 — Undelivered events per peer.



&#x20; Given a peer's delivery bookkeeping (Section 25.6), which

&#x20; events in sync\_events are not yet delivered to that peer?

&#x20; (Section 18.3)



Query 3 — Events by origin and sequence range.



&#x20; Given an origin device\_id and a sequence range, which

&#x20; events are in that range?



Query 4 — All events affecting a given entity.



&#x20; Given an entity\_type and entity\_id, which events concern

&#x20; that entity? (Used during reconciliation and when a pending

&#x20; event becomes applicable.)



Query 5 — The highest sequence committed by this device.



&#x20; The highest sequence number actually committed by this

&#x20; device (not the next sequence number to be allocated).

&#x20; Used to populate the origin\_sequence\_hint in

&#x20; SESSION\_ESTABLISHED (Section 22.11.2).



25.5.5 What sync\_events Does Not Contain



sync\_events does not contain:



\- Application state. The current values of debtor records,

&#x20; debts, actions, etc., are in the state tables.

\- Application audit information. That is in audit\_log.

\- The current delivery state. That is in sync\_state.

\- Keys. Those are in organization\_keys and, during a session,

&#x20; in memory only.



========================================================================

25.6 THE sync\_state TABLE — DELIVERY BOOKKEEPING

========================================================================



This section defines, at the logical level, what sync\_state

must contain. The physical schema is in LOCAL-TABLES.md v1.2

Category D.2.



25.6.1 Purpose



sync\_state holds the protocol's per-peer bookkeeping. It is

the durable state the synchronization mechanism needs in order

to know:



\- What events have been acknowledged by each peer.

\- The delivery state for each origin toward each peer.

\- The current status of each peer relationship.

\- The device's own sequence counter and logical clock.



sync\_state is not the event log. The event log is

sync\_events. sync\_state is the bookkeeping that references the

event log.



Incoming acceptance is established by sync\_events (an event

with an event\_id is an event this device has accepted).

sync\_state tracks outbound delivery and local protocol state.



25.6.2 Required Contents



sync\_state must durably store the following.



Per-peer delivery bookkeeping:



For each peer (identified by the peer's device\_id):



\- peer\_device\_id — the peer's device instance identifier.

\- For each origin device\_id (including this device's own

&#x20; device\_id):

&#x20; - watermark — the highest sequence number N such that every

&#x20;   event from that origin with sequence ≤ N has been

&#x20;   acknowledged by the peer. See Section 18.2.

&#x20; - gap\_set — the set of acknowledged sequence numbers above

&#x20;   the watermark. See Section 18.2.

\- status — the peer relationship's current state (Section

&#x20; 26).

\- last\_successful\_sync — the wall-clock time of the last

&#x20; successful sync with this peer. Informational.



Per-device local state:



\- This device's own device\_id.

\- This device's sequence counter (Section 11.4).

\- This device's logical clock (Section 12.3).



The per-origin delivery bookkeeping is the key addition. It is

not a single watermark per peer. It is one watermark and gap

set per (peer, origin) pair, because a peer can forward

another peer's events to this device, and this device's

delivery state to that peer is tracked per origin.



25.6.3 Required Invariants



Invariant 1 — Delivery bookkeeping is durable.



&#x20; The watermark, gap set, and status per peer persist across

&#x20; process restarts.



Invariant 2 — Watermarks are monotonic.



&#x20; A watermark never decreases. Once an event's sequence number

&#x20; is below the watermark, it stays below the watermark.



Invariant 3 — The sequence counter is monotonic.



&#x20; This device's sequence counter never decreases. It survives

&#x20; process restarts.



Invariant 4 — The logical clock is monotonic.



&#x20; This device's logical clock never decreases. It survives

&#x20; process restarts.



Invariant 5 — Watermarks and gap sets are consistent.



&#x20; If a sequence number S is below the watermark for (peer,

&#x20; origin), then S is not in the gap set for (peer, origin).



25.6.4 Derived Operations



Operation 1 — Advance delivery.



&#x20; Given a peer and an acknowledged event from origin O with

&#x20; sequence S, update the watermark and gap set for

&#x20; (peer, O). See Section 18.2.



Operation 2 — Compute undelivered set.



&#x20; Given a peer, compute the set of events in sync\_events that

&#x20; are not yet delivered to that peer. See Section 18.3.



Operation 3 — Read the sequence counter.



&#x20; Before originating an event.



Operation 4 — Advance the sequence counter.



&#x20; After allocating a sequence number.



Operation 5 — Read and advance the logical clock.



&#x20; Inside the origination and acceptance transactions.



25.6.5 What sync\_state Does Not Contain



sync\_state does not contain:



\- Events. Those are in sync\_events.

\- Application state. Those are in the state tables.

\- The organization key. That is in organization\_keys.

\- Session keys. Those are in memory only, during a session,

&#x20; and are discarded when the session ends.



========================================================================

25.7 THE history\_records AND pending\_events TABLES

========================================================================



25.7.1 history\_records — Purpose



history\_records holds the deterministic reconciliation

outcome for each contested field. It is the local record of

which event won and which lost, computed according to the

protocol order (Section 12.6).



history\_records is derived state. It is not synchronized in

the MVP, and it is not part of the protocol's own history.

The protocol's immutable history is sync\_events. From the

accepted event set in sync\_events, and the deterministic

reconciliation rules in Sections 12 through 14, every device

can derive the same history\_records content.



25.7.2 history\_records — Required Contents



For each contested field, the following is stored:



\- entity\_type — the type of the affected entity.

\- entity\_id — the identifier of the affected entity.

\- field\_name — the name of the field whose value was

&#x20; contested.

\- losing\_value — the losing value. The representation is the

&#x20; same as the field's representation in the state table.

\- losing\_event\_id — the event\_id of the state change that

&#x20; lost.

\- winning\_event\_id — the event\_id of the state change that

&#x20; won.

\- reconciled\_at — the local wall-clock time at which the

&#x20; reconciliation was computed. This is local diagnostic

&#x20; metadata. It is explicitly excluded from deterministic

&#x20; history equivalence. See Section 25.7.3, Invariant 1.



The physical column names and types are recorded in the

amendments pass (Section 25.13).



25.7.3 history\_records — Required Invariants



Invariant 1 — Deterministic reconstruction.



&#x20; Given the same accepted event set, two devices MUST be able

&#x20; to derive identical deterministic history records,

&#x20; regardless of event arrival order.



&#x20; The deterministic content of a history record is: entity

&#x20; type, entity id, field name, losing value, losing event\_id,

&#x20; and winning event\_id. The reconciled\_at field is local

&#x20; diagnostic metadata and is excluded from deterministic

&#x20; equivalence.



Invariant 2 — Derived state.



&#x20; history\_records is derived from the accepted events in

&#x20; sync\_events and the deterministic reconciliation rules.

&#x20; When a newly accepted event changes the reconciliation

&#x20; outcome for a field, the affected history records are

&#x20; updated or reconstructed so that they continue to represent

&#x20; the canonical reconciliation result.



&#x20; history\_records is not append-only. It is not the

&#x20; protocol's immutable history. The protocol's immutable

&#x20; history is sync\_events. history\_records is a derived

&#x20; explanation of the current reconciliation outcome, and may

&#x20; be recomputed.



Invariant 3 — Local only.



&#x20; history\_records is not synchronized in the MVP. It is not

&#x20; sent to peers. It is not sent to the Control Plane. It is

&#x20; local.



25.7.4 history\_records — What It Is Not



history\_records is not:



\- The application audit log. That is audit\_log.

\- The sync protocol's immutable event history. That is

&#x20; sync\_events.

\- A delivery bookkeeping table. That is sync\_state.



It is the local, derived record of reconciliation outcomes,

for compliance and for human review. It answers the question

"why does this field have this value?" with "because this

event won, and that event lost."



Because it is derived, it can be reconstructed from

sync\_events at any time by replaying the deterministic

reconciliation rules. Its purpose is to avoid replaying on

every query, not to be a source of truth.



25.7.5 pending\_events — Purpose



pending\_events holds events that have been accepted but cannot

yet be applied, because their referenced entity does not yet

exist (Section 14.5).



An event in pending\_events has already been accepted. It is

already in sync\_events. Its logical clock advancement has

already happened. Its delivery has already been acknowledged

to the peer (Section 25.4.3).



pending\_events is a work-queue table. Its rows are removed

when the event is applied.



25.7.6 pending\_events — Required Contents



For each pending event:



\- event\_id — the event's UUIDv7. This references the row in

&#x20; sync\_events.

\- reason — a code indicating why the event is pending. The

&#x20; MVP has one reason: ENTITY\_NOT\_YET\_PRESENT.

\- depends\_on\_entity\_type — the type of the entity that is

&#x20; required.

\- depends\_on\_entity\_id — the identifier of the entity that is

&#x20; required.

\- added\_at — the local wall-clock time at which the event was

&#x20; first marked pending. Informational.



The physical column names and types are recorded in the

amendments pass (Section 25.13).



25.7.7 pending\_events — Required Invariants



Invariant 1 — Every pending event is accepted.



&#x20; A row in pending\_events references an event that is already

&#x20; in sync\_events.



Invariant 2 — Removal on application.



&#x20; When a pending event is applied, its row in pending\_events

&#x20; is removed in the same transaction that applies the event.



Invariant 3 — Deterministic application order.



&#x20; When multiple pending events become applicable at the same

&#x20; time, they are applied in the canonical protocol order

&#x20; (logical\_clock, device\_id, sequence). See Section 25.4.6.



Invariant 4 — Pending events do not block other events.



&#x20; A pending event does not prevent other events from being

&#x20; accepted and applied. Each event is handled independently.



25.7.8 The Relationship Between the Three Tables



The three tables serve three different purposes:



\- sync\_events — the complete immutable history of every

&#x20; accepted event. The protocol's source of truth.

\- pending\_events — the subset of accepted events that have

&#x20; not yet been applied. It shrinks as prerequisites arrive.

&#x20; It is a work queue.

\- history\_records — the derived, deterministic explanation of

&#x20; the current reconciliation outcome for each contested

&#x20; field. It is recomputed or updated as new events arrive.

&#x20; It is not immutable.



The three tables are separate on purpose. Merging them would

conflate three different concerns: what happened, what is

waiting to be processed, and what was decided in a conflict.



The conceptual relationship:



&#x20; sync\_events  (immutable accepted facts)

&#x20;      |

&#x20;      |  deterministic reconciliation rules

&#x20;      |  (Sections 12, 13, 14)

&#x20;      v

&#x20; current state  (state tables)

&#x20;      +

&#x20; history\_records  (derived explanation of conflicts)



&#x20; pending\_events  (work queue for events whose

&#x20;                  prerequisites are not yet available)



========================================================================

25.8 EVENT TYPE: DEBTOR\_CREATED

========================================================================



25.8.1 Purpose



DEBTOR\_CREATED records that a new debtor record was originated

on a device. It carries the debtor's initial state.



25.8.2 Allowed Entity Type



entity\_type MUST be 0x01 (debtor).



25.8.3 Payload Wire Format



The payload is a TLV-encoded structure. Its TLV type codes:



&#x20; +--------------------------+-----------+

&#x20; | field                    | type code |

&#x20; +--------------------------+-----------+

&#x20; | name                     | 0x2001    |

&#x20; | surname                  | 0x2002    |

&#x20; | email                    | 0x2003    |

&#x20; | phone                    | 0x2004    |

&#x20; | data\_json                | 0x2005    |

&#x20; +--------------------------+-----------+



The fields name, surname, email, and phone are UTF-8 strings,

length-prefixed per Section 22.3.



The field data\_json is a UTF-8 string, length-prefixed,

containing canonical JSON as defined in Section 25.13. It may

be empty, which means the data column is `{}`.



Canonicalization:



\- Canonical JSON representation is defined in Section 25.13.

\- Canonical date-time representation is defined in Section 25.13.

\- NULL representation for nullable fields is defined in

&#x20; Section 25.13.



Required fields: name, surname.



Optional fields: email, phone, data\_json. An absent field is

encoded by its absence. An implementation MUST distinguish

"absent" from "empty string."



Field order is fixed: name, surname, email, phone, data\_json.

Absent optional fields are omitted; the next present field

follows in order.



25.8.4 Validation



An event is valid if:



\- entity\_type is 0x01 (debtor).

\- The payload is valid TLV.

\- name is present, non-empty, and valid UTF-8.

\- surname is present, non-empty, and valid UTF-8.

\- If email is present, it is valid UTF-8.

\- If phone is present, it is valid UTF-8.

\- If data\_json is present, it is valid canonical JSON.

\- The entity\_id is present and non-empty.

\- No other payload fields are present.



A payload that fails any check is an EVENT\_ERROR with code

EVENT\_PAYLOAD\_INVALID (0x0201) or EVENT\_FIELD\_INVALID

(0x0203).



25.8.5 Application Transaction



When a DEBTOR\_CREATED event is applied:



1\. Determine whether a debtor row with this entity\_id already

&#x20;  exists in the local debtors table.



&#x20;  a. If the row does not exist:



&#x20;     Insert a new debtor row with:



&#x20;       id = entity\_id

&#x20;       organization\_id = the device's organization\_id

&#x20;       name = payload.name

&#x20;       surname = payload.surname

&#x20;       email = payload.email, or the database NULL

&#x20;               representation defined in Section 25.13 when

&#x20;               the field is absent

&#x20;       phone = payload.phone, or the database NULL

&#x20;               representation defined in Section 25.13 when

&#x20;               the field is absent

&#x20;       data = payload.data\_json, or the database '{}'

&#x20;              representation defined in Section 25.13 when

&#x20;              the field is absent

&#x20;       created\_at = event.created\_at

&#x20;       updated\_at = event.created\_at (Section 25.13 defines

&#x20;                  updated\_at semantics)



&#x20;     For each field set by this event, write a row in

&#x20;     entity\_field\_state recording this event as the current

&#x20;     winner for that field.



&#x20;  b. If the row already exists, this is a concurrent

&#x20;     creation of the same entity\_id. For each field set by

&#x20;     this event, run the reconciliation algorithm

&#x20;     (Section 25.9.9), comparing against the current

&#x20;     winner from entity\_field\_state.



&#x20;     The comparison is by protocol order

&#x20;     (logical\_clock, device\_id, sequence). Not by arrival

&#x20;     order, not by wall-clock time, not by database

&#x20;     insertion order.



2\. Write an entry to the application audit log.



3\. Advance the logical clock.



4\. Append the event to sync\_events.



Steps 1 through 4 are one transaction.



25.8.6 Conflict and Reconciliation Behavior



DEBTOR\_CREATED participates in state reconciliation. Two

DEBTOR\_CREATED events for the same entity\_id are concurrent

creations; the reconciliation rule applies per field.



Reconciliation compares this event's protocol-order key

against the current winner for each field, as recorded in

entity\_field\_state. It does not compare against the event

that originally created the row.



The full algorithm is in Section 25.9.9.



25.8.7 History



For each field of DEBTOR\_CREATED that loses a reconciliation,

history\_records gets a row:



\- entity\_type = 0x01 (debtor)

\- entity\_id = the debtor's id

\- field\_name = the field's name

\- losing\_value = the value set by DEBTOR\_CREATED

\- losing\_event\_id = this event's event\_id

\- winning\_event\_id = the winning event's event\_id



If DEBTOR\_CREATED wins, the previously recorded losing value

(if any) is retained in history\_records, with the

winning\_event\_id updated to point to this event.



25.8.8 Failure Behavior



If DEBTOR\_CREATED fails validation, the outcome is

EVENT\_ERROR with code EVENT\_PAYLOAD\_INVALID or

EVENT\_FIELD\_INVALID. The event is rejected; it is not applied;

its row is not appended to sync\_events; the outcome is

reported in the SYNC\_ACK as REJECTED.



If DEBTOR\_CREATED refers to an entity that already exists

locally (concurrent creation), it is NOT rejected. It is

applied with state reconciliation.



If the payload contains a field type code not listed in

Section 25.8.3, the outcome is PROTOCOL\_ERROR with code

UNKNOWN\_FIELD\_TYPE (0x010D).



========================================================================

25.9 EVENT TYPE: ENTITY\_UPDATED

========================================================================



25.9.1 Purpose



ENTITY\_UPDATED records that one or more mutable fields of an

existing record were changed. It is the general update event

for the entities synchronized in the MVP.



Deletion is represented as an ENTITY\_UPDATED that sets the

entity's `deleted` field to true (Section 14.3). There is no

separate DELETE event type in the MVP.



25.9.2 Allowed Entity Type



In the MVP, ENTITY\_UPDATED applies to entity types that are

synchronized through the MVP event set:



\- 0x01 (debtor)

\- 0x03 (action)

\- 0x04 (communication)



The entity types 0x02 (debt) and 0x05 (document) are reserved

for the funded phase. They are not valid ENTITY\_UPDATED entity

types in the MVP and MUST NOT be produced or accepted by an MVP

implementation.



The reason: the MVP event set (Section 9.2) has no

DEBT\_CREATED and no DOCUMENT\_CREATED event type. Debt and

document data remains local to the device in the MVP and is

not represented in sync events. Debt and document

synchronization can be added in the funded phase, without

changing the wire format or the reconciliation algorithm.



25.9.3 Payload Wire Format



The payload is a TLV-encoded structure. Its TLV type codes:



&#x20; +--------------------------+-----------+

&#x20; | field                    | type code |

&#x20; +--------------------------+-----------+

&#x20; | changes                  | 0x3001    |

&#x20; +--------------------------+-----------+



The field changes is a repeatable TLV record with type code

0x3001. It appears one or more times, once per field change.



Each change record is a TLV-encoded structure with type code

0x3001. Its value:



&#x20; +--------------------------+-----------+

&#x20; | field                    | type code |

&#x20; +--------------------------+-----------+

&#x20; | field\_name               | 0x3011    |

&#x20; | field\_value              | 0x3012    |

&#x20; +--------------------------+-----------+



The field field\_name is a UTF-8 string, length-prefixed. It

is the name of the field being changed.



The field field\_value is a UTF-8 string, length-prefixed. It

is the new value of the field, encoded as a string.



The exact encoding of field\_value for each field, including

how NULL is distinguished from empty string and from JSON

null, is defined in Section 25.13.



Required: at least one change record. An ENTITY\_UPDATED with

zero change records is a protocol violation.



The change records appear in deterministic order: lexicographic

order of field\_name. This makes the serialization canonical.



The same field\_name MUST NOT appear more than once in a single

ENTITY\_UPDATED. A duplicate field\_name is a protocol

violation.



25.9.4 Validation



An event is valid if:



\- entity\_type is one of the MVP-synchronized types

&#x20; (Section 25.9.2).

\- The payload is valid TLV.

\- At least one change record is present.

\- Each change record has a non-empty field\_name and a

&#x20; field\_value.

\- field\_name and field\_value are valid UTF-8.

\- No field\_name appears more than once.

\- The entity\_id is present and non-empty.

\- Each field\_name is valid for the given entity\_type, per

&#x20; Section 25.13.

\- For the `deleted` field: the field\_value MUST represent

&#x20; true. Setting `deleted` to false is a semantic violation

&#x20; (Section 14.3). An ENTITY\_UPDATED that attempts to set

&#x20; `deleted` to false is an EVENT\_ERROR with code

&#x20; EVENT\_SEMANTIC\_INVALID (0x0204).

\- Each field\_name is mutable for the given entity\_type, per

&#x20; Section 25.13. An attempt to change an immutable field is

&#x20; an EVENT\_ERROR with code EVENT\_FIELD\_INVALID (0x0203).



25.9.5 Application Transaction



When an ENTITY\_UPDATED event is applied:



1\. Locate the target row in the state table corresponding to

&#x20;  entity\_type and entity\_id.



&#x20;  a. If the row does not exist, the event is pending

&#x20;     (Section 25.7.5). It is recorded in pending\_events

&#x20;     with reason ENTITY\_NOT\_YET\_PRESENT and

&#x20;     depends\_on\_entity\_type and depends\_on\_entity\_id set

&#x20;     from the event. Its domain effect is not applied yet.



&#x20;  b. If the row exists, apply each change record using the

&#x20;     reconciliation algorithm in Section 25.9.9.



&#x20;  The comparison is by protocol order

&#x20;  (logical\_clock, device\_id, sequence). Not by arrival

&#x20;  order, not by wall-clock time, not by database insertion

&#x20;  order.



2\. Write an entry to the application audit log.



3\. Advance the logical clock.



4\. Append the event to sync\_events.



Steps 1 through 4 are one transaction.



25.9.6 Conflict and Reconciliation Behavior



ENTITY\_UPDATED is the primary participant in state

reconciliation. Its behavior is defined by Section 13.



Per-field: the more recent event in the protocol order wins.

The losing value is recorded in history\_records. The current

winner is recorded in entity\_field\_state.



The `deleted` field is monotonic. Once true, it cannot be set

to false. See Section 25.9.9 for the precise rule.



25.9.7 History



history\_records and entity\_field\_state serve different

purposes:



\- entity\_field\_state records the current winner for each

&#x20; field.

\- history\_records records losing values.



For each field change that loses a reconciliation,

history\_records gets a row:



\- entity\_type = the event's entity\_type

\- entity\_id = the event's entity\_id

\- field\_name = the change record's field\_name

\- losing\_value = the change record's field\_value

\- losing\_event\_id = this event's event\_id

\- winning\_event\_id = the current winner's event\_id



For each field change that wins a reconciliation,

entity\_field\_state is updated to point to this event as the

winner.



history\_records is not the authoritative record of the

current winner. It is the record of losing values.

entity\_field\_state is the authoritative record of the

current winner.



25.9.8 Failure Behavior



If ENTITY\_UPDATED fails validation, the outcome is EVENT\_ERROR

with the appropriate code.



If ENTITY\_UPDATED attempts to set `deleted` to false, the

outcome is EVENT\_ERROR with code EVENT\_SEMANTIC\_INVALID.



If ENTITY\_UPDATED references an entity that does not yet exist

locally, it is not rejected. It is accepted and made pending.



If the payload contains a field type code not listed in

Section 25.9.3, the outcome is PROTOCOL\_ERROR with code

UNKNOWN\_FIELD\_TYPE (0x010D).



25.9.9 The Reconciliation Algorithm



The algorithm is invoked when an accepted event sets one or

more fields of an entity. For each field:



1\. Read the current winner for (entity\_type, entity\_id,

&#x20;  field\_name) from entity\_field\_state. If no row exists,

&#x20;  the field has never been set by any accepted event; the

&#x20;  first event to set it becomes the winner.



2\. Compute this event's protocol-order key: (logical\_clock,

&#x20;  device\_id, sequence).



3\. If a current winner exists, compute the current winner's

&#x20;  protocol-order key.



4\. Compare the two keys lexicographically (Section 12.6).



5\. Case A — this event is more recent:



&#x20;  a. If the state table's current value for the field

&#x20;     differs from this event's value, update the state

&#x20;     table to this event's value.



&#x20;  b. If a current winner existed and its value differed

&#x20;     from this event's value, record the current winner's

&#x20;     value in history\_records as the losing value, with

&#x20;     losing\_event\_id = current winner's event\_id,

&#x20;     winning\_event\_id = this event's event\_id.



&#x20;  c. Update entity\_field\_state to record this event as the

&#x20;     current winner for the field.



6\. Case B — the current winner is more recent:



&#x20;  a. Record this event's value in history\_records as the

&#x20;     losing value, with losing\_event\_id = this event's

&#x20;     event\_id, winning\_event\_id = current winner's

&#x20;     event\_id.



&#x20;  b. Do not update the state table.



&#x20;  c. Do not update entity\_field\_state.



7\. Case C — the keys are equal:



&#x20;  This cannot happen for two distinct events, because

&#x20;  (device\_id, sequence) is globally unique. If detected, it

&#x20;  is a protocol violation.



8\. Special case — the `deleted` field:



&#x20;  The `deleted` field is monotonic. The rule:



&#x20;  - If an event sets deleted = true and deleted is currently

&#x20;    false or unset: set deleted = true. Record this event as

&#x20;    the winner in entity\_field\_state.



&#x20;  - If an event sets deleted = true and deleted is already

&#x20;    true: the state remains true. Compare this event's

&#x20;    protocol-order key against the current winner's key. If

&#x20;    this event is more recent, update entity\_field\_state to

&#x20;    record this event as the winner. If the current winner is

&#x20;    more recent, entity\_field\_state is not changed.



&#x20;    No history record is created solely because a newer

&#x20;    true-setting event becomes the winner. The value is

&#x20;    unchanged, so there is no losing value to record. This is

&#x20;    consistent with the general same-value rule (Case A,

&#x20;    step 5b, which records a history entry only when the

&#x20;    current winner's value differs from the new event's

&#x20;    value).



&#x20;  - An event that attempts to set deleted = false is rejected

&#x20;    as EVENT\_SEMANTIC\_INVALID before this algorithm is

&#x20;    invoked (Section 25.9.4).



&#x20;  The result: entity\_field\_state always identifies the

&#x20;  accepted true-setting event with the greatest protocol-

&#x20;  order key. This is deterministic and independent of

&#x20;  arrival order.



The algorithm is deterministic. Given the same accepted event

set, every device produces the same state, the same

entity\_field\_state, and the same deterministic history\_records

content (excluding local diagnostic fields such as

reconciled\_at).



========================================================================

25.10 EVENT TYPE: ACTION\_CREATED

========================================================================



25.10.1 Purpose



ACTION\_CREATED records that a new action was originated on a

device. It carries the action's initial state.



25.10.2 Allowed Entity Type



entity\_type MUST be 0x03 (action).



25.10.3 Payload Wire Format



The payload is a TLV-encoded structure. Its TLV type codes:



&#x20; +--------------------------+-----------+

&#x20; | field                    | type code |

&#x20; +--------------------------+-----------+

&#x20; | debtor\_id                | 0x4001    |

&#x20; | action\_type              | 0x4002    |

&#x20; | status                   | 0x4003    |

&#x20; | assigned\_to              | 0x4004    |

&#x20; | due\_date                 | 0x4005    |

&#x20; | description              | 0x4006    |

&#x20; | data\_json                | 0x4007    |

&#x20; +--------------------------+-----------+



The field debtor\_id is a UTF-8 string, length-prefixed. It is

the entity\_id of the debtor the action is attached to.



The field action\_type is a UTF-8 string, length-prefixed. Its

permitted values are defined in Section 25.13.



The field status is a UTF-8 string, length-prefixed. Its

permitted values are defined in Section 25.13.



The field assigned\_to is a UTF-8 string, length-prefixed. It

may be absent.



The field due\_date is a UTF-8 string, length-prefixed,

canonical date-time per Section 25.13. It may be absent.



The field description is a UTF-8 string, length-prefixed. It

may be absent.



The field data\_json is a UTF-8 string, length-prefixed,

canonical JSON per Section 25.13. It may be absent.



Required fields: debtor\_id, action\_type, status.



Optional fields: assigned\_to, due\_date, description,

data\_json.



Field order is fixed: debtor\_id, action\_type, status,

assigned\_to, due\_date, description, data\_json.



25.10.4 Validation



An event is valid if:



\- entity\_type is 0x03 (action).

\- The payload is valid TLV.

\- debtor\_id is present, non-empty, valid UTF-8.

\- action\_type is present, valid UTF-8, and permitted.

\- status is present, valid UTF-8, and permitted.

\- If assigned\_to is present, it is valid UTF-8.

\- If due\_date is present, it is canonical date-time.

\- If description is present, it is valid UTF-8.

\- If data\_json is present, it is valid canonical JSON.

\- The entity\_id is present and non-empty.

\- No other payload fields are present.



A payload that fails any check is an EVENT\_ERROR.



25.10.5 Application Transaction



When an ACTION\_CREATED event is applied:



1\. Determine whether an action row with this entity\_id

&#x20;  already exists in the local actions table.



&#x20;  a. If the row does not exist:



&#x20;     Verify that the debtor referenced by debtor\_id exists

&#x20;     locally. If it does not, the event is pending. Recorded

&#x20;     in pending\_events with depends\_on\_entity\_type = 0x01

&#x20;     (debtor) and depends\_on\_entity\_id = debtor\_id.



&#x20;     If the debtor exists, insert a new action row with:



&#x20;       id = entity\_id

&#x20;       debtor\_id = payload.debtor\_id

&#x20;       type = payload.action\_type

&#x20;       status = payload.status

&#x20;       assigned\_to = payload.assigned\_to, or the database

&#x20;                     NULL representation defined in

&#x20;                     Section 25.13 when the field is absent

&#x20;       due\_date = payload.due\_date, or the database NULL

&#x20;                  representation defined in Section 25.13

&#x20;                  when the field is absent

&#x20;       description = payload.description, or the database

&#x20;                     NULL representation defined in

&#x20;                     Section 25.13 when the field is absent

&#x20;       data = payload.data\_json, or the database '{}'

&#x20;              representation defined in Section 25.13 when

&#x20;              the field is absent

&#x20;       created\_at = event.created\_at

&#x20;       updated\_at = event.created\_at



&#x20;     For each field set by this event, write a row in

&#x20;     entity\_field\_state recording this event as the current

&#x20;     winner.



&#x20;  b. If the row already exists, this is a concurrent

&#x20;     creation of the same entity\_id. For each field set by

&#x20;     this event, run the reconciliation algorithm

&#x20;     (Section 25.9.9).



2\. Write an entry to the application audit log.



3\. Advance the logical clock.



4\. Append the event to sync\_events.



Steps 1 through 4 are one transaction.



25.10.6 Conflict and Reconciliation Behavior



ACTION\_CREATED participates in state reconciliation like

DEBTOR\_CREATED. Concurrent creation of the same entity\_id is

a state reconciliation case.



Reconciliation uses the algorithm in Section 25.9.9.



25.10.7 History



As in Section 25.9.7, but for action fields.



25.10.8 Failure Behavior



If ACTION\_CREATED fails validation, the outcome is EVENT\_ERROR.



If ACTION\_CREATED references a debtor that does not yet exist

locally, it is not rejected. It is accepted and made pending.



If the payload contains a field type code not listed in

Section 25.10.3, the outcome is PROTOCOL\_ERROR with code

UNKNOWN\_FIELD\_TYPE (0x010D).



========================================================================

25.11 EVENT TYPE: COMMUNICATION\_LOGGED

========================================================================



25.11.1 Purpose



COMMUNICATION\_LOGGED records that a communication with a

debtor was logged on a device.



Communication content is immutable after creation in the MVP.

A communication is not modified after creation. A

communication entity may receive a deletion tombstone through

a separate ENTITY\_UPDATED event that sets `deleted` to true on

the communication row.



25.11.2 Allowed Entity Type



entity\_type MUST be 0x04 (communication).



25.11.3 Payload Wire Format



The payload is a TLV-encoded structure. Its TLV type codes:



&#x20; +--------------------------+-----------+

&#x20; | field                    | type code |

&#x20; +--------------------------+-----------+

&#x20; | debtor\_id                | 0x5001    |

&#x20; | communication\_type       | 0x5002    |

&#x20; | direction                | 0x5003    |

&#x20; | content                  | 0x5004    |

&#x20; | duration                 | 0x5005    |

&#x20; +--------------------------+-----------+



The field debtor\_id is a UTF-8 string, length-prefixed.



The field communication\_type is a UTF-8 string, length-

prefixed. One of CALL, EMAIL, SMS, NOTE.



The field direction is a UTF-8 string, length-prefixed. One

of INBOUND, OUTBOUND.



The field content is a UTF-8 string, length-prefixed. It may

be empty.



The field duration is a UTF-8 string, length-prefixed,

containing a canonical non-negative decimal integer:



\- ASCII digits only.

\- At least one digit.

\- No leading zeros, except that the value zero itself is "0".

\- No sign, no decimal point, no whitespace.



Examples:



&#x20; 0       valid

&#x20; 1       valid

&#x20; 60      valid

&#x20; 3600    valid



&#x20; 00      invalid (leading zero)

&#x20; 01      invalid (leading zero)

&#x20; +1      invalid (sign)

&#x20; -1      invalid (sign)

&#x20; 1.0     invalid (decimal point)



It is present only when communication\_type is CALL and the

duration is known. It may be absent.



Required fields: debtor\_id, communication\_type, direction,

content.



Optional fields: duration.



Field order is fixed: debtor\_id, communication\_type,

direction, content, duration.



25.11.4 Validation



An event is valid if:



\- entity\_type is 0x04 (communication).

\- The payload is valid TLV.

\- debtor\_id is present, non-empty, valid UTF-8.

\- communication\_type is present and one of CALL, EMAIL, SMS,

&#x20; NOTE.

\- direction is present and one of INBOUND, OUTBOUND.

\- content is present, valid UTF-8. It may be empty.

\- If duration is present, communication\_type MUST be CALL,

&#x20; and duration MUST be a canonical non-negative decimal

&#x20; integer as defined in Section 25.11.3.

\- The entity\_id is present and non-empty.

\- No other payload fields are present.



A payload that fails any check is an EVENT\_ERROR.



25.11.5 Application Transaction



When a COMMUNICATION\_LOGGED event is applied:



1\. Determine whether a communication row with this entity\_id

&#x20;  already exists in the local communications table.



&#x20;  a. If the row does not exist:



&#x20;     Verify that the debtor referenced by debtor\_id exists

&#x20;     locally. If it does not, the event is pending. Recorded

&#x20;     in pending\_events with depends\_on\_entity\_type = 0x01

&#x20;     (debtor) and depends\_on\_entity\_id = debtor\_id.



&#x20;     If the debtor exists, insert a new communication row

&#x20;     with:



&#x20;       id = entity\_id

&#x20;       debtor\_id = payload.debtor\_id

&#x20;       type = payload.communication\_type

&#x20;       direction = payload.direction

&#x20;       content = payload.content

&#x20;       duration = payload.duration, or the database NULL

&#x20;                  representation defined in Section 25.13

&#x20;                  when the field is absent

&#x20;       created\_by = attribution per Section 25.13

&#x20;       created\_at = event.created\_at



&#x20;     For each field set by this event, write a row in

&#x20;     entity\_field\_state recording this event as the current

&#x20;     winner.



&#x20;  b. If the row already exists, this is a concurrent

&#x20;     creation of the same entity\_id. The fields set by the

&#x20;     two events are reconciled using the algorithm in

&#x20;     Section 25.9.9. This is an edge case; in normal

&#x20;     operation, the same communication is never created

&#x20;     twice with the same entity\_id.



2\. Write an entry to the application audit log.



3\. Advance the logical clock.



4\. Append the event to sync\_events.



Steps 1 through 4 are one transaction.



25.11.6 Conflict and Reconciliation Behavior



Communication content is append-only. Two

COMMUNICATION\_LOGGED events with different entity\_ids are two

distinct communications, both preserved. Two with the same

entity\_id are reconciled using the algorithm in Section

25.9.9.



Deletion is a separate ENTITY\_UPDATED event that sets

`deleted` to true.



25.11.7 History



For the edge case of same-entity\_id concurrent creation,

history\_records gets rows for each field that conflicts, as

in Section 25.9.7.



For normal operation (distinct entity\_ids), there is no

conflict and no history record.



25.11.8 Failure Behavior



If COMMUNICATION\_LOGGED fails validation, the outcome is

EVENT\_ERROR.



If COMMUNICATION\_LOGGED references a debtor that does not yet

exist locally, it is not rejected. It is accepted and made

pending.



If the payload contains a field type code not listed in

Section 25.11.3, the outcome is PROTOCOL\_ERROR with code

UNKNOWN\_FIELD\_TYPE (0x010D).



========================================================================

25.12 THE RECEIVING PIPELINE

========================================================================



This section states the complete sequence a receiving device

follows when it processes a SYNC\_MESSAGE from a peer. It ties

together Sections 15 (duplicate detection), 16

(acknowledgements), 18 (delivery bookkeeping), 22 (wire format),

23 (corruption and tampering), and 25.4 through 25.9 (database

application).



The pipeline is normative. An implementation MUST follow the

ordering. The ordering matters because some steps must complete

before an event is allowed to affect local state.



25.12.1 The Pipeline in Full



When a peer receives a SYNC\_MESSAGE, it processes it in this

order:



1\. Receive the message bytes.



2\. Validate the outer TLV framing:

&#x20;  - The bytes are valid TLV.

&#x20;  - The type code is 0x0010 (SYNC\_MESSAGE).

&#x20;  - The declared length matches the bytes received.

&#x20;  - The length does not exceed the maximum.



&#x20;  Failure at this step: SESSION\_ERROR (Section 23.2),

&#x20;  error code ENVELOPE\_MALFORMED (0x0002) or MESSAGE\_TOO\_LARGE

&#x20;  (0x0003). No SYNC\_ACK. The session may be closed.



3\. AEAD-decrypt and authenticate the message with the session

&#x20;  key:

&#x20;  - The nonce is 24 bytes.

&#x20;  - The ciphertext + 16-byte tag are present.

&#x20;  - The AAD is the 6-byte outer TLV header.

&#x20;  - AEAD authentication succeeds.



&#x20;  Failure at this step: SESSION\_ERROR, error code

&#x20;  AEAD\_AUTHENTICATION\_FAILED (0x0001) or

&#x20;  SESSION\_KEY\_UNAVAILABLE (0x0004). No SYNC\_ACK. The session

&#x20;  may be closed.



4\. Validate the inner TLV structure:

&#x20;  - The decrypted plaintext is valid TLV.

&#x20;  - The required fields (message\_id, event\_count, events) are

&#x20;    present.

&#x20;  - Each is singular (message\_id, event\_count) or repeatable

&#x20;    (events) as defined.

&#x20;  - Fields appear in the defined order.

&#x20;  - No unknown field type codes are present.

&#x20;  - message\_id is exactly 16 bytes.

&#x20;  - event\_count matches the number of event records.



&#x20;  Failure at this step: PROTOCOL\_ERROR (Section 23.3). No

&#x20;  SYNC\_ACK. The session may be closed.



5\. For each event record in the message, in the order they

&#x20;  appear:



&#x20;  a. Validate the event record's structure:

&#x20;     - The event record is valid TLV.

&#x20;     - Required event fields are present.

&#x20;     - Fields appear in the defined order.

&#x20;     - Fixed-size fields are the correct size.

&#x20;     - No unknown field type codes are present.

&#x20;     - The event\_type is in the supported set.

&#x20;     - The entity\_type is in the MVP-supported set

&#x20;       (Section 25.9.2).



&#x20;     Failure for this event: the event is individually

&#x20;     invalid. It will receive a REJECTED outcome in the

&#x20;     SYNC\_ACK. Continue to the next event.



&#x20;  b. Check the event\_id against sync\_events (duplicate

&#x20;     detection, Section 15).



&#x20;     If the event\_id is present: the event is a duplicate.

&#x20;     It receives a DUPLICATE outcome. No state change. No

&#x20;     logical clock advancement. Continue to the next event.



&#x20;  c. Validate the event's semantic content:

&#x20;     - The payload matches the event\_type's schema

&#x20;       (Section 25.8 through 25.11).

&#x20;     - Field values are valid for their fields (per

&#x20;       Section 25.13).

&#x20;     - No semantic violations (for example, deleted = false).



&#x20;     Failure for this event: EVENT\_ERROR (Section 23.4). The

&#x20;     event receives a REJECTED outcome. Continue to the next

&#x20;     event.



&#x20;  d. Check whether the event's prerequisite entity exists

&#x20;     locally:

&#x20;     - For DEBTOR\_CREATED: the debtor is being created by

&#x20;       this event; no prerequisite.

&#x20;     - For ENTITY\_UPDATED: the target entity must exist.

&#x20;     - For ACTION\_CREATED: the referenced debtor must

&#x20;       exist.

&#x20;     - For COMMUNICATION\_LOGGED: the referenced debtor must

&#x20;       exist.



&#x20;     If the prerequisite does not exist: the event is

&#x20;     ACCEPTED and made PENDING. It is appended to

&#x20;     sync\_events, its logical clock advancement happens

&#x20;     (Section 12.3, Rule 2), and its domain effect is

&#x20;     deferred. It is recorded in pending\_events with reason

&#x20;     ENTITY\_NOT\_YET\_PRESENT and the dependency fields set.

&#x20;     It receives an ACCEPTED outcome. Continue to the next

&#x20;     event.



&#x20;  e. Apply the event:

&#x20;     - Append it to sync\_events.

&#x20;     - Advance the logical clock (Section 12.3, Rule 2).

&#x20;     - Apply its domain effect to the state tables

&#x20;       (Sections 25.8 through 25.11).

&#x20;     - Record losing values in history\_records

&#x20;       (Section 13.3).

&#x20;     - Update entity\_field\_state (Section 25.9.9).

&#x20;     - Write an entry to the application audit log.

&#x20;     - The event receives an ACCEPTED outcome.



6\. Commit the transaction that contains all of the events in

&#x20;  this message. If the transaction fails, no event from this

&#x20;  message is applied. The receiver may send an ERROR with

&#x20;  class INTERNAL\_ERROR (Section 23.6).



7\. Send the SYNC\_ACK:

&#x20;  - acknowledged\_message\_id = the message\_id from step 4.

&#x20;  - outcome\_count = the number of events.

&#x20;  - One outcome record per event, in the order the events

&#x20;    appeared: ACCEPTED, DUPLICATE, or REJECTED.



&#x20;  The SYNC\_ACK is itself a message with type 0x0011,

&#x20;  AEAD-encrypted with the session key.



The order is important. Specifically:



\- Duplicate detection happens before semantic validation and

&#x20; before prerequisite checking. This is deliberate: a

&#x20; duplicate event is a no-op, and it should not be

&#x20; re-validated or re-examined.

\- Prerequisite checking happens before application. An event

&#x20; whose prerequisite does not exist becomes pending, not

&#x20; rejected.

\- Application happens per event. If event 3 of 5 fails

&#x20; semantic validation, events 1, 2, 4, and 5 are still

&#x20; processed. The message is not rejected as a whole.



25.12.2 Distinguishing the Outcomes



The pipeline distinguishes five outcomes for an event:



1\. Message-level failure: SESSION\_ERROR or PROTOCOL\_ERROR.

&#x20;  The whole message is rejected. No SYNC\_ACK. No event is

&#x20;  processed.



2\. Event-level structural failure: EVENT\_ERROR. The message is

&#x20;  processed; this event receives a REJECTED outcome; other

&#x20;  events are unaffected.



3\. Event-level semantic failure: EVENT\_ERROR. Same handling.



4\. Duplicate: DUPLICATE outcome. No state change.



5\. Accepted: ACCEPTED outcome. Two sub-cases:

&#x20;  - Accepted and applied: the event's domain effect was

&#x20;    applied in this transaction.

&#x20;  - Accepted and pending: the event's domain effect is

&#x20;    deferred until its prerequisite becomes available.



In all accepted cases, the event is durably in sync\_events,

and the logical clock has advanced.



The pending-event lifecycle:



An accepted pending event remains in pending\_events until

its prerequisite becomes available. When the prerequisite

becomes available, the implementation MUST re-attempt

application of the pending event using the same database

application and reconciliation rules defined in Sections

25.8 through 25.11. The event is not inserted into

sync\_events a second time and is not acknowledged a second

time.



The implementation MUST provide a deterministic trigger

for re-attempting pending events when their prerequisites

become available. The trigger mechanism is local

implementation detail and does not alter the event

protocol. A common implementation approach is to

re-attempt applicable pending events at the end of the

acceptance transaction that created the prerequisite. This

is not the only valid approach; the protocol does not

mandate the specific mechanism, only that re-attempting

happens deterministically and produces the state described

in Sections 25.7.5 through 25.7.7.



25.12.3 What the Pipeline Does Not Do



The pipeline does not:



\- Apply events out of order. Each event in the message is

&#x20; processed in the order it appears in the message.

\- Re-order events before applying. The order in the message

&#x20; is the order of processing. (The final state is

&#x20; order-independent because of the protocol-order

&#x20; reconciliation in Section 25.9.9, but the processing order

&#x20; is the message order.)

\- Reject the whole message because one event is invalid.

\- Send per-event acknowledgements. It sends one SYNC\_ACK per

&#x20; message.

\- Retry events internally. Retry is a sender concern

&#x20; (Section 18.6).



25.12.4 Message-Level Failure vs. Event-Level Failure



For clarity, restating the distinction, using the exact error

class and code terminology from Section 23:



\- A message-level failure is either a SESSION\_ERROR

&#x20; (Section 23.2) or a PROTOCOL\_ERROR (Section 23.3). It

&#x20; means the receiver could not process the message at all.

&#x20; No SYNC\_ACK is sent. The sender will retry according to

&#x20; Section 18.6.



&#x20; SESSION\_ERROR codes relevant to this pipeline:

&#x20; - 0x0001 AEAD\_AUTHENTICATION\_FAILED

&#x20; - 0x0002 ENVELOPE\_MALFORMED

&#x20; - 0x0003 MESSAGE\_TOO\_LARGE

&#x20; - 0x0004 SESSION\_KEY\_UNAVAILABLE



&#x20; PROTOCOL\_ERROR codes relevant to this pipeline:

&#x20; - 0x0101 INNER\_NOT\_TLV

&#x20; - 0x0102 MISSING\_REQUIRED\_FIELD

&#x20; - 0x0103 DUPLICATE\_SINGULAR\_FIELD

&#x20; - 0x0104 FIELD\_ORDER\_VIOLATION

&#x20; - 0x0105 FIELD\_SIZE\_MISMATCH

&#x20; - 0x0106 INVALID\_UTF8

&#x20; - 0x0107 NONCANONICAL\_INTEGER

&#x20; - 0x0108 UNKNOWN\_MESSAGE\_TYPE

&#x20; - 0x0109 UNSUPPORTED\_PROTOCOL\_VERSION

&#x20; - 0x010A MESSAGE\_CONSTRAINT\_VIOLATION

&#x20; - 0x010B PADDING\_PRESENT

&#x20; - 0x010C UNKNOWN\_EVENT\_TYPE

&#x20; - 0x010D UNKNOWN\_FIELD\_TYPE



\- An event-level failure is an EVENT\_ERROR (Section 23.4).

&#x20; It means the message was processed, but an individual

&#x20; event within it was invalid. The receiver sends a SYNC\_ACK

&#x20; with a REJECTED outcome for that event. The sender treats

&#x20; REJECTED as terminal (Section 22.14.4); it does not retry

&#x20; the event.



&#x20; EVENT\_ERROR codes relevant to this pipeline:

&#x20; - 0x0201 EVENT\_PAYLOAD\_INVALID

&#x20; - 0x0202 EVENT\_ENTITY\_REFERENCE\_INVALID

&#x20; - 0x0203 EVENT\_FIELD\_INVALID

&#x20; - 0x0204 EVENT\_SEMANTIC\_INVALID



This distinction is consistent with Sections 16.2 and 23.



========================================================================
25.13 FIELD-SEMANTICS SPECIFICATION
========================================================================

This section is the authoritative field-semantics specification
for the MVP sync protocol. It defines, for every synchronized
entity, every field that crosses the wire: its wire type, its
database representation, its mutability, its nullability, its
canonical form, and whether it may appear in an ENTITY_UPDATED
event.

It is the definitive reference for the field-name-to-column
mapping. Any implementation that disagrees with this section is
wrong, unless this section is itself wrong against Section 25.8
through Section 25.11 (the event payload definitions) or against
LOCAL-TABLES.md v1.2 (the physical schema). Where this section and
those disagree, this section is corrected.

It does not change the wire format. The wire format is Section 22.
It does not add event types or entity types. The event set is
Section 9.2. The entity set is Section 25.9.2. It does not change
the reconciliation algorithm. That is Section 13 and Section
25.9.9. It defines the semantics of the fields the protocol already
has. It is a specification of what exists.

------------------------------------------------------------------------
25.13.1 The Field Classification Table
------------------------------------------------------------------------

This subsection lists every field of every synchronized entity.
For each field, one row. The columns are:

  wire_name         The exact field name used in the canonical
                    wire payload (Section 22).
  db_column         The column name in the local SQLite table.
  wire_type         The wire type: string, integer, json, or
                    bytes.
  db_type           The SQLite type: TEXT, INTEGER, BLOB.
  mut               Mutable after creation? yes / no / one-way.
  upd               Usable in ENTITY_UPDATED? yes / no.
  nul               Protocol-level nullable? yes / no.
  ref               Reference semantics: none, or the target
                    entity type.

The column nul describes protocol-level nullability. A value of
"yes" means the field may be absent or null on the wire, as
defined in the NULL/empty/JSON-null matrix in Section 25.13.3. A
value of "no" means the field is required on the wire whenever
the entity type permits it.

Physical SQLite nullability is defined in LOCAL-TABLES.md and
may differ from protocol-level nullability for legacy columns
that predate the sync protocol. Where the two differ, the
protocol definition governs wire behavior, and the SQLite column
may be nullable for backward compatibility.

Entity: debtor (entity_type = 0x01)

  wire_name   db_column    wire_type  db_type  mut      upd  nul  ref
  ---------   ----------   ---------  -------  -------  ---  ---  -----
  name        name         string     TEXT     yes      yes  no   none
  surname     surname      string     TEXT     yes      yes  no   none
  email       email        string     TEXT     yes      yes  yes  none
  phone       phone        string     TEXT     yes      yes  yes  none
  data_json   data         json       TEXT     yes      yes  no   none
  deleted     deleted      string     TEXT     one-way  yes  no   none

Notes:

- `deleted` is a one-way mutable field. It can be set from false
  to true. It can never be set from true to false. See Section
  25.9.9, step 8. Its wire representation is the string "true".
  Its database representation is the TEXT value "true" or "false",
  or the SQLite INTEGER 1 / 0 depending on how the state table
  was defined. LOCAL-TABLES.md A.1 does not currently list a
  `deleted` column; the amendment pass adds it.

- `data_json` is the canonical JSON string (Section 25.13.4). On
  the wire, it is a UTF-8 string. In the database, it is the
  `data` column of type TEXT, holding the canonical JSON form.

- `created_at` and `updated_at` are NOT carried in the wire
  payload. They are derived locally (Section 25.13.10). They do
  not appear in the field table because they are not wire fields.

Entity: action (entity_type = 0x03)

  wire_name   db_column    wire_type  db_type  mut      upd  nul  ref
  ---------   ----------   ---------  -------  -------  ---  ---  -----
  debtor_id   debtor_id    string     TEXT     no       no   no   debtor
  action_type type         string     TEXT     yes      yes  no   none
  status      status       string     TEXT     yes      yes  no   none
  assigned_to assigned_to  string     TEXT     yes      yes  yes  none
  due_date    due_date     string     TEXT     yes      yes  yes  none
  description description  string     TEXT     yes      yes  yes  none
  data_json   data         json       TEXT     yes      yes  no   none
  deleted     deleted      string     TEXT     one-way  yes  no   none

Notes:

- `debtor_id` is a reference field. It is immutable after
  creation. It cannot be reassigned by an ENTITY_UPDATED. See
  Section 25.13.8.
- `action_type` is the wire field name. The database column is
  `type`. The mapping is exact: wire `action_type` → column
  `type`.
- `deleted` behaves as in the debtor entity.

Entity: communication (entity_type = 0x04)

  wire_name            db_column    wire_type  db_type  mut      upd  nul  ref
  ------------------   ----------   ---------  -------  -------  ---  ---  -----
  debtor_id            debtor_id    string     TEXT     no       no   no   debtor
  communication_type   type         string     TEXT     no       no   no   none
  direction            direction    string     TEXT     no       no   no   none
  content              content      string     TEXT     no       no   yes  none
  duration             duration     string     TEXT     no       no   yes  none
  created_by           created_by   string     TEXT     no       no   yes  user
  deleted              deleted      string     TEXT     one-way  yes  no   none

Notes:

- `communication_type` is the wire field name. The database column
  is `type`. The mapping is exact: wire `communication_type` →
  column `type`. This differs from action's wire field name
  (`action_type`), which also maps to `type`. The wire names
  differ by entity; the column name is the same.

- Communication content is immutable after creation. It cannot be
  changed by an ENTITY_UPDATED. Correction is a new communication
  plus a soft-delete of the old one. See Section 25.11.6.

- `created_by` is carried in the encrypted event payload. See
  Section 25.13.9.

- `deleted` behaves as in the debtor entity. A communication may
  be soft-deleted via an ENTITY_UPDATED that sets `deleted` to
  "true".

Note on the deleted field:

The `deleted` field is not present in creation events
(DEBTOR_CREATED, ACTION_CREATED, COMMUNICATION_LOGGED). Its only
MVP wire representation is an ENTITY_UPDATED change record that
sets the field to the string "true". It is monotonic (Section
25.9.9, step 8). It cannot be set back to "false".

------------------------------------------------------------------------
25.13.2 Field Types and Lengths
------------------------------------------------------------------------

For every wire field:

  name                 Max length 128 UTF-8 bytes. Required.
                       Non-empty.
  surname              Max length 128 UTF-8 bytes. Required.
                       Non-empty.
  email                Max length 254 UTF-8 bytes. Optional. May
                       be empty only if absent; if present and
                       non-null, must be non-empty. (An empty
                       email is invalid.)
  phone                Max length 32 UTF-8 bytes. Optional. May
                       be empty only if absent; if present and
                       non-null, must be non-empty.
  data_json            UTF-8. Subject to the canonical JSON rules
                       in Section 25.13.4. Maximum 1 MiB after
                       canonical serialization. If the canonical
                       form exceeds 1 MiB, the event is rejected
                       with EVENT_ERROR / EVENT_PAYLOAD_INVALID.
  debtor_id            Max length 64 UTF-8 bytes. Required for
                       action and communication. Non-empty.
  action_type          Enumeration. See Section 25.13.7.
  status               Enumeration. See Section 25.13.7.
  assigned_to          Max length 64 UTF-8 bytes. Optional. If
                       present and non-null, must be non-empty.
  due_date             Date-only. See Section 25.13.5.
  description          Max length 4096 UTF-8 bytes. Optional.
  communication_type   Enumeration. See Section 25.13.7.
  direction            Enumeration. See Section 25.13.7.
  content              Max length 65536 UTF-8 bytes. Optional.
                       May be empty.
  duration             Canonical non-negative decimal integer.
                       See Section 25.13.6.
  created_by           Max length 64 UTF-8 bytes. Required for
                       COMMUNICATION_LOGGED. See Section 25.13.9.
  deleted              The literal string "true". No other value
                       is accepted. See Section 25.9.4.

Length limits are in bytes of the UTF-8 encoding, not in
characters. A string that is within the character limit but
exceeds the byte limit is rejected with EVENT_ERROR /
EVENT_FIELD_INVALID.

------------------------------------------------------------------------
25.13.3 NULL, Empty, and JSON-Null Semantics
------------------------------------------------------------------------

The wire format distinguishes five states for a field. Each is
represented differently, and each has a specific meaning.

  State             Wire representation
  ----------------  --------------------------------------------
  absent            The field's TLV record is not present.
  null              The field's TLV record is present with a
                    zero-length value.
  empty string      The field's TLV record is present with a
                    UTF-8 length-prefixed empty string (length 0,
                    no bytes). This is distinct from null only
                    if the field's definition permits both.
  JSON null         A string containing the JSON literal "null".
                    Only meaningful inside data_json.
  empty JSON        A string containing the canonical JSON "{}".
  object            Only meaningful inside data_json.

Which states are valid per field:

  Field         absent  null  empty-string  JSON-null  JSON-{}
  ------------  ------  ----  ------------  ---------  -------
  name          no      no    no            n/a        n/a
  surname       no      no    no            n/a        n/a
  email         yes     yes   no            n/a        n/a
  phone         yes     yes   no            n/a        n/a
  data_json     yes     no    yes (={})     yes        yes
  debtor_id     no      no    no            n/a        n/a
  action_type   no      no    no            n/a        n/a
  status        no      no    no            n/a        n/a
  assigned_to   yes     yes   no            n/a        n/a
  due_date      yes     yes   no            n/a        n/a
  description   yes     yes   yes           n/a        n/a
  communication_type  no  no  no            n/a        n/a
  direction     no      no    no            n/a        n/a
  content       no      yes   yes           n/a        n/a
  duration      yes     yes   no            n/a        n/a
  created_by    no      no    no            n/a        n/a
  deleted       no      no    no (only     n/a        n/a
                              "true")

The "n/a" entries mean the state is not applicable: the field is
a string, not a JSON value, so JSON-null and JSON-{} have no
meaning for it.

Database representation:

  absent             SQL NULL for nullable fields. For non-
                     nullable fields, absence is a protocol
                     violation (the field is required).
  null               SQL NULL.
  empty string       SQL empty string ''.
  JSON null          The string "null" stored in the TEXT column.
  empty JSON object  The string "{}" stored in the TEXT column.

The distinction between SQL NULL and empty string is preserved in
SQLite, so a round-trip through the database preserves the wire
distinction.

Reconciliation treats SQL NULL, empty string, and the JSON-null
literal as three distinct values. They are never equal to each
other for the purpose of conflict resolution. If a field's
current value is SQL NULL and an incoming event sets it to empty
string, that is a change, and the reconciliation algorithm applies
normally.

For the `deleted` field, only the string "true" is valid. The
states absent, null, empty string, and any other literal are
rejected with EVENT_ERROR / EVENT_SEMANTIC_INVALID.

------------------------------------------------------------------------
25.13.4 Canonical JSON
------------------------------------------------------------------------

The canonical JSON serialization used for the `data_json` field
is RFC 8785, the JSON Canonicalization Scheme (JCS).

Section 25.13 adopts RFC 8785 in full for:
- object key ordering (sorted by UTF-16 code units);
- whitespace (none outside of strings);
- string escaping (minimal, per RFC 8785 §3.2.2.2);
- Unicode handling (no normalization; strings are preserved
  as-is);
- the JSON literals `true`, `false`, `null` (lowercase);
- arrays and nested objects (recursively canonicalized).

GORKA-specific input restriction:

  Before RFC 8785 canonicalization, GORKA restricts the JSON
  number domain that may appear in data_json as follows.

  JSON numbers inside data_json MUST be integers in the range
  [-(2^53 - 1), 2^53 - 1]. An integer outside this range MUST
  be encoded as a canonical decimal string.

  JSON numbers with a fractional part or an exponent MUST NOT
  appear in data_json. Business and financial decimal values
  MUST be represented as canonical decimal strings, never as
  JSON floating-point numbers.

The reason for the GORKA-specific number restriction: financial
values must not lose precision. JSON's number type is a
double-precision floating-point value in the specification, and
its decimal representation is not unique across implementations.
Encoding decimals as strings preserves both precision and
determinism.

Canonical decimal string form is defined in Section 25.13.6.

Invalid or non-canonical data_json:

- A data_json payload whose string does not parse as JSON.
- A data_json payload whose canonical form differs from the
  bytes on the wire (for example, containing insignificant
  whitespace or unsorted keys).
- A data_json payload containing a JSON number with a fractional
  part, an exponent, or an integer outside the representable
  range.
- A data_json payload containing a decimal value not encoded as
  a canonical decimal string.

Each of these is rejected with EVENT_ERROR / EVENT_FIELD_INVALID.

A payload whose data_json is absent is valid. The database stores
the empty JSON object, canonical form "{}". Absence and "{}" are
considered equivalent for `data_json` only; the semantic effect is
the same.

------------------------------------------------------------------------
25.13.5 Canonical Date-Time
------------------------------------------------------------------------

Date-time fields in the MVP are date-only. The only such field is
action.due_date.

Canonical date-only form:

  YYYY-MM-DD

  YYYY   four ASCII digits, year.
  MM     two ASCII digits, month, 01 to 12.
  DD     two ASCII digits, day, 01 to 31, valid for the month and
         year.

Examples:

  2026-09-20
  2026-01-01
  2027-12-31

Non-canonical or invalid forms (all rejected with EVENT_ERROR /
EVENT_FIELD_INVALID):

  2026-9-20          no leading zero
  26-09-20           two-digit year
  2026/09/20         wrong separator
  2026-09-20T00:00Z  time component
  2026-09-20 00:00   time component
  2026-09-20Z        zone suffix

The value has no time zone. It is a business calendar date, not an
instant in time. The client interprets it as the date in the
organization's local business time zone, which is not carried on
the wire and is not part of the sync protocol.

No normalization is performed. The date is stored and compared as
the exact string.

Future fields that represent actual moments in time (timestamps)
will use a separate rule, based on RFC 3339, with UTC required and
fractional seconds disallowed. That rule is not part of the MVP.
This subsection defines only the date-only form for action.due_date.

------------------------------------------------------------------------
25.13.6 Canonical Decimal
------------------------------------------------------------------------

Canonical decimal strings are used for:

- The `duration` field of COMMUNICATION_LOGGED. This is always a
  non-negative integer, so it uses the integer subset of the
  canonical decimal form.
- Any decimal value inside `data_json` that is not an integer in
  the representable range. This includes monetary amounts and any
  other value with a fractional component.

Canonical decimal string form:

  - ASCII digits only. No other Unicode digits.
  - At least one digit.
  - Optional single leading minus sign "-" for negative values.
    The MVP does not currently use negative decimals, but the form
    permits them for future fields.
  - No leading zeros. The value zero is written as "0". A value
    such as 007 is invalid; write "7".
  - Optional single decimal point ".".
  - If a decimal point is present, at least one digit follows it.
  - No trailing zeros after the decimal point, unless the entire
    fractional part is zero, in which case no decimal point is
    present. For example, "1.5" is valid; "1.50" and "1.500" are
    invalid; "1.0" is invalid and must be written as "1".
  - No exponent notation. Write "1000000", not "1e6".
  - No thousands separators.
  - No currency symbols, percent signs, or other non-numeric
    characters.
  - No whitespace.

Examples of canonical decimals:

  0
  1
  60
  3600
  125000
  125000.5
  -42
  -42.75

Examples of non-canonical decimals:

  00          leading zero
  01          leading zero
  007         leading zeros
  1.50        trailing zero in fractional part
  1.0         trailing zero in fractional part
  +1          leading plus sign
  1e6         exponent notation
  1,000       thousands separator
  125 000     whitespace
  ₱125000     currency symbol
  .5          no integer digit
  1.          decimal point with no fractional digit

The `duration` field uses the canonical integer form (no sign, no
decimal point): "0", "1", "60", "3600". Negative duration is
invalid. Fractional duration is invalid.

Canonical decimals are stored as TEXT. They are compared as
strings for equality after canonicalization. Since canonical form
is unique, string equality of two canonical decimals is
equivalent to numeric equality of the values they represent.

Within `data_json`, a decimal value must be encoded as a JSON
string, not as a JSON number. For example:

  {"debt_amount": "125000.50"}

Not:

  {"debt_amount": 125000.50}

The second form is rejected with EVENT_ERROR /
EVENT_FIELD_INVALID, because JSON numbers with fractional parts
are forbidden inside data_json (Section 25.13.4).

------------------------------------------------------------------------
25.13.7 Enum Values
------------------------------------------------------------------------

Enumerated fields accept only the exact string values listed
below. Any other value is rejected with EVENT_ERROR /
EVENT_FIELD_INVALID.

action.action_type (wire field name action_type):

  CALL
  EMAIL
  SMS
  VISIT
  LETTER
  TASK
  LEGAL

action.status (wire field name status):

  PENDING
  IN_PROGRESS
  COMPLETED
  CANCELLED

communication.communication_type (wire field name
communication_type):

  CALL
  EMAIL
  SMS
  NOTE

communication.direction (wire field name direction):

  INBOUND
  OUTBOUND

Enum values are case-sensitive. "Call", "call", and "CALL" are
distinct; only "CALL" is valid for action.action_type. The values
are stored as the exact strings. They are not normalized.

The MVP uses a fixed, closed set for each enumeration. Adding a
value to any of these sets is a protocol change. Section 24
defines how protocol changes are made. It is not done by an
implementation without an amendment to this section.

------------------------------------------------------------------------
25.13.8 Reference-Field Rules
------------------------------------------------------------------------

Two fields are reference fields in the MVP:

  action.debtor_id         references a debtor entity
  communication.debtor_id  references a debtor entity

Both are subject to the following rules.

Immutability. A reference field is immutable after creation. It is
set by DEBTOR_CREATED (for the debtor itself), ACTION_CREATED, or
COMMUNICATION_LOGGED, and it cannot be changed afterward. Any
ENTITY_UPDATED event whose payload includes a change record for
`debtor_id` is rejected with EVENT_ERROR /
EVENT_FIELD_INVALID. There is no reassignment operation in the
MVP.

Prerequisite. The referenced debtor entity must exist locally
before the referencing event is applied. If it does not exist, the
event is accepted and made pending (Section 14.5 and Section
25.7.5). It is not rejected. It is applied as soon as the debtor
entity becomes available.

Reference semantics. A reference field carries the entity_id of
the referenced debtor. It is a string of up to 64 UTF-8 bytes. It
is not a foreign key at the wire level; the wire carries the
entity_id directly. In the database, the reference is enforced as
a foreign key by SQLite (see LOCAL-TABLES.md Category A.2 and
A.5 for the FK definitions).

Cross-organization references. The referenced entity must belong
to the same organization. Because the receiving device belongs to
exactly one organization (Section 3), and events from a different
organization are rejected at handshake time (Section 8.3), a
cross-organization reference cannot occur in normal operation. If
an event arrives whose reference target does not exist and never
will (for example, because the referenced entity was deleted in
the past), the event remains pending indefinitely. See Section 27,
Scenario 12.

Future reference fields will follow the same three rules:
immutability, prerequisite, entity_id reference. This subsection
defines the MVP's two reference fields. The rules apply to any
additional reference field introduced in the funded phase without
changing the wire format.

------------------------------------------------------------------------
25.13.9 Attribution — created_by
------------------------------------------------------------------------

The `created_by` field carries the stable user_id of the
authenticated user who originated the business event.

It is present only in COMMUNICATION_LOGGED in the MVP. It is not
present in DEBTOR_CREATED, ENTITY_UPDATED, or ACTION_CREATED. The
same principle applies to action attribution in the funded phase,
if an action attribution field is added; it will use the same
source and the same semantics.

Source. `created_by` is set by the originating device at the
moment the event is originated. Its value is the user_id of the
authenticated user whose session originated the event. The
user_id is stable: it is the same value on every device in the
organization, and it does not change when the user's email or
display name changes.

The value is NOT derived from:

  - The email address of the user.
  - The display name of the user.
  - The name of the device.
  - The receiving device's current JWT.
  - The Control Plane's current view of the user.

The value is carried inside the encrypted event payload as a
UTF-8 string. It travels end to end with the event. The receiving
device stores it as-is in the local communications table's
created_by column. It never consults the Control Plane to resolve
it, because doing so would give different results on different
devices if the Control Plane's view changed after the event was
originated.

Distinction from device_id. `device_id` and `created_by` are
different fields with different meanings:

  device_id    the device instance that originated the event
               on the wire. Every event has one.
  created_by   the authenticated user whose business action is
               recorded by the event. Only communication events
               have one in the MVP.

Both are carried in the encrypted payload. Neither is derived from
the other. A single user may originate events from multiple
devices; a single device may be used by multiple users over time.
The two fields are preserved independently.

No use for authentication or ordering. `created_by` is
informational. It is not used for event authentication, event
ordering, duplicate detection, or reconciliation. Those are
governed by the event_id, the sequence number, the logical clock,
and the device_id. Any implementation that uses `created_by` for
those purposes is incorrect.

Missing or unresolvable attribution. If the originating device
cannot determine the authenticated user_id at origination time
(for example, because the session has expired since the business
action was recorded), the event is not originated. The device
requires an authenticated session to originate any event. There
is no "unknown" value for `created_by`. This is because a
communication with no recorded author has no business meaning.

Protocol-level nullability. `created_by` is not nullable at the
protocol level. Every COMMUNICATION_LOGGED event carries it. Its
table entry (nul = yes) reflects physical SQLite nullability, not
protocol nullability. The column is nullable in the schema only
because it predates the sync protocol. See the note at the top of
Section 25.13.1.

Storage. `created_by` is stored as TEXT in the communications
table. Its column is `created_by`. It is nullable in the schema
for historical reasons, but in events generated under this
specification it is always present and non-empty.

------------------------------------------------------------------------
25.13.10 updated_at Semantics
------------------------------------------------------------------------

The `updated_at` field is local metadata. It is not carried on
the wire. It is not part of any event. It is not synchronized. It
is purely a display and diagnostic aid on the device that holds
the row.

When updated_at changes. The `updated_at` column of a state-table
row is set to the current local wall clock in two situations:

  1. When the device originates an event that creates or modifies
     the row. The new value is the local wall clock at the moment
     of the transaction.

  2. When the device accepts a peer event that modifies the row
     (including a peer event that wins a reconciliation, or that
     creates the row via a concurrent-creation reconciliation).
     The new value is the local wall clock at the moment of the
     accepting transaction on this device.

When updated_at does not change. `updated_at` is not changed by:

  - A duplicate event (Section 15.4).
  - A rejected event (Section 23.4).
  - A pending event that is accepted but not yet applied (Section
    14.5).
  - A pure read or query operation.

updated_at after deletion. If an ENTITY_UPDATED event sets
`deleted = true`, `updated_at` is set to the local wall clock of
that transaction, exactly as for any other applied change. There
is no special treatment.

What updated_at is NOT. `updated_at` MUST NOT participate in:

  - Reconciliation (Section 13, Section 25.9.9).
  - Conflict resolution.
  - Event ordering.
  - Duplicate detection.
  - Causal ordering.
  - Any protocol decision.

The authoritative order of events is `(logical_clock, device_id,
sequence)`, as defined in Section 12.6. Wall-clock time is not
used for any ordering or conflict decision. A device whose clock
is wrong still produces correct protocol behavior.

Replicas may differ. Two devices holding the same synchronized
logical state may have different `updated_at` values for the same
row. This is correct and expected. It is not divergence. The
logical state converges; the local `updated_at` is a local
artifact and does not need to converge.

Why this rule exists. Wall-clock time in a distributed system is
unreliable. Two devices' clocks may be skewed. A device's clock
may jump backward or forward. Using wall-clock time to decide
which value wins would make convergence depend on the clocks,
which the protocol does not trust. The protocol's deterministic
order is the logical clock and the tie-breakers defined in
Section 12. `updated_at` is deliberately outside that mechanism.

------------------------------------------------------------------------
25.13.11 Field-Name-to-Column Master Mapping
------------------------------------------------------------------------

This is the single authoritative table that maps every wire field
name, for every synchronized entity, to its local database column.

Entity: debtor (wire entity_type = 0x01)

  wire_name      db_table  db_column     wire_type  db_type  in upd
  ------------   --------  -----------   ---------  -------  ------
  name           debtors   name          string     TEXT     yes
  surname        debtors   surname       string     TEXT     yes
  email          debtors   email         string     TEXT     yes
  phone          debtors   phone         string     TEXT     yes
  data_json      debtors   data          json       TEXT     yes
  deleted        debtors   deleted       string     TEXT     yes

Entity: action (wire entity_type = 0x03)

  wire_name      db_table  db_column     wire_type  db_type  in upd
  ------------   --------  -----------   ---------  -------  ------
  debtor_id      actions   debtor_id     string     TEXT     no
  action_type    actions   type          string     TEXT     yes
  status         actions   status        string     TEXT     yes
  assigned_to    actions   assigned_to   string     TEXT     yes
  due_date       actions   due_date      string     TEXT     yes
  description    actions   description   string     TEXT     yes
  data_json      actions   data          json       TEXT     yes
  deleted        actions   deleted       string     TEXT     yes

Entity: communication (wire entity_type = 0x04)

  wire_name            db_table         db_column    wire_type  db_type  in upd
  ------------------   --------------   ----------   ---------  -------  ------
  debtor_id            communications   debtor_id    string     TEXT     no
  communication_type   communications   type         string     TEXT     no
  direction            communications   direction    string     TEXT     no
  content              communications   content      string     TEXT     no
  duration             communications   duration     string     TEXT     no
  created_by           communications   created_by   string     TEXT     no
  deleted              communications   deleted      string     TEXT     yes

Two naming collisions require attention:

1. Wire `action_type` and wire `communication_type` both map to a
   database column named `type`. This is because the columns are
   in different tables (actions vs communications) and the wire
   payloads use different field names to disambiguate the two
   entity types. An implementation MUST use the wire name when
   reading and writing the payload, and the column name when
   reading and writing the database.

2. Wire `data_json` maps to a database column named `data`. The
   wire type is `json` (a canonical JSON string). The database
   type is TEXT. The mapping is exact: the string stored is the
   canonical form, and no wrapping or unwrapping occurs during
   storage or transmission.

Fields in the state tables that are NOT on the wire:

  id             The entity's primary identifier. It is the
                 event's entity_id, carried in the event
                 envelope, not in the payload.

  organization_id  Local, from JWT. Not carried on the wire. The
                 organization is enforced by the handshake.

  created_at     Local wall clock of the originating event. Set
                 from the event's created_at envelope field. Not
                 in the payload.

  updated_at     Local wall clock of the last applied change. Not
                 on the wire. See Section 25.13.10.

  file_*         Document-specific fields in the documents table.
                 Documents are not synchronized in the MVP. See
                 Section 25.9.2.

  data columns   In some tables (debts, documents), the `data`
                 column exists but the entity is not synchronized
                 in the MVP. The mapping does not apply.

------------------------------------------------------------------------
25.13.12 What This Section Does Not Do
------------------------------------------------------------------------

This section does not:

- Change the wire format of any message or event. The wire format
  is Section 22. This section specifies the semantics of fields
  that Section 22 already defines.
- Add new event types. The event set is Section 9.2.
- Add new entity types. The synchronized entity set is Section
  25.9.2.
- Add new fields to any event. The fields are those defined in
  Section 25.8 through Section 25.11.
- Change the reconciliation algorithm. That is Section 13 and
  Section 25.9.9.
- Change the protocol order. That is Section 12.6.
- Change the invariant or the canonical promise. Those are in
  ARCHITECTURAL-LAW.md v1.3.
- Synchronize document content. That is a funded-phase item.
- Synchronize debt records. Those are local-only in the MVP.

This section is the reference for the field-level contract of the
MVP sync protocol. Implementations follow it. If an implementation
disagrees with this section, the implementation is corrected, or
this section is amended through the standard amendment process.


========================================================================
25.14 WHAT SECTION 25 DOES NOT DO

========================================================================



This section states the boundary of Section 25, so that no

future session reads more into it than it says.



Section 25 does not:



\- Introduce new event types. The MVP event set is four types

&#x20; (Section 9.2). Section 25 defines the payloads of those

&#x20; four. It does not add a fifth.

\- Introduce new synchronization entities. The synchronized

&#x20; entities are debtor, action, and communication (Section

&#x20; 25.9.2). Debt and document are local-only in the MVP.

\- Introduce new cryptographic mechanisms. The primitives are

&#x20; in Section 22.6.7. Section 25 uses them; it does not

&#x20; change them.

\- Introduce a new wire encoding. The wire format is in

&#x20; Section 22. Section 25 uses it; it does not add to it.

\- Introduce new ordering rules. The protocol order is

&#x20; (logical\_clock, device\_id, sequence) (Section 12.6).

&#x20; Section 25 uses it; it does not define an alternative.

\- Introduce a new conflict-resolution model. The model is in

&#x20; Sections 12, 13, and 14. Section 25 applies it to the local

&#x20; database.

\- Give the Control Plane access to debtor data. The invariant

&#x20; is unchanged. Section 25 is local-only: it defines what the

&#x20; device does with its own database. Nothing in Section 25

&#x20; causes any debtor data to reach the Control Plane.

\- Synchronize debt or document data. Those entities are

&#x20; local-only in the MVP (Section 25.9.2).

\- Authorize physical deletion of records. Deletion is a

&#x20; soft-delete marker (Section 14.5). Physical deletion is a

&#x20; funded-phase consideration.



Section 25 is the boundary between the event protocol and the

local database. It applies the protocol to the local schema. It

does not redefine either.



25.14.1 What Section 25 Relies On



Section 25 relies on, but does not redefine:



\- The event model (Section 9).

\- Event identity and uniqueness (Section 10).

\- Sequence numbers (Section 11).

\- Logical ordering and the protocol order (Section 12).

\- State reconciliation (Section 13).

\- Event reconciliation and deletion (Section 14).

\- Duplicate detection (Section 15).

\- Acknowledgements (Section 16).

\- The offline queue (Section 17).

\- Retry and recovery (Section 18).

\- The wire format (Section 22).

\- Failure classes (Section 23).

\- Protocol versioning (Section 24).



25.14.2 What Section 25 Requires of LOCAL-TABLES.md



Section 25 requires the local schema to support four new

tables, in addition to the tables already in LOCAL-TABLES.md

v1.2:



\- organization\_keys — the organization key storage.

&#x20; (Section 7.1)

\- history\_records — the losing-value records.

&#x20; (Section 25.7.1)

\- pending\_events — the pending event work queue.

&#x20; (Section 25.7.5)

\- entity\_field\_state — the current field winner metadata.

&#x20; (Section 25.9.9)



Their logical contents are defined in Section 25. Their

physical schema is recorded in the amendment pass.



Section 25 also requires the field-name-to-column mapping and

the field-classification table defined by Section 25.13. Those

are recorded in the amendment pass.



This completes Section 25.



========================================================================

26\. THE SYNC STATE MACHINE

========================================================================



This section defines the states a peer relationship can be in,

the legal transitions between them, and how the UI reflects each

state.



26.1 What the State Machine Describes



The state machine describes the status of a peer relationship:

the relationship between this device and one specific peer.



A device with N peers has N independent relationship states. Each

is tracked separately in sync\_state (Section 25.6).



The state is durable. It survives process restarts. When the

process starts, each peer relationship is loaded from disk and

enters a state determined by the loaded data and the current

environment.



The persisted sync state survives restart. The runtime session

state does not. On startup, the runtime relationship state is

reconstructed from persisted state and current transport

conditions. No relationship may be considered CONNECTING or

IN\_SYNC merely because that was its previous runtime state.



26.2 The States



There are six states.



UNKNOWN



&#x20; The peer is known (it is in sync\_peers, discovered through

&#x20; the Control Plane), but no synchronization relationship has

&#x20; ever been established. There is no delivery bookkeeping for

&#x20; this peer.



&#x20; UNKNOWN is the state of a peer with which this device has

&#x20; never successfully synchronized, regardless of whether the

&#x20; peer is currently reachable.



&#x20; A failed first connection attempt returns to UNKNOWN.



OFFLINE



&#x20; The peer relationship has been established at least once

&#x20; (there is delivery bookkeeping), but the peer is not

&#x20; currently reachable. This device cannot open a session with

&#x20; the peer.



&#x20; OFFLINE covers:



&#x20; - The peer is not running.

&#x20; - The peer is running but not reachable.

&#x20; - The Control Plane's discovery service reports the peer as

&#x20;   not online.

&#x20; - The relay is not available and no direct connection can be

&#x20;   established.



&#x20; A peer with no delivery bookkeeping cannot be OFFLINE. It is

&#x20; UNKNOWN.



CONNECTING



&#x20; This device is actively attempting to establish a session

&#x20; with the peer. A handshake is in progress.



&#x20; CONNECTING covers:



&#x20; - A direct connection attempt is in progress.

&#x20; - A relay connection attempt is in progress.

&#x20; - A handshake exchange is in progress.



IN\_SYNC



&#x20; A session with the peer is established, and the peer

&#x20; relationship has reached the conditions for synchronization

&#x20; convergence, as defined by the protocol's observable state:



&#x20; - This device has no events currently undelivered to the

&#x20;   peer.

&#x20; - This device has no events awaiting acknowledgement from

&#x20;   the peer.

&#x20; - This device has no locally accepted events pending domain

&#x20;   application (pending\_events is empty for this peer's

&#x20;   origin).

&#x20; - The current session has completed the required exchange

&#x20;   of event frontiers and starting points (Section 22.11)

&#x20;   such that the peer has no known unsynchronized events

&#x20;   remaining for this device.



&#x20; These conditions are determined using the sequence,

&#x20; watermark, acknowledgement, and reconciliation rules

&#x20; defined in Sections 11 through 18 and the pending\_events

&#x20; rules defined in Section 25.



&#x20; IN\_SYNC is the steady state. It means the two peers have

&#x20; converged (Section 12.9) to the extent the protocol can

&#x20; observe.



PENDING



&#x20; A session with the peer is established, but the peer

&#x20; relationship has not yet reached the conditions for

&#x20; synchronization convergence.



&#x20; PENDING applies when one or more of the following is true:



&#x20; - This device has undelivered events for the peer.

&#x20; - This device has sent events that the peer has not yet

&#x20;   acknowledged.

&#x20; - This device has received events that it has not yet

&#x20;   acknowledged.

&#x20; - This device has accepted events whose domain effect is

&#x20;   currently deferred in pending\_events (Section 25.7.5).

&#x20; - The current synchronization exchange has not yet

&#x20;   established that the relevant event sets have been

&#x20;   reconciled.



&#x20; PENDING is a transitional state. The protocol's job is to

&#x20; move from PENDING to IN\_SYNC.



ERROR



&#x20; The peer relationship is in an error condition that prevents

&#x20; synchronization.



&#x20; ERROR covers:



&#x20; - Repeated session failures (handshake rejections, protocol

&#x20;   violations).

&#x20; - The peer is presenting an incompatible protocol version.

&#x20; - An internal error on this device is preventing

&#x20;   synchronization.

&#x20; - A persistent transport failure that has exceeded the retry

&#x20;   policy.



&#x20; ERROR is not terminal. It is a state the relationship can

&#x20; leave when the error condition is resolved.



26.3 The Legal Transitions



The state machine permits the following transitions. Each

transition is stated with its trigger.



From UNKNOWN:



\- To CONNECTING, when this device initiates a session with the

&#x20; peer.



From OFFLINE:



\- To CONNECTING, when this device initiates a session with the

&#x20; peer (either on its own schedule, or in response to the

&#x20; Control Plane reporting the peer as online).



From CONNECTING:



\- To UNKNOWN, when the connection attempt fails before the

&#x20; relationship has ever been successfully established and no

&#x20; delivery bookkeeping exists.

\- To OFFLINE, when the connection attempt fails and the

&#x20; relationship has been established at least once (delivery

&#x20; bookkeeping exists).

\- To IN\_SYNC, when the session is established and the

&#x20; relationship satisfies all of the IN\_SYNC conditions

&#x20; (Section 26.2): no undelivered events, no unacknowledged

&#x20; events, no pending\_events for this peer's origin, and the

&#x20; session's event-frontier exchange is complete.

\- To PENDING, when the session is established but one or more

&#x20; of the IN\_SYNC conditions is not satisfied.

\- To ERROR, when the connection attempt fails with an error

&#x20; that the retry policy treats as an error condition

&#x20; (repeated protocol violations, version mismatch, and so on).



From IN\_SYNC:



\- To PENDING, when a new event or deferred domain work causes

&#x20; the relationship to no longer satisfy the IN\_SYNC

&#x20; conditions.

\- To OFFLINE, when the session ends (cleanly or due to

&#x20; transport failure).

\- To ERROR, when a session error occurs that cannot be handled

&#x20; by re-establishing the session.



From PENDING:



\- To IN\_SYNC, when all IN\_SYNC conditions defined in

&#x20; Section 26.2 are satisfied.

\- To OFFLINE, when the session ends.

\- To ERROR, when a session error occurs that cannot be

&#x20; handled.



From ERROR:



\- To OFFLINE, when the error condition is resolved but the

&#x20; peer is not currently reachable.

\- To CONNECTING, when this device retries the session and the

&#x20; error condition is resolved.



No other transitions are permitted. In particular:



\- A device cannot go from UNKNOWN directly to IN\_SYNC. It

&#x20; must pass through CONNECTING.

\- A device cannot go from OFFLINE directly to IN\_SYNC. It

&#x20; must pass through CONNECTING.

\- A device cannot go from CONNECTING directly to IN\_SYNC

&#x20; unless all IN\_SYNC conditions defined in Section 26.2 are

&#x20; satisfied. If delivery backlog, pending\_events, or an

&#x20; incomplete event-frontier exchange remains, the relationship

&#x20; enters PENDING.



26.4 The State Machine Is Per Peer



The state machine applies independently to each (local device,

peer) pair.



Example:



&#x20; This device has three peers: Peer A, Peer B, Peer C.



&#x20; Peer A is IN\_SYNC.

&#x20; Peer B is PENDING.

&#x20; Peer C is OFFLINE.



&#x20; The three states are independent. Peer C's OFFLINE state

&#x20; does not affect Peer A's IN\_SYNC state.



The device's overall sync status is a summary of its peers'

states, not a single state. The UI may present a summary (for

example, "all peers in sync" or "2 of 3 peers in sync"), but

the protocol tracks each peer separately.



26.5 How the UI Reflects Each State



The MVP's visible sync indicator is defined in the MVP scope

(Section 5.2): synced / pending / offline. The mapping from the

protocol states to the UI is:



\- UNKNOWN — UI shows "not connected."

\- OFFLINE — UI shows "offline."

\- CONNECTING — UI shows "connecting." A transient state; the

&#x20; user sees it briefly.

\- IN\_SYNC — UI shows "synced."

\- PENDING — UI shows "pending."

\- ERROR — UI shows "error." The UI may additionally show a

&#x20; diagnostic message (for example, "peer is running an

&#x20; incompatible protocol version").



The UI presents a simplified per-peer sync indicator and one

overall indicator in the main window. It does not expose the

full protocol state machine to the user; the six protocol

states are mapped to simplified UI labels. UNKNOWN and OFFLINE

may share the same displayed label, or may be shown as distinct

labels, depending on the frontend's design.



The exact UI treatment (colors, icons, labels) is defined by

the frontend implementation, not by this document.



26.6 State Persistence



A peer relationship's state is durable in sync\_state. It

survives process restarts.



When the process restarts:



\- A relationship with established durable delivery bookkeeping

&#x20; becomes OFFLINE. The transport is gone; the peer must be

&#x20; re-contacted.

\- A relationship without established delivery bookkeeping

&#x20; remains UNKNOWN.

\- A relationship whose last known state was ERROR remains

&#x20; ERROR until the error condition is retried.

\- A relationship that was CONNECTING at shutdown becomes:

&#x20; - OFFLINE, if delivery bookkeeping exists (the relationship

&#x20;   was previously established).

&#x20; - UNKNOWN, if no delivery bookkeeping exists (the

&#x20;   relationship was never established).



The transition from IN\_SYNC or PENDING to OFFLINE on restart is

a consequence of the design: a session is a runtime concept

(Section 8.1), and a session does not survive a process restart.



The state machine does not attempt to preserve historical

transient states across restart. Only the states that reflect

durable facts (delivery bookkeeping, error conditions) are

preserved.



26.7 The State Machine and the Protocol



The state machine is a description of the peer relationship's

status. It is not a protocol mechanism. The protocol itself

(Sections 8 through 25) defines what happens in each state; the

state machine names the states and the legal transitions.



The distinction between delivery synchronization and domain

convergence is a consequence of Section 25. A relationship is

IN\_SYNC only when both are satisfied: all delivery is complete

and no accepted events are waiting in pending\_events. Section 26

preserves this distinction; it does not collapse the two.



The state machine does not define:



\- How long CONNECTING may last before transitioning to OFFLINE.

\- How many failed connection attempts trigger ERROR.

\- How often the device attempts to reconnect to an OFFLINE peer.

\- What the user sees.



Those are retry policy and UI concerns, defined by the

implementation within the constraints of the protocol.



26.8 What This Section Does Not Do



It does not define the retry policy. That is an implementation

concern, recorded in the implementation notes.

It does not define the session timeout. That is a configuration

value (Section 8.7).

It does not define the UI. That is the frontend.

It does not change any rule in Sections 8 through 25.

It does not add new states to the six-state model.

It does not define what the Control Plane does with peer state.

That is a Control Plane concern.



========================================================================

27\. FAILURE SCENARIOS

========================================================================



This section enumerates the failure scenarios the MVP encounters.

For each scenario, it states:



\- What happens.

\- What the user sees.

\- What the operator sees.

\- How the system recovers.



It is the practical companion to Section 23 (failure classes)

and Section 26 (state machine). Section 23 defines the taxonomy;

Section 26 defines the relationship states; this section connects

them to concrete situations.



Each scenario is self-contained. The order is: connection and

session failures, then message-level failures, then event-level

failures, then local failures, then Control Plane failures, then

peer lifecycle.



Part 1 of this section covers scenarios 1 through 12.

Part 2 covers scenarios 13 through 23.



\------------------------------------------------------------------------

SCENARIO 1 — Direct connection fails

\------------------------------------------------------------------------



What happens.



Peer A attempts a direct connection to Peer B (Section 19.4).

The connection attempt fails: the peer's endpoint is not

reachable, a firewall blocks the connection, or a NAT prevents

it.



The attempt fails according to the configured connection

timeout. The failure is logged locally as an informational

event.



User sees.



Nothing visible. The direct connection attempt is an

implementation detail.



Operator sees.



A connection attempt logged as failed, with the peer's

device\_id and the failure reason (timeout, connection refused,

network unreachable).



Recovery.



Peer A falls back to the relay (Section 20.4). If the relay

connection succeeds, the session proceeds. If it also fails,

the peer relationship transitions to OFFLINE (Section 26.3)

and the retry policy applies.



No user action is required.



\------------------------------------------------------------------------

SCENARIO 2 — Relay connection fails

\------------------------------------------------------------------------



What happens.



Peer A attempts a connection through the relay (Section 20.4).

The relay is unavailable, or the relay cannot reach Peer B, or

the relay connection drops during establishment.



User sees.



Nothing visible if the fallback occurs quickly and a

subsequent attempt succeeds. If the failure is persistent, the

peer relationship transitions to OFFLINE and the UI shows

"offline" for that peer (Section 26.5).



Operator sees.



A relay connection failure logged with the relay endpoint, the

peer's device\_id, and the failure reason. If the relay is

unavailable globally, the operator sees repeated failures for

multiple peers.



Recovery.



If the failure is transient, the retry policy re-attempts. If

the failure is persistent (relay is down), the peer

relationship remains OFFLINE until the relay returns or a

direct connection becomes possible.



The relay service is a Control Plane concern; the peer

relationship handles the resulting failure according to

Section 26.



\------------------------------------------------------------------------

SCENARIO 3 — Handshake rejected

\------------------------------------------------------------------------



What happens.



Peer A and Peer B begin a handshake. The handshake is rejected

by one of them because:



\- The organization\_id in HANDSHAKE\_HELLO does not match the

&#x20; responder's organization.

\- The protocol version is incompatible (Section 24.3).

\- The claimed device\_id is not accepted by the responder

&#x20; (Section 8.3, step 2).

\- The proof\_tag in HANDSHAKE\_REPLY or HANDSHAKE\_CONFIRM does

&#x20; not verify (Section 22.9.3, Section 22.10.2).



The rejecting peer may send an appropriate ERROR message where

permitted by the protocol context, or close the connection.



User sees.



If the rejection is persistent (for example, a version

mismatch), the peer relationship transitions to ERROR and the

UI shows "error" for that peer, with a diagnostic message if

the frontend chooses to show one.



If the rejection is transient (for example, a misrouted

connection), the user may see the peer briefly transition

through CONNECTING and back to OFFLINE.



Operator sees.



An ERROR message, where sent, with the rejection reason, the

peer's device\_id, and the rejecting class and code. If no

ERROR was sent, the local log records the rejection.



Recovery.



For a version mismatch: the user or operator must update one

or both peers to compatible versions. In the MVP, there is

only one version, so this does not normally occur.



For a proof\_tag failure: the peers could not authenticate

possession of the expected organization key under the defined

handshake transcript. The operator investigates the cause. If

the peer has the wrong organization key, re-enrollment is

required: the user exports a new package and imports it on the

peer.



For a mismatched organization\_id: this indicates a

misconfiguration. The operator verifies the peer's

organization.



The peer relationship remains in ERROR until the condition is

resolved. The retry policy may retry periodically, but the

handshake will continue to fail until the cause is fixed.



\------------------------------------------------------------------------

SCENARIO 4 — Session dropped mid-sync

\------------------------------------------------------------------------



What happens.



A session is established and the peers are exchanging events.

The transport connection drops (network failure, relay

failure, peer's network goes down).



The session ends. The session key is discarded (Section 8.7).

The peers' sync\_state bookkeeping persists (Section 18.6).



User sees.



The peer relationship transitions from PENDING to OFFLINE

(Section 26.3). The UI shows "offline" for that peer.



If the sync indicator had shown "pending" (events were being

exchanged), it now shows "offline."



Operator sees.



A transport failure logged with the peer's device\_id and the

stage at which the drop occurred.



Recovery.



On the next session attempt (per the retry policy), the peers

re-run the handshake and re-send any events whose delivery was

not acknowledged (Section 18.6). Events that were sent but not

acknowledged are re-sent. The receiver detects duplicates by

event\_id and acknowledges them as DUPLICATE.



No event is lost by the delivery protocol, and duplicate

delivery does not cause the event to be applied twice on the

receiving database instance.



The peer relationship progresses through CONNECTING and, while

synchronization work remains, PENDING; once all IN\_SYNC

conditions in Section 26.2 are satisfied, it becomes IN\_SYNC.



\------------------------------------------------------------------------

SCENARIO 5 — Peer crashes mid-session

\------------------------------------------------------------------------



What happens.



Peer B's process crashes during a session. From Peer A's

perspective, the connection drops abruptly.



This is the same as Scenario 4 from Peer A's side. From Peer

B's side, when it restarts, it re-establishes sessions and

resumes.



User sees.



Same as Scenario 4.



Operator sees.



Same as Scenario 4, plus, on Peer B's side, a process crash

logged locally.



Recovery.



Same as Scenario 4. The protocol's delivery model

(Section 18.1) ensures that unacknowledged events are re-sent

after the peer restarts.



\------------------------------------------------------------------------

SCENARIO 6 — Session timeout

\------------------------------------------------------------------------



What happens.



A session is established but no messages are exchanged for a

configurable period (Section 8.7). Either peer may decide the

session has timed out and send SESSION\_END with close\_reason

TIMEOUT (0x0001, Section 22.12.1).



User sees.



Nothing visible, unless the timeout is persistent and the peer

relationship moves to OFFLINE.



Operator sees.



A SESSION\_END with reason TIMEOUT, or a local decision to

close the session.



Recovery.



The session ends cleanly. The peer relationship transitions to

OFFLINE. The retry policy applies. A new session is

established on the next attempt.



A session timeout is a normal session-management event and is

not by itself a protocol error.



\------------------------------------------------------------------------

SCENARIO 7 — Message fails authentication

\------------------------------------------------------------------------



What happens.



Peer B receives a SYNC\_MESSAGE from Peer A. The AEAD

authentication fails (Section 22.6.3). This can happen because:



\- The message was corrupted in transit.

\- The message was tampered with.

\- The session key is wrong (which should not happen if the

&#x20; handshake succeeded).



Peer B does not process any events in the message. Peer B does

not send a SYNC\_ACK (Section 22.14.2). Peer B may report the

failure through the protocol's permitted ERROR mechanism, or

close the session (Section 23.2).



User sees.



Nothing visible unless the failure is persistent. If the

session is closed, the peer relationship transitions to

OFFLINE. If repeated authentication failures occur, the

relationship may transition to ERROR.



Operator sees.



A SESSION\_ERROR logged with the peer's device\_id, the message

stage at which the failure occurred, and the error code.



Recovery.



The message is not retried by the receiver. The sender retries

according to Section 18.6. If the session is closed or

otherwise unusable, the peers establish a new session before

retrying. If the failure was caused by transit corruption, the

retry succeeds. If the failure was caused by something

systematic, the retries will also fail, and the new session

should resolve it.



The protocol does not attempt to recover the specific message.

It relies on retry, and on a new session when the current

session is unusable.



\------------------------------------------------------------------------

SCENARIO 8 — Message fails envelope validation

\------------------------------------------------------------------------



What happens.



Peer B receives a message whose outer TLV framing is invalid:

the declared length does not match the bytes received, the

message exceeds the maximum size, or the framing is not valid

TLV (Section 23.2).



Peer B does not process the message. Peer B does not send a

SYNC\_ACK. Peer B may report the failure through the protocol's

permitted ERROR mechanism, or close the session.



User sees.



Nothing visible unless the failure is persistent.



Operator sees.



A SESSION\_ERROR logged with the error code.



Recovery.



Same as Scenario 7. The sender retries because no

acknowledgement was received. If the envelope failure was

caused by transit corruption, the retry succeeds. If it was

caused by a systematic implementation defect in message

framing or encoding, the issue is diagnosed from the error

code and corrected.



\------------------------------------------------------------------------

SCENARIO 9 — Message fails inner structure validation

\------------------------------------------------------------------------



What happens.



Peer B receives an authenticated, decrypted message whose

inner TLV structure violates the protocol (Section 23.3): a

required field is missing, a singular field appears twice,

fields are out of order, an unknown field type code is present,

a fixed-size field has the wrong size, or a message-specific

constraint is violated.



Peer B does not process any events in the message. Peer B does

not send a SYNC\_ACK. Peer B may send an ERROR message with

class PROTOCOL\_ERROR and the appropriate code, or close the

session.



User sees.



Nothing visible unless the failure is persistent.



Operator sees.



A PROTOCOL\_ERROR logged with the error code and available

protocol context.



Recovery.



The failure indicates a protocol violation. If both peers are

running compatible implementations, this should not happen.

The operator investigates the error code.



If the failure is systematic (for example, a bug in one

implementation), it will recur until the bug is fixed. The

peer relationship may transition to ERROR.



\------------------------------------------------------------------------

SCENARIO 10 — Event fails structural validation

\------------------------------------------------------------------------



What happens.



Peer B receives a message whose inner structure is valid, but

one event record in it has an invalid structure: a required

event field is missing, fields are out of order, a fixed-size

field has the wrong size, or an unknown field type code is

present.



This is a PROTOCOL\_ERROR (Section 23.3, and the note in

Section 25.12.1 step 5a). It affects the whole message, not

just the event.



Peer B does not process any events in the message. Peer B does

not send a SYNC\_ACK. Peer B may send an ERROR message with

class PROTOCOL\_ERROR and the appropriate code.



User sees.



Nothing visible unless the failure is persistent.



Operator sees.



A PROTOCOL\_ERROR logged with the error code and, if available,

the event\_id of the malformed event.



Recovery.



Same as Scenario 9. The failure indicates a protocol

violation.



\------------------------------------------------------------------------

SCENARIO 11 — Event fails semantic validation

\------------------------------------------------------------------------



What happens.



Peer B receives a message whose structure is fully valid, but

one event in it has invalid content: a payload that does not

match the event type's schema, a field value that is not

permitted for the field, a semantic violation (such as

attempting to set deleted to false), or a reference to an

entity\_type that is not synchronized in the MVP.



This is an EVENT\_ERROR (Section 23.4). It affects only the

individual event. The rest of the message is processed

normally.



Peer B processes the valid events. The invalid event receives

a REJECTED outcome in the SYNC\_ACK (Section 22.14.1). Peer B

may optionally send a separate ERROR message with class

EVENT\_ERROR and the specific code (Section 23.4).



User sees.



Nothing visible. The rejected event is a protocol-level

concern, not a user-facing one, in the MVP.



Operator sees.



A REJECTED outcome in the SYNC\_ACK, with the event\_id. If the

receiver sent an ERROR message, the operator sees the error

code (EVENT\_PAYLOAD\_INVALID, EVENT\_FIELD\_INVALID, and so on).



Recovery.



The REJECTED outcome is terminal (Section 22.14.4). The sender

records the event's delivery to this peer as resolved and does

not retry. The event will not be applied on the receiver.



If the rejection is caused by a bug in the sender's event

construction, the bug must be fixed. New events from the

corrected sender will be accepted.



The rejected event remains in the sender's sync\_events, but

its delivery to this peer is recorded as resolved.



\------------------------------------------------------------------------

SCENARIO 12 — Event references a nonexistent entity

\------------------------------------------------------------------------



What happens.



Peer B receives an event whose prerequisite entity does not

exist locally. This happens when:



\- An ENTITY\_UPDATED arrives for an entity that has not yet been

&#x20; created on Peer B.

\- An ACTION\_CREATED arrives whose referenced debtor has not yet

&#x20; been created on Peer B.

\- A COMMUNICATION\_LOGGED arrives whose referenced debtor has

&#x20; not yet been created on Peer B.



This is not a failure. It is a normal case the protocol

handles (Section 14.5).



Peer B accepts the event (appends it to sync\_events, advances

its logical clock) and records it in pending\_events with

reason ENTITY\_NOT\_YET\_PRESENT. Its domain effect is deferred.

The event receives an ACCEPTED outcome in the SYNC\_ACK.



User sees.



The peer relationship transitions to PENDING if the unresolved

pending event causes any IN\_SYNC condition in Section 26.2 to

be false. If the user has more than one peer, the UI may show

a "pending" indicator.



If the prerequisite entity never arrives, the event remains

pending. The frontend may eventually show a "stuck" indicator

for that peer, if it chooses to display one.



Operator sees.



A pending event logged with the event\_id and the missing

prerequisite (depends\_on\_entity\_type, depends\_on\_entity\_id).



Recovery.



When the prerequisite entity arrives, typically through the

corresponding creation event, the pending event is re-applied

(Section 25.12.2). The peer relationship transitions from

PENDING to IN\_SYNC once all IN\_SYNC conditions in Section 26.2

are satisfied.



No user action is required in the normal case. If a pending

event remains pending indefinitely (the prerequisite never

arrives), the operator investigates why the prerequisite is

missing.



The exact relationship between pending\_events and peer

convergence is determined by the durable synchronization

bookkeeping defined in the amendment pass. Section 27

describes the behavior; the amendment pass defines the

mapping.



\------------------------------------------------------------------------

SCENARIO 13 — Local database is locked

\------------------------------------------------------------------------



What happens.



The sync engine attempts to read from or write to the local

SQLCipher database, but the database is locked. This can happen

because:



\- The user has not yet entered their local password (the

&#x20; database is not unlocked, Section 6.3).

\- Another instance of the application is holding the database

&#x20; open.

\- A background operation is holding a transaction that the

&#x20; sync engine's transaction cannot proceed past.



If the sync engine cannot read the organization key (because

the database is locked), it cannot establish a session.



User sees.



If the database is not unlocked, the UI shows the unlock

screen. The user must enter the local password to unlock.



If the database is locked for another reason, the UI shows a

sync error. The exact message is defined by the frontend.



Operator sees.



A local error logged with reason DATABASE\_LOCKED (0x0401,

Section 23.6). If the lock is persistent, the sync engine

cannot proceed until it is released.



Recovery.



If the database is not unlocked: the user unlocks it. Sync

resumes.



If the database is locked by another instance: the user closes

the other instance. Sync resumes.



If the lock is caused by a stuck transaction, the transaction

must be allowed to complete or be rolled back according to the

local database's transaction handling. If the lock does not

clear, the application may need to be restarted.



No committed events are lost. Failed or interrupted

transactions are retried once the lock is released.



\------------------------------------------------------------------------

SCENARIO 14 — Local database is corrupted

\------------------------------------------------------------------------



What happens.



The sync engine attempts to read from the local SQLCipher

database, and the read fails because the database file is

corrupted: a page fails its integrity check, the SQLite header

is damaged, or the file structure is otherwise invalid.



This is a serious local failure. The database may contain

debtor data that cannot be read.



User sees.



The application fails to load the database. The user sees an

error indicating that the local database cannot be opened.



Operator sees.



An internal error logged with reason DATABASE\_CORRUPTED

(0x0402, Section 23.6), with the SQLite error message if

available.



Recovery.



The MVP does not include a database repair mechanism. Recovery

options depend on the situation:



\- If a backup of the local database exists (the MVP does not

&#x20; provide one, but the user may have made one), the backup is

&#x20; restored.



\- If another device in the organization holds the same data,

&#x20; the local database can be replaced and the client can be

&#x20; re-enrolled as a new local synchronization participant (a

&#x20; new device instance identifier is generated per Section

&#x20; 11.3), and the data can be re-synced from a peer. This

&#x20; requires the peer to still hold the data and the new local

&#x20; participant to be enrolled with the same organization key.



\- If neither option is available, the data may be lost. This

&#x20; is the same property as key loss (Section 5.7): GORKA cannot

&#x20; recover data that exists only on the corrupted device.



Database corruption is a serious situation. It is documented

plainly in the client-facing documentation.



\------------------------------------------------------------------------

SCENARIO 15 — Disk is full

\------------------------------------------------------------------------



What happens.



The sync engine attempts to write to the local database or to

a local file, and the write fails because the disk is full.



The sync engine cannot commit new transactions. It cannot

append new events to sync\_events.



User sees.



The application may fail to save new data. The UI shows an

error when a write is attempted.



Operator sees.



An internal error logged with reason DISK\_FULL (0x0403,

Section 23.6).



Recovery.



The user frees disk space. Once space is available, the sync

engine can commit new transactions. Committed events are not

lost. Transactions that failed before commit remain

uncommitted and may be retried once sufficient space is

available.



If the disk remains full, the sync engine cannot commit new

transactions or accept new events. The current session may

also have to terminate if required state cannot be persisted.

The resulting peer relationship state follows the existing

Section 26 rules.



The MVP does not include automatic disk space management. The

frontend may show a disk space warning.



\------------------------------------------------------------------------

SCENARIO 16 — Sequence counter or logical clock lost

\------------------------------------------------------------------------



What happens.



The device's sequence counter or logical clock (both stored in

sync\_state, Section 25.6.2) is lost or corrupted. This can

happen because:



\- The sync\_state table is damaged.

\- A software defect writes an incorrect value.

\- The database is restored from an older backup that has a

&#x20; lower counter or clock.



If the sequence counter is lost, the device may re-use

sequence numbers. If the logical clock is lost, the device may

produce events with lower logical clocks than events it has

already accepted.



Both are protocol violations (Section 11.3, Section 12.3).



User sees.



Nothing visible initially. The violation is detected during

synchronization, when a peer receives an event with a

duplicate (device\_id, sequence) or a regressed logical clock.



Operator sees.



A protocol violation logged with the error code from Section

23.3 (FIELD\_SIZE\_MISMATCH, NONCANONICAL\_INTEGER, or a new code

if the violation is detected at a higher level).



Recovery.



The MVP does not provide automatic recovery for a lost

sequence counter or logical clock. The situation is

exceptional and requires operator intervention.



Options:



\- If the sequence counter is recoverable (a backup has a

&#x20; higher value), restore the higher value.



\- If the sequence counter is not recoverable, the affected

&#x20; device instance is considered compromised. In the

&#x20; funded-phase per-machine identity model, the correct

&#x20; recovery would be to retire the affected device instance and

&#x20; create a new device instance with a new device instance

&#x20; identifier. The MVP does not provide this recovery flow.



Events previously originated by the affected instance remain

associated with that historical origin; a new instance would

use a new sequence namespace.



This is a funded-phase concern. The MVP documents the risk and

does not provide a built-in recovery flow.



\------------------------------------------------------------------------

SCENARIO 17 — Device instance identifier lost

\------------------------------------------------------------------------



What happens.



In the funded-phase per-machine identity model, loss of the

device instance identifier means the original device instance

can no longer be continued safely. This happens when the

SQLCipher database is deleted or replaced by a new one.



If the instance identifier is lost, the device is no longer

the same device instance in that model. A new instance

identifier would be generated at the next enrollment, and the

new instance would use a new sequence namespace.



The MVP does not provide independent per-machine

device-instance recovery. The MVP's device identity is

user-account-based (Section 4); the risk of losing the local

database is documented, and the user re-enrolls the device

with a new organization key package (Section 5.5).



User sees.



In the MVP, if the SQLCipher database is lost or corrupted,

the user effectively restarts the device. The user re-enrolls

the device with a new organization key package

(Section 5.5).



Operator sees.



A local log indicating that the local database was recreated.



Recovery.



In the MVP, the user re-enrolls the device. The device

participates in synchronization under the MVP's user-account-

based identity model (Section 4).



The old local database's data is no longer accessible on this

device. Data that exists on other devices in the organization

can be synchronized to the re-enrolled device.



This is a funded-phase concern for the per-machine identity

model. The MVP documents the risk and does not provide a

built-in cleanup flow.



\------------------------------------------------------------------------

SCENARIO 18 — Discovery service unavailable

\------------------------------------------------------------------------



What happens.



The Control Plane's discovery service (Section 19.3) is

unavailable: the API is down, the network to it is down, or

the service returns errors.



Without discovery, a peer cannot learn about other peers'

currently available connection information. It may still be

able to establish direct connections to peers whose connection

information it already knows from a previous session.



User sees.



Nothing visible if direct connections remain possible. If

discovery is required and unavailable, the peer relationship

may transition to OFFLINE.



Operator sees.



A Control Plane API error logged with the failure reason.



Recovery.



If the discovery service is transiently unavailable, the

retry policy re-attempts. If it is persistently unavailable,

the operator investigates the Control Plane.



The peer relationship state is not affected by the discovery

failure itself. The discovery failure only prevents new

connections from being established.



\------------------------------------------------------------------------

SCENARIO 19 — Signaling service unavailable

\------------------------------------------------------------------------



What happens.



The Control Plane's signaling service (Section 22.17) is

unavailable. Without signaling, peers may be unable to exchange

the connection information required to establish a new direct

session.



If a direct connection cannot be established, the peers may

fall back to the relay when the relay path is available

(Section 20.4).



User sees.



Nothing visible if the fallback succeeds. If neither direct

nor relay connection is possible, the peer relationship

transitions to OFFLINE.



Operator sees.



A Control Plane API error logged with the failure reason.



Recovery.



Same as Scenario 18. The retry policy re-attempts.



\------------------------------------------------------------------------

SCENARIO 20 — Relay unavailable

\------------------------------------------------------------------------



What happens.



The relay (Section 20) is unavailable. This is Scenario 2

from the perspective of the peer relationship.



User sees.



Same as Scenario 2.



Operator sees.



Same as Scenario 2.



Recovery.



Same as Scenario 2.



\------------------------------------------------------------------------

SCENARIO 21 — Peer is offline for a long time

\------------------------------------------------------------------------



What happens.



A peer relationship is in OFFLINE because the peer has not

been reachable for an extended period. The peer may be powered

off, the device may be lost, or the user may have stopped

using the application.



The relationship's delivery bookkeeping remains in sync\_state.

The events that were pending delivery to that peer remain in

sync\_events, undelivered.



User sees.



The UI shows "offline" for that peer. If the user has one

peer and it is offline, the user sees that they are not

currently synced.



Operator sees.



Connection attempts and failures are logged according to the

configured retry policy.



Recovery.



The relationship remains OFFLINE until the peer becomes

reachable. The MVP does not remove stale peers; the

bookkeeping remains indefinitely.



If the peer never comes back (Scenario 22), the relationship

remains OFFLINE forever. This is acceptable in the MVP; a

future phase may introduce a "mark as stale" mechanism.



\------------------------------------------------------------------------

SCENARIO 22 — Peer never comes back

\------------------------------------------------------------------------



What happens.



A peer is permanently gone: the device is destroyed, the user

has left the organization, or the machine has been

decommissioned.



The relationship's delivery bookkeeping remains in sync\_state.

The events that would have been delivered to that peer remain

unresolved in that peer's delivery bookkeeping.



User sees.



The UI shows "offline" for that peer indefinitely.



Operator sees.



Connection attempts and failures continue according to the

configured retry policy.



Recovery.



The MVP does not remove stale peers. The delivery bookkeeping

remains. This has two consequences:



\- The device's sync\_events continues to retain its append-only

&#x20; event history. The history is not affected by the dead

&#x20; peer; it would grow anyway, as new events are originated

&#x20; and accepted locally. The specific consequence of the dead

&#x20; peer is that events destined for that peer remain

&#x20; unresolved in that peer's delivery bookkeeping indefinitely.



\- The UI continues to show the peer as offline.



A future phase may introduce:



\- Manual peer removal by the user.

\- Automatic stale-peer detection (a peer that has been offline

&#x20; for longer than a configured threshold is marked as stale).



Neither is in the MVP.



The client-facing documentation states plainly: a lost device

leaves a stale peer in sync\_state, and the user should be

aware of this. It is the same property as the revocation

caveat (Section 5.7).



\------------------------------------------------------------------------

SCENARIO 23 — A new peer is added to the organization

\------------------------------------------------------------------------



What happens.



A new device/user participant is enrolled in the organization

(Section 5.5). The enrolled participant becomes discoverable

through the Control Plane when it comes online.



The relationship between an existing device and the new peer

begins in UNKNOWN.



User sees.



Nothing visible until the new device appears in the sync

settings. When it does, the UI shows it with the UNKNOWN label

("not connected").



Operator sees.



A new device registration logged by the Control Plane. When

the new device comes online, the discovery service reports it.



Recovery.



The first synchronization with the new peer begins with a

handshake (Section 8.2). The handshake proves that both

devices hold the organization key. If the new participant has

been enrolled with the correct organization key package, the

handshake succeeds.



After the first successful synchronization, the relationship

moves through CONNECTING and, while synchronization work

remains, PENDING; once all IN\_SYNC conditions in Section 26.2

are satisfied, it becomes IN\_SYNC.



If the handshake fails (for example, because the new

participant was enrolled with the wrong package), the

relationship transitions to ERROR, and the user is prompted to

re-enroll (Scenario 3).



There is no special protocol mechanism for adding a new peer.

The existing enrollment flow (Section 5.5) and the existing

handshake (Section 8) handle it.



\------------------------------------------------------------------------

SUMMARY OF THE 23 SCENARIOS

\------------------------------------------------------------------------



The 23 scenarios group into six categories:



Connection and session (Scenarios 1–6).

&#x20; Direct connection failures, relay failures, handshake

&#x20; rejections, dropped sessions, peer crashes, session

&#x20; timeouts.



Message-level failures (Scenarios 7–9).

&#x20; AEAD authentication failures, envelope validation failures,

&#x20; inner structure validation failures.



Event-level outcomes (Scenarios 10–12).

&#x20; Event structural failures, event semantic failures,

&#x20; missing prerequisites.



Local failures (Scenarios 13–17).

&#x20; Database locked, database corrupted, disk full, sequence

&#x20; counter or logical clock lost, device instance identifier

&#x20; lost.



Control Plane failures (Scenarios 18–20).

&#x20; Discovery unavailable, signaling unavailable, relay

&#x20; unavailable.



Peer lifecycle (Scenarios 21–23).

&#x20; Peer offline for a long time, peer never comes back, new

&#x20; peer added.



The scenarios collectively cover the failure surface of the

MVP. They do not enumerate every possible error code (Section

23 does that); they enumerate the situations in which the

codes arise.



For every scenario, the protocol's behavior is defined by

Sections 8 through 26. Section 27 does not define new protocol

behavior. It describes how the existing protocol behaves in

concrete situations.



This completes Section 27 and Part VI.



========================================================================

28\. SECURITY PROPERTIES THE PROTOCOL PROVIDES

========================================================================



This section states, in three parts, what the protocol

guarantees, what it does not guarantee, and what is deferred to

the funded phase.



It is deliberately a strict three-way distinction. No item

appears in more than one part. No item is stated twice.



28.1 Guarantees



The protocol guarantees the following. Each guarantee is a

property of the protocol as specified in Sections 1 through 27.



28.1.1 G1 — Control Plane Has No Organization Key



The Control Plane does not hold the organization key. It never

receives it. It cannot derive it. It cannot decrypt any sync

traffic encrypted with a key derived from it.



This is enforced architecturally: the organization key is

generated on the client's device, stored only on the client's

devices, and never transmitted to the Control Plane. The

enrollment package (Section 22.7) is transmitted out-of-band

by the client, not through the Control Plane.



See Sections 6.1, 7.5, and 20.3.



28.1.2 G2 — Sync Payloads Are End-to-End Encrypted



All session-protected protocol messages carrying synchronization

or session data are encrypted with a session key derived from

the organization key, using XChaCha20-Poly1305 (Section 22.6.7).



The message types are: SYNC\_MESSAGE, SYNC\_ACK,

SESSION\_ESTABLISHED, SESSION\_END, and session-encrypted ERROR.



The encryption is end-to-end. Only the peers in the session can

decrypt. Neither the Control Plane nor the relay can decrypt.



See Sections 8.4, 20.3, and 22.13.



28.1.3 G3 — Messages Are Authenticated



Every sync message carries an AEAD authentication tag. A

message that has been modified in transit fails authentication

and is not processed (Section 23.2).



The handshake messages (HANDSHAKE\_REPLY, HANDSHAKE\_CONFIRM)

carry HMAC-SHA256 proof tags that authenticate the handshake

transcript and the responding peer's possession of the

organization key (Sections 22.9.3 and 22.10.2).



See Sections 22.6.3, 22.9.3, and 22.10.2.



28.1.4 G4 — The Relay Cannot Decrypt or Undetectably Modify



The relay carries ciphertext. It cannot decrypt it, because it

does not hold the organization key and cannot derive the

session key. It cannot undetectably modify it, because any

modification fails AEAD authentication at the receiving peer

(Section 20.3).



See Sections 20.2 and 20.3.



28.1.5 G5 — Duplicate Delivery Does Not Duplicate Application



An event that arrives twice is detected by event\_id (Section

15\) and applied at most once on the receiving database

instance. At-least-once delivery plus duplicate detection

produces exactly-once application per database instance

(Section 18.1).



See Sections 15.1 and 18.1.



28.1.6 G6 — Corrupted or Tampered Messages Are Rejected



A message that fails AEAD authentication, envelope validation,

or inner structure validation is not processed (Sections 23.2

and 23.3). A message is processed only after it passes all of

these checks.



See Sections 22.6.3, 23.2, and 23.3.



28.1.7 G7 — Convergence Is Deterministic



Given the same set of accepted events, every device derives

the same final state, regardless of event arrival order,

regardless of wall-clock time, regardless of which device

originated which event (Section 12.9).



This is guaranteed by the protocol order (logical\_clock,

device\_id, sequence) and the reconciliation rules (Sections 12

through 14).



See Sections 12.6, 12.9, and 25.9.9.



28.1.8 G8 — The Local Database Is Encrypted at Rest



The local SQLCipher database is encrypted with a key derived

from the user's local password (Sections 6.3 and 7.2). The

debtor data is unreadable without the local password.



The organization key is stored inside the SQLCipher database

(Section 7.1). It is readable only after the database is

unlocked.



See Sections 6.3 and 7.2.



28.1.9 G9 — Organization Isolation



A device in one organization cannot synchronize with a device

in another organization. The organization\_id in the handshake

must match, or the handshake is refused (Section 8.3). The

enrollment package carries the organization\_id, and the

importing client verifies it against the JWT (Section 5.5,

Section 22.7.4).



See Sections 5.2, 5.5, and 8.3.



28.1.10 G10 — The Control Plane Cannot Reconstruct Debtor Data



The Control Plane holds only the metadata in Section 21.3. It

does not hold debtor data, in any form, because it does not

hold the keys needed to decrypt the sync traffic it carries

(Section 21.4).



The Control Plane cannot reconstruct the plaintext debtor

record from the protocol data available to it. It has no

access to the plaintext.



See Sections 21.3 and 21.4.



28.1.11 G11 — Deletion Is Monotonic



Once an entity is marked deleted, no event can restore it

(Section 14.3, Section 25.9.9 step 8). The `deleted` field is

monotonic.



This prevents accidental "resurrection" of deleted records in

the MVP.



See Sections 14.3 and 25.9.9.



28.1.12 G12 — The Protocol Order Does Not Depend on Wall-Clock

Time



The protocol order is (logical\_clock, device\_id, sequence)

(Section 12.6). It does not depend on any device's wall clock.

A device with a wrong clock cannot produce an incorrect

ordering.



See Sections 12.2 and 12.6.



28.2 Non-Guarantees



The protocol does not guarantee the following. Each item is

something an observer might assume the protocol provides, but

it does not. Stating them is as important as stating the

guarantees.



28.2.1 N1 — The Organization Key Does Not Authenticate a Specific

User or Device



Possession of the organization key proves possession of the

cryptographic secret required for the MVP peer handshake. It

does not cryptographically prove the claimed user identity,

device identity, or current Control Plane authorization.



In the MVP, all authorized devices share the same organization

key, so a peer that holds the organization key can present any

claimed device\_id and pass the handshake.



See Section 8.6.



28.2.2 N2 — There Is No Forward Secrecy



The session key is derived from the organization key and the

handshake nonces (Section 8.4). An attacker who later obtains

the organization key and has recorded old handshakes can

derive the old session keys, and therefore decrypt the old

sessions.



The protocol does not implement Diffie-Hellman or any other

forward-secret key exchange in the MVP.



See Section 8.4.



28.2.3 N3 — Revocation Does Not Erase Previously Replicated Data



The MVP does not implement cryptographic revocation (Section

9.3). Disabling a user's Control Plane account prevents future

authentication, but it does not remove the organization key

from a device that already holds it, and it does not delete

data already replicated to that device.



If a device is lost or an agent leaves, the MVP cannot

cryptographically invalidate the key or the data.



See Sections 9.3 and 9.4.



28.2.4 N4 — The MVP Cannot Revoke a Specific Lost Machine



In the MVP, device identity is user-account-based (Section 4).

There is no way to revoke one machine without disabling the

user account, which also locks the user out of their other

machines.



See Section 9.2.



28.2.5 N5 — The Protocol Does Not Hide the Existence of

Synchronization



The Control Plane can observe that two devices communicated,

when, and how much (Section 21.3). It cannot see the content,

but it can see the fact of the communication and the aggregate

traffic volume.



See Section 21.3.



28.2.6 N6 — The Protocol Does Not Prevent Traffic Analysis



Traffic analysis (inferring information from timing, message

sizes, direction, and connection patterns) is not addressed

in the MVP. The protocol does not use padding, fixed-size

messages, artificial delays, or dummy traffic to hide traffic

characteristics.



See Section 21.9.



28.2.7 N7 — A Compromised Device Cannot Be Trusted



If an attacker has compromised a device — for example, by

extracting the organization key from an unlocked database or

by controlling the device's process — the attacker can

impersonate any device in the organization at the protocol

level, decrypt all sync traffic that reaches that device, and

issue any event.



The protocol does not defend against a compromised endpoint.

It defends against a compromised transport (through AEAD) and

a compromised Control Plane (through end-to-end encryption).

Endpoint compromise is a different problem, addressed by

operating system security, not by this protocol.



See Sections 8.6 and 9.3.



28.2.8 N8 — The Protocol Does Not Synchronize Debt or Document

Data



Debt and document data remain local to each device in the MVP

(Section 25.9.2). They are not represented in sync events.



See Section 25.9.2.



28.2.9 N9 — The Protocol Does Not Sync AI Prompts or Responses



AI prompts and responses are stored locally on the device that

produced them. They are not synchronized (MVP scope §8.4).



See MVP scope §8.4.



28.2.10 N10 — The Protocol Does Not Prevent a Malicious Peer

from Originating False Events



A peer that holds the organization key can originate any

event, including events that are factually false. The protocol

ensures that the event is durably recorded and applied

consistently across devices; it does not ensure that the

event's content is truthful.



Truthfulness is an application-level concern, not a protocol

concern.



See Sections 8.6 and 15.7.



28.2.11 N11 — The Protocol Does Not Provide a Global Total Order

Across All Events



The protocol order (Section 12.6) is a total order over the

events the device has accepted. It is not a global order over

all events in the organization, because a device has not

necessarily accepted every event.



The protocol order is a local, deterministic total order. The

final state converges across devices with the same accepted

events, but no device has a global view of "all events."



See Sections 11.4 and 12.6.



28.3 Deferred Capabilities



The following are funded-phase items. They are not in the MVP.

They are listed here so that no reader mistakes their absence

for a defect.



Some items in this list are protocol capabilities. Two of

them (D10 and D11) are deferred security activities, not

protocol capabilities. They are listed here because they are

deferred and because they are part of the funded-phase plan.



28.3.1 D1 — Per-Machine Device Identity



Each machine becomes a registered entity within the

organization, with its own identity, individually revocable.



See Section 7.3, MVP scope §7.3.



28.3.2 D2 — Key Rotation



The organization key can be rotated. Future traffic is

encrypted with a new key. Old traffic remains encrypted with

the old key.



See Section 7.2, MVP scope §7.2.



28.3.3 D3 — Cryptographic Offboarding



When an agent leaves, the organization key can be rotated so

that the departing agent's device can no longer decrypt future

traffic. This is the cryptographic revocation that the MVP

does not implement.



See Sections 7.2 and 9.4, MVP scope §7.2.



28.3.4 D4 — Lost-Device Recovery Flow



A flow for removing a lost device from the organization and

rotating the key so that the lost device cannot decrypt future

traffic.



See Section 7.2, MVP scope §7.2.



28.3.5 D5 — Mesh Topology



Any two authorized machines in the organization can sync

directly with each other. The admin's machine is no longer a

single point of coordination.



See Section 7.4, MVP scope §7.4.



28.3.6 D6 — Forward-Secret Session Establishment



A key-exchange protocol (for example, based on Diffie-Hellman)

that provides forward secrecy: compromise of the organization

key does not reveal old session keys.



This is the fix for N2.



See Section 8.4.



28.3.7 D7 — Debt and Document Synchronization



Debt and document data may become synchronized in a future

phase through extensions to the event model and reconciliation

rules.



See Section 25.9.2.



28.3.8 D8 — Document Content Synchronization



Document contents may become synchronized across devices, not

just metadata.



See MVP scope §8.4.



28.3.9 D9 — AI Prompt and Response Synchronization



AI prompts and responses may become synchronized, as new event

types.



See MVP scope §8.4.



28.3.10 D10 — Cryptographic Specialist Review



A cryptography specialist reviews the key management,

protocol design, and security model before shipping to real

customers.



See Section 9.8.



28.3.11 D11 — Threat Model and Independent Security Review



A written threat model and an independent security review,

which is the third document in the sequence (after this

document and SYNC-ARCHITECTURE.md).



See Section 29.



28.3.12 D12 — Traffic Analysis Mitigation



Padding, fixed-size messages, artificial delays, dummy

traffic, or other mechanisms to reduce the information visible

to an observer of the transport.



This is the fix for N6.



See Section 21.9.



28.4 What Section 28 Does Not Do



It does not analyze threats. That is Section 29 (inputs to the

threat model) and the threat model document itself.



It does not define the protocol. The protocol is Sections 1

through 27.



It does not add any rule. It states what the protocol already

provides and does not provide.



========================================================================

29\. INPUTS TO THE THREAT MODEL

========================================================================



This section provides the facts the threat model document (the

third document in the sequence) will need. It does not perform

the threat analysis. It states the inputs.



The threat model document will use these inputs to produce the

analysis. It is a separate document, written after this one.

Section 29 is not the threat model.



29.1 Assets to Protect



The assets the protocol protects are:



\- Debtor data at rest on each client device.

\- Debtor data in transit between client devices.

\- The organization key.

\- The session keys.

\- The integrity of the event stream.

\- The convergence guarantee (same state on devices with the

&#x20; same accepted events).

\- The user's local password.

\- The user's Control Plane credentials.

\- The enrollment package and the passphrase that protects it.



29.2 Trust and Security Boundaries



The protocol has four relevant trust and security boundaries:



1\. Between a client device and the Control Plane. The client

&#x20;  authenticates to the Control Plane using the authentication

&#x20;  mechanism defined in Section 5. TLS protects the transport

&#x20;  connection. No debtor data crosses this boundary.



2\. Between a client device and a peer. The peers authenticate

&#x20;  to each other with the organization key (Section 8.3). The

&#x20;  session is end-to-end encrypted. Debtor data crosses this

&#x20;  boundary, but encrypted.



3\. Between a client device and a third party it connects to

&#x20;  directly (Zone 3, Section 21). GORKA is not on the path.

&#x20;  The client is responsible for the third party's handling of

&#x20;  data.



4\. Between a client device and its local storage. The device's

&#x20;  operating system protects the local database file. The

&#x20;  SQLCipher encryption protects the data at rest.



These boundaries are not all of the same kind. Boundaries 1, 2,

and 3 are network trust boundaries. Boundary 4 is an endpoint

security boundary. All four are relevant to the threat model.



29.3 Attackers the Threat Model Must Consider



29.3.1 A Network Observer



A passive attacker between the client and the Control Plane, or

between the client and the relay.



What the attacker can see: ciphertext, connection metadata

(timing, size, direction, endpoints).



What the attacker cannot see: plaintext debtor data, the

organization key, session keys.



Relevant properties: G1, G2, G3, G4, N5, N6.



29.3.2 A Malicious Control Plane



An attacker who controls the Control Plane, or a GORKA

operator acting under legal compulsion.



What the attacker can do: observe connection metadata,

attempt to route traffic, refuse to route traffic, manipulate

discovery responses.



What the attacker cannot do: decrypt sync traffic, derive the

organization key, reconstruct debtor data.



Relevant properties: G1, G2, G4, G10.



29.3.3 A Malicious Relay



An attacker who controls the relay service.



What the attacker can do: drop messages, delay messages,

reorder messages, attempt to modify messages.



What the attacker cannot do: decrypt messages, undetectably

modify messages.



Relevant properties: G3, G4, G6.



29.3.4 A Compromised Client Device



An attacker who has compromised one of the client's devices —

for example, by extracting the organization key, by controlling

the process, or by having physical access with the database

unlocked.



What the attacker can do: impersonate any device in the

organization, decrypt all sync traffic that reaches that

device, originate any event.



What the attacker cannot do (through the protocol alone):

affect devices that have never been reached by the compromised

device's traffic.



Relevant properties: N1, N7.



The threat model must explicitly analyze the consequences of

endpoint compromise.



29.3.5 A Malicious Peer



An attacker who is an authorized member of the organization —

for example, an agent who has left and retained the key.



What the attacker can do: the same as a compromised client

device, because the attacker holds the organization key.



What the protocol provides: the MVP provides no cryptographic

mechanism for invalidating the attacker's retained organization

key. Disabling the attacker's Control Plane account prevents

future authentication but does not invalidate the key.



Relevant properties: N1, N3, N4.



29.3.6 A Malicious Third Party (Zone 3)



A third party the client connects to directly, outside GORKA's

control.



The client may send data to the third party directly. The

third party is outside GORKA's trust boundary. GORKA does not

mediate the connection and does not see the data.



What the attacker can do: see whatever the client sends to it

(for example, a prompt containing debtor data if the client

chooses to send one).



Relevant properties: the three-zone model (Section 21).



29.4 Attack Surfaces



The threat model must analyze the following attack surfaces:



\- The handshake protocol (Section 8, Section 22.8–22.11).

\- The session-key derivation (Section 8.4).

\- The message encryption and authentication (Section 22.6.3).

\- The enrollment package (Section 5.5, Section 22.7).

\- The relay (Section 20).

\- The Control Plane's APIs (Sections 5, 22.15–22.17).

\- The local database (Sections 6.3, 7.2, 25.4).

\- The SQLCipher key derivation (Section 7.2).

\- The application's use of the local database (Sections 25.8

&#x20; through 25.11).

\- The storage of the organization key (Section 7.1).

\- The storage of the JWT (Section 5.1).



29.5 Known Limitations to Analyze



The threat model must analyze the consequences of these known

limitations:



\- N1 (organization key does not authenticate user/device).

\- N2 (no forward secrecy).

\- N3 (revocation does not erase replicated data).

\- N4 (cannot revoke a single lost machine).

\- N5 (existence of sync is observable).

\- N6 (traffic analysis is not mitigated).

\- N7 (compromised device cannot be trusted).

\- N10 (a malicious peer can originate false events).



29.6 Required Threat-Model Questions



The threat model must evaluate:



\- Whether each identified attacker can compromise

&#x20; confidentiality, integrity, authenticity, availability, or

&#x20; convergence.

\- The consequences of each known limitation.

\- Whether the stated guarantees hold against each attacker

&#x20; class.

\- Which attack surfaces require detailed analysis.

\- Which risks remain after the protocol's existing protections.

\- Which deferred capabilities address identified risks.



29.7 What Section 29 Does Not Do



It does not perform the threat analysis. That is the threat

model document.



It does not rank threats. That is the threat model document.



It does not make recommendations. That is the threat model

document.



It states the inputs the threat model will use.



========================================================================

30\. TEST VECTORS AND ACCEPTANCE IMPLEMENTATION

========================================================================



This section states the test vectors and acceptance tests the

implementation must satisfy. It is the final section of this

document.



The rule of this section, established in Section 1:



&#x20; Section 30 may not define architecture. It only demonstrates

&#x20; architecture already defined in Sections 1 through 29.



If a test vector exposes an ambiguity or a gap in Sections 1

through 29, the fix is applied to the relevant earlier section,

not invented here. The rule is:



&#x20; Architecture -> precise rule -> test vector -> implementation test



Not:



&#x20; implementation -> unexpected behavior -> invent a rule



30.1 The Purpose of Test Vectors



A test vector is a reproducible input-output pair that

demonstrates a specific behavior of the protocol. Test vectors

serve four purposes:



1\. They verify that an implementation matches the specification

&#x20;  byte for byte where byte-exactness is required.



2\. They detect divergence between two implementations of the

&#x20;  protocol.



3\. They provide regression coverage when the implementation

&#x20;  changes.



4\. They serve as executable documentation of the protocol's

&#x20;  behavior.



For the MVP, the test vectors cover the areas where a mistake

would produce a protocol violation, a security failure, or a

convergence failure.



30.1.1 Two Kinds of Test



This section requires two kinds of test.



Deterministic known-answer vectors.



&#x20; These have canonical fixed inputs (test-only UUIDs, device

&#x20; ids, keys, nonces, timestamps) and canonical expected outputs

&#x20; (byte sequences). The expected outputs are defined by the

&#x20; specification, not generated by the implementation under

&#x20; test. They are the equivalent of known-answer test vectors in

&#x20; a cryptographic specification.



&#x20; The deterministic vectors are: E1, H1, H2, H3, M1, M2, and

&#x20; the byte-level portions of V1, V4, and V6.



&#x20; These are the vectors where the protocol's byte-level output

&#x20; is deterministic: a specific input produces a specific

&#x20; output, byte for byte. The companion artifact

&#x20; `SYNC-TEST-VECTORS-v1` contains the fixed inputs and the

&#x20; canonical expected outputs.



Behavioral acceptance tests.



&#x20; These have a defined input state and a defined expected

&#x20; outcome (a protocol state, a set of events accepted, a set of

&#x20; outcomes, a relationship state, an error code), but not a

&#x20; byte-for-byte expected output. They demonstrate that the

&#x20; protocol behaves as specified in a given situation.



&#x20; The behavioral tests are: E2, E3, E4, E5, E6, H4, H5, M3,

&#x20; M4, M5, M6, V2, V3, V5, D1, D2, R1 through R5, P1 through

&#x20; P3, B1 through B3, RP1 through RP3, and BP1.



&#x20; The expected outcomes for behavioral tests are specified in

&#x20; Section 30.3. They are not in the companion artifact, because

&#x20; the companion artifact holds byte-level known answers, not

&#x20; outcome specifications.



Both kinds are required. The distinction matters because the

deterministic vectors detect inter-implementation byte

divergence, while the behavioral tests detect protocol-level

errors.



30.1.2 Where the Deterministic Vectors Live



The deterministic known-answer vectors are recorded in a

version-controlled companion artifact:

`SYNC-TEST-VECTORS-v1`. The artifact contains the fixed inputs

and the canonical expected outputs for the vectors listed in

Section 30.1.1.



The artifact is the specification's authoritative statement of

the expected bytes. It is not produced by the implementation

under test. Two independent implementations that both pass the

companion artifact's vectors agree on the bytes.



The artifact is written after SYNC-ARCHITECTURE.md is frozen,

alongside the amendment pass. It is a companion to this

document, not a replacement. The protocol architecture remains

in Sections 1 through 29.



This section states what each vector must cover. The companion

artifact states the literal values.



The reasons for a separate artifact rather than inline bytes:



\- SYNC-ARCHITECTURE.md remains architectural prose. Mixing

&#x20; large hex dumps into the architecture document reduces its

&#x20; readability.

\- The artifact can be updated as new vectors are added, without

&#x20; amending the architecture document.

\- The artifact's format can be machine-readable (for example, a

&#x20; structured text format), making it directly usable by test

&#x20; suites.



The architecture rule is unchanged: the expected bytes are

defined by the specification, not by the implementation.



The companion artifact holds byte-level known answers only. It

does not hold behavioral outcome specifications. The behavioral

tests' expected outcomes are specified in Section 30.3. This

separation is deliberate: the artifact is a machine-checkable

byte-answer table; the behavioral outcomes are prose

specifications of protocol state.



30.2 The Format of a Test Vector



Each test vector has:



\- An identifier, so that the vector can be referenced from

&#x20; implementation notes and from the test suite.

\- The protocol version the vector applies to (0x0001 for the

&#x20; MVP).

\- The kind: deterministic known-answer, or behavioral.

\- The input: the byte sequence that enters a specific function,

&#x20; or the input state that precedes a specific operation.

\- The operation being tested.

\- The expected output: the byte sequence produced (for

&#x20; deterministic vectors), or the state after the operation

&#x20; (for behavioral tests).

\- Any preconditions (for example, a key that must be set).

\- Any notes on what the vector demonstrates.



For deterministic vectors, the literal input bytes and the

literal expected output bytes are recorded in the companion

artifact `SYNC-TEST-VECTORS-v1`. This document states what each

vector must cover. The artifact states the literal values.



Test fixtures (test-only UUIDs, device ids, keys, nonces,

timestamps) are not production values. They do not constrain the

protocol. They exist so that the test is reproducible.



Cross-references in this section are to the frozen versions of

Sections 1 through 29. All cross-references are audited at

freeze time. If a referenced section is later amended, the

reference in Section 30 is verified against the amended

version and corrected if necessary.



30.3 The Required Test Vectors



The following test vectors are required. Each is stated with

what it covers and what the expected outcome is.



30.3.1 Enrollment Package



E1 — Enrollment package creation.



&#x20; Given a fixed organization key, a fixed passphrase, and a

&#x20; fixed Argon2id parameter set, produce an enrollment package.

&#x20; Verify that the package's header fields are correct, that the

&#x20; magic bytes are correct, and that the encrypted payload

&#x20; length matches the specification (Section 22.7.1).



&#x20; Deterministic. The expected package bytes are in the

&#x20; companion artifact.



E2 — Enrollment package import, correct passphrase.



&#x20; Given the package from E1 and the correct passphrase, import

&#x20; it. Verify that the organization\_id and organization\_key

&#x20; decrypt to the expected values, and that the organization\_id

&#x20; comparison (Section 22.7.4, step 10) succeeds.



&#x20; Behavioral. The expected outcome is a successful import and

&#x20; the correct decrypted values. The decrypted values are the

&#x20; same fixed inputs used in E1; the check is on the outcome,

&#x20; not on byte-level output.



E3 — Enrollment package import, wrong passphrase.



&#x20; Given the package from E1 and a fixed incorrect passphrase,

&#x20; import it. Verify that decryption fails with a clear error

&#x20; and that no key is installed (Section 22.7.4, step 8).



&#x20; Behavioral.



E4 — Enrollment package import, tampered payload.



&#x20; Given the package from E1 with one specific byte of the

&#x20; encrypted payload flipped, import it with the correct

&#x20; passphrase. Verify that decryption fails (AEAD

&#x20; authentication failure) and that no key is installed.



&#x20; Behavioral.



E5 — Enrollment package import, organization mismatch.



&#x20; Given an enrollment package for Organization A and a JWT for

&#x20; Organization B, import it. Verify that the organization\_id

&#x20; comparison fails and that no key is installed

&#x20; (Section 22.7.4, step 10).



&#x20; Behavioral.



E6 — Enrollment package import, wrong magic.



&#x20; Given a file that is not an enrollment package (fixed wrong

&#x20; magic bytes), attempt to import it. Verify that the import

&#x20; rejects the file with a clear error (Section 22.7.4, step 2).



&#x20; Behavioral.



30.3.2 Handshake



H1 — Session-key derivation.



&#x20; Given a fixed organization key, two fixed nonces, and two

&#x20; fixed device\_ids, derive the session key

&#x20; (Section 22.11.1). Verify that the derived key matches the

&#x20; expected value in the companion artifact.



&#x20; Deterministic.



H2 — Handshake proof tag, REPLY.



&#x20; Given a fixed handshake transcript (both nonces, both

&#x20; organization\_ids, both device\_ids, the protocol version), and

&#x20; a fixed handshake authentication key, compute the REPLY

&#x20; proof\_tag (Section 22.9.3). Verify that the tag matches the

&#x20; expected value in the companion artifact.



&#x20; Deterministic.



H3 — Handshake proof tag, CONFIRM.



&#x20; Given the same transcript, compute the CONFIRM proof\_tag

&#x20; (Section 22.10.2). Verify that the tag matches the expected

&#x20; value in the companion artifact, and that it differs from

&#x20; H2's tag.



&#x20; Deterministic.



H4 — Handshake with mismatched proof tag.



&#x20; Given a handshake in which the REPLY proof\_tag is wrong,

&#x20; verify that the initiator rejects the handshake and does not

&#x20; proceed (Section 22.9.4).



&#x20; Behavioral.



H5 — Handshake with organization mismatch.



&#x20; Given a HANDSHAKE\_HELLO whose organization\_id does not match

&#x20; the responder's, verify that the responder rejects the

&#x20; handshake (Section 8.3, step 2).



&#x20; Behavioral.



30.3.3 Message Encryption and Authentication



M1 — SYNC\_MESSAGE encryption.



&#x20; Given a fixed session key, a fixed nonce, and a fixed

&#x20; plaintext SYNC\_MESSAGE, produce the encrypted form

&#x20; (Section 22.13.1). Verify the outer TLV framing, the AAD

&#x20; (the 6-byte outer TLV header), and the AEAD output against

&#x20; the companion artifact.



&#x20; Deterministic.



M2 — SYNC\_MESSAGE decryption, correct session key.



&#x20; Given the encrypted message from M1 and the correct session

&#x20; key, decrypt it. Verify that the plaintext matches M1's

&#x20; input.



&#x20; Deterministic.



M3 — SYNC\_MESSAGE decryption, wrong session key.



&#x20; Given the encrypted message from M1 and a fixed incorrect

&#x20; session key, attempt to decrypt it. Verify that AEAD

&#x20; authentication fails (Section 23.2, code 0x0001) and that no

&#x20; events are processed.



&#x20; Behavioral.



M4 — SYNC\_MESSAGE tampering.



&#x20; Given the encrypted message from M1 with one specific byte of

&#x20; the ciphertext flipped, attempt to decrypt it with the

&#x20; correct session key. Verify that AEAD authentication fails

&#x20; and that no events are processed.



&#x20; Behavioral.



M5 — SYNC\_MESSAGE with modified authenticated outer header.



&#x20; Given the encrypted message from M1, modify a field in the

&#x20; outer TLV header that remains structurally valid, without

&#x20; changing the actual frame length. Attempt to decrypt it with

&#x20; the correct session key. Verify that AEAD authentication

&#x20; fails because the AAD has changed, and that no events are

&#x20; processed.



&#x20; Behavioral.



M6 — SYNC\_MESSAGE with invalid declared length.



&#x20; Given the encrypted message from M1, modify the declared

&#x20; length so that it does not match the received frame. Attempt

&#x20; to process it. Verify that envelope validation rejects the

&#x20; message before decryption (Section 23.2, code 0x0002) and

&#x20; that no SYNC\_ACK is sent.



&#x20; Behavioral.



30.3.4 Event Validation



V1 — Valid DEBTOR\_CREATED.



&#x20; Given a well-formed DEBTOR\_CREATED event, process it. Verify

&#x20; that it passes structural validation, semantic validation,

&#x20; and is accepted (Section 25.8).



&#x20; Deterministic for the event's byte encoding; behavioral for

&#x20; the accept outcome.



V2 — DEBTOR\_CREATED with missing required field.



&#x20; Given a DEBTOR\_CREATED event with the `name` field absent,

&#x20; process it. Verify that it fails semantic validation and

&#x20; receives a REJECTED outcome (Section 25.8.4).



&#x20; Behavioral.



V3 — ENTITY\_UPDATED with duplicate field\_name.



&#x20; Given an ENTITY\_UPDATED event with two change records for the

&#x20; same field\_name, process it. Verify that it is a protocol

&#x20; violation (Section 25.9.3) and that the whole message is

&#x20; rejected (Scenario 10, Section 27).



&#x20; Behavioral.



V4 — ENTITY\_UPDATED attempting deleted = false.



&#x20; Given an ENTITY\_UPDATED event that sets `deleted` to false,

&#x20; process it. Verify that it is rejected as a semantic

&#x20; violation (Section 25.9.4, code 0x0204).



&#x20; Deterministic for the event's byte encoding; behavioral for

&#x20; the reject outcome.



V5 — ACTION\_CREATED with a missing debtor.



&#x20; Given an ACTION\_CREATED event whose referenced debtor does not

&#x20; exist locally, process it. Verify that it is accepted and

&#x20; made pending (Section 25.10.5, step 1a) and that it receives

&#x20; an ACCEPTED outcome.



&#x20; Behavioral.



V6 — COMMUNICATION\_LOGGED with a non-canonical duration.



&#x20; Given a COMMUNICATION\_LOGGED event with `duration` = "01",

&#x20; process it. Verify that it fails semantic validation

&#x20; (Section 25.11.3, canonical duration representation) and

&#x20; receives a REJECTED outcome.



&#x20; Deterministic for the event's byte encoding; behavioral for

&#x20; the reject outcome.



30.3.5 Duplicate Detection



D1 — Duplicate event, same event\_id.



&#x20; Given a device that has already accepted an event, send the

&#x20; same event again. Verify that the second delivery receives a

&#x20; DUPLICATE outcome and that the event is not applied twice

&#x20; (Section 15.2, Section 15.4).



&#x20; Behavioral.



D2 — Duplicate event, no clock advancement.



&#x20; Given the same setup as D1, verify that the duplicate does not

&#x20; advance the receiving device's logical clock

&#x20; (Section 15.3).



&#x20; Behavioral.



30.3.6 Reconciliation



R1 — Two competing state changes, deterministic winner.



&#x20; Given two events that set the same field of the same entity,

&#x20; with protocol-order keys (logical\_clock\_A, device\_A,

&#x20; sequence\_A) and (logical\_clock\_B, device\_B, sequence\_B), where

&#x20; the A key is more recent than the B key, verify that the A

&#x20; event's value wins and the B event's value is recorded in

&#x20; history\_records as the losing value (Section 25.9.9).



&#x20; Behavioral.



R2 — Arrival-order independence.



&#x20; Given the same two events as R1, deliver them in both possible

&#x20; orders (A first, then B; B first, then A). Verify that the

&#x20; final state is the same in both cases, and that the history

&#x20; records are identical (excluding reconciled\_at)

&#x20; (Section 13.4).



&#x20; Behavioral.



R3 — Same value, more recent winner.



&#x20; Given two events that set the same field to the same value,

&#x20; with the second event more recent in protocol order, verify

&#x20; that the state value is unchanged and that the winner metadata

&#x20; in entity\_field\_state is updated to the second event

&#x20; (Section 25.9.9, Case A step 5c).



&#x20; Behavioral.



R4 — Monotonic deleted.



&#x20; Given an event that sets `deleted` to true and a later event

&#x20; (in protocol order) that also sets `deleted` to true, verify

&#x20; that the state remains true and that the later event is the

&#x20; recorded winner (Section 25.9.9, step 8). Given an event that

&#x20; attempts to set `deleted` to false, verify that it is rejected

&#x20; (V4).



&#x20; Behavioral.



R5 — Concurrent creation.



&#x20; Given two DEBTOR\_CREATED events for the same entity\_id,

&#x20; originated by two different devices, verify that the two

&#x20; events are both accepted, and that the reconciliation produces

&#x20; the same final state regardless of arrival order

&#x20; (Section 14.4).



&#x20; Behavioral.



30.3.7 Pending Events



P1 — Event made pending.



&#x20; Given an ENTITY\_UPDATED for an entity that does not exist

&#x20; locally, verify that the event is accepted, appended to

&#x20; sync\_events, and recorded in pending\_events with reason

&#x20; ENTITY\_NOT\_YET\_PRESENT (Section 25.12.1, step 5d).



&#x20; Behavioral.



P2 — Pending event applied when prerequisite arrives.



&#x20; Given P1's pending event, then deliver the DEBTOR\_CREATED that

&#x20; creates the referenced entity. Verify that the pending event

&#x20; is applied, that its domain effect is visible, and that the

&#x20; row is removed from pending\_events (Section 25.4.5,

&#x20; Section 25.7.7 Invariant 2, Section 25.12.2).



&#x20; Behavioral.



P3 — Deterministic pending order.



&#x20; Given two pending events that become applicable at the same

&#x20; time, verify that they are applied in the canonical protocol

&#x20; order (logical\_clock, device\_id, sequence)

&#x20; (Section 25.4.6).



&#x20; Behavioral.



30.3.8 Delivery Bookkeeping



B1 — Watermark advancement.



&#x20; Given a sequence of acknowledged events for a (peer, origin)

&#x20; pair, verify that the watermark advances across contiguous

&#x20; acknowledged prefixes and that the gap set shrinks as the

&#x20; watermark advances (Section 18.2).



&#x20; Behavioral.



B2 — Gap handling.



&#x20; Given acknowledged events at sequence 1, 3, 4 (with 2 not

&#x20; acknowledged), verify that the watermark is at 1, the gap set

&#x20; contains {3, 4}, and sequence 2 is considered undelivered.



&#x20; Behavioral.



B3 — ACK bookkeeping driven by sync\_events.



&#x20; Given an ACK for an event\_id, verify that the origin and

&#x20; sequence used for delivery bookkeeping are derived from the

&#x20; device's own sync\_events record, not from the wire ACK

&#x20; (Section 18.2, step 1).



&#x20; Behavioral.



30.3.9 Receiving Pipeline



RP1 — Full receive path, all accepted.



&#x20; Given a SYNC\_MESSAGE with three valid events, process it.

&#x20; Verify that all three are accepted, that the logical clock

&#x20; advances for each, and that the SYNC\_ACK has three ACCEPTED

&#x20; outcomes (Section 25.12.1).



&#x20; Behavioral.



RP2 — Mixed outcomes.



&#x20; Given a SYNC\_MESSAGE with three events, where one is valid,

&#x20; one is a duplicate, and one is semantically invalid, process

&#x20; it. Verify that the outcomes are ACCEPTED, DUPLICATE, and

&#x20; REJECTED respectively, in the order the events appeared

&#x20; (Section 25.12.1, step 7).



&#x20; Behavioral.



RP3 — Message-level failure, no ACK.



&#x20; Given a SYNC\_MESSAGE that fails AEAD authentication, process

&#x20; it. Verify that no events are processed and no SYNC\_ACK is

&#x20; sent (Section 22.14.2).



&#x20; Behavioral.



30.3.10 Boundary Proof



BP1 — Extended proof test.



&#x20; Run two client devices. Synchronize a debtor record between

&#x20; them through the relay. Capture all traffic traversing the

&#x20; GORKA relay infrastructure during the test. Inspect:



&#x20; - The relay traffic.

&#x20; - Every stored row in device\_registrations.

&#x20; - Every stored row in relay\_sessions.

&#x20; - The relay service's logs and storage, if any.



&#x20; Verify:



&#x20; - The captured traffic is ciphertext.

&#x20; - The stored rows contain only metadata.

&#x20; - No readable debtor data appears in any capture or stored

&#x20;   row.

&#x20; - No key material is present on GORKA's infrastructure.

&#x20; - A captured relay payload cannot be decrypted using the

&#x20;   keys or credentials available to the Control Plane.



&#x20; This is the automated form of the extended proof test defined

&#x20; in BOUNDARY-TEST-PLAN.md §2.4.



&#x20; Behavioral.



30.4 The Acceptance Implementation



The implementation must have a test suite that runs the

required test vectors above. The suite must:



\- Run every vector E1 through E6, H1 through H5, M1 through M6,

&#x20; V1 through V6, D1 through D2, R1 through R5, P1 through P3,

&#x20; B1 through B3, RP1 through RP3, and BP1.

\- Report pass or fail for each.

\- Fail the build if any vector fails.

\- For deterministic vectors, record the literal byte sequences

&#x20; and compare them against the companion artifact

&#x20; `SYNC-TEST-VECTORS-v1`.

\- For behavioral tests, verify the expected outcome.



The implementation chooses the test framework and the test

runner. This document does not specify them. This document

specifies what must be tested.



30.5 The Sync Engine Acceptance Criteria



The sync engine's acceptance is the set of criteria defined in

GORKA-MVP-SCOPE.md §12.1 (the ten criteria) and §12.2 (the

additional sync tests), plus the extended proof test (BP1).



This document's test vectors are the concrete tests that

demonstrate those criteria. Where a criterion in

GORKA-MVP-SCOPE.md §12 is not covered by a vector above, the

implementation must add a vector to cover it, following the

format in Section 30.2.



The mapping:



\- MVP scope §12.1 criterion 1 (initial sync) — BP1.

\- MVP scope §12.1 criterion 2 (new debtor propagation) — V1,

&#x20; RP1, and BP1.

\- MVP scope §12.1 criterion 3 (state update propagation) — R1,

&#x20; R2.

\- MVP scope §12.1 criterion 4 (event propagation, append-only)

&#x20; — RP1, D1, D2.

\- MVP scope §12.1 criterion 5 (offline modification, reconnect)

&#x20; — covered by B1, B2 (delivery bookkeeping), plus a vector

&#x20; that the implementation adds for the offline-reconnect case.

\- MVP scope §12.1 criterion 6 (duplicate prevention) — D1, D2.

\- MVP scope §12.1 criterion 7 (no data loss under normal

&#x20; operation) — RP1, RP2, B1, B2, B3.

\- MVP scope §12.1 criterion 8 (direct connection path) —

&#x20; covered by the transport implementation; a vector for the

&#x20; direct-connection handshake is added by the implementation.

\- MVP scope §12.1 criterion 9 (relay fallback path) — BP1.

\- MVP scope §12.1 criterion 10 (rejection of corrupted or

&#x20; invalid messages) — M3, M4, M5, M6, RP3.



Where a criterion is not yet covered, the implementation adds a

vector. The rule of Section 30 applies: the added vector

demonstrates existing architecture; it does not define new

architecture.



The implementation may add vectors. It may not add

requirements.



30.6 What Section 30 Does Not Do



It does not define architecture. It demonstrates architecture

already defined in Sections 1 through 29. If a vector exposes a

gap, the fix is in the relevant earlier section.



It does not contain the literal byte sequences for the

deterministic vectors. Those are in the companion artifact

`SYNC-TEST-VECTORS-v1`.



It does not specify a test framework or a test runner. It

specifies what must be tested.



It does not replace BOUNDARY-TEST-PLAN.md. That document is the

manual and automated boundary test plan (Phase 15). Section 30

is the sync protocol's test vector specification. The two are

complementary.



It does not replace GORKA-MVP-SCOPE.md §12. That document

defines the MVP's acceptance criteria. Section 30 provides the

concrete vectors that demonstrate them.



It does not allow the implementation to add requirements. The

implementation may add vectors; it may not add requirements.



This completes Section 30. This completes the document.



========================================================================

END OF DOCUMENT

========================================================================













