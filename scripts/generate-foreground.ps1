Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.Drawing
Add-Type -ReferencedAssemblies System.Drawing.dll -TypeDefinition @"
using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;
public static class PondForeground {
  public static void Build(string input, string output) {
    using (var src = new Bitmap(input)) using (var dst = new Bitmap(src.Width, src.Height, PixelFormat.Format32bppArgb)) {
    var rect = new Rectangle(0, 0, src.Width, src.Height);
    var s = src.LockBits(rect, ImageLockMode.ReadOnly, PixelFormat.Format32bppArgb);
    var d = dst.LockBits(rect, ImageLockMode.WriteOnly, PixelFormat.Format32bppArgb);
    int stride = Math.Abs(s.Stride);
    byte[] pixels = new byte[stride * src.Height];
    byte[] outPixels = new byte[stride * src.Height];
    Marshal.Copy(s.Scan0, pixels, 0, pixels.Length); src.UnlockBits(s);
    for (int y = 0; y < src.Height; y++) for (int x = 0; x < src.Width; x++) {
      int i = y * stride + x * 4; byte b = pixels[i], g = pixels[i + 1], r = pixels[i + 2];
      int edge = Math.Min(Math.Min(x, y), Math.Min(src.Width - 1 - x, src.Height - 1 - y));
      // Keep only edge vegetation. A generic edge band would also copy water and stones
      // into the foreground, making fish disappear over otherwise open water.
      double edgeFade = edge < 360 ? (360 - edge) / 260.0 : 0;
      if (edgeFade > 1) edgeFade = 1;
      bool flower = (r > 145 && r > g * 1.14 && r > b * 1.06) ||
        (r > 180 && g > 160 && b > 135 && Math.Max(r, Math.Max(g, b)) - Math.Min(r, Math.Min(g, b)) < 45);
      bool leaf = g > r * 1.07 && g > b * 1.04 && g > 45 && !(r > 150 && g > 140 && b > 110);
      double alpha = 0;
      if (flower) alpha = 0;
      else if (leaf && edgeFade > 0) alpha = Math.Max(alpha, .82 * edgeFade);
      int a = (int)(alpha * 255); if (a < 0) a = 0; if (a > 255) a = 255;
      outPixels[i] = b; outPixels[i + 1] = g; outPixels[i + 2] = r; outPixels[i + 3] = (byte)a;
    }
    Marshal.Copy(outPixels, 0, d.Scan0, outPixels.Length); dst.UnlockBits(d); dst.Save(output, ImageFormat.Png); }
  }
}
"@
foreach ($name in 'pondchun','pondxia','pondqiu','ponddong') {
  [PondForeground]::Build("assets/$name.png", "assets/$name-foreground.png")
}


