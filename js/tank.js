function Tank(x, y, w, h) {
  this.x = x; this.y = y; this.w = w; this.h = h;
  this.dir = { x:0, y:-1 };
  this.alive = true;
  this.invincible = 0;
}

Tank.prototype.box = function () {
  return { x:this.x - this.w / 2, y:this.y - this.h / 2, w:this.w, h:this.h };
};

Tank.prototype.canMoveTo = function (g, x, y) {
  var C = TZ.Config;
  var hw = this.w / 2, hh = this.h / 2;
  var cs = [[x - hw + 1, y - hh + 1], [x + hw - 1, y - hh + 1], [x - hw + 1, y + hh - 1], [x + hw - 1, y + hh - 1]];
  for (var i = 0; i < 4; i++) {
    var c = Math.floor(cs[i][0] / C.TILE), r = Math.floor(cs[i][1] / C.TILE);
    if (TZ.Map.solidAt(g, c, r)) return false;
  }
  var x1 = TZ.u.clamp(x - hw, 0, C.W), y1 = TZ.u.clamp(y - hh, 0, C.H);
  var x2 = TZ.u.clamp(x + hw, 0, C.W), y2 = TZ.u.clamp(y + hh, 0, C.H);
  return x2 - x1 >= this.w && y2 - y1 >= this.h;
};

Tank.prototype.slideMove = function (g, vx, vy) {
  if (this.canMoveTo(g, this.x + vx, this.y)) this.x += vx;
  if (this.canMoveTo(g, this.x, this.y + vy)) this.y += vy;
};

TZ.Player = Player;
TZ.Enemy = Enemy;

var DIRS4 = [{ x:0, y:-1 }, { x:0, y:1 }, { x:-1, y:0 }, { x:1, y:0 }];

function drawGeomTank(ctx, color) {
  ctx.fillStyle = 'rgba(0,0,0,.35)';
  TZ.u.roundRect(ctx, -22, -22, 44, 44, 6); ctx.fill();
  ctx.fillStyle = color;
  TZ.u.roundRect(ctx, -20, -20, 40, 40, 6); ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,.28)';
  ctx.fillRect(-20, -20, 40, 9);
  ctx.fillRect(-20, 11, 40, 9);
  ctx.fillStyle = '#eaffff';
  ctx.beginPath(); ctx.arc(0, 0, 11, 0, 7); ctx.fill();
  ctx.fillStyle = color;
  ctx.fillRect(0, -7, 22, 14);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.arc(0, 0, 5, 0, 7); ctx.fill();
}

function Player(key) {
  var d = TZ.Config.TANKS[key];
  Tank.call(this, TZ.Config.TILE * 9.5, TZ.Config.TILE * 17.5, 40, 40);
  this.key = key;
  this.name = d.name;
  this.color = d.color;
  this.img = TZ.Images[key];
  this.maxHp = d.hp; this.hp = d.hp;
  this.speed = d.speed;
  this.attack = d.attack;
  this.fireRate = d.fireRate;
  this.bulletSpeed = d.bulletSpeed;
  this.armor = d.armor;
  this.fireLevel = 1;
  this.effects = { double:0, pierce:0, speed:0 };
  this.shield = 0; this.shieldTimer = 0;
  this.skillCd = 0;
  this.triplePending = false;
  this.dash = { t:0, dir:null };
  this.combo = 0; this.comboTimer = 0; this.maxCombo = 0; this.kills = 0;
  this.fireCd = 0;
}
Player.prototype = Object.create(Tank.prototype);

