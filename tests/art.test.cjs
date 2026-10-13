const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const core = require('../core.js');
const gradient = { addColorStop() {} };
let opaqueImageData = false;
class TestImageData { constructor(width, height) { this.width = width; this.height = height; this.data = new Uint8ClampedArray(width * height * 4); if (opaqueImageData) for (let i = 3; i < this.data.length; i += 4) this.data[i] = 255; } }
const canvasMetrics = new WeakMap();
const document = { createElement() { const canvas = { width: 0, height: 0 }, metrics = { calls: 0 }; canvasMetrics.set(canvas, metrics); canvas.getContext = () => new Proxy({}, { get(target, key) { if (key === 'createLinearGradient' || key === 'createRadialGradient') return () => { metrics.calls++; return gradient; }; if (key === 'createImageData') return (w, h) => { metrics.calls++; return new TestImageData(w, h); }; if (key === 'getImageData') return (...args) => { metrics.calls++; return new TestImageData(args[2] || 1, args[3] || 1); }; return () => { metrics.calls++; }; } }); return canvas; } };
const context = { window: { PondCore: core }, document, Path2D: class { moveTo() {} lineTo() {} bezierCurveTo() {} quadraticCurveTo() {} closePath() {} }, ImageData: TestImageData
};
vm.runInNewContext(fs.readFileSync(require.resolve('../art.js'), 'utf8'), context);
const art = context.window.PondArt;
test('白鹭喙前透明边缘会被清理',()=>{
  const w=12,h=12,data=new Uint8ClampedArray(w*h*4); const at=(x,y)=>(y*w+x)*4;
  const set=(x,y,r,g,b,alpha)=>{const i=at(x,y);data[i]=r;data[i+1]=g;data[i+2]=b;data[i+3]=alpha;};
  set(10,6,255,255,255,255);set(9,6,20,20,20,255);
  let written; const ctx={getImageData:()=>({data,width:w,height:h}),putImageData:v=>{written=v.data;}};
  art.cleanImageFringe({width:w,height:h,getContext:()=>ctx},true);
  assert.equal(written[at(10,6)+3],0);
});
test('未加载参考图时程序化蝌蚪贴图可作为回退', () => {
  const sprites = art.miscSprites();
  assert.ok(Array.isArray(sprites.tadpoleFrames) && sprites.tadpoleFrames.length >= 3);
  for (const sprite of sprites.tadpoleFrames) {
    assert.ok(sprite.canvas && sprite.canvas.width >= 32 && sprite.canvas.height >= 16);
    assert.equal(typeof sprite.ppu, 'number');
    assert.ok(sprite.canvas.width / sprite.ppu >= 24, '蝌蚪有效宽度应足够在水下辨认');
    assert.ok(sprite.canvas.height / sprite.ppu >= 11, '蝌蚪头部与摆尾应有清楚轮廓');
    assert.ok(sprite.canvas.width / sprite.ppu >= 34, '蝌蚪参考图是可辨认的长尾幼体，贴图不能只占十几个逻辑像素');
    assert.ok(canvasMetrics.get(sprite.canvas).calls >= 75, '蝌蚪需要立体头部、侧眼、尾膜和多段尾部肌理');
  }
});
test('未加载参考图时程序化白鹭贴图可作为回退', () => {
  const fallback = { canvas: {}, w: 256, h: 192, ppu: 7, px: .5, py: .5 };
  const sprites = art.miscSprites();
  assert.ok(sprites.egretProcedural?.canvas, '应生成程序化白鹭主体');
  assert.ok(sprites.egretProcedural.canvas.width >= 120 && sprites.egretProcedural.canvas.height >= 100, '程序化主体需要容纳长颈和分层羽毛');
  assert.notEqual(sprites.egretRest, fallback, '无 override 时应使用程序化白鹭停留图');
  assert.ok(sprites.egretRest?.canvas, 'egret sprite is drawable');
  for (const pose of ['egretAlert', 'egretProbe', 'egretWing', 'egretStrike']) assert.ok(sprites[pose]?.canvas, `${pose} 需要独立程序化姿态`);
  assert.ok(Array.isArray(sprites.egretFlightFrames) && sprites.egretFlightFrames.length === 3, '白鹭飞行需要程序化的三段展翼姿态');
  assert.ok(sprites.egretFlightFrames.every(frame => frame.canvas), '飞行姿态必须由程序画布绘制');
  assert.notEqual(sprites.egretFlight, fallback, '无 override 时应使用程序化白鹭飞行图');
  assert.ok(canvasMetrics.get(sprites.egretRest.canvas).calls >= 140, '白鹭主体要包含分层翼羽、长颈、尖喙和腿部细节');
});
test('未加载参考图时程序化青蛙贴图可作为回退', () => {
  const supplied = { canvas: {}, w: 256, h: 192, ppu: 8, px: .5, py: .5 };
  const sprites = art.miscSprites(supplied);
  assert.equal(sprites.frog, supplied, '提供青蛙 PNG 时应使用该素材');
  for (const pose of ['frogJump', 'frogSwim']) assert.ok(sprites[pose]?.canvas, `${pose} 需要程序化姿态`);
  assert.ok(sprites.frog?.canvas, 'frog sprite is drawable');
});
test('锦鲤头部是圆钝的吻部、明显窄于身体最宽处，最宽处在身体前部约五分之二', () => {
  for (const seed of [1, 42, 9831]) {
    const g = art.girthOf(seed), w = x => art.halfWidth(x, g, 'kohaku');
    const xs = Array.from({ length: 641 }, (_, i) => 34 - i / 10), widest = xs.reduce((a, x) => w(x) > w(a) ? x : a, 34);
    assert.ok(widest < 12 && widest > 2, `最宽处在 x=${widest}`);
    assert.ok(w(25.8) < w(widest) * .78, '眼部（头宽）明显窄于身体最宽处');
    assert.ok(w(33) > w(widest) * .22, '吻部圆钝，不是尖的');
    assert.ok(w(widest) * 2 / 64 < .34, '身体不过胖');
  }
});
test('纯色锦鲤有可见的鳞片纹理', () => {
  for (const palette of [2, 5, 6]) {
    const L = art.fishLayers(palette, 42, 6), d = L.albedo.data;
    // Along the back from the dorsal fin to the tail stalk, brightness must vary scale by scale, not stay flat.
    const lum = []; for (let x = -20; x < 10; x += .25) { const i = Math.floor((core.BODY.half + 2.5) * 6) * L.W + Math.floor((x - core.BODY.left) * 6); lum.push(d[i * 4] * .3 + d[i * 4 + 1] * .59 + d[i * 4 + 2] * .11); }
    const mean = lum.reduce((a, b) => a + b) / lum.length, sd = Math.sqrt(lum.reduce((a, b) => a + (b - mean) ** 2, 0) / lum.length);
    assert.ok(sd / mean > .04, `${core.PALETTES[palette].name} 鳞片纹理太弱（${(sd / mean).toFixed(3)}）`);
  }
});
test('纯红鱼身和尾鳍在不同随机种子下均无白斑黑斑', () => {
  const red = core.PALETTES.findIndex(p => p.kind === 'benigoi');
  for (const seed of [1, 42, 9831]) {
    const layers = art.fishLayers(red, seed, 2);
    for (const layer of [layers.albedo, layers.fin]) {
      let pixels = 0;
      for (let i = 0; i < layer.data.length; i += 4) {
        const [r, g, b, a] = layer.data.subarray(i, i + 4);
        if (a < 20) continue;
        pixels++; assert.ok(r > g * 2 && r > b * 2 && r > 100);
      }
      assert.ok(pixels > 100);
    }
  }
});
test('青鲢体形比锦鲤修长，背脊深青、两侧腹缘白色', () => {
  for (const seed of [1, 42, 9831]) {
    const koi = art.fishLayers(0, seed, 4), carp = art.fishLayers(0, seed, 4, 'silvercarp');
    assert.notEqual(carp, koi); assert.equal(carp.kind, 'silvercarp');
    const widest = (kind, len, girth) => Math.max(...Array.from({length: len}, (_, i) => art.halfWidth(33 - i, girth, kind))) * 2;
    const carpRatio = 70 / widest('silvercarp', 70, carp.girth), koiRatio = 64 / widest('kohaku', 64, koi.girth);
    assert.ok(carpRatio > 4.3 && carpRatio > koiRatio * 1.25, `鱼身应比锦鲤明显修长（青鲢 ${carpRatio.toFixed(2)}，锦鲤 ${koiRatio.toFixed(2)}）`);
    const sample = (x, y) => {
      const i = Math.floor((y + core.BODY.half) * 4) * carp.W + Math.floor((x - core.BODY.left) * 4);
      return { rgba: Array.from(carp.albedo.data.subarray(i * 4, i * 4 + 4)), shade: carp.shade[i] };
    };
    const back = sample(0, 0).rgba, w = art.halfWidth(0, carp.girth, 'silvercarp');
    assert.ok(back[0] < 45 && back[1] < 90 && back[1] > back[0] * 1.5 && back[2] > back[0] * 1.5);
    for (const side of [-1, 1]) {
      const {rgba: flank, shade} = sample(0, side * w * .85);
      assert.equal(flank[3], 255);
      assert.ok(Math.min(...flank.slice(0, 3)) > 220, '白腹不能呈深灰色');
      assert.ok(Math.min(...flank.slice(0, 3)) * shade > 195, '白腹在贴图明暗处理后仍需清晰');
    }
    assert.ok(sample(-33, 0).rgba[3] > 200, '细长尾柄应连到尾鳍');
  }
});

