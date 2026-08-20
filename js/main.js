TZ.Save = (function () {
  var defaults = {
    unlocked: { blast:false, lightning:false, guard:false },
    progress: { chapter:0, level:0 },
    scores: [],
    settings: { baseDef:true, music:true },
    level: 1,
    gold: 0
  };
  var data = JSON.parse(JSON.stringify(defaults));

  function load() {
    try {
      var raw = localStorage.getItem(TZ.Config.SAVE_KEY);
      if (raw) {
        var d = JSON.parse(raw);
        for (var k in defaults) {
          if (d[k] === undefined) d[k] = JSON.parse(JSON.stringify(defaults[k]));
        }
        data = d;
      }
    } catch (e) {}
  }

  function save() {
    try { localStorage.setItem(TZ.Config.SAVE_KEY, JSON.stringify(data)); } catch (e) {}
  }

  function isUnlocked(k) {
    return k === 'default' || !!data.unlocked[k];
  }

  function unlock(k) {
    if (!data.unlocked[k]) {
      data.unlocked[k] = true;
      save();
    }
  }

  function addScore(entry) {
    data.scores.push(entry);
    data.scores.sort(function (a, b) { return b.score - a.score; });
    data.scores = data.scores.slice(0, 10);
    if (entry.score >= 8000) unlock('blast');
    if (entry.score >= 20000) unlock('lightning');
    if (entry.score >= 40000) unlock('guard');
    save();
  }

  function progressIndex() {
    return data.progress.chapter * TZ.Config.LEVELS_PER_CHAPTER + data.progress.level;
  }

  function advanceProgress(chapter, level) {
    var idx = chapter * TZ.Config.LEVELS_PER_CHAPTER + level;
    if (idx > progressIndex()) {
      data.progress.chapter = chapter;
      data.progress.level = level;
      save();
    }
  }

  function reset() {
    try { localStorage.removeItem(TZ.Config.SAVE_KEY); } catch (e) {}
    data = JSON.parse(JSON.stringify(defaults));
  }

  return {
    get data() { return data; },
    load: load,
    save: save,
    isUnlocked: isUnlocked,
    unlock: unlock,
    addScore: addScore,
    advanceProgress: advanceProgress,
    progressIndex: progressIndex,
    reset: reset
  };
})();

TZ.Level = {
  MAX: 100,
  get: function () { return TZ.Save.data.level || 1; },
  gold: function () { return TZ.Save.data.gold || 0; },
  cost: function (n) { return Math.floor(20 * Math.pow(1.04, (n || 1) - 1)); },
  mults: function () {
    var lv = this.get();
    var b = (lv - 1) * 0.01;
    return {
      hp: 1 + b,
      atk: 1 + b,
      spd: 1 + (lv - 1) * 0.005,
      rate: 1 + (lv - 1) * 0.005
    };
  },
  enemyBoost: function () {
    return (this.get() - 1) * 0.01 * 0.3;
  },
  tankExtra: function (key) {
    var lv = this.get();
    var b = (lv - 1) * 0.01;
    var s = (lv - 1) * 0.005;
    var ex = { bulletSpeed:0, splash:0, nukeDmg:0, nukeSplash:0, dashDmg:0, shield:0 };
    if (key === 'default') ex.bulletSpeed = Math.round(480 * (1 + s));
    if (key === 'blast') {
      ex.splash = 64 * (1 + b);
      ex.nukeDmg = Math.round(120 * (1 + b));
      ex.nukeSplash = 150 * (1 + b);
    }
    if (key === 'lightning') ex.dashDmg = Math.round(60 * (1 + b));
    if (key === 'guard') ex.shield = Math.round(80 * (1 + b));
    return ex;
  },
  canUpgrade: function () {
    return this.get() < this.MAX && this.gold() >= this.cost(this.get());
  },
  upgrade: function () {
    if (!this.canUpgrade()) return false;
    var lv = this.get();
    TZ.Save.data.gold = this.gold() - this.cost(lv);
    TZ.Save.data.level = Math.min(this.MAX, lv + 1);
    TZ.Save.save();
    return true;
  },
  addGold: function (n) {
    TZ.Save.data.gold = this.gold() + n;
    TZ.Save.save();
  }
};

