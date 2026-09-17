#!/usr/bin/env node
/**
 * Generates apps/web/public/og-image.png (1200x630) — the link-preview card —
 * with zero dependencies: rasterize simple shapes + a tiny 5x7 bitmap font,
 * then encode the RGBA buffer as a PNG (zlib deflate via node:zlib).
 * Brand: Memphis/UNLAWYERED — cream field, ink type, solid accents.
 * Run: node scripts/gen-og-image.cjs
 */
const fs = require("node:fs");
const path = require("node:path");
const zlib = require("node:zlib");

const W = 1200;
const H = 630;

/* ---------------- tiny drawing surface (RGBA) ---------------- */
const px = new Uint8Array(W * H * 4);

function setPx(x, y, [r, g, b, a]) {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 4;
  const sa = a / 255;
  px[i] = Math.round(px[i] * (1 - sa) + r * sa);
  px[i + 1] = Math.round(px[i + 1] * (1 - sa) + g * sa);
  px[i + 2] = Math.round(px[i + 2] * (1 - sa) + b * sa);
  px[i + 3] = Math.max(px[i + 3], a);
}

function fillRect(x0, y0, w, h, c) {
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) setPx(x, y, c);
}

function fillCircle(cx, cy, r, c) {
  const r2 = r * r;
  for (let y = Math.floor(cy - r); y <= cy + r; y++)
    for (let x = Math.floor(cx - r); x <= cx + r; x++) {
      const dx = x - cx,
        dy = y - cy;
      if (dx * dx + dy * dy <= r2) setPx(x, y, c);
    }
}