test('未提供参考图时程序化动物贴图作为加载失败回退', () => {
  const supplied = { canvas: {}, w: 256, h: 192, ppu: 8, px: .5, py: .5 };
  const sprites = art.miscSprites(supplied, undefined, supplied, supplied);
  assert.equal(sprites.frog, supplied);
  assert.equal(sprites.egretFlight, supplied);
  assert.equal(sprites.egretRest, supplied);
  assert.equal(sprites.frog.ppu, 8);
  assert.ok(sprites.frog?.canvas, 'frog override is drawable');
});

test('用户提供的透明 PNG 图集会裁切并实际替换运行时动物贴图', () => {
  opaqueImageData = true;
  try {
    const source = { width: 2560, height: 2560 };
    const references = art.referenceSprites(source, source);
    const sprites = art.miscSprites(undefined, undefined, undefined, undefined, references);
    assert.ok(sprites.frog?.canvas && sprites.frogJump?.canvas && sprites.frogSwim?.canvas);
    assert.ok(Array.isArray(sprites.tadpoleFrames) && sprites.tadpoleFrames.length === 3);
    assert.ok(sprites.tadpoleFrames.every(frame => frame.canvas && frame.ppu === 18));
    assert.ok(sprites.egretRest?.canvas && sprites.egretAlert?.canvas && sprites.egretProbe?.canvas);
    assert.ok(Array.isArray(sprites.egretFlightFrames) && sprites.egretFlightFrames.length === 3);
    assert.equal(sprites.egretHead, null, '整张参考姿态已有头部，不再叠加不匹配的合成头');
    assert.notEqual(sprites.frog, art.miscSprites().frog, '运行时应替换几何回退图，而非仅保留它');
    assert.notEqual(sprites.egretRest, art.miscSprites().egretRest, '白鹭运行时应替换程序化回退图');
  } finally { opaqueImageData = false; }
});