Player.prototype.update = function (dt, app) {
  if (!this.alive) return;
  var inp = TZ.Input.axis();
  var m = TZ.Input.mouse();
  var at = TZ.Input.aimTouch();
  if (at.active) {
    var adx = at.x - this.x, ady = at.y - this.y;
    if (adx || ady) this.dir = { x:adx, y:ady };
  } else if (m.present) {
    var mdx = m.x - this.x, mdy = m.y - this.y;
    if (mdx || mdy) this.dir = { x:mdx, y:mdy };
  } else if (inp.pressing) {
    this.dir = { x:inp.x, y:inp.y };
  }

  var spd = this.speed;
  if (this.effects.speed > 0) spd *= 1.4;
  if (this.dash.t > 0) spd = 950;

  this.slideMove(app.map.grid, inp.x * spd * dt, inp.y * spd * dt);

  this.fireCd -= dt;
  this.skillCd -= dt;
  if (this.effects.double > 0) this.effects.double -= dt;
  if (this.effects.pierce > 0) this.effects.pierce -= dt;
  if (this.effects.speed > 0) this.effects.speed -= dt;
  if (this.shieldTimer > 0) { this.shieldTimer -= dt; if (this.shieldTimer <= 0) this.shield = 0; }

  if (this.dash.t > 0) {
    this.dash.t -= dt;
    for (var i = 0; i < app.enemies.length; i++) {
      var e = app.enemies[i];
      if (!e.alive) continue;
      if (TZ.u.dist(this.x, this.y, e.x, e.y) < 46) {
        e.takeDamage(60, app);
        TZ.Particles.spawnHit(e.x, e.y, this.color);
      }
    }
  }

  if (this.comboTimer > 0) { this.comboTimer -= dt; if (this.comboTimer <= 0) this.combo = 0; }

  if (TZ.Input.fire() && this.fireCd <= 0) this.fire(app);
  if (TZ.Input.skill() && this.skillCd <= 0 && this.dash.t <= 0) this.useSkill(app);
};

Player.prototype.fire = function (app) {
  this.fireCd = 1 / this.fireRate;
  var d = this.dir;
  var count = this.fireLevel >= 5 ? 3 : (this.fireLevel >= 3 ? 2 : 1);
  if (this.effects.double > 0) count *= 2;
  if (this.triplePending) { count = 3; this.triplePending = false; }

  var base = Math.atan2(d.x, -d.y);
  for (var i = 0; i < count; i++) {
    var a = base + (i - (count - 1) / 2) * 0.14;
    var vx = Math.sin(a) * this.bulletSpeed, vy = -Math.cos(a) * this.bulletSpeed;
    var isBlast = this.key === 'blast';
    app.bullets.push(new TZ.Bullet({
      x:this.x + vx * 0.03, y:this.y + vy * 0.03,
      vx:vx, vy:vy,
      damage:this.attack, owner:'player', color:this.color,
      splash:isBlast ? 64 : 0, size:isBlast ? 9 : 6,
      pierce:this.effects.pierce > 0 ? 99 : 0,
      big:isBlast
    }));
  }
  TZ.Particles.spawnMuzzle(this.x + Math.sin(base) * 24, this.y - Math.cos(base) * 24, base, this.color);
  TZ.Audio.play('playerFire');
};

Player.prototype.useSkill = function (app) {
  var s = TZ.Config.TANKS[this.key].skill;
  this.skillCd = s.cooldown;
  switch (s.key) {
    case 'triple':
      this.triplePending = true;
      break;
    case 'nuke': {
      var base = Math.atan2(this.dir.x, -this.dir.y);
      app.bullets.push(new TZ.Bullet({
        x:this.x, y:this.y,
        vx:Math.sin(base) * 380, vy:-Math.cos(base) * 380,
        damage:120, owner:'player', color:'#ff2e4d',
        splash:150, size:15, big:true, life:2
      }));
      break;
    }
    case 'dash':
      this.dash.t = 0.16;
      break;
    case 'shield':
      this.shield = Math.max(this.shield, 80);
      this.shieldTimer = 10;
      break;
  }
  TZ.Audio.play(s.key);
};

