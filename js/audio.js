window.TZ = window.TZ || {};

(function () {
  var ctx = null, master = null, musicGain = null, bgm = null, bgmOn = true;

  function ensure() {
    if (!ctx) {
      try {
        var AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return false;
        ctx = new AC();
        master = ctx.createGain();
        master.gain.value = 0.6;
        master.connect(ctx.destination);
        musicGain = ctx.createGain();
        musicGain.gain.value = bgmOn ? 0.3 : 0;
        musicGain.connect(master);
      } catch (e) { return false; }
    }
    if (ctx.state === 'suspended') { try { ctx.resume(); } catch (e) {} }
    return true;
  }

  function unlock() {
    if (!ensure()) return;
    if (!bgm) startBGM();
  }
  if (typeof document !== 'undefined') {
    document.addEventListener('pointerdown', unlock);
    document.addEventListener('keydown', unlock);
    document.addEventListener('touchend', unlock);
  }

  function tone(freq, t, dur, type, vol) {
    var o = ctx.createOscillator();
    var g = ctx.createGain();
    o.type = type || 'square';
    o.frequency.value = freq;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + dur + 0.03);
  }

  function noise(t, dur, vol, cutoff) {
    var len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    var buf = ctx.createBuffer(1, len, ctx.sampleRate);
    var d = buf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1);
    var src = ctx.createBufferSource();
    src.buffer = buf;
    var f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = cutoff || 3000;
    var g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(master);
    src.start(t);
  }

  var SFX = {
    click:      function (t) { tone(950, t, 0.06, 'square', 0.10); tone(1450, t + 0.03, 0.05, 'square', 0.06); },
    playerFire: function (t) { tone(900, t, 0.09, 'sawtooth', 0.14); tone(620, t + 0.02, 0.10, 'square', 0.10); noise(t, 0.04, 0.06, 6000); },
    fire:       function (t) { tone(430, t, 0.11, 'square', 0.12); tone(280, t + 0.02, 0.09, 'sawtooth', 0.08); noise(t, 0.05, 0.04, 2500); },
    enemyHit:   function (t) { tone(230, t, 0.09, 'square', 0.13); tone(150, t + 0.02, 0.11, 'sawtooth', 0.09); },
    hit:        function (t) { tone(160, t, 0.14, 'sawtooth', 0.18); noise(t, 0.08, 0.10, 1200); },
    boom:       function (t) { noise(t, 0.35, 0.30, 900); tone(120, t, 0.30, 'sine', 0.35); tone(70, t + 0.04, 0.32, 'sine', 0.26); },
    skill:      function (t) { tone(680, t, 0.12, 'sine', 0.18); tone(1040, t + 0.07, 0.14, 'sine', 0.14); tone(1560, t + 0.14, 0.14, 'sine', 0.10); },
    dash:       function (t) { noise(t, 0.16, 0.12, 5000); tone(640, t, 0.12, 'sawtooth', 0.10); },
    item:       function (t) { tone(660, t, 0.07, 'sine', 0.14); tone(880, t + 0.06, 0.09, 'sine', 0.12); tone(1320, t + 0.12, 0.12, 'sine', 0.09); },
    defeat:     function (t) { tone(392, t, 0.22, 'triangle', 0.16); tone(330, t + 0.18, 0.22, 'triangle', 0.16); tone(262, t + 0.36, 0.50, 'triangle', 0.16); },
    victory:    function (t) { tone(523, t, 0.14, 'triangle', 0.16); tone(659, t + 0.12, 0.14, 'triangle', 0.16); tone(784, t + 0.24, 0.30, 'triangle', 0.18); }
  };

  function play(name) {
    if (!ensure()) return;
    var fn = SFX[name];
    if (fn) fn(ctx.currentTime + 0.01);
  }

  var R3 = 1.189207115, R5 = 1.498307077, R2 = 2;

  function addTone(d, sr, start, dur, freq, type, vol) {
    var n = Math.floor(start * sr), m = Math.max(1, Math.floor(dur * sr));
    for (var i = 0; i < m; i++) {
      if (n + i >= d.length) break;
      var t = i / sr;
      var env = Math.pow(1 - t / dur, 2) * vol;
      var ph = t * freq;
      var v;
      if (type === 'sine') v = Math.sin(2 * Math.PI * ph);
      else if (type === 'square') v = ph % 1 < 0.5 ? 1 : -1;
      else v = 2 * (ph % 1) - 1;
      d[n + i] += env * v;
    }
  }

  function addKick(d, sr, start, dur, vol) {
    var n = Math.floor(start * sr), m = Math.max(1, Math.floor(dur * sr));
    for (var i = 0; i < m; i++) {
      if (n + i >= d.length) break;
      var t = i / sr;
      var f = 120 - (t / dur) * 80;
      var env = (1 - t / dur) * vol;
      d[n + i] += Math.sin(2 * Math.PI * f * t) * env;
    }
  }

  function addHihat(d, sr, start, dur, vol) {
    var n = Math.floor(start * sr), m = Math.max(1, Math.floor(dur * sr));
    for (var i = 0; i < m; i++) {
      if (n + i >= d.length) break;
      var t = i / sr;
      var env = (1 - t / dur) * vol;
      d[n + i] += (Math.random() * 2 - 1) * env;
    }
  }

  function buildBGM() {
    var bpm = 132, spb = 60 / bpm, sr = ctx.sampleRate;
    var bars = 8, total = bars * 4 * spb;
    var len = Math.floor(sr * total);
    var buf = ctx.createBuffer(1, len, sr);
    var d = buf.getChannelData(0);
    var prog = [220.0, 174.61, 196.0, 164.81];
    var seq = [1, R3, R5, R2, R5, R3, R5, R2, R5, R3, 1, R3, R5, R2, R5, R3];
    var stepDur = spb / 4;
    for (var bar = 0; bar < bars; bar++) {
      var root = prog[bar % 4];
      var barT = bar * 4 * spb;
      for (var b = 0; b < 4; b++) {
        var bt = barT + b * spb;
        addTone(d, sr, bt, spb * 0.22, root / 2, 'square', 0.16);
        addKick(d, sr, bt, 0.10, 0.40);
        addHihat(d, sr, bt + spb / 2, 0.03, 0.03);
      }
      for (var s = 0; s < 16; s++) {
        addTone(d, sr, barT + s * stepDur, stepDur * 0.9, root * seq[s], 'saw', 0.045);
      }
    }
    var peak = 0;
    for (var i = 0; i < len; i++) { var a = Math.abs(d[i]); if (a > peak) peak = a; }
    if (peak > 0) {
      var k = 0.9 / peak;
      for (var i = 0; i < len; i++) d[i] *= k;
    }
    return buf;
  }

  function startBGM() {
    if (!ensure() || bgm) return;
    try {
      var buf = buildBGM();
      bgm = ctx.createBufferSource();
      bgm.buffer = buf;
      bgm.loop = true;
      bgm.connect(musicGain);
      bgm.start();
    } catch (e) {}
  }

  function setMusic(on) {
    bgmOn = on;
    if (musicGain) musicGain.gain.value = on ? 0.3 : 0;
  }

  function setVolume(v) {
    if (master) master.gain.value = v;
  }

  TZ.Audio = {
    play: play,
    startBGM: startBGM,
    setMusic: setMusic,
    setVolume: setVolume,
    ensure: ensure,
    get ready() { return !!ctx; }
  };
})();