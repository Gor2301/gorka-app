$files = @(
  'src-tauri\src\main.rs',
  'src-tauri-agent\src\main.rs',
  'agent-dashboard\src\services\local.db.ts',
  'agent-dashboard\src\pages\CommunicationToolsPage.tsx',
  'agent-dashboard\src\pages\CommunicationToolsPage.css',
  'agent-dashboard\src\pages\DebtorsPage.tsx',
  'shared\tests\sync_wire_roundtrip.rs',
  'shared\tests\sync_pipeline.rs',
  'shared\src\connectors\http.rs',
  'shared\src\connectors\mod.rs',
  'shared\src\connectors\local_record.rs',
  'shared\src\sync.rs',
  'shared\src\sync_parse.rs',
  'shared\src\sync_pipeline.rs',
  'shared\src\sync_events.rs',
  'shared\src\lib.rs',
  'shared\Cargo.toml'
)
$sb = New-Object System.Text.StringBuilder
[void]$sb.AppendLine('GIT STATE AT DUMP TIME:')
[void]$sb.AppendLine('HEAD: 0e0597f')
[void]$sb.AppendLine('origin/main: 8991746')
[void]$sb.AppendLine('Unpushed local commits: e195d46, 868a047, 947b00a, 0e0597f')
foreach ($f in $files) {
  [void]$sb.AppendLine('')
  [void]$sb.AppendLine('================================================================')
  [void]$sb.AppendLine("FILE: $f")
  [void]$sb.AppendLine('================================================================')
  if (Test-Path $f) {
    [void]$sb.AppendLine((Get-Content $f -Raw))
  } else {
    [void]$sb.AppendLine('(FILE NOT FOUND)')
  }
}
$sb.ToString() | Out-File -FilePath 'CHAT-HANDOFF-DUMP.txt' -Encoding UTF8
Write-Host ('Written: ' + (Get-Item 'CHAT-HANDOFF-DUMP.txt').FullName)
Write-Host ('Size: ' + [math]::Round((Get-Item 'CHAT-HANDOFF-DUMP.txt').Length / 1024, 1) + ' KB')