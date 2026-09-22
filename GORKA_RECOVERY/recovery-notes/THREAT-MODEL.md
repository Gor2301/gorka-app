========================================================================

THREAT MODEL

========================================================================



Document:    THREAT-MODEL.md

Version:     1.0 (frozen)

Date:        September 20, 2026

Status:      FROZEN — approved by the founder on September 20, 2026

Authority:   Subordinate to ARCHITECTURAL-LAW.md v1.3.

            Extends SYNC-ARCHITECTURE.md v1.0 (frozen),

            Sections 28 and 29.



========================================================================

1\. PURPOSE AND STATUS OF THIS DOCUMENT

========================================================================



Purpose



This document analyzes the threats against the GORKA multi-user

synchronization protocol and states which risks are mitigated by

the architecture, which are accepted as residual risk, and which

are deferred to the funded phase.



It is the third of the three documents required before

implementation begins. The first is GORKA-MVP-SCOPE.md (frozen,

v1.1). The second is SYNC-ARCHITECTURE.md (frozen, v1.0). This is

the third.



It does not define the protocol. The protocol is

SYNC-ARCHITECTURE.md. It does not define the guarantees. Those

are Section 28 of SYNC-ARCHITECTURE.md. It does not define the

inputs. Those are Section 29 of SYNC-ARCHITECTURE.md.



It takes the guarantees, the non-guarantees, and the inputs, and

produces the analysis.



Status



FROZEN — approved by the founder on September 20, 2026.



Amendments follow the same process as amendments to the

multi-user concept: documented, approved by the founder,

recorded with reasoning.



Authority and Relationships



This document is subordinate to ARCHITECTURAL-LAW.md v1.3. Where

the two conflict, the law wins.



It is subordinate to SYNC-ARCHITECTURE.md v1.0. Where the two

conflict, SYNC-ARCHITECTURE.md wins, and this document is

corrected.



It is subordinate to GORKA-MVP-SCOPE.md v1.1. Where the two

conflict, GORKA-MVP-SCOPE.md wins, and this document is

corrected.



MULTI-USER-CONCEPT.md v2.0 is historical background material.
Where it conflicts with the frozen documents, the frozen
documents govern. For protocol behavior, SYNC-ARCHITECTURE.md
v1.0 is authoritative.



It inherits its inputs from SYNC-ARCHITECTURE.md Sections 28

(guarantees, non-guarantees, deferred capabilities) and 29

(assets, trust boundaries, attackers, attack surfaces, known

limitations, and the required threat-model questions).



What This Document Is



\- The analysis of the threats against the protocol.

\- The severity of each threat, stated on the scale in Section

 2.2.

\- The categorization of each threat: mitigated by the

 architecture, accepted as residual risk, or deferred to the

 funded phase.

\- The list of residual risks.

\- The founder's decisions on which residual risks are accepted.

\- The mapping from residual risks to deferred capabilities.



What This Document Is Not



\- Not the protocol. That is SYNC-ARCHITECTURE.md.

\- Not the guarantees. Those are SYNC-ARCHITECTURE.md Section 28.

\- Not the inputs. Those are SYNC-ARCHITECTURE.md Section 29.

\- Not a security review of the implementation. This document

 analyzes the protocol. It does not audit code. A separate

 implementation audit is a funded-phase item (D10 and D11).

\- Not a legal or regulatory analysis. Compliance with specific

 laws is a separate concern.

\- Not a schedule.



The Document Sequence



The three documents required before implementation:



1\. GORKA-MVP-SCOPE.md — frozen. Defines what the MVP must do.

2\. SYNC-ARCHITECTURE.md — frozen. Defines how the sync engine

  does it.

3\. THREAT-MODEL.md — this document. Analyzes what can go wrong.



Only after all three are written and approved does

implementation begin.



How to Read This Document



Section 2 states the method: the definitions used throughout,

the severity scale, the capability-versus-impact principle, and

the assumptions the analysis rests on.



Section 3 restates the assets and the attacker classes. It is a

summary, not new analysis. It exists so that this document is

self-contained.



Sections 4, 5, and 6 analyze threats by category:

confidentiality, integrity and authenticity, and availability

and convergence. Each threat is presented in a table, followed

by prose where the table cannot carry the meaning.



Section 7 analyzes the endpoint compromise case separately. It

is the case where the protocol's protections do not apply, and

it has fundamentally different properties from the other

attacker classes.



Section 8 lists the residual risks. It separates the technical

finding from the founder's decision.



Section 9 states what this document does not cover.



Section 10 records the sign-off.



Source: SYNC-ARCHITECTURE.md v1.0 Sections 28, 29;

GORKA-MVP-SCOPE.md v1.1 Section 11.



========================================================================

2\. METHOD

========================================================================



2.1 The Three Categories



This document analyzes each threat against the GORKA protocol and

places it in one of three categories.



Mitigated by the architecture.



 The protocol contains a defined mechanism that prevents the

 stated attack, or prevents the attacker from achieving the

 stated impact under the assumptions of this threat model.



 The relevant guarantee from SYNC-ARCHITECTURE.md Section 28

 applies. The guarantee is named.



Accepted residual risk.



 The protocol does not prevent the stated attack. The attack

 succeeds or partially succeeds, and the resulting risk

 remains. The founder decides whether to accept it for the

 MVP. The decision is recorded in Section 8.



Deferred to the funded phase.



 The protocol does not prevent the stated attack in the MVP,

 and a specific deferred capability (from SYNC-ARCHITECTURE.md

 Section 28.3) is planned to address it.



Every threat in this document falls into exactly one category.

Nothing is left unclassified.



Note on "mitigated." The word does not mean "impossible." It

means the architecture provides a defined mechanism against the

threat, within the assumptions of this threat model. Whether any

residual risk remains after mitigation is a separate question,

answered in Section 8.



A threat may be mitigated with respect to its primary security

impact while leaving a separate residual exposure. The mitigation

classification applies to the stated threat; the residual

exposure is recorded separately and, where applicable, becomes a

residual risk in Section 8.



For example, a network observer's threat to the confidentiality

of debtor data is mitigated by end-to-end encryption. The same

observer's ability to see traffic metadata is a separate residual

exposure. Both are recorded. The first is classified Mitigated.

The second is classified Residual and appears in Section 8.



2.2 The Severity Scale



Each threat is assigned a severity. The scale describes the

impact if the threat is realized. It does not depend on whether

the protocol can detect the attack, because detectability is a

property of the mechanism, not of the impact.



Critical



 Compromise can expose or materially alter debtor data, the

 organization key, the session keys, or the trusted

 synchronization state.



High



 Compromise can prevent synchronization, cause persistent

 operational disruption, or cause unauthorized changes that

 are detectable but require intervention to correct.



Medium



 Compromise causes meaningful metadata exposure, requires

 recovery or re-enrollment, or has limited operational impact.



Low



 Compromise is theoretical, requires an unusual combination of

 conditions, or has negligible practical consequence.



The severity scale is deliberately impact-based. It applies to

every attacker class in the same way. It does not depend on the

attacker's identity.



2.3 Capability Versus Impact



This document distinguishes what an attacker can technically do

from the resulting security impact.



An attacker may possess a capability without being able to use

it to violate a particular guarantee.



For example, a network observer can read the bytes of an

encrypted sync message. That is a capability. It does not give

the attacker the ability to read debtor data, because the

message is end-to-end encrypted. The capability exists; the

impact does not.



Each analysis in Sections 4, 5, and 6 identifies:



\- The attacker's capability.

\- The affected asset.

\- The applicable guarantee or non-guarantee.

\- The resulting impact.

\- The residual risk.



This structure is applied consistently. It is not adjusted per

attacker.



2.4 Mitigated Does Not Mean Impossible



A threat that is "mitigated by the architecture" is a threat

against which the protocol provides a defined mechanism that

prevents the stated attack or prevents the attacker from

achieving the stated impact, within the assumptions of this

threat model.



It is not a claim that no attacker could ever succeed.



For example, the protocol treats a UUIDv7 collision as

negligible (SYNC-ARCHITECTURE.md Section 10.6). That does not

mean a collision is impossible. It means the probability is

sufficiently low that no protocol decision depends on the

collision being impossible.



When a threat is stated as mitigated, the guarantee or

architectural mechanism it relies on is named.



2.5 What "the MVP" Means in This Document



This document analyzes the protocol as defined in

SYNC-ARCHITECTURE.md v1.0, which is the MVP.



It does not analyze the funded-phase protocol, because the

funded-phase protocol does not yet exist. Where a deferred

capability is named, it is named only to show which future work

addresses the residual risk. The funded-phase design will be

analyzed separately when it is written.



2.6 Client Security Assumptions



This document assumes the client behaves as the protocol

expects. The assumptions are:



Assumption C1. The client keeps its local password secret.



 The local password unlocks the SQLCipher database. It is not

 the Control Plane password and not the organization key. If

 the client discloses it, the assumptions of this document do

 not apply.



Assumption C2. The client keeps devices physically and

process-secured when the local database is unlocked.



 When the database is unlocked, the debtor data is readable by

 any process on the device that has the appropriate access. The

 operating system is the enforcement mechanism. If the client

 leaves an unlocked device accessible to an attacker, the

 assumptions of this document do not apply.



Assumption C3. The client transmits the enrollment package and

passphrase through channels the client considers trusted.



 This is an operational security dependency, not an assumption

 about the client's behavior in general. The security of

 enrollment depends on the channel. SYNC-ARCHITECTURE.md

 Section 5.8 states the enrollment threat model. Section 4 of

 this document analyzes it.



Assumption C4. The client does not intentionally disclose

debtor data to untrusted third parties.



 If the client connects GORKA to a third party by a path GORKA

 does not control (Zone 3, law §21.3), GORKA warns. What

 happens after the client chooses to send data to that third

 party is outside the protocol's control.



If the client does not behave as these assumptions expect, the

protocol's protections may not apply. This is stated in

SYNC-ARCHITECTURE.md Sections 5.8 (enrollment) and 8.6

(identity and authorization), and it is restated here.



2.7 Control Plane Assumptions



2.7.1 Intended Control Plane Behavior



The protocol's intended Control Plane behavior is:



\- Holds no organization key.

\- Cannot decrypt sync traffic.

\- Does not store ciphertext.

\- Stores only the metadata permitted by Section 21.3 of

 SYNC-ARCHITECTURE.md.



This is the intended architectural behavior. The guarantee G1

(Control Plane has no organization key) and G10 (Control Plane

cannot reconstruct debtor data) hold under this behavior.



The threat model does not assume that the Control Plane will

remain honest; Section 2.7.2 analyzes the consequences if it

does not.



2.7.2 Adversarial Case



The threat model also considers what happens if the Control Plane

does not behave as the architecture intends — if it is malicious,

or compromised, or acting under legal compulsion.



In that case, the protocol's guarantees still hold. A malicious

Control Plane still cannot decrypt debtor data, because it does

not hold the organization key. Its abilities are limited to what

SYNC-ARCHITECTURE.md Section 29.3.2 states: observing

connection metadata, refusing to route traffic, manipulating

discovery responses. Section 4 and Section 6 of this document

analyze those abilities.



The reason both statements appear is that they answer two

different questions. Section 2.7.1 states what the architecture

intends. Section 2.7.2 states what the threat model does when

that intention is violated.



2.8 What This Section Does Not Do



It does not analyze threats. That is Sections 4 through 7.



It does not list residual risks. That is Section 8.



It states the method: how threats are categorized, how severity

is assigned, what "mitigated" means, what "accepted" means, the

capability-versus-impact principle, and the assumptions the

analysis rests on.



