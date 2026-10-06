$ErrorActionPreference = 'Stop'
$vec = 'C:\Users\kucha\gorka-app\GORKA_RECOVERY\recovery-notes\SYNC-TEST-VECTORS-v1.md'
Copy-Item $vec ($vec + '.before-header-patch') -Force

$L = New-Object System.Collections.ArrayList
foreach ($line in [System.IO.File]::ReadAllLines($vec)) { [void]$L.Add($line) }

function FindUnique($arr, $needle, $label) {
  $found = @()
  for ($i = 0; $i -lt $arr.Count; $i++) { if ($arr[$i].Contains($needle)) { $found += $i } }
  if ($found.Count -ne 1) { throw "ANCHOR FAIL [$label]: '$needle' matched $($found.Count)" }
  return $found[0]
}

$i = FindUnique $L 'Recomputation of V6 and the corresponding' 'vec-hdr-line1'
$L[$i] = 'Rust and Node.js implementations was completed on'

$j = FindUnique $L 'Rust and Node.js implementations is a separate task. All' 'vec-hdr-line2'
$L[$j] = '2026-10-06. V6 is FROZEN again. All'

$enc = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllLines($vec, $L, $enc)
Write-Host 'Header note updated. New line count: ' + $L.Count