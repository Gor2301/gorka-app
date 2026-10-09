\# CREDENTIALS.md — GORKA pilot credentials



\## Where the values live



The real values live in `pilot-creds.local.bat`:



&#x20;   Cloud:  C:\\gorka-app\\pilot-creds.local.bat

&#x20;   Main:   not present. Main is edit-only. It never runs the backend,

&#x20;           never runs cargo, and never runs the live test.



`pilot-creds.local.bat` is gitignored. It is NOT in git. This is not

optional — see "Why not in git" below.



`pilot-creds.bat` (in git) is a template. It calls the local file if

present. It contains no values.



\## Why not in git



Resend partners with GitHub secret scanning. Any Resend key pushed to a

GitHub repo is auto-revoked by Resend within minutes. Confirmed three

times on 2026-10-09/10. Pushing a Resend key to git kills it.



Therefore: no secrets in git. Never. Not even as "pilot". The provider

kills them.



\## Required environment variables



&#x20;   DATABASE\_URL          Supabase pooler URL for gorka\_test

&#x20;   RESEND\_API\_KEY        your Resend key

&#x20;   GORKA\_RESEND\_API\_KEY  GORKA's Resend key (pilot: same as RESEND\_API\_KEY)

&#x20;   GORKA\_RESEND\_FROM     verified from address (pilot: onboarding@resend.dev)

&#x20;   TMP                   C:\\cargo-tmp

&#x20;   TEMP                  C:\\cargo-tmp



\## Backup



If cloud is wiped, pilot-creds.local.bat is lost. Keep a copy outside

git — a text file on the desktop, a password manager note, or a USB

stick. One copy is enough. Restore by copying it back to

C:\\gorka-app\\pilot-creds.local.bat.



\## Rotating a key



1\. Create a new key in the provider dashboard.

2\. Verify it with curl before using it.

3\. Update pilot-creds.local.bat on cloud.

4\. Restart the backend.

5\. Delete the old key in the provider dashboard.



Do not commit the new key. Do not paste it into a chat that gets

archived into a git-tracked file.



\## Launch (for reference)



In production, the backend runs on a host (Vercel, Railway, Fly,

Render) and its secrets are set in the host's dashboard. The Agent

never reads a key from disk — it receives credentials over encrypted

sync and stores them in local SQLCipher. Nothing about the pilot

workflow above is part of the product. It is a dev-side workaround

for the fact that GitHub+Resend kill any key in a repo.

