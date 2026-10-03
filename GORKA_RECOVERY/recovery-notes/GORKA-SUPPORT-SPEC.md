GORKA-SUPPORT-SPEC.md



Version: 1.0.1

Date: October 3, 2026

Status: FROZEN

Authority: Subordinate to ARCHITECTURAL-LAW.md v1.3

Inputs: Old GORKA Support System Spec v2.3 (business

requirements only), ARCHITECTURAL-LAW.md v1.3,

DECISIONS.md D-005, D-011



Change history:



&#x20; v1.0 (October 3, 2026): initial freeze.



&#x20; v1.0.1 (October 3, 2026): five specification-level

&#x20; corrections applied inline from external review.

&#x20; No architectural change. No decision reopened.

&#x20; Corrections:

&#x20;   (1) Section 6.1: escalation now explicitly sets

&#x20;       the Owner as assignee.

&#x20;   (2) Section 17.1: tenant isolation now distinguishes

&#x20;       CLIENT / SUPPORT\_AGENT / OWNER scope.

&#x20;   (3) Section 15.12: assignment validation now

&#x20;       enforces queue compatibility.

&#x20;   (4) Section 14.3: duplicate-subject window and

&#x20;       409/429 semantics made explicit.

&#x20;   (5) Section 15.5: RESOLVED event emission made

&#x20;       explicit.



================================================================

PART 1 - SECTIONS 1 THROUGH 12

================================================================



1\. PURPOSE AND SCOPE



1.1 What this document is



The technical specification for the GORKA support

system. It defines the data model, the API, the roles,

the workflows, and the two user surfaces. It is a

specification, not code.



1.2 What it covers



&#x20; - Two surfaces: the Owner Dashboard (web, part of

&#x20;   gorka.click, authenticated) and the Client Dashboard

&#x20;   (Tauri desktop).

&#x20; - Two roles: OWNER and CLIENT, plus the SUPPORT\_AGENT

&#x20;   capability for GORKA helpers.

&#x20; - Two communication paths: Client admin to GORKA,

&#x20;   and Owner to Client admin.

&#x20; - Ticket lifecycle: submission, replies, status,

&#x20;   close, reopen.

&#x20; - Assignment (Owner to helper) and escalation

&#x20;   (Client to Owner).

&#x20; - Category-driven routing.

&#x20; - Internal GORKA notes.

&#x20; - PII safety: warning, organizational acknowledgment,

&#x20;   pattern-based rejection.

&#x20; - Audit, rate limiting, pagination, in-app

&#x20;   notifications.

&#x20; - One API consumed by both surfaces.



1.3 What it does not cover



&#x20; - The public marketing pages of gorka.click.

&#x20;   Out of scope.

&#x20; - The potential-client "Contact us" system.

&#x20;   Separate feature.

&#x20; - The Agent role. Agents are not participants in

&#x20;   the support system (Section 1.4).

&#x20; - Client-side internal communication (team notices,

&#x20;   internal chat between admin and agents). Separate

&#x20;   future workstream.

&#x20; - Email notifications. Deferred to funded stage.

&#x20; - The fourth role (SUPPORT) as a distinct role.

&#x20;   MVP uses Shape A. Shape B is funded phase.

&#x20; - Attachments, real-time updates, cross-org

&#x20;   analytics. Deferred.



1.4 The Agent role is not a support participant



The support system has exactly two parties:



&#x20; - The GORKA side - the Owner and GORKA Support

&#x20;   Helpers.

&#x20; - The Client side - the agency admin.



The Agent role does not interact with support at any

point.



An Agent who needs help - technical or otherwise - goes

to his admin. That communication is not a support

ticket. It belongs to the future internal chat / team

notices workstream (Section 20). It is not routed, not

counted, and never visible to GORKA.



This is a deliberate MVP scaling decision. GORKA's

support load is proportional to the number of client

admins, not the number of agents. A 10-client platform

with 1,000 total agents presents GORKA with 10 support

counterparties, not 1,000.



1.5 Authority and relationship to other documents



This spec is subordinate to ARCHITECTURAL-LAW.md. It

does not amend SYNC-ARCHITECTURE.md, LOCAL-TABLES.md,

or the multi-user model. Support is a Control Plane

feature; it never enters the local-first debtor-data

plane.



The old GORKA Support System Spec v2.3 (August 25,

2026\) is a source of business requirements. It is not

an architectural authority. Where the old spec assumed

Express/Prisma/PostgreSQL, four roles, and three

pre-recovery frontend targets, this spec does not

follow.



================================================================

2\. ARCHITECTURAL PLACEMENT

================================================================



2.1 Support lives in the Control Plane



Support tickets are Control Plane data only insofar as

they contain no debtor-derived plaintext business data.

This is the authoritative boundary, not a

classification.



A support ticket may carry GORKA product, account,

billing, or technical information. It may not carry

debtor-derived plaintext: debtor names in context,

contact details, account numbers, case-specific PII, or

financial details linked to an individual.



Support lives in the cloud database alongside licenses,

plans, organizations, and the other Control Plane

tables. The PII safety layer (Section 10) enforces the

boundary at write time.



2.2 No synchronization, no local tables



Support data is never synced to any Tauri local

database. There is no local\_support\_tickets table. The

sync engine does not know support exists.



The Tauri Client Dashboard reads and writes support

data through the cloud API. It does not cache support

data locally. It does not offline-queue support

operations.



2.3 Relationship to the invariant



The invariant says: no individual debtor information is

stored in GORKA cloud. Support tickets are permitted in

the cloud under the boundary in Section 2.1. The PII

policy (Section 10) enforces the boundary.



2.4 Relationship to the connector model



Distinct. Connectors are client-to-provider channels

for outbound messages to debtors. Support is a

GORKA-to-user channel. Different audiences, different

lifecycles. They share the cloud database and nothing

else.



================================================================

3\. ROLES AND IDENTITY

================================================================



3.1 The two roles that participate



OWNER - platform owner. One per GORKA platform.

Submits to a Client admin, handles tickets in the Owner

queue, has full visibility.



CLIENT - agency admin. One per client organization at

MVP. Submits to GORKA, handles everything inside his

own agency side.



The AGENT role does not participate in support

(Section 1.4).



3.2 The helper problem



When support volume grows, the OWNER shares the

handling function with additional GORKA staff. Helpers

are not members of any client organization.



3.3 Shape A (MVP) - the SUPPORT\_AGENT capability



A helper is a user whose organization is the GORKA

Support internal organization, and who holds the

SUPPORT\_AGENT capability. The capability is granted

through a support-level authorization layer, not

through the general organization role.



The capability, not the organization membership, is

what grants cross-organization support visibility.

Ordinary organization-level authorization is unchanged:

a GORKA Support user is a normal user with respect to

licenses, organizations, and every other Control Plane

feature, and only gains support-specific visibility if

the SUPPORT\_AGENT capability is held.



Terminology. The capability is named SUPPORT\_AGENT in

code and API. In every UI, documentation, and prose

reference, these users are called GORKA Support Helpers

or helpers, never "support agents." This avoids

confusion with the debt-collection AGENT role.