Source: SYNC-ARCHITECTURE.md v1.0 Section 28 (guarantees and

non-guarantees), Section 29 (inputs), Section 5.8 (enrollment

security), Section 8.6 (identity and authorization), Section

21.3 (permitted operational metadata).



========================================================================

3\. ASSETS AND ATTACKERS (SUMMARY)

========================================================================



This section restates, in one page, the assets and the attacker

classes from SYNC-ARCHITECTURE.md Section 29. It is a summary,

not new analysis. It exists so that this document is

self-contained.



Source: SYNC-ARCHITECTURE.md v1.0 Section 29.1 (assets) and

Section 29.3 (attackers).



\------------------------------------------------------------------------

3.1 Assets to Protect

\------------------------------------------------------------------------



The protocol protects the following assets. They are listed in

the order of importance used throughout this document.



1\. Debtor and related business data at rest on each client

  device.



  The debtor records, actions, communications, and other

  locally stored business data in the client's local SQLCipher

  database. This includes both synchronized MVP entities and

  local-only data. The local database encryption protects both

  categories.



2\. Synchronized debtor data in transit between client devices.



  Debtor, action, and communication data represented by MVP

  sync events, moving between the client's own devices,

  encrypted end to end.



3\. The organization key.



  The single symmetric secret shared by every authorized device

  in the organization. It is the root of the MVP's

  application-layer protection.



4\. The session keys.



  Derived from the organization key for each session. Used to

  encrypt and authenticate sync messages. Ephemeral.



5\. The integrity of the event stream.



  The guarantee that accepted events are not silently altered,

  duplicated, or dropped.



6\. The convergence guarantee.



  The guarantee that two devices with the same accepted events

  reach the same final state, regardless of arrival order.



7\. The user's local password.



  Unlocks the SQLCipher database. Separate from the

  organization key and from the Control Plane credentials.



8\. The user's Control Plane credentials.



  Email and password. Used to authenticate to the Control

  Plane. Do not carry debtor data.



9\. The enrollment package and the passphrase that protects it.



  The one place the organization key leaves a device. The

  security of enrollment depends on the client's handling of

  these.



A note on synchronized versus local-only data:



The local SQLCipher database contains both synchronized MVP

entities and local-only data.



Synchronized in the MVP: debtor records, action records,

communication records. These participate in the sync protocol.



Local-only in the MVP: debt records, document metadata, document

contents, and AI prompts and responses. These are stored in the

local database but are not represented in sync events

(SYNC-ARCHITECTURE.md Section 25.9.2, MVP scope §8.4).



The asset list above includes both, because both are protected by

the local database's encryption at rest (G8). Only the

synchronized entities are protected by the sync protocol's

end-to-end encryption (G2).



\------------------------------------------------------------------------

3.2 Trust and Security Boundaries

\------------------------------------------------------------------------



The protocol has four relevant trust and security boundaries.

They are restated here from SYNC-ARCHITECTURE.md Section 29.2.



1\. Client device ↔ Control Plane.

  The client authenticates with the mechanism in

  SYNC-ARCHITECTURE.md Section 5. TLS protects the transport.

  No debtor data crosses this boundary.



2\. Client device ↔ peer.

  Peers authenticate with the organization key. The session is

  end-to-end encrypted. Debtor data crosses this boundary, but

  encrypted.



3\. Client device ↔ third party (Zone 3).

  GORKA is not on the path. The client is responsible for the

  third party's handling of data. GORKA warns (Zone 3, law

  §21.3) but does not mediate.



4\. Client device ↔ local storage.

  The operating system protects the database file. SQLCipher

  protects the data at rest.



Boundaries 1, 2, and 3 are network trust boundaries.

Boundary 4 is an endpoint security boundary.



\------------------------------------------------------------------------

3.3 Attackers the Threat Model Considers

\------------------------------------------------------------------------



Six attacker classes are considered. They are restated here from

SYNC-ARCHITECTURE.md Section 29.3. Each is referenced by number

throughout this document.



A1. Network observer.



 A passive attacker between the client and the Control Plane,

 or between the client and the relay. Sees ciphertext and

 connection metadata. Cannot decrypt, cannot modify

 undetectably.



 Relevant guarantees: G1, G2, G3, G4.

 Relevant non-guarantees: N5 (existence of sync is

 observable), N6 (traffic analysis is not mitigated).



A2. Malicious Control Plane.



 An attacker who controls the Control Plane, or a GORKA

 operator acting under legal compulsion. Can observe

 connection metadata, refuse to route traffic, manipulate

 discovery responses. Cannot decrypt sync traffic, cannot

 derive the organization key, cannot reconstruct debtor data.



 Relevant guarantees: G1, G2, G4, G10.



A3. Malicious relay.



 An attacker who controls the relay service. Can drop, delay,

 reorder, or attempt to modify messages. Cannot decrypt or

 undetectably modify.



 Relevant guarantees: G3, G4, G6.



A4. Compromised client device.



 An attacker who has compromised one of the client's devices —

 by extracting the organization key, by controlling the

 process, or by physical access with the database unlocked.



 A compromised device can originate events, and those events

 may propagate to other authorized devices through the normal

 synchronization topology. A compromised spoke, for example,

 can affect another spoke through the hub.



 The MVP protocol does not provide a cryptographic mechanism

 to distinguish malicious events originated by a holder of the

 organization key from legitimate events originated by that

 holder.



 Relevant non-guarantees: N1 (organization key does not

 authenticate a specific user or device), N7 (a compromised

 device cannot be trusted).



 This is the case where endpoint compromise defeats the trust

 assumptions on which the protocol's cryptographic

 authorization rests. It is analyzed separately in Section 7

 of this document.



A5. Malicious peer.



 An attacker who is an authorized member of the organization —

 for example, an agent who has left and retained the key.



 This is distinct from A4 in its operational origin. A4 is

 device compromise. A5 is legitimate authorization with

 retained cryptographic authority. The two have overlapping

 cryptographic capabilities, but different operational

 implications.



 A malicious peer has substantially the same cryptographic

 capabilities as a compromised client device because it

 possesses the organization key. The MVP provides no

 cryptographic mechanism for invalidating the retained key.



 Relevant non-guarantees: N1, N3 (revocation does not erase

 previously replicated data), N4 (cannot revoke a specific

 lost machine).



A6. Malicious third party (Zone 3).



 A third party the client connects to directly, outside

 GORKA's control. The client may send data to the third party

 directly. GORKA does not mediate the connection and does not

 see the data.



 Relevant property: the three-zone model (law §21).



\------------------------------------------------------------------------

3.4 The Guarantees Referenced in This Section

\------------------------------------------------------------------------



For convenience, the guarantees and non-guarantees referenced

above are listed here by their identifiers.



This subsection is a reference index only. The identifiers and

wording below are copied from SYNC-ARCHITECTURE.md Section 28

and are not independently authoritative. If Section 28 changes,

this document is amended to match. The authoritative text is in

SYNC-ARCHITECTURE.md Section 28.



Guarantees:



 G1. Control Plane has no organization key.

 G2. Sync payloads are end-to-end encrypted.

 G3. Messages are authenticated.

 G4. The relay cannot decrypt or undetectably modify.

 G5. Duplicate delivery does not duplicate application.

 G6. Corrupted or tampered messages are rejected.

 G7. Convergence is deterministic.

 G8. The local database is encrypted at rest.

 G9. Organization isolation.

 G10. The Control Plane cannot reconstruct debtor data.

 G11. Deletion is monotonic.

 G12. The protocol order does not depend on wall-clock time.



Non-guarantees:



 N1. The organization key does not authenticate a specific

     user or device.

 N2. There is no forward secrecy.

 N3. Revocation does not erase previously replicated data.

 N4. The MVP cannot revoke a specific lost machine.

 N5. The protocol does not hide the existence of

     synchronization.

 N6. The protocol does not prevent traffic analysis.

 N7. A compromised device cannot be trusted.

 N8. The protocol does not synchronize debt or document data.

 N9. The protocol does not synchronize AI prompts or

     responses.

 N10. The protocol does not prevent a malicious peer from

      originating false events.

 N11. The protocol does not provide a global total order

      across all events.



\------------------------------------------------------------------------

3.5 What This Section Does Not Do

\------------------------------------------------------------------------



It does not analyze threats. That is Sections 4 through 7.



It does not assign severity. That is Sections 4 through 7.



It restates the assets, the boundaries, and the attacker

classes, and it provides the identifiers for the guarantees and

non-guarantees used in the rest of this document.



Source: SYNC-ARCHITECTURE.md v1.0 Section 28, Section 29.1,

Section 29.2, Section 29.3.



========================================================================

4\. THREAT ANALYSIS — CONFIDENTIALITY

========================================================================



This section analyzes whether each attacker class can read debtor

data. It covers A1 (network observer), A2 (malicious Control

Plane), A3 (malicious relay), and A6 (malicious third party,

Zone 3).



A4 (compromised client device) and A5 (malicious peer) are

analyzed in full in Section 7. They are not covered here.



Each entry states:



\- The attacker's capability.

\- The affected asset.

\- Whether the attacker can read plaintext.

\- The applicable guarantee.

\- The residual exposure.

\- The applicable non-guarantee, if any.

\- The severity.

\- The classification: Mitigated, Residual, or Deferred.



The severity scale is Section 2.2. The capability-versus-impact

principle is Section 2.3.



\------------------------------------------------------------------------

4.1 Summary Table

\------------------------------------------------------------------------



 +------+---------------------+----------+-----------+--------+----------+----------+----------------+

 | Att. | Capability          | Target   | Plaintext | Guar.  | Residual | Sever.   | Classification |

 +------+---------------------+----------+-----------+--------+----------+----------+----------------+

 | A1   | Observe ciphertext  | Data in  | No        | G2,G3, | Traffic  | Low      | Mitigated      |

 |      | + connection meta.  | transit  |           | G4     | metadata |          | (N5,N6)        |

 +------+---------------------+----------+-----------+--------+----------+----------+----------------+

 | A2   | Observe connection  | Data in  | No        | G1,G2, | Traffic  | Low      | Mitigated      |

 |      | metadata; refuse    | transit  |           | G4,G10 | metadata |          |                |

 |      | coordination;       |          |           |        |          |          |                |

 |      | manipulate          |          |           |        |          |          |                |

 |      | discovery           |          |           |        |          |          |                |

 +------+---------------------+----------+-----------+--------+----------+----------+----------------+

 | A3   | Drop, delay,        | Data in  | No        | G2,G3, | Traffic  | Low      | Mitigated      |

 |      | reorder, attempt    | transit  |           | G4,G6  | metadata |          |                |

 |      | to modify           |          |           |        |          |          |                |

 +------+---------------------+----------+-----------+--------+----------+----------+----------------+

 | A6   | Receive what client | Data     | Depends  | Zone 3 | Client's | Medium   | Residual       |

 |      | sends directly      | sent to  | on       | model  | choice   |          | (client        |

 |      |                     | Zone 3   | what     | (law   |          |          |  decision)     |

 |      |                     |          | client   | §21)   |          |          |                |

 |      |                     |          | sends    |        |          |          |                |

 +------+---------------------+----------+-----------+--------+----------+----------+----------------+



The table is the summary. Each entry is expanded below.



\------------------------------------------------------------------------

4.2 A1 — Network Observer

\------------------------------------------------------------------------



Table entry:



 Attacker:           A1, network observer.

 Capability:         Observe ciphertext and connection metadata

                     (timing, size, direction, endpoints).

 Target:             Debtor data in transit between client

                     devices.

 Can read plaintext? No.

 Applicable guarantee: G2 (sync payloads are end-to-end

                     encrypted), G3 (messages are

                     authenticated), G4 (the relay cannot

                     decrypt or undetectably modify).

 Residual exposure:  Traffic metadata. The observer sees that

                     two devices communicated, when, and how

                     much.

 Applicable non-guarantee: N5 (existence of sync is

                     observable), N6 (traffic analysis is not

                     mitigated).

 Severity:           Low.

 Classification:     Mitigated.