/** Filled triangle. */
function fillTriangle(p1, p2, p3, c) {
  const minX = Math.min(p1[0], p2[0], p3[0]),
    maxX = Math.max(p1[0], p2[0], p3[0]);
  const minY = Math.min(p1[1], p2[1], p3[1]),
    maxY = Math.max(p1[1], p2[1], p3[1]);
  const sign = (a, b, p) => (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
  for (let y = minY; y <= maxY; y++)
    for (let x = minX; x <= maxX; x++) {
      const d1 = sign(p1, p2, [x, y]),
        d2 = sign(p2, p3, [x, y]),
        d3 = sign(p3, p1, [x, y]);
      const neg = d1 < 0 || d2 < 0 || d3 < 0;
      const pos = d1 > 0 || d2 > 0 || d3 > 0;
      if (!(neg && pos)) setPx(x, y, c);
    }
}

/** Axis-aligned ring (border of a circle). */
function ring(cx, cy, r, w, c) {
  const outer = r * r,
    inner = (r - w) * (r - w);
  for (let y = Math.floor(cy - r); y <= cy + r; y++)
    for (let x = Math.floor(cx - r); x <= cx + r; x++) {
      const d2 = (x - cx) ** 2 + (y - cy) ** 2;
      if (d2 <= outer && d2 >= inner) setPx(x, y, c);
    }
}

/* ---------------- palette (solid only) ---------------- */
const CREAM = [245, 239, 226];
const INK = [23, 20, 13];
const MUSTARD = [255, 197, 49];
const TEAL = [18, 179, 164];
const CORAL = [255, 91, 87];
const VIOLET = [107, 91, 230];
const SKY = [58, 160, 255];

/* ---------------- background: solid cream + faint dot grid ---------------- */
fillRect(0, 0, W, H, [...CREAM, 255]);
for (let y = 24; y < H; y += 36)
  for (let x = 24; x < W; x += 36) fillCircle(x, y, 1.6, [...INK, 22]);

/* ---------------- Memphis confetti ---------------- */
// Coral triangle, top-left
fillTriangle([70, 60], [150, 200], [-10, 200], [...CORAL, 255]);
// Teal quarter arc, top-middle
ring(430, 40, 90, 20, [...TEAL, 255]);
// Sky-blue zigzag, right
for (let i = 0; i < 5; i++) {
  const x0 = 880 + i * 44;
  const y0 = i % 2 === 0 ? 96 : 150;
  fillRect(x0, y0, 10, 54, [...SKY, 255]);
}
// Violet plus, bottom-right
fillRect(1052, 470, 26, 92, [...VIOLET, 255]);
fillRect(1019, 503, 92, 26, [...VIOLET, 255]);
// Mustard half circle, bottom-center
fillCircle(700, 610, 64, [...MUSTARD, 255]);
fillRect(600, 610, 200, 40, [...CREAM, 255]);
ring(700, 610, 64, 6, [...INK, 255]);
// Teal dot
fillCircle(210, 470, 22, [...TEAL, 255]);
ring(210, 470, 22, 5, [...INK, 255]);
// Ink squiggle, top-right corner
for (let i = 0; i < 6; i++) {
  const x0 = 960 + i * 30;
  const y0 = i % 2 === 0 ? 30 : 48;
  fillRect(x0, y0, 8, 18, [...INK, 255]);
}

/* ---------------- brand badge: mustard disc + ink gavel ---------------- */
const BX = 205,
  BY = 315,
  BR = 118;
fillCircle(BX, BY, BR, [...MUSTARD, 255]);
ring(BX, BY, BR, 8, [...INK, 255]);
// Gavel head (rotated rect) — same geometry language as the app logo.
{
  const rot = Math.PI / 4;
  const cx = BX + 28,
    cy = BY - 34;
  const hw = 52,
    hh = 30;
  for (let y = -60; y <= 60; y++)
    for (let x = -60; x <= 60; x++) {
      const lx = x * Math.cos(-rot) - y * Math.sin(-rot);
      const ly = x * Math.sin(-rot) + y * Math.cos(-rot);
      if (Math.abs(lx) <= hw && Math.abs(ly) <= hh) setPx(cx + x, cy + y, [...INK, 255]);
    }
}
// Handle
{
  const rot = Math.PI / 4;
  const cx = BX - 36,
    cy = BY + 4;
  const hw = 62,
    hh = 13;
  for (let y = -70; y <= 70; y++)
    for (let x = -70; x <= 70; x++) {
      const lx = x * Math.cos(-rot) - y * Math.sin(-rot);
      const ly = x * Math.sin(-rot) + y * Math.cos(-rot);
      if (Math.abs(lx) <= hw && Math.abs(ly) <= hh) setPx(cx + x, cy + y, [...INK, 255]);
    }
}
// Strike dot
fillCircle(BX - 92, BY + 96, 12, [...INK, 255]);

/* ---------------- 5x7 bitmap font ---------------- */
const FONT = {
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  B: ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
  C: ["01111", "10000", "10000", "10000", "10000", "10000", "01111"],
  D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  F: ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
  G: ["01111", "10000", "10000", "10111", "10001", "10001", "01110"],
  H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
  I: ["11111", "00100", "00100", "00100", "00100", "00100", "11111"],
  J: ["00111", "00010", "00010", "00010", "00010", "10010", "01100"],
  K: ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  M: ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
  N: ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  Q: ["01110", "10001", "10001", "10001", "10101", "10010", "01101"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
  V: ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
  W: ["10001", "10001", "10001", "10101", "10101", "11011", "10001"],
  X: ["10001", "10001", "01010", "00100", "01010", "10001", "10001"],
  Y: ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
  Z: ["11111", "00001", "00010", "00100", "01000", "10000", "11111"],
  " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],
  "'": ["00110", "00110", "00100", "00000", "00000", "00000", "00000"],
  "-": ["00000", "00000", "00000", "01110", "00000", "00000", "00000"],
  ".": ["00000", "00000", "00000", "00000", "00000", "00110", "00110"],
  ",": ["00000", "00000", "00000", "00000", "00110", "00110", "00100"],
};

function drawText(text, ox, oy, scale, color, spacing = 1) {
  let cx = ox;
  for (const ch of text.toUpperCase()) {
    const glyph = FONT[ch];
    if (!glyph) {
      cx += 3 * scale + spacing * scale;
      continue;
    }
    for (let gy = 0; gy < 7; gy++)
      for (let gx = 0; gx < 5; gx++)
        if (glyph[gy][gx] === "1") fillRect(cx + gx * scale, oy + gy * scale, scale, scale, color);
    cx += 6 * scale + spacing * scale;
  }
  return cx;
}

/* ---------------- compose text ---------------- */
drawText("UNLAWYERED", 380, 240, 10, [...INK, 255], 3);
drawText("LEGAL AI FOR PEOPLE WHO DON'T SPEAK LEGAL", 384, 330, 4, [...INK, 255], 2);

const FEATURES = [
  "EXPLAIN ANY INDIAN LAW",
  "ASK A LEGAL QUESTION",
  "REVIEW + CROSS-CHECK DOCUMENTS",
  "STRESS-TEST A CONTRACT",
];
const DOTS = [MUSTARD, TEAL, CORAL, VIOLET];
let fy = 412;
FEATURES.forEach((f, i) => {
  fillCircle(390, fy + 8, 7, [...DOTS[i], 255]);
  drawText(f, 416, fy, 3, [...INK, 255], 1);
  fy += 36;
});
drawText("SOURCES NEXT TO EVERY CLAIM - INFORMATION, NOT ADVICE", 384, 574, 3, [...INK, 200], 1);

/* ---------------- PNG encode ---------------- */
function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0);
ihdr.writeUInt32BE(H, 4);
ihdr[8] = 8; // bit depth
ihdr[9] = 6; // color type RGBA
// raw scanlines with filter byte 0
const raw = Buffer.alloc(H * (1 + W * 4));
for (let y = 0; y < H; y++) {
  raw[y * (1 + W * 4)] = 0;
  Buffer.from(px.buffer, y * W * 4, W * 4).copy(raw, y * (1 + W * 4) + 1);
}
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk("IHDR", ihdr),
  chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
  chunk("IEND", Buffer.alloc(0)),
]);

const out = path.join(__dirname, "..", "apps", "web", "public", "og-image.png");
fs.writeFileSync(out, png);
console.log(`Wrote ${out} (${(png.length / 1024).toFixed(1)} KB, ${W}x${H})`);
