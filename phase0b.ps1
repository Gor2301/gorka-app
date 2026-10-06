$ErrorActionPreference = 'Stop'

$files = @{
  clientAuth  = 'C:\Users\kucha\gorka-app\src-tauri\src\auth.rs'
  agentAuth   = 'C:\Users\kucha\gorka-app\src-tauri-agent\src\auth.rs'
  clientMain  = 'C:\Users\kucha\gorka-app\src-tauri\src\main.rs'
  agentMain   = 'C:\Users\kucha\gorka-app\src-tauri-agent\src\main.rs'
}

foreach ($k in $files.Keys) { Copy-Item $files[$k] ($files[$k] + '.before-phase0b') -Force }

$L = @{}
foreach ($k in $files.Keys) {
  $L[$k] = New-Object System.Collections.ArrayList
  foreach ($line in [System.IO.File]::ReadAllLines($files[$k])) { [void]$L[$k].Add($line) }
}

function FindUnique($arr, $needle, $label) {
  $found = @()
  for ($i = 0; $i -lt $arr.Count; $i++) { if ($arr[$i].Contains($needle)) { $found += $i } }
  if ($found.Count -ne 1) { throw "ANCHOR FAIL [$label]: '$needle' matched $($found.Count)" }
  return $found[0]
}

function InsertAfter($file, $anchor, $newLine, $label) {
  $i = FindUnique $L[$file] $anchor $label
  $L[$file].Insert($i + 1, $newLine)
}

function InsertBefore($file, $anchor, $newLine, $label) {
  $i = FindUnique $L[$file] $anchor $label
  $L[$file].Insert($i, $newLine)
}

Write-Host 'Applying anchors. Any failure aborts before write.'

# --- src-tauri/src/auth.rs (client) ---
InsertAfter 'clientAuth' '    store.set("user_email", Value::String(result.email));' '    store.set("user_id", Value::String(result.user_id));' 'clientAuth-login-write'

$i = FindUnique $L['clientAuth'] 'pub fn get_user_name(app: tauri::AppHandle) -> Result<String, String> {' 'clientAuth-getname'
$newFn = @(
'pub fn get_user_id(app: tauri::AppHandle) -> Result<String, String> {',
'    let store = StoreBuilder::new(&app, "settings.dat")',
'        .build()',
'        .map_err(|e| e.to_string())?;',
'',
'    let user_id = store.get("user_id")',
'        .and_then(|v| v.as_str().map(|s| s.to_string()))',
'        .ok_or("No user ID found")?;',
'',
'    Ok(user_id)',
'}',
''
)
for ($j = $newFn.Count - 1; $j -ge 0; $j--) { $L['clientAuth'].Insert($i, $newFn[$j]) }
Write-Host ('clientAuth -> ' + $L['clientAuth'].Count + ' lines')

# --- src-tauri-agent/src/auth.rs (agent) ---
InsertAfter 'agentAuth' '    store.set("organization_id", Value::String(result.organization_id));' '    store.set("user_id", Value::String(result.user_id));' 'agentAuth-login-write'

$i = FindUnique $L['agentAuth'] 'pub fn get_salt(app: &tauri::AppHandle) -> Result<Vec<u8>, String> {' 'agentAuth-getsalt'
$newFn = @(
'pub fn get_user_id(app: tauri::AppHandle) -> Result<String, String> {',
'    let store = StoreBuilder::new(&app, "settings.dat")',
'        .build()',
'        .map_err(|e| e.to_string())?;',
'',
'    let user_id = store.get("user_id")',
'        .and_then(|v| v.as_str().map(|s| s.to_string()))',
'        .ok_or("No user ID found")?;',
'',
'    Ok(user_id)',
'}',
''
)
for ($j = $newFn.Count - 1; $j -ge 0; $j--) { $L['agentAuth'].Insert($i, $newFn[$j]) }
Write-Host ('agentAuth -> ' + $L['agentAuth'].Count + ' lines')

# --- src-tauri/src/main.rs (client insert_communication command) ---
$i = FindUnique $L['clientMain'] 'fn insert_communication(' 'clientMain-fn'
# 458 fn, 459 input, 460 app, 461 state, 462 ) ->..., 463 org_id, 464 db_guard, 465 conn, 466 call
# Actually search for the call line and insert before it
$callIdx = FindUnique $L['clientMain'] '    communications::insert_communication(conn, &organization_id, input)' 'clientMain-call'
$L['clientMain'][$callIdx] = '    let user_id = crate::auth::get_user_id(app.clone())?;'
$L['clientMain'].Insert($callIdx + 1, '    communications::insert_communication(conn, &organization_id, &user_id, input)')
Write-Host ('clientMain -> ' + $L['clientMain'].Count + ' lines')

# --- src-tauri-agent/src/main.rs (agent insert_communication command) ---
$callIdx = FindUnique $L['agentMain'] '    communications::insert_communication(conn, &organization_id, input)' 'agentMain-call'
$L['agentMain'][$callIdx] = '    let user_id = crate::auth::get_user_id(app.clone())?;'
$L['agentMain'].Insert($callIdx + 1, '    communications::insert_communication(conn, &organization_id, &user_id, input)')
Write-Host ('agentMain -> ' + $L['agentMain'].Count + ' lines')

# --- Write back ---
$enc = New-Object System.Text.UTF8Encoding($false)
foreach ($k in $files.Keys) { [System.IO.File]::WriteAllLines($files[$k], $L[$k], $enc) }

Write-Host ''
Write-Host 'DONE. All 4 files written.'
Write-Host 'Backups: *.before-phase0b'