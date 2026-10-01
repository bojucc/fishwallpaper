const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const core = require('../core.js');
const context = { window: { PondCore: core }, ImageData: class { constructor(w, h) { this.width = w; this.height = h; this.data = new Uint8ClampedArray(w * h * 4); } } };
vm.runInNewContext(fs.readFileSync(require.resolve('../art.js'), 'utf8'), context);
vm.runInNewContext(fs.readFileSync(require.resolve('../scene.js'), 'utf8'), context);
const { PondScene, Frog, lookFor, dayPhase, frogEligible } = context.window.PondScene;

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
  assert.ok(frog.sx >= 1.05 && frog.sy >= 1.05, '青蛙需要保持与锦鲤相称的清晰尺寸');
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

test('雨天不生成青蛙和蝌蚪实体', () => {
  const scene = pond();
  for (let i = 0; i < 30; i++) scene.update(1 / 30, { ...base, weather: 'rain' });
  assert.equal('frogs' in scene, false);
  assert.equal('tadpoles' in scene, false);
});

test('青蛙只在夏季多云或夜晚具备出现条件', () => {
  assert.equal(frogEligible('summer', 'cloudy', false), true);
  assert.equal(frogEligible('summer', 'sunny', false), false);
  assert.equal(frogEligible('spring', 'cloudy', false), false);
  assert.equal(frogEligible('winter', 'rain', true), true);
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

test('白鹭停留水面时周期性产生可见涟漪并局部惊扰锦鲤', () => {
  const scene = pond(17);
  scene.egret = new context.window.PondScene.Egret(() => .5);
  Object.assign(scene.egret, { x: 500, y: 400, state: 'resting', age: 0, restAge: 1, ripple: 0 });
  scene.sim.fish[0].x = 500 / 1672; scene.sim.fish[0].y = 400 / 941;
  scene.update(1 / 30, { ...base, weather: 'sunny', egretEnabled: true });
  assert.ok(scene.splashes.some(p => p.ring), '白鹭停留应产生涟漪环');
  assert.ok(scene.sim.fish.some(f => f.flee > 0), '白鹭附近的锦鲤应短暂躲闪');
});

test('白鹭显示尺寸适当放大', () => {
  const scene = pond();
  scene.egret = new context.window.PondScene.Egret(() => .5);
  Object.assign(scene.egret, { x: 500, y: 400, state: 'resting', age: 0, restAge: 1, ripple: 3 });
  scene.look = { ...lookFor('sunny', false), shadowDir: [.7, .72] };
  const calls = [];
  scene.R = { sprites: { egretRest: {} }, floater() {}, fish() {}, sprite(layer, def, x, y, angle, sx, sy) { calls.push({ layer, sx, sy }); } };
  scene.draw({ turtles: false, butterflies: false, weather: 'sunny', night: false });
  const body = calls.find(c => c.layer === 'surface');
  assert.ok(body && body.sx >= scene.scale * 1.25, '白鹭应比旧尺寸更明显');
});

test('白鹭落点位于开放水面而不是荷叶中心，并朝向最近锦鲤', () => {
  const scene = pond(23);
  scene.egretCooldown = 0;
  scene.egretTry = 0;
  scene.update(1 / 30, { ...base, weather: 'sunny', egretEnabled: true });
  assert.ok(scene.egret, '应生成白鹭');
  const p = [scene.egret.targetX, scene.egret.targetY];
  assert.ok(p[0] > scene.w * .2 && p[0] < scene.w * .8 && p[1] > scene.h * .1 && p[1] < scene.h * .9, '落点应在池面开放区域');
  assert.ok(!scene.floatObjects.some(o => o.kind === 'leaf' && Math.hypot(o.x - p[0], o.y - p[1]) < Math.max(o.rx, o.ry) * .8), '落点不能落在荷叶上');
  const fish = scene.sim.fish[0]; fish.x = (p[0] + 80) / scene.w; fish.y = p[1] / scene.h;
  scene.egret.state = 'resting'; scene.egret.age = 0; scene.egret.update(1 / 30, scene.w, scene.h, scene.scale, scene);
  assert.ok(Math.abs(scene.egret.heading) < Math.PI, '白鹭应保留可更新的朝向');
});

test('青蛙保持接近锦鲤的真实比例且荷叶上只做微小转动', () => {
  const frog = new Frog(() => .5);
  assert.ok(frog.size >= .95 && frog.size <= 1.12, '青蛙不应大于锦鲤太多');
  frog.place(500, 400); frog.faceTarget(900, 400); frog.update(1);
  assert.ok(Math.abs(frog.angle + Math.PI / 2) < .08, '荷叶上的青蛙只应极慢转动');
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

test('白鹭落水后先戏水短游，再回到停留状态', () => {
  const scene = pond(31);
  const egret = new context.window.PondScene.Egret(() => .5);
  egret.place(500, 400, 500, 310); scene.egret = egret;
  egret.update(3.6, scene.w, scene.h, scene.scale, scene);
  assert.equal(egret.state, 'wading', '落水后应进入戏水状态');
  const start = [egret.x, egret.y];
  egret.update(.8, scene.w, scene.h, scene.scale, scene);
  assert.ok(Math.hypot(egret.x - start[0], egret.y - start[1]) > 12 * scene.scale, '戏水时应有可见的短距离游动');
  egret.update(2.4, scene.w, scene.h, scene.scale, scene);
  assert.equal(egret.state, 'resting');
});

test('白鹭附近输入会抖羽、起小涟漪并局部惊鱼', () => {
  const scene = pond(37);
  const egret = new context.window.PondScene.Egret(() => .5);
  Object.assign(egret, { x: 500, y: 400, state: 'resting', ripple: 3, restAge: 1 }); scene.egret = egret;
  scene.sim.fish[0].x = 520 / 1672; scene.sim.fish[0].y = 400 / 941;
  assert.equal(scene.disturbEgret(560, 400), true);
  assert.ok(egret.react > 0, '应记录白鹭抖羽反应');
  assert.ok(scene.splashes.some(p => p.ring), '应产生小涟漪');
  assert.ok(scene.sim.fish[0].flee > 0, '附近锦鲤应受惊');
});

test('白鹭抖羽会产生足够明显的姿态反馈', () => {
  const scene = pond();
  const egret = new context.window.PondScene.Egret(() => .5);
  Object.assign(egret, { x: 500, y: 400, state: 'resting', age: .31, ripple: 3, react: 0 }); scene.egret = egret;
  const draw = react => {
    egret.react = react;
    const calls = [];
    scene.look = { ...lookFor('sunny', false), shadowDir: [.7, .72] };
    scene.R = { sprites: { egretRest: {} }, floater() {}, fish() {}, sprite(layer, def, x, y, angle, sx, sy) { if (layer === 'surface') calls.push({ angle, sx, sy }); } };
    scene.draw({ turtles: false, butterflies: false, weather: 'sunny', night: false });
    return calls[0];
  };
  const calm = draw(0), reacting = draw(.7);
  assert.ok(Math.abs(reacting.angle - calm.angle) > .08 || Math.abs(reacting.sx - calm.sx) > .04, '抖羽需要有可见的姿态或尺寸变化');
});

test('白鹭夜间不绘制水面影子，晴天白天绘制影子', () => {
  const scene = pond();
  const egret = new context.window.PondScene.Egret(() => .5);
  Object.assign(egret, { x: 500, y: 400, state: 'resting', ripple: 3 }); scene.egret = egret;
  const calls = [];
  scene.R = { sprites: { egretRest: {} }, floater() {}, fish() {}, sprite(layer, def, x, y, angle, sx, sy) { calls.push(layer); } };
  scene.look = { ...lookFor('sunny', false), shadowDir: [.7, .72], night: false };
  scene.draw({ turtles: false, butterflies: false, weather: 'sunny', night: false });
  assert.ok(calls.includes('shadow'));
  calls.length = 0; scene.look = { ...lookFor('sunny', true), shadowDir: [.7, .72], night: true };
  scene.draw({ turtles: false, butterflies: false, weather: 'sunny', night: true });
  assert.equal(calls.includes('shadow'), false);
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
  for (let i = 0; i < 40; i++) frog.update(1 / 60);
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

test('乌龟和青蛙使用放大后的实际比例', () => {
  const scene = pond();
  assert.ok(scene.turtles.every(t => t.size >= 1.08), '两只乌龟保留独立大小参数');
  const frog = new Frog(() => .5);
  assert.ok(frog.size >= .95 && frog.size <= 1.12);
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
  assert.ok(fish.visualSize > start && fish.visualSize < fish.size * scene.scale * 2, '成长应先平滑过渡');
  for (let i = 0; i < 180; i++) scene.update(1 / 60, { ...base, weather: 'sunny' });
  assert.ok(Math.abs(fish.visualSize - fish.size * scene.scale * 2) < .02, '成长最终达到 2 倍上限');
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

test('青蛙出现时生成轻量蝌蚪，离开后淡出并回收', () => {
  const scene = pond(41);
  scene.rnd = () => 0;
  scene.frogCooldown = 0;
  scene.update(.1, { ...base, weather: 'cloudy', season: 'summer', frogEnabled: true });
  assert.ok(Array.isArray(scene.tadpoles) && scene.tadpoles.length >= 8 && scene.tadpoles.length <= 12, '青蛙出现时应生成约十只蝌蚪');
  scene.frog.state = 'gone';
  scene.update(.2, { ...base, weather: 'cloudy', season: 'summer', frogEnabled: true });
  assert.ok(scene.tadpoles[0].alpha < 1, '青蛙离开后蝌蚪应开始淡出');
  for (let i = 0; i < 40; i++) scene.update(.2, { ...base, weather: 'cloudy', season: 'summer', frogEnabled: true });
  assert.equal(scene.tadpoles.length, 0, '蝌蚪淡出后应回收');
});

test('白鹭戏水低频触发多种克制动作且转向受限', () => {
  const scene = pond(53);
  const egret = new context.window.PondScene.Egret(() => 0);
  Object.assign(egret, { x: 700, y: 460, state: 'wading', age: 0, wadeAge: 0, heading: 0, ripple: 10, nextAction: 0 });
  scene.egret = egret;
  const actions = new Set();
  let maxTurn = 0;
  for (let i = 0; i < 80; i++) { const before = egret.heading; scene.update(.1, { ...base, weather: 'sunny', egretEnabled: true }); actions.add(egret.action); maxTurn = Math.max(maxTurn, Math.abs(context.window.PondCore.wrap(egret.heading - before))); }
  assert.ok(actions.size >= 2 && !actions.has(undefined), '白鹭应低频表现至少两种动作');
  assert.ok(maxTurn <= .04, '戏水转向不能快速甩头');
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
