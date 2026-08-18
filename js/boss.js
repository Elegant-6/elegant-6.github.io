TZ.Boss = function (key) {
  var d = TZ.Config.BOSSES[key];
  this.key = key;
  this.name = d.name;
  this.color = d.color;
  this.size = d.size;
  this.phases = d.phases;
  this.phase = 1;
  this.maxHp = d.hp;
  this.hp = d.hp;
  this.speed = d.speed;
  this.attack = 40;
  this.armor = d.armor || 0;
  this.img = d.img ? TZ.Images['B_' + key] : null;
  this.x = TZ.Config.W / 2;
  this.y = -80;
  this.targetY = 130;
  this.intro = true;
  this.invincible = 2;
  this.alive = true;
  this.dir = { x:0, y:1 };
  this.rot = 0;
  this.skillCd = 2.5;
  this.cast = null;
  this.radius = this.size * 0.5;
  this.skills = d.skills.slice();
};

TZ.Boss.prototype.box = function () {
  return { x:this.x - this.size / 2, y:this.y - this.size / 2, w:this.size, h:this.size };
};

TZ.Boss.prototype.takeDamage = function (dmg) {
  if (!this.alive || this.invincible > 0) return;
  var dmg2 = this.armor > 0 ? Math.max(1, dmg - this.armor) : dmg;
  this.hp -= dmg2;
  TZ.Particles.spawnHit(this.x + TZ.u.rand(-40, 40), this.y + TZ.u.rand(-40, 40), this.color);
  TZ.Particles.spawnText(this.x, this.y - this.size * 0.8, '-' + Math.round(dmg2), '#ffd23f');
  var thresh = this.maxHp * (1 - this.phase / this.phases);
  if (this.hp <= thresh && this.phase < this.phases) {
    this.phase++;
    this.invincible = 1.5;
    this.skillCd = 1.2;
    TZ.Particles.spawnExplosion(this.x, this.y, this.color, 40, 3);
    TZ.Particles.spawnText(this.x, this.y - this.size, '警告！阶段 ' + this.phase, '#ff2e4d');
    TZ.Audio.play('warn');
  }
  if (this.hp <= 0) {
    this.hp = 0;
    this.die();
  }
};

TZ.Boss.prototype.die = function () {
  this.alive = false;
  TZ.Particles.spawnExplosion(this.x, this.y, this.color, 60, 4);
  TZ.Particles.addShake(16);
  TZ.Audio.play('nuke');
};

TZ.Boss.prototype.update = function (dt, app) {
  if (!this.alive) return;
  if (this.invincible > 0) this.invincible -= dt;
  this.rot += dt * 0.8;

  if (this.intro) {
    this.y += (this.targetY - this.y) * dt * 2;
    if (this.y > this.targetY - 1) { this.y = this.targetY; this.intro = false; }
    return;
  }

  var p = app.player;
  if (p && p.alive) {
    var dx = p.x - this.x, dy = p.y - this.y;
    var l = Math.hypot(dx, dy) || 1;
    this.dir = { x:dx / l, y:dy / l };

    var toP = Math.atan2(dy, dx);
    var side = Math.sin(this.rot * 1.3 + 1.0);
    this.x += Math.cos(toP + Math.PI / 2 * side) * this.speed * dt;
    this.y += Math.sin(toP + Math.PI / 2 * side) * this.speed * dt;
  }
  this.x = TZ.u.clamp(this.x, 60, TZ.Config.W - 60);
  this.y = TZ.u.clamp(this.y, 80, TZ.Config.H * 0.45);

  if (this.cast) { this.runCast(dt, app); return; }
  this.skillCd -= dt;
  if (this.skillCd <= 0 && p && p.alive) this.startCast(app);
};

TZ.Boss.prototype.startCast = function (app) {
  var pool = this.skills.slice(0, Math.min(this.skills.length, this.phase + 1));
  var s = pool[(Math.random() * pool.length) | 0];
  var p = app.player;
  var ang = Math.atan2(p.y - this.y, p.x - this.x);
  switch (s) {
    case 'fan':     this.cast = { type:'fan', ang:ang }; this.fireFan(app); this.skillCd = 4.5; break;
    case 'ring':    this.cast = { type:'ring' }; this.fireRing(app); this.skillCd = 5; break;
    case 'homing':  this.cast = { type:'homing' }; this.fireHoming(app); this.skillCd = 6; break;
    case 'laser':   this.cast = { type:'laser', t:0.7, ang:ang, beam:0 }; TZ.Audio.play('warn'); this.skillCd = 7; break;
    case 'charge':  this.cast = { type:'charge', phase:'wind', t:0.7, ang:ang }; this.skillCd = 6; break;
    case 'summon':  this.cast = { type:'summon' }; this.fireSummon(app); this.skillCd = 7; break;
    case 'meteor':  this.cast = { type:'meteor' }; this.fireMeteor(app); this.skillCd = 7; break;
  }
};