Player.prototype.takeDamage = function (dmg) {
  if (!this.alive || this.invincible > 0 || this.dash.t > 0) return;
  if (this.shield > 0) {
    this.shield -= dmg;
    if (this.shield < 0) this.shield = 0;
    TZ.Particles.spawnText(this.x, this.y - 26, '护盾-' + Math.round(dmg), '#00f0ff');
    return;
  }
  var d = dmg - this.armor;
  if (d < 1) d = 1;
  this.hp -= d;
  TZ.Particles.spawnHit(this.x, this.y, '#ff2e4d');
  TZ.Particles.spawnText(this.x, this.y - 26, '-' + Math.round(d), '#ff5a5a');
  TZ.Particles.addShake(5);
  if (this.hp <= 0) {
    this.hp = 0;
    this.alive = false;
    TZ.Particles.spawnExplosion(this.x, this.y, this.color, 40, 3);
    TZ.Audio.play('boom');
    TZ.Game.defeat('player');
  }
};

Player.prototype.addScore = function (n) {
  this.combo = (this.comboTimer > 0) ? Math.min(this.combo + 1, 10) : 1;
  this.comboTimer = 3;
  this.maxCombo = Math.max(this.maxCombo, this.combo);
  TZ.Game.app.score += n * this.combo;
};

Player.prototype.draw = function (ctx) {
  if (!this.alive) return;
  var ang = Math.atan2(this.dir.x, -this.dir.y);
  ctx.save();
  ctx.translate(this.x, this.y);
  ctx.rotate(ang);
  if (this.img && this.img.complete && this.img.naturalWidth > 0) {
    ctx.drawImage(this.img, -24, -24, 48, 48);
  } else {
    drawGeomTank(ctx, this.color);
  }
  ctx.restore();

  if (this.dash.t > 0) {
    ctx.save();
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = this.color;
    ctx.beginPath(); ctx.arc(this.x, this.y, 32, 0, 7); ctx.fill();
    ctx.restore();
  }
  if (this.shield > 0) {
    var t = TZ.time || 0;
    ctx.save();
    ctx.strokeStyle = 'rgba(0,240,255,0.85)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(this.x, this.y, 34 + Math.sin(t * 6) * 3, 0, 7); ctx.stroke();
    ctx.globalAlpha = 0.14;
    ctx.fillStyle = '#00f0ff';
    ctx.beginPath(); ctx.arc(this.x, this.y, 34, 0, 7); ctx.fill();
    ctx.restore();
  }
};

function Enemy(key, x, y, app) {
  var d = TZ.Config.ENEMIES[key];
  var r = d.radius;
  Tank.call(this, x, y, r * 2, r * 2);
  this.kind = key;
  this.color = d.color;
  this.radius = r;
  this.hp = d.hp; this.maxHp = d.hp;
  this.speed = d.speed;
  this.attack = d.attack;
  this.bulletSpeed = d.bulletSpeed;
  this.shoot = d.shoot;
  this.scoreVal = d.score;
  this.armor = d.armor || 0;
  this.img = d.img ? TZ.Images['E_' + key] : null;
  this.invincible = 1.1;
  this.shootCd = TZ.u.rand(0.8, 2);
  this.moveDir = null;
  this.decideT = 0;
  this.stuckT = 0.3;
  this.targetBase = app.mode === 'adventure' && app.baseDef &&
    (key === 'grunt' || key === 'heavy' || key === 'kamikaze') && Math.random() < 0.25;
}
Enemy.prototype = Object.create(Tank.prototype);

Enemy.prototype.chooseDir = function (g, vec) {
  var best = null, bestScore = -2;
  for (var i = 0; i < DIRS4.length; i++) {
    var d = DIRS4[i];
    var score = d.x * vec.x + d.y * vec.y;
    if (score > bestScore && this.canMoveTo(g, this.x + d.x * this.speed * 0.15, this.y + d.y * this.speed * 0.15)) {
      bestScore = score;
      best = d;
    }
  }
  return best;
};

