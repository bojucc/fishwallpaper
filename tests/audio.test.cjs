const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const context = { window: {}, setTimeout };
vm.runInNewContext(fs.readFileSync(require.resolve('../audio.js'), 'utf8'), context);
const { PondAudio } = context.window.PondAudio;

test('声音状态同步是幂等的，不会把重复设置反转', async () => {
  const sound = new PondAudio();
  let resumes = 0, refreshes = 0;
  sound.setup = () => { sound.context = { resume: async () => { resumes++; }, suspend() {} }; };
  sound.refresh = () => { refreshes++; };
  assert.equal(await sound.setActive(true), true);
  assert.equal(await sound.setActive(true), true);
  assert.equal(sound.active, true);
  assert.equal(await sound.setActive(false), false);
  assert.equal(await sound.setActive(false), false);
  assert.equal(sound.active, false);
  assert.equal(resumes, 2);
  assert.equal(refreshes, 4);
});

test('Windows Native 使用无用户手势的 WebView2 声音策略并同步托盘状态', () => {
  const source = fs.readFileSync(require.resolve('../native/windows/PondApp.cs'), 'utf8');
  assert.match(source, /CoreWebView2EnvironmentOptions\("--autoplay-policy=no-user-gesture-required"\)/);
  assert.match(source, /soundOn\s*=\s*!soundOn/);
  assert.match(source, /Command\(soundOn \? "\{soundOn:true\}" : "\{soundOn:false\}"\)/);
});