Capability lifecycle:



&#x20; - Grant and revoke: OWNER only.

&#x20; - Grant validity: the user must belong to the GORKA

&#x20;   Support organization. If the user is removed from

&#x20;   the organization, the capability is void. The

&#x20;   record may remain in the database but has no

&#x20;   effect.

&#x20; - Revocation: immediate. An active session does not

&#x20;   keep the capability past the next authorization

&#x20;   check.

&#x20; - Audit: every grant and revocation writes a row in

&#x20;   organization\_audit\_events of the GORKA Support

&#x20;   organization, with eventType = SUPPORT\_AGENT\_GRANTED

&#x20;   or SUPPORT\_AGENT\_REVOKED.

&#x20; - Scope of the capability: grants visibility of

&#x20;   tickets in the STAFF queue across all client

&#x20;   organizations, and the ability to reply, write

&#x20;   INTERNAL\_GORKA notes, change status, and close

&#x20;   tickets in that queue. It does not grant

&#x20;   assignment, escalation, category change, statistics

&#x20;   access, or soft delete. Those are OWNER-only.



3.4 Shape B (funded phase)



Add a fourth role SUPPORT. Users with role SUPPORT hold

the SUPPORT\_AGENT capability inherently. Requires a

D-005 amendment.



3.5 What the spec does not decide



&#x20; - Whether a helper can also hold the OWNER role.

&#x20;   Deferred.

&#x20; - Whether helpers have limited scopes (technical only,

&#x20;   billing only). Deferred.



================================================================

4\. SURFACES AND CAPABILITY MATRIX

================================================================



4.1 Surfaces



&#x20; Surface            | Type                          | Reaches backend via

&#x20; -------------------|-------------------------------|---------------------

&#x20; Owner Dashboard    | Web (gorka.click, authed)     | HTTP from browser

&#x20; Client Dashboard   | Tauri desktop                 | HTTP from Tauri process



There is no Agent Dashboard support surface.



4.2 Capability matrix



The helper column reflects the SUPPORT\_AGENT capability.

It is a capability, not a fourth role.



&#x20; Capability                                            | Owner              | Helper           | Client

&#x20; ------------------------------------------------------|--------------------|------------------|-------------

&#x20; Submit to Staff queue (TECHNICAL/ACCT\_ACCESS/BUG)     | Yes                | No               | Yes

&#x20; Submit to Owner queue (BILLING/FEATURE\_REQUEST/OTHER) | N/A (Owner is it)  | No               | Yes

&#x20; Submit to a specific Client admin                     | Yes (recip req'd)  | No               | N/A

&#x20; View tickets in Owner queue (all orgs)                | Yes                | No               | No

&#x20; View tickets in Staff queue (all orgs)                | Yes                | Yes              | No

&#x20; View all tickets in own org                           | Yes                | No               | Yes

&#x20; View own submissions                                  | N/A                | N/A              | Yes

&#x20; View tickets sent to me by owner                      | N/A                | N/A              | Yes

&#x20; Reply to visible tickets                              | Yes                | Yes (Staff only) | Yes

&#x20; View GORKA-internal notes                             | Yes                | Yes              | No

&#x20; Write GORKA-internal notes                            | Yes                | Yes              | No

&#x20; Assign to GORKA helper                                | Yes                | No               | No

&#x20; Escalate (Client to Owner)                            | N/A                | N/A              | Yes

&#x20; Close own-origin tickets                              | Yes                | No               | Yes

&#x20; Close tickets sent by owner                           | Yes                | No               | No

&#x20; Close Staff-queue tickets                             | Yes                | Yes              | No

&#x20; Change category                                       | Yes                | No               | No

&#x20; Soft delete                                           | Yes                | No               | No

&#x20; View stats                                            | Yes                | No               | Yes (own org)



4.3 Notes on the matrix



&#x20; - Every ticket the Owner originates is visible

&#x20;   platform-wide by definition.

&#x20; - The Client cannot close tickets that originated

&#x20;   from the Owner. Section 7.4 is the single

&#x20;   authoritative rule.

&#x20; - Client-side tickets are private to the Client

&#x20;   admin. Nothing in the support system is visible to

&#x20;   an Agent.



================================================================

5\. DATA MODEL

================================================================



5.1 Existing tables (audit)



Six support tables are already in schema.cloud.prisma

(adopted September 11, D-011). Not yet applied to

gorka\_test:



&#x20; support\_tickets

&#x20; support\_ticket\_replies

&#x20; support\_ticket\_events

&#x20; organization\_audit\_events

&#x20; notifications

&#x20; ticket\_counter



Shapes are broadly correct. This spec audits them

against current needs.



5.2 Additions and changes on support\_tickets



Added fields:



&#x20; - routedQueue (String, required) - OWNER or STAFF.

&#x20;   Set at creation from category. Immutable. Never

&#x20;   changes. Replaces the earlier

&#x20;   categoryDrivenRecipient concept.

&#x20; - originatingSurface (String, required) -

&#x20;   OWNER\_DASHBOARD or CLIENT\_DASHBOARD.

&#x20; - originatingRole (String, required) - OWNER or

&#x20;   CLIENT.

&#x20; - recipientUserId (String, nullable) - required when

&#x20;   originatingRole = OWNER. The Client admin the

&#x20;   ticket is sent to. Null for CLIENT-originated

&#x20;   tickets.

&#x20; - assigneeScope (String, nullable) - GORKA. Only one

&#x20;   value today, kept as a string for future

&#x20;   extension. Set whenever assignedTo is set. Cleared

&#x20;   when assignedTo is cleared.

&#x20; - closedReason (String, nullable) - required text

&#x20;   when the ticket is closed.



Dropped fields:



&#x20; - source - replaced by originatingSurface.

&#x20; - openedByName - the user record is authoritative

&#x20;   for display name.

&#x20; - categoryDrivenRecipient - replaced by the simpler

&#x20;   routedQueue.



Retained fields:



&#x20; - mergedIntoId, mergedAt - kept, unused in v1.

&#x20;   Merge UI deferred; columns are cheap.

&#x20; - previousAssignee, escalatedAt, escalatedBy,

&#x20;   escalationReason - used by escalation (Section 9).

&#x20; - firstRespondedAt - used for response-time

&#x20;   reporting.

&#x20; - resolvedAt, resolvedBy, closedAt, closedBy - used

&#x20;   by status transitions.

&#x20; - isDeleted, deletedAt, deletedBy - used by soft

&#x20;   delete (Section 18).



Organization attribution - authoritative rule.



&#x20; - For a CLIENT-originated ticket: organizationId is

&#x20;   the caller's organization.

&#x20; - For an OWNER-originated ticket: organizationId is

&#x20;   the recipient Client admin's organization.

&#x20;   openedBy remains the Owner's user id.

&#x20;   openedByEmail is the Owner's email. The ticket

&#x20;   lives in the recipient's tenant and appears in

&#x20;   the recipient's "From GORKA" view.



Example. The Owner writes a ticket "Your subscription

renews November 1" with category BILLING and recipient

Ana (the CLIENT admin of "Manila Collections").

