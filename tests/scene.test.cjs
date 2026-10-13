const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const core = require('../core.js');
const context = { window: { PondCore: core }, ImageData: class { constructor(w, h) { this.width = w; this.height = h; this.data = new Uint8ClampedArray(w * h * 4); } } };
vm.runInNewContext(fs.readFileSync(require.resolve('../art.js'), 'utf8'), context);
vm.runInNewContext(fs.readFileSync(require.resolve('../scene.js'), 'utf8'), context);
const { PondScene, Frog, lookFor, dayPhase, frogEligible, egretEligible, rainGraceDeadline } = context.window.PondScene;

// A stand-in renderer: the painting maps 1:1 onto a 1672×941 screen.
function pond(seed = 7) {
  let s = seed; const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  const R = { drops: [], imageToScreen: (x, y) => [x, y], drop(...a) { this.drops.push(a); } };
  const sim = new core.PondSimulation([core.createFish(0, rnd)], 1672, 941, rnd, [], false);
  const scene = new PondScene(R, sim, rnd); scene.layout(1672, 941);
  return scene;
}
const base = { turtles: false, butterflies: false, night: false, rainAmount: .9, snowAmount: .5 };

test('每种天气与夜色的画面参数键一致，天气切换可平滑过渡', () => {
  const keys = Object.keys(lookFor('sunny', false)).sort();
  for (const w of ['sunny', 'cloudy', 'rain', 'snow']) for (const night of [false, true]) assert.deepEqual(Object.keys(lookFor(w, night)).sort(), keys);
});

test('云量：晴天偶有云影，多云约半池云影，雨天满天阴云', () => {
  const cover = w => lookFor(w, false).cloudCover;
  assert.ok(cover('sunny') < .3 && cover('cloudy') > .4 && cover('cloudy') < .7 && cover('rain') === 1);
  assert.ok(lookFor('cloudy', false).caustic > lookFor('rain', false).caustic * 3, '多云时云隙阳光仍有焦散');
});
test('阴天青蛙使用更克制的冷暗色调', () => {
  const sunny = lookFor('sunny', false).frogTint;
  const cloudy = lookFor('cloudy', false).frogTint;
  assert.ok(cloudy[0] < sunny[0] && cloudy[1] < sunny[1], '阴天青蛙不应保持晴天亮度');
});

test('青蛙写实素材绘制时保持清晰主体并与环境色融合', () => {
  const scene = pond();
  scene.frog = new Frog(() => .5); scene.frog.place(500, 400);
  scene.look = { ...lookFor('cloudy', false), shadowDir: [.7, .72], night: false };
  const calls = [];
  scene.R = { sprites: { frog: {} }, floater() {}, sprite(layer, def, x, y, angle, sx, sy, color, fog) { calls.push({ layer, sx, sy, color, fog }); } };
  scene.draw({ turtles: false, butterflies: false, weather: 'cloudy', night: false });
  const frog = calls.find(c => c.layer === 'air');
  assert.ok(frog, '应绘制可见的青蛙主体');
  assert.ok(frog.sx >= .72 && frog.sx <= .88 && frog.sy >= .72 && frog.sy <= .88, '荷叶青蛙应与跳跃和入水姿态保持统一尺寸');
  assert.ok(frog.color[3] >= .96, '青蛙主体 alpha 不能过低');
  assert.ok(frog.color[1] > frog.color[0] && frog.color[1] > frog.color[2], '青蛙保持自然绿色环境融合');
});
test('四种白天天气整体池面亮度提高', () => {
  assert.ok(lookFor('sunny', false).bright > 1.05);
  assert.ok(lookFor('cloudy', false).bright > 1);
  assert.ok(lookFor('rain', false, .5).bright > .8);
  assert.ok(lookFor('snow', false, .5, .5).bright > .98);
  assert.ok(lookFor('sunny', true).bright < .6, '夜色仍应保持低亮度');
});

