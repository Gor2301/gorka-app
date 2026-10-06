function show($path, $start, $end, $label) {
  Write-Host "=== [$label] $path  ($start..$end) ==="
  $c = Get-Content $path
  for ($i = $start - 1; $i -lt $end; $i++) { '{0,5}: {1}' -f ($i+1), $c[$i] }
}

show 'C:\Users\kucha\gorka-app\GORKA_RECOVERY\recovery-notes\SYNC-TEST-VECTORS-v1.md' 1000 1075 'VECTORS-V6'
show 'C:\Users\kucha\gorka-app\shared\tests\sync.rs' 320 350 'TESTS-V6'
show 'C:\Users\kucha\gorka-app\verify\index.mjs' 125 175 'VERIFY-V6-A'
show 'C:\Users\kucha\gorka-app\verify\index.mjs' 285 340 'VERIFY-V6-B'
show 'C:\Users\kucha\gorka-app\shared\src\sync.rs' 315 375 'ENCODER-V6'