Enemy.prototype.update = function (dt, app) {
  if (!this.alive) return;
  if (this.invincible > 0) this.invincible -= dt;
  if (app.freeze > 0) return;

  var p = app.player;
  if (!p || !p.alive) return;

  var tx = p.x, ty = p.y;
  if (this.targetBase && app.base && app.base.alive) { tx = app.base.x; ty = app.base.y; }
  var dx = tx - this.x, dy = ty - this.y;
  var dist = Math.hypot(dx, dy) || 1;

  var vec = null;
  if (this.kind === 'scout') {
    vec = { x:dx / dist, y:dy / dist };
  } else if (this.kind === 'kamikaze') {
    vec = { x:dx / dist, y:dy / dist };
    if (dist < 48) { this.explode(app); return; }
  } else if (this.kind === 'sniper') {
    if (dist > 380) vec = { x:dx / dist, y:dy / dist };
    else if (dist < 230) vec = { x:-dx / dist, y:-dy / dist };
  } else {
    vec = { x:dx / dist, y:dy / dist };
  }

  var blocked = this.moveDir && !this.canMoveTo(app.map.grid,
    this.x + this.moveDir.x * this.speed * 0.1,
    this.y + this.moveDir.y * this.speed * 0.1);
  if (blocked) this.decideT = 0;
  this.decideT -= dt;
  if (this.decideT <= 0) {
    var d = null;
    if (vec) d = this.chooseDir(app.map.grid, vec);
    if (!d) {
      for (var i = 0; i < DIRS4.length; i++) {
        var q = DIRS4[i];
        if (this.canMoveTo(app.map.grid, this.x + q.x * this.speed * 0.15, this.y + q.y * this.speed * 0.15)) { d = q; break; }
      }
    }
    if (d) this.moveDir = d;
    if (this.kind === 'elite' && Math.random() < 0.12) this.moveDir = TZ.u.choice(DIRS4);
    this.decideT = TZ.u.rand(0.12, 0.28);
  }
  if (this.moveDir) {
    var px = this.x, py = this.y;
    this.dir = this.moveDir;
    this.slideMove(app.map.grid, this.moveDir.x * this.speed * dt, this.moveDir.y * this.speed * dt);
    if (this.x === px && this.y === py) {
      this.stuckT -= dt;
      if (this.stuckT <= 0) { this.decideT = 0; this.stuckT = 0.3; }
    } else {
      this.stuckT = 0.3;
    }
  }

  this.shootCd -= dt;
  if (this.shoot && this.shootCd <= 0 && dist < 560) {
    if (this.kind === 'sniper') this.shootCd = 1.7;
    else if (this.kind === 'heavy') this.shootCd = TZ.u.rand(1.5, 2.1);
    else this.shootCd = TZ.u.rand(0.9, 1.5);
    var a = Math.atan2(dy, dx);
    app.bullets.push(new TZ.Bullet({
      x:this.x, y:this.y,
      vx:Math.cos(a) * this.bulletSpeed, vy:Math.sin(a) * this.bulletSpeed,
      damage:this.attack, owner:'enemy', color:this.color, size:7,
      splash:this.kind === 'enemyBlast' ? 46 : 0
    }));
    TZ.Audio.play('fire');
  }

  if (dist < this.radius + p.w * 0.5) {
    p.takeDamage(this.attack);
    this.shootCd += 1;
  }
};

Enemy.prototype.explode = function (app) {
  var p = app.player;
  if (p && p.alive && TZ.u.dist(this.x, this.y, p.x, p.y) < 70) p.takeDamage(this.attack);
  if (app.base && app.base.alive && TZ.u.dist(this.x, this.y, app.base.x, app.base.y) < 70) {
    app.base.hp -= 30;
    TZ.Particles.spawnText(app.base.x, app.base.y - 20, '基地受损', '#ff2e4d');
    if (app.base.hp <= 0) {
      app.base.hp = 0;
      app.base.alive = false;
      TZ.Game.defeat('base');
    }
  }
  this.die(app, true);
};