test('四季底图有独立且克制的色调校正', () => {
  const spring = lookFor('sunny', false, .5, .5, 'spring');
  const summer = lookFor('sunny', false, .5, .5, 'summer');
  const autumn = lookFor('sunny', false, .5, .5, 'autumn');
  const winter = lookFor('sunny', false, .5, .5, 'winter');
  assert.ok(spring.bright < 1.1 && spring.sat < 1, '春季压低过曝高光');
  assert.ok(summer.sat < spring.sat, '夏季压低浓绿饱和度');
  assert.ok(autumn.tint[0] > autumn.tint[2], '秋季偏暖');
  assert.ok(winter.tint[2] > winter.tint[0], '冬季偏冷');
  assert.ok(spring.bright >= .95, '春季不能因季节叠加变暗');
  assert.ok(autumn.bright >= .95, '秋季底图不能被压成灰暗');
});

test('晨昏时段提供蓝调与金色光影', () => {
  const at = h => new Date(2026, 8, 28, h, 0);
  assert.equal(dayPhase(new Date(2026, 8, 28, 5, 30)), 'blue');
  assert.equal(dayPhase(new Date(2026, 8, 28, 7, 0)), 'golden');
  assert.equal(dayPhase(at(12)), 'day');
  assert.equal(dayPhase(at(18)), 'golden');
  assert.equal(dayPhase(new Date(2026, 8, 28, 19, 30)), 'blue');
});

test('月下观鱼增强月光但保持夜景基础亮度', () => {
  const day = lookFor('sunny', false), night = lookFor('sunny', true);
  assert.ok(night.moon > 1.2, '夜间月光参数应明显增强');
  assert.ok(night.bright < .6, '夜景基础亮度仍应低于白天');
  assert.ok(lookFor('rain', true, .5).bright > .5, '雨夜仍应看清池面');
  assert.ok(lookFor('rain', true, .5).moon > .8, '雨夜保留月光');
});

test('月下观鱼使用更醒目的月面尺寸', () => {
  const scene = pond();
  scene.update(0, { ...base, weather: 'sunny', night: true });
  assert.ok(scene.moonDisc[2] > 28 * scene.scale, '月面半径应大于旧尺寸');
});

test('雪天不生成青蛙和蝌蚪实体', () => {
  const scene = pond();
  for (let i = 0; i < 30; i++) scene.update(1 / 30, { ...base, weather: 'snow', season: 'summer' });
  assert.equal('frogs' in scene, false);
  assert.equal('tadpoles' in scene, false);
});

test('青蛙春夏晴天、多云、雨天或夜晚出现，雪天与秋冬排除', () => {
  for (const season of ['spring', 'summer']) {
    assert.equal(frogEligible(season, 'sunny', false), true);
    assert.equal(frogEligible(season, 'cloudy', false), true);
    assert.equal(frogEligible(season, 'rain', false), true);
    assert.equal(frogEligible(season, 'rain', true), true);
    assert.equal(frogEligible(season, 'cloudy', true), true);
    assert.equal(frogEligible(season, 'snow', false), false);
  }
  for (const season of ['autumn', 'winter']) {
    assert.equal(frogEligible(season, 'sunny', false), false);
    assert.equal(frogEligible(season, 'rain', true), false);
  }
});

test('白鹭全年晴天或多云可出现，雨停宽限有效但雨雪和夜间排除', () => {
  for (const season of ['spring', 'summer', 'autumn', 'winter']) {
    assert.equal(egretEligible('sunny', false, false), true);
    assert.equal(egretEligible('cloudy', false, false), true);
  }
  assert.equal(egretEligible('cloudy', true, true), false);
  assert.equal(egretEligible('rain', false, true), false);
  assert.equal(egretEligible('snow', false, true), false);
  assert.equal(egretEligible('rain', false, false), false);
  assert.equal(egretEligible('sunny', false, true), true);
});

test('季节底图左下花簇不再叠加旧坐标的动态荷花', () => {
  const scene = pond();
  assert.ok(scene.floaters.some(({ f }) => f[3] === 'f'), '底图标注应保留荷花位置供前景遮罩与阴影使用');
  assert.ok(scene.floaters.some(({ f }) => f[3] === 'b'), '底图标注应保留花苞位置');
  assert.ok(scene.lotusSpots.length > 2, '青蛙落点应取自较大的荷叶，不是荷花坐标');
});

test('动态水面只把荷叶当作可交互层，荷花和花苞不参与漂动', () => {
  const scene = pond();
  assert.ok(scene.floaters.some(({ f }) => f[3] === 'f'));
  assert.ok(scene.floaters.some(({ f }) => f[3] === 'b'));
  assert.ok(scene.surfaceZones.every(z => z.kind === 'l'), '花朵与花苞不能成为水面交互区');
});

