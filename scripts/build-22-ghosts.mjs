import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';
import { VILLAGER_PROP_MODE } from '../src/data/villagerRigConfig.js';

const KIT_ART_DIR = path.resolve('Ma-Cho-22-nhan-vat-Game-Kit/Ma-Cho-Character-Kit/art');
const OUT_MA_CHO_DIR = path.resolve('graphics-pack/assets/ma-cho');
const TAIL_AURA_PATH = path.resolve('graphics-pack/assets/death/ghost_tail_aura.png');
const SLEEPING_MAT_OUT = path.resolve('graphics-pack/assets/props/sleeping_mat.png');

const CANVAS_SIZE = 288;

function loadPng(filePath) {
  return PNG.sync.read(fs.readFileSync(filePath));
}

function savePng(png, destPath) {
  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  fs.writeFileSync(destPath, PNG.sync.write(png));
}

/**
 * Alpha-blend one RGBA pixel over a target buffer.
 */
function blendPixel(dst, x, y, r, g, b, a) {
  if (x < 0 || y < 0 || x >= dst.width || y >= dst.height || a <= 0) return;
  const i = (y * dst.width + x) * 4;
  const sa = a / 255;
  const da = dst.data[i + 3] / 255;
  const outA = sa + da * (1 - sa);
  if (outA <= 1e-5) return;
  dst.data[i] = Math.round((r * sa + dst.data[i] * da * (1 - sa)) / outA);
  dst.data[i + 1] = Math.round((g * sa + dst.data[i + 1] * da * (1 - sa)) / outA);
  dst.data[i + 2] = Math.round((b * sa + dst.data[i + 2] * da * (1 - sa)) / outA);
  dst.data[i + 3] = Math.round(outA * 255);
}

/**
 * Draw a sprite with bilinear sampling, scaling, rotation, and optional bottom fade.
 */
function drawSprite(dst, src, { cx, cy, targetW, targetH, angleDeg = 0, alphaMult = 1, fadeBottomPx = 0, spectralTint = 0 }) {
  const rad = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const halfDiag = Math.ceil(Math.hypot(targetW, targetH) * 0.55) + 2;
  const xMin = Math.max(0, Math.floor(cx - halfDiag));
  const xMax = Math.min(dst.width - 1, Math.ceil(cx + halfDiag));
  const yMin = Math.max(0, Math.floor(cy - halfDiag));
  const yMax = Math.min(dst.height - 1, Math.ceil(cy + halfDiag));

  for (let py = yMin; py <= yMax; py++) {
    for (let px = xMin; px <= xMax; px++) {
      const dx = px - cx;
      const dy = py - cy;
      // Rotate back into local sprite space
      const lx = dx * cos + dy * sin + targetW * 0.5;
      const ly = -dx * sin + dy * cos + targetH * 0.5;
      if (lx < 0 || ly < 0 || lx >= targetW || ly >= targetH) continue;

      const sx = (lx / targetW) * src.width - 0.5;
      const sy = (ly / targetH) * src.height - 0.5;
      const x0 = Math.max(0, Math.min(src.width - 1, Math.floor(sx)));
      const y0 = Math.max(0, Math.min(src.height - 1, Math.floor(sy)));
      const x1 = Math.max(0, Math.min(src.width - 1, x0 + 1));
      const y1 = Math.max(0, Math.min(src.height - 1, y0 + 1));
      const fx = Math.max(0, Math.min(1, sx - x0));
      const fy = Math.max(0, Math.min(1, sy - y0));

      const sample = (c) => {
        const v00 = src.data[(y0 * src.width + x0) * 4 + c];
        const v10 = src.data[(y0 * src.width + x1) * 4 + c];
        const v01 = src.data[(y1 * src.width + x0) * 4 + c];
        const v11 = src.data[(y1 * src.width + x1) * 4 + c];
        return (v00 + (v10 - v00) * fx) * (1 - fy) + (v01 + (v11 - v01) * fx) * fy;
      };

      let a = sample(3) * alphaMult;
      if (a < 2) continue;

      if (fadeBottomPx > 0 && ly > targetH - fadeBottomPx) {
        const t = Math.max(0, (targetH - ly) / fadeBottomPx);
        a *= t * t;
      }

      let r = sample(0);
      let g = sample(1);
      let b = sample(2);

      // Preserve bold dark folk ink lines while shifting lit fills toward ghostly jade-cyan
      if (spectralTint > 0) {
        const lum = r * 0.299 + g * 0.587 + b * 0.114;
        if (lum > 48) {
          const blend = spectralTint * Math.min(1, (lum - 48) / 140);
          r = r * (1 - blend) + 150 * blend;
          g = g * (1 - blend) + 242 * blend;
          b = b * (1 - blend) + 255 * blend;
        }
      }

      blendPixel(dst, px, py, r, g, b, Math.round(a));
    }
  }
}

