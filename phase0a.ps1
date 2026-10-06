$ErrorActionPreference = 'Stop'

$files = @{
  sync     = 'C:\Users\kucha\gorka-app\shared\src\sync.rs'
  parse    = 'C:\Users\kucha\gorka-app\shared\src\sync_parse.rs'
  pipeline = 'C:\Users\kucha\gorka-app\shared\src\sync_pipeline.rs'
  comms    = 'C:\Users\kucha\gorka-app\shared\src\communications.rs'
  auth     = 'C:\Users\kucha\gorka-app\shared\src\auth_http.rs'
  testSync = 'C:\Users\kucha\gorka-app\shared\tests\sync.rs'
  testRT   = 'C:\Users\kucha\gorka-app\shared\tests\sync_wire_roundtrip.rs'
}

foreach ($k in $files.Keys) { Copy-Item $files[$k] ($files[$k] + '.before-phase0a') -Force }

$L = @{}
foreach ($k in $files.Keys) {
  $L[$k] = New-Object System.Collections.ArrayList
  foreach ($line in [System.IO.File]::ReadAllLines($files[$k])) { [void]$L[$k].Add($line) }
}

function FindUnique($arr, $needle, $label) {
  $found = @()
  for ($i = 0; $i -lt $arr.Count; $i++) { if ($arr[$i].Contains($needle)) { $found += $i } }
  if ($found.Count -ne 1) {
    throw "ANCHOR FAIL [$label]: '$needle' matched $($found.Count) lines, expected 1"
  }
  return $found[0]
}

function InsertAfter($file, $anchor, $newLine, $label) {
  $i = FindUnique $L[$file] $anchor $label
  $L[$file].Insert($i + 1, $newLine)
}

function ReplaceLine($file, $anchor, $newLine, $label) {
  $i = FindUnique $L[$file] $anchor $label
  $L[$file][$i] = $newLine
}

Write-Host 'Applying anchors. Any failure aborts before write.'

# --- shared/src/sync.rs ---
InsertAfter 'sync' 'pub fn encode_communication_logged_payload(' '///   created_by          0x5006  required' 'sync-doc'
InsertAfter 'sync' '    duration: Option<&str>,' '    created_by: &str,' 'sync-arg'

$i = FindUnique $L['sync'] '    if let Some(d) = duration {' 'sync-iflet'
# i is the if-let; i+3 is `    out`
$L['sync'].Insert($i + 3, '    out.extend_from_slice(&encode_tlv(0x5006, &encode_string_value(created_by)));')
Write-Host ('sync.rs -> ' + $L['sync'].Count + ' lines')

# --- shared/src/sync_parse.rs ---
InsertAfter 'parse' 'pub fn parse_communication_logged_payload(' '///   created_by          0x5006  required' 'parse-doc'
InsertAfter 'parse' '    pub duration: Option<String>,' '    pub created_by: String,' 'parse-struct'
InsertAfter 'parse' '    let mut duration: Option<String> = None;' '    let mut created_by: Option<String> = None;' 'parse-local'
InsertAfter 'parse' '            0x5005 => duration = decode_optional_string_value(value)?,' '            0x5006 => created_by = Some(decode_string_value(value)?),' 'parse-match'
InsertAfter 'parse' '        content: content.ok_or("missing required field: content")?,' '        created_by: created_by.ok_or("missing required field: created_by")?,' 'parse-ok'
Write-Host ('sync_parse.rs -> ' + $L['parse'].Count + ' lines')

# --- shared/src/sync_pipeline.rs ---
# pipeline edit: anchor on the pair (prev line contains '&duration,')
$found = @()
for ($i = 1; $i -lt $L['pipeline'].Count; $i++) {
  if ($L['pipeline'][$i].Contains('Option::<String>::None,') -and $L['pipeline'][$i-1].Contains('&duration,')) { $found += $i }
}
if ($found.Count -ne 1) { throw ('ANCHOR FAIL [pipeline-null-pair]: matched ' + $found.Count) }
$L['pipeline'][$found[0]] = '                &p.created_by,'
Write-Host ('sync_pipeline.rs -> ' + $L['pipeline'].Count + ' lines')

# --- shared/src/communications.rs ---
$i = FindUnique $L['comms'] 'pub fn insert_communication(' 'comms-fn'
# args: 71 conn, 72 org, 73 input
$L['comms'].Insert($i + 4, '    created_by: &str,')
Write-Host 'comms: signature arg added'

$i = FindUnique $L['comms'] '            &input.duration,' 'comms-null-anchor'
$L['comms'][$i + 1] = '            Some(created_by.to_string()),'
Write-Host 'comms: NULL replaced'

InsertAfter 'comms' '        duration_str.as_deref(),' '        created_by,' 'comms-encoder-arg'

ReplaceLine 'comms' '        created_by: None,' '        created_by: Some(created_by.to_string()),' 'comms-return'
Write-Host ('communications.rs -> ' + $L['comms'].Count + ' lines')

# --- shared/src/auth_http.rs ---
InsertAfter 'auth' '    pub email: String,' '    pub user_id: String,' 'auth-struct'
InsertAfter 'auth' '        email: login_data.user.email,' '        user_id: login_data.user.id,' 'auth-ctor'
Write-Host ('auth_http.rs -> ' + $L['auth'].Count + ' lines')

# --- shared/tests/sync.rs ---
$oldHex = '5001000000130000000f656e746974792d746573742d3030315002000000080000000443414c4c50030000000c000000084f5554424f554e4450040000000d00000009546573742063616c6c500500000006000000023031'
$newHex = '5001000000130000000f656e746974792d746573742d3030315002000000080000000443414c4c50030000000c000000084f5554424f554e4450040000000d00000009546573742063616c6c50050000000600000002303150060000000f0000000b757365722d746573742d41'

$i = FindUnique $L['testSync'] $oldHex 'testSync-hex'
$L['testSync'][$i] = '    let expected = hex::decode("' + $newHex + '").expect("V6: recorded hex is not valid");'
Write-Host 'testSync: expected hex replaced'

ReplaceLine 'testSync' '// Structural check: five fields, types 0x5001 through 0x5005.' '    // Structural check: six fields, types 0x5001 through 0x5006.' 'testSync-comment'

ReplaceLine 'testSync' '"entity-test-001", "CALL", "OUTBOUND", "Test call", Some("01"),' '        "entity-test-001", "CALL", "OUTBOUND", "Test call", Some("01"), "user-test-A",' 'testSync-args'
Write-Host ('tests/sync.rs -> ' + $L['testSync'].Count + ' lines')

# --- shared/tests/sync_wire_roundtrip.rs ---
InsertAfter 'testRT' '        Some("120"),' '        "user-test-A",' 'testRT-arg'
InsertAfter 'testRT' '    assert_eq!(p.duration.as_deref(), Some("120"));' '    assert_eq!(p.created_by, "user-test-A");' 'testRT-assert'
Write-Host ('sync_wire_roundtrip.rs -> ' + $L['testRT'].Count + ' lines')

# --- Write back ---
$enc = New-Object System.Text.UTF8Encoding($false)
foreach ($k in $files.Keys) { [System.IO.File]::WriteAllLines($files[$k], $L[$k], $enc) }

Write-Host ''
Write-Host 'DONE. All 7 files written.'
Write-Host 'Backups: *.before-phase0a'