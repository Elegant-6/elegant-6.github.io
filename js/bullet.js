TZ.Bullet = function (o) {
  this.x = o.x; this.y = o.y; this.vx = o.vx; this.vy = o.vy;
  this.damage = o.damage;
  this.owner = o.owner;
  this.color = o.color || '#ffffff';
  this.size = o.size || 6;
  this.pierce = o.pierce || 0;
  this.splash = o.splash || 0;
  this.homing = o.homing || 0;
  this.life = o.life || 3;
  this.big = !!o.big;
  this.dead = false;
  this.trail = [];
};

TZ.Bullet.prototype.update = function (dt, app) {
  if (this.dead) return;
  var C = TZ.Config;
  this.life -= dt;
  if (this.life <= 0) { this.explode(app); this.dead = true; return; }

  if (this.homing > 0) {
    var target = (this.owner === 'player') ? app.boss : app.player;
    if (target && target.alive) {
      var want = Math.atan2(target.y - this.y, target.x - this.x);
      var cur = Math.atan2(this.vy, this.vx);
      var diff = want - cur;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      diff = TZ.u.clamp(diff, -this.homing * dt, this.homing * dt);
      var a = cur + diff;
      var sp = Math.hypot(this.vx, this.vy);
      this.vx = Math.cos(a) * sp;
      this.vy = Math.sin(a) * sp;
    }
  }

  this.x += this.vx * dt;
  this.y += this.vy * dt;
  this.trail.push({ x:this.x, y:this.y });
  if (this.trail.length > 7) this.trail.shift();

  if (this.x < 0 || this.y < 0 || this.x > C.W || this.y > C.H) { this.explode(app); this.dead = true; return; }

  var c = Math.floor(this.x / C.TILE), r = Math.floor(this.y / C.TILE);
  var hit = TZ.Map.bulletHit(app.map.grid, c, r);
  if (hit === 'brick' || hit === 'steel') {
    if (hit === 'brick') { app.map.grid[r][c] = 0; TZ.Particles.spawnText(this.x, this.y, '破坏', '#ffd23f'); }
    TZ.Particles.spawnHit(this.x, this.y, this.color);
    this.explode(app);
    this.dead = true;
    return;
  }
  if (hit === 'base') {
    this.explode(app);
    this.dead = true;
    this.hitBase(app);
    return;
  }

  var w = this.size;
  var box = { x:this.x - w, y:this.y - w, w:w * 2, h:w * 2 };

  if (this.owner === 'player') {
    for (var i = 0; i < app.enemies.length; i++) {
      var e = app.enemies[i];
      if (!e.alive || e.invincible > 0) continue;
      if (TZ.u.overlap(box, e.box())) {
        e.takeDamage(this.damage, app);
        if (this.pierce > 0) { this.pierce--; this.damage = Math.max(1, this.damage * 0.8); }
        else { this.dead = true; this.explode(app); }
        break;
      }
    }
    if (!this.dead && app.boss && app.boss.alive && TZ.u.overlap(box, app.boss.box())) {
      app.boss.takeDamage(this.damage);
      if (this.pierce > 0) { this.pierce--; this.damage = Math.max(1, this.damage * 0.8); }
      else { this.dead = true; this.explode(app); }
    }
  } else {
    var p = app.player;
    if (p && p.alive && p.invincible <= 0 && p.dash.t <= 0 && TZ.u.overlap(box, p.box())) {
      p.takeDamage(this.damage, 'enemy');
      this.dead = true;
      this.explode(app);
    }
  }
};

TZ.Bullet.prototype.hitBase = function (app) {
  if (!app.base || !app.base.alive) return;
  app.base.hp -= this.damage;
  TZ.Particles.spawnText(app.base.x, app.base.y - 20, '基地受损', '#ff2e4d');
  if (app.base.hp <= 0) {
    app.base.hp = 0;
    app.base.alive = false;
    TZ.Game.defeat('base');
  }
};

TZ.Bullet.prototype.explode = function (app) {
  if (this.splash > 0) {
    TZ.Particles.spawnExplosion(this.x, this.y, this.color, 24, 2);
    if (this.owner === 'player') {
      for (var i = 0; i < app.enemies.length; i++) {
        var e = app.enemies[i];
        if (!e.alive) continue;
        if (TZ.u.dist(this.x, this.y, e.x, e.y) <= this.splash + e.radius) e.takeDamage(this.damage, app);
      }
      if (app.boss && app.boss.alive && TZ.u.dist(this.x, this.y, app.boss.x, app.boss.y) <= this.splash + app.boss.size * 0.5) app.boss.takeDamage(this.damage);
    } else {
      var p = app.player;
      if (p && p.alive && TZ.u.dist(this.x, this.y, p.x, p.y) <= this.splash + 20) p.takeDamage(this.damage, 'enemy');
    }
  } else if (this.big) {
    TZ.Particles.spawnExplosion(this.x, this.y, this.color, 20, 1.6);
    } else {
    TZ.Particles.spawnHit(this.x, this.y, this.color);
  }
};

TZ.Bullet.prototype.draw = function (ctx) {
  var c = this.color;
  for (var i = 0; i < this.trail.length; i++) {
    var p = this.trail[i];
    ctx.globalAlpha = (i / this.trail.length) * 0.4;
    ctx.fillStyle = c;
    ctx.beginPath(); ctx.arc(p.x, p.y, this.size * 0.55, 0, 7); ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.save();
  ctx.shadowColor = c;
  ctx.shadowBlur = 10;
  ctx.fillStyle = c;
  ctx.beginPath(); ctx.arc(this.x, this.y, this.size, 0, 7); ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.arc(this.x, this.y, this.size * 0.45, 0, 7); ctx.fill();
  ctx.restore();
};