test('浮物标注统一映射并区分荷叶、荷花、花苞、铜钱草和石头', () => {
  const scene = pond();
  assert.ok(Array.isArray(scene.floatObjects), '场景应提供统一浮物标注');
  const kinds = new Set(scene.floatObjects.map(o => o.kind));
  for (const kind of ['leaf', 'flower', 'bud', 'pennywort', 'rock']) assert.ok(kinds.has(kind), `缺少 ${kind} 标注`);
  assert.ok(scene.floatObjects.every(o => Number.isFinite(o.x) && Number.isFinite(o.y) && o.rx > 0 && o.ry > 0));
  assert.ok(scene.surfaceZones.every(z => z.object && ['leaf', 'pennywort'].includes(z.object.kind)), '交互区只能来自叶片');
  assert.ok(scene.sim.obstacles.every(o => o.objectKind === 'rock'), '鱼的障碍只能来自石头');
});

test('前景绘制使用统一标注并让荷花和花苞单独摇曳', () => {
  const scene = pond();
  const calls = [];
  scene.R = {
    sprites: {},
    floater(...args) { calls.push(args); },
    sprite() {},
    fish() {}
  };
  scene.draw({ turtles: false, butterflies: false, weather: 'sunny', night: false });
  assert.ok(calls.length > 0, '应绘制浮物前景');
  const rawKinds = new Set(scene.floatObjects.filter(o => o.kind === 'flower' || o.kind === 'bud').map(o => o.rawKind));
  assert.ok(rawKinds.has('f') && rawKinds.has('b'));
  assert.ok(scene.floatObjects.filter(o => o.kind === 'flower' || o.kind === 'bud').every(o => Array.isArray(o.stem)), '花和花苞需要茎点');
  assert.ok(calls.length >= scene.floatObjects.filter(o => o.kind !== 'rock').length, '荷花与花苞不能被静态跳过');
});

test('白鹭在冷却结束后的低频尝试窗口内可以出现', () => {
  const scene = pond(11);
  scene.egretCooldown = 0;
  let appeared = false;
  for (let i = 0; i < 30 * 12; i++) {
    scene.update(1 / 30, { ...base, weather: 'sunny', egretEnabled: true });
    if (scene.egret) { appeared = true; break; }
  }
  assert.equal(appeared, true);
});

test('青蛙在不同天气下使用克制的环境色，不被额外提亮', () => {
  const scene = pond();
  scene.frog = new Frog(() => .5); scene.frog.place(500, 400);
  const render = weather => {
    scene.look = { ...lookFor(weather, false), shadowDir: [.7, .72] };
    const calls = [];
    scene.R = { sprites: { frog: {} }, floater() {}, sprite(layer, def, x, y, angle, sx, sy, color) { if (layer === 'air') calls.push(color); } };
    scene.draw({ turtles: false, butterflies: false, weather, night: false });
    return calls[0];
  };
  const cloudy = render('cloudy'), rain = render('rain'), snow = render('snow');
  assert.ok(cloudy[1] < .93, '阴天青蛙不应被额外提亮');
  assert.ok(rain[2] > rain[1], '雨天青蛙应保留冷色环境光');
  assert.ok(snow[2] >= snow[1], '雪天青蛙应保留偏冷色调');
});

test('关闭池塘设置中的青蛙后立即清除青蛙且不再生成', () => {
  const scene = pond();
  scene.frog = new Frog(() => .5); scene.frog.place(500, 400);
  scene.frogCooldown = 0;
  scene.update(1 / 30, { ...base, weather: 'cloudy', season: 'summer', frogEnabled: false });
  assert.equal(scene.frog, null);
});

test('青蛙会朝向最近的锦鲤并沿目标方向跳水', () => {
  const scene = pond();
  scene.frog = new Frog(() => .5); scene.frog.place(500, 400);
  const fish = scene.sim.fish[0]; fish.x = 620 / 1672; fish.y = 400 / 941;
  scene.update(1 / 30, { ...base, weather: 'cloudy', season: 'summer', frogEnabled: true });
  assert.ok(Math.abs(scene.frog.targetAngle) < .25, '青蛙应朝向右侧最近的锦鲤');
  assert.ok(scene.frog.angle < -.9, '青蛙转向应有缓动，不应瞬间拧头');
  const startX = scene.frog.x;
  assert.equal(scene.hitFrog(500, 400), true);
  scene.update(.3, { ...base, weather: 'cloudy', season: 'summer', frogEnabled: true });
  assert.ok(scene.frog.x > startX + 10, '跳水过程应有明显的水平位移');
});

