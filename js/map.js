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

  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  function inZone(c, r) {
    if (r <= 1 && (c <= 2 || (c >= 8 && c <= 11) || c >= 17)) return true;
    if (r >= 15 && c >= 4 && c <= 15) return true;
    return false;
  }

  function place2x2(g, rng, n) {
    for (var i = 0; i < n; i++) {
      var c = 1 + Math.floor(rng() * 17);
      var r = 2 + Math.floor(rng() * 13);
      if (c + 1 > 18 || r + 1 > 15) continue;
      if (inZone(c, r) || inZone(c + 1, r) || inZone(c, r + 1) || inZone(c + 1, r + 1)) continue;
      if (g[r][c] === 0 && g[r][c + 1] === 0 && g[r + 1][c] === 0 && g[r + 1][c + 1] === 0) {
        set(g, c, r, 1); set(g, c + 1, r, 1); set(g, c, r + 1, 1); set(g, c + 1, r + 1, 1);
      }
    }
  }

  function placeBarH(g, rng, n) {
    for (var i = 0; i < n; i++) {
      var r = 2 + Math.floor(rng() * 13);
      var c = 1 + Math.floor(rng() * 14);
      var len = 3 + Math.floor(rng() * 3);
      var gap = Math.floor(rng() * len);
      var ok = true;
      for (var j = 0; j < len; j++) {
        var cc = c + j;
        if (cc > 18 || inZone(cc, r) || g[r][cc] !== 0) { ok = false; break; }
      }
      if (ok) for (var j = 0; j < len; j++) if (j !== gap) g[r][c + j] = 1;
    }
  }

  function placeBarV(g, rng, n) {
    for (var i = 0; i < n; i++) {
      var c = 2 + Math.floor(rng() * 15);
      var r = 2 + Math.floor(rng() * 12);
      var len = 3 + Math.floor(rng() * 3);
      var gap = Math.floor(rng() * len);
      var ok = true;
      for (var j = 0; j < len; j++) {
        var rr = r + j;
        if (rr > 15 || inZone(c, rr) || g[rr][c] !== 0) { ok = false; break; }
      }
      if (ok) for (var j = 0; j < len; j++) if (j !== gap) g[r + j][c] = 1;
    }
  }

  function placeSteel(g, rng, n) {
    for (var i = 0; i < n; i++) {
      var c = 1 + Math.floor(rng() * 17);
      var r = 2 + Math.floor(rng() * 13);
      if (c + 1 > 18 || r + 1 > 15) continue;
      if (inZone(c, r) || inZone(c + 1, r) || inZone(c, r + 1) || inZone(c + 1, r + 1)) continue;
      if (g[r][c] === 0 && g[r][c + 1] === 0 && g[r + 1][c] === 0 && g[r + 1][c + 1] === 0) {
        set(g, c, r, 2); set(g, c + 1, r, 2); set(g, c, r + 1, 2); set(g, c + 1, r + 1, 2);
      }
    }
  }

  function floodFrom(g, sc, sr) {
    var seen = {};
    var stack = [[sc, sr]];
    seen[sc + ',' + sr] = 1;
    while (stack.length) {
      var p = stack.pop();
      var c = p[0], r = p[1];
      if (r - 1 >= 0 && g[r - 1][c] === 0 && !seen[c + ',' + (r - 1)]) { seen[c + ',' + (r - 1)] = 1; stack.push([c, r - 1]); }
      if (r + 1 < C.ROWS && g[r + 1][c] === 0 && !seen[c + ',' + (r + 1)]) { seen[c + ',' + (r + 1)] = 1; stack.push([c, r + 1]); }
      if (c - 1 >= 0 && g[r][c - 1] === 0 && !seen[(c - 1) + ',' + r]) { seen[(c - 1) + ',' + r] = 1; stack.push([c - 1, r]); }
      if (c + 1 < C.COLS && g[r][c + 1] === 0 && !seen[(c + 1) + ',' + r]) { seen[(c + 1) + ',' + r] = 1; stack.push([c + 1, r]); }
    }
    return function (c, r) { return !!seen[c + ',' + r]; };
  }

  function create(seed) {
    var rng = mulberry32(seed >>> 0 || 1);
    var g = empty();
    fort(g);
    var d = 1 + (seed % 3) * 0.4;
    placeBarH(g, rng, Math.round((2 + Math.floor(rng() * 3)) * d));
    placeBarV(g, rng, Math.round((2 + Math.floor(rng() * 3)) * d));
    place2x2(g, rng, Math.round((4 + Math.floor(rng() * 4)) * d));
    placeSteel(g, rng, Math.round((1 + Math.floor(rng() * 3)) * d));
    var spawns = [[1, 1], [9, 1], [18, 1]];
    for (var i = 0; i < spawns.length; i++) {
      var reach = floodFrom(g, 9, 17);
      if (!reach(spawns[i][0], spawns[i][1])) {
        var col = spawns[i][0];
        for (var r = 2; r <= 16; r++) g[r][col] = 0;
      }
    }
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
