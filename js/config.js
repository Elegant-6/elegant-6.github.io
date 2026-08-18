window.TZ = window.TZ || {};

(function () {
  var C = {
    TILE: 48, COLS: 20, ROWS: 20,
    CHAPTERS: 3, LEVELS_PER_CHAPTER: 5,
    SAVE_KEY: 'tz_save_v1'
  };
  C.W = C.TILE * C.COLS;
  C.H = C.TILE * C.ROWS;

  var TANKS = {
    default:   { key:'default',   name:'默认坦克', type:'平衡型', img:'assets/tanks/tank_default.png',   hp:120, speed:180, attack:25, fireRate:2.0, bulletSpeed:480, armor:0, color:'#00f0ff', skill:{ key:'triple', name:'三连发', desc:'下一次攻击同时射出 3 发子弹', cooldown:8 } },
    blast:     { key:'blast',     name:'爆破坦克', type:'攻击型', img:'assets/tanks/tank_blast.png',     hp:100, speed:140, attack:45, fireRate:1.2, bulletSpeed:420, armor:0, color:'#ff5a2e', skill:{ key:'nuke',   name:'核弹炮', desc:'发射大范围爆炸炮弹，溅射伤害', cooldown:15 }, passive:'splash' },
    lightning: { key:'lightning', name:'闪电坦克', type:'速度型', img:'assets/tanks/tank_lightning.png', hp:80,  speed:260, attack:18, fireRate:3.5, bulletSpeed:520, armor:0, color:'#ffd23f', skill:{ key:'dash',    name:'闪现冲刺', desc:'向当前方向高速冲刺并撞伤敌人', cooldown:6 } },
    guard:     { key:'guard',     name:'守护坦克', type:'防御型', img:'assets/tanks/tank_guard.png',     hp:220, speed:130, attack:22, fireRate:1.8, bulletSpeed:460, armor:3, color:'#00ffb0', skill:{ key:'shield',  name:'能量护盾', desc:'生成可吸收伤害的护盾', cooldown:15 } }
  };

  var ENEMIES = {
    scout:    { key:'scout',    name:'侦察兵', hp:30,  speed:220, attack:10, bulletSpeed:0,   shoot:false, color:'#8ffcff', score:100,  radius:16 },
    grunt:    { key:'grunt',    name:'突击兵', hp:60,  speed:120, attack:20, bulletSpeed:400, shoot:true,  color:'#ff9f43', score:200,  radius:17 },
    heavy:    { key:'heavy',    name:'重装兵', hp:200, speed:70,  attack:35, bulletSpeed:320, shoot:true,  color:'#c0392b', score:400,  radius:20 },
    kamikaze: { key:'kamikaze', name:'自爆兵', hp:40,  speed:170, attack:60, bulletSpeed:0,   shoot:false, color:'#ff4757', score:150,  radius:16 },
    sniper:   { key:'sniper',   name:'狙击手', hp:50,  speed:90,  attack:40, bulletSpeed:800, shoot:true,  color:'#a29bfe', score:300,  radius:16 },
    elite:    { key:'elite',    name:'精英兵', hp:120, speed:150, attack:25, bulletSpeed:450, shoot:true,  color:'#fdcb6e', score:500,  radius:18 },
    defaultEnemy: { key:'defaultEnemy', name:'默认敌方坦克', type:'平衡型', hp:100, speed:160, attack:25, bulletSpeed:450, shoot:true, color:'#9ad0ff', score:250, radius:18, img:'assets/tanks/enemy_default.png' },
    enemyBlast:     { key:'enemyBlast',     name:'爆破-坦克', type:'攻击型', hp:90,  speed:140, attack:45, bulletSpeed:420, shoot:true, color:'#ff5a2e', score:400, radius:18, img:'assets/tanks/enemy_blast.png' },
    enemyLightning: { key:'enemyLightning', name:'闪电-坦克', type:'速度型', hp:60,  speed:260, attack:18, bulletSpeed:520, shoot:true, color:'#ffd23f', score:300, radius:16, img:'assets/tanks/enemy_lightning.png' },
    enemyGuard:     { key:'enemyGuard',     name:'守护-坦克', type:'防御型', hp:220, speed:130, attack:22, bulletSpeed:460, shoot:true, color:'#00ffb0', score:500, radius:20, armor:3, img:'assets/tanks/enemy_guard.png' }
  };

  var BOSSES = {
    ironGolem:    { key:'ironGolem',    name:'铁甲巨兽', hp:3000, speed:55, color:'#e67e22', size:96,  phases:2, skills:['fan','charge','summon'] },
    voltLord:     { key:'voltLord',     name:'电磁主宰', hp:2500, speed:85, color:'#00d2ff', size:84,  phases:2, skills:['ring','homing','laser'] },
    doomFortress: { key:'doomFortress', name:'末日要塞', hp:5000, speed:40, color:'#ff2e4d', size:116, phases:3, skills:['fan','ring','laser','summon','charge','homing','meteor'] },
    bossTank: { key:'bossTank', name:'BOSS坦克', type:'攻击型', hp:4000, speed:70, color:'#ff4d6d', size:104, phases:2, armor:1, skills:['fan','laser','charge'], img:'assets/tanks/boss_tank.png' }
  };

  var ITEMS = {
    power:  { key:'power',  name:'火力强化', color:'#ffd23f', sym:'火' },
    shield: { key:'shield', name:'护盾',     color:'#00f0ff', sym:'盾' },
    heal:   { key:'heal',   name:'生命回复', color:'#2ecc71', sym:'血' },
    speed:  { key:'speed',  name:'速度强化', color:'#b026ff', sym:'速' },
    double: { key:'double', name:'双发',     color:'#fd79a8', sym:'双' },
    pierce: { key:'pierce', name:'穿透弹',   color:'#fdcb6e', sym:'穿' },
    freeze: { key:'freeze', name:'冻结',     color:'#a29bfe', sym:'冻' },
    nuke:   { key:'nuke',   name:'核弹',     color:'#ff2e4d', sym:'核' }
  };

  C.TANKS = TANKS;
  C.ENEMIES = ENEMIES;
  C.BOSSES = BOSSES;
  C.ITEMS = ITEMS;

  TZ.u = {
    clamp: function (v, a, b) { return v < a ? a : (v > b ? b : v); },
    rand: function (a, b) { return a + Math.random() * (b - a); },
    dist: function (x1, y1, x2, y2) { return Math.hypot(x2 - x1, y2 - y1); },
    overlap: function (a, b) { return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y; },
    choice: function (arr) { return arr[(Math.random() * arr.length) | 0]; },
    roundRect: function (ctx, x, y, w, h, r) {
      r = Math.min(r, w / 2, h / 2);
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
    }
  };

  TZ.Config = C;
})();
