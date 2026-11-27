// Audio Engine for "Ma Chó": BGM (Lobby / Day / Night) + Real WAV SFX (Rooster, Wolf Howl, Bite, Gunshot, Drum, Execution, Curse, Potion)

const WAV_SFX = {
  rooster: '/sfx/rooster.wav',
  dawn: '/sfx/rooster.wav',
  wolf: '/sfx/wolf_howl.wav',
  bite: '/sfx/wolf_bite.wav',
  gunshot: '/sfx/gunshot.wav',
  execution: '/sfx/execution.wav',
  drum: '/sfx/war_drum.wav',
  curse: '/sfx/curse_spell.wav',
  potion: '/sfx/witch_potion.wav',
  death: '/sfx/death.wav',
  jump: '/sfx/jump.wav',
  punch: '/sfx/punch.wav',
  kick: '/sfx/kick.wav',
};

class GameAudioEngine {
  constructor() {
    this.ctx = null;
    this.bgmMode = 'off'; // 'off' | 'lobby' | 'day' | 'night'
    this.bgmTimer = null;
    this.bgmStep = 0;

    this.wavBuffers = new Map(); // url -> AudioBuffer
    this.wavLoading = new Map(); // url -> Promise
    this.unlocked = false;

    const savedBgm = typeof localStorage !== 'undefined' ? localStorage.getItem('macho_bgm_vol') : null;
    const savedSfx = typeof localStorage !== 'undefined' ? localStorage.getItem('macho_sfx_vol') : null;
    this.bgmVolume = savedBgm !== null ? Number(savedBgm) : 0.35;
    this.sfxVolume = savedSfx !== null ? Number(savedSfx) : 0.85;
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
    if (!this.unlocked && typeof window !== 'undefined') {
      this.unlocked = true;
      this.preloadAll();
    }
    return this.ctx;
  }

  preloadAll() {
    if (typeof window === 'undefined') return;
    const urls = new Set(Object.values(WAV_SFX));
    for (const url of urls) {
      this.loadWavBuffer(url);
    }
  }

  loadWavBuffer(url) {
    if (this.wavBuffers.has(url)) return Promise.resolve(this.wavBuffers.get(url));
    if (this.wavLoading.has(url)) return this.wavLoading.get(url);

    const p = fetch(url)
      .then((res) => (res.ok ? res.arrayBuffer() : null))
      .then((ab) => {
        if (!ab) return null;
        const ctx = this.ensureCtx();
        if (!ctx) return null;
        return ctx.decodeAudioData(ab);
      })
      .then((audioBuf) => {
        if (audioBuf) this.wavBuffers.set(url, audioBuf);
        return audioBuf;
      })
      .catch(() => null);

    this.wavLoading.set(url, p);
    return p;
  }

  playWav(url) {
    if (typeof window === 'undefined' || this.muted || this.sfxVolume <= 0.005) return false;
    const ctx = this.ensureCtx();
    const vol = Math.max(0, Math.min(1, this.sfxVolume));

    const cached = this.wavBuffers.get(url);
    if (ctx && cached) {
      try {
        const src = ctx.createBufferSource();
        src.buffer = cached;
        const gain = ctx.createGain();
        gain.gain.value = vol;
        src.connect(gain);
        gain.connect(ctx.destination);
        src.start(0);
        return true;
      } catch {}
    }

    // Immediate HTMLAudioElement playback while buffer is decoding or when WebAudio isn't unlocked yet
    try {
      const audio = new Audio(url);
      audio.volume = vol;
      audio.play().catch(() => {});
      this.loadWavBuffer(url);
      return true;
    } catch {
      return false;
    }
  }

  setBgmVolume(val) {
    this.bgmVolume = Math.max(0, Math.min(1, val));
    if (typeof localStorage !== 'undefined') localStorage.setItem('macho_bgm_vol', String(this.bgmVolume));
  }

  setSfxVolume(val) {
    this.sfxVolume = Math.max(0, Math.min(1, val));
    if (typeof localStorage !== 'undefined') localStorage.setItem('macho_sfx_vol', String(this.sfxVolume));
  }

