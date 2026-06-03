Add-Type -AssemblyName System.Drawing

function Save-Icon($size, $path) {
  $bmp = New-Object System.Drawing.Bitmap $size, $size
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $brush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 249, 115, 22))
  $g.FillRectangle($brush, 0, 0, $size, $size)
  $font = New-Object System.Drawing.Font("Segoe UI", ($size * 0.45), [System.Drawing.FontStyle]::Bold)
  $textBrush = [System.Drawing.Brushes]::White
  $format = New-Object System.Drawing.StringFormat
  $format.Alignment = [System.Drawing.StringAlignment]::Center
  $format.LineAlignment = [System.Drawing.StringAlignment]::Center
  $rect = New-Object System.Drawing.RectangleF(0, 0, $size, $size)
  $g.DrawString("M", $font, $textBrush, $rect, $format)
  $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose()
  $bmp.Dispose()
}

$public = Join-Path $PSScriptRoot "..\public"
Save-Icon 192 (Join-Path $public "pwa-192x192.png")
Save-Icon 512 (Join-Path $public "pwa-512x512.png")
Copy-Item (Join-Path $public "pwa-192x192.png") (Join-Path $public "apple-touch-icon.png")
Write-Host "Icons generated in public/"