Result: organizationId = Manila Collections,

routedQueue = OWNER (because BILLING),

recipientUserId = Ana, openedBy = Owner. The ticket

appears in Ana's "From GORKA" view. The Owner sees it

in "All tickets" and in the "Owner queue" view.



5.3 Changes on support\_ticket\_replies



&#x20; - noteScope (String, required, default PUBLIC) - one

&#x20;   of PUBLIC, INTERNAL\_GORKA.

&#x20; - The old isInternal boolean is dropped.

&#x20; - INTERNAL\_CLIENT\_ADMIN and INTERNAL\_CLIENT\_TEAM

&#x20;   scopes are dropped. With no Agent participation,

&#x20;   the client-side scopes have no audience.



5.4 New table support\_submission\_rejections



Metadata only, never the rejected text.



&#x20; Column           | Type            | Notes

&#x20; -----------------|-----------------|-------

&#x20; id               | String, cuid    | Primary key

&#x20; organizationId   | String, null    | Null for OWNER-originated attempts with no recipient yet

&#x20; userId           | String          | The caller

&#x20; surface          | String          | OWNER\_DASHBOARD / CLIENT\_DASHBOARD

&#x20; category         | String          | The attempted category

&#x20; reasonCategory   | String          | PHONE\_LIKE, ID\_LIKE, AMOUNT\_WITH\_NAME, OTHER

&#x20; createdAt        | DateTime        | Default now()



Rules:



&#x20; - INSERT-ONLY.

&#x20; - Never stores the rejected text, matched substrings,

&#x20;   or any reversible representation.

&#x20; - Retention: 12 months, then deleted.

&#x20; - Access: OWNER only.

&#x20; - Used for aggregate pattern tuning, abuse detection,

&#x20;   and founder reporting. Never shown in any support

&#x20;   UI.



5.5 Changes on notifications



No schema change in v1. Email-related columns

(deliveryStatus, emailSentAt, emailError, attemptCount,

lastError) remain present but unused until funded-phase

email activation.



5.6 Indexes



Existing indexes are adequate. Additions:



&#x20; - @@index(\[routedQueue, status]) - for queue filtering.

&#x20; - @@index(\[organizationId, originatingSurface]) - for

&#x20;   surface analytics.



5.7 What is not in the schema



&#x20; - No local table.

&#x20; - No sync events.

&#x20; - No change to any non-support cloud table.



================================================================

6\. CATEGORIES, PRIORITIES, ROUTING

================================================================



6.1 Three concepts, kept separate



Queue (routedQueue) - where the ticket belongs. Set at

creation from category. Immutable. Values: OWNER,

STAFF.



Assignment (assignedTo, assigneeScope) - who is

currently handling it. Optional. Changes when the Owner

assigns or unassigns.



Escalation (escalatedAt, escalatedBy, escalationReason)

\- the Client explicitly asking the Owner to take

attention. It does not move the ticket. It does not

change the queue. It sets the assignee to the Owner,

with assigneeScope = GORKA.



None of the three modifies the other two implicitly.



6.2 Categories



&#x20; BILLING

&#x20; TECHNICAL

&#x20; ACCOUNT\_ACCESS

&#x20; FEATURE\_REQUEST

&#x20; BUG

&#x20; OTHER



6.3 Priorities



LOW, MEDIUM, HIGH, URGENT. Default MEDIUM.



6.4 Category-driven routing



At submission, the category determines the queue. The

queue is fixed at creation and never changes.



&#x20; Category         | Queue

&#x20; -----------------|------

&#x20; BILLING          | OWNER

&#x20; TECHNICAL        | STAFF

&#x20; ACCOUNT\_ACCESS   | STAFF

&#x20; FEATURE\_REQUEST  | OWNER

&#x20; BUG              | STAFF

&#x20; OTHER            | OWNER



Routing is determined by category only, never by

sender. An Owner-created TECHNICAL ticket lands in the

STAFF queue, the same as a Client-created TECHNICAL

ticket. An Owner-created BILLING ticket lands in the

OWNER queue.



6.5 Routing discipline



&#x20; - The Owner does not move a technical ticket into his

&#x20;   own queue. It stays in the Staff queue. He may open

&#x20;   it and reply; the reply is labeled by the queue,

&#x20;   not by his role.

&#x20; - The Client admin does not move a technical ticket

&#x20;   into the Owner queue. The correct path is an

&#x20;   explicit escalation (Section 9), not a category

&#x20;   override.

&#x20; - The server does not honor client-supplied

&#x20;   routedQueue. The field is always derived

&#x20;   server-side.



6.6 Category changes



&#x20; - Only the OWNER can change a ticket's category.

&#x20; - A category change does not change the queue. The

&#x20;   queue is immutable. The category is re-recorded

&#x20;   for triage and reporting.

&#x20; - A category change requires a reason. Recorded as

&#x20;   CATEGORY\_CHANGED with oldValue and newValue.



================================================================

7\. STATUS FLOW AND TRANSITIONS

================================================================



7.1 States



Five states: OPEN, IN\_PROGRESS, WAITING\_FOR\_CLIENT,

RESOLVED, CLOSED.



7.2 Transitions



&#x20; OPEN               -> IN\_PROGRESS, WAITING\_FOR\_CLIENT, RESOLVED, CLOSED

&#x20; IN\_PROGRESS        -> WAITING\_FOR\_CLIENT, RESOLVED, CLOSED

&#x20; WAITING\_FOR\_CLIENT -> IN\_PROGRESS, RESOLVED, CLOSED

&#x20; RESOLVED           -> CLOSED, OPEN (manual, Owner only)

&#x20; CLOSED             -> OPEN (manual, Owner only)



RESOLVED and CLOSED are functionally identical for

reply handling. The difference is workflow-only:

RESOLVED means "the handler has finished"; CLOSED is the

terminal record.



Who normally performs RESOLVED -> CLOSED: the handler

(Owner or GORKA Support Helper), after the client

signals satisfaction or after a timeout policy that is

deferred to the funded stage. A Client may also close a

resolved ticket he originated, per Section 7.5.



7.3 No auto-reopen



&#x20; - A reply on a RESOLVED ticket is rejected.

&#x20; - A reply on a CLOSED ticket is rejected.

&#x20; - The rejection message is: "This ticket is closed.

&#x20;   Please create a new ticket."

&#x20; - The message is identical for both states. The API

&#x20;   does not expose the distinction in rejection

&#x20;   responses.

&#x20; - To continue the topic, a new ticket is created.

&#x20; - The only path from RESOLVED or CLOSED back to OPEN

&#x20;   is an explicit Owner action. Recorded as a REOPENED

&#x20;   event.



7.4 Close permission precedence - the single

&#x20;   authoritative rule



Two rules, applied independently:



GORKA Support Helper close permission is determined by

routedQueue = STAFF, regardless of the ticket's origin.

A helper can close any Staff-queue ticket.



Client close permission is determined by the ticket's

origin:



&#x20; - A Client can close a CLIENT-originated ticket.

&#x20; - A Client cannot close an OWNER-originated ticket.

&#x20; - The Owner can close any ticket.



