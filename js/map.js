TZ.Map = (function () {
  var C = TZ.Config;
  var BASE = { x: C.TILE * 9.5, y: C.TILE * 19.5 };

  function empty() {
    var g = [];
    for (var r = 0; r < C.ROWS; r++) g.push(new Array(C.COLS).fill(0));
    return g;
  }

  function set(g, c, r, v) { if (r >= 0 && r < C.ROWS && c >= 0 && c < C.COLS) g[r][c] = v; }

  function fort(g) {
    set(g, 9, 19, 3);
    set(g, 8, 19, 1); set(g, 10, 19, 1);
    set(g, 8, 18, 1); set(g, 10, 18, 1);
    set(g, 9, 18, 1);
    set(g, 9, 17, 0);
  }

  function patternA(g) {
    [[3,2],[6,2],[13,2],[16,2],[2,6],[4,6],[15,6],[17,6],[3,10],[6,10],[13,10],[16,10],[2,14],[4,14],[15,14],[17,14]]
      .forEach(function (p) { set(g, p[0], p[1], 1); });
    set(g, 9, 4, 1); set(g, 10, 4, 1); set(g, 9, 15, 1); set(g, 10, 15, 1);
    set(g, 5, 7, 1); set(g, 5, 8, 1); set(g, 14, 7, 1); set(g, 14, 8, 1);
    set(g, 3, 12, 1); set(g, 4, 12, 1); set(g, 5, 12, 1);
    set(g, 14, 12, 1); set(g, 15, 12, 1); set(g, 16, 12, 1);
  }

  function patternB(g) {
    patternA(g);
    set(g, 4, 4, 2); set(g, 15, 4, 2); set(g, 4, 15, 2); set(g, 15, 15, 2);
    set(g, 1, 5, 1); set(g, 2, 5, 1); set(g, 3, 5, 1); set(g, 1, 6, 1); set(g, 1, 7, 1); set(g, 2, 7, 1); set(g, 3, 7, 1);
    set(g, 16, 5, 1); set(g, 17, 5, 1); set(g, 18, 5, 1); set(g, 18, 6, 1); set(g, 18, 7, 1); set(g, 17, 7, 1); set(g, 16, 7, 1);
    set(g, 7, 8, 2); set(g, 8, 8, 2); set(g, 7, 9, 2); set(g, 8, 9, 2);
    set(g, 11, 8, 2); set(g, 12, 8, 2); set(g, 11, 9, 2); set(g, 12, 9, 2);
  }

  function patternC(g) {
    patternB(g);
    set(g, 2, 2, 1); set(g, 3, 2, 1); set(g, 2, 3, 1); set(g, 3, 3, 1);
    set(g, 16, 2, 1); set(g, 17, 2, 1); set(g, 16, 3, 1); set(g, 17, 3, 1);
    set(g, 1, 8, 1); set(g, 2, 8, 1); set(g, 1, 9, 1); set(g, 2, 9, 1);
    set(g, 17, 8, 1); set(g, 18, 8, 1); set(g, 17, 9, 1); set(g, 18, 9, 1);
    set(g, 6, 5, 2); set(g, 13, 5, 2); set(g, 6, 14, 2); set(g, 13, 14, 2);
    set(g, 5, 11, 1); set(g, 6, 11, 1); set(g, 7, 11, 1);
    set(g, 12, 11, 1); set(g, 13, 11, 1); set(g, 14, 11, 1);
    set(g, 4, 8, 1); set(g, 4, 9, 1); set(g, 4, 10, 1);
    set(g, 15, 8, 1); set(g, 15, 9, 1); set(g, 15, 10, 1);
    set(g, 9, 2, 2); set(g, 10, 2, 2); set(g, 9, 3, 2); set(g, 10, 3, 2);
    set(g, 9, 16, 2); set(g, 10, 16, 2);
  }

  function create(kind) {
    var g = empty();
    fort(g);
    if (kind >= 2) patternC(g);
    else if (kind === 1) patternB(g);
    else patternA(g);
    return g;
  }

  function solidAt(g, c, r) {
    if (c < 0 || r < 0 || c >= C.COLS || r >= C.ROWS) return true;
    var v = g[r][c];
    return v === 1 || v === 2;
  }

  function bulletHit(g, c, r) {
    if (c < 0 || r < 0 || c >= C.COLS || r >= C.ROWS) return 'edge';
    var v = g[r][c];
    if (v === 1) return 'brick';
    if (v === 2) return 'steel';
    if (v === 3) return 'base';
    return null;
  }

  function draw(ctx, g) {
    for (var r = 0; r < C.ROWS; r++) {
      for (var c = 0; c < C.COLS; c++) {
        var v = g[r][c];
        if (!v) continue;
        var x = c * C.TILE, y = r * C.TILE;
        if (v === 1) {
          ctx.fillStyle = '#c9743a';
          ctx.fillRect(x + 1, y + 1, C.TILE - 2, C.TILE - 2);
          ctx.strokeStyle = 'rgba(0,0,0,.35)';
          ctx.lineWidth = 1;
          ctx.strokeRect(x + 1, y + 1, C.TILE - 2, C.TILE - 2);
          ctx.beginPath();
          ctx.moveTo(x, y + C.TILE / 2); ctx.lineTo(x + C.TILE, y + C.TILE / 2);
          ctx.moveTo(x + C.TILE / 2, y); ctx.lineTo(x + C.TILE / 2, y + C.TILE);
          ctx.stroke();
        } else if (v === 2) {
          ctx.fillStyle = '#8a95a5';
          ctx.fillRect(x + 2, y + 2, C.TILE - 4, C.TILE - 4);
          ctx.strokeStyle = '#4e5764';
          ctx.strokeRect(x + 2, y + 2, C.TILE - 4, C.TILE - 4);
          ctx.beginPath();
          ctx.moveTo(x + 4, y + 4); ctx.lineTo(x + C.TILE - 4, y + C.TILE - 4);
          ctx.moveTo(x + C.TILE - 4, y + 4); ctx.lineTo(x + 4, y + C.TILE - 4);
          ctx.stroke();
        }
      }
    }
    var t = TZ.time || 0;
    var bx = BASE.x, by = BASE.y;
    ctx.save();
    ctx.translate(bx, by);
    var pulse = 0.5 + 0.5 * Math.sin(t * 3);
    ctx.shadowColor = '#ffd23f';
    ctx.shadowBlur = 18 + 10 * pulse;
    ctx.fillStyle = '#ffd23f';
    ctx.beginPath();
    ctx.moveTo(0, -16); ctx.lineTo(10, -6); ctx.lineTo(18, -2); ctx.lineTo(12, 10);
    ctx.lineTo(-12, 10); ctx.lineTo(-18, -2); ctx.lineTo(-10, -6);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#0a0e17';
    ctx.font = 'bold 13px "Microsoft YaHei",sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('基', 0, 1);
    ctx.restore();
  }

  return { BASE:BASE, create:create, solidAt:solidAt, bulletHit:bulletHit, draw:draw };
})();
