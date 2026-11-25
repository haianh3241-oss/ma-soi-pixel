// Audio Engine for "Ma Chó": BGM (Lobby / Day / Night) + SFX (Rooster, Wolf Howl, 22 Pokes)
class GameAudioEngine {
  constructor() {
    this.ctx = null;
    this.bgmMode = 'off'; // 'off' | 'lobby' | 'day' | 'night'
    this.bgmTimer = null;
    this.bgmStep = 0;

    const savedBgm = typeof localStorage !== 'undefined' ? localStorage.getItem('macho_bgm_vol') : null;
    const savedSfx = typeof localStorage !== 'undefined' ? localStorage.getItem('macho_sfx_vol') : null;
    this.bgmVolume = savedBgm !== null ? Number(savedBgm) : 0.35;
    this.sfxVolume = savedSfx !== null ? Number(savedSfx) : 0.75;
    this.muted = false;
  }

  ensureCtx() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  setBgmVolume(val) {
    this.bgmVolume = Math.max(0, Math.min(1, val));
    if (typeof localStorage !== 'undefined') localStorage.setItem('macho_bgm_vol', String(this.bgmVolume));
  }

  setSfxVolume(val) {
    this.sfxVolume = Math.max(0, Math.min(1, val));
    if (typeof localStorage !== 'undefined') localStorage.setItem('macho_sfx_vol', String(this.sfxVolume));
  }

  tone(freq, duration, type = 'triangle', gainVal = 0.08, delay = 0, isBgm = false) {
    if (this.muted) return;
    const vol = isBgm ? this.bgmVolume : this.sfxVolume;
    if (vol <= 0.005) return;

    const ctx = this.ensureCtx();
    if (!ctx || ctx.state === 'suspended') return;
    const now = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    const scaled = Math.max(0.0001, gainVal * vol);
    gain.gain.setValueAtTime(scaled, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + duration);
  }

  setBgmMode(mode) {
    if (this.bgmMode === mode) return;
    this.bgmMode = mode;
    this.bgmStep = 0;
    if (this.bgmTimer) {
      clearInterval(this.bgmTimer);
      this.bgmTimer = null;
    }
    if (mode === 'off') return;

    const tickMs = mode === 'lobby' ? 320 : mode === 'day' ? 460 : 580;
    this.bgmTimer = setInterval(() => {
      if (this.muted || this.bgmVolume <= 0.01) return;
      if (!this.ctx || this.ctx.state === 'suspended') return;
      const s = this.bgmStep++;

      if (mode === 'lobby') {
        // Bouncy playful party loop (C major / A minor)
        const notes = [523.25, 659.25, 783.99, 659.25, 587.33, 698.46, 880, 698.46];
        const f = notes[s % notes.length];
        this.tone(f, 0.22, 'triangle', 0.055, 0, true);
        if (s % 4 === 0) this.tone(f / 4, 0.3, 'sine', 0.06, 0, true);
      } else if (mode === 'day') {
        // Calm warm acoustic daytime + occasional soft bird chirp
        const notes = [392, 493.88, 587.33, 493.88, 440, 523.25, 659.25, 523.25];
        const f = notes[s % notes.length];
        this.tone(f, 0.34, 'sine', 0.04, 0, true);
        if (s % 9 === 5) {
          this.tone(1560, 0.06, 'sine', 0.02, 0, true);
          this.tone(1860, 0.07, 'sine', 0.02, 0.08, true);
        }
      } else if (mode === 'night') {
        // Mysterious night ambiance + cricket pulse
        const bass = [130.81, 0, 146.83, 0, 123.47, 0, 110, 0];
        const b = bass[s % bass.length];
        if (b > 0) this.tone(b, 0.5, 'sine', 0.065, 0, true);
        if (s % 3 === 1) {
          this.tone(2400, 0.03, 'triangle', 0.012, 0, true);
          this.tone(2450, 0.03, 'triangle', 0.012, 0.05, true);
        }
      }
    }, tickMs);
  }