function buildCharacterGhost(slug, tailAura) {
  const srcDir = path.join(KIT_ART_DIR, slug);
  const loadOpt = (name) => {
    const p = path.join(srcDir, `${name}.png`);
    return fs.existsSync(p) ? loadPng(p) : null;
  };

  const torso = loadOpt('torso');
  const head = loadOpt('head-emote') || loadOpt('head-neutral');
  const armA = loadOpt('arm-a');
  const armB = loadOpt('arm-b');
  const prop = loadOpt('prop');
  const sheep = loadOpt('sheep');
  const crook = loadOpt('crook');
  const propMode = VILLAGER_PROP_MODE[slug] || 'hand_front';

  const canvas = new PNG({ width: CANVAS_SIZE, height: CANVAS_SIZE });

  // 1. Ectoplasm tail & spirit wisps anchored under the waist (no legs!)
  drawSprite(canvas, tailAura, {
    cx: 144,
    cy: 196,
    targetW: 178,
    targetH: 178,
    angleDeg: -2,
    alphaMult: 0.94,
  });

  const fitH = (img, h) => ({
    w: Math.max(10, Math.round((img.width / img.height) * h)),
    h,
  });

  // 2. Spectral Sheep floating alongside Bé Chăn Cừu
  if (propMode === 'sheep_pet' && sheep) {
    const sh = fitH(sheep, 60);
    drawSprite(canvas, sheep, {
      cx: 46,
      cy: 174,
      targetW: sh.w,
      targetH: sh.h,
      angleDeg: -8,
      alphaMult: 0.94,
      spectralTint: 0.34,
    });
  }

  // 3. Back floating arm (arm-b)
  if (armB) {
    const dim = fitH(armB, 72);
    drawSprite(canvas, armB, {
      cx: 184,
      cy: 138,
      targetW: dim.w,
      targetH: dim.h,
      angleDeg: -24,
      spectralTint: 0.28,
    });
  }

  // 4. Torso gently fading into the ectoplasm collar
  if (torso) {
    const dim = fitH(torso, 76);
    drawSprite(canvas, torso, {
      cx: 144,
      cy: 138,
      targetW: dim.w,
      targetH: dim.h,
      angleDeg: -3,
      fadeBottomPx: 14,
      spectralTint: 0.28,
    });
  }

  // 5. Recognizable Character Head (head-emote with hat/hair/face intact)
  if (head) {
    const dim = fitH(head, 122);
    drawSprite(canvas, head, {
      cx: 144,
      cy: 76,
      targetW: dim.w,
      targetH: dim.h,
      angleDeg: -4,
      spectralTint: 0.24,
    });
  }

  // 6. Signature Prop behind/around front arm (hip basket / heavy shoulder / handheld / crook)
  if (propMode === 'hip_basket' && prop) {
    const dim = fitH(prop, 74);
    drawSprite(canvas, prop, {
      cx: 176,
      cy: 142,
      targetW: dim.w,
      targetH: dim.h,
      angleDeg: 6,
      spectralTint: 0.26,
    });
  }

  if (armA) {
    const dim = fitH(armA, 72);
    drawSprite(canvas, armA, {
      cx: 102,
      cy: 138,
      targetW: dim.w,
      targetH: dim.h,
      angleDeg: 22,
      spectralTint: 0.28,
    });
  }

  if (prop && propMode !== 'skip' && propMode !== 'sheep_pet' && propMode !== 'hip_basket') {
    const targetPropH = propMode === 'hand_cane' ? 92 : 78;
    const dim = fitH(prop, targetPropH);
    const px = propMode === 'shoulder_heavy' ? 80 : propMode === 'hand_cane' ? 76 : 74;
    const py = propMode === 'shoulder_heavy' ? 104 : propMode === 'hand_cane' ? 142 : 122;
    const angle = propMode === 'shoulder_heavy' ? -14 : 10;
    drawSprite(canvas, prop, {
      cx: px,
      cy: py,
      targetW: dim.w,
      targetH: dim.h,
      angleDeg: angle,
      spectralTint: 0.25,
    });
  }

  if (propMode === 'sheep_pet' && crook) {
    const dim = fitH(crook, 94);
    drawSprite(canvas, crook, {
      cx: 76,
      cy: 108,
      targetW: dim.w,
      targetH: dim.h,
      angleDeg: -12,
      spectralTint: 0.26,
    });
  }

  // 7. Subtle spectral rim glow pass around non-transparent edges
  const out = new PNG({ width: CANVAS_SIZE, height: CANVAS_SIZE });
  out.data.set(canvas.data);
  for (let y = 2; y < CANVAS_SIZE - 2; y++) {
    for (let x = 2; x < CANVAS_SIZE - 2; x++) {
      const idx = (y * CANVAS_SIZE + x) * 4;
      if (canvas.data[idx + 3] > 20) continue;
      let neighborA = 0;
      for (const [ox, oy] of [[-2, 0], [2, 0], [0, -2], [0, 2], [-1, -1], [1, 1]]) {
        neighborA = Math.max(neighborA, canvas.data[((y + oy) * CANVAS_SIZE + (x + ox)) * 4 + 3]);
      }
      if (neighborA > 40) {
        out.data[idx] = 110;
        out.data[idx + 1] = 235;
        out.data[idx + 2] = 255;
        out.data[idx + 3] = Math.round(neighborA * 0.28);
      }
    }
  }

  savePng(out, path.join(OUT_MA_CHO_DIR, slug, 'ghost.png'));
}