Enemy.prototype.takeDamage = function (dmg, app) {
  if (!this.alive || this.invincible > 0) return;
  var d = this.armor > 0 ? Math.max(1, dmg - this.armor) : dmg;
  this.hp -= d;
  TZ.Particles.spawnHit(this.x, this.y, this.color);
  TZ.Particles.spawnText(this.x, this.y - this.radius - 6, '-' + Math.round(d), '#ffffff');
  if (this.hp <= 0) this.die(app, false);
};

Enemy.prototype.die = function (app, silent) {
  this.alive = false;
  TZ.Particles.spawnExplosion(this.x, this.y, this.color, 26, 2.2);
  TZ.Particles.addShake(4);
  TZ.Audio.play('boom');
  if (app.player) {
    app.player.addScore(this.scoreVal);
    app.player.kills++;
  }
  if (!silent && app.player && app.player.alive && Math.random() < 0.2) this.dropItem(app);
};

Enemy.prototype.dropItem = function (app) {
  var keys = Object.keys(TZ.Config.ITEMS);
  var w = [18, 10, 14, 8, 8, 8, 7, 5];
  var total = 0;
  for (var i = 0; i < w.length; i++) total += w[i];
  var roll = Math.random() * total, acc = 0, pick = keys[0];
  for (var i = 0; i < keys.length; i++) {
    acc += w[i];
    if (roll < acc) { pick = keys[i]; break; }
  }
  app.items.push(new TZ.Item(this.x, this.y, pick));
};

Enemy.prototype.draw = function (ctx) {
  if (!this.alive) return;
  if (this.invincible > 0 && Math.floor((TZ.time || 0) * 20) % 2 === 0) ctx.globalAlpha = 0.4;

  var ang = Math.atan2(this.dir.x, -this.dir.y);
  var r = this.radius;
  ctx.save();
  ctx.translate(this.x, this.y);
  ctx.rotate(ang);

  if (this.img && this.img.complete && this.img.naturalWidth > 0) {
    ctx.drawImage(this.img, -r, -r, r * 2, r * 2);
    ctx.restore();
    ctx.globalAlpha = 1;

    if (this.targetBase) {
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(ang);
      ctx.fillStyle = '#ffd23f';
      ctx.beginPath(); ctx.arc(r * 0.4, -r * 0.4, 3, 0, 7); ctx.fill();
      ctx.restore();
    }
    if (TZ.Game.app && TZ.Game.app.freeze > 0) {
      ctx.save();
      ctx.globalAlpha = 0.45;
      ctx.strokeStyle = '#aee3ff';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(this.x, this.y, r + 4, 0, 7); ctx.stroke();
      ctx.restore();
    }
    return;
  }

  ctx.fillStyle = 'rgba(0,0,0,.4)';
  ctx.fillRect(-r - 2, -r, 6, r * 2);
  ctx.fillRect(r - 4, -r, 6, r * 2);
  ctx.fillStyle = this.color;
  TZ.u.roundRect(ctx, -r, -r, r * 2, r * 2, 4); ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,.25)';
  ctx.fillRect(-r, -r, r * 2, 5);
  ctx.fillRect(-r, r - 5, r * 2, 5);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.arc(0, 0, r * 0.42, 0, 7); ctx.fill();
  ctx.fillStyle = this.color;
  ctx.fillRect(0, -5, r + 6, 10);

  if (this.targetBase) {
    ctx.fillStyle = '#ffd23f';
    ctx.beginPath(); ctx.arc(r * 0.4, -r * 0.4, 3, 0, 7); ctx.fill();
  }
  ctx.restore();
  ctx.globalAlpha = 1;

  if (TZ.Game.app && TZ.Game.app.freeze > 0) {
    ctx.save();
    ctx.globalAlpha = 0.45;
    ctx.strokeStyle = '#aee3ff';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(this.x, this.y, r + 4, 0, 7); ctx.stroke();
    ctx.restore();
  }
};
