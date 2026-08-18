TZ.Particles = (function () {
  var list = [];
  var shake = 0;

  function add(p) { list.push(p); }

  function spawnExplosion(x, y, color, count, power) {
    for (var i = 0; i < count; i++) {
      var a = Math.random() * Math.PI * 2;
      var sp = TZ.u.rand(60, 240) * (power || 1);
      add({ type:'dot', x:x, y:y, vx:Math.cos(a) * sp, vy:Math.sin(a) * sp, life:TZ.u.rand(0.3, 0.7), max:0.7, size:TZ.u.rand(2, 5), color:color, drag:2 });
    }
    add({ type:'flash', x:x, y:y, life:0.15, max:0.15, size:(power || 1) * 42, color:color });
    shake = Math.max(shake, (power || 1) * 6);
  }

  function spawnHit(x, y, color) {
    for (var i = 0; i < 7; i++) {
      var a = Math.random() * Math.PI * 2;
      var sp = TZ.u.rand(50, 200);
      add({ type:'dot', x:x, y:y, vx:Math.cos(a) * sp, vy:Math.sin(a) * sp, life:TZ.u.rand(0.15, 0.4), max:0.4, size:TZ.u.rand(1.5, 3), color:color || '#ffffff', drag:3 });
    }
  }

  function spawnMuzzle(x, y, ang, color) {
    for (var i = 0; i < 3; i++) {
      var a = ang + TZ.u.rand(-0.4, 0.4);
      var sp = TZ.u.rand(120, 230);
      add({ type:'dot', x:x, y:y, vx:Math.cos(a) * sp, vy:Math.sin(a) * sp, life:0.15, max:0.15, size:2.5, color:color || '#ffd23f', drag:3 });
    }
  }

  function spawnText(x, y, text, color) {
    add({ type:'text', x:x, y:y, vx:0, vy:-60, life:0.9, max:0.9, size:16, text:text, color:color || '#ffffff' });
  }

  function update(dt) {
    for (var i = list.length - 1; i >= 0; i--) {
      var p = list[i];
      p.life -= dt;
      if (p.life <= 0) { list.splice(i, 1); continue; }
      p.vx -= p.vx * p.drag * dt;
      p.vy -= p.vy * p.drag * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    if (shake > 0) shake = Math.max(0, shake - dt * 20);
  }

  function draw(ctx) {
    for (var i = 0; i < list.length; i++) {
      var p = list[i];
      var a = TZ.u.clamp(p.life / p.max, 0, 1);
      if (p.type === 'text') {
        ctx.globalAlpha = a;
        ctx.fillStyle = p.color;
        ctx.font = 'bold 15px "Segoe UI","Microsoft YaHei",sans-serif';
        ctx.textAlign = 'center';
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 8;
        ctx.fillText(p.text, p.x, p.y);
        ctx.shadowBlur = 0;
      } else if (p.type === 'flash') {
        ctx.globalAlpha = a * 0.5;
        ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, 7); ctx.fill();
      } else {
        ctx.globalAlpha = a;
        ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, 7); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  return {
    list: list,
    spawnExplosion: spawnExplosion,
    spawnHit: spawnHit,
    spawnMuzzle: spawnMuzzle,
    spawnText: spawnText,
    update: update,
    draw: draw,
    addShake: function (v) { shake = Math.max(shake, v); },
    get shake() { return shake; }
  };
})();