test('青蛙跟随锦鲤时缓慢转向并经历起跳与入水阶段', () => {
  const frog = new Frog(() => .5); frog.place(500, 400); frog.faceTarget(900, 400);
  frog.update(.5); assert.ok(frog.angle < -.9, '半秒内不应瞬间转向');
  frog.jump(620, 400); frog.update(.08); assert.equal(frog.state, 'jumping'); assert.equal(frog.jumpPhase, 'launch');
  frog.update(.2); assert.equal(frog.jumpPhase, 'airborne');
  for (let i = 0; i < 18; i++) frog.update(1 / 60);
  const beforeDive = frog.x;
  frog.update(.1);
  assert.ok(frog.x - beforeDive > 8, '跳水末段应持续向前入水，不能在水面停顿');
  for (let i = 0; i < 10; i++) frog.update(1 / 60);
  assert.equal(frog.state, 'swimming');
});

test('青蛙入水后会短暂游动并保留落水涟漪', () => {
  const scene = pond();
  scene.frog = new Frog(() => .5); scene.frog.place(500, 400);
  const fish = scene.sim.fish[0]; fish.x = 620 / 1672; fish.y = 400 / 941;
  assert.equal(scene.hitFrog(500, 400), true);
  for (let i = 0; i < 50; i++) scene.update(1 / 60, { ...base, weather: 'cloudy', season: 'summer', frogEnabled: true });
  assert.equal(scene.frog.state, 'swimming');
  const swimX = scene.frog.x;
  for (let i = 0; i < 12; i++) scene.update(1 / 60, { ...base, weather: 'cloudy', season: 'summer', frogEnabled: true });
  assert.notEqual(scene.frog.x, swimX, '入水后青蛙应有轻微游动');
  assert.ok(scene.splashes.some(p => p.ring), '入水应保留涟漪环');
});

test('点击青蛙会进入跳水状态并惊扰附近锦鲤', () => {
  const scene = pond();
  scene.frog = { x: 500, y: 400, state: 'perched', size: 1 };
  const fish = scene.sim.fish[0]; fish.x = .5; fish.y = 400 / 941;
  assert.equal(scene.hitFrog(500, 400), true);
  assert.equal(scene.frog.state, 'jumping');
  assert.ok(fish.flee > 0);
  assert.ok(scene.splashes.length > 0);
  assert.ok(scene.events.some(e => e.type === 'frog-jump'));
});

test('动态水面只包含荷叶，不生成花苞或荷花浮层', () => {
  const scene = pond();
  assert.ok(scene.floaters.some(({ f }) => f[3] === 'f' || f[3] === 'b'), '荷花标注保留在底图前景元数据中');
  assert.ok(scene.surfaceZones.every(z => z.kind === 'l'), '水面交互目标不应包含荷花');
});

test('季节底图中的荷花花瓣仍会保留为独立漂浮动态', () => {
  const scene = pond();
  scene.petals.push({ x: 120, y: 180, vx: 0, vy: 0, a: 0, spin: .1, life: 10, age: 1, s: 1 });
  scene.update(1 / 60, { ...base, weather: 'sunny', season: 'summer' });
  assert.equal(scene.petals.length, 1, '更新不应无条件清空已经生成的花瓣');
});

test('鱼达到成长阈值时视觉体型平滑过渡到目标值', () => {
  const scene = pond();
  const fish = scene.sim.fish[0];
  fish.eaten = 0;
  scene.update(1 / 30, { ...base, weather: 'sunny' });
  const start = fish.visualSize;
  fish.eaten = 210;
  scene.update(1 / 60, { ...base, weather: 'sunny' });
  assert.ok(fish.visualSize > start && fish.visualSize < fish.size * scene.scale * 1.4, '成长应先平滑过渡');
  for (let i = 0; i < 180; i++) scene.update(1 / 60, { ...base, weather: 'sunny' });
  assert.ok(Math.abs(fish.visualSize - fish.size * scene.scale * 1.4) < .02, '成长最终达到 1.4 倍上限');
});