test('仅一张参考图集加载成功时，也只替换对应动物并保留另一类回退贴图', () => {
  opaqueImageData = true;
  try {
    const source = { width: 2560, height: 2560 };
    const frogReferences = art.referenceSprites(source, null);
    const frogSprites = art.miscSprites(undefined, undefined, undefined, undefined, frogReferences);
    assert.notEqual(frogSprites.frog, art.miscSprites().frog, '青蛙图集应独立生效');
    assert.equal(frogSprites.egretFlightFrames.length, 3, '缺失白鹭图集时保留可用白鹭动画回退帧');
    assert.equal(frogSprites.tadpoleFrames.length, 3, '青蛙/蝌蚪参考图应替换蝌蚪帧');
    assert.equal(frogSprites.egretRest.canvas.width, art.miscSprites().egretRest.canvas.width, '缺失白鹭图集时保留白鹭回退图');
    const egretReferences = art.referenceSprites(null, source);
    const egretSprites = art.miscSprites(undefined, undefined, undefined, undefined, egretReferences);
    assert.notEqual(egretSprites.egretRest, art.miscSprites().egretRest, '白鹭图集应独立生效');
    assert.equal(egretSprites.frog.canvas.width, art.miscSprites().frog.canvas.width, '缺失青蛙图集时保留青蛙回退图');
    assert.equal(egretSprites.tadpoleFrames.length, 3, '缺失青蛙/蝌蚪图集时保留蝌蚪回退帧');
  } finally { opaqueImageData = false; }
});

