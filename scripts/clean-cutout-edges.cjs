const fs = require('node:fs');
const zlib = require('node:zlib');

function readPng(file) {
  const input = fs.readFileSync(file);
  let p = 8, idat = [], width = 0, height = 0, color = 0, depth = 0;
  while (p < input.length) {
    const n = input.readUInt32BE(p), type = input.toString('ascii', p + 4, p + 8), data = input.subarray(p + 8, p + 8 + n);
    if (type === 'IHDR') { width = data.readUInt32BE(0); height = data.readUInt32BE(4); depth = data[8]; color = data[9]; }
    if (type === 'IDAT') idat.push(data);
    p += n + 12;
  }
  if (depth !== 8 || color !== 6) throw new Error(`${file} must be 8-bit RGBA PNG`);
  const raw = zlib.inflateSync(Buffer.concat(idat)), stride = width * 4, pixels = Buffer.alloc(width * height * 4);
  let src = 0;
  for (let y = 0; y < height; y++) {
    const filter = raw[src++], row = y * stride;
    for (let x = 0; x < stride; x++) {
      const a = x >= 4 ? pixels[row + x - 4] : 0;
      const b = y ? pixels[row - stride + x] : 0;
      const c = y && x >= 4 ? pixels[row - stride + x - 4] : 0;
      let v = raw[src++];
      if (filter === 1) v = (v + a) & 255;
      else if (filter === 2) v = (v + b) & 255;
      else if (filter === 3) v = (v + Math.floor((a + b) / 2)) & 255;
      else if (filter === 4) { const q = a + b - c, pa = Math.abs(q - a), pb = Math.abs(q - b), pc = Math.abs(q - c); v = (v + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 255; }
      pixels[row + x] = v;
    }
  }
  return { width, height, pixels };
}

function writePng(file, width, height, pixels) {
  const raw = Buffer.alloc(height * (width * 4 + 1));
  for (let y = 0; y < height; y++) { raw[y * (width * 4 + 1)] = 0; pixels.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4); }
  const crc32 = data => { let c = 0xffffffff; for (const v of data) { c ^= v; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1)); } return (c ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => { const t = Buffer.from(type); const out = Buffer.alloc(12 + data.length); out.writeUInt32BE(data.length, 0); t.copy(out, 4); data.copy(out, 8); out.writeUInt32BE(crc32(Buffer.concat([t, data])), data.length + 8); return out; };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4); ihdr[8] = 8; ihdr[9] = 6;
  fs.writeFileSync(file, Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]));
}

function clean(file, mode) {
  const png = readPng(file), { width, height, pixels } = png, alpha = new Uint8Array(width * height), core = new Uint8Array(width * height);
  for (let i = 0; i < alpha.length; i++) {
    const o = i * 4, r = pixels[o], g = pixels[o + 1], b = pixels[o + 2], a = pixels[o + 3]; alpha[i] = a;
    const greenCore = mode === 'frog' && g > r * .76 && g > b * .84 && !(r > 150 && g > 130 && b < g * .78);
    const whiteCore = mode === 'egret' && r > 90 && g > 90 && b > 90;
    core[i] = a > 24 && (greenCore || whiteCore) ? 1 : 0;
  }
  const nearCore = (x, y) => { for (let yy = Math.max(0, y - 6); yy <= Math.min(height - 1, y + 6); yy++) for (let xx = Math.max(0, x - 6); xx <= Math.min(width - 1, x + 6); xx++) if (core[yy * width + xx]) return true; return false; };
  const edge = (x, y) => { for (let yy = Math.max(0, y - 6); yy <= Math.min(height - 1, y + 6); yy++) for (let xx = Math.max(0, x - 6); xx <= Math.min(width - 1, x + 6); xx++) if (!alpha[yy * width + xx]) return true; return false; };
  let changed = 0;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const i = y * width + x, o = i * 4, r = pixels[o], g = pixels[o + 1], b = pixels[o + 2];
    if (!alpha[i] || !nearCore(x, y)) { pixels[o + 3] = 0; continue; }
    // Only trim a halo when it is both close to the transparent boundary and
    // visibly neutral/warm. Interior pale feet and belly pixels stay intact.
    const boundary = edge(x, y);
    const warmHalo = boundary && r > 175 && g > 160 && b > 135 && (r - b > 18 || g - b > 12);
    const whiteHalo = boundary && r > 190 && g > 190 && b > 180 && Math.max(r, g, b) - Math.min(r, g, b) < 58;
    const darkHalo = boundary && r < 48 && g < 48 && b < 48;
    if (warmHalo || whiteHalo || darkHalo) { pixels[o + 3] = 0; changed++; }
  }
  if (changed === 0) throw new Error(`no frog edge pixels changed in ${file}`);
  writePng(file, width, height, pixels);
}

clean(process.argv[2], process.argv[3]);