TZ.Boss.prototype.fireFan = function (app) {
  var n = 7 + this.phase * 2;
  for (var i = 0; i < n; i++) {
    var a = this.cast.ang + (i - (n - 1) / 2) * 0.22;
    app.bullets.push(new TZ.Bullet({
      x:this.x, y:this.y, vx:Math.cos(a) * 330, vy:Math.sin(a) * 330,
      damage:20 + this.phase * 5, owner:'boss', color:'#ff8c3a', size:8
    }));
  }
};

TZ.Boss.prototype.fireRing = function (app) {
  var n = 20 + this.phase * 4;
  for (var i = 0; i < n; i++) {
    var a = i / n * Math.PI * 2;
    app.bullets.push(new TZ.Bullet({
      x:this.x, y:this.y, vx:Math.cos(a) * 260, vy:Math.sin(a) * 260,
      damage:15 + this.phase * 5, owner:'boss', color:'#ffd23f', size:7
    }));
  }
};

TZ.Boss.prototype.fireHoming = function (app) {
  var ang = Math.atan2(app.player.y - this.y, app.player.x - this.x);
  for (var i = 0; i < 3; i++) {
    var a = ang + (i - 1) * 0.5;
    app.bullets.push(new TZ.Bullet({
      x:this.x + Math.cos(a) * 40, y:this.y + Math.sin(a) * 40,
      vx:Math.cos(a) * 300, vy:Math.sin(a) * 300,
      damage:25 + this.phase * 5, owner:'boss', color:'#ff2e4d', size:9, homing:2.6, life:4
    }));
  }
};

TZ.Boss.prototype.fireSummon = function (app) {
  for (var i = 0; i < 3; i++) {
    app.enemies.push(new TZ.Enemy('grunt', this.x + TZ.u.rand(-60, 60), this.y + 40, app));
  }
};

TZ.Boss.prototype.fireMeteor = function (app) {
  for (var i = 0; i < 5; i++) {
    var x = TZ.u.rand(80, TZ.Config.W - 80);
    var y = TZ.u.rand(80, TZ.Config.H - 160);
    if (app.player && TZ.u.dist(x, y, app.player.x, app.player.y) < 130) x = TZ.u.rand(80, TZ.Config.W - 80);
    app.meteors.push({ x:x, y:y, t:0.9, r:40 });
  }
};

TZ.Boss.prototype.runCast = function (dt, app) {
  var c = this.cast;
  if (c.type === 'laser') {
    c.t -= dt;
    if (c.t <= 0 && c.beam === 0) {
      c.beam = 1.2;
      c.t = 1.2;
      TZ.Audio.play('laser');
    }
    if (c.beam > 0 && c.t > 0) {
      var p = app.player;
      if (p && p.alive) {
        var rx = Math.cos(c.ang), ry = Math.sin(c.ang);
        var px = p.x - this.x, py = p.y - this.y;
        var proj = px * rx + py * ry;
        var perp = Math.abs(px * -ry + py * rx);
        if (proj > 0 && proj < 900 && perp < 26) p.takeDamage(60 * dt);
      }
    }
    if (c.t <= 0) this.cast = null;
    return;
  }

  if (c.type === 'charge') {
    if (c.phase === 'wind') {
      c.t -= dt;
      if (c.t <= 0) {
        c.phase = 'dash';
        c.t = 0.45;
        this.vx = Math.cos(c.ang) * 700;
        this.vy = Math.sin(c.ang) * 700;
        TZ.Audio.play('dash');
      }
      return;
    }
    if (c.phase === 'dash') {
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      this.x = TZ.u.clamp(this.x, 50, TZ.Config.W - 50);
      this.y = TZ.u.clamp(this.y, 60, TZ.Config.H - 140);
      var p = app.player;
      if (p && p.alive && TZ.u.dist(this.x, this.y, p.x, p.y) < this.size * 0.6) p.takeDamage(40);
      c.t -= dt;
      if (c.t <= 0) this.cast = null;
      return;
    }
  }

  this.cast = null;
};