test('独立动作 PNG 会生成青蛙、白鹭姿态贴图并保留缺图回退', () => {
  opaqueImageData = true;
  try {
    const source = { width: 1024, height: 1024 };
    const images = {
      'frog-rest': source, 'frog-swim': source, 'frog-jump': source, 'frog-land': source,
      'egret-rest': source, 'egret-alert-center': source, 'egret-alert-left': source,
      'egret-alert-right': source, 'egret-probe': source, 'egret-halfwing': source,
      'egret-strike': source, 'egret-takeoff': source, 'egret-flight': source,
      'egret-land': source, 'egret-groom': source
    };
    const sprites = art.animalSprites(images);
    for (const key of ['frog', 'frogSwim', 'frogJump', 'frogLand', 'egretRest', 'egretAlert', 'egretAlertLeft', 'egretAlertRight', 'egretProbe', 'egretWing', 'egretStrike', 'egretTakeoff', 'egretFlight', 'egretLand', 'egretGroom']) {
      assert.ok(sprites[key]?.canvas, `${key} 应由独立 PNG 生成`);
      assert.equal(sprites[key].ppu, 8, `${key} 应使用统一逻辑尺寸`);
    }
    for (const key of ['egretRest', 'egretAlert', 'egretAlertLeft', 'egretAlertRight', 'egretProbe', 'egretWing', 'egretStrike', 'egretLand', 'egretGroom']) {
      assert.equal(sprites[key].py, 1, `${key} 应以脚底作为水面锚点`);
    }
    assert.equal(sprites.egretFlight.py, .5, '飞行图仍以身体中心作为锚点');
    assert.ok(sprites.egretFlightFrames.length >= 1, '独立飞行动作应生成可用飞行序列');
    assert.ok(sprites.egretFlightFrames.includes(sprites.egretFlight), '飞行序列应包含独立飞行图');
    assert.equal(sprites.egretFlightFrames[0], sprites.egretFlight, '持续飞行序列应从专用飞行图开始');
    assert.equal(sprites.egretFlightFrames.length, 1, '持续飞行序列不应混入起飞或降落过渡图');
    const partial = art.animalSprites({ 'frog-rest': source });
    assert.ok(partial.frog?.canvas);
    assert.equal(partial.egretRest, undefined, '缺失白鹭动作时交给程序化回退');
  } finally { opaqueImageData = false; }
});
