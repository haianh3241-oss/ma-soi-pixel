import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';

const KIT_ART_DIR = path.resolve('Ma-Cho-22-nhan-vat-Game-Kit/Ma-Cho-Character-Kit/art');
const OUT_MA_CHO_DIR = path.resolve('graphics-pack/assets/ma-cho');
const RIG_CONFIG_OUT = path.resolve('src/data/villagerRigConfig.js');

const PART_NAMES = [
  'head-neutral',
  'head-emote',
  'torso',
  'arm-a',
  'arm-b',
  'leg-a',
  'leg-b',
  'prop',
  'crook',
  'sheep',
];

function resizePngMaxDim(srcPath, destPath, maxDim = 156, flipX = false) {
  const src = PNG.sync.read(fs.readFileSync(srcPath));
  const { width: w, height: h, data } = src;
  const scale = Math.min(1, maxDim / Math.max(w, h));
  const outW = Math.max(1, Math.round(w * scale));
  const outH = Math.max(1, Math.round(h * scale));
  const out = new PNG({ width: outW, height: outH });

  for (let y = 0; y < outH; y++) {
    for (let x = 0; x < outW; x++) {
      const dstX = flipX ? outW - 1 - x : x;
      const sx = ((x + 0.5) / outW) * w - 0.5;
      const sy = ((y + 0.5) / outH) * h - 0.5;
      const x0 = Math.max(0, Math.min(w - 1, Math.floor(sx)));
      const y0 = Math.max(0, Math.min(h - 1, Math.floor(sy)));
      const x1 = Math.max(0, Math.min(w - 1, x0 + 1));
      const y1 = Math.max(0, Math.min(h - 1, y0 + 1));
      const fx = Math.max(0, Math.min(1, sx - x0));
      const fy = Math.max(0, Math.min(1, sy - y0));

      const di = (y * outW + dstX) * 4;
      for (let c = 0; c < 4; c++) {
        const v00 = data[(y0 * w + x0) * 4 + c];
        const v10 = data[(y0 * w + x1) * 4 + c];
        const v01 = data[(y1 * w + x0) * 4 + c];
        const v11 = data[(y1 * w + x1) * 4 + c];
        const top = v00 + (v10 - v00) * fx;
        const bot = v01 + (v11 - v01) * fx;
        out.data[di + c] = Math.round(top + (bot - top) * fy);
      }
    }
  }

  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  fs.writeFileSync(destPath, PNG.sync.write(out));
  return { width: outW, height: outH, aspect: Number((outW / outH).toFixed(3)) };
}

const slugs = fs.readdirSync(KIT_ART_DIR).filter((d) => fs.statSync(path.join(KIT_ART_DIR, d)).isDirectory()).sort();
const rigMeta = {};
let totalFiles = 0;
let totalBytes = 0;

for (const slug of slugs) {
  const srcDir = path.join(KIT_ART_DIR, slug);
  const partsDir = path.join(OUT_MA_CHO_DIR, slug, 'parts');
  rigMeta[slug] = {};

  for (const part of PART_NAMES) {
    const srcFile = path.join(srcDir, `${part}.png`);
    if (!fs.existsSync(srcFile)) continue;
    const maxDim = part.startsWith('head') || part === 'torso' ? 168 : 136;
    const destFile = path.join(partsDir, `${part}.png`);
    // Flip leg-a horizontally at export time so both shoes point forward-right when facing right!
    const info = resizePngMaxDim(srcFile, destFile, maxDim, part === 'leg-a');
    rigMeta[slug][part] = info;
    totalFiles++;
    totalBytes += fs.statSync(destFile).size;
  }
}

const configSource = `// Tự động sinh bởi scripts/build-puppet-parts.mjs — Tỉ lệ & cấu hình 7-Layer Puppet Rig cho 22 dân làng
export const VILLAGER_PARTS_META = ${JSON.stringify(rigMeta, null, 2)};

// Cách bố trí đạo cụ (prop.png) theo đặc trưng từng nhân vật:
// - 'hand_front': gắn theo chuyển động tay cầm đạo cụ
// - 'hip_basket': giỏ hoa / giỏ thuốc đeo ngang hông
// - 'sheep_pet': Bé Chăn Cừu vừa cầm gậy vừa có chú cừu nhảy theo sau
// - 'skip': đạo cụ đã gắn sẵn trên đầu / cổ trong head-neutral.png & torso.png
export const VILLAGER_PROP_MODE = {
  'ga-bom-ruou': 'hand_front',
  'thang-dien': 'skip',
  'anh-chang-tham-an': 'hand_front',
  'ga-an-xin': 'hand_front',
  'ga-nghien-thuoc-la': 'hand_front',
  'anh-hut-thuoc-lao': 'hand_front',
  'anh-tho-ren': 'shoulder_heavy',
  'ong-gia': 'hand_cane',
  'ba-cu': 'skip',
  'tre-con': 'skip',
  'anh-thanh-nien': 'skip',
  'anh-tap-hoa': 'hand_front',
  'co-ban-hoa': 'hip_basket',
  'anh-ban-thit': 'hand_front',
  'bac-nong-dan': 'skip',
  'chi-tho-banh': 'hand_front',
  'anh-danh-ca': 'hand_cane',
  'co-tho-may': 'hand_front',
  'chu-tieu-phu': 'shoulder_heavy',
  'co-thao-duoc': 'hip_basket',
  'anh-gac-dem': 'hand_lantern',
  'be-chan-cuu': 'sheep_pet',
};
`;

fs.writeFileSync(RIG_CONFIG_OUT, configSource, 'utf8');
console.log(`Generated ${totalFiles} optimized part PNGs (${Math.round(totalBytes / 1024)} KB total) across ${slugs.length} villagers!`);