  play(name) {
    if (this.muted || this.sfxVolume <= 0.005) return;
    const ctx = this.ensureCtx();
    if (!ctx) return;

    switch (name) {
      case 'click':
        this.tone(520, 0.05, 'triangle', 0.06);
        break;
      case 'pop':
        this.tone(420, 0.06, 'triangle', 0.08);
        this.tone(680, 0.08, 'triangle', 0.07, 0.04);
        break;
      case 'splat':
        this.tone(180, 0.09, 'sawtooth', 0.08);
        this.tone(110, 0.14, 'sawtooth', 0.09, 0.05);
        break;
      case 'smash':
        this.tone(880, 0.04, 'square', 0.09);
        this.tone(240, 0.11, 'sawtooth', 0.1, 0.03);
        break;
      case 'clink':
        this.tone(1320, 0.09, 'sine', 0.09);
        this.tone(1760, 0.14, 'sine', 0.08, 0.04);
        break;
      case 'chime':
        this.tone(587, 0.09, 'triangle', 0.07);
        this.tone(784, 0.09, 'triangle', 0.07, 0.07);
        this.tone(1046, 0.15, 'triangle', 0.07, 0.14);
        break;
      case 'waterpipe':
        [180, 220, 260, 310, 420].forEach((f, idx) => this.tone(f, 0.06, 'sine', 0.07, idx * 0.045));
        break;
      case 'rooster':
      case 'dawn': {
        // Ò ó o ooo~ Rooster crow!
        const now = ctx.currentTime;
        const v = this.sfxVolume;
        const crow = (f1, f2, start, dur) => {
          const osc = ctx.createOscillator();
          const g = ctx.createGain();
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(f1, now + start);
          osc.frequency.linearRampToValueAtTime(f2, now + start + dur);
          g.gain.setValueAtTime(0.065 * v, now + start);
          g.gain.exponentialRampToValueAtTime(0.0005, now + start + dur);
          osc.connect(g);
          g.connect(ctx.destination);
          osc.start(now + start);
          osc.stop(now + start + dur);
        };
        crow(520, 640, 0, 0.14);
        crow(660, 820, 0.16, 0.14);
        crow(780, 980, 0.32, 0.18);
        crow(960, 560, 0.52, 0.55);
        break;
      }
      case 'wolf': {
        // Auuuuu~ Dog/Wolf howl!
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(210, now);
        osc.frequency.linearRampToValueAtTime(420, now + 0.35);
        osc.frequency.linearRampToValueAtTime(340, now + 0.75);
        osc.frequency.linearRampToValueAtTime(160, now + 1.25);
        gain.gain.setValueAtTime(0.001, now);
        gain.gain.linearRampToValueAtTime(0.075 * this.sfxVolume, now + 0.25);
        gain.gain.exponentialRampToValueAtTime(0.0005, now + 1.3);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 1.35);
        break;
      }
      case 'death':
        this.tone(220, 0.35, 'triangle', 0.11, 0);
        this.tone(165, 0.45, 'triangle', 0.1, 0.25);
        break;
      case 'tick':
        this.tone(660, 0.04, 'triangle', 0.05);
        break;
      case 'gunshot':
        this.tone(150, 0.18, 'sawtooth', 0.12);
        this.tone(90, 0.22, 'square', 0.1, 0.04);
        break;
      case 'glass':
        [1950, 1480, 2240, 1120, 1760].forEach((f, idx) => this.tone(f, 0.055, 'sawtooth', 0.075, idx * 0.03));
        break;
      case 'chop':
        this.tone(360, 0.04, 'sawtooth', 0.11, 0);
        this.tone(110, 0.12, 'square', 0.12, 0.025);
        break;
      case 'anvil':
        this.tone(1480, 0.16, 'square', 0.08, 0);
        this.tone(2120, 0.22, 'triangle', 0.06, 0.02);
        break;
      case 'woodblock':
        this.tone(720, 0.05, 'triangle', 0.09, 0);
        this.tone(720, 0.05, 'triangle', 0.08, 0.12);
        break;
      case 'coin':
        this.tone(988, 0.06, 'square', 0.06, 0);
        this.tone(1319, 0.14, 'square', 0.06, 0.06);
        break;
      case 'boing':
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

export const sfx = new GameAudioEngine();
