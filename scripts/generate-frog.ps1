Add-Type -AssemblyName System.Drawing

$out = Join-Path $PSScriptRoot '..\assets\frog.png'
$bitmap = [Drawing.Bitmap]::new(256, 192, [Drawing.Imaging.PixelFormat]::Format32bppArgb)
$graphics = [Drawing.Graphics]::FromImage($bitmap)
$graphics.SmoothingMode = [Drawing.Drawing2D.SmoothingMode]::AntiAlias
$graphics.CompositingMode = [Drawing.Drawing2D.CompositingMode]::SourceOver
$graphics.Clear([Drawing.Color]::Transparent)

function Color([int]$a, [int]$r, [int]$g, [int]$b) { [Drawing.Color]::FromArgb($a, $r, $g, $b) }
function Ellipse($brush, [float]$x, [float]$y, [float]$w, [float]$h) { $script:graphics.FillEllipse($brush, $x, $y, $w, $h) }

$shadow = [Drawing.SolidBrush]::new((Color 72 12 28 22))
Ellipse $shadow 38 126 180 36
$shadow.Dispose()

$legBrush = [Drawing.Drawing2D.LinearGradientBrush]::new([Drawing.RectangleF]::new(27, 76, 202, 72), (Color 255 37 70 45), (Color 255 111 145 80), 90)
Ellipse $legBrush 25 80 72 51
Ellipse $legBrush 159 80 72 51
$legBrush.Dispose()

$bodyBrush = [Drawing.Drawing2D.LinearGradientBrush]::new([Drawing.RectangleF]::new(58, 42, 140, 101), (Color 255 143 176 105), (Color 255 43 79 51), 90)
Ellipse $bodyBrush 58 42 140 102
$bodyBrush.Dispose()

$belly = [Drawing.Drawing2D.LinearGradientBrush]::new([Drawing.RectangleF]::new(74, 82, 108, 62), (Color 165 198 215 139), (Color 0 88 125 72), 90)
Ellipse $belly 74 80 108 64
$belly.Dispose()

$spot = [Drawing.SolidBrush]::new((Color 92 25 57 38))
foreach ($p in @(@(77,66,18,10), @(105,56,13,8), @(137,66,20,11), @(92,96,12,8), @(123,87,15,9), @(150,106,12,8), @(66,91,11,7), @(169,82,9,6), @(108,121,10,6), @(143,119,12,7))) { Ellipse $spot $p[0] $p[1] $p[2] $p[3] }
$spot.Dispose()

$highlight = [Drawing.SolidBrush]::new((Color 72 224 240 166))
Ellipse $highlight 80 56 18 7
Ellipse $highlight 119 49 13 6
Ellipse $highlight 145 86 12 5
$highlight.Dispose()

# Fine irregular skin grain keeps the sprite from reading as a flat cartoon fill.
$grain = [Drawing.SolidBrush]::new((Color 34 24 63 43))
$seed = 17
for ($i = 0; $i -lt 110; $i++) {
  $seed = ($seed * 73 + 41) % 997
  $x = 63 + ($seed % 132)
  $seed = ($seed * 73 + 41) % 997
  $y = 49 + ($seed % 86)
  Ellipse $grain $x $y (1 + ($seed % 4)) (1 + (($seed / 7) % 3))
}
$grain.Dispose()

$eye = [Drawing.SolidBrush]::new((Color 255 187 208 126))
$pupil = [Drawing.SolidBrush]::new((Color 255 25 37 25))
$glint = [Drawing.SolidBrush]::new((Color 240 248 244 232))
foreach ($x in @(87, 151)) {
  Ellipse $eye ($x - 10) 39 20 18
  Ellipse $pupil ($x - 4) 43 8 12
  Ellipse $glint ($x - 2) 44 3 3
}
$eye.Dispose(); $pupil.Dispose(); $glint.Dispose()

$nostril = [Drawing.SolidBrush]::new((Color 150 22 39 29))
Ellipse $nostril 106 70 4 2
Ellipse $nostril 146 70 4 2
$nostril.Dispose()

$mouth = [Drawing.Pen]::new((Color 155 24 50 31), 1.7)
$graphics.DrawArc($mouth, [Drawing.RectangleF]::new(93, 76, 69, 34), 14, 152)
$mouth.Dispose()

$toe = [Drawing.Pen]::new((Color 130 22 55 35), 2.1)
foreach ($x in @(38, 51, 181, 194)) {
  $graphics.DrawBezier($toe, $x, 106, $x - 8, 119, $x - 5, 130, $x - 13, 138)
  $graphics.DrawBezier($toe, $x + 8, 106, $x + 15, 119, $x + 13, 130, $x + 20, 136)
}
$toe.Dispose()

$outline = [Drawing.Pen]::new((Color 100 18 43 28), 1.8)
$graphics.DrawEllipse($outline, 58, 42, 140, 102)
$outline.Dispose()

$bitmap.Save($out, [Drawing.Imaging.ImageFormat]::Png)
$graphics.Dispose()
$bitmap.Dispose()
Write-Output $out
