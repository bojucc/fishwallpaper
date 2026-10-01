const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const html = fs.readFileSync('index.html', 'utf8');
const app = fs.readFileSync('app.js', 'utf8');
const css = fs.readFileSync('style.css', 'utf8');

test('天气图标位于卡片顶部并显示天气模式状态', () => {
  const quick = html.indexOf('class="quick-weather"');
  const top = html.indexOf('class="weather-top"');
  const settings = html.indexOf('data-panel="weather"');
  const clock = html.indexOf('id="clock"');
  assert.ok(quick > top && quick < settings && settings < clock);
  assert.match(html, /id="weather-mode"/);
  assert.match(app, /\$\('#weather-mode'\)\.textContent/);
});

test('天气卡片按顶部信息、中部天气、底部操作三段式组织', () => {
  const card = html.slice(html.indexOf('<aside class="weather-card'), html.indexOf('</aside>'));
  for (const section of ['card-section-top', 'card-section-weather']) {
    assert.match(card, new RegExp(`class="card-section ${section}"`));
  }
  assert.match(html, /class="weather-stack ui"/);
  assert.match(html, /class="actions-card"/);
  assert.doesNotMatch(card, /card-section-actions/);
  assert.match(css, /\.weather-card \.card-section\{[^}]*padding/);
  assert.match(css, /\.weather-card \.card-section \+ \.card-section\{[^}]*border-top/);
  assert.match(css, /@media\(max-width:600px\)[^{}]*\{[^}]*\.weather-card \.card-section/);
});

test('三段式卡片使用可见分隔线和轻微层次背景', () => {
  assert.match(css, /\.weather-card \.card-section \+ \.card-section\{[^}]*border-top:1px solid #ffffff55/);
  assert.match(css, /\.weather-card \.card-section-top\{[^}]*background:linear-gradient/);
  assert.match(css, /\.weather-card \.card-section-weather\{[^}]*background:linear-gradient/);
});

test('卡片透明度滑块使用 10% 下限并直接控制背景 alpha', () => {
  assert.match(app, /type="range"[^>]*min="0\.10"[^>]*max="0\.95"/);
  assert.match(css, /background:rgb\(var\(--card-rgb\) \/ clamp\(/);
  assert.match(css, /var\(--card-opacity\)/);
  assert.match(css, /--card-opacity:\.78/);
});

test('隐藏恢复按钮有过渡和玻璃按钮样式', () => {
  assert.match(css, /\.show-card\{[^}]*transition:/);
  assert.match(css, /\.show-card\{[^}]*box-shadow:/);
});

test('隐藏后恢复入口是紧凑图标而不是竖向侧边条', () => {
  assert.match(css, /\.show-card\{[^}]*width:32px;height:32px/);
  assert.match(css, /\.show-card\{[^}]*border-radius:8px/);
  assert.doesNotMatch(css, /\.show-card\{[^}]*height:54px/);
});

test('天气卡片提供自动与四季五个可访问选项', () => {
  const card = html.slice(html.indexOf('<aside class="weather-card'), html.indexOf('</aside>'));
  assert.match(card, /id="season-label"/);
  for (const season of ['auto', 'spring', 'summer', 'autumn', 'winter']) {
    assert.match(card, new RegExp(`data-season="${season}"`));
  }
  assert.match(app, /querySelectorAll\('\[data-season\]'\)/);
});

test('城市天气响应的 IANA 时区被保存并用于地点设置', () => {
  assert.match(app, /settings\.location\.timezone\s*=\s*data\.timezone/);
  assert.match(app, /settings\.location\?\.timezone/);
  assert.match(app, /new Intl\.DateTimeFormat\('en-US',\{timeZone:l\.timezone\}\)/);
});

test('卡片操作改为图标优先并提供悬停提示', () => {
  const card = html.slice(html.indexOf('<div class="weather-stack'), html.indexOf('<button id="show-card"'));
  for (const label of ['食量榜', '我的锦鲤', '投喂', '声音', '设置', '全屏']) {
    assert.match(card, new RegExp(`data-tooltip="${label}"`));
  }
  for (const weather of ['晴日', '多云', '下雨', '落雪']) {
    assert.match(card, new RegExp(`data-quick-weather="[^"]+"[^>]*data-tooltip="${weather}"`));
  }
  for (const label of ['天气设置', '隐藏卡片']) {
    assert.match(card, new RegExp(`data-tooltip="${label}"`));
  }
  assert.doesNotMatch(card, /\stitle="/);
  assert.match(card, /class="icon-label"/);
});

test('设置面板使用统一分组容器和控件样式钩子', () => {
  assert.match(app, /class="setting-section/);
  assert.match(app, /class="control-grid/);
  assert.match(css, /\.setting-section/);
  assert.match(css, /\.control-grid/);
  assert.match(css, /\.control-select/);
});

test('隐藏恢复入口与卡片共用半透明材质', () => {
  assert.match(css, /\.weather-card[^}]*backdrop-filter:[^;}]+/);
  assert.match(css, /\.show-card[^}]*backdrop-filter:[^;}]+/);
  assert.match(css, /\.show-card[^}]*background:rgb\(var\(--card-rgb\)/);
});

test('卡片文字气泡移到卡片外侧，不遮挡同排图标', () => {
  assert.match(css, /content:attr\(data-tooltip\)/);
  assert.match(css, /\.weather-card \.dock-button::after[^}]*bottom:calc\(100% \+ 8px\)/);
  assert.match(css, /\.weather-card \.quick-weather button::after[^}]*bottom:calc\(100% \+ 8px\)/);
  assert.match(css, /\.weather-card \.weather-top-actions \.icon-button::after[^}]*bottom:calc\(100% \+ 8px\)/);
  assert.match(css, /\.weather-card \.dock-button::after[^}]*pointer-events:none/);
});

