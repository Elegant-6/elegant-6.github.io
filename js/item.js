TZ.Item = function (x, y, key) {
  this.key = key;
  var d = TZ.Config.ITEMS[key];
  this.x = x; this.y = y;
  this.color = d.color;
  this.sym = d.sym;
  this.name = d.name;
  this.t = Math.random() * 10;
  this.bob = 0;
};

TZ.Item.prototype.update = function (dt, app) {
  this.t += dt;
  this.bob = Math.sin(this.t * 4) * 4;
  var p = app.player;
  if (p && p.alive && TZ.u.dist(this.x, this.y, p.x, p.y) < 40) {
    this.pickup(app);
    return true;
  }
  return false;
};

TZ.Item.prototype.pickup = function (app) {
  var p = app.player;
  switch (this.key) {
    case 'power':
      p.fireLevel = Math.min(5, p.fireLevel + 1);
      break;
    case 'shield':
      p.shield = Math.max(p.shield, 80);
      p.shieldTimer = 10;
      break;
    case 'heal':
      p.hp = Math.min(p.maxHp, p.hp + 30);
      break;
    case 'speed':
      p.effects.speed = 8;
      break;
    case 'double':
      p.effects.double = 10;
      break;
    case 'pierce':
      p.effects.pierce = 10;
      break;
    case 'freeze':
      app.freeze = 3;
      break;
    case 'nuke':
      for (var i = 0; i < app.enemies.length; i++) {
        var e = app.enemies[i];
        if (e.alive) e.die(app, false);
      }
      break;
  }
  TZ.Audio.play('pickup');
  TZ.Particles.spawnText(this.x, this.y - 22, TZ.Config.ITEMS[this.key].name, this.color);
  TZ.Particles.spawnExplosion(this.x, this.y, this.color, 14, 1.2);
};

TZ.Item.prototype.draw = function (ctx) {
  ctx.save();
  var pulse = 0.6 + 0.4 * Math.sin(this.t * 6);
  ctx.shadowColor = this.color;
  ctx.shadowBlur = 12 * pulse + 4;
  ctx.fillStyle = this.color;
  ctx.globalAlpha = 0.25;
  ctx.beginPath(); ctx.arc(this.x, this.y + this.bob, 16, 0, 7); ctx.fill();
  ctx.globalAlpha = 1;
  ctx.beginPath(); ctx.arc(this.x, this.y + this.bob, 10, 0, 7); ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#081018';
  ctx.font = 'bold 12px "Microsoft YaHei",sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(this.sym, this.x, this.y + this.bob + 1);
  ctx.restore();
};
