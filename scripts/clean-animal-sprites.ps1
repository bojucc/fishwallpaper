Add-Type -AssemblyName System.Drawing

$sourceFrog = 'C:\Users\Administrator\Desktop\AIPAI_1790709029054.png'
$sourceTurtle = 'C:\Users\Administrator\Desktop\AIPAI_1790709632973.png'
$assetDir = Join-Path $PSScriptRoot '..\assets'

Add-Type -AssemblyName System.Drawing
Add-Type -ReferencedAssemblies System.Drawing.dll -TypeDefinition @"
using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;

public static class AnimalSpriteCleaner {
  static bool Core(Color c) {
    if (c.A < 24 || Math.Max(c.R, Math.Max(c.G, c.B)) < 24) return false;
    // The reference images have a saturated yellow/red cutout fringe. The animals themselves
    // are olive/green, so use the green channel as the stable interior seed.
    if (c.R > 180 && c.G > 150 && c.B < 105) return false;
    return c.G >= c.R * .64 && c.G >= c.B * .82;
  }

  public static void Clean(string input, string output) {
    using (var src = new Bitmap(input)) {
      int minX = src.Width, minY = src.Height, maxX = -1, maxY = -1;
      for (int y = 0; y < src.Height; y++) for (int x = 0; x < src.Width; x++) {
        var c = src.GetPixel(x, y);
        if (c.A > 18 && Math.Max(c.R, Math.Max(c.G, c.B)) > 18) { minX = Math.Min(minX, x); minY = Math.Min(minY, y); maxX = Math.Max(maxX, x); maxY = Math.Max(maxY, y); }
      }
      if (maxX < minX || maxY < minY) throw new InvalidOperationException("Animal image has no foreground");
      int pad = Math.Max(24, (maxX - minX + maxY - minY) / 90);
      minX = Math.Max(0, minX - pad); minY = Math.Max(0, minY - pad); maxX = Math.Min(src.Width - 1, maxX + pad); maxY = Math.Min(src.Height - 1, maxY + pad);
      int sw = maxX - minX + 1, sh = maxY - minY + 1, side = 320;
      using (var scaled = new Bitmap(side, side, PixelFormat.Format32bppArgb)) {
        using (var g = Graphics.FromImage(scaled)) {
          g.Clear(Color.Transparent); g.SmoothingMode = SmoothingMode.HighQuality; g.InterpolationMode = InterpolationMode.HighQualityBicubic;
          float fit = Math.Min((side - 18f) / sw, (side - 18f) / sh), dw = sw * fit, dh = sh * fit;
          g.DrawImage(src, (side - dw) / 2, (side - dh) / 2, dw, dh);
        }
        bool[,] core = new bool[side, side];
        for (int y = 0; y < side; y++) for (int x = 0; x < side; x++) core[x, y] = Core(scaled.GetPixel(x, y));
        bool[,] keep = new bool[side, side];
        const int radius = 2;
        for (int y = 0; y < side; y++) for (int x = 0; x < side; x++) {
          bool found = false;
          for (int yy = Math.Max(0, y - radius); yy <= Math.Min(side - 1, y + radius) && !found; yy++)
            for (int xx = Math.Max(0, x - radius); xx <= Math.Min(side - 1, x + radius); xx++)
              if (core[xx, yy]) { found = true; break; }
          keep[x, y] = found;
        }
        for (int y = 0; y < side; y++) for (int x = 0; x < side; x++) {
          var c = scaled.GetPixel(x, y); int a = c.A;
          if (!keep[x, y]) a = 0;
          else if ((c.R > 180 && c.G > 150 && c.B < 140 || c.R > 190 && c.G > 190 && c.B > 190) && !core[x, y]) a = 0;
          scaled.SetPixel(x, y, Color.FromArgb(a, c.R, c.G, c.B));
        }
        scaled.Save(output, ImageFormat.Png);
      }
    }
  }
}
"@

[AnimalSpriteCleaner]::Clean($sourceFrog, (Join-Path $assetDir 'frog.png'))
[AnimalSpriteCleaner]::Clean($sourceTurtle, (Join-Path $assetDir 'turtle.png'))
Write-Output "已清理 frog.png 与 turtle.png"