test('底部池塘操作与快捷设置保持连续并用细分隔线区分', () => {
  assert.match(css, /\.card-section-actions \.card-primary-actions\{[^}]*margin-bottom:0/);
  assert.match(css, /\.card-section-actions \.card-utility-actions\{[^}]*border-top:1px solid #ffffff2b/);
  assert.match(css, /\.weather-card \.dock-button::after\{[^}]*bottom:calc\(100% \+ 8px\)/);
});

test('天气预报与池塘操作之间有独立的上下分块边界', () => {
  assert.match(css, /\.weather-card \.card-section-actions\{[^}]*border-top:1px solid #ffffff80/);
  assert.match(css, /\.weather-card \.card-section-actions\{[^}]*box-shadow:inset 0 1px 0 #ffffff18/);
});

test('池塘操作区域是独立的下方玻璃块', () => {
  assert.match(css, /\.weather-stack\{[^}]*display:grid/);
  assert.match(css, /\.actions-card\{[^}]*border:1px solid #ffffff38/);
  assert.match(css, /\.actions-card\{[^}]*border-radius:22px/);
  assert.match(css, /@media\(max-width:600px\)\{\.weather-stack\{[^}]*width:190px/);
});

test('上下两张卡共享同一透明度玻璃层次', () => {
  assert.match(css, /\.actions-card\{--action-card-alpha:var\(--card-alpha\)/);
  assert.match(css, /\.actions-card\{[^}]*background:rgb\(var\(--card-rgb\) \/ var\(--action-card-alpha\)\)/);
  assert.match(css, /\.actions-card\{[^}]*box-shadow:0 12px 34px #203d3230/);
});

test('城市和天气模式显示在天气卡片中部', () => {
  const card = html.slice(html.indexOf('<aside class="weather-card'), html.indexOf('</aside>'));
  assert.match(card, /class="weather-location-middle"/);
  assert.match(card, /id="weather-location"/);
  assert.match(card, /id="weather-mode"/);
  assert.doesNotMatch(card.slice(0, card.indexOf('class="card-section card-section-weather"')), /id="weather-location"/);
});

test('时间日期和当前天气按参考排版显示', () => {
  assert.match(app, /const dateLabel=date\.toLocaleDateString\('zh-CN',\{month:'long',day:'numeric'\}\),weekday=date\.toLocaleDateString\('zh-CN',\{weekday:'long'\}\)/);
  assert.match(app, /\$\('#calendar'\)\.textContent=`\$\{dateLabel\}·\$\{weekday\}`/);
  assert.match(css, /\.weather-card #clock\{font-size:43px;font-weight:600/);
  assert.match(css, /\.weather-card \.weather-line>span:last-child\{margin-left:0;font-size:12px/);
  assert.match(css, /\.weather-card \.weather-line>span:last-child::before\{content:'·'/);
});

test('底部快捷操作的气泡显示在按钮下方', () => {
  assert.match(css, /\.actions-card \.card-utility-actions \.dock-button::after\{[^}]*top:calc\(100% \+ 8px\)[^}]*bottom:auto/);
});

test('系统减少透明效果时仍尊重卡片透明度滑块', () => {
  const reducedTransparency = css.match(/@media\(prefers-reduced-transparency:reduce\)\{[^}]+\}/g) || [];
  assert.ok(reducedTransparency.length > 0);
  assert.ok(reducedTransparency.filter(rule => rule.includes('background:')).every(rule => rule.includes('var(--card-opacity)') || rule.includes('var(--card-alpha)')));
  assert.doesNotMatch(css, /prefers-reduced-transparency:reduce\)\{[^}]*\/ \.94/);
});

test('上下卡片背景透明度按透明度滑块反向渲染且文字提示不使用黑框', () => {
  assert.match(css, /--card-alpha:clamp\(\.05,calc\(1 - var\(--card-opacity\)\),\.90\)/);
  assert.match(css, /background:rgb\(var\(--card-rgb\) \/ var\(--card-alpha\)\)/);
  assert.match(css, /background:#e9f5df2a/);
  assert.doesNotMatch(css, /background:#173b35e8/);
});

test('系统减少透明效果时上下卡片使用相同的背景模糊策略', () => {
  assert.match(css, /@media\(prefers-reduced-transparency:reduce\)\{\.actions-card\{backdrop-filter:none;-webkit-backdrop-filter:none\}\}/);
});

test('上下两张卡共享同一个反向透明度变量', () => {
  assert.match(css, /calc\(1 - var\(--card-opacity\)\)/);
  assert.match(css, /\.actions-card\{--action-card-alpha:var\(--card-alpha\)/);
  assert.match(css, /\.actions-card\{[^}]*background:rgb\(var\(--card-rgb\) \/ var\(--action-card-alpha\)\)/);
});

test('投喂选中态使用透明底白色描边', () => {
  assert.match(css, /\.weather-card \.card-primary-actions \.dock-button\.active\{[^}]*background:#ffffff18/);
  assert.match(css, /\.weather-card \.card-primary-actions \.dock-button\.active\{[^}]*border:1px solid #ffffff88/);
});