test('鱼只避开水面石头，不把荷叶当成水下障碍', () => {
  const scene = pond();
  const rocks = scene.floaters.filter(({ f }) => f[3] === 'r' && f[2] > 25);
  assert.equal(scene.sim.obstacles.length, rocks.length);
  const leaf = scene.R.imageToScreen(1419, 10);
  assert.equal(scene.sim.obstacles.some(o => Math.hypot(o.x - leaf[0], o.y - leaf[1]) < 100), false);
});

test('青蛙没有可用锦鲤目标时朝向池塘中央', () => {
  const scene = pond();
  scene.sim.fish = [];
  scene.frog = new Frog(() => .5);
  scene.frog.place(180, 720);
  scene.update(1 / 30, { ...base, weather: 'cloudy', season: 'summer', frogEnabled: true });
  const expected = Math.atan2(scene.h / 2 - 720, scene.w / 2 - 180);
  assert.ok(Math.abs(context.window.PondCore.wrap(scene.frog.targetAngle - expected)) < .05, '无目标时应看向池塘中央');
});

test('蝌蚪首次随机出现在开放水面，避开青蛙荷叶、乌龟和遮挡物', () => {
  const scene = pond(42);
  scene.turtles[0].x = .28; scene.turtles[0].y = .31;
  scene.spawnTadpoles(1200, 760);
  const schoolX = scene.tadpoles.reduce((n, t) => n + t.x, 0) / scene.tadpoles.length;
  const schoolY = scene.tadpoles.reduce((n, t) => n + t.y, 0) / scene.tadpoles.length;
  assert.ok(Math.hypot(schoolX - scene.turtles[0].x * scene.w, schoolY - scene.turtles[0].y * scene.h) > 110 * scene.scale,
    '蝌蚪不应贴着乌龟出现');
  assert.ok(Math.hypot(schoolX - 1200, schoolY - 760) > 120 * scene.scale,
    '蝌蚪不应从青蛙荷叶位置起步');
  assert.ok(scene.tadpoles.some(t => Math.abs(t.x - schoolX) > 12 * scene.scale && Math.abs(t.y - schoolY) > 8 * scene.scale),
    '蝌蚪初始队形应有松散的不规则偏移');
});

test('白鹭飞行贴图朝向与航迹一致，不用镜像和角度夹断制造错误航向', () => {
  const scene = pond(72);
  const calls = [];
  const egret = new context.window.PondScene.Egret(() => .5);
  Object.assign(egret, { x: 500, y: 400, state: 'flying', heading: Math.PI - .18, flightAngle: Math.PI - .18, age: 1 });
  scene.egret = egret;
  scene.look = { ...lookFor('sunny', false), shadowDir: [.7, .72] };
  scene.R = { sprites: { egretFlight: {}, egretFlightFrames: [{}] }, floater() {}, sprite(layer, def, x, y, angle, sx, sy) { if (layer === 'air') calls.push({ angle, sx, sy }); } };
  egret.draw(scene.R, scene.scale, scene.look);
  const body = calls[0];
  assert.ok(body, '飞行白鹭应绘制主体');
  assert.ok(body.sx > 0, '飞行姿态使用朝局部 +X 的原图，不额外翻转身体');
  assert.ok(Math.abs(body.angle - egret.flightAngle) < 1e-6, '白鹭身体长轴应沿实际航迹旋转');
});

test('白鹭停留时使用完整连续的站立贴图，不叠加脚底光圈', () => {
  const scene = pond(75);
  const body = { id: 'egret-whole-body' }, ring = { id: 'waterline-ring' };
  const calls = [];
  const egret = new context.window.PondScene.Egret(() => .5);
  Object.assign(egret, { x: 500, y: 400, state: 'resting', age: 1, ripple: 3 });
  scene.egret = egret;
  scene.look = { ...lookFor('sunny', false), shadowDir: [.7, .72], night: false };
  scene.R = { sprites: { egretRest: body, ring }, floater() {}, fish() {}, sprite(layer, def, x, y, angle, sx, sy, color) { calls.push({ layer, def, color }); } };
  scene.draw({ turtles: false, butterflies: false, weather: 'sunny', night: false });
  assert.ok(calls.some(c => c.layer === 'surface' && c.def === body), '白鹭主体和双腿应作为一张完整贴图绘制');
  assert.equal(calls.some(c => c.layer === 'under' && c.def === body), false, '不能按固定水平线切断白鹭腿');
  assert.equal(calls.some(c => c.def === ring), false, '脚底不能绘制装饰性椭圆光圈');
});

