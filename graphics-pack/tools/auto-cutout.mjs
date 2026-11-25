import fs from 'node:fs';
import path from 'node:path';
import jpeg from 'jpeg-js';
import { PNG } from 'pngjs';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PACK_DIR = path.resolve(__dirname, '..');
const RAW_DIR = path.join(PACK_DIR, 'raw-chatgpt');
const ASSETS_DIR = path.join(PACK_DIR, 'assets');

const OUT_DIRS = {
  characters: path.join(ASSETS_DIR, 'characters'),
  roles: path.join(ASSETS_DIR, 'roles'),
  props: path.join(ASSETS_DIR, 'props'),
  throwables: path.join(ASSETS_DIR, 'throwables'),
};
Object.values(OUT_DIRS).forEach((d) => fs.mkdirSync(d, { recursive: true }));

const TARGET_SIZE = 512;
const MAX_INNER = 480;
const BOTTOM_Y = 496;

function decodeImage(filePath) {
  const buf = fs.readFileSync(filePath);
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.png') {
    const png = PNG.sync.read(buf);
    return { width: png.width, height: png.height, data: new Uint8Array(png.data), isPng: true };
  }
  const jpg = jpeg.decode(buf, { useTArray: true });
  return { width: jpg.width, height: jpg.height, data: new Uint8Array(jpg.data), isPng: false };
}

function isBgPixel(r, g, b) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const chroma = max - min;
  return (min >= 205 && chroma <= 35) || (min >= 170 && chroma <= 16);
}

function hasTransparentCorners(rgba, w, h) {
  const corners = [
    0,
    (w - 1) * 4,
    ((h - 1) * w) * 4,
    ((h - 1) * w + (w - 1)) * 4,
  ];
  let transparentCount = 0;
  for (const idx of corners) {
    if (rgba[idx + 3] < 200) transparentCount++;
  }
  return transparentCount >= 3;
}

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
      if (data[i + 3] > 20 && !isBgPixel(data[i], data[i + 1], data[i + 2])) nonBg++;
    }
    if (nonBg < minNonBg) {
      minNonBg = nonBg;
      bestY = y;
    }
  }
  return bestY;
}

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
      if (data[i + 3] > 20 && !isBgPixel(data[i], data[i + 1], data[i + 2])) nonBg++;
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

  return bestRunLen > 0 ? Math.floor(bestRunStart + bestRunLen / 2) : fallbackX;
}

function processRegionTo512(decoded, x0, y0, x1, y1, trim = 6) {
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
      rgba[di + 3] = decoded.isPng ? decoded.data[si + 3] : 255;
    }
  }

  const alreadyTransparent = decoded.isPng && hasTransparentCorners(rgba, w, h);

  if (!alreadyTransparent) {
    // 4-connected exterior BFS flood fill from all 4 outer edges
    const bgMask = new Uint8Array(w * h);
    const queue = new Int32Array(w * h);
    let head = 0;
    let tail = 0;

    const trySeed = (x, y) => {
      const idx = y * w + x;
      if (bgMask[idx]) return;
      const p = idx * 4;
      if (rgba[p + 3] < 20 || isBgPixel(rgba[p], rgba[p + 1], rgba[p + 2])) {
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

    // Remove tiny isolated dust speckles (< 100 px)
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

  if (maxX < minX || maxY < minY) {
    return { empty: true };
  }

  const fgRatio = (fgPixels / (w * h)) * 100;
  const bw = maxX - minX + 1;
  const bh = maxY - minY + 1;

  const scale = Math.min(MAX_INNER / bw, MAX_INNER / bh);
  const dw = Math.max(1, Math.round(bw * scale));
  const dh = Math.max(1, Math.round(bh * scale));
  const offsetX = Math.floor((TARGET_SIZE - dw) / 2);
  const offsetY = BOTTOM_Y - dh;

  const png = new PNG({ width: TARGET_SIZE, height: TARGET_SIZE });
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

      const outIdx = ((offsetY + dy) * TARGET_SIZE + (offsetX + dx)) * 4;
      if (aSum > 0.02) {
        png.data[outIdx] = Math.min(255, Math.round(rSum / aSum));
        png.data[outIdx + 1] = Math.min(255, Math.round(gSum / aSum));
        png.data[outIdx + 2] = Math.min(255, Math.round(bSum / aSum));
        png.data[outIdx + 3] = Math.min(255, Math.round(aSum * 255));
      }
    }
  }

  return { png, bw, bh, fgRatio, alreadyTransparent };
}

function resolveSingleTarget(baseName) {
  if (baseName.startsWith('role_')) {
    return path.join(OUT_DIRS.roles, `${baseName.slice(5)}.png`);
  }
  if (baseName.startsWith('prop_')) {
    return path.join(OUT_DIRS.props, `${baseName.slice(5)}.png`);
  }
  if (baseName.startsWith('throw_')) {
    return path.join(OUT_DIRS.throwables, `${baseName.slice(6)}.png`);
  }
  return path.join(OUT_DIRS.characters, `${baseName}.png`);
}

function run() {
  if (!fs.existsSync(RAW_DIR)) fs.mkdirSync(RAW_DIR, { recursive: true });
  const files = fs
    .readdirSync(RAW_DIR)
    .filter((f) => /\.(png|jpe?g)$/i.test(f))
    .sort();

  if (files.length === 0) {
    console.log('ℹ️ Thu muc graphics-pack/raw-chatgpt/ dang trong.');
    console.log('👉 Hay bo anh tai tu ChatGPT vao thu muc nay roi chay lai script!');
    return;
  }

  console.log(`🎨 Dang xu ly ${files.length} file trong raw-chatgpt/...`);

  for (const file of files) {
    const fullPath = path.join(RAW_DIR, file);
    const baseName = path.basename(file, path.extname(file));
    const decoded = decodeImage(fullPath);

    if (baseName.startsWith('sheet_')) {
      const ids = baseName.slice(6).split('_').filter(Boolean);
      if (ids.length !== 4) {
        console.warn(`⚠️ Bo qua ${file}: Ten sheet phai co dang sheet_<id1>_<id2>_<id3>_<id4>.jpg`);
        continue;
      }
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
        const res = processRegionTo512(decoded, boxes[i][0], boxes[i][1], boxes[i][2], boxes[i][3], 6);
        if (res.empty) {
          console.warn(`⚠️ Khong tim thay nhan vat o o #${i + 1} (${ids[i]}) trong ${file}`);
          continue;
        }
        const outPath = resolveSingleTarget(ids[i]);
        fs.writeFileSync(outPath, PNG.sync.write(res.png));
        console.log(`✅ [2x2] ${ids[i]} -> ${path.relative(PACK_DIR, outPath)} (${res.bw}x${res.bh}, fg=${res.fgRatio.toFixed(1)}%)`);
      }
    } else {
      const res = processRegionTo512(decoded, 0, 0, decoded.width, decoded.height, 0);
      if (res.empty) {
        console.warn(`⚠️ Bo qua ${file}: Khong thay vat the nao.`);
        continue;
      }
      const outPath = resolveSingleTarget(baseName);
      fs.writeFileSync(outPath, PNG.sync.write(res.png));
      const mode = res.alreadyTransparent ? 'giu alpha goc' : 'tu tach nen trang';
      console.log(`✅ [Don] ${file} -> ${path.relative(PACK_DIR, outPath)} (${mode}, fg=${res.fgRatio.toFixed(1)}%)`);
    }
  }
  console.log('\n🎉 Hoan tat! Hay chay 2-xem-thu-do-hoa.bat hoac mo ?preview=art de kiem tra.');
}

run();
