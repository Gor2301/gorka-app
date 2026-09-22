\# GORKA BOUNDARY TEST PLAN



Version: 1.0 (draft)

Date: September 14, 2026

Phase: 15 — Boundary / Security Test

Status: DRAFT — awaiting founder review



Purpose: Specify the manual and automated boundary tests that

prove no debtor data crosses the GORKA cloud boundary. This plan

is written now so that the tests can be executed when the Tauri

frontend exists. Until then, only the static review in Section 3

can be run.



Authority: Architectural Law §9 (the proof test), Data Boundary

Matrix §Critical Boundary Rules, Recovery Rules.



============================================================

1\. WHAT THE TESTS MUST PROVE

============================================================



The invariant: no individual debtor information is stored in

GORKA cloud infrastructure.



That decomposes into three separate claims, each of which must

be proven:



Claim A — Static claim.

&#x20; No GORKA cloud table has a field that can hold or reference a

&#x20; debtor. No backend endpoint accepts or returns a debtor field.



Claim B — Runtime claim.

&#x20; When the Tauri client is used normally (create debtor, create

&#x20; debt, send communication, upload document, log action), no

&#x20; outbound request from the client carries any debtor-level value.



Claim C — Inference claim.

&#x20; Even from cloud-side aggregates (debtor\_count, total\_debt,

&#x20; activity counts), a single debtor cannot be reconstructed.

&#x20; This is guarded by not permitting small-set aggregates that

&#x20; would identify an individual.



Claim A is testable now. Claims B and C require the Tauri

frontend.



============================================================

2\. TEST DEFINITIONS

============================================================



\## 2.1 Manual boundary test (Claim B)



Procedure:



1\. In a fresh Tauri client instance, unlock the local DB with a

&#x20;  known test password.

2\. Insert one recognizable fake debtor:

&#x20;    Name:  John Test Debtor

&#x20;    Phone: +63-900-000-0001

&#x20;    Email: john.test.debtor@example.invalid

&#x20;    Debt:  125000.00 PHP

&#x20;    Note containing the phrase: "CANARY-MARKER-001"

3\. Start network capture: Windows netsh trace, Fiddler, Wireshark,

&#x20;  or mitmproxy. Capture every outbound request from the Tauri

&#x20;  process for the duration of the test.

4\. Exercise the app for 10 minutes:

&#x20;    - Search for "John Test Debtor"

&#x20;    - Open the debtor

&#x20;    - Create a debt entry

&#x20;    - Log an SMS communication

&#x20;    - Upload a small document

&#x20;    - Create a task/action

&#x20;    - Trigger any "Sync Now" or background sync

5\. Stop capture. Export every outbound request body.

6\. Grep captured traffic for every one of these strings:

&#x20;    John Test Debtor

&#x20;    000-000-0001

&#x20;    john.test.debtor@example.invalid

&#x20;    125000

&#x20;    CANARY-MARKER-001

7\. Expected result: zero matches.

8\. If any string appears in a request to a GORKA cloud host

&#x20;  (api.gorka.click, api.gorka.localhost, or any GORKA domain),

&#x20;  the architecture is broken. Stop. Escalate.



\## 2.2 Automated boundary test (Claim B, in CI)



Same as the manual test, but executed by a test harness:



\- A scripted Tauri scenario inserts the canary debtor.

\- The Tauri process runs with outbound traffic routed through a

&#x20; local proxy that logs all request bodies.

\- The proxy scans each request body for a list of canary strings

&#x20; before forwarding.

\- If any canary string is found on the wire to a GORKA cloud host,

&#x20; the test fails and the build fails.

\- The proxy allowlists provider endpoints (Twilio, Resend, etc.)

&#x20; so their traffic passes but is still scanned.



Location in the repository: to be decided. Suggested:

&#x20; tests/boundary/manual-test.md

&#x20; tests/boundary/automated-test.sh

or a small TypeScript harness under the CI workflow.