  tone(freq, duration, type = 'triangle', gainVal = 0.14, delay = 0, isBgm = false) {
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
    const boost = isBgm ? 1 : 2.2;
    const scaled = Math.max(0.0001, Math.min(0.9, gainVal * vol * boost));
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
        const notes = [523.25, 659.25, 783.99, 659.25, 587.33, 698.46, 880, 698.46];
        const f = notes[s % notes.length];
        this.tone(f, 0.22, 'triangle', 0.055, 0, true);
        if (s % 4 === 0) this.tone(f / 4, 0.3, 'sine', 0.06, 0, true);
      } else if (mode === 'day') {
        const notes = [392, 493.88, 587.33, 493.88, 440, 523.25, 659.25, 523.25];
        const f = notes[s % notes.length];
        this.tone(f, 0.34, 'sine', 0.04, 0, true);
        if (s % 9 === 5) {
          this.tone(1560, 0.06, 'sine', 0.02, 0, true);
          this.tone(1860, 0.07, 'sine', 0.02, 0.08, true);
        }
      } else if (mode === 'night') {
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

    if (WAV_SFX[name]) {
      this.playWav(WAV_SFX[name]);
      return;
    }

    const ctx = this.ensureCtx();
    if (!ctx) return;

    switch (name) {
      case 'click':
        this.tone(540, 0.05, 'triangle', 0.07);
        break;
      case 'pop':
        this.tone(420, 0.06, 'triangle', 0.09);
        this.tone(680, 0.08, 'triangle', 0.08, 0.04);
        break;
      case 'splat':
        this.tone(180, 0.09, 'sawtooth', 0.09);
        this.tone(110, 0.14, 'sawtooth', 0.1, 0.05);
        break;
      case 'smash':
        this.tone(880, 0.04, 'square', 0.1);
        this.tone(240, 0.11, 'sawtooth', 0.11, 0.03);
        break;
      case 'clink':
        this.tone(1320, 0.09, 'sine', 0.1);
        this.tone(1760, 0.14, 'sine', 0.09, 0.04);
        break;
      case 'chime':
        this.tone(587, 0.09, 'triangle', 0.08);
        this.tone(784, 0.09, 'triangle', 0.08, 0.07);
        this.tone(1046, 0.15, 'triangle', 0.08, 0.14);
        break;
      case 'waterpipe':
        [180, 220, 260, 310, 420].forEach((f, idx) => this.tone(f, 0.06, 'sine', 0.08, idx * 0.045));
        break;
      case 'tick':
        this.tone(660, 0.04, 'triangle', 0.06);
        break;
      case 'glass':
        [1950, 1480, 2240, 1120, 1760].forEach((f, idx) => this.tone(f, 0.055, 'sawtooth', 0.08, idx * 0.03));
        break;
      case 'chop':
        this.tone(360, 0.04, 'sawtooth', 0.11, 0);
        this.tone(110, 0.12, 'square', 0.12, 0.025);
        break;
      case 'anvil':
        this.tone(1480, 0.16, 'square', 0.09, 0);
        this.tone(2120, 0.22, 'triangle', 0.07, 0.02);
        break;
      case 'woodblock':
        this.tone(720, 0.05, 'triangle', 0.1, 0);
        this.tone(720, 0.05, 'triangle', 0.09, 0.12);
        break;
      case 'coin':
        this.tone(988, 0.06, 'square', 0.07, 0);
        this.tone(1319, 0.14, 'square', 0.07, 0.06);
        break;
      case 'boing':
        this.tone(260, 0.07, 'sine', 0.1, 0);
        this.tone(420, 0.09, 'sine', 0.09, 0.05);
        this.tone(560, 0.11, 'sine', 0.07, 0.1);
        break;
      case 'scissor':
        this.tone(1200, 0.04, 'sawtooth', 0.06, 0);
        this.tone(1400, 0.04, 'sawtooth', 0.06, 0.09);
        break;
      case 'cough':
        this.tone(190, 0.06, 'sawtooth', 0.08, 0);
        this.tone(160, 0.07, 'sawtooth', 0.08, 0.09);
        break;
      case 'splash':
        this.tone(520, 0.06, 'sine', 0.08, 0);
        this.tone(740, 0.08, 'triangle', 0.08, 0.05);
        break;
      default:
        break;
    }
  }
}

export const sfx = new GameAudioEngine();
