@echo off
REM --------------------------------------------------------------------
REM pilot-creds.bat — GORKA pilot environment loader.
REM
REM This file contains NO secrets. The real values live in
REM pilot-creds.local.bat, which is gitignored and exists ONLY on the
REM cloud build machine. GitHub secret scanning auto-revokes any Resend
REM key that lands in a repo (Resend partners with GitHub — confirmed
REM 2026-10-10), so secrets never enter git.
REM
REM Usage in any terminal that needs the DB, backend, cargo, or Prisma:
REM
REM     cd /d C:\gorka-app && call pilot-creds.bat && <rest of command>
REM
REM Uses `call` so the variables propagate into the calling shell.
REM --------------------------------------------------------------------

if exist "%~dp0pilot-creds.local.bat" (
    call "%~dp0pilot-creds.local.bat"
) else (
    echo pilot-creds.bat: WARNING - pilot-creds.local.bat not found.
    echo This terminal has NO database or API credentials set.
    echo On cloud, create pilot-creds.local.bat. See CREDENTIALS.md.
)