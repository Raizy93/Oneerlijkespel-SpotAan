/* ============================================================
   HET ONEERLIJKE SPEL — geluid.js
   Alle geluid via de Web Audio API (geen bestanden nodig).
   - Geluid (effecten) en Muziek zijn apart te regelen.
   - Volumes worden in de instellingen bewaard.
   - Zonder geluid blijft het spel volledig speelbaar.
   ============================================================ */

const Geluid = {
  ctx: null,
  effectGain: null,
  muziekGain: null,
  instellingen: null,     // referentie naar app-instellingen
  muziekTimer: null,
  muziekStap: 0,
  _radInterval: null,

  init(instellingen) {
    this.instellingen = instellingen;
  },

  // AudioContext pas aanmaken na eerste gebruikersinteractie (autoplay-regel)
  _zorgContext() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      return true;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      this.ctx = new AC();
      this.effectGain = this.ctx.createGain();
      this.effectGain.gain.value = this.instellingen.effectVolume;
      this.effectGain.connect(this.ctx.destination);
      this.muziekGain = this.ctx.createGain();
      this.muziekGain.gain.value = 0;
      this.muziekGain.connect(this.ctx.destination);
      return true;
    } catch (e) {
      return false;
    }
  },

  zetVolumes() {
    if (!this.ctx) return;
    this.effectGain.gain.value = this.instellingen.effectenAan ? this.instellingen.effectVolume : 0;
    this.muziekGain.gain.setTargetAtTime(
      this.instellingen.muziekAan ? this.instellingen.muziekVolume * 0.16 : 0,
      this.ctx.currentTime, 0.3
    );
  },

  // ---- Basisbouwstenen ----
  _toon(freq, start, duur, type = 'sine', vol = 0.5, glijNaar = null) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + start;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (glijNaar) osc.frequency.exponentialRampToValueAtTime(Math.max(20, glijNaar), t + duur);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0008, t + duur);
    osc.connect(g);
    g.connect(this.effectGain);
    osc.start(t);
    osc.stop(t + duur + 0.05);
  },

  _ruis(start, duur, vol = 0.3, laag = false) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + start;
    const n = Math.floor(this.ctx.sampleRate * duur);
    const buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const filt = this.ctx.createBiquadFilter();
    filt.type = laag ? 'lowpass' : 'highpass';
    filt.frequency.value = laag ? 700 : 2500;
    const g = this.ctx.createGain();
    g.gain.value = vol;
    src.connect(filt); filt.connect(g); g.connect(this.effectGain);
    src.start(t);
  },

  _mag() {
    if (!this.instellingen || !this.instellingen.effectenAan) return false;
    return this._zorgContext();
  },

  // ---- Effecten ----
  knop()          { if (this._mag()) this._toon(660, 0, 0.07, 'triangle', 0.25); },
  gordijn()       { if (this._mag()) { this._ruis(0, 0.7, 0.12, true); this._toon(120, 0, 0.7, 'sine', 0.12, 80); } },
  spotAan()       { if (this._mag()) { this._toon(520, 0, 0.16, 'sine', 0.3, 880); this._toon(1320, 0.1, 0.22, 'sine', 0.16); } },
  vraag()         { if (this._mag()) { this._toon(392, 0, 0.12, 'triangle', 0.28); this._toon(523, 0.11, 0.16, 'triangle', 0.28); } },
  antwoord()      { if (this._mag()) { this._toon(523, 0, 0.1, 'sine', 0.3); this._toon(784, 0.09, 0.2, 'sine', 0.3); } },

  radTik()        { if (this._mag()) this._toon(900 + Math.random() * 300, 0, 0.035, 'square', 0.07); },

  radStart() {
    // mechanisch klikken tijdens het rollen, via interval (stopt met radStop)
    this.radStop();
    if (!this._mag()) return;
    let tel = 0;
    this._radInterval = setInterval(() => {
      this.radTik();
      tel++;
      if (tel > 80) this.radStop();
    }, 70);
  },
  radStop() {
    if (this._radInterval) { clearInterval(this._radInterval); this._radInterval = null; }
  },

  positief() {
    if (!this._mag()) return;
    this._toon(523, 0, 0.14, 'triangle', 0.3);
    this._toon(659, 0.1, 0.14, 'triangle', 0.3);
    this._toon(784, 0.2, 0.3, 'triangle', 0.32);
  },
  groot() {
    if (!this._mag()) return;
    // applausachtige ruis + fanfare bij uitzonderlijk hoge score
    this._toon(523, 0, 0.14, 'triangle', 0.32);
    this._toon(659, 0.12, 0.14, 'triangle', 0.32);
    this._toon(784, 0.24, 0.16, 'triangle', 0.32);
    this._toon(1047, 0.38, 0.5, 'triangle', 0.34);
    for (let i = 0; i < 10; i++) this._ruis(0.3 + i * 0.09, 0.07, 0.05);
  },
  negatief() {
    if (!this._mag()) return;
    // komische neerwaartse storing
    this._toon(392, 0, 0.16, 'sawtooth', 0.16, 330);
    this._toon(330, 0.15, 0.18, 'sawtooth', 0.16, 262);
    this._toon(262, 0.32, 0.4, 'sawtooth', 0.18, 130);
  },
  storing() {
    if (!this._mag()) return;
    this._ruis(0, 0.12, 0.2);
    this._toon(220, 0.04, 0.08, 'square', 0.14);
    this._ruis(0.16, 0.1, 0.16);
    this._toon(160, 0.2, 0.25, 'square', 0.14, 60);
  },
  nul() {
    if (!this._mag()) return;
    this._toon(330, 0, 0.14, 'sine', 0.24);
    this._toon(330, 0.18, 0.24, 'sine', 0.2);
  },
  gebeurtenis() {
    if (!this._mag()) return;
    this._toon(440, 0, 0.1, 'triangle', 0.3);
    this._toon(554, 0.09, 0.1, 'triangle', 0.3);
    this._toon(659, 0.18, 0.1, 'triangle', 0.3);
    this._toon(880, 0.27, 0.35, 'triangle', 0.33);
  },
  telTik()        { if (this._mag()) this._toon(1180, 0, 0.03, 'sine', 0.06); },
  eindOnthulling(){ if (this._mag()) { this._toon(262, 0, 0.4, 'sine', 0.2); this._toon(330, 0, 0.4, 'sine', 0.2); this._toon(392, 0, 0.5, 'sine', 0.2); } },
  applaus() {
    if (!this._mag()) return;
    for (let i = 0; i < 26; i++) this._ruis(i * 0.075 + Math.random() * 0.04, 0.06, 0.07);
    this._toon(523, 0.1, 0.2, 'triangle', 0.22);
    this._toon(659, 0.3, 0.2, 'triangle', 0.22);
    this._toon(784, 0.5, 0.6, 'triangle', 0.26);
  },

  // ---- Achtergrondmuziek ----
  // Zachte instrumentale loop: warme akkoorden met een langzaam arpeggio,
  // theaterachtig en rustig, gegenereerd met oscillatoren.
  muziekStartStop() {
    if (!this.instellingen.muziekAan) { this._muziekStop(); return; }
    if (!this._zorgContext()) return;
    this.zetVolumes();
    if (this.muziekTimer) return; // draait al
    this.muziekStap = 0;
    this._muziekPlan();
  },

  _muziekStop() {
    if (this.muziekTimer) { clearTimeout(this.muziekTimer); this.muziekTimer = null; }
    if (this.ctx && this.muziekGain) {
      this.muziekGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.25);
    }
  },

  _muziekNoot(freq, start, duur, vol, type = 'sine') {
    const t = this.ctx.currentTime + start;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.1);
    g.gain.setTargetAtTime(0, t + duur * 0.7, duur * 0.18);
    osc.connect(g); g.connect(this.muziekGain);
    osc.start(t); osc.stop(t + duur + 0.3);
  },

  _muziekPlan() {
    if (!this.instellingen.muziekAan || !this.ctx) { this.muziekTimer = null; return; }
    // Akkoordenschema in D mineur-achtige warme sfeer (Dm - Bb - F - C)
    const akkoorden = [
      [146.83, 220.0, 293.66, 349.23],   // Dm
      [116.54, 174.61, 233.08, 293.66],  // Bb
      [130.81, 174.61, 220.0, 261.63],   // F
      [130.81, 196.0, 261.63, 329.63],   // C
    ];
    const maat = 3.4; // seconden per akkoord
    const akkoord = akkoorden[this.muziekStap % akkoorden.length];
    // warme laag
    this._muziekNoot(akkoord[0] / 2, 0, maat, 0.5, 'sine');
    this._muziekNoot(akkoord[1], 0, maat, 0.28, 'sine');
    this._muziekNoot(akkoord[2], 0, maat, 0.24, 'sine');
    // zacht arpeggio erboven
    const arp = [akkoord[2] * 2, akkoord[3] * 2, akkoord[1] * 2, akkoord[3] * 2];
    for (let i = 0; i < 4; i++) {
      this._muziekNoot(arp[i], 0.2 + i * (maat / 4.4), 0.9, 0.12, 'triangle');
    }
    this.muziekStap++;
    this.muziekTimer = setTimeout(() => this._muziekPlan(), maat * 1000 - 120);
  },
};
