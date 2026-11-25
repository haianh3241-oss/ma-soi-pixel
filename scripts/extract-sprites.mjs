import fs from 'node:fs';
import path from 'node:path';
import jpeg from 'jpeg-js';
import { PNG } from 'pngjs';

const BRAIN_DIR = 'C:\\Users\\eettoo\\.gemini\\antigravity\\brain\\79525f7a-a862-4be9-8c85-106556a1f071';
const OUT_DIR = path.resolve('public/assets/chars');
fs.mkdirSync(OUT_DIR, { recursive: true });

// Exact verified sheet filenames -> [TL, TR, BL, BR]
const SHEETS = [
  { file: 'sheet_1_1795598505596.jpg', ids: ['drunkard', 'madman', 'glutton', 'beggar'] },
  { file: 'sheet_2_1795598510651.jpg', ids: ['smoker', 'waterpipe', 'blacksmith', 'oldman'] },
  { file: 'sheet_3_1795598505642.jpg', ids: ['oldwoman', 'kid', 'youth', 'grocer'] },
  { file: 'sheet_4_1795598501976.jpg', ids: ['florist', 'butcher', 'farmer', 'baker'] },
  { file: 'sheet_5_1795598537675.jpg', ids: ['fisher', 'tailor', 'lumberjack', 'herbalist'] },
  { file: 'sheet_6_1795598514275.jpg', ids: ['watchman', 'shepherd', 'ghost_tombstone', 'campfire_lit'] },
];

function findLatestSheet(file) {
  return path.join(BRAIN_DIR, file);
}

function isBgPixel(r, g, b) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const chroma = max - min;
  return (min >= 205 && chroma <= 35) || (min >= 170 && chroma <= 16);
}

// Find the cleanest white horizontal gutter around the middle of the sheet
function findHorizontalSplit(decoded) {
  const { width, height, data } = decoded;
  const yStart = Math.floor(height * 0.44);
  const yEnd = Math.floor(height * 0.56);
  let bestY = Math.floor(height / 2);
  let minNonBg = Infinity;

  for (let y = yStart; y <= yEnd; y++) {
    let nonBg = 0;
    for (let x = 20; x < width - 20; x += 2) {
      const i = (y * width + x) * 4;
      if (!isBgPixel(data[i], data[i + 1], data[i + 2])) nonBg++;
    }
    if (nonBg < minNonBg) {
      minNonBg = nonBg;
      bestY = y;
    }
  }
  return bestY;
}

// Find the cleanest white vertical gutter between left & right characters in a specific row band
function findVerticalSplit(decoded, yMin, yMax) {
  const { width, data } = decoded;
  const xStart = Math.floor(width * 0.43);
  const xEnd = Math.floor(width * 0.57);
  let bestRunStart = -1;
  let bestRunLen = 0;
  let curStart = -1;
  let fallbackX = Math.floor(width / 2);
  let minNonBg = Infinity;

  for (let x = xStart; x <= xEnd; x++) {
    let nonBg = 0;
    for (let y = yMin + 10; y < yMax - 10; y += 2) {
      const i = (y * width + x) * 4;
      if (!isBgPixel(data[i], data[i + 1], data[i + 2])) nonBg++;
    }
    if (nonBg < minNonBg) {
      minNonBg = nonBg;
      fallbackX = x;
    }
    if (nonBg === 0) {
      if (curStart === -1) curStart = x;
      const runLen = x - curStart + 1;
      if (runLen > bestRunLen) {
        bestRunLen = runLen;
        bestRunStart = curStart;
      }
    } else {
      curStart = -1;
    }
  }

  if (bestRunLen > 0) {
    return Math.floor(bestRunStart + bestRunLen / 2);
  }
  return fallbackX;
}