Prose.



The network observer sees the bytes of every sync message. It

cannot read them, because every sync message is encrypted with

the session key under XChaCha20-Poly1305 (G2). It cannot modify

them undetectably, because the AEAD authentication tag fails at

the receiving peer (G3, G4, G6).



The observer does see connection metadata. This is N5. The

observer also sees transport-level characteristics such as

message timing and size, which could permit some inference about

business activity. This is N6. Neither exposes plaintext debtor

data.



Severity Low: the observer gains no access to debtor data and

no ability to alter it undetectably. The residual exposure is

metadata, which is a known and documented non-guarantee.



Classification Mitigated: the architecture provides defined

mechanisms (G2, G3, G4) against the confidentiality and

integrity threats. The residual metadata exposure is

acknowledged via N5 and N6, and its acceptance is decided in

Section 8.



\------------------------------------------------------------------------

4.3 A2 — Malicious Control Plane

\------------------------------------------------------------------------



Table entry:



 Attacker:           A2, malicious Control Plane.

 Capability:         Observe connection metadata. Refuse

                     coordination. Manipulate discovery

                     responses. Interfere with signaling.

                     Prevent or delay establishment of a sync

                     path.

 Target:             Debtor data in transit between client

                     devices.

 Can read plaintext? No.

 Applicable guarantee: G1 (Control Plane has no organization

                     key), G2 (sync payloads are end-to-end

                     encrypted), G4 (the relay cannot decrypt

                     or undetectably modify), G10 (the Control

                     Plane cannot reconstruct debtor data).

 Residual exposure:  Traffic metadata. The Control Plane sees

                     which devices communicated, when, and how

                     much.

 Applicable non-guarantee: N5 (existence of sync is

                     observable), N6 (traffic analysis is not

                     mitigated).

 Severity:           Low.

 Classification:     Mitigated.



Prose.



The malicious Control Plane can manipulate discovery responses,

refuse to coordinate the rendezvous between two client devices,

interfere with signaling, and prevent or delay the establishment

of a sync path. These are availability concerns; they are

analyzed in Section 6.



For confidentiality, the Control Plane has no advantage over A1.

It cannot read debtor data, because it does not hold the

organization key (G1) and the sync traffic is end-to-end

encrypted (G2). It cannot reconstruct debtor data from the

metadata it sees (G10).



The Control Plane can observe that two devices in an

organization communicated, when, and how much. This is N5. It

also sees transport-level characteristics. This is N6.



The confidentiality impact is low. What the Control Plane can do

is affect availability and observe metadata.



Severity Low: confidentiality is protected by G1, G2, and G10.



Classification Mitigated: the architecture provides defined

mechanisms against confidentiality compromise even when the

Control Plane is malicious. The residual metadata exposure is

acknowledged via N5 and N6.



\------------------------------------------------------------------------

4.4 A3 — Malicious Relay

\------------------------------------------------------------------------



Table entry:



 Attacker:           A3, malicious relay.

 Capability:         Drop, delay, reorder, or attempt to

                     modify forwarded ciphertext.

 Target:             Debtor data in transit through the relay.

 Can read plaintext? No.

 Applicable guarantee: G2 (sync payloads are end-to-end

                     encrypted) for confidentiality. G3

                     (messages are authenticated), G4 (the

                     relay cannot decrypt or undetectably

                     modify), G6 (corrupted or tampered

                     messages are rejected) for integrity.

 Residual exposure:  Traffic metadata. The relay sees the

                     same operational metadata as the Control

                     Plane (it is part of the Control Plane).

 Applicable non-guarantee: N5, N6.

 Severity:           Low.

 Classification:     Mitigated.



Prose.



The malicious relay can do everything A1 can do, plus it can

attempt to alter the bytes it forwards. It cannot succeed,

because every modification fails AEAD authentication at the

receiving peer (G3, G4, G6). The receiving peer rejects the

message and does not process it.



The relay cannot read debtor data. The primary confidentiality

guarantee is G2: sync payloads are end-to-end encrypted, so the

relay has no key to decrypt them. It also does not hold the

organization key (G1 by inheritance — the relay is part of the

Control Plane, and the Control Plane has no key).



Severity Low: confidentiality is protected by G2, and integrity

is protected by G3, G4, G6.



Classification Mitigated: the architecture provides defined

mechanisms against confidentiality and integrity compromise by

the relay. The residual metadata exposure is acknowledged via

N5 and N6.



\------------------------------------------------------------------------

4.5 A6 — Malicious Third Party (Zone 3)

\------------------------------------------------------------------------



Table entry:



 Attacker:           A6, malicious third party.

 Capability:         Receive whatever the client sends to it.

                     A6 is not an attacker against the

                     device-to-device synchronization

                     protocol. It is an attacker against data

                     that the client voluntarily sends through

                     a Zone 3 path outside GORKA's control.

 Target:             Debtor data that the client chooses to

                     send directly to the third party.

 Can read plaintext? Depends on what the client sends. If the

                     client sends debtor data to the third

                     party, the third party receives it.

 Applicable guarantee: None from the sync protocol. The

                     three-zone model applies (law §21). Zone 3

                     is client-controlled; GORKA warns but does

                     not mediate.

 Residual exposure:  Whatever the client sends. This is the

                     client's decision, made on a path GORKA

                     does not control.

 Applicable non-guarantee: None applicable in the sense of a

                     protocol guarantee. The marketing

                     statement's interpretation is in law

                     §21.4.

 Severity:           Medium.

 Classification:     Residual (client decision).



Prose.



A6 is not an attacker against the device-to-device

synchronization protocol. It is an attacker against data that

the client voluntarily sends through a Zone 3 path outside

GORKA's control.



The client's device may send debtor data to the third party. For

example, the client may connect GORKA to a third-party AI service

by a route that is not GORKA's built-in connector (Zone 3). If

the client does this, the debtor data leaves the client's machine

and reaches the third party by the client's own act.



GORKA's obligation in Zone 3 is warning. The law (§21.3) requires

that GORKA warn the client at the point of connection and record

the warning. GORKA does not mediate the connection. GORKA does

not see the data.



The protocol's confidentiality guarantees do not apply to Zone 3,

because Zone 3 is outside the protocol. The relevant architectural

statement is the three-zone model.



Severity Medium: the potential impact is disclosure of debtor

data to a party outside GORKA's control. It is Medium rather than

Critical because it requires the client's own decision to send

data, and GORKA's obligation is warning, not prevention. It is

Medium rather than Low because the client's decision is a

realistic action, and the consequences of disclosure to a third

party may be material.



Classification Residual: the protocol does not prevent this. The

law requires GORKA to warn. The founder's decision on accepting

this residual risk for the MVP is recorded in Section 8.



\------------------------------------------------------------------------

4.6 What This Section Does Not Do

\------------------------------------------------------------------------



It does not analyze A4 (compromised client device) or A5

(malicious peer). Those are analyzed in full in Section 7.



It does not analyze integrity, authenticity, availability, or

convergence. Those are Sections 5 and 6.



It does not record the founder's decisions on residual risks.

That is Section 8.



It states, for the attackers A1, A2, A3, and A6, whether each

can read debtor data, and classifies the threat.



Source: SYNC-ARCHITECTURE.md v1.0 Section 28 (G1–G4, G6, G10,

N5, N6), Section 29.3 (attackers), Section 21 (relay metadata).

ARCHITECTURAL-LAW.md v1.3 Section 21 (three zones).



========================================================================

5\. THREAT ANALYSIS — INTEGRITY AND AUTHENTICITY

========================================================================



This section analyzes whether each attacker class can modify

debtor data, forge events, or impersonate a device. It covers A1

(network observer), A2 (malicious Control Plane), A3 (malicious

relay), and A6 (malicious third party, Zone 3).



A4 (compromised client device) and A5 (malicious peer) are

analyzed in full in Section 7. They are not covered here.



Each entry states:



\- The attacker's capability.

\- The affected asset.

\- Whether the attacker can modify undetectably, forge, or

 impersonate.

\- The applicable guarantee.

\- The residual exposure.

\- The applicable non-guarantee, if any.

The severity scale is Section 2.2. The capability-versus-impact

principle is Section 2.3.



\------------------------------------------------------------------------

5.1 Summary Table

\------------------------------------------------------------------------



 +------+---------------------+----------+----------+--------+----------+----------+----------------+

 | Att. | Capability          | Target   | Modify?  | Guar.  | Residual | Sever.   | Classification |

 +------+---------------------+----------+----------+--------+----------+----------+----------------+

 | A1   | Observe only.       | Data in  | No       | G3,G4, | None     | Low      | Mitigated      |

 |      | Cannot inject,      | transit  |          | G6     |          |          |                |

 |      | alter, or drop.     |          |          |        |          |          |                |

 +------+---------------------+----------+----------+--------+----------+----------+----------------+

 | A2   | Refuse              | Data in  | No       | G3,G4, | None     | Low      | Mitigated      |

 |      | coordination;       | transit  |          | G6     |          |          |                |

 |      | manipulate          |          |          |        |          |          |                |

 |      | discovery           |          |          |        |          |          |                |

 +------+---------------------+----------+----------+--------+----------+----------+----------------+

 | A3   | Attempt to modify   | Data in  | No       | G3,G4, | None     | Low      | Mitigated      |

 |      | messages in transit | transit  |          | G6     |          |          |                |

 +------+---------------------+----------+----------+--------+----------+----------+----------------+

 | A6   | Receive data sent   | Data     | No       | Zone 3 | Client's | Low      | Residual       |

 |      | by the client       | sent to  | (out of  | model  | decision |          | (client        |

 |      |                     | Zone 3   | scope)   |        |          |          |  decision)     |

 +------+---------------------+----------+----------+--------+----------+----------+----------------+



The table is the summary. Each entry is expanded below.



Note on forgery and impersonation: forgery of valid events and

impersonation of a device require possession of the organization

key. A1, A2, A3, and A6 do not possess it. Forgery and

impersonation are analyzed in Section 7 (A4 and A5).



\------------------------------------------------------------------------

5.2 A1 — Network Observer

\------------------------------------------------------------------------



Table entry:



 Attacker:           A1, network observer.

 Capability:         Observe ciphertext and connection

                     metadata. A1 is a passive observer. It

                     does not inject, alter, or drop messages.

 Target:             Debtor data in transit between client

                     devices.

 Can modify undetectably? No.

 Applicable guarantee: G3 (messages are authenticated), G4 (the

                     relay cannot decrypt or undetectably

                     modify), G6 (corrupted or tampered messages

                     are rejected).

 Residual exposure:  None. A1 does not attempt to modify or

                     inject sync traffic.

 Applicable non-guarantee: None.

 Severity:           Low.

 Classification:     Mitigated.



Prose.



Because A1 is defined as a passive observer, it does not attempt

to modify or inject sync traffic. Its passive observation

therefore cannot directly alter synchronization state.



If a network attacker actively modifies bytes on the wire, that

is a different attacker class. It would have to be defined in

SYNC-ARCHITECTURE.md Section 29.3 first. It is not A1.



The guarantees G3, G4, and G6 remain relevant as defenses if a

different, active, network attacker were later introduced. For

A1 itself, they are not exercised, because A1 does not attack

integrity.



Severity Low: passive observation does not affect integrity.



Classification Mitigated: the passive observer cannot affect

integrity.



\------------------------------------------------------------------------

5.3 A2 — Malicious Control Plane

\------------------------------------------------------------------------