\## 2.3 Aggregation inference test (Claim C)



Procedure:



1\. Seed a test organization with N debtors, N >= 20.

2\. Record debtorCount and totalDebt into aggregate\_metrics.

3\. Attempt to infer any single debtor from what cloud receives:

&#x20;  - The cloud stores debtor\_count and total\_debt only.

&#x20;  - No per-debtor detail exists in cloud.

4\. The test asserts: cloud can only answer aggregate questions.

&#x20;  Any query that would identify an individual returns nothing.



This test is currently hypothetical because the cloud side only

stores aggregates by design. It is written for completeness.



\### 2.4 Multi-machine relay test (Claim D, added September 17, 2026)



\*\*What it proves:\*\* The new canonical promise — "GORKA cannot

decrypt your debtor data" — is true for the multi-user case. The

relay carries only ciphertext. The Control Plane stores only

metadata. Decryption keys exist only on the client's devices.



\*\*Authority:\*\* `ARCHITECTURAL-LAW.md` v1.2 §20.3, §20.4;

`DATA-BOUNDARY-MATRIX.md` v1.2 §20.1, §20.2, §20.5;

`MULTI-USER-CONCEPT.md` §3, §7.



\*\*Procedure:\*\*



1\. Run two devices on separate machines. Both belong to the same

&#x20;  test organization. Device A is the hub (admin). Device B is a

&#x20;  spoke (agent).



2\. Configure the test to force the relay path. Both machines

&#x20;  must connect through GORKA's encrypted relay, not by direct

&#x20;  connection. This is the stricter test. Direct-connection

&#x20;  verification is a separate run.



3\. On device A, insert a canary debtor:



&#x20;  Name:  Relay Test Debtor

&#x20;  Phone: +63-900-000-0002

&#x20;  Email: relay.test.debtor@example.invalid

&#x20;  Debt:  222000.00 PHP

&#x20;  Note containing the phrase: "RELAY-CANARY-002"



4\. Confirm the canary debtor syncs to device B. Both devices

&#x20;  now hold the record.



5\. Capture every byte that reaches GORKA's infrastructure for

&#x20;  the duration of the test:



&#x20;  - All inbound traffic to the relay service.

&#x20;  - All rows written to `device\_registrations`.

&#x20;  - All rows written to `relay\_sessions`.

&#x20;  - Any application log generated by the Control Plane.

&#x20;  - Any application log generated by the relay.



6\. Additionally, capture the wire traffic between the two

&#x20;  devices and GORKA's infrastructure, if the test environment

&#x20;  allows. This is the strongest form of evidence.



7\. Grep every captured byte, every stored row, and every log

&#x20;  line for each of these strings:



&#x20;  - `Relay Test Debtor`

&#x20;  - `000-000-0002`

&#x20;  - `relay.test.debtor@example.invalid`

&#x20;  - `222000`

&#x20;  - `RELAY-CANARY-002`



8\. \*\*Expected result — zero matches for readable debtor data.\*\*

&#x20;  The captured traffic must be ciphertext. The rows in

&#x20;  `device\_registrations` and `relay\_sessions` must contain

&#x20;  only metadata: organization IDs, device IDs, timestamps,

&#x20;  byte counts, session statuses. No names, no amounts, no

&#x20;  message content, no key material.



9\. \*\*Additionally verify key material is absent.\*\* Search the

&#x20;  captured data and stored rows for anything that looks like

&#x20;  a key, a key hash, a private key, or a public key that could

&#x20;  be used to derive the symmetric session key. No key

&#x20;  material of any kind should exist on GORKA's infrastructure.



10\. \*\*Negative test:\*\* attempt to decrypt one captured relay

&#x20;   payload using every key the test environment can produce.

&#x20;   Expected: failure. The keys to decrypt the payload exist

&#x20;   only on the client's devices and are not derivable from

&#x20;   anything on GORKA's side.



