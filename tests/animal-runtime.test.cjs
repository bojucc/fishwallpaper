const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const core=require('../core.js');
const window={PondCore:core};
vm.runInNewContext(fs.readFileSync('./art.js','utf8'),{window});
vm.runInNewContext(fs.readFileSync('./scene.js','utf8'),{window});
const {PondScene,Frog,Egret,frogEligible,egretEligible,lookFor}=window.PondScene;
function pond(){
  const rnd=core.randomSeed(123);
  const renderer={drops:[],drop(...args){this.drops.push(args);},imageToScreen:(x,y)=>[x,y]};
  const sim=new core.PondSimulation([core.createFish(0,rnd)],1672,941,rnd,[],false);
  const scene=new PondScene(renderer,sim,rnd);scene.layout(1672,941);return scene;
}
const settings={weather:'sunny',season:'summer',night:false,turtles:false,butterflies:false,crabs:false,egretEnabled:false,frogEnabled:true};
function landed(scene){const e=new Egret(core.randomSeed(3));e.place(500,400,300,400);scene.egret=e;for(let i=0;i<240;i++)e.update(1/60,scene.w,scene.h,scene.scale,scene);return e;}
test('frog sunny warm-season spawn is reliable without a second random gate',()=>{
  const s=pond();for(let i=0;i<900;i++)s.update(1/60,settings);assert.ok(s.frog);assert.ok(s.tadpoles.length>=8);
});
test('frog is present in spring/summer rain, including at night',()=>{
  assert.equal(frogEligible('spring','rain',false),true);
  assert.equal(frogEligible('summer','rain',true),true);
  assert.equal(frogEligible('winter','rain',false),false);
});
test('egret seasons keep daylight sunny/cloudy and exclude rain snow and night',()=>{
  assert.equal(egretEligible('sunny',false),true);assert.equal(egretEligible('cloudy',false),true);
  assert.equal(egretEligible('rain',false),false);assert.equal(egretEligible('snow',false),false);assert.equal(egretEligible('sunny',true),false);
});
test('one body click swims away with splash; three recent clicks keep swimming',()=>{
  const s=pond(),e=landed(s);const count=s.splashes.length;
  assert.equal(s.hitEgret(e.x,e.y),true);assert.equal(e.state,'swimming');assert.ok(s.splashes.length>count);
  s.hitEgret(e.x,e.y);s.hitEgret(e.x,e.y);assert.equal(e.state,'swimming');
});
test('hover and outside clicks leave the egret state unchanged',()=>{
  const s=pond(),e=landed(s),state=e.state;
  assert.equal(s.disturbEgret(e.x,e.y),false);assert.equal(s.hitEgret(e.x+400,e.y),false);assert.equal(e.state,state);
});
test('egret auto departs and leaves screen without interaction',()=>{
  const s=pond(),e=landed(s);for(let i=0;i<4500;i++)e.update(1/60,s.w,s.h,s.scale,s);
  assert.equal(e.state,'gone');assert.ok(e.x<0||e.x>s.w||e.y<0||e.y>s.h);
});
test('egret disturbs nearby koi but not remote koi',()=>{
  const s=pond(),e=landed(s),f=s.sim.fish[0];
  f.x=e.x/s.w;f.y=e.y/s.h;f.flee=0;e.fishCooldown=0;e.update(1/60,s.w,s.h,s.scale,s);assert.ok(f.flee>0);
  f.x=.95;f.y=.95;f.flee=0;e.fishCooldown=0;e.update(1/60,s.w,s.h,s.scale,s);assert.equal(f.flee,0);
});
test('right-facing flight PNG always points along the actual velocity',()=>{
  const s=pond(),e=new Egret(()=>.5);e.place(500,400,200,600);e.update(.5,s.w,s.h,s.scale,s);
  const before=[e.x,e.y];e.update(.01,s.w,s.h,s.scale,s);const wanted=Math.atan2(e.y-before[1],e.x-before[0]);
  const calls=[];e.draw({sprites:{egretFlight:{},egretRest:{}},sprite(...args){calls.push(args);}},1,{...lookFor('sunny',false),shadowDir:[.7,.72]});
  const body=calls.find(a=>a[0]==='air');assert.ok(body);assert.ok(Math.abs(body[4]-wanted)<.03);
});
test('egret turns slowly while swimming',()=>{
  const s=pond(),e=landed(s);
  e.swimTarget=[e.x-80,e.y+80]; const before=e.heading; e.update(1/60,s.w,s.h,s.scale,s);
  assert.ok(Math.abs(window.PondCore.wrap(e.heading-before))<.0045,'水中白鹭每帧转动应更慢');
});
test('frog swims for five seconds rather than disappearing after one',()=>{
  const f=new Frog(()=>.5);f.place(300,300);f.jump(360,300);f.update(.8);f.update(2);assert.equal(f.state,'swimming');f.update(3.1);assert.equal(f.state,'gone');
});
test('tadpoles stay visible in open water for fifteen seconds after frog leaves',()=>{
  const s=pond();s.spawnTadpoles(400,300);for(let i=0;i<840;i++)s.updateTadpoles(1/60,null);
  assert.equal(s.tadpoles.length,14);assert.ok(s.tadpoles.every(t=>t.alpha>.9));
  for(let i=0;i<1800;i++)s.updateTadpoles(1/60,null);assert.equal(s.tadpoles.length,0);
});
test('tadpole render uses a visible +20 percent sprite facing its swimming direction',()=>{
  const s=pond();s.spawnTadpoles(400,300);s.tadpoles[0].heading=.75;
  const sprite={canvas:{width:208,height:120},ppu:4};const calls=[];
  s.R={sprites:{tadpoleFrames:[sprite]},floater(){},sprite(...args){calls.push(args);}};s.sim.fish[0].spriteReady=false;
  s.draw({turtles:false,butterflies:false});const body=calls.find(a=>a[0]==='under'&&a[1]===sprite);
  assert.ok(body);assert.equal(body[4],.75);assert.ok(body[5]>s.scale*.2);
});

test('frog supplied +X poses are used for jump and underwater swim without quarter-turn',()=>{
  const f=new Frog(()=>.5);f.place(300,300);f.angle=0;f.targetAngle=0;
  const sprites={frog:{forward:'x'},frogJump:{forward:'x'},frogSwim:{forward:'x'},frogLand:{forward:'x'}};
  const calls=[],R={sprites,sprite(...args){calls.push(args);}},look={...lookFor('sunny',false),shadowDir:[.7,.72]};
  f.jump(360,300);f.update(.3);f.draw(R,1,look);
  assert.ok(calls.some(a=>a[0]==='air'&&a[1]===sprites.frogJump));
  f.update(.6);calls.length=0;f.draw(R,1,look);
  const swim=calls.find(a=>a[0]==='under');assert.equal(swim[1],sprites.frogSwim);assert.ok(Math.abs(swim[4]-f.angle)<.001);
  f.update(4.5);calls.length=0;f.draw(R,1,look);assert.ok(calls.find(a=>a[0]==='under')[7][3]<.5);
});