&#x20; Ticket                          | Owner      | Helper     | Client admin

&#x20; --------------------------------|------------|------------|-------------

&#x20; OWNER-originated, OWNER queue   | Can close  | N/A        | Cannot close

&#x20; OWNER-originated, STAFF queue   | Can close  | Can close  | Cannot close

&#x20; CLIENT-originated, OWNER queue  | Can close  | N/A        | Can close

&#x20; CLIENT-originated, STAFF queue  | Can close  | Can close  | Can close



7.5 Who can perform each transition



&#x20; Transition                  | Owner          | Helper        | Client

&#x20; ----------------------------|----------------|---------------|------

&#x20; OPEN -> IN\_PROGRESS         | Yes            | Yes (Staff)   | Yes

&#x20; OPEN -> WAITING             | Yes            | Yes (Staff)   | Yes

&#x20; OPEN -> RESOLVED            | Yes            | Yes (Staff)   | Yes

&#x20; OPEN -> CLOSED              | Yes            | Yes (Staff)   | Yes (non-owner-origin)

&#x20; IN\_PROGRESS -> WAITING      | Yes            | Yes (Staff)   | Yes

&#x20; IN\_PROGRESS -> RESOLVED     | Yes            | Yes (Staff)   | Yes

&#x20; IN\_PROGRESS -> CLOSED       | Yes            | Yes (Staff)   | Yes (non-owner-origin)

&#x20; WAITING -> IN\_PROGRESS      | Yes            | Yes (Staff)   | Yes

&#x20; WAITING -> RESOLVED         | Yes            | Yes (Staff)   | Yes

&#x20; WAITING -> CLOSED           | Yes            | Yes (Staff)   | Yes (non-owner-origin)

&#x20; RESOLVED -> CLOSED          | Yes            | Yes (Staff)   | Yes (non-owner-origin)

&#x20; RESOLVED -> OPEN            | Yes (manual)   | No            | No

&#x20; CLOSED -> OPEN              | Yes (manual)   | No            | No



Close reason is required on every transition to CLOSED.



================================================================

8\. REPLIES

================================================================



8.1 Public replies



A public reply is visible to the participating users of

the ticket.



For a GORKA-Client ticket, this means the GORKA side

(Owner and any assigned helper) and the Client admin.



A public reply is not visible to any Agent. There is no

Agent participation in support.



8.2 Who can reply to whom



&#x20; - Owner -> Client admin

&#x20; - GORKA Support Helper -> Client admin (on Staff-queue

&#x20;   tickets)

&#x20; - Client admin -> Owner or GORKA Support Helper



8.3 Reply editing



Out of scope for v1.



================================================================

9\. ASSIGNMENT AND ESCALATION

================================================================



9.1 Assignment



Assignment is the only mutable field on a ticket after

creation. The queue does not move.



&#x20; - The Owner assigns Staff-queue tickets to a GORKA

&#x20;   Support Helper (assigneeScope = GORKA), or to

&#x20;   himself.

&#x20; - The Owner assigns Owner-queue tickets to himself.

&#x20; - The Client admin has no assignment capability.

&#x20;   There is no one on the client side to assign to.



A ticket can be unassigned. assigneeScope is cleared

whenever assignedTo is cleared.



9.2 Escalation (Client to Owner)



&#x20; - The Client admin escalates a ticket to the Owner.

&#x20; - The ticket remains in its queue.

&#x20; - escalatedAt, escalatedBy, and escalationReason are

&#x20;   set.

&#x20; - assignedTo is set to the Owner's user id,

&#x20;   assigneeScope = GORKA.

&#x20; - An ESCALATED event is written.

&#x20; - The reason is required.



9.3 No other escalation paths



There is no Agent escalation, no Owner self-escalation,

and no escalation to a helper. The Client to Owner path

is the only one.



9.4 Multiple CLIENT admins



The MVP assumes one CLIENT admin per organization. If a

second CLIENT user ever exists, all support API

endpoints that assume a single admin return

409 MULTIPLE\_ADMINS\_NOT\_SUPPORTED. This is an MVP

limitation.



The recipientUserId field on Owner-created tickets is

already in place to support multiple admins in the

funded phase without an API change.



================================================================

10\. PII SAFETY

================================================================



10.1 Warning on submission



Every ticket submission form displays a warning:



&#x20; To protect debtor privacy, do not include debtor

&#x20; names, account numbers, contact details,

&#x20; case-specific PII, or financial details. Use case

&#x20; references or general descriptions instead.



The warning is not dismissible. It sits above the

submit button.



10.2 Organizational acknowledgment



Before the first ticket can be submitted by a client

organization, the CLIENT admin must accept the current

PII policy. The acceptance is versioned

(CURRENT\_PII\_POLICY\_VERSION) and recorded as an

OrganizationAuditEvent with eventType =

PII\_POLICY\_ACCEPTED. One-time per org; invalidated if

the policy version changes.



10.3 Screened fields



The PII pattern detector runs on every free-text write:



&#x20; - Ticket subject

&#x20; - Ticket message body

&#x20; - Public reply text

&#x20; - Internal note text (INTERNAL\_GORKA)

&#x20; - Escalation reason

&#x20; - Close reason

&#x20; - Category-change reason



It does not run on reads.



10.4 Pattern detection and rejection



On ticket submission, a pattern match rejects ticket

creation. On reply, note, escalation, close, or

category change, a pattern match rejects the operation.

