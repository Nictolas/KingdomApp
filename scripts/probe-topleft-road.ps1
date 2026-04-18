Add-Type -AssemblyName System.Drawing
$p = "C:\Users\Utente Microsoft\MyKingdom\assets\tilesets\DEMO-vector-rpg-overworld-tileset\spritesheet-full.png"
$bmp = New-Object System.Drawing.Bitmap([System.Drawing.Image]::FromFile((Resolve-Path $p)))
$t = 64
function MinAlpha($x0, $y0) {
  $m = 255
  for ($dy = 0; $dy -lt 64; $dy += 16) {
    for ($dx = 0; $dx -lt 64; $dx += 16) {
      $a = $bmp.GetPixel($x0 + $dx, $y0 + $dy).A
      if ($a -lt $m) { $m = $a }
    }
  }
  return $m
}
Write-Output "3x3 blocks with min alpha>=200 on all 9 tiles (no holes):"
foreach ($y0 in @(64, 128, 192, 256, 320)) {
  foreach ($x0 in @(0, 64, 128, 192, 256, 320)) {
    if ($x0 + 3*$t -gt $bmp.Width -or $y0 + 3*$t -gt $bmp.Height) { continue }
    $ok = $true
    for ($r = 0; $r -lt 3; $r++) {
      for ($c = 0; $c -lt 3; $c++) {
        if ((MinAlpha ($x0+$c*$t) ($y0+$r*$t)) -lt 200) { $ok = $false }
      }
    }
    if ($ok) { Write-Output "origin $x0,$y0" }
  }
}
$bmp.Dispose()