Table entry:



 Attacker:           A2, malicious Control Plane.

 Capability:         Refuse coordination. Manipulate discovery

                     responses. Interfere with signaling.

                     Prevent or delay establishment of a sync

                     path.

 Target:             Debtor data in transit between client

                     devices.

 Can modify undetectably? No.

 Applicable guarantee: G3 (messages are authenticated), G4 (the

                     relay cannot decrypt or undetectably

                     modify), G6 (corrupted or tampered messages

                     are rejected).

 Residual exposure:  None for integrity. The Control Plane

                     cannot forge or undetectably alter sync

                     messages.

 Applicable non-guarantee: None applicable to integrity.

                     Availability is affected, and is analyzed

                     in Section 6.

 Severity:           Low.

 Classification:     Mitigated.



Prose.



The malicious Control Plane can interfere with routing, refuse to

coordinate the rendezvous between two client devices, manipulate

discovery responses, and prevent or delay the establishment of a

sync path. Those are availability concerns, and they are analyzed

in Section 6.



For integrity, the Control Plane has no advantage over A1. It

cannot modify sync messages undetectably (G3, G4, G6). It cannot

forge valid messages, because it does not possess the session

key or the organization key (G1, G2). Message-level manipulation

of forwarded ciphertext is a relay capability (A3), not a

Control Plane capability.



The Control Plane cannot impersonate a device. Impersonation

requires the organization key (G1).



Severity Low for integrity: the Control Plane cannot alter

debtor data undetectably.



Classification Mitigated: the architecture provides G3, G4, and

G6 against integrity compromise by the Control Plane.



\------------------------------------------------------------------------

5.4 A3 — Malicious Relay

\------------------------------------------------------------------------



Table entry:



 Attacker:           A3, malicious relay.

 Capability:         Drop, delay, reorder, or attempt to

                     modify messages.

 Target:             Debtor data in transit through the relay.

 Can modify undetectably? No.

 Applicable guarantee: G3 (messages are authenticated), G4 (the

                     relay cannot decrypt or undetectably

                     modify), G6 (corrupted or tampered messages

                     are rejected).

 Residual exposure:  None for integrity. Dropping and delay

                     affect availability, analyzed in Section

                     6.

 Applicable non-guarantee: None applicable to integrity.

 Severity:           Low.

 Classification:     Mitigated.



Prose.



The malicious relay can do everything A1 can do, plus it can

attempt to alter the bytes it forwards. Any modification fails

AEAD authentication at the receiving peer (G3, G4, G6). The

message is rejected.



The relay cannot forge a valid message, because it does not hold

the session key (G2). It cannot impersonate a device, because it

does not hold the organization key (G1).



The relay's ability to drop, delay, or reorder messages affects

availability, not integrity. An event that is dropped will be

re-sent on the next session (Section 18.6 of

SYNC-ARCHITECTURE.md). Reordering does not alter the final synchronized state when the
devices have the same accepted event set, because the protocol
order is deterministic (G7). Those concerns

are analyzed in Section 6.



Severity Low for integrity: the relay cannot alter debtor data

undetectably.



Classification Mitigated: the architecture provides G3, G4, and

G6 against integrity compromise by the relay.



\------------------------------------------------------------------------

5.5 A6 — Malicious Third Party (Zone 3)

\------------------------------------------------------------------------



Table entry:



 Attacker:           A6, malicious third party.

 Capability:         Receive whatever the client sends to it.

                     Cannot affect the sync protocol.

 Target:             Data the client chooses to send directly.

 Can modify undetectably? No, in the sense of the sync

                     protocol. The sync protocol is not on this

                     path.

 Applicable guarantee: None from the sync protocol. The

                     three-zone model applies (law §21). Zone 3

                     is client-controlled.

 Residual exposure:  Whatever the client sends. The client is

                     responsible for what it sends.

 Applicable non-guarantee: None applicable to integrity in the

                     sense of the sync protocol.

 Severity:           Low.

 Classification:     Residual (client decision).



Prose.



A6 cannot affect the sync protocol's integrity. The sync protocol

runs between the client's devices, not through the third party.

A6 does not hold the organization key and does not participate

in synchronization.



The integrity concern for A6 is not about the sync protocol. It

is about whatever the client sends to the third party. If the

client sends data to a third party and the third party alters

that data before sending it back, the client receives altered

data. That is outside the sync protocol.



The sync protocol does not protect data that leaves the client's

machine by a path the client chose (Zone 3, law §21).



Severity Low for the sync protocol: A6 cannot alter synchronized

debtor data. This is a different threat from the Zone 3

confidentiality threat in Section 4.5. The severity is Low here

because the sync protocol is not affected. The potential

disclosure of data voluntarily sent to Zone 3 is analyzed

separately under confidentiality, where its severity is Medium.



Classification Residual (client decision): the protocol does not

protect this case. The founder's decision on accepting this

residual risk for the MVP is recorded in Section 8.



\------------------------------------------------------------------------

5.6 Forgery and Impersonation

\------------------------------------------------------------------------



Forgery of valid events and impersonation of a device both

require possession of the organization key. A1, A2, A3, and A6 do

not possess it.



For this reason, forgery and impersonation are not analyzed for

A1, A2, A3, and A6. The analysis of these threats belongs to the

attackers that do possess the organization key: A4 (compromised

client device) and A5 (malicious peer).



Section 7 analyzes forgery and impersonation for A4 and A5.



The relevant non-guarantee for this limitation is N1: the

organization key does not authenticate a specific user or

device. This is why a holder of the organization key can present

any claimed device_id and pass the handshake. Section 7

elaborates.



\------------------------------------------------------------------------

5.7 What This Section Does Not Do

\------------------------------------------------------------------------



It does not analyze A4 (compromised client device) or A5

(malicious peer). Those are analyzed in full in Section 7,

including forgery and impersonation.



It does not analyze availability or convergence. Those are

Section 6.



It does not record the founder's decisions on residual risks.

That is Section 8.



It states, for the attackers A1, A2, A3, and A6, whether each

can modify debtor data undetectably, and classifies the threat.



Source: SYNC-ARCHITECTURE.md v1.0 Section 28 (G3, G4, G6, G7,

N1), Section 29.3 (attackers), Section 18.6 (recovery after

interruption). ARCHITECTURAL-LAW.md v1.3 Section 21 (three

zones).



========================================================================

6\. THREAT ANALYSIS — AVAILABILITY AND CONVERGENCE

========================================================================



This section analyzes whether each attacker class can prevent

synchronization, cause divergence, or block convergence. It

covers A1 (network observer), A2 (malicious Control Plane), A3

(malicious relay), and A6 (malicious third party, Zone 3).



A4 (compromised client device) and A5 (malicious peer) are

analyzed in full in Section 7. They are not covered here.



Each entry states:



\- The attacker's capability.

\- The affected asset.

\- Whether the attacker can prevent synchronization or cause

 divergence.

\- The applicable guarantee.

\- The residual exposure.

\- The applicable non-guarantee, if any.

\- The severity.

\- The classification: Mitigated, Residual, or Deferred.



The severity scale is Section 2.2. The capability-versus-impact

principle is Section 2.3.



\------------------------------------------------------------------------

6.1 Summary Table

\------------------------------------------------------------------------



 +------+---------------------+----------+-----------+-----------------+----------+----------+----------------+

 | Att. | Capability          | Target   | Deny /    | Guar.           | Residual | Sever.   | Classification |

 |      |                     |          | diverge?  |                 |          |          |                |

 +------+---------------------+----------+-----------+-----------------+----------+----------+----------------+

 | A1   | Observe only        | Sync     | No        | Conv: G5,G7,    | None     | Low      | Mitigated      |

 |      |                     | avail.   |           | G12             |          |          |                |

 +------+---------------------+----------+-----------+-----------------+----------+----------+----------------+

 | A2   | Refuse coordination;| Sync     | Yes       | Avail: None     | Denial   | Medium   | Residual       |

 |      | manipulate          | avail.   |           | Conv: G5,G7,G12 | or       |          | (founder       |

 |      | discovery           |          |           |                 | prolonged|          |  decision      |

 |      |                     |          |           |                 | interrup.|          |  pending)      |

 +------+---------------------+----------+-----------+-----------------+----------+----------+----------------+

 | A3   | Drop, delay,        | Sync     | Yes       | Avail: None     | Denial   | Medium   | Residual       |

 |      | reorder messages    | avail.   |           | Conv: G5,G7,G12 | or       |          | (founder       |

 |      |                     |          |           |                 | prolonged|          |  decision      |

 |      |                     |          |           |                 | interrup.|          |  pending)      |

 +------+---------------------+----------+-----------+-----------------+----------+----------+----------------+

 | A6   | Not on sync path    | Sync     | No        | Conv: G5,G7,G12 | None     | Low      | Mitigated      |

 |      |                     | avail.   |           |                 |          |          |                |

 +------+---------------------+----------+-----------+-----------------+----------+----------+----------------+



Note on guarantees: "Avail" means a guarantee about availability.

"Conv" means a guarantee about convergence. The MVP provides no

availability guarantee. The convergence guarantees ensure that

once synchronization happens, the two devices reach the same

final state.



\------------------------------------------------------------------------

6.2 A1 — Network Observer

\------------------------------------------------------------------------



Table entry:



 Attacker:           A1, network observer.

 Capability:         Observe only. Cannot inject, alter, or

                     drop messages.

 Target:             Synchronization availability.

 Can deny or diverge? No.

 Applicable guarantee: G5 (duplicate delivery does not

                     duplicate application), G7 (convergence is

                     deterministic), G12 (protocol order does

                     not depend on wall-clock time).

 Residual exposure:  None.

 Applicable non-guarantee: None applicable to availability.

                     N5 and N6 apply to metadata exposure, not

                     to availability.

 Severity:           Low.

 Classification:     Mitigated.



Prose.



A1 is a passive observer. It does not inject messages, does not

alter them, and does not drop them. It cannot affect

synchronization.



Severity Low: no availability or convergence impact.



Classification Mitigated: passive observation does not affect

availability or convergence.



\------------------------------------------------------------------------

6.3 A2 — Malicious Control Plane

\------------------------------------------------------------------------



Table entry:



 Attacker:           A2, malicious Control Plane.

 Capability:         Refuse to route traffic. Manipulate

                     discovery responses. Signal connections

                     that cannot be established. Refuse to

                     coordinate a relay session.

 Target:             Synchronization availability.

 Can deny or diverge? Can deny synchronization. Cannot cause

                     divergence.

 Availability guarantee: None in the MVP.

 Applicable convergence guarantee: G5 (duplicate delivery does

                     not duplicate application), G7 (convergence

                     is deterministic), G12 (protocol order does

                     not depend on wall-clock time).

 Residual exposure:  Denial or prolonged interruption of

                     synchronization while the Control Plane

                     is uncooperative. Events already durably

                     recorded in sync_events remain available

                     for retransmission.

 Applicable non-guarantee: None specific to availability. The

                     MVP does not include a Control Plane

                     outage mitigation beyond local operation.

 Severity:           Medium.

 Classification:     Residual — founder decision pending.



Prose.



The malicious Control Plane can refuse to coordinate the

rendezvous between two client devices. It can tell a device that

another device is offline when it is not. It can refuse to

allocate a relay session.



The impact is a denial or prolonged interruption of

synchronization while the Control Plane is uncooperative. The

protocol does not guarantee that the Control Plane will

eventually cooperate.



The impact is not divergence. Even if the Control Plane misroutes

or withholds traffic, once two devices establish a session —

through a direct connection, or through the Control Plane when it

does cooperate — the deterministic protocol order (G7) ensures

that the devices converge to the same final state.



The devices continue to operate locally. Events already durably

