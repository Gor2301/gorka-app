@echo off
REM --------------------------------------------------------------------
REM pilot-creds.bat — GORKA pilot credential and environment loader.
REM
REM Call this at the START of every terminal session that needs the DB,
REM the backend, cargo, or Prisma:
REM
REM     cd /d C:\gorka-app && call pilot-creds.bat && <rest of command>
REM
REM Uses `call` so the variables propagate into the calling shell.
REM Running it without `call` will set the vars in a child process and
REM they will be lost when the script exits.
REM
REM Pilot-stage only. Real credentials replace these before the first
REM real customer. See GORKA_RECOVERY/recovery-notes/CREDENTIALS.md.
REM --------------------------------------------------------------------

set "DATABASE_URL=postgresql://postgres.tmloklxelckicufzpzxz:gorka2026saas@aws-1-eu-west-3.pooler.supabase.com:5432/gorka_test"
set "RESEND_API_KEY=re_XK7FAF5z_CeYxJ3UTvYfJHnPREyQZa7Fg"
set "GORKA_RESEND_API_KEY=re_XK7FAF5z_CeYxJ3UTvYfJHnPREyQZa7Fg"
set "GORKA_RESEND_FROM=onboarding@resend.dev"
set "TMP=C:\cargo-tmp"
set "TEMP=C:\cargo-tmp"

echo pilot-creds.bat loaded: DATABASE_URL, RESEND_API_KEY, GORKA_RESEND_API_KEY, GORKA_RESEND_FROM, TMP, TEMP