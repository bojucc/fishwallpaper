import {cp,mkdir,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
await import('./embed.mjs');
// Replace only the web files; dist/ also holds the macOS app, its disk image and the Android APK.
const files=['index.html','style.css','core.js','art.js','gl.js','scene.js','audio.js','app.js','project.json','assets/pond.jpg','assets/pondchun.png','assets/pondxia.png','assets/pondqiu.png','assets/ponddong.png','assets/pondchun-foreground.png','assets/pondxia-foreground.png','assets/pondqiu-foreground.png','assets/ponddong-foreground.png','assets/frog.png','assets/egret-flight.png','assets/egret-rest.png','assets/frog-tadpole-reference.png','assets/egret-reference.png','assets/pond-data.js','assets/favicon.svg','assets/ARTWORK.md'];
const animalPoseFiles=['frog-master','frog-rest','frog-swim','frog-jump','frog-land','egret-rest','egret-flight'];
for(const file of files)await rm(`${root}dist/${file}`,{force:true});
await mkdir(`${root}dist/assets`,{recursive:true});
for(const file of files)await cp(`${root}${file}`,`${root}dist/${file}`);
await mkdir(`${root}dist/png`,{recursive:true});
for(const name of animalPoseFiles)await cp(`${root}png/${name}.png`,`${root}dist/png/${name}.png`);
console.log('静态项目已构建至 dist/；可直接打开 index.html 或导入 Wallpaper Engine。');