recorded in sync_events remain available for retransmission. The

delivery protocol does not intentionally discard them merely

because synchronization is unavailable. This is the design of the

offline queue (SYNC-ARCHITECTURE.md Section 17).



Severity Medium: the impact is a denial or prolonged interruption

of synchronization. It does not expose debtor data and does not

cause data loss. But it is a meaningful operational disruption,

which is why it is Medium rather than Low.



Classification Residual — founder decision pending: the protocol

does not prevent a malicious Control Plane from refusing to

coordinate. The MVP does not include a mitigation beyond local

operation and the offline queue. The founder's decision on

whether to accept this residual risk is recorded in Section 8.



\------------------------------------------------------------------------

6.4 A3 — Malicious Relay

\------------------------------------------------------------------------



Table entry:



 Attacker:           A3, malicious relay.

 Capability:         Drop messages. Delay messages. Reorder

                     messages.

 Target:             Synchronization availability.

 Can deny or diverge? Can deny synchronization. Cannot cause

                     divergence.

 Availability guarantee: None in the MVP.

 Applicable convergence guarantee: G5 (duplicate delivery does

                     not duplicate application), G7 (convergence

                     is deterministic), G12 (protocol order does

                     not depend on wall-clock time).

 Residual exposure:  Denial or prolonged interruption of

                     synchronization when the relay is on the

                     path. Events already durably recorded in

                     sync_events remain available for

                     retransmission.

 Applicable non-guarantee: None specific to availability.

 Severity:           Medium.

 Classification:     Residual — founder decision pending.



Prose.



The malicious relay can drop messages, delay them, or reorder

them. Dropping and delaying affect availability. Reordering does
not alter the final synchronized state when the devices have
the same accepted event set, because the protocol order is
deterministic (G7).



If the relay drops a message, the sender does not receive an

acknowledgement. On the next session (through the relay if it

cooperates, or through a direct connection if one becomes

available), the sender re-sends the unacknowledged events. The

receiver detects duplicates by event_id and acknowledges them as

DUPLICATE. This is the at-least-once delivery model (G5,

SYNC-ARCHITECTURE.md Section 18.1).



The impact is a denial or prolonged interruption of

synchronization while the relay is uncooperative. It is not

divergence.



The MVP provides retry and prefers direct connectivity where a

usable direct path can be established. Relay is the fallback when

direct connectivity is unavailable. A malicious relay can

therefore deny synchronization whenever no usable direct path

exists.



Severity Medium: temporary operational disruption. No data loss.

No exposure.



Classification Residual — founder decision pending: the protocol

does not prevent a malicious relay from dropping or delaying

messages. The founder's decision on whether to accept this

residual risk is recorded in Section 8.



\------------------------------------------------------------------------

6.5 A6 — Malicious Third Party (Zone 3)

\------------------------------------------------------------------------



Table entry:



 Attacker:           A6, malicious third party.

 Capability:         Not on the sync path. Cannot affect

                     synchronization.

 Target:             Synchronization availability.

 Can deny or diverge? No.

 Applicable guarantee: G5, G7, G12.

 Residual exposure:  None for synchronization.

 Applicable non-guarantee: None applicable to availability.

 Severity:           Low.

 Classification:     Mitigated.



Prose.



A6 is not on the sync path. The sync protocol runs between the

client's devices, not through the third party. A6 cannot drop,

delay, or alter sync messages.



Severity Low: no impact on synchronization.



Classification Mitigated: A6 is not on the sync path, so it

cannot affect availability or convergence.



\------------------------------------------------------------------------

6.6 The Relationship Between Availability and Convergence

\------------------------------------------------------------------------



Availability and convergence are distinct properties.



Availability: whether two devices can exchange events at a given

moment. A1, A2, A3, and A6 can affect availability (A2 and A3

can; A1 and A6 cannot).



Convergence: whether two devices with the same accepted events

reach the same final state, regardless of arrival order. A1, A2,

A3, and A6 cannot affect convergence, because convergence is a

property of the accepted event set, not of the transport.



The protocol's design separates these. A transport-level denial

of availability does not by itself cause divergence. Once

synchronization resumes, the deterministic protocol order (G7)

ensures that both devices reach the same final state.



A2 and A3 can therefore deny synchronization. They cannot cause

the two devices to disagree about what the data says. This

distinction is the reason the availability threats are Medium and

not High or Critical.



\------------------------------------------------------------------------

6.7 What This Section Does Not Do

\------------------------------------------------------------------------



It does not analyze A4 (compromised client device) or A5

(malicious peer). Those are analyzed in full in Section 7,

including their effect on availability and convergence.



It does not record the founder's decisions on residual risks.

That is Section 8.



It states, for the attackers A1, A2, A3, and A6, whether each

can deny synchronization or cause divergence, and classifies the

threat.



Source: SYNC-ARCHITECTURE.md v1.0 Section 28 (G5, G7, G12, N5,

N6), Section 29.3 (attackers), Section 17 (offline queue),

Section 18.1 (delivery model), Section 18.6 (recovery after

interruption), Section 19.4 (direct connection fallback).



========================================================================

7\. THE ENDPOINT COMPROMISE CASE

========================================================================



This section analyzes A4 (compromised client device) and A5

(malicious peer) in full. Unlike Sections 4, 5, and 6, it does

not analyze a threat against the protocol from the outside. It

analyzes a threat from inside the trust boundary.



The thesis of this section:



 Once an attacker controls a legitimate endpoint or possesses

 the organization key, the protocol cannot distinguish

 malicious authorized actions from legitimate authorized

 actions. End-to-end encryption protects the path between

 trusted endpoints; it does not make a compromised endpoint

 trustworthy.



The protocol still provides important properties when an

endpoint is compromised: other devices' messages remain

authenticated and encrypted in transit, deterministic

reconciliation still operates, duplicate protection still

operates, event ordering still operates, and devices that are

not compromised can still protect their own local databases.

What fails is not the protocol's mechanics, but the trust

assumption on which the protocol's cryptographic authorization

rests.



Sections 7.1 and 7.2 analyze A4 and A5 systematically. Section

7.3 compares them. Section 7.4 states the endpoint compromise

boundary in one place.



\------------------------------------------------------------------------

7.1 A4 — Compromised Client Device

\------------------------------------------------------------------------



An attacker who has compromised one of the client's devices. The

compromise may be:



\- Process compromise. Malicious code running on the device.

\- Credential compromise. The user's local password has been

 obtained, and the local database can be unlocked.

\- Physical access with the database unlocked. The attacker has

 the device while the database is open.

\- Key extraction. The organization key has been copied out of

 the local database.



The four compromise modes have different consequences. The

analysis below distinguishes them where the difference matters.



7.1.1 Confidentiality



 +---------------------------------------+--------+------------+---------+

 | Attack                                | Mode   | Severity   | Class   |

 +---------------------------------------+--------+------------+---------+

 | Read plaintext debtor data while      | Any    | Critical   | Not     |

 | database is unlocked                  |        |            | mitig.  |

 +---------------------------------------+--------+------------+---------+

 | Extract the organization key from the | Any    | Critical   | Not     |

 | local database                        |        |            | mitig.  |

 +---------------------------------------+--------+------------+---------+

 | Extract the session keys from process | Process| High       | Not     |

 | memory during an active session       |        |            | mitig.  |

 +---------------------------------------+--------+------------+---------+

 | Decrypt sync traffic that reaches this| Any    | Critical   | Not     |

 | device using the organization key     |        |            | mitig.  |

 +---------------------------------------+--------+------------+---------+



 The protocol does not protect against any of these. The

 attacker who controls the endpoint controls the endpoint's

 data and the endpoint's keys. The MVP sync protocol does not

 prevent an attacker who controls a legitimate endpoint and

 its cryptographic material from accessing data available to

 that endpoint.



 The protection that remains: other devices' local databases

 are not accessible from this device. The compromise does not

 spread to devices the attacker has not reached.



 The protection that does not remain: once the organization key

 is extracted, the attacker can authenticate as an

 organization-key holder and decrypt sync traffic for sessions

 whose ciphertext and required handshake material they can

 obtain. Because the MVP uses a single organization key,

 compromise of that key is not cryptographically limited to

 the compromised device.



 Possession of the organization key does not by itself give

 the attacker access to ciphertext flowing between arbitrary

 devices. The attacker must obtain the ciphertext and the

 relevant session-derivation material separately.



 Residual risk: R5, R6 (defined in Section 8).



7.1.2 Integrity and Authenticity



 +---------------------------------------+--------+------------+---------+

 | Attack                                | Mode   | Severity   | Class   |

 +---------------------------------------+--------+------------+---------+

 | Originate valid events using the      | Any    | Critical   | Not     |

 | organization key                      |        |            | mitig.  |

 +---------------------------------------+--------+------------+---------+

 | Impersonate any claimed device_id in  | Any    | Critical   | Not     |

 | the organization                      |        |            | mitig.  |

 +---------------------------------------+--------+------------+---------+

 | Modify local state tables and         | Any    | High       | Not     |

 | sync_events                           |        |            | mitig.  |

 +---------------------------------------+--------+------------+---------+

 | Delete or tombstone records (sets     | Any    | High       | Not     |

 | deleted = true, monotonic)            |        |            | mitig.  |

 +---------------------------------------+--------+------------+---------+

 | Create false communications, actions, | Any    | High       | Not     |

 | or debtor records                     |        |            | mitig.  |

 +---------------------------------------+--------+------------+---------+

 | Replay previously-accepted events     | Any    | Low        | Mitig.  |

 +---------------------------------------+--------+------------+---------+

 | Inject an event with a fabricated     | Any    | Low        | Mitig.  |

 | event_id that collides with an        |        |            |         |

 | existing one                          |        |            |         |

 +---------------------------------------+--------+------------+---------+



 Origination and impersonation. The attacker can produce valid

 events using the organization key. The events pass

 authentication and are accepted by other peers as legitimate.

 The MVP provides no cryptographic mechanism to distinguish

 malicious events originated by a holder of the organization

 key from legitimate events originated by that holder

 (SYNC-ARCHITECTURE.md Section 8.6, N1).



 Impersonation is the same problem from the other side. The

 handshake proves possession of the organization key; it does

 not bind a peer to a claimed device_id. A compromised device

 can claim any device_id and pass the handshake.



 Modification of local state and deletion. The compromised

 device can alter its own state tables and append arbitrary

 events. Two consequences must be distinguished.



 Direct modification of local database state may affect only

 that device, unless the attacker also creates or modifies

 valid synchronized events. A local-only change that does not

 produce a valid event does not propagate.



 Malicious synchronized events are the mechanism by which

 unauthorized state changes propagate to other devices. The

 attacker constructs events that pass authentication using

 the organization key. Other devices accept them.



 False records. The compromised device can create debtor

 records, communication records, action records, and (via

 ENTITY_UPDATED) mark existing records as deleted. Those

 records propagate.



 Replay. Replay of a previously-accepted event is prevented by

 duplicate detection (Section 15 of SYNC-ARCHITECTURE.md). The

 receiver recognizes the event_id and does not apply the event

 again. This is G5.



 Fabricated event_id collision. The attacker would need to

 produce an event_id that matches an existing event's ID and

 pass the authentication of a new event with that ID. The

 protocol treats a detected collision as a protocol violation

 (Section 10.6 of SYNC-ARCHITECTURE.md). Probability of

 accidental collision is negligible.



 Residual risk: R7, R8 (defined in Section 8).



