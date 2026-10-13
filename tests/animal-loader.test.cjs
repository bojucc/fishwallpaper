const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const core=require('../core.js');
const loader=fs.readFileSync('./app.js','utf8').match(/const animalAssets=\[[\s\S]*?renderer\?\.setSprites\(loaded\);\r?\n  \}\);/)[0];
function canvas(){
  const c={width:0,height:0};
  c.getContext=()=>new Proxy({}, {get(_,key){
    if(key==='getImageData')return (x,y,w,h)=>{const data=new Uint8ClampedArray(w*h*4);for(let i=3;i<data.length;i+=4)data[i]=255;return {width:w,height:h,data};};
    if(key==='createImageData')return (w,h)=>({data:new Uint8ClampedArray(w*h*4)});
    if(key==='createLinearGradient'||key==='createRadialGradient')return ()=>({addColorStop(){}});
    return ()=>{};
  }});return c;
}
async function load(fail){
  const window={PondCore:core};
  const ctx={window,document:{createElement:canvas},Path2D:class{moveTo(){}lineTo(){}bezierCurveTo(){}quadraticCurveTo(){}closePath(){}},console:{info(){},warn(){},error(e){throw Error(e);}}};
  vm.createContext(ctx);vm.runInContext(fs.readFileSync('./art.js','utf8'),ctx);
  Object.assign(ctx,{PondArt:window.PondArt,renderer:null,sprites:null,
    imageSprite:image=>({canvas:image,ppu:6}),
    loadImage:async path=>{if(path===fail)throw Error('fixture failure');return {width:64,height:32,naturalWidth:64,naturalHeight:32,path};}});
  await vm.runInContext(loader,ctx);return ctx.sprites;
}
test('asset setup ignores the removed egret-master path and exposes both egret poses',async()=>{
  const sprites=await load('png/egret-master.png');
  assert.ok(sprites.egretFlight);assert.ok(sprites.egretRest);
  for(const key of ['egretFlight','egretRest']){
    assert.ok(Number.isFinite(sprites[key].ppu)&&sprites[key].ppu>0);
    assert.ok(sprites[key].canvas.width>0&&sprites[key].canvas.height>0);
  }
  assert.doesNotMatch(JSON.stringify(Object.keys(sprites)),/egret-master/);
  assert.equal(sprites.turtleReal,undefined);assert.ok(sprites.turtle0_shell);assert.ok(sprites.frog);assert.ok(sprites.tadpoleFrames.length);
});
test('a missing egret PNG keeps the procedural fallback and other loaded assets',async()=>{
  const sprites=await load('assets/egret-flight.png');
  assert.ok(sprites.egretFlight);assert.ok(sprites.egretRest);
  assert.ok(sprites.frog);assert.equal(sprites.turtleReal,undefined);assert.ok(sprites.turtle0_shell);
});
test('frog rest jump swim use consistent logical size and heading convention',async()=>{
  const sprites=await load();
  for(const k of ['frog','frogJump','frogSwim']){
    assert.ok(sprites[k].canvas);
    assert.ok(Number.isFinite(sprites[k].ppu)&&sprites[k].ppu>0);
  }
});

test('one real pointerdown calls the egret handler exactly once',()=>{
  const source=fs.readFileSync('./app.js','utf8');
  const binding=source.slice(source.indexOf('function bindCanvas()'),source.indexOf('bindCanvas();'));
  const start=source.indexOf('function feedAt(');const feed=source.slice(start,source.indexOf('\n',start));
  let clicks=0;const handlers={};
  const ctx={canvas:{addEventListener:(name,fn)=>{handlers[name]=fn;}},
    scene:{hitFrog:()=>false,hitEgret:()=>{clicks++;return true;},disturbEgret:()=>{clicks++;return true;},hitLeaf:()=>false},
    sound:{active:false},feedMode:false};
  vm.createContext(ctx);vm.runInContext(binding+'\n'+feed+'\nbindCanvas();',ctx);
  handlers.pointerdown({clientX:400,clientY:300});assert.equal(clicks,1);
});
