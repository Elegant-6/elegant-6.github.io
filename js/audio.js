window.TZ = window.TZ || {};

(function () {
  var ctx = null, master = null, musicGain = null, bgmEl = null, bgmOn = true, bgmSrc = '卡农 - 文武贝.mp3';

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
    if (!bgmEl) startBGM();
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

  function startBGM() {
    if (!ensure() || bgmEl || !bgmSrc) return;
    try {
      bgmEl = new Audio(bgmSrc);
      bgmEl.loop = true;
      bgmEl.volume = 0.5;
      var src = ctx.createMediaElementSource(bgmEl);
      src.connect(musicGain);
      var pr = bgmEl.play();
      if (pr && pr.then) pr.catch(function () {});
    } catch (e) { bgmEl = null; }
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
    get ready() { return !!ctx; },
    set bgmSrc(v) { bgmSrc = v; }
  };
})();