7.1.3 Availability and Convergence



 +---------------------------------------+--------+------------+---------+

 | Attack                                | Mode   | Severity   | Class   |

 +---------------------------------------+--------+------------+---------+

 | Refuse to participate in              | Any    | Low        | Residual|

 | synchronization                       |        |            |         |

 +---------------------------------------+--------+------------+---------+

 | Originate events that other devices   | Any    | High       | Not     |

 | accept, causing state change at       |        |            | mitig.  |

 | those devices                         |        |            |         |

 +---------------------------------------+--------+------------+---------+

 | Cause two uncompromised devices with  | Any    | Low        | Mitig.  |

 | the same accepted event set to reach  |        |            |         |

 | different states                      |        |            |         |

 +---------------------------------------+--------+------------+---------+



 Refusing to participate. The compromised device can simply

 stop participating. This affects availability for the other

 devices the same way an offline device does

 (SYNC-ARCHITECTURE.md Section 27, peer-offline and

 peer-never-returns scenarios).



 Causing state change at other devices. The compromised device

 can originate events that propagate through the topology to

 other devices. The other devices accept them as legitimate and

 apply them. The resulting state at those devices includes the

 malicious change.



 This is not divergence in the protocol's sense. Divergence

 means two devices with the same accepted event set reach

 different states. Here, the malicious device introduced new

 events, and all devices that accepted those events converge on

 the same state. The convergence guarantee (G7) holds. What

 fails is the trust assumption about the events' origin.



 Cause two uncompromised devices with the same accepted event

 set to reach different states. A compromised device cannot do

 this, provided the two uncompromised devices eventually

 exchange their events. The deterministic protocol order (G7)

 ensures convergence. The compromised device can introduce

 malicious events, but it cannot make two uncompromised devices

 with the same accepted event set disagree about what those

 events say.



 Different accepted event sets. A compromised device can cause

 two uncompromised devices to temporarily have different

 accepted event sets by selectively originating or forwarding

 valid events. This does not violate G7. Once the relevant

 devices accept the same event set, the deterministic

 reconciliation rules produce the same state.



 Residual risk: R9 (defined in Section 8).



7.1.4 Recovery After Device Compromise



The MVP does not provide a recovery flow for a compromised

device. There are no cryptographic mechanisms to invalidate the

organization key on the compromised device, to rotate the key,

or to prevent the compromised device from continuing to

originate events (N3, N4).



What the client can do, operationally:



\- Disable the user account at the Control Plane. This prevents

 future authentication. It does not prevent the compromised

 device from initiating sessions, because the MVP handshake

 does not require Control Plane authorization at session

 establishment (SYNC-ARCHITECTURE.md Section 8.6).

\- Manually inspect the events originated by the compromised

 device and mark them for human review. The MVP event set

 includes device_id on every event, so the events can be

 identified. No automated mechanism exists.

\- Stop using the compromised device. This removes it from the

 active peer set. It does not invalidate the data already

 replicated to other devices.



The funded phase addresses these: D2 (key rotation), D3

(cryptographic offboarding), D4 (lost-device recovery flow).



\------------------------------------------------------------------------

7.2 A5 — Malicious Peer

\------------------------------------------------------------------------



An attacker who is an authorized member of the organization. Two

cases are distinguished:



A5.1 Current authorized malicious peer. The attacker has a

    current user account and legitimate organizational access.



A5.2 Former member retaining the organization key. The

    attacker's Control Plane account may be disabled, but

    possession of the organization key remains sufficient for

    the MVP cryptographic handshake.



The two cases have overlapping cryptographic capabilities. They

differ in operational origin and in what the client can do about

them.



7.2.1 A5.1 — Current Authorized Malicious Peer



A current authorized user who acts against the organization's

interests.



 +---------------------------------------+--------+------------+---------+

 | Attack                                | Severity | Class    | Notes  |

 +---------------------------------------+--------+------------+---------+

 | Decrypt sync traffic                  | Critical | Not mitig.| The    |

 |                                       |        |            | peer   |

 |                                       |        |            | holds  |

 |                                       |        |            | the key|

 +---------------------------------------+--------+------------+---------+

 | Originate valid events                | Critical | Not mitig.| Same   |

 |                                       |        |            | as A4  |

 +---------------------------------------+--------+------------+---------+

 | Impersonate a device_id               | Critical | Not mitig.| Same   |

 |                                       |        |            | as A4  |

 +---------------------------------------+--------+------------+---------+

 | Access local plaintext on this peer's | High     | Not mitig.| Depends|

 | own device                            |        |            | on     |

 |                                       |        |            | local  |

 |                                       |        |            | access |

 +---------------------------------------+--------+------------+---------+

 | Refuse to participate                 | Low      | Residual   | Like   |

 |                                       |        |            | offline|

 +---------------------------------------+--------+------------+---------+



 The cryptographic capabilities of A5.1 are the same as A4. A5.1

 is A4 with a different operational origin: the attacker is

 authorized, not compromised. The distinction matters because

 the client may not know the attacker has turned malicious.



 The protocol cannot distinguish A5.1 from a legitimate peer.

 The same limitation applies: possession of the organization key

 is the membership test, and the membership test does not

 express intent.



 The MVP's cryptographic authorization establishes possession

 of the organization key. It does not prove that the connecting

 process is the expected physical machine associated with the

 user account (N1).



7.2.2 A5.2 — Former Member Retaining the Organization Key



A former member whose account has been disabled but who retains

the organization key on a device the organization no longer

controls.



 +---------------------------------------+--------+------------+---------+

 | Attack                                | Severity | Class    | Notes  |

 +---------------------------------------+--------+------------+---------+

 | Decrypt future sync traffic using the | Critical | Not mitig.| The    |

 | retained organization key             |        |            | key is |

 |                                       |        |            | the    |

 |                                       |        |            | same   |

 +---------------------------------------+--------+------------+---------+

 | Originate valid events                | Critical | Not mitig.| Same   |

 |                                       |        |            | as A5.1|

 +---------------------------------------+--------+------------+---------+

 | Continue to access previously         | Critical | Not mitig.| N3, N4.|

 | replicated data on their device       |        |            | Phys.  |

 |                                       |        |            | not    |

 |                                       |        |            | revoc. |

 +---------------------------------------+--------+------------+---------+

 | Participate in synchronization with   | High     | Residual   | Depends|

 | other devices                         |        |            | on     |

 |                                       |        |            | whether|

 |                                       |        |            | peers  |

 |                                       |        |            | check  |

 |                                       |        |            | CP     |

 +---------------------------------------+--------+------------+---------+



 A5.2 is the case that N3 and N4 describe. Disabling the former

 member's Control Plane account prevents future authentication.

 It does not invalidate the organization key. It does not delete

 data already replicated to the former member's device.



 In the MVP, other devices check the Control Plane's

 device_registrations before a session. If the former member's

 device is no longer listed, the session is refused

 (SYNC-ARCHITECTURE.md Section 8.6). This is a coordination

 check, not a cryptographic one. It depends on the peers

 actually performing the check.



 If the former member's device remains accepted by the

 coordination check, or if a peer does not perform the check,

 the retained organization key is sufficient to complete the

 cryptographic handshake. The coordination check and the

 cryptographic authorization are separate. The Control Plane's

 registration list governs coordination. Possession of the

 organization key governs cryptographic authorization.



 The funded phase addresses these: D2 (key rotation), D3

 (cryptographic offboarding), D4 (lost-device recovery flow).



7.2.3 Recovery After Malicious Peer



 For A5.1 (current authorized malicious peer):



 - Disable the Control Plane account. This prevents future

   authentication.

 - Remove the device registration from the Control Plane. This

   removes the device from the coordination list, so peers

   refuse future sessions with it.

 - Inspect events originating from that device_id.

 - The organization key remains valid on that device unless

   rotated (funded phase, D2).



 For A5.2 (former member retaining the key):



 - The Control Plane account may already be disabled. What

   remains is the retained key.

 - Remove the device registration. This limits future sessions

   to the extent peers check the list.

 - Rotate the organization key. This is a funded-phase

   capability (D2). In the MVP, the organization key cannot be

   rotated without a full re-enrollment of every remaining

   device.

 - The data already on the former member's device cannot be

   deleted from GORKA. N3 states this plainly.



\------------------------------------------------------------------------

7.3 A4/A5 Comparison

\------------------------------------------------------------------------



 +---------------------------------------+---------------+---------------+

 | Property                              | A4 Compromised| A5 Malicious  |

 |                                       | Device        | Peer          |

 +---------------------------------------+---------------+---------------+

 | Holds organization key                | Yes           | Yes           |

 +---------------------------------------+---------------+---------------+

 | Can decrypt sync traffic              | Yes           | Yes           |

 +---------------------------------------+---------------+---------------+

 | Can originate valid events            | Yes           | Yes           |

 +---------------------------------------+---------------+---------------+

 | Can impersonate any device_id         | Yes           | Yes           |

 +---------------------------------------+---------------+---------------+

 | Can access local plaintext            | Potentially,  | Potentially,  |

 |                                       | when DB is    | depends on    |

 |                                       | unlocked      | local access  |

 +---------------------------------------+---------------+---------------+

 | Can continue after CP account         | Potentially,  | Yes, if key   |

 | disabled                              | depends on    | retained      |

 |                                       | operational   |               |

 |                                       | controls      |               |

 +---------------------------------------+---------------+---------------+

 | Cryptographically revocable in MVP    | No            | No            |

 +---------------------------------------+---------------+---------------+

 | Can propagate malicious events        | Yes           | Yes           |

 +---------------------------------------+---------------+---------------+

 | Can cause two uncompromised devices   | No            | No            |

 | with the same accepted event set to   |               |               |

 | reach different states                |               |               |

 +---------------------------------------+---------------+---------------+

 | Reason for compromise                 | Device        | Attacker is   |

 |                                       | security      | authorized    |

 |                                       | failed        | but malicious |

 +---------------------------------------+---------------+---------------+



 A4 and A5 differ operationally. A4 begins with the assumption

 that the device's security has been defeated. A5 begins with

 the assumption that an authorized participant has turned

 malicious or retained access after authorization ended.



 Cryptographically, the two are equivalent in the MVP. Both

 produce an attacker who holds the organization key and can

 originate valid events, decrypt sync traffic, and impersonate

 devices.



 The two are not equivalent in what the client can do about

 them. A4 can sometimes be detected through device security

 monitoring. A5.1 is harder because the attacker behaves within

 the organization's normal bounds until they choose not to.

 A5.2 is the harder case still, because the attacker is outside

 the organization's operational control.



\------------------------------------------------------------------------

7.4 The Endpoint Compromise Boundary

\------------------------------------------------------------------------



This subsection states the boundary in one place.



The GORKA sync protocol assumes that a holder of the organization

key acts in the organization's interest. The protocol's

cryptographic authorization is possession of the organization

key. It does not express intent. It does not distinguish a

legitimate holder of the organization key from an attacker who

has obtained the key.



Consequences of this design:



1\. End-to-end encryption protects the path between trusted

  endpoints. It does not make a compromised endpoint

  trustworthy.



2\. Once an attacker holds the organization key, they can

  originate valid events, decrypt sync traffic, and

  impersonate any device_id in the organization. The protocol

  cannot distinguish their actions from legitimate actions.



3\. Once an event originates from a holder of the organization

  key, other devices accept it as legitimate. The

  deterministic protocol order and reconciliation rules

  ensure that the other devices converge on a consistent

  state. The protocol cannot detect that the event's content

  is malicious.



4\. The MVP provides no cryptographic mechanism to revoke the

  organization key from a compromised or malicious device

  (N3, N4). Disabling a Control Plane account prevents future

  authentication. It does not invalidate the key and does not

  delete previously replicated data.



5\. The funded phase addresses these limitations through key

  rotation (D2), cryptographic offboarding (D3), and

  lost-device recovery (D4). Those capabilities do not exist

  in the MVP.



