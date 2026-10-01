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

test('写实青蛙 PNG 被接入且有程序回退',()=>{
  assert.ok(fs.existsSync(path.join('assets','frog.png')));
  assert.match(appSource,/assets\/frog\.png/);
  assert.ok(fs.existsSync(path.join('assets','turtle.png')));
  assert.match(appSource,/assets\/turtle\.png/);
  assert.match(fs.readFileSync('art.js','utf8'),/miscSprites\(frogOverride/);
});

test('白鹭素材包含飞行与停留两种姿态并接入加载流程',()=>{
  for(const file of ['egret-flight.png','egret-rest.png']){
    assert.ok(fs.existsSync(path.join('assets',file)),`${file} exists in source assets`);
    assert.match(appSource,new RegExp(file.replace('.','\\.')));
  }
  assert.match(fs.readFileSync('art.js','utf8'),/egretFlightOverride/);
  assert.match(appSource,/PondArt\.miscSprites\(/);
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
  assert.match(fs.readFileSync('scene.js','utf8'),/egretEligible/);
  assert.match(fs.readFileSync('scene.js','utf8'),/weather !== 'rain' && weather !== 'snow'/);
});

test('鼠标划过和投喂路径都会通知白鹭附近扰动',()=>{
  assert.match(appSource,/pointermove/);
  assert.match(appSource,/pointermove',e=>\{if\(scene\?\.disturbEgret\(e\.clientX,e\.clientY\)/, '鼠标划过不能依赖按住按钮');
  assert.match(appSource,/disturbEgret/);
  assert.match(appSource,/!feedMode&&scene\.hitEgret/);
});

test('WebGL 和 2D renderer 都提供底图热替换接口',()=>{
  assert.match(gl,/setBedImage\(image\)/);
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
  assert.match(css, /body\.app-loading\s+\.pond-bed\s*\{[^}]*visibility\s*:\s*hidden/);
  assert.match(appSource, /classList\.remove\(['"]app-loading['"]\)/);
});

test('延迟加载的动物素材通过渲染器热更新 WebGL 图集',()=>{
  assert.match(appSource,/renderer\?\.setSprites\(loaded\)/);
  assert.match(gl,/setSprites\(next\)/);
  assert.match(gl,/packSprites\(sprites\)/);
  assert.match(gl,/texSubImage2D\(gl\.TEXTURE_2D, 0, s\.x, s\.y, gl\.RGBA, gl\.UNSIGNED_BYTE, s\.canvas\)/);
});

test('启动资源失败时保留纯色加载背景并显示错误提示',()=>{
  assert.match(appSource,/function startupError\(/);
  assert.doesNotMatch(appSource,/if\(!renderer\)\{document\.body\.classList\.remove\(['"]app-loading['"]\)/);
  assert.doesNotMatch(appSource,/if\(!bedImage\.naturalWidth\)\{document\.body\.classList\.remove\(['"]app-loading['"]\)/);
  assert.match(css,/body\.app-loading\s+#toast\s*\{[^}]*visibility\s*:\s*visible/);
});