test('乌龟默认使用程序化分件贴图', () => {
  const scene = pond(74);
  scene.turtles = [scene.turtles[0]];
  scene.look = { ...lookFor('sunny', false), shadowDir: [.7, .72] };
  const calls = [];
  scene.R = { sprites: { turtle0_shell: {}, turtle0_head: {}, turtle0_front: {}, turtle0_back: {}, turtle0_tail: {} }, floater() {}, fish() {}, sprite(layer, def, x, y, angle, sx, sy) { if (layer === 'under') calls.push({ def, sx, sy }); } };
  scene.draw({ turtles: true, butterflies: false, weather: 'sunny', night: false });
  assert.ok(calls.length >= 5, '乌龟应绘制程序化分件');
  assert.equal(calls.some(call => call.def === scene.R.sprites.turtle0_shell), true);
});

test('点击荷叶会产生水波并惊动荷叶下的鱼', () => {
  const scene = pond();
  const [x, y] = scene.R.imageToScreen(1450, 120);
  const fish = scene.sim.fish[0]; fish.x = x / 1672; fish.y = y / 941;
  assert.equal(scene.hitLeaf(x, y), true);
  assert.equal(scene.events.some(e => e.type === 'leaf-tap'), true);
  assert.ok(scene.splashes.length > 0);
  assert.ok(fish.flee > 0);
});

test('雨点打在荷叶、花苞上会溅起水花并让它们颤动，雨停后回稳', () => {
  const scene = pond();
  for (let i = 0; i < 90; i++) scene.update(1 / 30, { ...base, weather: 'rain' });
  assert.ok(scene.splashes.some(p => p.leaf), '荷叶上有雨滴水花');
  assert.ok(scene.floaters.some(f => f.ja !== 0 || f.ox !== 0), '有荷叶或花苞被雨点碰动');
  for (let i = 0; i < 600; i++) scene.update(1 / 30, { ...base, weather: 'sunny' });
  assert.ok(scene.floaters.every(f => Math.abs(f.ja) < .01 && Math.abs(f.ox) < .05 && Math.abs(f.oy) < .05));
  assert.equal(scene.splashes.length, 0);
});

test('大雨偶有闪电，闪光后发出雷声事件；小雨与晴天没有', () => {
  const scene = pond(3); let flashes = 0;
  for (let i = 0; i < 30 * 200; i++) { scene.update(1 / 30, { ...base, weather: 'rain' }); if (scene.look.flash > .05) flashes++; }
  const thunder = scene.events.filter(e => e.type === 'thunder');
  assert.ok(thunder.length >= 2 && thunder.length <= 12, `200 秒内雷声 ${thunder.length} 次`);
  assert.ok(flashes > 0 && thunder.every(e => e.delay >= 1 && e.delay <= 3.5));
  const calm = pond(4); calm.events.length = 0;
  for (let i = 0; i < 30 * 120; i++) calm.update(1 / 30, { ...base, weather: 'rain', rainAmount: .3 });
  assert.equal(calm.events.length, 0);
});


test('手机布局重新映射时，休息态青蛙仍固定于可见荷叶', () => {
  const scene = pond();
  scene.frogCooldown = 0;
  scene.update(0, { ...base, weather: 'sunny', season: 'summer', frogEnabled: true });
  const frog = scene.frog;
  assert.ok(frog);
  const oldX = frog.x, oldY = frog.y;
  scene.R.imageToScreen = (x, y) => [x * .2 + 20, y * .65 + 20];
  scene.layout(390, 844);
  assert.equal(scene.frog, frog);
  assert.ok(scene.lotusSpots.some(([x, y]) => Math.hypot(frog.x - x, frog.y - y) < 5), '手机模式青蛙必须位于荷叶中心');
  assert.ok(Math.hypot(frog.x - oldX, frog.y - oldY) > 20, '不能保留旧屏幕坐标');
  const anchor = [frog.x, frog.y];
  for (let i = 0; i < 60; i++) scene.update(1 / 60, { ...base, weather: 'sunny', season: 'summer', frogEnabled: true });
  assert.equal(frog.state, 'perched');
  assert.ok(Math.hypot(frog.x - anchor[0], frog.y - anchor[1]) < 5);
});