6\. A compromised or malicious endpoint cannot cause two

  uncompromised devices to reach different states from the

  same accepted event set. A malicious endpoint can,

  however, cause different uncompromised devices to receive

  or accept different event sets. G7 governs the former

  case, not the latter.



7\. The protocol still provides value in the presence of a

  compromised endpoint: other devices' messages remain

  authenticated and encrypted in transit; duplicate protection

  still operates; event ordering still operates; devices that

  are not compromised can still protect their own local

  databases. What fails is the assumption that every holder of

  the organization key is trustworthy.



The architectural statement in law §21.4 ("Your debtor data

stays under your control. GORKA cannot read it.") remains true.

The data stays under the client's control. GORKA cannot read it.

What the law does not claim — and what this section states

plainly — is that the security boundary depends on the client

maintaining control of the endpoints and the organization key

material. Compromise of those assets is outside the

cryptographic protections the MVP sync protocol provides.



\------------------------------------------------------------------------

7.5 What This Section Does Not Do

\------------------------------------------------------------------------



It does not record the founder's decisions on the residual risks

identified here. That is Section 8.



It does not analyze the funded-phase protocol. The funded-phase

capabilities D2, D3, and D4 are named but not designed here.



It states, for A4 and A5, what the attacker can do once they hold

the organization key, what the protocol still provides, and what

fails.



Source: SYNC-ARCHITECTURE.md v1.0 Section 8.3 (handshake),

Section 8.6 (identity and authorization), Section 15 (duplicate

detection), Section 28 (N1, N3, N4, N7), Section 29.3.4 (A4),

Section 29.3.5 (A5). ARCHITECTURAL-LAW.md v1.3 Section 21

(three zones).



========================================================================

8\. RESIDUAL RISKS AND FOUNDER DECISIONS

========================================================================



This section has two parts.



8.1 lists the residual risks identified in Sections 4 through 7.

   Each is a technical finding. The threat model states it; the

   threat model does not judge whether it is acceptable.



8.2 lists the deferred capabilities referenced by the residual

   risks.



8.3 records the founder's decisions. Accept, do not accept, or

   defer. The founder's reasoning is recorded with each decision.



The separation is deliberate. The technical finding is not a

judgment. The judgment is the founder's. Both are recorded, and

the record is preserved in DECISIONS.md as well.



The deferred capabilities (D1 through D12, from

SYNC-ARCHITECTURE.md Section 28.3) are listed alongside the

residual risks they address, where applicable. A deferred

capability is not the same as an accepted residual risk. A

deferred capability is a funded-phase plan. An accepted residual

risk is a conscious decision to proceed with the MVP despite the

risk.



\------------------------------------------------------------------------

8.1 Residual Risks Identified

\------------------------------------------------------------------------



Nine residual risks have been identified. Four are from Sections

4, 5, and 6. Five are from Section 7.



R1. Traffic metadata exposure.



 Source: Section 4.2 (A1), Section 4.3 (A2), Section 4.4 (A3).



 Finding: The Control Plane, the relay, and a network observer

 can see that two client devices communicated, when, and how

 much. They cannot read the content. They cannot alter it

 undetectably.



 Related non-guarantees: N5, N6.



 Severity: Low.



 Technical disposition: Residual. The protocol does not hide

 the existence of synchronization or prevent traffic analysis.



 Addressed by deferred capability: D12 (traffic analysis

 mitigation), if the threat model in the funded phase demands

 it.



R2. Malicious Control Plane can deny synchronization.



 Source: Section 6.3 (A2).



 Finding: A malicious Control Plane can refuse to coordinate

 rendezvous, manipulate discovery responses, interfere with

 signaling, and prevent or delay the establishment of a sync

 path. The denial may be temporary or prolonged. The protocol

 does not guarantee that the Control Plane will eventually

 cooperate.



 Events already durably recorded in sync_events remain

 available for retransmission. The delivery protocol does not

 intentionally discard them merely because synchronization is

 unavailable. They remain eligible for later delivery. Devices

 continue to operate locally. Divergence does not result.



 Severity: Medium.



 Technical disposition: Residual. The MVP does not include a

 Control Plane outage mitigation beyond local operation and

 the durable sync_events state.



 Addressed by deferred capability: none specific. A

 multi-homed Control Plane or a direct-only mode are funded-

 phase possibilities, not in the MVP.



R3. Malicious relay can deny synchronization.



 Source: Section 6.4 (A3).



 Finding: A malicious relay can drop, delay, or reorder

 messages. The denial may be temporary or prolonged while the

 relay is on the path.



 Events already durably recorded in sync_events remain

 available for retransmission. They remain eligible for later

 delivery. The protocol prefers direct connectivity where a

 usable direct path can be established. A malicious relay can

 deny synchronization whenever no usable direct path exists.



 Severity: Medium.



 Technical disposition: Residual. The MVP relies on retry and

 on direct connection as a fallback.



 Addressed by deferred capability: none specific. Enhanced

 direct-connection negotiation (for example, NAT traversal

 improvements) is a funded-phase possibility.



R4. Zone 3 client decision exposes data to a third party.



 Source: Section 4.5 (A6).



 Finding: A client may choose to send debtor data to a third

 party by a path GORKA does not control. If the client does

 so, the data leaves the client's machine and reaches the

 third party by the client's own act. GORKA warns at the

 point of connection (law §21.3). GORKA does not mediate the

 connection. GORKA does not see the data.



 Severity: Medium.



 Technical disposition: Residual. The protocol does not

 prevent this. The law requires GORKA to warn.



 Addressed by deferred capability: none specific. The

 obligation is warning, which is in the MVP.



R5. Compromised device: plaintext and organization key exposure.



 Source: Section 7.1.1 (A4).



 Finding: An attacker who has compromised a client device can

 read plaintext debtor data while the database is unlocked,

 and can extract the organization key from the local database.

 Once the organization key is extracted, the attacker can

 authenticate as an organization-key holder and decrypt sync

 traffic for sessions whose ciphertext and required handshake

 material they can obtain.



 This is the case where endpoint compromise defeats the trust

 assumptions on which the protocol's cryptographic

 authorization rests. The MVP sync protocol does not prevent

 an attacker who controls a legitimate endpoint and its

 cryptographic material from accessing data available to that

 endpoint.



 Severity: Critical.



 Technical disposition: Residual. The MVP does not prevent

 device compromise.



 Addressed by deferred capability: D2 (key rotation), D3

 (cryptographic offboarding), D4 (lost-device recovery flow).

 D2 and D3 address continued cryptographic access after

 compromise. D4 addresses recovery where the device is lost

 or no longer under organizational control. None of these

 prevents the initial compromise; they limit the attacker's

 ability to continue after the compromise is detected.



R6. Compromised device: session-key and historical-session

exposure.



 Source: Section 7.1.1 (A4).



 Finding: Two related threats.



 First, an attacker with process control over a device can

 extract session keys from process memory during an active

 session. Session keys are ephemeral, so the impact is

 limited to the sessions in progress during the compromise.

 This does not automatically give the attacker other

 sessions.



 Second, because the MVP session establishment does not

 provide forward secrecy, compromise of the organization key

 can permit derivation of session keys for previously

 captured sessions, when the required handshake material is

 available to the attacker.



 Severity: High.



 Technical disposition: Residual.



 Addressed by deferred capability: D6 (forward-secret session

 establishment). D6 addresses the second threat directly, and

 limits the value of past session keys even if the

 organization key is later compromised.



R7. Compromised device or malicious peer: event forgery and

device impersonation.



 Source: Section 7.1.2 (A4), Section 7.2.1 (A5.1), Section

 7.2.2 (A5.2).



 Finding: An attacker who holds the organization key can

 originate valid events, impersonate any claimed device_id,

 create false debtor records, false communications, and false

 actions, and mark existing records as deleted (monotonic).

 The events pass authentication and are accepted by other

 devices as legitimate.



 The protocol cannot distinguish malicious events originated

 by a holder of the organization key from legitimate events

 originated by that holder. This is N1 and N10.



 Severity: Critical.



 Technical disposition: Residual.



 Addressed by deferred capability: D1 (per-machine device

 identity), D2 (key rotation), D3 (cryptographic offboarding).

 D1 improves attribution and enables application-level review

 of events from a suspect device. D2 and D3 provide

 containment mechanisms for a compromised device's

 cryptographic authority.



R8. Compromised device or malicious peer: modification and

deletion of data at other devices through propagated events.



 Source: Section 7.1.2 (A4), Section 7.2.1 (A5.1), Section

 7.2.2 (A5.2).



 Finding: The attacker's events propagate through the normal

 sync topology to other devices. Other devices accept them

 and apply them. The resulting state at those devices includes

 the malicious change.



 This is not divergence. The convergence guarantee (G7) still

 holds: two devices that accepted the same events reach the

 same state. What fails is the trust assumption about the

 events' origin.



 Severity: High.



 Technical disposition: Residual.



 Addressed by deferred capability: D1 (per-machine device

 identity), D2 (key rotation), D3 (cryptographic offboarding).

 D1 gives attribution. D2 and D3 provide the actual

 containment. Without D2 and D3, attribution alone does not

 stop the malicious events from continuing.



R9. Compromised device or malicious peer: refusal to

participate.



 Source: Section 7.1.3 (A4), Section 7.2.1 (A5.1).



 Finding: A compromised device or a malicious peer can simply

 stop participating in synchronization. The impact is the same

 as an offline device (SYNC-ARCHITECTURE.md Section 27,

 peer-offline and peer-never-returns scenarios).



 Severity: Low.



 Technical disposition: Residual.



 Addressed by deferred capability: none specific. Stale-peer

 detection and manual peer removal are funded-phase

 possibilities, mentioned in Section 27 of SYNC-ARCHITECTURE.md.



\------------------------------------------------------------------------

8.2 Deferred Capabilities Referenced

\------------------------------------------------------------------------



The following deferred capabilities are referenced in Section

8.1. They are defined in SYNC-ARCHITECTURE.md Section 28.3.



D1.  Per-machine device identity.

D2.  Key rotation.

D3.  Cryptographic offboarding.

D4.  Lost-device recovery flow.

D6.  Forward-secret session establishment.

D12. Traffic analysis mitigation.



The funded phase may add more. Their design is not part of the

threat model.



D6 is referenced primarily by R6 (forward secrecy and

historical-session exposure). It does not address event forgery

or device impersonation, and it is not listed as a mitigation

for R7 or R8.



\------------------------------------------------------------------------

8.3 Founder Decisions

\------------------------------------------------------------------------



For each residual risk, the founder decides: accept, do not

accept, or defer.



Accept: the MVP proceeds. The risk is knowingly taken. The

       reasoning is recorded.



Do not accept: the MVP does not proceed until the risk is

              mitigated. The MVP scope or the architecture must

              be amended.



Defer: the risk is acknowledged but the decision is postponed.

      The MVP proceeds only if a clear condition for revisiting

      the decision is stated.



The founder has reviewed Sections 1 through 8 and decided as

follows. All nine residual risks are accepted for the MVP. The

reasoning is recorded with each decision.



R1. Traffic metadata exposure.



Severity: Low.

Founder decision: ACCEPTED.

Reasoning: The MVP's canonical promise is "GORKA cannot

decrypt your debtor data." It is not "GORKA cannot observe

that two devices communicated." The existence of

synchronization is operational metadata, not debtor data.

The observer sees that a session occurred, when, and how

much. It does not see content. This is a consequence of the

relay being an operational necessity (law §20.3). The

alternative — eliminating all observable metadata — would

require padding, fixed-size messages, and dummy traffic,

which are funded-phase items (D12) and not required for the

MVP.



R2. Malicious Control Plane can deny synchronization.



Severity: Medium.

Founder decision: ACCEPTED.

Reasoning: The MVP's architectural promise is that the

Control Plane cannot read debtor data, not that it cannot

refuse to coordinate. A malicious Control Plane can deny

service. It cannot compromise confidentiality, integrity,

or convergence. Events are durable in sync_events and

remain eligible for later delivery. The client continues to

operate locally. This is the same operational state as a

Control Plane outage, which is a known operational

condition. A high-availability Control Plane is a funded-

phase concern, not an MVP architectural one.



R3. Malicious relay can deny synchronization.



Severity: Medium.

Founder decision: ACCEPTED.

Reasoning: Same shape as R2. The relay is part of the

Control Plane and is subject to the same limitation. A

malicious relay can drop, delay, or reorder. It cannot

decrypt. It cannot undetectably modify. Events remain

durable in sync_events. The protocol prefers direct

connectivity where a usable direct path can be established.

Enhanced direct-connection negotiation is a funded-phase

possibility.



R4. Zone 3 client decision exposes data to a third party.



Severity: Medium.

Founder decision: ACCEPTED.

Reasoning: The three-zone model is the architectural answer

to this risk. Zone 3 is client-controlled. GORKA's

obligation is warning, not prevention. The law requires

GORKA to warn at the point of connection and record the

warning (law §21.3). GORKA does not mediate the connection

and does not see the data. If the client chooses to send

debtor data to a third party, that is the client's decision

and the client's responsibility. GORKA's role is to make

the risk visible, which the warning does. The MVP proceeds.



R5. Compromised device: plaintext and organization key

exposure.



Severity: Critical.

Founder decision: ACCEPTED.

Reasoning: This is the fundamental limitation of the MVP

endpoint-security model. An attacker who controls a client

device can read the local database and extract the

organization key. The MVP sync protocol does not prevent

this. The architectural answer is that the client's

security boundary depends on the client maintaining

control of the endpoints. The funded phase addresses

continued access through D2 (key rotation), D3

(cryptographic offboarding), and D4 (lost-device

recovery). The MVP is intentionally limited in security

capabilities and is not equivalent to the funded

production security model. The risk is real. It is

accepted for the MVP.



R6. Compromised device: session-key and historical-session

exposure.



Severity: High.

Founder decision: ACCEPTED.

Reasoning: Session-key extraction is bounded by session

lifetime. Historical-session exposure is a consequence of

the MVP's deliberate choice not to implement forward-

secret session establishment (law §20.4, MVP scope §9.3).

The MVP's cryptographic primitives are standard and

audited; the protocol's forward-secrecy omission is a

scope decision, not a defect. D6 (forward-secret session

establishment) is the funded-phase capability that

addresses this. The risk is accepted for the MVP.



R7. Compromised device or malicious peer: event forgery and

device impersonation.



Severity: Critical.

Founder decision: ACCEPTED.

Reasoning: This is the case the MVP concept document

explicitly calls out (MULTI-USER-CONCEPT.md §8; law §8.6).

Possession of the organization key proves membership, not

intent. The MVP cannot cryptographically distinguish

malicious events from legitimate events originated by a

key holder. The funded phase addresses this through D1

(per-machine device identity, which improves attribution),

D2 (key rotation), and D3 (cryptographic offboarding).

The MVP proceeds with the limitation stated openly in the

security properties (SYNC-ARCHITECTURE.md §28.2.1, §28.2.10)

and in this threat model. The risk is accepted for the

MVP.



R8. Compromised device or malicious peer: modification and

deletion of data at other devices through propagated

events.



Severity: High.

Founder decision: ACCEPTED.

Reasoning: A consequence of R7. Once the attacker can

originate valid events, those events propagate through the

normal topology. The convergence guarantee (G7) still

holds: devices with the same accepted event set reach the

same state. What fails is the trust assumption about the

events' origin. The funded phase addresses this through

D1, D2, and D3. The MVP does not have an application-level

event review or quarantine mechanism; that is a funded-

phase or customer-operational concern. The risk is

accepted for the MVP.



R9. Compromised device or malicious peer: refusal to

participate.



Severity: Low.

Founder decision: ACCEPTED.

Reasoning: The impact is the same as an offline peer or a

peer that never returns, both of which are documented

operational conditions (SYNC-ARCHITECTURE.md §27). The

MVP does not remove stale peers. The client's data remains

intact on the uncompromised devices. A funded phase may

introduce stale-peer detection and manual peer removal.

The risk is accepted for the MVP.



Summary of founder decisions:



R1 ACCEPTED

R2 ACCEPTED

R3 ACCEPTED

R4 ACCEPTED

R5 ACCEPTED

R6 ACCEPTED

R7 ACCEPTED

R8 ACCEPTED

R9 ACCEPTED



All nine residual risks are accepted for the MVP. None requires

an amendment to the MVP scope or to the architecture. Each is

addressed, in whole or in part, by a funded-phase capability or

is a documented operational condition.



These decisions will also be recorded in DECISIONS.md as part

of the recovery record.



\------------------------------------------------------------------------

8.4 The Standard Reasoning for MVP Residual Risks

\------------------------------------------------------------------------



This subsection is a note, not a decision.



The MVP is a working product with constraints. Its limitations

are deliberate. The recovery documents state throughout that the

MVP is not the final product, and that the funded phase addresses

the limitations.



The residual risks R1 through R9 share a common shape. They are

consequences of the MVP's deliberate scope decisions:



\- Single organization key (R5, R6, R7, R8).

\- User-account-based device identity (R7, R8).

\- No cryptographic revocation (R7, R8).

\- No forward secrecy (R6).

\- No traffic analysis mitigation (R1).



The funded phase contains capabilities that address some of

these limitations, including D1, D2, D3, D4, D6, and D12.

Other deferred capabilities address future functionality

rather than these MVP residual risks.



The founder has chosen to accept each residual risk for the

same reason: the MVP is intentionally limited in security

capabilities and is not equivalent to the funded production

security model. The funded phase adds capabilities that

address the residual risks as described in Section 8.1.



If the founder decides to accept a residual risk, the record

states plainly that the risk is real, that the MVP accepts

it consciously, and that the funded phase is planned to reduce

it.



A residual risk that is not accepted would require an amendment

to the MVP scope or to the architecture before implementation

begins.



\------------------------------------------------------------------------

8.5 What This Section Does Not Do

\------------------------------------------------------------------------



It does not perform the threat analysis. That is Sections 4

through 7.



It does not design the deferred capabilities. Those are defined

in SYNC-ARCHITECTURE.md Section 28.3 and designed in the funded

phase.



It records the residual risks and the founder's decisions on

them.



Source: SYNC-ARCHITECTURE.md v1.0 Section 28.3 (deferred

capabilities), Section 29 (inputs); THREAT-MODEL.md Sections 4

through 7.



========================================================================

9\. WHAT THE THREAT MODEL DOES NOT COVER

========================================================================



This section states the boundaries of this document, so that no

reader reads more into it than it says.



9.1 It Does Not Cover the Funded-Phase Protocol



This document analyzes the MVP protocol. The funded-phase

protocol does not yet exist. Its threats will be analyzed when

it is designed.



The deferred capabilities (D1 through D12, from

SYNC-ARCHITECTURE.md Section 28.3) are named in this document

only where they address a specific residual risk. Their design

is not analyzed here.



9.2 It Does Not Cover the Implementation



This document analyzes the protocol. It does not audit code. A

separate implementation audit is a funded-phase item (D10 and

D11 in SYNC-ARCHITECTURE.md Section 28.3).



The protocol's guarantees hold if the implementation follows the

specification. Whether a specific implementation follows the

specification is a separate question.



9.3 It Does Not Cover Threats Outside the Protocol's Scope



The following are outside the protocol's scope:



\- Operating system vulnerabilities on the client's device.

\- Physical attacks against the device beyond the endpoint-

 compromise scenario analyzed in Section 7, including

 cold-boot attacks and hardware keyloggers.

\- The security consequences of an insecure enrollment channel.

 Operational channel selection remains the client's

 responsibility. The threat analysis in Section 4 covers what

 happens if the channel is insecure.

\- The client's decision to send data to third parties outside

 GORKA's control (Zone 3, analyzed in Sections 4 and 5).

\- Legal or regulatory requirements that apply to the client or

 to GORKA.

\- Attacks against the Control Plane's own infrastructure beyond

 what the protocol can address.



9.4 It Does Not Cover the Control Plane's Internal Security



This document analyzes what the protocol allows the Control

Plane to observe and to do. It does not analyze the Control

Plane's internal security: how GORKA's own infrastructure is

protected against intrusion, insider threats, or compromise of

GORKA's own credentials.



That is a separate security concern. The protocol's guarantees

hold regardless of the Control Plane's internal state, because

the Control Plane has no organization key. But GORKA's own

operational security is a separate matter.



9.5 It Does Not Cover Multi-Tenant Installations



The MVP is one organization per device. Multi-tenant

installations are a funded-phase possibility

(SYNC-ARCHITECTURE.md Section 3, "The Organization Boundary").

Their threats will be analyzed when they are designed.



9.6 It Does Not Cover the Threat Model Itself



This document analyzes the protocol against the attacker classes

it defines. It does not analyze whether those attacker classes

are the correct ones, or whether any attacker class has been

missed. That is a meta-question, and it is outside this

document's scope.



If a new attacker class is identified later, it is added to

SYNC-ARCHITECTURE.md Section 29.3 first, then analyzed here.



9.7 It Does Not Cover Enrollment Channel Compromise



The client is assumed to use a trusted channel for the

enrollment package and passphrase. External compromise of that

channel is not analyzed as a GORKA sync-protocol attack. The

enrollment threat model is stated in SYNC-ARCHITECTURE.md

Section 5.8 and summarized in Section 2.6, Assumption C3.



9.8 It Does Not Cover Zone 3 Third-Party Services



Third-party services the client connects to directly are outside

the GORKA sync cryptographic boundary. The threat model records

the boundary and the warning obligation, and it analyzes the

client's decision to send data to Zone 3 as R4. It does not

audit the third-party services themselves.



9.9 It Does Not Provide Independent Security Certification



Founder approval of this document is not an independent security

review. Independent security review remains a separate activity

before real-customer production deployment.



9.10 What This Section Does Not Do



It does not analyze threats. That is Sections 4 through 7.



It states the boundaries of the document: what is covered, what

is not, and why.



Source: SYNC-ARCHITECTURE.md v1.0 Section 28.3 (deferred

capabilities), Section 29 (inputs), Section 3 (organization

boundary), Section 5.8 (enrollment security).



========================================================================

10\. SIGN-OFF

========================================================================



This document is approved by the founder.



Sections 1 through 9 have been read.



Section 7 has been written and reviewed.



The residual risks in Section 8 have been decided. All nine are
accepted for the MVP. The reasoning is recorded with each
decision.

The founder has reviewed the attacker classes and attack
surfaces defined in SYNC-ARCHITECTURE.md Section 29 and is not
aware of any additional class or surface requiring inclusion at
this time.


On approval, this document is frozen. Amendments follow the
same process as amendments to the multi-user concept:
documented, approved by the founder, recorded with reasoning.



Founder approval:



 Name:      GORKA founder

 Date:      September 20, 2026

 Status:    FROZEN — approved by the founder



Once approved, the three documents required before

implementation are complete:



1\. GORKA-MVP-SCOPE.md — frozen, v1.1.

2\. SYNC-ARCHITECTURE.md — frozen, v1.0.

3\. THREAT-MODEL.md — frozen, v1.0.



Implementation of the multi-user model may then begin, subject

to the phase plan (PHASE-PLAN.md) and the MVP scope.



========================================================================

END OF DOCUMENT

========================================================================