TZ.Game = (function () {
  var app = null;
  var canvas, ctx;
  var last = 0, acc = 0;
  var pendingStart = null;

  function trimBossSprite(img) {
    var w = img.naturalWidth, h = img.naturalHeight;
    if (!w || !h) return img;
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    var t = c.getContext('2d');
    t.drawImage(img, 0, 0);
    var id, d;
    try { id = t.getImageData(0, 0, w, h); } catch (e) { return img; }
    d = id.data;
    var lab = new Int32Array(w * h);
    var stack = new Int32Array(w * h);
    var best = { area: 0, minX: w, minY: h, maxX: -1, maxY: -1 };
    var cur = 0;
    for (var sy = 0; sy < h; sy++) {
      for (var sx = 0; sx < w; sx++) {
        var si = (sy * w + sx) * 4;
        var isC = d[si] < 238 || d[si + 1] < 238 || d[si + 2] < 238;
        if (!isC || lab[si >> 2]) continue;
        cur++;
        var sp = 0, area = 0, minX = w, minY = h, maxX = -1, maxY = -1;
        stack[sp++] = sx; stack[sp++] = sy;
        lab[si >> 2] = cur;
        while (sp > 0) {
          var y = stack[--sp], x = stack[--sp];
          area++;
          if (x < minX) minX = x; if (x > maxX) maxX = x;
          if (y < minY) minY = y; if (y > maxY) maxY = y;
          if (x > 0 && !lab[y * w + x - 1]) {
            var li = (y * w + x - 1) * 4;
            if (d[li] < 238 || d[li + 1] < 238 || d[li + 2] < 238) { lab[y * w + x - 1] = cur; stack[sp++] = x - 1; stack[sp++] = y; }
          }
          if (x < w - 1 && !lab[y * w + x + 1]) {
            var ri = (y * w + x + 1) * 4;
            if (d[ri] < 238 || d[ri + 1] < 238 || d[ri + 2] < 238) { lab[y * w + x + 1] = cur; stack[sp++] = x + 1; stack[sp++] = y; }
          }
          if (y > 0 && !lab[(y - 1) * w + x]) {
            var ui = ((y - 1) * w + x) * 4;
            if (d[ui] < 238 || d[ui + 1] < 238 || d[ui + 2] < 238) { lab[(y - 1) * w + x] = cur; stack[sp++] = x; stack[sp++] = y - 1; }
          }
          if (y < h - 1 && !lab[(y + 1) * w + x]) {
            var bi = ((y + 1) * w + x) * 4;
            if (d[bi] < 238 || d[bi + 1] < 238 || d[bi + 2] < 238) { lab[(y + 1) * w + x] = cur; stack[sp++] = x; stack[sp++] = y + 1; }
          }
        }
        if (area > best.area) { best = { area: area, minX: minX, minY: minY, maxX: maxX, maxY: maxY }; }
      }
    }
    for (var i2 = 0; i2 < d.length; i2 += 4) {
      if (d[i2] > 235 && d[i2 + 1] > 235 && d[i2 + 2] > 235) d[i2 + 3] = 0;
    }
    t.putImageData(id, 0, 0);
    if (best.maxX < 0) return c;
    var cw = best.maxX - best.minX + 1, ch = best.maxY - best.minY + 1;
    var c2 = document.createElement('canvas');
    c2.width = cw; c2.height = ch;
    c2.getContext('2d').drawImage(c, best.minX, best.minY, cw, ch, 0, 0, cw, ch);
    return c2;
  }

  function init() {
    TZ.Images = {};
    var keys = Object.keys(TZ.Config.TANKS);
    for (var i = 0; i < keys.length; i++) {
      var img = new Image();
      img.src = TZ.Config.TANKS[keys[i]].img;
      TZ.Images[keys[i]] = img;
    }
    var ekeys = Object.keys(TZ.Config.ENEMIES);
    for (var i = 0; i < ekeys.length; i++) {
      var ed = TZ.Config.ENEMIES[ekeys[i]];
      if (!ed.img) continue;
      var eimg = new Image();
      eimg.src = ed.img;
      TZ.Images['E_' + ekeys[i]] = eimg;
    }
    var bkeys = Object.keys(TZ.Config.BOSSES);
    for (var i = 0; i < bkeys.length; i++) {
      var bd = TZ.Config.BOSSES[bkeys[i]];
      if (!bd.img) continue;
      (function (key, src) {
        var bimg = new Image();
        bimg.onload = function () {
          try { TZ.Images['SB_' + key] = trimBossSprite(bimg); } catch (e) { TZ.Images['SB_' + key] = bimg; }
        };
        bimg.src = src;
        TZ.Images['B_' + key] = bimg;
      })(bkeys[i], bd.img);
    }

    canvas = document.getElementById('gameCanvas');
    ctx = canvas.getContext('2d');

    TZ.Save.load();
    TZ.UI.init();

    document.getElementById('pause-btn').addEventListener('click', function () {
      if (app && app.scene === 'playing') {
        if (app.paused) TZ.Game.pause(false);
        else TZ.Game.pause(true);
      }
    });
    var skillBtn = document.getElementById('touch-skill');
    skillBtn.addEventListener('touchstart', function (e) {
      e.preventDefault();
      e.stopPropagation();
      TZ.Input.triggerSkill();
    });
    skillBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      TZ.Input.triggerSkill();
    });

    window.addEventListener('resize', fit);
    fit();
    initBg();
    requestAnimationFrame(loop);
  }

  function fit() {
    var s = Math.min(window.innerWidth * 0.92, window.innerHeight * 0.92);
    canvas.style.width = s + 'px';
    canvas.style.height = s + 'px';
  }

  function initBg() {
    var b = document.getElementById('bgCanvas');
    var bc = b.getContext('2d');
    function size() { b.width = window.innerWidth; b.height = window.innerHeight; }
    size();
    window.addEventListener('resize', size);
    var stars = [];
    for (var i = 0; i < 90; i++) {
      stars.push({ x:Math.random(), y:Math.random(), r:Math.random() * 1.8 + 0.4, s:Math.random() * 20 + 4, ph:Math.random() * 6 });
    }
    (function tick(t) {
      bc.clearRect(0, 0, b.width, b.height);
      for (var i = 0; i < stars.length; i++) {
        var st = stars[i];
        st.y -= st.s / 2000;
        if (st.y < 0) st.y = 1;
        var tw = 0.5 + 0.5 * Math.sin(t / 500 + st.ph);
        bc.fillStyle = 'rgba(0,240,255,' + (0.35 * tw) + ')';
        bc.beginPath(); bc.arc(st.x * b.width, st.y * b.height, st.r, 0, 7); bc.fill();
      }
      requestAnimationFrame(tick);
    })(0);
  }

  function start(mode, tankKey) {
    app = {
      scene: 'playing',
      mode: mode,
      tankKey: tankKey,
      chapter: 0, level: 0,
      wave: 0, waves: [],
      waveQueue: [], spawnT: 0,
      bossKey: null, bossSpawned: false,
      player: null,
      enemies: [], bullets: [], items: [], meteors: [],
      map: null, base: null, boss: null,
      score: 0, freeze: 0, time: 0,
      goldEarned: 0,
      paused: false,
      baseDef: TZ.Save.data.settings.baseDef,
      gameComplete: false,
      replayAt: null
    };
    TZ.time = 0;
    TZ.Particles.list.length = 0;
    TZ.Particles.addShake(4);

    if (mode === 'adventure') {
      var pr = pendingStart || TZ.Save.data.progress;
      app.chapter = pr.chapter;
      app.level = pr.level;
      pendingStart = null;
      app.map = { grid: TZ.Map.create(app.chapter * TZ.Config.LEVELS_PER_CHAPTER + app.level + 1) };
      app.base = { x:TZ.Map.BASE.x, y:TZ.Map.BASE.y, hp:app.baseDef ? 200 : 999999, maxHp:200, alive:true };
      buildLevel(app);
      TZ.UI.setBanner('第' + (app.chapter * TZ.Config.LEVELS_PER_CHAPTER + app.level + 1) + '关', 1600);
    } else if (mode === 'endless') {
      app.chapter = 0;
      app.map = { grid: TZ.Map.create((Math.random() * 0x7fffffff) | 0) };
      app.base = { x:TZ.Map.BASE.x, y:TZ.Map.BASE.y, hp:999999, maxHp:200, alive:true };
      startWave(app);
    } else {
      app.chapter = 0;
      app.map = { grid: TZ.Map.create((Math.random() * 0x7fffffff) | 0) };
      app.base = { x:TZ.Map.BASE.x, y:TZ.Map.BASE.y, hp:999999, maxHp:200, alive:true };
      app.bossKey = TZ.UI.selectedBoss;
      app.boss = new TZ.Boss(app.bossKey);
      app.bossSpawned = true;
      TZ.UI.setBanner('BOSS 来袭', 2000);
      }

    app.player = new TZ.Player(tankKey);
    TZ.Input.resetPointer();
    TZ.Input.clearPressed();
    document.getElementById('hud-avatar').src = TZ.Config.TANKS[tankKey].img;
    TZ.UI.hideAll();
    TZ.UI.showHud(true);
    }

  function buildLevel(app) {
    var isBoss = app.level === 4;
    app.waves = [];
    var waveCount = 2 + app.level;
    for (var w = 0; w < waveCount; w++) {
      app.waves.push({ queue:buildQueue(app.chapter, app.level, w), spawned:0, spawnT:0 });
    }
    app.bossSpawned = false;
    if (isBoss) app.bossKey = ['ironGolem', 'voltLord', 'doomFortress'][app.chapter];
    startWave(app);
  }

  function buildQueue(ch, level, wave) {
    var pool;
    if (ch === 0) pool = ['grunt', 'scout', 'defaultEnemy', 'scout', 'kamikaze'];
    else if (ch === 1) pool = ['grunt', 'scout', 'sniper', 'defaultEnemy', 'kamikaze', 'heavy'];
    else pool = ['defaultEnemy', 'heavy', 'sniper', 'elite', 'kamikaze', 'heavy', 'elite'];
    var enhanced = (ch * TZ.Config.LEVELS_PER_CHAPTER + level >= 5) ? ['enemyBlast', 'enemyLightning', 'enemyGuard'] : [];
    var count = 4 + level * 2 + wave * 2;
    if (level === 4) count = Math.max(3, count - 2);
    var q = [];
    for (var i = 0; i < count; i++) {
      if (enhanced.length && i % 4 === 3) q.push(TZ.u.choice(enhanced));
      else q.push(TZ.u.choice(pool));
    }
    return q;
  }

  function startWave(app) {
    if (app.mode === 'endless') {
      var pool = ['grunt', 'scout', 'defaultEnemy', 'kamikaze', 'sniper', 'heavy', 'elite', 'enemyBlast', 'enemyLightning', 'enemyGuard'];
      var count = 4 + app.wave * 2;
      var q = [];
      for (var i = 0; i < count; i++) {
        var poolSize = Math.min(pool.length, 3 + (app.wave / 2) | 0);
        q.push(pool[(Math.random() * poolSize) | 0]);
      }
      app.waveQueue = q;
      app.spawnT = 1.2;
      TZ.UI.setBanner('第 ' + (app.wave + 1) + ' 波', 1200);
    } else {
      var w = app.waves[app.wave];
      app.waveQueue = w.queue.slice();
      app.spawnT = 1.2;
      if (app.wave > 0) TZ.UI.setBanner('第 ' + (app.wave + 1) + ' 波', 1000);
    }
  }

  function loop(now) {
    if (!last) last = now;
    var dtms = Math.min(100, now - last);
    last = now;

    if (app && app.scene === 'playing') {
      if (TZ.Input.consume('KeyP') || TZ.Input.consume('Escape')) {
        app.paused = !app.paused;
        if (app.paused) TZ.UI.show('screen-pause');
        else TZ.UI.hide('screen-pause');
      }
      if (!app.paused) {
        acc += dtms;
        var step = 1000 / 60;
        while (acc >= step) {
          update(step / 1000);
          acc -= step;
        }
        if (acc > 200) acc = 0;
      }
    }
    draw();
    requestAnimationFrame(loop);
  }

  function update(dt) {
    app.time += dt;
    TZ.time = app.time;

    if (app.freeze > 0) app.freeze -= dt;

    if (app.player) app.player.update(dt, app);

    updateSpawning(dt);

    for (var i = app.enemies.length - 1; i >= 0; i--) {
      var e = app.enemies[i];
      if (!e.alive) { app.enemies.splice(i, 1); continue; }
      e.update(dt, app);
    }

    if (app.boss) app.boss.update(dt, app);

    for (var i = app.bullets.length - 1; i >= 0; i--) {
      var b = app.bullets[i];
      b.update(dt, app);
      if (b.dead) app.bullets.splice(i, 1);
    }
    for (var i = app.bullets.length - 1; i >= 0; i--) {
      var pb = app.bullets[i];
      if (pb.owner !== 'player' || pb.dead) continue;
      for (var j = app.bullets.length - 1; j >= 0; j--) {
        if (i === j) continue;
        var eb = app.bullets[j];
        if (eb.owner === 'player' || eb.dead) continue;
        if (TZ.u.dist(pb.x, pb.y, eb.x, eb.y) < pb.size + eb.size) {
          pb.dead = true;
          eb.dead = true;
          TZ.Particles.spawnHit((pb.x + eb.x) / 2, (pb.y + eb.y) / 2, '#ffd23f');
          break;
        }
      }
    }

    for (var i = app.items.length - 1; i >= 0; i--) {
      if (app.items[i].update(dt, app)) app.items.splice(i, 1);
    }

    for (var i = app.meteors.length - 1; i >= 0; i--) {
      var m = app.meteors[i];
      m.t -= dt;
      if (m.t <= 0) {
        TZ.Particles.spawnExplosion(m.x, m.y, '#ff2e4d', 30, 3);
        var p = app.player;
        if (p && p.alive && TZ.u.dist(m.x, m.y, p.x, p.y) < m.r) p.takeDamage(50);
        TZ.Particles.addShake(8);
        app.meteors.splice(i, 1);
      }
    }

    TZ.Particles.update(dt);
    updateWaveProgress();

    if (app && app.scene === 'playing') TZ.UI.updateHud(app);
  }

  function isEnhanced(key) {
    return key === 'enemyBlast' || key === 'enemyLightning' || key === 'enemyGuard';
  }

  function updateSpawning(dt) {
    if (app.spawnT > 0) { app.spawnT -= dt; return; }
    if (!app.waveQueue.length) return;
    var key = app.waveQueue.shift();
    if (isEnhanced(key)) {
      var defC = 0, enhC = 0;
      for (var i = 0; i < app.enemies.length; i++) {
        var k = app.enemies[i].kind;
        if (k === 'defaultEnemy') defC++;
        else if (isEnhanced(k)) enhC++;
      }
      if (enhC + 1 >= defC) key = 'defaultEnemy';
    }
    var pts = [
      [TZ.Config.TILE * 1.5, TZ.Config.TILE * 1.5],
      [TZ.Config.TILE * 9.5, TZ.Config.TILE * 0.8],
      [TZ.Config.TILE * 18.5, TZ.Config.TILE * 1.5]
    ];
    var pt = pts[(Math.random() * pts.length) | 0];
    app.enemies.push(new TZ.Enemy(key, pt[0], pt[1], app));
    app.spawnT = 0.9;
  }

  function updateWaveProgress() {
    if (app.mode === 'boss') {
      if (app.boss && !app.boss.alive) victory();
      return;
    }
    if (app.waveQueue.length > 0 || app.enemies.length > 0) return;

    if (app.mode === 'endless') {
      app.wave++;
      startWave(app);
      return;
    }

    if (app.wave < app.waves.length - 1) {
      app.wave++;
      startWave(app);
      return;
    }

    if (app.bossKey && !app.bossSpawned) {
      app.bossSpawned = true;
      app.boss = new TZ.Boss(app.bossKey);
      TZ.UI.setBanner('BOSS 来袭', 2000);
      return;
    }
    if (app.boss && app.boss.alive) return;

    victory();
  }

  function victory() {
    if (!app || app.scene !== 'playing') return;
    app.scene = 'victory';
    TZ.Particles.addShake(6);

    if (app.mode === 'adventure') {
      var ch = app.chapter, lv = app.level;
      app.replayAt = { chapter:ch, level:lv };
      if (lv === 4) TZ.Save.unlock(['blast', 'lightning', 'guard'][ch]);
      var nextCh = ch, nextLv = lv + 1;
      if (nextLv >= TZ.Config.LEVELS_PER_CHAPTER) { nextLv = 0; nextCh++; }
      if (nextCh >= TZ.Config.CHAPTERS) {
        app.gameComplete = true;
      } else {
        TZ.Save.advanceProgress(nextCh, nextLv);
        app.nextChapter = nextCh;
        app.nextLevel = nextLv;
      }
    }

    TZ.Save.addScore({ score:app.score, mode:app.mode, tank:TZ.Config.TANKS[app.tankKey].name, date:Date.now() });
    TZ.UI.showResult(true, app);
  }

  function defeat(reason) {
    if (!app || app.scene !== 'playing') return;
    app.scene = 'defeat';
    app.deathReason = reason;
    TZ.Save.addScore({ score:app.score, mode:app.mode, tank:TZ.Config.TANKS[app.tankKey].name, date:Date.now() });
    TZ.UI.showResult(false, app);
  }

  function restart() {
    var mode = app.mode, tankKey = app.tankKey;
    if (mode === 'adventure' && app.replayAt) {
      pendingStart = { chapter:app.replayAt.chapter, level:app.replayAt.level };
    }
    start(mode, tankKey);
  }

  function nextLevel() {
    if (app.gameComplete) { quit(); return; }
    pendingStart = { chapter:app.nextChapter, level:app.nextLevel };
    start('adventure', app.tankKey);
  }

  function startLevel(chapter, level, tankKey) {
    pendingStart = { chapter:chapter, level:level };
    start('adventure', tankKey || TZ.UI.selectedTank);
  }

  function pause(v) {
    if (!app || app.scene !== 'playing') return;
    app.paused = v;
    if (v) TZ.UI.show('screen-pause');
    else TZ.UI.hide('screen-pause');
  }

  function quit() {
    if (!app) return;
    app.scene = 'menu';
    TZ.UI.showHud(false);
    TZ.UI.show('screen-menu');
  }

  function draw() {
    var C = TZ.Config;
    ctx.clearRect(0, 0, C.W, C.H);

    var shx = 0, shy = 0;
    if (TZ.Particles.shake > 0) {
      shx = TZ.u.rand(-TZ.Particles.shake, TZ.Particles.shake);
      shy = TZ.u.rand(-TZ.Particles.shake, TZ.Particles.shake);
    }
    ctx.save();
    ctx.translate(shx, shy);
    drawBackground(ctx);

    var inGame = app && (app.scene === 'playing' || app.scene === 'paused' || app.scene === 'victory' || app.scene === 'defeat');

    if (inGame) {
      if (app.map) TZ.Map.draw(ctx, app.map.grid);

      for (var i = 0; i < app.items.length; i++) app.items[i].draw(ctx);
      for (var i = 0; i < app.enemies.length; i++) app.enemies[i].draw(ctx);
      if (app.boss && app.boss.alive) app.boss.draw(ctx);
      if (app.player && app.player.alive) app.player.draw(ctx);
      for (var i = 0; i < app.bullets.length; i++) app.bullets[i].draw(ctx);

      for (var i = 0; i < app.meteors.length; i++) {
        var m = app.meteors[i];
        if (Math.floor((TZ.time || 0) * 12) % 2 === 0) {
          ctx.strokeStyle = 'rgba(255,46,77,0.9)';
          ctx.lineWidth = 3;
          ctx.setLineDash([8, 6]);
          ctx.beginPath(); ctx.arc(m.x, m.y, m.r, 0, 7); ctx.stroke();
          ctx.setLineDash([]);
          ctx.fillStyle = 'rgba(255,46,77,0.25)';
          ctx.beginPath(); ctx.arc(m.x, m.y, m.r, 0, 7); ctx.fill();
        }
      }

      TZ.Particles.draw(ctx);

      if (app.freeze > 0) {
        ctx.fillStyle = 'rgba(120,180,255,0.12)';
        ctx.fillRect(0, 0, C.W, C.H);
      }
    } else {
      TZ.Particles.draw(ctx);
    }

    ctx.restore();
    drawTouchUI(ctx);
  }

  function drawTouchUI(ctx) {
    if (!app || app.scene !== 'playing') return;
    var joy = TZ.Input.joystick();
    if (joy.active) {
      ctx.strokeStyle = 'rgba(0,240,255,.45)';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(joy.ox, joy.oy, 30, 0, 7); ctx.stroke();
      ctx.fillStyle = 'rgba(0,240,255,.25)';
      ctx.strokeStyle = 'rgba(0,240,255,.7)';
      ctx.beginPath(); ctx.arc(joy.x, joy.y, 14, 0, 7); ctx.fill(); ctx.stroke();
    }
    var at = TZ.Input.aimTouch();
    if (at.active) {
      ctx.strokeStyle = 'rgba(255,210,63,.55)';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 6]);
      ctx.beginPath(); ctx.arc(at.x, at.y, 18, 0, 7); ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  function drawBackground(ctx) {
    var C = TZ.Config;
    ctx.fillStyle = '#0a0e17';
    ctx.fillRect(0, 0, C.W, C.H);
    ctx.strokeStyle = 'rgba(0,240,255,0.06)';
    ctx.lineWidth = 1;
    for (var x = 0; x <= C.W; x += C.TILE) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, C.H); ctx.stroke();
    }
    for (var y = 0; y <= C.H; y += C.TILE) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(C.W, y); ctx.stroke();
    }
    var g = ctx.createRadialGradient(C.W / 2, C.H / 2, 100, C.W / 2, C.H / 2, C.W * 0.7);
    g.addColorStop(0, 'rgba(0,240,255,0.05)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, C.W, C.H);
  }

  return {
    get app() { return app; },
    init: init,
    start: start,
    startLevel: startLevel,
    restart: restart,
    nextLevel: nextLevel,
    pause: pause,
    quit: quit,
    defeat: defeat,
    tick: function (dt) { update(dt); }
  };
})();

window.addEventListener('DOMContentLoaded', function () {
  TZ.Game.init();
});
