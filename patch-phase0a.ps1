$ErrorActionPreference = 'Stop'
$p = 'C:\Users\kucha\gorka-app\phase0a.ps1'
Copy-Item $p ($p + '.before-patch') -Force

$c = [System.IO.File]::ReadAllText($p)

$old = "ReplaceLine 'pipeline' 'Option::<String>::None,' '                &p.created_by,' 'pipeline-null'"

$new = @'
# pipeline edit: anchor on the pair (prev line contains '&duration,')
$found = @()
for ($i = 1; $i -lt $L['pipeline'].Count; $i++) {
  if ($L['pipeline'][$i].Contains('Option::<String>::None,') -and $L['pipeline'][$i-1].Contains('&duration,')) { $found += $i }
}
if ($found.Count -ne 1) { throw ('ANCHOR FAIL [pipeline-null-pair]: matched ' + $found.Count) }
$L['pipeline'][$found[0]] = '                &p.created_by,'
'@

if (-not $c.Contains($old)) {
    Write-Host 'WARN: old pipeline line not found. Nothing changed.'
    Write-Host 'The script may already have been patched.'
    exit 1
}

$c = $c.Replace($old, $new)
[System.IO.File]::WriteAllText($p, $c)
Write-Host 'phase0a.ps1 patched. pipeline anchor is now the pair-anchor.'