function extractRegion(decoded, x0, y0, x1, y1) {
  const trim = 6;
  const startX = Math.max(0, x0 + trim);
  const startY = Math.max(0, y0 + trim);
  const endX = Math.min(decoded.width, x1 - trim);
  const endY = Math.min(decoded.height, y1 - trim);
  const w = endX - startX;
  const h = endY - startY;

  const rgba = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const si = ((startY + y) * decoded.width + (startX + x)) * 4;
      const di = (y * w + x) * 4;
      rgba[di] = decoded.data[si];
      rgba[di + 1] = decoded.data[si + 1];
      rgba[di + 2] = decoded.data[si + 2];
      rgba[di + 3] = 255;
    }
  }

  // 4-connected BFS flood fill from outer edges
  const bgMask = new Uint8Array(w * h);
  const queue = new Int32Array(w * h);
  let head = 0;
  let tail = 0;

  const trySeed = (x, y) => {
    const idx = y * w + x;
    if (bgMask[idx]) return;
    const p = idx * 4;
    if (isBgPixel(rgba[p], rgba[p + 1], rgba[p + 2])) {
      bgMask[idx] = 1;
      queue[tail++] = idx;
    }
  };

  for (let x = 0; x < w; x++) {
    trySeed(x, 0);
    trySeed(x, h - 1);
  }
  for (let y = 0; y < h; y++) {
    trySeed(0, y);
    trySeed(w - 1, y);
  }

  while (head < tail) {
    const cur = queue[head++];
    const cx = cur % w;
    const cy = (cur - cx) / w;
    if (cx > 0) trySeed(cx - 1, cy);
    if (cx + 1 < w) trySeed(cx + 1, cy);
    if (cy > 0) trySeed(cx, cy - 1);
    if (cy + 1 < h) trySeed(cx, cy + 1);
  }

  // Remove tiny disconnected speckles (< 100 px)
  const compId = new Int32Array(w * h);
  let nextComp = 1;
  const keepComp = [false];
  const cQueue = new Int32Array(w * h);

  for (let i = 0; i < w * h; i++) {
    if (bgMask[i] || compId[i] !== 0) continue;
    let cHead = 0;
    let cTail = 0;
    const id = nextComp++;
    compId[i] = id;
    cQueue[cTail++] = i;
    while (cHead < cTail) {
      const cur = cQueue[cHead++];
      const cx = cur % w;
      const cy = (cur - cx) / w;
      const neighbors = [
        cx > 0 ? cur - 1 : -1,
        cx + 1 < w ? cur + 1 : -1,
        cy > 0 ? cur - w : -1,
        cy + 1 < h ? cur + w : -1,
      ];
      for (const n of neighbors) {
        if (n >= 0 && !bgMask[n] && compId[n] === 0) {
          compId[n] = id;
          cQueue[cTail++] = n;
        }
      }
    }
    keepComp[id] = cTail >= 100;
  }

  // Apply alpha & 1px anti-aliased fringe defringing
  for (let i = 0; i < w * h; i++) {
    const p = i * 4;
    if (bgMask[i] || !keepComp[compId[i]]) {
      rgba[p + 3] = 0;
      continue;
    }
    const cx = i % w;
    const cy = (i - cx) / w;
    const touchesBg =
      (cx > 0 && bgMask[i - 1]) ||
      (cx + 1 < w && bgMask[i + 1]) ||
      (cy > 0 && bgMask[i - w]) ||
      (cy + 1 < h && bgMask[i + w]);
    if (touchesBg) {
      const r = rgba[p];
      const g = rgba[p + 1];
      const b = rgba[p + 2];
      const lum = (r + g + b) / 3;
      const chroma = Math.max(r, g, b) - Math.min(r, g, b);
      if (lum > 155 && chroma < 35) {
        const alpha = Math.max(0, Math.min(255, Math.round(((235 - lum) / 80) * 255)));
        rgba[p + 3] = alpha;
        rgba[p] = Math.round(r * 0.45);
        rgba[p + 1] = Math.round(g * 0.45);
        rgba[p + 2] = Math.round(b * 0.45);
      }
    }
  }

  // Tight bounding box
  let minX = w, minY = h, maxX = -1, maxY = -1;
  let fgPixels = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const a = rgba[(y * w + x) * 4 + 3];
      if (a > 10) {
        fgPixels++;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  const fgRatio = (fgPixels / (w * h)) * 100;
  const bw = Math.max(1, maxX - minX + 1);
  const bh = Math.max(1, maxY - minY + 1);

  const targetSize = 240;
  const maxInner = 224;
  const scale = Math.min(maxInner / bw, maxInner / bh);
  const dw = Math.max(1, Math.round(bw * scale));
  const dh = Math.max(1, Math.round(bh * scale));
  const offsetX = Math.floor((targetSize - dw) / 2);
  const offsetY = 232 - dh;

  const png = new PNG({ width: targetSize, height: targetSize });
  png.data.fill(0);

  for (let dy = 0; dy < dh; dy++) {
    const syFloat = minY + (dy + 0.5) / scale - 0.5;
    const sy0 = Math.max(minY, Math.min(maxY, Math.floor(syFloat)));
    const sy1 = Math.max(minY, Math.min(maxY, sy0 + 1));
    const fy = Math.max(0, Math.min(1, syFloat - sy0));

    for (let dx = 0; dx < dw; dx++) {
      const sxFloat = minX + (dx + 0.5) / scale - 0.5;
      const sx0 = Math.max(minX, Math.min(maxX, Math.floor(sxFloat)));
      const sx1 = Math.max(minX, Math.min(maxX, sx0 + 1));
      const fx = Math.max(0, Math.min(1, sxFloat - sx0));

      const i00 = (sy0 * w + sx0) * 4;
      const i10 = (sy0 * w + sx1) * 4;
      const i01 = (sy1 * w + sx0) * 4;
      const i11 = (sy1 * w + sx1) * 4;

      let aSum = 0, rSum = 0, gSum = 0, bSum = 0;
      const weights = [
        [(1 - fx) * (1 - fy), i00],
        [fx * (1 - fy), i10],
        [(1 - fx) * fy, i01],
        [fx * fy, i11],
      ];

      for (const [wt, idx] of weights) {
        const a = rgba[idx + 3] / 255;
        aSum += wt * a;
        rSum += wt * rgba[idx] * a;
        gSum += wt * rgba[idx + 1] * a;
        bSum += wt * rgba[idx + 2] * a;
      }

      const outIdx = ((offsetY + dy) * targetSize + (offsetX + dx)) * 4;
      if (aSum > 0.02) {
        png.data[outIdx] = Math.min(255, Math.round(rSum / aSum));
        png.data[outIdx + 1] = Math.min(255, Math.round(gSum / aSum));
        png.data[outIdx + 2] = Math.min(255, Math.round(bSum / aSum));
        png.data[outIdx + 3] = Math.min(255, Math.round(aSum * 255));
      }
    }
  }

  return { png, bw, bh, fgRatio };
}

for (const sheet of SHEETS) {
  const filePath = findLatestSheet(sheet.file);
  const raw = fs.readFileSync(filePath);
  const decoded = jpeg.decode(raw, { useTArray: true });
  const splitY = findHorizontalSplit(decoded);
  const splitXTop = findVerticalSplit(decoded, 0, splitY);
  const splitXBot = findVerticalSplit(decoded, splitY, decoded.height);

  const boxes = [
    [0, 0, splitXTop, splitY],
    [splitXTop, 0, decoded.width, splitY],
    [0, splitY, splitXBot, decoded.height],
    [splitXBot, splitY, decoded.width, decoded.height],
  ];

  for (let i = 0; i < 4; i++) {
    const id = sheet.ids[i];
    const [x0, y0, x1, y1] = boxes[i];
    const { png, bw, bh, fgRatio } = extractRegion(decoded, x0, y0, x1, y1);
    const outPath = path.join(OUT_DIR, `${id}.png`);
    fs.writeFileSync(outPath, PNG.sync.write(png));
    console.log(`${id.padEnd(16)} src=${bw}x${bh} fg=${fgRatio.toFixed(1)}%`);
  }
}
