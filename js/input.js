TZ.Input = (function () {
  var down = {}, pressed = {};
  var mouse = { x:0, y:0, present:false, left:false, right:false };
  var joy = { active:false, id:null, ox:0, oy:0, x:0, y:0 };
  var aim = { active:false, id:null, x:0, y:0 };
  var skillTap = false;
  var touchMode = false;

  function cvPoint(t) {
    var cv = document.getElementById('gameCanvas');
    var r = cv.getBoundingClientRect();
    return {
      x:(t.clientX - r.left) * (cv.width / r.width),
      y:(t.clientY - r.top) * (cv.height / r.height)
    };
  }

  function uiTarget(e) {
    var tg = e.target;
    return tg && tg.closest && !!tg.closest('#touch-skill, #pause-btn');
  }

  addEventListener('keydown', function (e) {
    if (e.code === 'Space' || e.code.indexOf('Arrow') === 0) e.preventDefault();
    if (!e.repeat) pressed[e.code] = true;
    down[e.code] = true;
  });
  addEventListener('keyup', function (e) { down[e.code] = false; });
  addEventListener('blur', function () { for (var k in down) down[k] = false; });
  addEventListener('mousemove', function (e) {
    if (touchMode) return;
    var cv = document.getElementById('gameCanvas');
    if (!cv) return;
    var r = cv.getBoundingClientRect();
    if (!r.width) return;
    mouse.x = (e.clientX - r.left) * (cv.width / r.width);
    mouse.y = (e.clientY - r.top) * (cv.height / r.height);
    mouse.present = true;
  });
  addEventListener('mousedown', function (e) {
    if (touchMode) return;
    if (e.target && e.target.closest && e.target.closest('button, .tank-card, .boss-card, .level-cell')) return;
    if (e.button === 0) mouse.left = true;
    if (e.button === 2) { mouse.right = true; e.preventDefault(); }
  });
  addEventListener('mouseup', function (e) {
    if (touchMode) return;
    if (e.button === 0) mouse.left = false;
    if (e.button === 2) mouse.right = false;
  });
  addEventListener('contextmenu', function (e) { e.preventDefault(); });

  addEventListener('touchstart', function (e) {
    touchMode = true;
    if (document.querySelector('.screen.active')) return;
    if (uiTarget(e)) return;
    for (var i = 0; i < e.changedTouches.length; i++) {
      var t = e.changedTouches[i];
      var pt = cvPoint(t);
      if (pt.x >= 480) {
        if (!aim.active) { aim.active = true; aim.id = t.identifier; aim.x = pt.x; aim.y = pt.y; }
      } else {
        if (!joy.active) { joy.active = true; joy.id = t.identifier; joy.ox = pt.x; joy.oy = pt.y; joy.x = pt.x; joy.y = pt.y; }
      }
    }
    e.preventDefault();
  }, { passive:false });
  addEventListener('touchmove', function (e) {
    if (document.querySelector('.screen.active')) return;
    for (var i = 0; i < e.changedTouches.length; i++) {
      var t = e.changedTouches[i];
      var pt = cvPoint(t);
      if (joy.active && t.identifier === joy.id) { joy.x = pt.x; joy.y = pt.y; }
      else if (aim.active && t.identifier === aim.id) { aim.x = pt.x; aim.y = pt.y; }
    }
    e.preventDefault();
  }, { passive:false });
  addEventListener('touchend', function (e) {
    for (var i = 0; i < e.changedTouches.length; i++) {
      var t = e.changedTouches[i];
      if (joy.active && t.identifier === joy.id) { joy.active = false; joy.id = null; }
      if (aim.active && t.identifier === aim.id) { aim.active = false; aim.id = null; }
    }
    e.preventDefault();
  });
  addEventListener('touchcancel', function (e) {
    for (var i = 0; i < e.changedTouches.length; i++) {
      var t = e.changedTouches[i];
      if (joy.active && t.identifier === joy.id) { joy.active = false; joy.id = null; }
      if (aim.active && t.identifier === aim.id) { aim.active = false; aim.id = null; }
    }
    e.preventDefault();
  });

  function axis() {
    var x = 0, y = 0;
    if (down.KeyW || down.ArrowUp) y -= 1;
    if (down.KeyS || down.ArrowDown) y += 1;
    if (down.KeyA || down.ArrowLeft) x -= 1;
    if (down.KeyD || down.ArrowRight) x += 1;
    if (joy.active) {
      var cv = document.getElementById('gameCanvas');
      var dispW = cv.getBoundingClientRect().width || cv.width;
      var R = 46 * (cv.width / dispW);
      var dx = joy.x - joy.ox, dy = joy.y - joy.oy;
      var l = Math.hypot(dx, dy);
      var k = Math.min(1, l / R);
      if (l > 1) { x += dx / l * k; y += dy / l * k; }
    }
    var L = Math.hypot(x, y);
    if (L > 1) { x /= L; y /= L; }
    return { x:x, y:y, pressing:L > 0.01 };
  }

  function consume(code) {
    var v = pressed[code];
    pressed[code] = false;
    return !!v;
  }

  function triggerSkill() { skillTap = true; }

  function resetPointer() {
    mouse.left = false; mouse.right = false; mouse.present = false;
    skillTap = false;
    joy.active = false; joy.id = null;
    aim.active = false; aim.id = null;
  }

  return {
    down: down,
    axis: axis,
    consume: consume,
    mouse: function () { return mouse; },
    aimTouch: function () { return aim; },
    joystick: function () { return joy; },
    fire: function () { return mouse.left || aim.active || !!down.Space; },
    skill: function () {
      var v = mouse.right || !!(down.KeyJ || down.ShiftLeft || down.ShiftRight);
      if (skillTap) { skillTap = false; v = true; }
      return v;
    },
    triggerSkill: triggerSkill,
    resetPointer: resetPointer,
    isTouch: function () { return touchMode; }
  };
})();