TZ.UI = (function () {
  var $ = function (id) { return document.getElementById(id); };
  var screens = {};
  var selectedTank = 'default';
  var selectedBoss = 'ironGolem';
  var pendingMode = 'adventure';
  var bannerTimer = null;

  var SKILL_NAMES = {
    fan: '扇形扫射', ring: '环形弹幕', laser: '激光', charge: '冲撞',
    summon: '召唤', homing: '追踪导弹', meteor: '陨石轰炸'
  };

  function init() {
    var els = document.querySelectorAll('.screen');
    for (var i = 0; i < els.length; i++) screens[els[i].id] = els[i];

    var btns = document.querySelectorAll('[data-action]');
    for (var i = 0; i < btns.length; i++) {
      btns[i].addEventListener('click', function () {
                TZ.Audio.play('click');
        handle(this.getAttribute('data-action'));
      });
    }

    $('set-base').addEventListener('click', function () {
      TZ.Audio.play('click');
      TZ.Save.data.settings.baseDef = !TZ.Save.data.settings.baseDef;
      TZ.Save.save();
      refreshSettings();
          });

    $('set-music').addEventListener('click', function () {
      TZ.Audio.play('click');
      TZ.Save.data.settings.music = !(TZ.Save.data.settings.music !== false);
      TZ.Save.save();
      TZ.Audio.setMusic(TZ.Save.data.settings.music !== false);
      refreshSettings();
          });

    refreshSettings();
    TZ.Audio.setMusic(TZ.Save.data.settings.music !== false);
    buildTankCards();
    buildBossCards();
    show('screen-menu');
  }

  function handle(action) {
    switch (action) {
      case 'mode':
        show('screen-mode');
        break;
      case 'mode-adventure':
        pendingMode = 'adventure';
        buildTankCards();
        show('screen-select');
        break;
      case 'mode-endless':
        pendingMode = 'endless';
        buildTankCards();
        show('screen-select');
        break;
      case 'mode-boss':
        buildBossCards();
        show('screen-boss');
        break;
      case 'back-menu':
        show('screen-menu');
        break;
      case 'back-mode':
        show('screen-mode');
        break;
      case 'start':
        TZ.Game.start(pendingMode, selectedTank);
        break;
      case 'start-boss':
        TZ.Game.start('boss', selectedTank);
        break;
      case 'leaderboard':
        renderLeaderboard();
        show('screen-leaderboard');
        break;
      case 'upgrade':
        refreshUpgrade();
        show('screen-upgrade');
        break;
      case 'upgrade-do':
        if (TZ.Level.upgrade()) {
          TZ.Audio.play('item');
          setBanner('升级成功 · Lv ' + TZ.Level.get(), 1200);
          refreshUpgrade();
        } else {
          setBanner('金币不足或已达满级', 1200);
        }
        break;
      case 'settings':
        refreshSettings();
        show('screen-settings');
        break;
      case 'close-settings':
        show('screen-menu');
        break;
      case 'reset-save':
        TZ.Save.reset();
        refreshSettings();
        buildTankCards();
        buildBossCards();
        break;
      case 'resume':
        TZ.Game.pause(false);
        break;
      case 'restart':
        TZ.Game.restart();
        break;
      case 'next-level':
        TZ.Game.nextLevel();
        break;
      case 'quit':
        TZ.Game.quit();
        break;
    }
  }

  function show(id) {
    for (var k in screens) screens[k].classList.remove('active');
    if (screens[id]) screens[id].classList.add('active');
  }

  function hide(id) {
    if (screens[id]) screens[id].classList.remove('active');
  }

  function hideAll() {
    for (var k in screens) screens[k].classList.remove('active');
  }

  function showHud(v) {
    $('hud').classList.toggle('hidden', !v);
  }

  function setBanner(text, dur) {
    var b = $('banner');
    b.textContent = text;
    b.classList.add('show');
    clearTimeout(bannerTimer);
    if (dur) {
      bannerTimer = setTimeout(function () { b.classList.remove('show'); }, dur);
    }
  }

  function buildTankCards() {
    var wrap = $('tank-cards');
    wrap.innerHTML = '';
    var keys = ['default', 'blast', 'lightning', 'guard'];
    for (var i = 0; i < keys.length; i++) {
      (function (k) {
        var d = TZ.Config.TANKS[k];
        var unlocked = TZ.Save.isUnlocked(k);
        var el = document.createElement('div');
        el.className = 'tank-card' + (selectedTank === k ? ' selected' : '') + (unlocked ? '' : ' locked');
        el.innerHTML =
          '<img src="' + d.img + '" alt="' + d.name + '">' +
          '<div class="tank-name">' + d.name + '</div>' +
          '<div class="tank-type">' + d.type + '</div>' +
          (unlocked ? '' : '<div class="lock-tag">' + unlockHint(k) + '</div>');
        el.addEventListener('click', function () {
          if (!unlocked) { return; }
          selectedTank = k;
          buildTankCards();
        });
        wrap.appendChild(el);
      })(keys[i]);
    }
    renderTankDetail();
  }

  function unlockHint(k) {
    if (k === 'blast') return '通关第1章解锁';
    if (k === 'lightning') return '通关第2章解锁';
    return '通关第3章解锁';
  }

  function renderTankDetail() {
    var d = TZ.Config.TANKS[selectedTank];
    var el = $('tank-detail');
    el.innerHTML =
      '<div class="detail-name">' + d.name + '</div>' +
      '<div class="detail-desc">技能 · ' + d.skill.name + '：' + d.skill.desc + '</div>' +
      '<div class="detail-stats">' +
        stat('生命', d.hp, 220) +
        stat('火力', d.attack, 60) +
        stat('速度', d.speed, 300) +
        stat('射速', d.fireRate, 4) +
        stat('护甲', d.armor, 5) +
      '</div>';

    function stat(n, v, max) {
      var pct = Math.min(100, v / max * 100);
      return '<div class="stat-row"><span>' + n + '</span><div class="stat-bar"><div class="stat-fill" style="width:' + pct + '%"></div></div><span>' + v + '</span></div>';
    }
  }

  function buildBossCards() {
    var wrap = $('boss-cards');
    wrap.innerHTML = '';
    var keys = ['ironGolem', 'voltLord', 'doomFortress', 'bossTank'];
    for (var i = 0; i < keys.length; i++) {
      (function (k, idx) {
        var d = TZ.Config.BOSSES[k];
        var unlocked = idx === 3 ? TZ.Save.data.progress.chapter >= 2 : TZ.Save.data.progress.chapter >= idx;
        var el = document.createElement('div');
        el.className = 'boss-card' + (selectedBoss === k ? ' selected' : '') + (unlocked ? '' : ' locked');
        var skills = d.skills.map(function (s) { return SKILL_NAMES[s]; }).join(' / ');
        el.innerHTML =
          '<div class="boss-sigil" style="background:' + d.color + '"></div>' +
          '<div class="boss-name">' + d.name + '</div>' +
          '<div class="boss-meta">HP ' + d.hp + ' · 阶段 ' + d.phases + '</div>' +
          '<div class="boss-skills">' + skills + '</div>' +
          (unlocked ? '' : '<div class="lock-tag">' + (idx === 1 ? '通关第1章解锁' : (idx === 2 ? '通关第2章解锁' : '通关第3章解锁')) + '</div>');
        el.addEventListener('click', function () {
          if (!unlocked) { return; }
          selectedBoss = k;
          buildBossCards();
        });
        wrap.appendChild(el);
      })(keys[i], i);
    }
  }

  function renderLeaderboard() {
    var list = $('lb-list');
    var sc = TZ.Save.data.scores;
    list.innerHTML = '';
    if (!sc.length) {
      list.innerHTML = '<div class="lb-empty">暂无记录，快去创造战绩吧</div>';
      return;
    }
    for (var i = 0; i < sc.length; i++) {
      var s = sc[i];
      var div = document.createElement('div');
      div.className = 'lb-row' + (i < 3 ? ' top' : '');
      div.innerHTML =
        '<span class="lb-rank">' + (i + 1) + '</span>' +
        '<span>' + s.tank + '</span>' +
        '<span class="lb-mode">' + s.mode + '</span>' +
        '<span class="lb-score">' + s.score + '</span>';
      list.appendChild(div);
    }
  }

  function refreshSettings() {
    var s = TZ.Save.data.settings;
    var b = $('set-base');
    b.textContent = s.baseDef ? '开启' : '关闭';
    b.classList.toggle('on', !!s.baseDef);
    var m = $('set-music');
    var on = s.music !== false;
    m.textContent = on ? '开启' : '关闭';
    m.classList.toggle('on', on);
  }

  function refreshUpgrade() {
    var lv = TZ.Level.get();
    var bonus = Math.round((lv - 1) * 100);
    $('up-level').textContent = 'Lv ' + lv;
    $('up-gold').textContent = TZ.Level.gold();
    $('up-bonus').textContent = '+' + bonus + '%';
    if (lv >= TZ.Level.MAX) {
      $('up-cost').textContent = '已满级';
      $('upgrade-do').disabled = true;
    } else {
      $('up-cost').textContent = TZ.Level.cost(lv);
      $('upgrade-do').disabled = !TZ.Level.canUpgrade();
    }
  }

  function bind(el) {
    var btns = el.querySelectorAll('[data-action]');
    for (var i = 0; i < btns.length; i++) {
      btns[i].addEventListener('click', function () {
                TZ.Audio.play('click');
        handle(this.getAttribute('data-action'));
      });
    }
  }

  function updateHud(app) {
    if (app.scene !== 'playing') return;
    var p = app.player;
    if (!p) return;

    var hpPct = TZ.u.clamp(p.hp / p.maxHp * 100, 0, 100);
    $('hp-bar').style.width = hpPct + '%';
    $('hp-bar').style.background = hpPct > 30
      ? 'linear-gradient(90deg,#00ffb0,#00f0ff)'
      : 'linear-gradient(90deg,#ff2e4d,#ff8c3a)';
    $('shield-bar').style.width = TZ.u.clamp(p.shield / 80 * 100, 0, 100) + '%';
    $('shield-bar').style.opacity = p.shield > 0 ? 1 : 0.25;

    $('score').textContent = app.score;
    $('hud-level').textContent = 'Lv ' + TZ.Level.get();
    $('hud-gold').textContent = '金币 ' + TZ.Level.gold();
    var comboEl = $('combo');
    if (p.combo >= 2) {
      comboEl.textContent = 'COMBO ×' + p.combo;
      comboEl.classList.add('active');
    } else {
      comboEl.textContent = '';
      comboEl.classList.remove('active');
    }

    var wt = $('wave-info');
    if (app.mode === 'adventure') {
      wt.textContent = '第' + (app.chapter * TZ.Config.LEVELS_PER_CHAPTER + app.level + 1) + '关 · 波 ' + (app.wave + 1) + '/' + app.waves.length;
    } else if (app.mode === 'endless') {
      wt.textContent = '无尽模式 · 波 ' + (app.wave + 1);
    } else {
      wt.textContent = 'BOSS 挑战';
    }

    var bw = $('boss-bar-wrap');
    if (app.boss && app.boss.alive && (app.mode === 'boss' || !app.boss.intro)) {
      bw.style.display = 'block';
      $('boss-bar').style.width = TZ.u.clamp(app.boss.hp / app.boss.maxHp * 100, 0, 100) + '%';
      $('boss-name').textContent = app.boss.name + ' · 阶段 ' + app.boss.phase;
    } else {
      bw.style.display = 'none';
    }

    var skill = TZ.Config.TANKS[app.tankKey].skill;
    $('skill-name').textContent = skill.name;
    var cd = TZ.u.clamp(p.skillCd / skill.cooldown, 0, 1);
    $('skill-cd').style.height = (cd * 100) + '%';
    $('skill-cd').style.opacity = cd > 0 ? 0.75 : 0;
    $('skill-box').classList.toggle('ready', p.skillCd <= 0);
    $('skill-icon').style.background = 'radial-gradient(circle,' + TZ.Config.TANKS[app.tankKey].color + '33,#081018)';
    var ts = $('touch-skill');
    if (ts) ts.classList.toggle('ready', p.skillCd <= 0);

    var chips = [];
    if (p.effects.speed > 0) chips.push({ key:'speed', t:p.effects.speed });
    if (p.effects.double > 0) chips.push({ key:'double', t:p.effects.double });
    if (p.effects.pierce > 0) chips.push({ key:'pierce', t:p.effects.pierce });
    if (p.shield > 0) chips.push({ key:'shield', t:p.shieldTimer });
    if (app.freeze > 0) chips.push({ key:'freeze', t:app.freeze });
    var fx = $('effects-box');
    if (chips.length) {
      fx.innerHTML = chips.map(function (c) {
        var d = TZ.Config.ITEMS[c.key];
        return '<span class="chip" style="border-color:' + d.color + ';color:' + d.color + '">' + d.sym + ' ' + Math.ceil(c.t) + 's</span>';
      }).join('');
    } else {
      fx.innerHTML = '';
    }

    drawMinimap(app);
  }

  function drawMinimap(app) {
    var mc = $('minimap');
    var m = mc.getContext('2d');
    var C = TZ.Config;
    var s = 140 / C.COLS;
    m.clearRect(0, 0, 140, 140);
    for (var r = 0; r < C.ROWS; r++) {
      for (var c = 0; c < C.COLS; c++) {
        var v = app.map.grid[r][c];
        if (v === 1) { m.fillStyle = 'rgba(255,160,80,.7)'; m.fillRect(c * s, r * s, s, s); }
        else if (v === 2) { m.fillStyle = 'rgba(150,160,180,.8)'; m.fillRect(c * s, r * s, s, s); }
        else if (v === 3) { m.fillStyle = '#ffd23f'; m.fillRect(c * s, r * s, s, s); }
      }
    }
    var p = app.player;
    if (p && p.alive) {
      m.fillStyle = TZ.Config.TANKS[app.tankKey].color;
      m.beginPath(); m.arc(p.x / C.TILE * s, p.y / C.TILE * s, 3.5, 0, 7); m.fill();
    }
    for (var i = 0; i < app.enemies.length; i++) {
      var e = app.enemies[i];
      if (!e.alive) continue;
      m.fillStyle = '#ff2e4d';
      m.fillRect(e.x / C.TILE * s - 2, e.y / C.TILE * s - 2, 4, 4);
    }
    if (app.boss && app.boss.alive) {
      m.fillStyle = '#ff2e4d';
      m.beginPath(); m.arc(app.boss.x / C.TILE * s, app.boss.y / C.TILE * s, 6, 0, 7); m.fill();
    }
  }

  function showResult(win, app) {
    TZ.Audio.play(win ? 'victory' : 'defeat');
    var title = $('result-title');
    title.textContent = win ? (app.mode === 'adventure' ? '关卡通关' : '挑战成功') : '任务失败';
    title.className = win ? 'win' : 'lose';

    var stars = $('result-stars');
    stars.innerHTML = '';
    if (win && app.mode === 'adventure') {
      var st = computeStars(app);
      for (var i = 0; i < 3; i++) {
        stars.innerHTML += '<span class="star' + (i < st ? ' on' : '') + '">★</span>';
      }
    }

    $('result-stats').innerHTML =
      '<span>得分 ' + app.score + '</span>' +
      '<span>击杀 ' + app.player.kills + '</span>' +
      '<span>金币 +' + (app.goldEarned || 0) + '</span>' +
      '<span>最高连击 ×' + app.player.maxCombo + '</span>';

    var btns = $('result-btns');
    btns.innerHTML = '';
    if (win && app.mode === 'adventure') {
      if (app.gameComplete) {
        btns.innerHTML = '<button class="btn primary" data-action="quit">返回主菜单</button>';
      } else {
        btns.innerHTML =
          '<button class="btn primary" data-action="next-level">下一关</button>' +
          '<button class="btn" data-action="restart">重试</button>' +
          '<button class="btn ghost" data-action="quit">主菜单</button>';
      }
    } else {
      btns.innerHTML =
        '<button class="btn primary" data-action="restart">再来一次</button>' +
        '<button class="btn" data-action="quit">返回主菜单</button>';
    }
    bind(btns);
    show('screen-result');
  }

  function computeStars(app) {
    var p = app.player;
    var ratio = p.hp / p.maxHp;
    var baseOk = app.base ? app.base.hp >= app.base.maxHp : true;
    if (ratio > 0.7 && baseOk) return 3;
    if (ratio > 0.4) return 2;
    return 1;
  }

  return {
    init: init,
    show: show,
    hide: hide,
    hideAll: hideAll,
    showHud: showHud,
    setBanner: setBanner,
    updateHud: updateHud,
    showResult: showResult,
    buildTankCards: buildTankCards,
    buildBossCards: buildBossCards,
    get selectedTank() { return selectedTank; },
    get selectedBoss() { return selectedBoss; }
  };
})();
