$ErrorActionPreference = 'Stop'

$mjs = 'C:\Users\kucha\gorka-app\verify\index.mjs'
$vec = 'C:\Users\kucha\gorka-app\GORKA_RECOVERY\recovery-notes\SYNC-TEST-VECTORS-v1.md'

Copy-Item $mjs ($mjs + '.before-phase0c') -Force
Copy-Item $vec ($vec + '.before-phase0c') -Force

$L = @{}
foreach ($f in @($mjs, $vec)) {
  $L[$f] = New-Object System.Collections.ArrayList
  foreach ($line in [System.IO.File]::ReadAllLines($f)) { [void]$L[$f].Add($line) }
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

Write-Host 'Applying anchors. Any failure aborts before write.'

$oldHex = '5001000000130000000f656e746974792d746573742d3030315002000000080000000443414c4c50030000000c000000084f5554424f554e4450040000000d00000009546573742063616c6c500500000006000000023031'
$newHex = '5001000000130000000f656e746974792d746573742d3030315002000000080000000443414c4c50030000000c000000084f5554424f554e4450040000000d00000009546573742063616c6c50050000000600000002303150060000000f0000000b757365722d746573742d41'

# ---------- verify/index.mjs ----------
InsertAfter $mjs "  entity_id_001: 'entity-test-001'," "  user_id_A: 'user-test-A'," 'mjs-fixture'
Write-Host 'mjs: fixture added'

InsertAfter $mjs "  tlvString(0x5005, '01')," "  tlvString(0x5006, F.user_id_A)," 'mjs-buildv6'
Write-Host 'mjs: buildV6 extended'

$i = FindUnique $L[$mjs] $oldHex 'mjs-expected'
$L[$mjs][$i] = "  V6: '" + $newHex + "',"
Write-Host 'mjs: EXPECTED.V6 replaced'
Write-Host ('verify/index.mjs -> ' + $L[$mjs].Count + ' lines')

# ---------- SYNC-TEST-VECTORS-v1.md ----------
# V6 header found by unique ASCII substring; then walk forward to the status line.
$i = FindUnique $L[$vec] 'with non-canonical duration (byte encoding)' 'vec-v6-header'
$j = $i
while ($j -lt $L[$vec].Count -and -not $L[$vec][$j].Contains('Expected-bytes status: PENDING')) { $j++ }
if ($j -ge $L[$vec].Count) { throw 'ANCHOR FAIL [vec-v6-status]: could not find Expected-bytes status: PENDING after V6 header' }
$L[$vec][$j] = 'Expected-bytes status: FROZEN'
Write-Host 'vec: V6 status FROZEN'

InsertAfter $vec '&#x20;   duration:           "01"    (non-canonical)' '&#x20;   created_by:         "user-test-A"' 'vec-inputs'
Write-Host 'vec: inputs extended'

$i = FindUnique $L[$vec] 'Encode the payload as TLV per Section 25.11.3. Five fields in' 'vec-op-five'
$L[$vec][$i] = '&#x20; Encode the payload as TLV per Section 25.11.3. Six fields in'
Write-Host 'vec: operation six-fields'

InsertAfter $vec '&#x20; direction (0x5003), content (0x5004), duration (0x5005). Each' '&#x20; record. The created_by (0x5006) field is also encoded as a UTF-8' 'vec-op-list'
Write-Host 'vec: operation list extended'

$i = FindUnique $L[$vec] $oldHex 'vec-hex'
$L[$vec][$i] = '&#x20; ' + $newHex
Write-Host 'vec: expected hex replaced'

InsertAfter $vec '&#x20;   5005 00000006 00000002 3031        duration "01"' '&#x20;   5006 0000000f 0000000b 757365722d746573742d41 created\_by "user-test-A"' 'vec-structure'
Write-Host 'vec: structure extended'

$i = FindUnique $L[$vec] '&#x20; Total: 88 bytes.' 'vec-total'
$L[$vec][$i] = '&#x20; Total: 109 bytes.'
Write-Host 'vec: byte count updated'

$i = FindUnique $L[$vec] '&#x20; V6       SPECIFIED              PENDING          A2' 'vec-summary'
$L[$vec][$i] = '&#x20; V6       SPECIFIED              FROZEN           None'
Write-Host 'vec: summary row updated'

Write-Host ('SYNC-TEST-VECTORS-v1.md -> ' + $L[$vec].Count + ' lines')

# ---------- Write back ----------
$enc = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllLines($mjs, $L[$mjs], $enc)
[System.IO.File]::WriteAllLines($vec, $L[$vec], $enc)

Write-Host ''
Write-Host 'DONE. Both files written.'
Write-Host 'Backups: *.before-phase0c'