test('原荷叶被手机裁切时，青蛙换到可见荷叶而不是开放水面', () => {
  const scene = pond();
  scene.frogCooldown = 0;
  scene.update(0, { ...base, weather: 'sunny', season: 'summer', frogEnabled: true });
  const frog = scene.frog;
  const oldLeaf = frog.perchObject;
  assert.ok(oldLeaf, '需保存荷叶对象而不仅是屏幕坐标');
  scene.R.imageToScreen = (x, y) => x === oldLeaf.x && y === oldLeaf.y ? [-1000, -1000] : [x * .2 + 20, y * .65 + 20];
  scene.layout(390, 844);
  assert.notEqual(frog.perchObject, oldLeaf);
  assert.ok(scene.lotusSpots.some(([x, y]) => Math.hypot(frog.x - x, frog.y - y) < 5));
});

test('休息态青蛙绘制跟随荷叶漂动，但跳水态不再绑定荷叶', () => {
  const scene = pond();
  scene.frogCooldown = 0;
  scene.update(0, { ...base, weather: 'sunny', season: 'summer', frogEnabled: true });
  const frog = scene.frog, calls = [], leaves = [];
  const leaf = scene.floaters.find(fl => fl.object === frog.perchObject);
  assert.ok(leaf);
  scene.R.sprites = { frog: { forward: 'x' }, frogJump: { forward: 'x' } };
  scene.R.floater = (...args) => leaves.push(args);
  scene.R.sprite = (...args) => calls.push(args);
  scene.time = 30; scene.draw(base);
  const renderedLeaf = leaves.find(a => a[0] === leaf.object.x && a[1] === leaf.object.y);
  const renderedFrog = calls.find(a => a[0] === 'air' && a[1] === scene.R.sprites.frog);
  const [x, y] = scene.R.imageToScreen(leaf.object.x, leaf.object.y);
  assert.ok(Math.abs(renderedFrog[2] - (x + renderedLeaf[6])) < .001);
  assert.ok(Math.abs(renderedFrog[3] - (y + renderedLeaf[7])) < .001);
  assert.equal(frog.jump(frog.x + 80, frog.y + 60), true);
  frog.update(.3);
  const position = [frog.x, frog.y];
  scene.R.imageToScreen = (x, y) => [x * .2 + 20, y * .65 + 20];
  scene.layout(390, 844);
  assert.deepEqual([frog.x, frog.y], position, '不能把正在跳水的青蛙瞬移回荷叶');
});

test('休息态青蛙每次更新锁定荷叶锚点', () => {
  const frog = new Frog(() => .5);
  frog.place(100, 200);
  frog.x = 150; frog.y = 270;
  frog.update(1 / 60);
  assert.deepEqual([frog.x, frog.y], [100, 200]);
});

test('没有可见荷叶时隐藏休息态青蛙，荷叶重新出现后恢复', () => {
  const scene = pond();
  scene.frogCooldown = 0;
  scene.update(0, { ...base, weather: 'sunny', season: 'summer' });
  const frog = scene.frog, leaf = frog.perchObject, calls = [];
  scene.R.imageToScreen = () => [-1000, -1000];
  scene.layout(390, 844);
  assert.equal(frog.perchVisible, false);
  scene.R.sprites = { frog: { forward: 'x' } };
  scene.R.sprite = (...args) => calls.push(args);
  frog.draw(scene.R, scene.scale, scene.look);
  assert.equal(calls.length, 0, '无荷叶不能绘制水面休息青蛙');
  scene.R.imageToScreen = (x, y) => [x * .2 + 20, y * .65 + 20];
  scene.layout(390, 844);
  assert.equal(frog.perchVisible, true);
  assert.equal(frog.perchObject, leaf);
  const point = scene.R.imageToScreen(leaf.x, leaf.y);
  assert.deepEqual([frog.x, frog.y], point);
});