\*\*If any readable debtor string appears in any GORKA-controlled

log or stored row, or if any key material is found, the

architecture is broken. Stop. Escalate.\*\*



\*\*If the relay payload can be decrypted by GORKA with any

configuration of its own infrastructure, the architecture is

broken. Stop. Escalate.\*\*



\*\*Note on MVP vs. production:\*\* This test is written now, for

execution once the sync engine exists. It cannot be run until

Phase 9.6 is complete. It is included in this plan so that the

acceptance criteria for the sync engine include it, and so that

the sync engine is built with this test in mind from the

beginning.











============================================================

3\. WHAT CAN BE TESTED TODAY (Claim A)

============================================================



Static review results, September 14, 2026:



\- 19 cloud models inspected. None contains a debtor name, phone,

&#x20; email, address, ID, individual amount, message content,

&#x20; document, or action. Two permitted fields mention "debtor":

&#x20; debtor\_count (Int, aggregate) and debtor\_data\_included

&#x20; (Boolean, proof marker).

\- 10 backend route files inspected. No endpoint accepts or

&#x20; returns a debtor field.

\- Two risk areas recorded:

&#x20;   (i)  Support ticket free-text fields (subject, message,

&#x20;        reply, messagePreview) could contain debtor info if a

&#x20;        user typed it. Mitigation: UI warning + confirmation.

&#x20;        UI is deferred.

&#x20;   (ii) Template.content has no DB-level parameterization

&#x20;        enforcement. Mitigation: UI/API. Deferred.



Conclusion: Claim A holds at the schema and backend layer as of

today. Claims B and C are deferred until the Tauri frontend

exists.



============================================================

4\. WHAT IS DEFERRED

============================================================



\- Manual boundary test execution — depends on Tauri frontend.

\- Automated boundary test in CI — same.

\- Aggregation inference test — depends on running sync from a

&#x20; Tauri client.

\- Support UI warning enforcement — depends on client dashboard.

\- Template parameterization enforcement — same.



All of these defer to the same workstream that is currently

blocking Phase 9: the Tauri frontend.



============================================================

5\. ALL OUTBOUND CHANNELS TO COVER

============================================================



When the tests are executed, they must exercise all outbound

channels the Tauri app uses:



\- Auth (login, /me)

\- License checks (if any client-side)

\- Metrics sync (POST /api/metrics/sync)

\- Activity sync (POST /api/activity/sync)

\- Connector usage sync (POST /api/connector-usage/sync)

\- Support ticket submission

\- Notifications

\- Update checks

\- Telemetry / error reporting

\- Application logs

\- Crash reports



Each channel must be exercised with the canary debtor present,

and each must be scanned for the canary strings.



============================================================

6\. ALL DEBTOR FIELDS TO COVER

============================================================



The canary debtor in Section 2.1 must include:



\- name

\- surname

\- phone

\- email

\- address

\- government ID or internal ID

\- individual debt amount

\- debt due date

\- communication content (SMS body, email body)

\- document filename

\- document contents (a small file with the canary string)

\- action content

\- AI prompt containing the canary string

\- AI response



============================================================

7\. SIGN-OFF

============================================================



Phase 15 is complete when:



\- Static review (Claim A) has been executed and documented.

&#x20; DONE — Section 3 of this plan.

\- Manual test (Claim B) has been executed on a working Tauri

&#x20; build and its results recorded. DEFERRED.

\- Automated test (Claim B in CI) exists and passes.

&#x20; DEFERRED.

\- Aggregation inference test (Claim C) has been executed.

&#x20; DEFERRED.

\- All outbound channels and debtor fields have been exercised.

&#x20; DEFERRED.

\- Test results are documented and signed off by the founder.

&#x20; PENDING.



Until the Tauri frontend exists, Phase 15 can only partially

complete. The static portion is done. The runtime portion stays

BLOCKED on the same dependency as Phase 9.



============================================================

END OF DOCUMENT

============================================================

