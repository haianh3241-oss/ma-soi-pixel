// 8-bit Chiptune SFX Engine using Web Audio API (zero external audio files needed)
class PixelSfxEngine {
  constructor() {
    this.ctx = null;
    this.muted = false;
  }

  ensureCtx() {
    if (this.muted) return null;
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  tone(freq, duration, type = 'square', gainVal = 0.08, delay = 0) {
    const ctx = this.ensureCtx();
    if (!ctx) return;
    const now = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    gain.gain.setValueAtTime(gainVal, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + duration);
  }

  play(name) {
    if (this.muted) return;
    switch (name) {
      case 'click':
        this.tone(520, 0.05, 'square', 0.05);
        break;
      case 'pop':
        this.tone(420, 0.06, 'triangle', 0.07);
        this.tone(680, 0.08, 'triangle', 0.06, 0.04);
        break;
      case 'splat': {
        // Egg / Poop / Tomato splat
        this.tone(180, 0.09, 'sawtooth', 0.08);
        this.tone(110, 0.14, 'sawtooth', 0.09, 0.05);
        break;
      }
      case 'smash': {
        // Badminton smash!
        this.tone(880, 0.04, 'square', 0.09);
        this.tone(240, 0.11, 'sawtooth', 0.1, 0.03);
        break;
      }
      case 'clink': {
        // Beer clink!
        this.tone(1320, 0.09, 'sine', 0.09);
        this.tone(1760, 0.14, 'sine', 0.08, 0.04);
        break;
      }
      case 'chime': {
        // Flower / Heart
        this.tone(587, 0.09, 'triangle', 0.07);
        this.tone(784, 0.09, 'triangle', 0.07, 0.07);
        this.tone(1046, 0.15, 'triangle', 0.07, 0.14);
        break;
      }
      case 'waterpipe': {
        // Điếu cày bubble + whistle!
        [180, 220, 260, 310, 420].forEach((f, idx) => {
          this.tone(f, 0.06, 'sine', 0.07, idx * 0.045);
        });
        break;
      }
      case 'wolf': {
        const ctx = this.ensureCtx();
        if (!ctx) return;
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(190, now);
        osc.frequency.linearRampToValueAtTime(340, now + 0.25);
        osc.frequency.linearRampToValueAtTime(150, now + 0.75);
        gain.gain.setValueAtTime(0.06, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.8);
        break;
      }
      case 'dawn': {
        // Rooster / Dawn fanfare
        this.tone(523, 0.1, 'square', 0.06, 0);
        this.tone(659, 0.1, 'square', 0.06, 0.1);
        this.tone(784, 0.14, 'square', 0.07, 0.2);
        this.tone(1046, 0.24, 'square', 0.07, 0.34);
        break;
      }
      case 'death': {
        // Bell toll
        this.tone(220, 0.35, 'triangle', 0.11, 0);
        this.tone(165, 0.45, 'triangle', 0.1, 0.25);
        break;
      }
      case 'tick':
        this.tone(660, 0.04, 'square', 0.04);
        break;
      case 'gunshot':
        this.tone(150, 0.18, 'sawtooth', 0.12);
        this.tone(90, 0.22, 'square', 0.1, 0.04);
        break;
      case 'glass':
        // Chai rượu vỡ choang!
        [1950, 1480, 2240, 1120, 1760].forEach((f, idx) => {
          this.tone(f, 0.055, 'sawtooth', 0.075, idx * 0.03);
        });
        break;
      case 'chop':
        // Dao phay / rìu chặt mạnh!
        this.tone(360, 0.04, 'sawtooth', 0.11, 0);
        this.tone(110, 0.12, 'square', 0.12, 0.025);
        break;
      case 'anvil':
        // Búa thợ rèn nện đe *KENG!*
        this.tone(1480, 0.16, 'square', 0.08, 0);
        this.tone(2120, 0.22, 'triangle', 0.06, 0.02);
        break;
      case 'woodblock':
        // Gõ mõ tre / gậy cốc cốc
        this.tone(720, 0.05, 'triangle', 0.09, 0);
        this.tone(720, 0.05, 'triangle', 0.08, 0.12);
        break;
      case 'coin':
        // Xu leng keng
        this.tone(988, 0.06, 'square', 0.06, 0);
        this.tone(1319, 0.14, 'square', 0.06, 0.06);
        break;
      case 'boing':
        // Nồi nhảy boong / cừu nhảy
        this.tone(260, 0.07, 'sine', 0.09, 0);
        this.tone(420, 0.09, 'sine', 0.08, 0.05);
        this.tone(560, 0.11, 'sine', 0.06, 0.1);
        break;
      case 'scissor':
        this.tone(1200, 0.04, 'sawtooth', 0.05, 0);
        this.tone(1400, 0.04, 'sawtooth', 0.05, 0.09);
        break;
      case 'cough':
        this.tone(190, 0.06, 'sawtooth', 0.07, 0);
        this.tone(160, 0.07, 'sawtooth', 0.07, 0.09);
        break;
      case 'splash':
        this.tone(520, 0.06, 'sine', 0.07, 0);
        this.tone(740, 0.08, 'triangle', 0.07, 0.05);
        break;
      default:
        break;
    }
  }
}

export const sfx = new PixelSfxEngine();