/**
 * Generate traditional Vietnamese bamboo sleeping mat + rattan pillow (chiếu cói + gối mây).
 */
function buildSleepingMat() {
  const W = 200;
  const H = 104;
  const img = new PNG({ width: W, height: H });

  const setPx = (x, y, r, g, b, a = 255) => {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    blendPixel(img, x, y, r, g, b, a);
  };

  // Helper to test inside rounded slightly perspective mat quad
  const matTop = 26;
  const matBot = 86;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      // Drop shadow under mat
      const sy = y - 6;
      if (sy >= matTop && sy <= matBot) {
        const t = (sy - matTop) / (matBot - matTop);
        const inset = (1 - t) * 10;
        const leftX = 14 + inset;
        const rightX = 186 - inset;
        if (x >= leftX && x <= rightX) {
          setPx(x, y, 16, 10, 8, 95);
        }
      }
    }
  }

  for (let y = matTop - 3; y <= matBot + 3; y++) {
    for (let x = 8; x <= W - 8; x++) {
      const t = Math.max(0, Math.min(1, (y - matTop) / (matBot - matTop)));
      const inset = (1 - t) * 10;
      const leftX = 16 + inset;
      const rightX = 184 - inset;

      const dxOut = x < leftX ? leftX - x : x > rightX ? x - rightX : 0;
      const dyOut = y < matTop ? matTop - y : y > matBot ? y - matBot : 0;
      const edgeDist = Math.hypot(dxOut, dyOut);

      if (edgeDist > 3.2) continue;
      if (edgeDist > 0.2 || Math.abs(x - leftX) < 2.6 || Math.abs(x - rightX) < 2.6 || y - matTop < 2.6 || matBot - y < 2.6) {
        // #191413 folk ink border
        setPx(x, y, 25, 20, 19, 255);
        continue;
      }

      const relX = (x - leftX) / (rightX - leftX);
      // Terracotta red woven end trims ("chiếu cói viền điều")
      if (relX < 0.085 || relX > 0.915) {
        const stripe = Math.floor(y / 4) % 2 === 0;
        if (stripe) setPx(x, y, 214, 85, 57, 255);
        else setPx(x, y, 181, 61, 39, 255);
      } else {
        // Woven bamboo mat pattern
        const ribY = (y % 5) === 0;
        const ribX = ((Math.floor(x) + Math.floor(y / 5) * 3) % 8) < 2;
        if (ribY) {
          setPx(x, y, 189, 149, 76, 255);
        } else if (ribX) {
          setPx(x, y, 216, 179, 102, 255);
        } else {
          setPx(x, y, 235, 202, 130, 255);
        }
        // Subtle traditional crimson center motif dot
        if (Math.abs(relX - 0.5) < 0.03 && Math.abs(t - 0.5) < 0.14) {
          setPx(x, y, 204, 72, 49, 255);
        }
      }
    }
  }

  // Plump linen pillow on the left side of the mat (rounded rect)
  const px0 = 28;
  const px1 = 62;
  const py0 = 33;
  const py1 = 76;
  const rCorner = 9;
  for (let y = py0 - 3; y <= py1 + 3; y++) {
    for (let x = px0 - 3; x <= px1 + 3; x++) {
      const cx = Math.max(px0 + rCorner, Math.min(px1 - rCorner, x));
      const cy = Math.max(py0 + rCorner, Math.min(py1 - rCorner, y));
      const dist = Math.hypot(x - cx, y - cy);
      if (dist > rCorner + 2.6) continue;
      if (dist > rCorner - 0.2) {
        setPx(x, y, 25, 20, 19, 255);
      } else {
        // Warm cream pillow with subtle shading on bottom/right edge
        const shade = (x - px0) / (px1 - px0) * 0.35 + (y - py0) / (py1 - py0) * 0.65;
        const r = Math.round(252 - shade * 28);
        const g = Math.round(244 - shade * 32);
        const b = Math.round(228 - shade * 36);
        setPx(x, y, r, g, b, 255);
      }
    }
  }

  savePng(img, SLEEPING_MAT_OUT);
}

const tailAura = loadPng(TAIL_AURA_PATH);
const slugs = fs
  .readdirSync(KIT_ART_DIR)
  .filter((d) => fs.statSync(path.join(KIT_ART_DIR, d)).isDirectory())
  .sort();

for (const slug of slugs) {
  buildCharacterGhost(slug, tailAura);
}
buildSleepingMat();

console.log(`Built ${slugs.length} bespoke character ghost.png files and sleeping_mat.png!`);