The user sees a generic description ("the message

contains what appears to be a phone number or ID

number") and must edit before resubmitting.



Patterns checked:



&#x20; - Phone-number-like strings

&#x20; - ID-number-like strings

&#x20; - Currency-amount-with-name patterns

&#x20; - Configured forbidden identifiers



Submitter's own email exemption. The caller's

authenticated email address is exempt from the

email-address pattern rule when it exactly matches the

normalized caller email.



If multiple patterns match in a single attempted write,

reasonCategory records the first matched class.



10.5 What is rejected vs allowed



Rejected:

&#x20; - A debtor name paired with a specific amount

&#x20; - Phone numbers, ID numbers

&#x20; - Email addresses not the submitter's own



Allowed:

&#x20; - "The Agent application crashes when I open

&#x20;   Settings."

&#x20; - "Login returns an authentication error since

&#x20;   yesterday."

&#x20; - "Our billing statement shows the wrong plan."

&#x20; - "How do I configure Mocean as a connector?"

&#x20; - "I found a bug in the calendar view."



10.6 What pattern detection cannot do



Pattern detection is a mitigation, not a guarantee. A

user can describe a debtor in prose without any pattern

matching. The warning and the acknowledgment remain the

primary safety mechanisms.



10.7 Logging rejections



Rejections are recorded in support\_submission\_rejections

(Section 5.4). Metadata only. No text, no matched

substrings, no reversible representation.



10.8 Configuration of forbidden identifiers



The OWNER may add specific forbidden identifier strings

through a settings form in the Owner Dashboard. Stored

in platform\_settings under key pii\_forbidden\_patterns.



Forbidden identifier patterns are encrypted at rest and

are never returned to Client users.



================================================================

11\. SUBMISSION GUIDANCE

================================================================



Each submission form shows a short reminder. It does not

block.



Owner Dashboard:

&#x20; - Business and commercial questions: routed to you.

&#x20; - Technical questions: routed to staff.

&#x20; - Use the category selector.

&#x20; - Always specify a recipient Client admin.



Client Dashboard:

&#x20; - Questions about GORKA itself (billing, bugs,

&#x20;   feature requests): route to GORKA.

&#x20; - For matters affecting your agents, use internal

&#x20;   communication (future workstream), not support.



================================================================

12\. AUDIT

================================================================



12.1 Transactional audit



Every state-changing operation updates the ticket and

creates its corresponding support\_ticket\_events record

in the same database transaction.



12.2 Append-only



support\_ticket\_events and organization\_audit\_events are

INSERT-ONLY. Application code must not UPDATE or DELETE

them.



12.3 Event types



&#x20; CREATED

&#x20; ASSIGNED         - first assignee set (including at creation)

&#x20; REASSIGNED       - subsequent assignee change

&#x20; UNASSIGNED       - assignee cleared

&#x20; STATUS\_CHANGED

&#x20; CATEGORY\_CHANGED - OWNER only

&#x20; ESCALATED        - Client to Owner only

&#x20; REPLY\_ADDED      - public or internal, metadata may carry noteScope

&#x20; RESOLVED

&#x20; REOPENED

&#x20; CLOSED

&#x20; DELETED          - soft delete



12.4 Required oldValue / newValue per event



&#x20; Event            | oldValue                          | newValue

&#x20; -----------------|-----------------------------------|--------

&#x20; CREATED          | null                              | initial fields

&#x20; ASSIGNED         | null                              | { assignedTo, assigneeScope }

&#x20; REASSIGNED       | { assignedTo, assigneeScope }     | { assignedTo, assigneeScope }

&#x20; UNASSIGNED       | { assignedTo, assigneeScope }     | null

&#x20; STATUS\_CHANGED   | { status }                        | { status }

&#x20; CATEGORY\_CHANGED | { category }                      | { category }

&#x20; ESCALATED        | null                              | { reason }

&#x20; REPLY\_ADDED      | null                              | { noteScope } for internal

&#x20; RESOLVED         | { status }                        | { status: RESOLVED }

&#x20; REOPENED         | { status }                        | { status: OPEN }

&#x20; CLOSED           | { status }                        | { status: CLOSED }

&#x20; DELETED          | { isDeleted: false }              | { isDeleted: true }



12.5 Organization audit events



&#x20; PII\_POLICY\_ACCEPTED

&#x20; SUPPORT\_AGENT\_GRANTED (in the GORKA Support org)

&#x20; SUPPORT\_AGENT\_REVOKED (in the GORKA Support org)



Same append-only rule.



12.6 Rejection logging



Handled by support\_submission\_rejections (Section 5.4),

not by ticket events. Rejected submissions have no

ticket.



================================================================

END OF PART 1

================================================================



================================================================

PART 2 - SECTIONS 13 THROUGH 20

================================================================



================================================================

13\. NOTIFICATIONS

================================================================



13.1 In-app only in v1



Notifications are in-app only. The notifications table in

the Control Plane is the single source of truth. The

Tauri Client Dashboard and the Owner Dashboard query the

Control Plane API for the user's notifications. There is

no local notification store and no offline queue.



13.2 Recipient set



Notification recipients are limited to the ticket's

participating users.



&#x20; - When the author is the Client admin, recipients are

&#x20;   the current assignee (Owner or GORKA Support Helper)

&#x20;   and, if different, the Owner.

&#x20; - When the author is the Owner or a helper, the

&#x20;   recipient is the Client admin.

&#x20; - For internal GORKA notes, recipients are the other

&#x20;   GORKA-side participants only (Owner to helper).



No agency-wide notification. No agent notification.



Each recipient user receives at most one notification

per event, even if the user is both the assignee and the

Owner.



13.3 What triggers a notification



&#x20; - Ticket assigned to a user.

&#x20; - Reply added to a ticket the user participates in.

&#x20; - Status changed on a ticket the user participates in.

&#x20; - Internal GORKA note added.

&#x20; - Client escalation.



13.4 Sorting



Notifications are sorted by createdAt DESC. There is no

updatedAt on the notifications table.



13.5 Link



Notification link uses the UI route form:

/support/tickets/GORKA-000123, using the display number.

The API itself uses cuids.



13.6 Email (deferred)



Deferred to the funded phase. The schema columns are

present but unused. No email service is chosen in v1.



================================================================

14\. RATE LIMITING

================================================================



14.1 Default limits



&#x20; Action                                 | Default limit

&#x20; ---------------------------------------|--------------

&#x20; Submit a ticket                        | 10 per user per hour

&#x20; Submit a ticket with a duplicate subject | 3 per user per hour

&#x20; Reply to a ticket                      | 20 per user per hour



Limits are per user, not per organization.



14.2 Configurable by the Owner



The three limits are stored in platform\_settings under

key rate\_limits:



&#x20; {

&#x20;   "tickets\_per\_hour": 10,

&#x20;   "duplicate\_subject\_per\_hour": 3,

&#x20;   "replies\_per\_hour": 20

&#x20; }



The Owner Dashboard exposes a form (three number fields,

Save button). No restart needed.



Validation rules:



&#x20; - Minimum: 1.

&#x20; - Maximum: 1000.

&#x20; - Zero is not permitted (use a very large number for

&#x20;   effectively unlimited).

&#x20; - Missing or invalid settings fall back to the

&#x20;   defaults above.

&#x20; - Changes apply to all backend instances on the next

&#x20;   rate-limit check.



Counter storage: rate-limit counters are stored in the

cloud database, not in process memory. A user cannot

exceed the limit by hitting different backend instances.



14.3 Duplicate detection



"Same subject" means: case-insensitive,

whitespace-normalized, punctuation-ignored. Two subjects

are duplicates if their normalized forms are equal.



Time window: the check looks back one hour.



Error semantics:



&#x20; - If the caller has made fewer than three

&#x20;   duplicate-subject submission attempts with the same

&#x20;   normalized subject in the past hour, the submission

&#x20;   proceeds (subject to the other checks).

&#x20; - If the caller has already made three such attempts

&#x20;   in the past hour, the fourth submission returns

&#x20;   409 DUPLICATE\_SUBJECT.

&#x20; - If the caller has exceeded the general ticket rate

&#x20;   limit (10 per hour), the submission returns

&#x20;   429 RATE\_LIMITED.



409 DUPLICATE\_SUBJECT and 429 RATE\_LIMITED are distinct.

A caller can hit one without hitting the other.



Counting rule: every submission whose normalized subject

matches an existing one within the one-hour window

consumes a duplicate-subject counter, regardless of

whether the submission subsequently fails for another

validation reason.



14.4 Rate limit response



When a limit is exceeded, the server returns

429 RATE\_LIMITED. Headers X-RateLimit-Limit,

X-RateLimit-Remaining, and X-RateLimit-Reset are returned

on all requests once the limit has been calculated.



================================================================

15\. API CONTRACT

================================================================



15.1 General conventions



&#x20; - Base path: /api/support/\*

&#x20; - Auth: all endpoints require authenticateToken. The

&#x20;   JWT carries userId, organizationId, role.

&#x20; - Content type: application/json.

&#x20; - IDs: cuid strings.

&#x20; - Timestamps: ISO 8601 UTC.



15.2 Authorization pattern



Every endpoint resolves the caller's support capabilities

from three inputs: role, organizationId, and the

SUPPORT\_AGENT capability. The frontend does not decide

authorization. A client-supplied scope, assignedTo,

routedQueue, or recipientUserId is never trusted as

final; the server resolves and validates.



15.3 Error format



&#x20; {

&#x20;   "error": {

&#x20;     "code": "STRING\_CODE",

&#x20;     "message": "Human-readable message",

&#x20;     "field": "optional field name"

&#x20;   }

&#x20; }



HTTP statuses:



&#x20; 400 - validation error

&#x20; 401 - not authenticated

&#x20; 403 - authenticated but not permitted

&#x20; 404 - resource not found, or exists but not visible

&#x20;       to the caller

&#x20; 409 - conflict (duplicate, illegal transition)

&#x20; 429 - rate limit exceeded

&#x20; 500 - server error



404 vs 403 is intentional. For resources the caller

cannot see, the server returns 404, never 403. This

prevents enumeration of ticket IDs across organizations.



15.4 Pagination



All list endpoints accept page (default 1), limit

(default 25, max 100). Response:



&#x20; {

&#x20;   "rows": \[ ... ],

&#x20;   "page": 1,

&#x20;   "limit": 25,

&#x20;   "total": 187

&#x20; }



Sort is fixed: updatedAt DESC for tickets and replies.

Notifications sort by createdAt DESC.



15.5 Tickets - endpoints



15.5.1 POST /api/support/tickets



Who can call: OWNER, CLIENT.



Request body:



&#x20; {

&#x20;   "subject": "string, 3-200 chars, required",

&#x20;   "category": "one of the six categories, required",

&#x20;   "priority": "one of LOW | MEDIUM | HIGH | URGENT,

&#x20;                default MEDIUM",

&#x20;   "message": "string, 10-10000 chars, required",

&#x20;   "recipientUserId": "string, required if caller is

&#x20;                       OWNER; ignored if caller is

&#x20;                       CLIENT",

&#x20;   "assignToUserId": "optional string"

&#x20; }



Server rules:



&#x20; - originatingSurface and originatingRole derived from

&#x20;   the caller.

&#x20; - routedQueue derived from the category, per

&#x20;   Section 6.4. Never accepted from the client.

&#x20; - If caller is OWNER: recipientUserId is required.

&#x20;   The target user must be a CLIENT user.

&#x20;   organizationId is derived from the recipient.

&#x20;   openedBy remains the Owner.

&#x20; - If caller is CLIENT: recipientUserId is ignored.

&#x20;   organizationId is the caller's organization.

&#x20; - PII pattern detection runs on subject and message.

&#x20; - Rate limit applied, including duplicate-subject

&#x20;   check.

&#x20; - CREATED event written.

&#x20; - Ticket number generated atomically.

&#x20; - If assignToUserId is supplied, it is validated with

&#x20;   the same rules as PATCH /assign. Invalid assignment

&#x20;   returns 400 INVALID\_ASSIGNMENT. A successful initial

&#x20;   assignment records an ASSIGNED event (not

&#x20;   REASSIGNED).



Response 201:



&#x20; {

&#x20;   "id": "cuid",

&#x20;   "ticketNumber": 123,

&#x20;   "displayNumber": "GORKA-000123",

&#x20;   "subject": "...",

&#x20;   "category": "TECHNICAL",

&#x20;   "priority": "MEDIUM",

&#x20;   "status": "OPEN",

&#x20;   "routedQueue": "STAFF",

&#x20;   "originatingSurface": "CLIENT\_DASHBOARD",

&#x20;   "originatingRole": "CLIENT",

&#x20;   "recipientUserId": null,

&#x20;   "assignedTo": null,

&#x20;   "assigneeScope": null,

&#x20;   "createdAt": "...",

&#x20;   "updatedAt": "..."

&#x20; }



Error cases:



&#x20; 400 VALIDATION\_ERROR

&#x20; 400 PII\_PATTERN\_REJECTED

&#x20; 400 INVALID\_ASSIGNMENT

&#x20; 400 RECIPIENT\_REQUIRED - caller is OWNER and

&#x20;     recipientUserId missing

&#x20; 400 INVALID\_RECIPIENT - recipient is not a CLIENT

&#x20;     user, or does not exist

&#x20; 403 PII\_POLICY\_NOT\_ACCEPTED

&#x20; 409 DUPLICATE\_SUBJECT

&#x20; 429 RATE\_LIMITED



15.5.2 GET /api/support/tickets



Who can call: OWNER, CLIENT. (Helper: read-only,

filtered to Staff queue.)



Scope resolution:



&#x20; - OWNER and SUPPORT\_AGENT: platform-wide. Optional

&#x20;   organizationId filter.

&#x20; - CLIENT: all tickets in the caller's organization,

&#x20;   plus tickets where recipientUserId is the caller.



Query parameters: page, limit, status, priority,

category, routedQueue, assignedToUserId, organizationId

(OWNER only), search.



Search scope: matches displayNumber, subject, message,

and openedByEmail. The openedByName field is resolved

from the current user record, not stored on the ticket;

if name search is needed, the API joins the User table.



Response 200: paginated shape, rows as in the POST

response, plus deleted (bool). Deleted tickets are

excluded by default; the deleted field is only true when

the caller is OWNER and has explicitly requested to see

deleted tickets.



15.5.3 GET /api/support/tickets/:id



Who can call: OWNER, CLIENT (Helper: Staff-queue tickets

only).



Response 200: full ticket plus replies (filtered by the

caller's readable note scopes) and events (Owner and

Helper only; other roles receive an empty array).



Deleted tickets: 404, unless the caller is OWNER.



15.5.4 PATCH /api/support/tickets/:id/status



Who can call: per Section 7.5.



Request body:



&#x20; {

&#x20;   "status": "one of IN\_PROGRESS | WAITING\_FOR\_CLIENT

&#x20;              | RESOLVED | CLOSED | OPEN",

&#x20;   "reason": "required when status = CLOSED; optional

&#x20;              otherwise"

&#x20; }



Server rules:



&#x20; - The transition must be legal per Section 7.2.

&#x20; - Close permission per Section 7.4.

&#x20; - RESOLVED -> OPEN and CLOSED -> OPEN are Owner-only.

&#x20; - A STATUS\_CHANGED event is written. Additionally:

&#x20;     Transition to RESOLVED also writes a RESOLVED

&#x20;     event.

&#x20;     Transition to CLOSED also writes a CLOSED event.

&#x20;     Transition to OPEN from RESOLVED or CLOSED also

&#x20;     writes a REOPENED event.

&#x20; - resolvedAt, resolvedBy, closedAt, closedBy,

&#x20;   firstRespondedAt populated as appropriate.



Errors: 400, 403 CLOSE\_NOT\_PERMITTED, 404,

409 ILLEGAL\_TRANSITION.



15.5.5 PATCH /api/support/tickets/:id/assign



Who can call: OWNER only.



Request body:



&#x20; {

&#x20;   "assignedToUserId": "string, required, or null to

&#x20;                        unassign",

&#x20;   "assigneeScope": "GORKA, required when

&#x20;                     assignedToUserId is not null"

&#x20; }



Server rules:



&#x20; - If assignedToUserId is null, the assignment is

&#x20;   cleared and an UNASSIGNED event is written.

&#x20; - Otherwise, the target user must exist, not be

&#x20;   deleted, and be compatible with the ticket's

&#x20;   routedQueue:

&#x20;     - If routedQueue = OWNER: the only valid

&#x20;       assignedToUserId is the Owner.

&#x20;     - If routedQueue = STAFF: the valid targets are

&#x20;       the Owner or a user holding the SUPPORT\_AGENT

&#x20;       capability.

&#x20;   Otherwise 400 INVALID\_ASSIGNMENT.

&#x20; - The previous assignee is recorded in

&#x20;   previousAssignee.

&#x20; - An ASSIGNED or REASSIGNED event is written as

&#x20;   appropriate.



15.5.6 PATCH /api/support/tickets/:id/escalate



Who can call: CLIENT only.



Request body:



&#x20; {

&#x20;   "reason": "string, 5-500 chars, required"

&#x20; }



Server rules:



&#x20; - escalatedAt, escalatedBy, escalationReason are set.

&#x20; - assignedTo is set to the Owner's user id,

&#x20;   assigneeScope = GORKA.

&#x20; - An ESCALATED event is written.

&#x20; - Notifies the Owner.



15.5.7 PATCH /api/support/tickets/:id/category



Who can call: OWNER only.



Request body:



&#x20; {

&#x20;   "category": "one of the six categories, required",

&#x20;   "reason": "string, required"

&#x20; }



Server rules:



&#x20; - routedQueue does not change.

&#x20; - A CATEGORY\_CHANGED event is written.



15.5.8 DELETE /api/support/tickets/:id



Who can call: OWNER only.



Soft delete. Sets isDeleted = true, deletedAt,

deletedBy. A DELETED event is written.



15.6 Replies and notes



15.6.1 POST /api/support/tickets/:id/reply



Who can call: any caller with visibility, per

Section 8.2.



Request body:



&#x20; {

&#x20;   "message": "string, 1-10000 chars, required"

&#x20; }



Server rules:



&#x20; - noteScope = PUBLIC set by the server.

&#x20; - Rejected if ticket is RESOLVED or CLOSED:

&#x20;   409 TICKET\_CLOSED.

&#x20; - PII pattern detection on message.

&#x20; - If the ticket has never had a first response and the

&#x20;   caller is GORKA-side, firstRespondedAt is set.

&#x20; - A REPLY\_ADDED event is written.

&#x20; - Notifications created per Section 13.2.



15.6.2 POST /api/support/tickets/:id/note



Who can call: OWNER and GORKA Support Helper only.



Request body:



&#x20; {

&#x20;   "message": "string, 1-10000 chars, required",

&#x20;   "noteScope": "INTERNAL\_GORKA, required"

&#x20; }



Server rules:



&#x20; - Only INTERNAL\_GORKA is valid; other values return

&#x20;   400 VALIDATION\_ERROR.

&#x20; - PII pattern detection on message.

&#x20; - A REPLY\_ADDED event with metadata.noteScope is

&#x20;   written.

&#x20; - Notifications created for the other GORKA-side

&#x20;   participants only.



15.7 Notifications



15.7.1 GET /api/notifications



Who can call: any authenticated user. Returns the

caller's own notifications only.



Notifications whose ticket is deleted are excluded from

normal notification responses. The notification rows

remain in the database but are not returned by this

endpoint.



Response 200: paginated shape, sorted by createdAt DESC.



Each row:



&#x20; {

&#x20;   "id": "cuid",

&#x20;   "type": "TICKET\_REPLY | TICKET\_ASSIGNED |

&#x20;            TICKET\_ESCALATED | TICKET\_STATUS\_CHANGED |

&#x20;            INTERNAL\_NOTE\_ADDED",

&#x20;   "message": "string",

&#x20;   "read": false,

&#x20;   "link": "/support/tickets/GORKA-000123",

&#x20;   "ticketId": "cuid",

&#x20;   "createdAt": "..."

&#x20; }



15.7.2 PATCH /api/notifications/:id/read



Who can call: the notification's owner only. Any other

caller receives 404.



15.8 Stats



15.8.1 GET /api/support/stats



Who can call: OWNER, CLIENT.



&#x20; - OWNER: platform-wide, optional organizationId

&#x20;   filter.

&#x20; - CLIENT: caller's organization.



Response 200:



&#x20; {

&#x20;   "open": 12,

&#x20;   "inProgress": 8,

&#x20;   "waitingForClient": 3,

&#x20;   "resolved": 45,

&#x20;   "closed": 120,

&#x20;   "total": 188,

&#x20;   "queue": {

&#x20;     "owner": 14,

&#x20;     "staff": 9

&#x20;   },

&#x20;   "avgFirstResponseHours": 3.2

&#x20; }



queue.owner and queue.staff count tickets by routedQueue,

not by assignedTo. No per-ticket data is returned.



15.9 Rate limit error



&#x20; 429

&#x20; {

&#x20;   "error": {

&#x20;     "code": "RATE\_LIMITED",

&#x20;     "message": "Too many requests. Try again after

&#x20;                 2026-10-03T15:30:00Z."

&#x20;   }

&#x20; }



15.10 Illegal transition error



&#x20; 409

&#x20; {

&#x20;   "error": {

&#x20;     "code": "ILLEGAL\_TRANSITION",

&#x20;     "message": "Cannot move a CLOSED ticket to

&#x20;                 IN\_PROGRESS. Reopen the ticket first.",

&#x20;     "field": "status"

&#x20;   }

&#x20; }



15.11 Closed-ticket reply error



&#x20; 409

&#x20; {

&#x20;   "error": {

&#x20;     "code": "TICKET\_CLOSED",

&#x20;     "message": "This ticket is closed. Please create

&#x20;                 a new ticket.",

&#x20;     "field": null

&#x20;   }

&#x20; }



The code is used for both RESOLVED and CLOSED replies.

The distinction is not exposed.



15.12 Assignment validation



assignedToUserId is validated against:



&#x20; 1. The user exists and is not deleted.

&#x20; 2. The target is compatible with the ticket's

&#x20;    routedQueue:

&#x20;      - If routedQueue = OWNER, the only valid

&#x20;        assignedToUserId is the Owner.

&#x20;      - If routedQueue = STAFF, the valid targets are

&#x20;        the Owner or a user holding the SUPPORT\_AGENT

&#x20;        capability.



Failure returns 400 INVALID\_ASSIGNMENT with a specific

message naming the failing check.



15.13 Recipient validation (Owner-created tickets)



recipientUserId is validated against:



&#x20; 1. The field is present when role = OWNER. Otherwise

&#x20;    400 RECIPIENT\_REQUIRED.

&#x20; 2. The user exists, is not deleted, and has role

&#x20;    CLIENT.

&#x20; 3. The target user's organization is used as the

&#x20;    ticket's organizationId.



Failure returns 400 INVALID\_RECIPIENT.



================================================================

16\. SURFACE UI

================================================================



16.1 Owner Dashboard



&#x20; - Sidebar entry: Support.

&#x20; - Views:

&#x20;     All tickets - platform-wide, filterable by

&#x20;       organization, category, status, assignee,

&#x20;       queue.

&#x20;     Owner queue - tickets with routedQueue = OWNER.

&#x20;     Staff queue - tickets with routedQueue = STAFF.

&#x20;     Stats - counts, response times.

&#x20; - Actions: reply, internal note, assign, close,

&#x20;   reopen, change category, soft delete.

&#x20; - Detail view shows the full history including

&#x20;   internal GORKA notes.

&#x20; - Settings: rate-limits form, PII forbidden patterns

&#x20;   form.

&#x20; - Submission form has a required To dropdown listing

&#x20;   CLIENT admins across all client organizations.



16.2 Client Dashboard



&#x20; - Sidebar entry: Support.

&#x20; - Views:

&#x20;     My submissions - tickets the admin submitted.

&#x20;     From GORKA - tickets where recipientUserId is the

&#x20;       caller.

&#x20; - Actions: reply, escalate to GORKA, close

&#x20;   (non-owner-origin only).

&#x20; - Detail view shows public replies only. No internal

&#x20;   GORKA notes visible.

&#x20; - Submission form: subject, category (all six),

&#x20;   priority, message, PII warning above the submit

&#x20;   button.



16.3 Shared components



&#x20; - Ticket row: display number, subject, category,

&#x20;   priority, status, updated-at.

&#x20; - Ticket detail: header (number, subject, status,

&#x20;   category), thread of replies with scope indicator,

&#x20;   action bar.

&#x20; - New ticket form with PII warning.

&#x20; - Internal GORKA notes visually distinct from public

&#x20;   replies.



16.4 What is not in the UI (v1)



&#x20; - No Agent support surface.

&#x20; - No attachments.

&#x20; - No real-time updates.

&#x20; - No SLA timers.

&#x20; - No ticket merge UI.

&#x20; - No trash view.



================================================================

17\. SECURITY REQUIREMENTS

================================================================



17.1 Tenant isolation



&#x20; - CLIENT queries are always restricted to the caller's

&#x20;   organization.

&#x20; - SUPPORT\_AGENT queries may cross organization

&#x20;   boundaries, but only for tickets in the STAFF queue.

&#x20; - OWNER queries are platform-wide.



Enforced server-side. The support authorization layer

resolves the caller's role and capability before any

query is issued.



17.2 Cross-org visibility



Only the Owner and users holding the SUPPORT\_AGENT

capability see cross-org tickets. The capability is

scoped to the Staff queue.



17.3 PII boundary



All support writes go through the PII safety layer.

Reads do not.



17.4 Audit integrity



support\_ticket\_events and organization\_audit\_events are

append-only.



17.5 Rate limiting



Enforced server-side, per user, counters in the cloud

database.



17.6 No support data in the local-first plane



Support data never enters a Tauri local database.



================================================================

18\. SOFT DELETE

================================================================



18.1 Who can delete



OWNER only.



18.2 What happens



The ticket's isDeleted is set to true. A DELETED event

is written.



18.3 Visibility



Deleted tickets are hidden from all non-Owner views. The

Owner sees them only with an explicit filter.



18.4 Replies, events, notifications



&#x20; - Replies and events remain in the database,

&#x20;   append-only.

&#x20; - Notifications pointing to deleted tickets are

&#x20;   excluded from normal notification responses. The

&#x20;   rows remain in the database.

&#x20; - Statistics exclude deleted tickets.

&#x20; - No restore in v1.



================================================================

19\. IMPLEMENTATION PHASES

================================================================



Phase 1 - Backend



&#x20; - Rewrite support.routes.ts against current backend

&#x20;   conventions.

&#x20; - Apply the schema changes from Section 5, including

&#x20;   support\_submission\_rejections.

&#x20; - Apply the support tables to gorka\_test.

&#x20; - Implement the SUPPORT\_AGENT capability resolution.

&#x20; - Implement tenant isolation, PII pattern detection

&#x20;   on writes, transactional audit, rate limiting

&#x20;   (with platform\_settings source and database-backed

&#x20;   counters), pagination.

&#x20; - Verify end-to-end with curl, including a Shape A

&#x20;   test user with cross-org Staff-queue visibility.



Phase 2 - Owner Dashboard (web)



&#x20; - Support page with four views.

&#x20; - Ticket detail with reply, note, assign, close,

&#x20;   reopen, change category, soft delete.

&#x20; - Stats.

&#x20; - Rate-limits form and PII patterns form in Settings.

&#x20; - Submission form with required recipient picker.



Phase 3 - Client Dashboard



&#x20; - Support page with two views.

&#x20; - Ticket detail with reply, escalate, close.

&#x20; - Submission form with PII warning.



Phase 4 - Notifications



&#x20; - In-app notifications in both surfaces.



Phase 5 - First helper activation



&#x20; - Create the GORKA Support organization on

&#x20;   production.

&#x20; - Grant the SUPPORT\_AGENT capability to the first

&#x20;   helper.

&#x20; - Verify cross-org Staff-queue visibility live.



The mechanism ships in Phase 1. Phase 5 is the

operational step of onboarding a helper.



================================================================

20\. EXPLICIT EXCLUSIONS

================================================================



&#x20; - No Agent support participation of any kind.

&#x20; - No Agent to GORKA direct submission.

&#x20; - No Agent to Admin support tickets. Agent-Admin

&#x20;   communication is the separate internal chat / team

&#x20;   notices workstream.

&#x20; - No public website support submission.

&#x20; - No anonymous submission.

&#x20; - No email notifications in v1.

&#x20; - No fourth role (SUPPORT) in v1.

&#x20; - No INTERNAL\_CLIENT\_ADMIN or INTERNAL\_CLIENT\_TEAM

&#x20;   note scopes.

&#x20; - No attachments.

&#x20; - No real-time updates.

&#x20; - No SLA enforcement.

&#x20; - No auto-assignment rules.

&#x20; - No satisfaction surveys.

&#x20; - No knowledge base.

&#x20; - No chatbot.

&#x20; - No ticket merge UI.

&#x20; - No email ingestion.

&#x20; - No reply editing.

&#x20; - No trash/restore view.

&#x20; - No local Tauri support tables.

&#x20; - No support data in the sync engine.



Direct agent-to-GORKA support submission may be

revisited as a per-organization setting in the funded

phase if a client requests it. It is not part of MVP.



Client-side internal communication (team notices,

internal chat between admin and agents) is a separate

future workstream. It is not part of the support system.

Not stored in support tables. Not routed. Not visible to

GORKA.



================================================================

END OF DOCUMENT

================================================================



