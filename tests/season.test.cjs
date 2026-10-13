const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const appSource=fs.readFileSync('app.js','utf8');
const gl=fs.readFileSync('gl.js','utf8');
const scene=fs.readFileSync('scene.js','utf8');
const html=fs.readFileSync('index.html','utf8');
const css=fs.readFileSync('style.css','utf8');

test('季节资源映射包含四张用户图片并有自动季节状态',()=>{
  for(const file of ['pondchun.png','pondxia.png','pondqiu.png','ponddong.png'])assert.match(appSource,new RegExp(file.replace('.','\\.')));
  assert.match(appSource,/seasonMode/);
  assert.match(appSource,/resolveSeason\(/);
});

test('季节背景有前景遮罩，鱼可从荷叶荷花下方游过',()=>{
  for(const file of ['pondchun-foreground.png','pondxia-foreground.png','pondqiu-foreground.png','ponddong-foreground.png']){
    assert.match(appSource,new RegExp(file.replace('.','\\.')));
    assert.ok(fs.existsSync(path.join('assets',file)),`${file} exists in source assets`);
  }
  assert.match(fs.readFileSync('index.html','utf8'),/pond-foreground/);
  assert.match(fs.readFileSync('style.css','utf8'),/\.pond-foreground/);
});

test('青蛙和白鹭使用 png 动作素材并保留程序化回退，乌龟使用程序化分件',()=>{
  assert.ok(fs.existsSync(path.join('png','frog-rest.png')));
  assert.match(appSource,/\['assets\/frog-rest\.png',8\]/);
  assert.doesNotMatch(appSource,/assets\/turtle\.png/);
  assert.doesNotMatch(fs.readFileSync('art.js','utf8'),/turtleReal/);
  assert.match(appSource,/\['assets\/frog-jump\.png',8\]/);
  assert.match(appSource,/\['assets\/frog-land\.png',8\]/);
  assert.match(appSource,/\['assets\/frog-swim\.png',8\]/);
  assert.match(appSource,/\['assets\/egret-flight\.png',7\]/);
  assert.match(appSource,/\['assets\/egret-rest\.png',7\]/);
  assert.match(fs.readFileSync('art.js','utf8'),/frogJump: frogSprite/);
});

test('前景遮罩不把荷花和花瓣复制到动态层',()=>{
  const script=fs.readFileSync('scripts/generate-foreground.ps1','utf8');
  assert.match(script,/flower/);
  assert.match(script,/alpha\s*=\s*0/);
});

test('四季前景默认关闭，水体仍共享统一浮物标注',()=>{
  assert.match(scene,/FLOAT_OBJECTS/);
  assert.match(scene,/floatMask[\s\S]*FLOAT_OBJECTS/);
  assert.match(scene,/surfaceZones[\s\S]*interaction\.tap/);
  assert.match(css,/\.pond-foreground\s*\{[\s\S]*display:none/);
  assert.match(css,/\.gl\s+\.pond-foreground\s*\{[\s\S]*display:none/);
});

test('白鹭只在晴天或多云低频出现',()=>{
  assert.match(scene,/function egretEligible\(weather, night\)/);
  assert.match(scene,/weather !== 'rain' && weather !== 'snow'/);
  assert.match(scene,/function frogEligible\(season, weather, night\)/);
});;

test('WebGL 和 2D renderer 都提供底图热替换接口',()=>{
  assert.match(gl,/setBedImage\(image, mask\)/);
  assert.match(gl,/kind: 'webgl2'/);
  assert.match(gl,/kind: '2d'/);
});

test('天气切换代码不会清除手动季节模式',()=>{
  const quickHandler=appSource.match(/querySelectorAll\('\[data-quick-weather\]'\)[\s\S]*?\n\$\('#hide-card'/)?.[0]||'';
  assert.doesNotMatch(quickHandler,/seasonMode\s*=\s*['"]auto['"]/);
});

test('静态和 Native Windows/macOS/Android 构建都包含四张季节图片',()=>{
  const files=['pondchun.png','pondxia.png','pondqiu.png','ponddong.png'];
  const build=fs.readFileSync('scripts/build.mjs','utf8');
  const windows=fs.readFileSync('native/windows/BichiPond.csproj','utf8');
  const mac=fs.readFileSync('scripts/build-macos.sh','utf8');
  const android=fs.readFileSync('scripts/build-android.sh','utf8');
  for(const file of files){
    assert.match(build,new RegExp(file.replace('.','\\.')));
    assert.match(windows,new RegExp(file.replace('.','\\.')));
    assert.match(mac,new RegExp(file.replace('.','\\.')));
    assert.match(android,new RegExp(file.replace('.','\\.')));
    assert.ok(fs.existsSync(path.join('assets',file)),`${file} exists in source assets`);
  }
});

test('首帧渲染前隐藏应用层，避免启动底图闪屏',()=>{
  assert.match(html, /<body class="app-loading">/);
  assert.match(css, /body\.app-loading\s+#pond\s*\{/);
  assert.doesNotMatch(css, /body\.app-loading\s+\.pond-bed\s*\{[^}]*visibility\s*:\s*hidden/);
  assert.match(appSource, /classList\.remove\(['"]app-loading['"]\)/);
});

test('启动资源失败时保留纯色加载背景并显示错误提示',()=>{
  assert.match(appSource,/function startupError\(/);
  assert.doesNotMatch(appSource,/if\(!renderer\)\{document\.body\.classList\.remove\(['"]app-loading['"]\)/);
  assert.doesNotMatch(appSource,/if\(!bedImage\.naturalWidth\)\{document\.body\.classList\.remove\(['"]app-loading['"]\)/);
  assert.match(css,/body\.app-loading\s+#toast\s*\{[^}]*visibility\s*:\s*visible/);
});

test('底图切换通过渲染器热替换并保留遮罩接口',()=>{
  assert.match(appSource,/renderer\?\.setBedImage\(image\)/);
  assert.match(appSource,/setSeasonBackdrop\(path\)/);
  assert.match(gl,/function setBedImage\(image, mask\)/);
  assert.match(gl,/texImage2D\([\s\S]*mask\)/);
});;



test('白鹭运行时只使用用户提供的飞翔和水面 PNG',()=>{
  for(const file of ['egret-flight.png','egret-rest.png']) assert.match(appSource,new RegExp(file.replace('.','\\.')));
  assert.match(appSource,/Promise\.allSettled/);
  assert.match(appSource,/spriteFor\(1,7\)/);
  assert.match(appSource,/spriteFor\(2,7\)/);
});

test('白鹭只响应点击且投喂入口不会重复处理同一次点击',()=>{
  assert.match(appSource,/canvas\.addEventListener\('pointerdown',e=>feedAt/);
  assert.match(appSource,/function feedAt\(x,y\).*scene\.hitEgret\(x,y\)/s);
  assert.match(scene,/disturbEgret\(x, y, click = false\)/);
  assert.match(scene,/click \? this\.hitEgret/);
});

test('延迟加载动物素材通过 renderer 热更新图集',()=>{
  assert.match(appSource,/renderer\?\.setSprites\(loaded\)/);
  assert.match(gl,/setSprites\(next\)/);
  assert.match(gl,/packSprites\(next\)/);
  assert.match(gl,/texSubImage2D\(gl\.TEXTURE_2D, 0, s\.x, s\.y, gl\.RGBA, gl\.UNSIGNED_BYTE, s\.canvas\)/);
});

test('启动首帧后移除 app-loading 遮罩',()=>{
  assert.match(appSource,/async function start\(\)/);
  assert.match(appSource,/bedImage=await loadImage\(path\)/);
  assert.match(appSource,/createPond\(\)/);
  assert.match(appSource,/scene\.draw\(settings\)/);
  assert.match(appSource,/document\.body\.classList\.remove\('app-loading'\)/);
});

test('WebGL 图集支持蝌蚪帧数组与两张白鹭状态贴图',()=>{
  assert.match(gl,/function spriteEntries\(sprites\)/);
  assert.match(gl,/if \(Array\.isArray\(value\)/);
  assert.match(scene,/tadpoleFrames/);
  assert.match(scene,/egretRest/);
  assert.match(scene,/egretFlight/);
  assert.doesNotMatch(appSource,/egret-master\.png/);
});
