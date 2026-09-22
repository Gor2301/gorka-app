\# GORKA RECOVERY RULES



\*\*Version:\*\* 1.0

\*\*Date:\*\* September 11, 2026

\*\*Purpose:\*\* Permanent rules for the recovery period and beyond.

\*\*Authority:\*\* These rules sit alongside the Architectural Law.

Breaking them is how GORKA drifts. Following them is how GORKA

stays aligned.



\---



\## The Rules



\### 1. Do not modify production to make a test pass.



If a test fails against production, fix the test, the code, or the

architecture. Never the production data.



\### 2. Do not add a cloud table because a backend route expects it.



Before adding any table, ask:



> "Should this data exist in cloud at all?"



If the answer isn't clearly yes → it doesn't belong.



\### 3. Do not add a debtor model to Prisma's cloud schema.



The cloud Prisma schema contains only cloud models. If a debtor model

is needed, it belongs in the Tauri local app.



\### 4. Do not put a foreign key to debtors in any cloud table.



Even a nullable FK is forbidden. It creates a path from cloud metadata

to an individual debtor.



\### 5. Do not send debtor IDs as "metadata."



A debtor ID is a cross-system identifier. It doesn't matter that it's

"just an ID" — it can be used to reconstruct a record. It stays local.



\### 6. Do not put personalized messages into cloud templates.



Allowed in cloud:

&#x20;  "Dear {{debtor\_name}}, your balance is {{amount}}..."



Not allowed in cloud:

&#x20;  "Dear John Smith, your balance is $4,285..."



Templates must be parameterized. Rendered content stays local.



\### 7. Do not put debtor information into support tickets.



Support tickets are a PII leak vector. A client might paste

"John Smith at 14 Main Street owes $7,500" into a ticket.



Enforce in the UI:

&#x20;  "Do not include debtor personal information or case details."



Enforce in policy. Enforce in the law. Later, enforce in detection.



\### 8. Do not assume an external provider supports GORKA-issued

temporary credentials.



Before implementing any connector, prove for that specific provider

that a call path exists which does not send debtor data through

GORKA cloud.



Each provider has its own auth model. Twilio ≠ Resend ≠ Gemini.

Prove it per provider.



\### 9. Do not mix local SQLite models back into the cloud Prisma

schema.



Two data planes. Two schemas. Two purposes. They do not merge.



\### 10. Do not use `prisma db push` against production during

development.



Production is frozen. All development happens against `gorka\_test`

or another test database.



\### 11. Do not fix schema mismatches by adding random columns.



If a column is missing, ask: "Should this column exist in cloud at

all?" If unclear → stop and clarify. Never patch a schema to silence

an error.



\### 12. Do not touch the working Tauri CI/CD pipeline unless a

specific test proves it needs modification.



The Tauri build works. The installers work. The GitHub Release works.

Protect it. Only modify it if a specific acceptance test fails

because of the pipeline itself.



\### 13. Do not start Phase 13-14 connectors while Phases 3-12 are

unstable.



Connectors are the last phase. They depend on a stable cloud schema,

a stable backend, a working local database, and a proven metrics

sync. If any of those are broken, fix them first.



\### 14. Do not let a failing test cause us to question the

architecture again.



This is the most important rule.



If a test fails, debug down this chain:



&#x20;  Architecture

&#x20;       ↓

&#x20;  Specification

&#x20;       ↓

&#x20;  Schema

&#x20;       ↓

&#x20;  Backend

&#x20;       ↓

&#x20;  Test



Find the level where the failure originates. Fix at that level.



Do not change the architecture merely because the implementation

doesn't yet match it.



This is exactly what happened in September 2026. Registration

failed, and instead of fixing the schema/backend implementation,

we questioned the architecture and drifted. Two days were lost.



We do not do that again.



\---



\## Zero Production Rule



Between Phase 2 and Phase 17:



\*\*NO production SQL.\*\*



Not:

\- "Let's quickly check something in Supabase."

\- "Let's add this one missing column."

\- "Let's test registration against production."

\- "Let's run one SELECT to confirm."



Not even a read.



Production becomes effectively \*\*frozen\*\* until the final cutover.



If you need to check something, check `gorka\_test`. If you need to

verify a value in production, restore the most recent backup into a

local test database and inspect that.



The single exception: read-only diagnostic commands approved

explicitly, in writing, for a specific purpose.



\---



\## Summary



The Rules (14)



No production modification for tests



No cloud table without architectural reason



No debtor model in cloud schema



No foreign key to debtors in cloud



No debtor IDs in cloud metadata



No personalized content in cloud templates



No debtor info in support tickets



No universal connector token assumption



No mixing of local and cloud schemas



No db push against production



No random columns to fix mismatches



No touching working CI/CD



No connectors before stable core



No architecture changes from test failures



Process Rule



Zero production SQL between Phase 2 and Phase 17



Purpose



Stop drift. Preserve the boundary. Ship the product.







\---



\*\*These rules are permanent. They apply today, tomorrow, and in

every future session.\*\*



\*\*They are what keep GORKA aligned.\*\*













