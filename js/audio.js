TZ.Audio = (function () {
  var ctx = null, master = null;
  var volume = 0.5;

  var fileSfx = {
    playerFire: 'assets/audio/player_fire.mp3',
    enemyHit: 'assets/audio/enemy_hit.mp3'
  };
  var fileEls = {};

  function ensure() {
    if (!ctx) {
      try {
        ctx = new (window.AudioContext || window.webkitAudioContext)();
        master = ctx.createGain();
        master.gain.value = volume;
        master.connect(ctx.destination);
      } catch (e) { ctx = null; }
    }
    if (ctx && ctx.state === 'suspended') ctx.resume();
  }

  function tone(freq, dur, type, vol, slideTo) {
    if (!ctx) return;
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type || 'square';
    o.frequency.setValueAtTime(freq, ctx.currentTime);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), ctx.currentTime + dur);
    g.gain.setValueAtTime(vol, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    o.connect(g); g.connect(master);
    o.start();
    o.stop(ctx.currentTime + dur + 0.02);
  }

  function noise(dur, vol, filterFreq) {
    if (!ctx) return;
    var len = Math.floor(ctx.sampleRate * dur);
    var buf = ctx.createBuffer(1, len, ctx.sampleRate);
    var data = buf.getChannelData(0);
    for (var i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    var src = ctx.createBufferSource(); src.buffer = buf;
    var f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = filterFreq || 1000;
    var g = ctx.createGain(); g.gain.setValueAtTime(vol, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    src.connect(f); f.connect(g); g.connect(master);
    src.start();
  }

  var sfx = {
    fire:    function () { tone(220, 0.08, 'square', 0.22, 60); },
    boom:    function () { noise(0.4, 0.45, 900); tone(120, 0.25, 'sawtooth', 0.12, 40); },
    hit:     function () { noise(0.08, 0.2, 2600); },
    pickup:  function () { [523, 659, 784].forEach(function (f, i) { setTimeout(function () { tone(f, 0.1, 'sine', 0.16); }, i * 70); }); },
    triple:  function () { tone(300, 0.12, 'square', 0.14, 900); },
    nuke:    function () { noise(0.8, 0.55, 500); tone(90, 0.5, 'sawtooth', 0.2, 30); },
    dash:    function () { tone(200, 0.2, 'sawtooth', 0.16, 950); },
    shield:  function () { tone(300, 0.25, 'sine', 0.18, 650); tone(500, 0.2, 'sine', 0.12, 900); },
    warn:    function () { tone(880, 0.18, 'square', 0.26); setTimeout(function () { tone(880, 0.18, 'square', 0.26); }, 200); },
    laser:   function () { tone(1200, 0.7, 'sawtooth', 0.12, 100); },
    wave:    function () { tone(523, 0.15, 'sine', 0.18, 1046); },
    boss:    function () { [400, 300, 400, 300, 900].forEach(function (f, i) { setTimeout(function () { tone(f, 0.15, 'square', 0.2); }, i * 120); }); },
    click:   function () { tone(650, 0.06, 'square', 0.1); },
    victory: function () { [523, 659, 784, 1046].forEach(function (f, i) { setTimeout(function () { tone(f, 0.22, 'sine', 0.18); }, i * 130); }); },
    defeat:  function () { [400, 300, 220, 150].forEach(function (f, i) { setTimeout(function () { tone(f, 0.25, 'sawtooth', 0.12); }, i * 180); }); }
  };

  return {
    ensure: ensure,
    setVolume: function (v) {
      volume = v;
      if (master) master.gain.value = v;
      for (var k in fileEls) { try { fileEls[k].volume = v; } catch (e) {} }
    },
    play: function (name) {
      ensure();
      if (fileSfx[name]) {
        var el = fileEls[name];
        if (!el) {
          try {
            el = new Audio(fileSfx[name]);
            el.preload = 'auto';
            fileEls[name] = el;
          } catch (e) { return; }
        }
        try {
          el.volume = volume;
          el.currentTime = 0;
          var pr = el.play();
          if (pr && pr.catch) pr.catch(function () {});
        } catch (e) {}
        return;
      }
      var s = sfx[name];
      if (s) s();
    }
  };
})();