TZ.Boss.prototype.draw = function (ctx) {
  if (!this.alive) return;
  var s = this.size;
  var ang = Math.atan2(this.dir.x, -this.dir.y);
  var t = TZ.time || 0;

  ctx.save();
  ctx.translate(this.x, this.y);
  ctx.rotate(ang);

  ctx.save();
  ctx.globalAlpha = 0.25;
  ctx.fillStyle = this.color;
  ctx.beginPath(); ctx.arc(0, 0, s * 0.75, 0, 7); ctx.fill();
  ctx.restore();

  if (this.img && this.img.complete && this.img.naturalWidth > 0) {
    ctx.drawImage(this.img, -s * 0.6, -s * 0.6, s * 1.2, s * 1.2);
  } else {
    ctx.save();
    ctx.rotate(this.rot * 0.3);
    ctx.fillStyle = this.color;
    ctx.beginPath();
    var n = 8;
    for (var i = 0; i < n; i++) {
      var a = i / n * Math.PI * 2;
      var r1 = (i % 2 === 0) ? s * 0.42 : s * 0.6;
      var px = Math.cos(a) * r1, py = Math.sin(a) * r1;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    ctx.fillStyle = '#16222e';
    ctx.beginPath(); ctx.arc(0, 0, s * 0.4, 0, 7); ctx.fill();
    ctx.strokeStyle = this.color;
    ctx.lineWidth = 4;
    ctx.stroke();

    var pulse = 0.6 + 0.4 * Math.sin(t * 5);
    ctx.shadowColor = this.color;
    ctx.shadowBlur = 24;
    ctx.fillStyle = this.color;
    ctx.beginPath(); ctx.arc(0, 0, s * 0.22, 0, 7); ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(0, 0, s * 0.1, 0, 7); ctx.fill();
    ctx.shadowBlur = 0;

    ctx.fillStyle = this.color;
    ctx.fillRect(s * 0.3, -6, s * 0.32, 12);
  }

  if (this.phase >= 3) {
    ctx.globalAlpha = 0.3 + 0.2 * Math.sin(t * 8);
    ctx.fillStyle = '#ff2e4d';
    ctx.beginPath(); ctx.arc(0, 0, s * 0.5, 0, 7); ctx.fill();
    ctx.globalAlpha = 1;
  }
  ctx.restore();

  if (this.cast && this.cast.type === 'laser') {
    ctx.save();
    if (this.cast.beam === 0) {
      if (Math.floor(t * 14) % 2 === 0) {
        ctx.strokeStyle = 'rgba(255,46,77,0.8)';
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(this.x, this.y);
        ctx.lineTo(this.x + Math.cos(this.cast.ang) * 900, this.y + Math.sin(this.cast.ang) * 900);
        ctx.stroke();
      }
    } else {
      var ex = this.x + Math.cos(this.cast.ang) * 900;
      var ey = this.y + Math.sin(this.cast.ang) * 900;
      var grad = ctx.createLinearGradient(this.x, this.y, ex, ey);
      grad.addColorStop(0, 'rgba(255,255,255,0.9)');
      grad.addColorStop(0.2, 'rgba(255,46,77,0.8)');
      grad.addColorStop(1, 'rgba(255,46,77,0)');
      ctx.strokeStyle = grad;
      ctx.lineWidth = 52;
      ctx.globalAlpha = 0.85;
      ctx.beginPath();
      ctx.moveTo(this.x, this.y); ctx.lineTo(ex, ey);
      ctx.stroke();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 10;
      ctx.globalAlpha = 0.9;
      ctx.beginPath();
      ctx.moveTo(this.x, this.y); ctx.lineTo(ex, ey);
      ctx.stroke();
    }
    ctx.restore();
  }

  if (this.cast && this.cast.type === 'charge' && this.cast.phase === 'wind') {
    ctx.save();
    ctx.strokeStyle = 'rgba(255,140,58,0.8)';
    ctx.lineWidth = 8;
    ctx.setLineDash([12, 10]);
    ctx.lineDashOffset = -t * 40;
    ctx.beginPath();
    ctx.moveTo(this.x, this.y);
    ctx.lineTo(this.x + Math.cos(this.cast.ang) * 600, this.y + Math.sin(this.cast.ang) * 600);
    ctx.stroke();
    ctx.restore();
  }
};
