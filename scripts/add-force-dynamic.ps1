param([string]$Path = "apps/web/src/app/api")
$files = Get-ChildItem -Path $Path -Recurse -Filter "route.ts" 2>&1 | Where-Object { $_.FullName -notlike "*node_modules*" }
foreach ($f in $files) {
  $content = Get-Content $f.FullName -Raw
  if ($content -notmatch "export const dynamic") {
    $lines = $content -split "`n"
    $importEnd = -1
    for ($i = 0; $i -lt $lines.Count; $i++) {
      if ($lines[$i] -match "^import ") {
        $importEnd = $i
      } elseif ($lines[$i] -match "^(export |const |let |var |//|/\*|\s*$)") {
        if ($importEnd -ge 0 -and $i -gt $importEnd -and $lines[$i] -notmatch "^\s*$") {
          break
        }
      }
    }
    $newContent = ($lines[0..($importEnd + 1)] -join "`n") + "`nexport const dynamic = 'force-dynamic';`n`n" + ($lines[($importEnd + 2)..($lines.Count - 1)] -join "`n")
    Set-Content -Path $f.FullName -Value $newContent -NoNewline
    Write-Host "Updated: $($f.FullName)"
  }
}
Write-Host "Done!"
