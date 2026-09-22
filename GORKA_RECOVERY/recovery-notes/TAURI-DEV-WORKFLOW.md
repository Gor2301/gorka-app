\# TAURI DEV WORKFLOW



Version: 1.0

Date: September 14, 2026

Status: Operational reference. Not a phase.



Purpose: Record the workaround required to run the Tauri app on

this machine after Windows Application Control (WDAC) began

blocking unsigned newly-built binaries on September 9, 2026.



============================================================

1\. THE PROBLEM

============================================================



Windows Application Control (WDAC) on this machine is enforced

(CodeIntegrityPolicyEnforcementStatus = 2). It blocks newly

compiled unsigned binaries. Symptoms:



\- `npm run tauri:dev` compiles the Rust binary, then tries to

&#x20; run it, and fails with:

&#x20;   An Application Control policy has blocked this file.

&#x20;   (os error 4551)

\- The previously working binary still ran because Windows had

&#x20; already trusted it. Any fresh build is rejected.



Defender exclusions (Add-MpPreference -ExclusionPath) do NOT

help. This is Application Control, not real-time scanning.



============================================================

2\. THE SOLUTION

============================================================



A self-signed code-signing certificate was created and trusted

at the system level, then each build is signed manually after

compilation and before execution.



Certificate details:

&#x20; Subject:    CN=GORKA Dev Signing

&#x20; Thumbprint: 370532F494A44A0B46E789D40649B26A13096FDB

&#x20; Valid:      9/14/2026 to 9/14/2029

&#x20; Location:   Cert:\\CurrentUser\\My

&#x20; Exported:   C:\\Users\\kucha\\GORKADev.cer



Trusted in:

&#x20; - Cert:\\CurrentUser\\TrustedPeople

&#x20; - Cert:\\CurrentUser\\TrustedPublisher

&#x20; - LocalMachine\\Root (via `certutil -addstore -f Root`)

&#x20; - LocalMachine\\TrustedPublisher (via `certutil -addstore -f

&#x20;   TrustedPublisher`)



The Code Signing EKU (1.3.6.1.5.5.7.3.3) is present on the

certificate.



============================================================

3\. THE WORKFLOW FOR EVERY RUST CHANGE

============================================================



`npm run tauri:dev` no longer works on this machine. Use the

following three-step process instead.



\## Step 1 - start the Vite dev server



In terminal A:



&#x20;   cd C:\\Users\\kucha\\gorka-app \&\& npm run dev



Wait for:

&#x20;   VITE v... ready

&#x20;   Local: http://localhost:5173/



Leave this terminal running.



\## Step 2 - build the Rust binary and sign it



In terminal B:



&#x20;   cd C:\\Users\\kucha\\gorka-app\\src-tauri \&\& cargo build



Then sign the built binary:



&#x20;   powershell -Command "Set-AuthenticodeSignature -FilePath 'C:\\Users\\kucha\\gorka-app\\src-tauri\\target\\debug\\gorka-client.exe' -Certificate (Get-ChildItem Cert:\\CurrentUser\\My\\370532F494A44A0B46E789D40649B26A13096FDB)"



Expected Status: Valid.



\## Step 3 - run the signed binary



In terminal B, same window:



&#x20;   C:\\Users\\kucha\\gorka-app\\src-tauri\\target\\debug\\gorka-client.exe



The app window opens and loads the frontend from Vite at

localhost:5173. Login and Unlock flow as normal.



============================================================

4\. FRONTEND-ONLY CHANGES

============================================================



If only files under supervisor-dashboard/src/ changed, no Rust

rebuild and no re-signing is needed. The signed binary loads

them fresh from the Vite dev server on each launch.



If files under src-tauri/ changed, the full three-step workflow

above is required.



============================================================

5\. HOW TO REMOVE THE TRUST LATER

============================================================



In an elevated command prompt:



&#x20;   certutil -delstore Root 370532F494A44A0B46E789D40649B26A13096FDB

&#x20;   certutil -delstore TrustedPublisher 370532F494A44A0B46E789D40649B26A13096FDB



In a normal terminal:



&#x20;   Remove-Item Cert:\\CurrentUser\\My\\370532F494A44A0B46E789D40649B26A13096FDB

&#x20;   Remove-Item Cert:\\CurrentUser\\TrustedPeople\\370532F494A44A0B46E789D40649B26A13096FDB

&#x20;   Remove-Item Cert:\\CurrentUser\\TrustedPublisher\\370532F494A44A0B46E789D40649B26A13096FDB



And delete C:\\Users\\kucha\\GORKADev.cer.



After removal, newly built binaries will be blocked again.



============================================================

6\. NOTES FOR FUTURE SESSIONS

============================================================



\- Do NOT run `npm run tauri:dev`. It will build, then fail on

&#x20; the run step because the binary is unsigned.

\- The signing must happen AFTER every cargo build and BEFORE

&#x20; every run.

\- If the certificate expires (9/14/2029), create a new one and

&#x20; repeat Sections 2 and 3.

\- The 9/9/2026 Windows updates (KB5124007, KB5124008,

&#x20; KB5126052) and the 9/9/2026 WDAC policy changes are the

&#x20; likely trigger for the enforcement change.


============================================================
7. UPDATE — September 17, 2026: SMART APP CONTROL
============================================================

Since September 15, 2026, there is an additional blocker beyond
WDAC. Smart App Control (SAC) on this machine blocks the signed
binary even after the WDAC workaround is applied.

What this means in practice:

- The signing workflow in Sections 2 through 6 still works.
  Set-AuthenticodeSignature still reports Status: Valid.
- But running the binary on this machine still fails with the
  Device Guard block, because SAC requires a certificate from
  the Microsoft Trusted Root Program. A self-signed certificate
  does not satisfy this, no matter how it is trusted locally.
- The CodeIntegrity event log shows Event ID 3077 with Policy
  ID {0283ac0f-fff1-49ae-ada1-8a933130cad6}, which is the
  Smart App Control base policy.

The chosen workaround is a cloud Windows environment, not a
change to this machine's security. See the September 15, 2026
entry in DECISIONS.md, "SAC investigation and cloud development
environment decision," for the full reasoning.

When a cloud Windows environment is set up, the same signing
workflow applies there. The difference is that SAC is either
off or controllable in the cloud environment, so the signed
binary runs.

Frontend-only changes on this machine still work: the existing
signed binary loads the new frontend from the Vite dev server.
Rust changes require the cloud environment until SAC is
resolved.


============================================================

END OF DOCUMENT

============================================================

