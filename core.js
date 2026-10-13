(function (root) {
  'use strict';
  const PALETTES = [
    { name: '红白', base: '#f5f0e2', spot: '#cc4a2c', fin: '#f3f0e6', kind: 'kohaku' },
    { name: '大正三色', base: '#f3eee1', spot: '#c8482c', second: '#1d2526', fin: '#f0ede3', kind: 'sanke' },
    { name: '黄金', base: '#d9a23a', spot: '#d49a2e', fin: '#e2b458', kind: 'ogon' },
    { name: '白写', base: '#efeee5', spot: '#1e2727', fin: '#ecebe3', kind: 'utsuri' },
    { name: '丹顶', base: '#f6f3ea', spot: '#cf3f2b', fin: '#f2f1e9', kind: 'tancho' },
    { name: '墨鲤', base: '#2a3130', spot: '#161c1d', fin: '#444c49', kind: 'karasu' },
    { name: '纯红', base: '#cb3025', spot: '#cb3025', fin: '#c9382c', kind: 'benigoi' },
    { name: '纯白', base: '#fbfaf4', spot: '#fbfaf4', fin: '#f3f1e7', kind: 'shiro' }
  ];
  const POND_MATERIALS = Object.freeze([
    { id: 'stone', name: '青石板', description: '清凉细纹，水色更通透' },
    { id: 'pebble', name: '鹅卵石', description: '圆润颗粒，光影更柔和' },
    { id: 'mud', name: '深泥底', description: '沉静深色，突出锦鲤色彩' },
    { id: 'moss', name: '青苔砖', description: '青绿苔痕，带一点古意' }
  ]);
  const normalizePondMaterial = value => POND_MATERIALS.some(m => m.id === value) ? value : 'stone';
  const SILVER_CARP = { name: '青鲢', base: '#184140', spot: '#184140', fin: '#a9c4bd', kind: 'silvercarp' };
  const fishPalette = f => f.species === 'silvercarp' ? SILVER_CARP : PALETTES[f.palette] || PALETTES[0];
  // Fish body in local units: nose at +34, tail tip at -58; sprites span x -60..36, y -14..14.
  const BODY = { nose: 34, tail: -58, length: 92, segments: 16, rigid: 5, left: -60, width: 96, half: 14 };
  const TAU = Math.PI * 2;
  function randomSeed(seed) { let s = seed >>> 0; return () => { s = (1664525 * s + 1013904223) >>> 0; return s / 4294967296; }; }
  function weatherFromCode(code) { if ([71,73,75,77,85,86].includes(code)) return 'snow'; if (code >= 51) return 'rain'; if (code >= 2) return 'cloudy'; return 'sunny'; }
  const clamp = (x,a,b) => Math.max(a,Math.min(b,x));
  const normalizeCardOpacity = value => Number.isFinite(value) ? clamp(value,.10,.95) : .78;
  const SEASON_MODES = ['auto','spring','summer','autumn','winter'];
  function normalizeSeasonMode(value) { return SEASON_MODES.includes(value) ? value : 'auto'; }
  function seasonForMonth(month) {
    const m = Number(month);
    if (m >= 3 && m <= 5) return 'spring';
    if (m >= 6 && m <= 8) return 'summer';
    if (m >= 9 && m <= 11) return 'autumn';
    return 'winter';
  }
  function monthInTimeZone(date, timeZone) {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) return new Date().getMonth() + 1;
    if (!timeZone) return date.getMonth() + 1;
    try {
      const parts = new Intl.DateTimeFormat('en-US', { timeZone, month: 'numeric' }).formatToParts(date);
      const month = Number(parts.find(p => p.type === 'month')?.value);
      return Number.isInteger(month) ? month : date.getMonth() + 1;
    } catch { return date.getMonth() + 1; }
  }
  function resolveSeason(mode, date = new Date(), timeZone) {
    const normalized = normalizeSeasonMode(mode);
    return normalized === 'auto' ? seasonForMonth(monthInTimeZone(date, timeZone)) : normalized;
  }
  function growthScaleForEaten(eaten, species) {
    if (species === 'silvercarp') return 1;
    const count = Math.max(0, Math.floor(Number(eaten) || 0));
    return count >= 210 ? 1.4 : count >= 120 ? 1.3 : count >= 50 ? 1.2 : 1;
  }
  function fishRenderSize(fish, sceneScale = 1) {
    const scene = Number(sceneScale) || 1;
    const base = clamp(Number(fish?.size) || .8, .45, 1.12);
    // 青鲢保留细长鱼种的原始尺寸；普通锦鲤按累计鱼食阶段成长，
    // 成长阶段最多为初始体型的 1.4 倍，避免成熟锦鲤压过池塘整体比例。
    if (fish?.species === 'silvercarp') return base * scene;
    return base * growthScaleForEaten(fish?.eaten, fish?.species) * scene;
  }
  function normalizeForecast(data) {
    const daily = data?.daily || {}, times = Array.isArray(daily.time) ? daily.time : [], codes = Array.isArray(daily.weather_code) ? daily.weather_code : [], maxes = Array.isArray(daily.temperature_2m_max) ? daily.temperature_2m_max : [], mins = Array.isArray(daily.temperature_2m_min) ? daily.temperature_2m_min : [];
    return Array.from({length:3},(_,i)=>({date:typeof times[i]==='string'?times[i]:'',weather:weatherFromCode(Number(codes[i])),max:Number.isFinite(maxes[i])?Math.round(maxes[i]):null,min:Number.isFinite(mins[i])?Math.round(mins[i]):null}));
  }
  const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
  function createFish(index, random = Math.random) {
    const names = ['锦时','小满','丹朱','听雨','白露','金盏','青禾','望舒','知秋','浮玉','映月','点绛','云游','春水','琥珀','松墨','桃夭','长安','涟漪','拾光','朝露','小暑','如意','团团'];
    return { id: `koi-${Date.now()}-${index}`, name: names[index % names.length], palette: index % PALETTES.length, size: .62 + random() * .4, seed: Math.floor(random()*100000), eaten: 0, x: .17 + random()*.66, y: .18+random()*.62, angle: random()*TAU, phase: random()*10, speed: .85+random()*.3, target: null };
  }
  // Resident shoal is separate from the saved koi collection and its 60-fish limit.
  function createSilverCarpShoal(random = Math.random) {
    return Array.from({ length: 4 }, (_, i) => ({
      ...createFish(i, random), id: `silvercarp-${i}`, species: 'silvercarp', name: `青鲢${i + 1}`,
      size: .88 + random() * .24, x: .36 + i * .075, y: .43 + random() * .12, angle: -.25, speed: 1.12
    }));
  }
  // Runtime-only swimming state; never persisted.
  function wake(f, random) {
    if (f.v !== undefined) return;
    f.v = 0; f.turn = 0; f.thrust = 0; f.amp = .25; f.beating = false;
    f.depth = f.species === 'silvercarp' ? .23 + random() * .2 : .25 + random() * .55; f.depthGoal = f.depth;
    f.goal = null; f.goalTime = 0; f.rest = 0; f.flee = 0; f.fleeAngle = 0; f.softLeave = 0; f.softLeaveAngle = 0;
    f.cruise = (.3 + random() * .22) * clamp(Number(f.speed) || 1, .5, 1.5);
    f.react = .15 + random() * .9; f.appetite = .55 + random() * .45;
    f.spine = null; f.spineSeg = 0;
  }
  // Head-led chain: the front of the body is rigid, the rest follows the path the head swam.
  function updateSpine(f, s, w, h) {
    const rigid = f.species === 'silvercarp' ? 4 : BODY.rigid;
    const n = BODY.segments, seg = BODY.length / n * s, x = f.x * w, y = f.y * h, c = Math.cos(f.angle), si = Math.sin(f.angle);
    const nx = x + c * BODY.nose * s, ny = y + si * BODY.nose * s;
    let p = f.spine;
    if (!p || Math.abs(f.spineSeg - seg) > seg * .3 || Math.hypot(p[0] - nx, p[1] - ny) > seg * 3) {
      p = f.spine = new Float32Array((n + 1) * 2);
      for (let i = 0; i <= n; i++) { p[i*2] = nx - c * seg * i; p[i*2+1] = ny - si * seg * i; }
    }
    f.spineSeg = seg;
    for (let i = 0; i <= rigid; i++) { p[i*2] = nx - c * seg * i; p[i*2+1] = ny - si * seg * i; }
    let prev = f.angle;
    for (let i = rigid + 1; i <= n; i++) {
      const px = p[(i-1)*2], py = p[(i-1)*2+1], lim = f.species === 'silvercarp' ? .13 + .22 * i / n : .1 + .16 * i / n;
      const a = prev + clamp(wrap(Math.atan2(py - p[i*2+1], px - p[i*2]) - prev), -lim, lim);
      p[i*2] = px - Math.cos(a) * seg; p[i*2+1] = py - Math.sin(a) * seg; prev = a;
    }
  }
  // Spine points with the travelling tail-beat wave; out holds x, y, normalX, normalY per point.
  function fishPose(f, s, out = new Float32Array((BODY.segments + 1) * 4)) {
    const silver = f.species === 'silvercarp';
    const n = BODY.segments, p = f.spine, amp = (f.amp || 0) * (silver ? 4.8 : 6.4) * s;
    for (let i = 0; i <= n; i++) {
      const a = Math.max(0, i - 1), b = Math.min(n, i + 1);
      let tx = p[a*2] - p[b*2], ty = p[a*2+1] - p[b*2+1]; const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l;
      const u = i / n, env = .05 + .95 * Math.pow(Math.max(0, (u - .2) / .8), 1.5), lat = amp * env * Math.sin(f.phase - u * (silver ? 6.4 : 5.4));
      out[i*4] = p[i*2] - ty * lat; out[i*4+1] = p[i*2+1] + tx * lat;
    }
    for (let i = 0; i <= n; i++) {
      const a = Math.max(0, i - 1), b = Math.min(n, i + 1);
      let tx = out[a*4] - out[b*4], ty = out[a*4+1] - out[b*4+1]; const l = Math.hypot(tx, ty) || 1;
      out[i*4+2] = -ty / l; out[i*4+3] = tx / l;
    }
    return out;
  }
  class PondSimulation {
    constructor(fish,width,height,random=Math.random,residents=[],residentsOn=true) { this.fish=fish; this.residents=residents; this.residentsOn=residentsOn; this.width=width; this.height=height; this.random=random; this.food=[]; this.totalEaten=0; this.scale=1; this.time=0; this.obstacles=[]; this.events=[]; }
    get allFish() { return this.residentsOn?this.fish.concat(this.residents):this.fish; }
    feed(x,y,count=9,zone='water') {
      if(this.food.length >= 180) return false;
      const normalizedZone = ['rock','leaf','flower','bud','pennywort'].includes(zone) ? zone : 'water';
      const edible = normalizedZone === 'water' || normalizedZone === 'pennywort';
      const life = edible ? 25 : 7;
      for(let i=0;i<count && this.food.length<180;i++){const a=this.random()*TAU,r=Math.sqrt(this.random())*24,px=clamp(x+Math.cos(a)*r,15,this.width-15),py=clamp(y+Math.sin(a)*r,15,this.height-15);
        const insideRock = this.obstacles.some(ob => ob.objectKind === 'rock' && Math.hypot(px-ob.x,py-ob.y) <= ob.r);
        const pelletZone = insideRock ? 'rock' : normalizedZone;
        const pelletEdible = pelletZone === 'water' || pelletZone === 'pennywort';
        this.food.push({x:px,y:py,life:pelletEdible?25:7,age:0,drift:this.random()*6,vx:Math.cos(a)*r*.8,vy:Math.sin(a)*r*.8,eaten:false,blocked:false,zone:pelletZone,edible:pelletEdible});}
      return true;
    }
    // A tap without food startles nearby fish into a short dash away from it.
    scare(x,y,radius=170) {
      for(const f of this.allFish){wake(f,this.random);const dx=f.x*this.width-x,dy=f.y*this.height-y,d=Math.hypot(dx,dy);if(d<radius){f.flee=.45+(1-d/radius)*.7;f.fleeAngle=Math.atan2(dy,dx)+(this.random()-.5)*.9;f.beating=true;f.v=Math.max(f.v,BODY.length*f.size*this.scale*.8);f.depthGoal=Math.min(.95,f.depth+.35);}}
    }
    pickGoal(f) {
      const r=this.random,w=this.width,h=this.height,m=.15,span=Math.min(w,h);let best=null,score=-Infinity;
      for(let i=0;i<8;i++){const gx=m+r()*(1-2*m),gy=m+r()*(1-2*m),dx=(gx-f.x)*w,dy=(gy-f.y)*h,d=Math.hypot(dx,dy);if(this.obstacles.some(o=>Math.hypot(gx*w-o.x,gy*h-o.y)<o.r+40))continue;const sc=-Math.abs(wrap(Math.atan2(dy,dx)-f.angle))*1.2+Math.min(d,span*.6)/span*2+r()*.6;if(sc>score){score=sc;best={x:gx,y:gy};}}
      f.goal=best||{x:.5,y:.5};f.goalTime=7+r()*12;
    }
    step(dt,speedFactor=1) {
      dt=clamp(dt,0,.05);this.time+=dt;const w=this.width,h=this.height;
      for(const p of this.food){p.life-=dt;p.age+=dt;const k=Math.exp(-dt*1.8);p.vx*=k;p.vy*=k;p.x=clamp(p.x+(p.vx+Math.sin(this.time*.35+p.drift)*1.2)*dt,8,w-8);p.y=clamp(p.y+(p.vy+Math.cos(this.time*.29+p.drift*1.3)*1.2)*dt,8,h-8);}
      this.food=this.food.filter(p=>p.life>0&&!p.eaten);
      const sdt=dt*clamp(speedFactor,.1,3);
      const neighbours=this.allFish;
      for(const f of neighbours)wake(f,this.random);
      for(const f of neighbours)this.swim(f,sdt,neighbours);
      if(this.food.some(p=>p.eaten))this.food=this.food.filter(p=>!p.eaten);
    }
    swim(f,dt,neighbours=this.allFish) {
      const w=this.width,h=this.height,s=fishRenderSize(f,this.scale),L=BODY.length*s,random=this.random,silver=f.species==='silvercarp';
      let x=f.x*w,y=f.y*h;const cos=Math.cos(f.angle),sin=Math.sin(f.angle),mx=x+cos*BODY.nose*s,my=y+sin*BODY.nose*s;
      let food=null,fd=Infinity;const reach=Math.max(w,h)*f.appetite;
      for(const p of (f.species === 'silvercarp' ? [] : this.food)){if(p.eaten||p.blocked)continue;const d=Math.hypot(p.x-mx,p.y-my);if(d<fd&&d<reach&&p.age>f.react+d/650){fd=d;food=p;}}
      let gx,gy,want,turnGain=silver?3.5:2,maxTurn=silver?2.4:1.3,sepW=2.4,boundW=3;
      f.flee=Math.max(0,f.flee-dt); f.softLeave=Math.max(0,f.softLeave-dt);
      // Startle: a fast C-turn away, then a dash.
      if(f.flee>0){gx=Math.cos(f.fleeAngle);gy=Math.sin(f.fleeAngle);want=2.6*L;turnGain=9;maxTurn=7;}
      // 不可食鱼食只触发一次温和离开，不使用高速惊逃。
      else if(f.softLeave>0){gx=Math.cos(f.softLeaveAngle);gy=Math.sin(f.softLeaveAngle);want=.72*L;turnGain=2.8;maxTurn=1.8;sepW=1.4;boundW=1;}
      // 不可食鱼食仍然吸引锦鲤靠近，但不会被当成可吃目标。
      else if(food){
        let tx=food.x,ty=food.y;
        if(food.edible===false){
          if(food.zone==='rock'){
            let nearest=null,nearestDistance=Infinity;
            for(const ob of this.obstacles){const od=Math.hypot(food.x-ob.x,food.y-ob.y);if(od<nearestDistance){nearestDistance=od;nearest=ob;}}
            if(nearest){
              let ox=food.x-nearest.x,oy=food.y-nearest.y,od=Math.hypot(ox,oy);
              if(od<1e-6){ox=mx-nearest.x;oy=my-nearest.y;od=Math.hypot(ox,oy)||1;}
              tx=nearest.x+ox/od*(nearest.r+L*.9);ty=nearest.y+oy/od*(nearest.r+L*.9);
            } else ty+=Math.max(24,BODY.nose*s*.8);
          } else {
            // 荷叶、荷花和花苞上的鱼食只吸引鱼游到其下方，并保持在浮物外侧。
            const underOffset = food.zone === 'leaf' ? Math.max(32, BODY.nose*s*1.2) : Math.max(26, BODY.nose*s);
            ty += underOffset;
          }
        } else {
          // 石头外沿的水面鱼食可食，但目标点要落在鱼体安全边界外，避免直冲石头。
          let nearest=null,nearestDistance=Infinity;
          for(const ob of this.obstacles){if(ob.objectKind!=='rock')continue;const ox=food.x-ob.x,oy=food.y-ob.y,od=Math.hypot(ox,oy);if(od>ob.r&&od<ob.r+L*.9&&od<nearestDistance){nearest={ob,ox,oy,od};nearestDistance=od;}}
          tx=food.x;ty=food.y;
        }
        const dx=tx-x,dy=ty-y,d=Math.hypot(dx,dy)||1,err=Math.abs(wrap(Math.atan2(dy,dx)-f.angle));
        gx=dx/d;gy=dy/d;want=clamp(fd/L*1.3,.25,2.2)*L*Math.max(.12,Math.cos(Math.min(err,Math.PI/2))**2);
        if(d<BODY.nose*s*1.15&&err>.6){gx=cos;gy=sin;want=.7*L;}
        turnGain=4.5;maxTurn=3.4;sepW=1.1;boundW=.8;f.depthGoal=food.edible===false?.18:.04;
        if(food.edible===false){
          const blockedDistance=Math.max(45,L*.42);
          if(d<blockedDistance){
            // 鱼已确认目标不可达：停止再次追同一颗鱼食，但让鱼食按区域寿命自然消失。
            food.blocked=true;
            let ax=x-food.x,ay=y-food.y;
            if(food.zone==='rock'){
              let nearest=null,nearestDistance=Infinity;
              for(const ob of this.obstacles){const od=Math.hypot(food.x-ob.x,food.y-ob.y);if(od<nearestDistance){nearestDistance=od;nearest=ob;}}
              if(nearest){ax=x-nearest.x;ay=y-nearest.y;}
            }
            const toCenterX=w*.52-x,toCenterY=h*.56-y;
            const fleeX=ax*1.35+toCenterX*.5,fleeY=ay*1.35+toCenterY*.5;
            f.softLeave=1.35+random()*.5;
            f.softLeaveAngle=Math.atan2(
              fleeY || Math.sin(f.angle),
              fleeX || Math.cos(f.angle)
            );
            // 确认石头遮挡后保持短促、连续的外游动力，避免贴着边缘打转。
            f.beating=true;
            f.v=Math.max(f.v,L*.62);
            f.depthGoal=Math.min(.7,f.depth+.08);
          }
        } else {
          let eatDistance=Math.max(6,7*s);
          // 石头遮挡区由 feed() 的 ob.r 判定；遮挡区外恢复普通进食距离。
          if(fd<eatDistance){food.eaten=true;f.eaten++;this.totalEaten++;this.events.push({type:'eat',x:food.x,y:food.y,fish:f});}
        }
      } else {
        f.goalTime-=dt;
        if(!f.goal||f.goalTime<=0||Math.hypot(f.goal.x*w-x,f.goal.y*h-y)<L*1.3)this.pickGoal(f);
        const a=Math.atan2(f.goal.y*h-y,f.goal.x*w-x)+Math.sin(this.time*.21+f.seed)*.45+Math.sin(this.time*.53+f.seed*1.7)*.2;
        gx=Math.cos(a);gy=Math.sin(a);
        f.rest=Math.max(0,f.rest-dt);if(f.rest<=0&&random()<dt*.02)f.rest=silver?.6+random()*1.2:2+random()*4;
        want=f.cruise*L*(f.rest>0?.12:1);
        if(random()<dt*.015)f.depthGoal=silver?.18+random()*.4:.15+random()*.75;
      }
      // Neighbours: keep personal space, sidestep head-on meetings, loosely match heading.
      let sx=0,sy=0,ax=0,ay=0,cx=0,cy=0,companions=0;
      for(const o of neighbours){
        if(o===f)continue;const ox=o.x*w-x,oy=o.y*h-y,d=Math.hypot(ox,oy);if(d<1e-6)continue;
        const R=(L+BODY.length*o.size*this.scale)*.52,near=1-Math.min(1,Math.abs(o.depth-f.depth)*1.6);
        if(d<R){const k=(1-d/R)**2*near;sx-=ox/d*k;sy-=oy/d*k;}
        if((ox*cos+oy*sin)/d>.8&&d<L*1.6&&near>.3){const side=(oy*cos-ox*sin)>0?-1:1,k=.35*(1-d/(L*1.6));sx-=sin*side*k;sy+=cos*side*k;}
        if(!food&&d<L*2.5&&o.species===f.species){ax+=Math.cos(o.angle);ay+=Math.sin(o.angle);}
        if(f.species==='silvercarp'&&o.species===f.species&&d<L*5){cx+=ox;cy+=oy;companions++;}
      }
      if(companions&&f.flee<=0){const d=Math.hypot(cx,cy);if(d>L){gx+=cx/d*.65;gy+=cy/d*.65;}}
      const al=Math.hypot(ax,ay);if(al>0){ax/=al;ay/=al;}
      // Look ahead and turn back before the pond edge or a lily-pad cluster.
      const mX=Math.min(w*.1+L*.3,w*.3),mY=Math.min(h*.1+L*.3,h*.3),lx=x+cos*L*1.2,ly=y+sin*L*1.2;let bx=0,by=0;
      if(lx<mX)bx=(mX-lx)/mX;else if(lx>w-mX)bx=(w-mX-lx)/mX;
      if(ly<mY)by=(mY-ly)/mY;else if(ly>h-mY)by=(h-mY-ly)/mY;
      for(const ob of this.obstacles)for(const [px,py,R] of [[lx,ly,ob.r+L*.4],[x,y,ob.r+L*.2]]){const dx=px-ob.x,dy=py-ob.y,d=Math.hypot(dx,dy)||1;if(d<R){const k=(1-d/R)*2.5;bx+=dx/d*k;by+=dy/d*k;}}
      const desired=Math.atan2(gy+sy*sepW+ay*.15+by*boundW,gx+sx*sepW+ax*.15+bx*boundW);
      f.turn+=(clamp(wrap(desired-f.angle)*turnGain,-maxTurn,maxTurn)-f.turn)*Math.min(1,dt*(f.flee>0?14:silver?7:4));
      f.angle=wrap(f.angle+f.turn*dt);
      // Beat-and-glide: a few tail strokes to speed up, then coast.
      if(f.v<want*.8)f.beating=true;else if(f.v>want*1.15)f.beating=false;
      f.thrust+=((f.beating?1:0)-f.thrust)*Math.min(1,dt*6);
      if(f.beating)f.v+=(want*1.25-f.v)*(1-Math.exp(-dt*(silver?3.4:2.4)*f.thrust));
      else f.v*=Math.exp(-dt*(f.v>want*1.6?1.6:.5));
      f.v*=Math.exp(-dt*Math.abs(f.turn)*(silver?.17:.25));
      const bl=f.v/L;
      f.phase=(f.phase+dt*TAU*(silver?1.22:1)*(.45+f.thrust*(1.1+1.3*Math.min(2.5,bl))+Math.abs(f.turn)*.35))%(TAU*1000);
      f.amp+=((.14+.86*f.thrust*Math.min(1,.5+bl*.6)+Math.min(.4,Math.abs(f.turn)*.25))-f.amp)*Math.min(1,dt*3);
      x+=Math.cos(f.angle)*f.v*dt;y+=Math.sin(f.angle)*f.v*dt;
      // 最终 containment：鱼不能停留在石头内部；推出后进入短暂逃逸，避免再次被鱼食吸回。
      for(const ob of this.obstacles){
        if(ob.objectKind!=='rock')continue;
        const safe=ob.r+L*.12;
        const escapeSafe=safe+L*.05;
        const dx=x-ob.x;
        const dy=y-ob.y;
        const d=Math.hypot(dx,dy);
        if(d<safe){
          const nx=d>1e-6 ? dx/d : Math.cos(f.angle);
          const ny=d>1e-6 ? dy/d : Math.sin(f.angle);
          const toCenterX=w*.52-x;
          const toCenterY=h*.56-y;
          const awayX=nx*1.35+toCenterX*.5;
          const awayY=ny*1.35+toCenterY*.5;
          const away=Math.atan2(
            awayY || Math.sin(f.angle),
            awayX || Math.cos(f.angle)
          );
          // 推到安全边界之外，避免下一帧继续贴住石头。
          x=ob.x+nx*escapeSafe;
          y=ob.y+ny*escapeSafe;
          // 只施加受限转向速度，保留渐进转弯，避免碰石头时瞬间 180 度掉头。
          f.turn=clamp(
            wrap(away-f.angle)*1.35,
            -1.35,
            1.35
          );
          f.softLeave=Math.max(f.softLeave,1.35);
          f.softLeaveAngle=away;
          f.beating=true;
          f.v=Math.max(f.v,L*.62);
          f.depthGoal=Math.min(.7,f.depth+.08);
          for(const p of this.food){if(p.zone==='rock'&&Math.hypot(p.x-ob.x,p.y-ob.y)<=ob.r+L)p.blocked=true;}
        }
      }
      f.x=clamp(x/w,.03,.97);f.y=clamp(y/h,.035,.965);
      f.depth+=(f.depthGoal-f.depth)*Math.min(1,dt*(food?1.2:.35));
      updateSpine(f,s,w,h);
    }
  }
  function sanitizeSave(data) {
    if(!data||!Array.isArray(data.fish)||!data.fish.length) return null;
    const fish=data.fish.slice(0,60).filter(f=>f&&typeof f.name==='string').map((f,i)=>{
      const defaults=createFish(i,randomSeed(i+8));
      const paintColor=value=>{const raw=String(value||'').trim();if(/^#[0-9a-f]{6}$/i.test(raw))return raw.toLowerCase();if(/^#[0-9a-f]{3}$/i.test(raw))return '#'+raw.slice(1).split('').map(ch=>ch+ch).join('').toLowerCase();const rgb=raw.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);if(rgb){const c=n=>clamp(Number(n)||0,0,255).toString(16).padStart(2,'0');return `#${c(rgb[1])}${c(rgb[2])}${c(rgb[3])}`;}return null;};
      return {...defaults,species:undefined,id:typeof f.id==='string'?f.id.slice(0,80):defaults.id,name:f.name.trim().slice(0,12)||defaults.name,palette:Number.isInteger(f.palette)?clamp(f.palette,0,PALETTES.length-1):0,size:clamp(Number(f.size)||.8,.45,1.12),seed:Number.isFinite(f.seed)?f.seed:defaults.seed,eaten:clamp(Math.floor(Number(f.eaten)||0),0,9999999),marks:Array.isArray(f.marks)?f.marks.slice(0,400).map(m=>{const color=paintColor(m?.color);return m&&color&&Number.isFinite(m.x)&&Number.isFinite(m.y)&&Number.isFinite(m.r)?{x:clamp(m.x,-60,36),y:clamp(m.y,-24,24),r:clamp(m.r,1,8),color}:null;}).filter(Boolean):[]};
    });
    return fish.length?{fish,settings:data.settings&&typeof data.settings==='object'?data.settings:{},daily:data.daily}:null;
  }
// 在core.js末尾添加TadpoleSwarm类
class TadpoleSwarm {
  constructor(count = 25, frogPos = null) {
    this.tadpoles = [];
    for (let i = 0; i < count; i++) {
      this.tadpoles.push({
        // Start in open water rather than directly under the frog/foreground.
        // frogPos remains the homing target used after the call.
        x: 0.18 + Math.random() * 0.64,
        y: 0.24 + Math.random() * 0.54,
        vx: 0, vy: 0,
        phase: Math.random() * 6.28,
        speed: 0.15 + Math.random() * 0.1,
        depth: 0.5 + Math.random() * 0.3
      });
    }
    this.state = 'seeking'; // seeking | following_turtle | following_fish | homing | grouped
    this.targetEntity = null;
    this.frogPos = frogPos;
    this.frogCallTime = 0;
    this.panicUntil = 0;
    this.groupedTime = 0;
    this.opacity = 0;
    this.fadeIn = true;
  }

  update(dt, scene) {
    if (this.fadeIn) {
      this.opacity = Math.min(1, this.opacity + dt * 2);
      if (this.opacity >= 1) this.fadeIn = false;
    }

    // 聚集一段时间后淡出；场景会在青蛙仍在场时按冷却重建一群，
    // 避免一次事件结束后永久看不到蝌蚪。
    if (this.state === 'grouped') {
      this.groupedTime += dt;
      if (this.groupedTime > 210) {
        this.opacity = Math.max(0, this.opacity - dt * 0.35);
        if (this.opacity <= 0) return true; // 标记为可删除
      }
    }

    const w = scene.w || scene.width || 1, h = scene.h || scene.height || 1;
    const allFish = scene.sim ? scene.sim.allFish : [];
    const turtles = scene.turtles || [];
    const turtle = turtles.find(t => t && t.state !== 'hidden') || null;
    const isPanic = Date.now() / 1000 < this.panicUntil;

    // 青蛙蛙鸣召回
    if (this.frogCallTime > 0) {
      this.frogCallTime -= dt;
      if (this.state !== 'homing' && this.state !== 'grouped') {
        this.state = 'homing';
        this.targetEntity = null;
      }
    }

    // 状态机：寻找目标
    if (this.state === 'seeking' && !isPanic) {
      // 优先跟随乌龟
      if (turtle) {
        const tx = turtle.x > 1 ? turtle.x / w : turtle.x, ty = turtle.y > 1 ? turtle.y / h : turtle.y;
        const avgDist = this.tadpoles.reduce((sum, t) =>
          sum + Math.hypot(t.x * w - tx, t.y * h - ty), 0) / this.tadpoles.length;
        this.state = 'following_turtle';
        this.targetEntity = turtle;
      }
      // 无乌龟时跟随大锦鲤或墨鲤
      if (this.state === 'seeking' && allFish.length > 0) {
        const bigFish = allFish.filter(f => f.species !== 'silvercarp')
          .sort((a, b) => (b.size || 0.8) - (a.size || 0.8))[0];
        if (bigFish) {
          this.state = 'following_fish';
          this.targetEntity = bigFish;
        }
      }
    }

    // 更新每只蝌蚪
    for (let i = 0; i < this.tadpoles.length; i++) {
      const t = this.tadpoles[i];
      t.phase += dt * (3 + t.speed * 5);

      let gx = 0, gy = 0;

      if (isPanic) {
        // 恐慌状态：向四周散开
        const cx = this.tadpoles.reduce((s, tt) => s + tt.x, 0) / this.tadpoles.length;
        const cy = this.tadpoles.reduce((s, tt) => s + tt.y, 0) / this.tadpoles.length;
        gx = (t.x - cx) * 3;
        gy = (t.y - cy) * 3;
      } else if (this.state === 'homing' || this.state === 'grouped') {
        // 向青蛙游动
        if (this.frogPos) {
          const dx = this.frogPos.x - t.x, dy = this.frogPos.y - t.y;
          const dist = Math.hypot(dx * w, dy * h);
          if (dist < 80 && this.state === 'homing') {
            this.state = 'grouped';
          }
          gx = dx; gy = dy;
        }
      } else if (this.targetEntity) {
        // 跟随目标
        const tx = this.targetEntity.x > 1 ? this.targetEntity.x / w : this.targetEntity.x;
        const ty = this.targetEntity.y > 1 ? this.targetEntity.y / h : this.targetEntity.y;
        const dx = tx - t.x, dy = ty - t.y;
        const dist = Math.hypot(dx * w, dy * h);

        // 目标太远，重新寻找
        if (dist > 250) {
          this.state = 'seeking';
          this.targetEntity = null;
        } else {
          gx = dx; gy = dy;
        }
      }

      // Boids算法：聚集、对齐、分离
      let cohesionX = 0, cohesionY = 0, separationX = 0, separationY = 0;
      let neighbors = 0;

      for (let j = 0; j < this.tadpoles.length; j++) {
        if (i === j) continue;
        const other = this.tadpoles[j];
        const dx = other.x - t.x, dy = other.y - t.y;
        const dist = Math.hypot(dx * w, dy * h);

        if (dist < 80) {
          cohesionX += dx;
          cohesionY += dy;
          neighbors++;

          if (dist < 25) {
            separationX -= dx / Math.max(dist / w, 0.001);
            separationY -= dy / Math.max(dist / h, 0.001);
          }
        }
      }

      if (neighbors > 0) {
        cohesionX /= neighbors;
        cohesionY /= neighbors;
      }

      gx += cohesionX * 0.5 + separationX * 0.8;
      gy += cohesionY * 0.5 + separationY * 0.8;

      // Keep the small swarm in open water.  Scene obstacles are screen-space
      // circles; convert them once here so tadpoles never disappear beneath a
      // rock or the foreground plant cluster.
      for (const ob of (scene.tadpoleObstacles || scene.obstacles || scene.sim?.obstacles || [])) {
        const ox = ob.x / w, oy = ob.y / h, rr = (ob.r + 18) / Math.min(w, h);
        const dx = t.x - ox, dy = t.y - oy, d = Math.hypot(dx, dy);
        if (d < rr) {
          const inv = 1 / Math.max(d, .001), push = (rr - d) / rr;
          gx += dx * inv * push * 2.4;
          gy += dy * inv * push * 2.4;
        }
      }

      // Keep the school in open water and out of the translucent control stack.
      const bounds = scene.tadpoleBounds || { minX: .1, maxX: .9, minY: .1, maxY: .9 };
      if (t.x < bounds.minX) gx += (bounds.minX - t.x) * 4;
      if (t.x > bounds.maxX) gx -= (t.x - bounds.maxX) * 4;
      if (t.y < bounds.minY) gy += (bounds.minY - t.y) * 4;
      if (t.y > bounds.maxY) gy -= (t.y - bounds.maxY) * 4;

      const len = Math.hypot(gx, gy) || 0.001;
      t.vx += (gx / len * t.speed - t.vx) * Math.min(1, dt * 3);
      t.vy += (gy / len * t.speed - t.vy) * Math.min(1, dt * 3);

      t.x += t.vx * dt;
      t.y += t.vy * dt;
      t.x = Math.max(bounds.minX, Math.min(bounds.maxX, t.x));
      t.y = Math.max(bounds.minY, Math.min(bounds.maxY, t.y));

      // Steering is intentionally soft, but the final integration pass must be
      // hard: a large frame or a freshly laid-out foreground object must never
      // leave a tadpole inside a rock or beneath a floating leaf/flower.
      for (const ob of (scene.tadpoleObstacles || scene.obstacles || scene.sim?.obstacles || [])) {
        const ox = ob.x / w, oy = ob.y / h;
        const rr = (ob.r + 12) / Math.min(w, h);
        const dx = t.x - ox, dy = t.y - oy, d = Math.hypot(dx, dy);
        if (d < rr) {
          const inv = 1 / Math.max(d, .001);
          t.x = Math.max(bounds.minX, Math.min(bounds.maxX, ox + dx * inv * rr));
          t.y = Math.max(bounds.minY, Math.min(bounds.maxY, oy + dy * inv * rr));
          t.vx *= .35;
          t.vy *= .35;
        }
      }
    }

    return false; // 未删除
  }

  onFrogCall(frogPos) {
    this.frogPos = frogPos;
    this.frogCallTime = 2; // 2秒内必须响应
  }

  onMouseDisturb(mx, my, w, h) {
    const avgDist = this.tadpoles.reduce((sum, t) =>
      sum + Math.hypot(t.x * w - mx, t.y * h - my), 0) / this.tadpoles.length;
    if (avgDist < 120) {
      this.panicUntil = Date.now() / 1000 + 3;
    }
  }
}
  const api={PALETTES,SILVER_CARP,POND_MATERIALS,normalizePondMaterial,fishPalette,createSilverCarpShoal,BODY,randomSeed,weatherFromCode,clamp,normalizeCardOpacity,normalizeSeasonMode,seasonForMonth,resolveSeason,growthScaleForEaten,fishRenderSize,normalizeForecast,wrap,createFish,updateSpine,fishPose,PondSimulation,TadpoleSwarm,sanitizeSave};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  else root.PondCore=api;
})(typeof window!=='undefined'?window:globalThis);
