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
8. UPDATE — September 24, 2026: CARGO.EXE BLOCKED
============================================================

A new block. Different from the Section 7 SAC block.

## What happens

Running cargo build on the main machine fails with:

  'C:\Users\kucha\.cargo\bin\cargo.exe' was blocked by your
  organization's Device Guard policy.
  Contact your support person for more info.

The block is on cargo.exe itself, at invocation, before any
build happens.

## How this differs from Section 7

Section 7 recorded a block on the built binary
(gorka-client.exe) at run time. The workaround there was to
sign the binary, and the remaining problem was that SAC
rejected the self-signed certificate at execution.

This section records a block on the compiler toolchain itself.
The binary is never produced. The signing workaround does not
apply, because there is no output to sign.

## The cause

The same enforcement family as Section 7: Smart App Control,
Policy ID {0283ac0f-fff1-49ae-ada1-8a933130cad6}, the
VerifiedAndReputableDesktop policy.

A Rust project issue (rust-lang/rust#160163) documents the
same problem: freshly downloaded or updated toolchains are
blocked by SAC after their cloud reputation is evaluated. The
block can appear days after a toolchain worked.

## The chosen response

The cloud machine is the sole build environment. The main
machine is the editor and the repository host.

The development model:

  main machine:
    - edit files
    - git add, git commit, git push

  cloud machine:
    - git pull
    - cargo build
    - run the binary
    - verify

This extends the September 15 and September 21-22 model one
step. Before, the main machine could not run binaries. Now it
cannot build them either.

## Workarounds considered and not adopted

1. Re-download the toolchain via rustup. Buys a window before
   SAC flags the new cargo.exe. Not a fix; the block returns.

2. Toggle SAC off via the KB5074105 toggle. Changes the
   machine's security posture. The September 15 investigation
   found the toggle unreliable on some machines.

3. Move CARGO_TARGET_DIR. Addresses a different class of
   block (build scripts in %TEMP%), not cargo.exe itself.

## What to do if the block appears

Do not fight it on the main machine. Move to the cloud machine.
The cloud machine has SAC off or controllable, and cargo build
works there.

If a future session needs to compile on the main machine, the
first step is to check whether cargo.exe is still blocked.
If it is, the cloud machine is the only path.

## What does not change

- The signing workflow in Sections 2 through 6 still applies
  on the cloud machine.
- Frontend-only changes on the main machine still work: the
  existing signed binary loads the new frontend from the Vite
  dev server, if a signed binary is available.

============================================================

END OF DOCUMENT

============================================================

