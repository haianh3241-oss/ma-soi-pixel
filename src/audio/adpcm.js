// IMA-ADPCM 4-bit codec for lightweight, clear 16kHz voice streaming over Socket.IO

const INDEX_TABLE = [-1, -1, -1, -1, 2, 4, 6, 8, -1, -1, -1, -1, 2, 4, 6, 8];
const STEP_TABLE = [
  7, 8, 9, 10, 11, 12, 13, 14, 16, 17, 19, 21, 23, 25, 28, 31, 34, 37, 41, 45, 50, 55, 60, 66, 73, 80, 88, 97, 107,
  118, 130, 143, 157, 173, 190, 209, 230, 253, 279, 307, 337, 371, 408, 449, 494, 544, 598, 658, 724, 796, 876, 963,
  1060, 1166, 1282, 1411, 1552, 1707, 1878, 2066, 2272, 2499, 2749, 3024, 3327, 3660, 4026, 4428, 4871, 5358, 5894,
  6484, 7132, 7845, 8630, 9493, 10442, 11487, 12635, 13899, 15289, 16818, 18500, 20350, 22385, 24623, 27086, 29794,
  32767,
];

export function encodeAdpcm(floatSamples) {
  const count = floatSamples.length;
  const out = new Uint8Array(4 + Math.ceil(count / 2));
  const view = new DataView(out.buffer);

  let predictor = Math.max(-32768, Math.min(32767, Math.round((floatSamples[0] || 0) * 32767)));
  const d1 = Math.abs(((floatSamples[1] ?? floatSamples[0]) || 0) - (floatSamples[0] || 0)) * 32767;
  const d2 = Math.abs(((floatSamples[2] ?? floatSamples[1] ?? floatSamples[0]) || 0) - ((floatSamples[1] ?? floatSamples[0]) || 0)) * 32767;
  const initDelta = Math.max(d1, d2);
  let stepIndex = 24;
  while (stepIndex < 88 && STEP_TABLE[stepIndex] < initDelta) stepIndex++;
  view.setInt16(0, predictor, true);
  out[2] = stepIndex;
  out[3] = count & 1 ? 1 : 0; // odd-sample flag

  let step = STEP_TABLE[stepIndex];
  for (let i = 0; i < count; i++) {
    const pcm = Math.max(-32768, Math.min(32767, Math.round(floatSamples[i] * 32767)));
    let diff = pcm - predictor;
    let nibble = 0;
    if (diff < 0) {
      nibble = 8;
      diff = -diff;
    }

    let vpdiff = step >> 3;
    if (diff >= step) {
      nibble |= 4;
      diff -= step;
      vpdiff += step;
    }
    step >>= 1;
    if (diff >= step) {
      nibble |= 2;
      diff -= step;
      vpdiff += step;
    }
    step >>= 1;
    if (diff >= step) {
      nibble |= 1;
      vpdiff += step;
    }

    if (nibble & 8) predictor -= vpdiff;
    else predictor += vpdiff;
    predictor = Math.max(-32768, Math.min(32767, predictor));

    stepIndex = Math.max(0, Math.min(88, stepIndex + INDEX_TABLE[nibble]));
    step = STEP_TABLE[stepIndex];

    const byteIdx = 4 + (i >> 1);
    if ((i & 1) === 0) out[byteIdx] = nibble & 0x0f;
    else out[byteIdx] |= (nibble & 0x0f) << 4;
  }

  return out;
}

export function decodeAdpcm(bytes) {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  if (u8.length < 5) return new Float32Array(0);
  const view = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  let predictor = view.getInt16(0, true);
  let stepIndex = Math.max(0, Math.min(88, u8[2]));
  const odd = u8[3] === 1;
  const totalNibbles = (u8.length - 4) * 2 - (odd ? 1 : 0);
  const out = new Float32Array(totalNibbles);

  let step = STEP_TABLE[stepIndex];
  for (let i = 0; i < totalNibbles; i++) {
    const byte = u8[4 + (i >> 1)];
    const nibble = (i & 1) === 0 ? byte & 0x0f : (byte >> 4) & 0x0f;

    let vpdiff = step >> 3;
    if (nibble & 4) vpdiff += step;
    if (nibble & 2) vpdiff += step >> 1;
    if (nibble & 1) vpdiff += step >> 2;

    if (nibble & 8) predictor -= vpdiff;
    else predictor += vpdiff;
    predictor = Math.max(-32768, Math.min(32767, predictor));

    stepIndex = Math.max(0, Math.min(88, stepIndex + INDEX_TABLE[nibble]));
    step = STEP_TABLE[stepIndex];
    out[i] = predictor / 32768;
  }

  return out;
}

export function downsampleTo16k(input, inputRate) {
  if (!inputRate || inputRate <= 16000) return input;
  const ratio = inputRate / 16000;
  const outLen = Math.max(1, Math.floor(input.length / ratio));
  const out = new Float32Array(outLen);
  for (let i = 0; i < outLen; i++) {
    const start = Math.floor(i * ratio);
    const end = Math.min(input.length, Math.floor((i + 1) * ratio));
    let sum = 0;
    for (let j = start; j < end; j++) sum += input[j];
    out[i] = sum / Math.max(1, end - start);
  }
  return out;
}
