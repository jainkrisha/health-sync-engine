// @ts-nocheck
/*
 * PHC library shelf — a 3D oak bookshelf with one register per Primary Health
 * Centre. Adapted from the "Ashen Press" art-book shelf: the generated cover
 * plates are gone (covers are printed from the PHC data), the palette follows
 * HealthSync, and "Open register" hands the book to the app, which opens it
 * and turns its pages. Runs inside an iframe on /phcs; data arrives by
 * postMessage from the parent page.
 */
import * as THREE from 'three';
import { t, tp } from '../i18n/i18n';
import '../i18n/hindi.css';

/* ════════════════════════════════════════════════════════════════════════
   1 · THE CATALOGUE
   ════════════════════════════════════════════════════════════════════════ */
const K = {
  bookW: 0.887, bookH: 1.33, bookD: 0.17,    // 2:3, the format the plates are shot at
  lean: -0.20, yaw: 0.155,
  bow: 0.0080, chamf: 0.0135, chamfR: 0.022,
  shelfTop: [0.251, -1.241],
  plankHalf: 3.34, plankThick: 0.105, plankDepth: 0.80,
  wallZ: -1.43, bookZ: -1.18,
  slot: 1.235,
  activeDuration: 700, hoverDrop: 400, hoverLift: 1000,
  introStagger: 78, introWallFade: 1000, introFade: 460,
  fov: 20,
  boxX: 5.86, boxY: 3.36, boxCY: 0.06, offset: 1.25, maxWidthPx: 1550,
  orbitAz: 0.085, orbitEl: 0.052,
  activeX: 0.72, activeRot: [0.075, 0.285, 0.0],
  mTilt: -Math.PI/7, mFlat: -0.06,
  mStepZ: 0.15, mStepY: 0.17, mY: 0.30, mZ0: 0.75,
  mFill: 0.62, mDrop: 0.22,
};
const MOBILE_Q = window.matchMedia('(max-width: 767px)');
let MOBILE = MOBILE_Q.matches;
const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
if(REDUCED){ K.introStagger=0; K.introWallFade=260; K.introFade=200;
             K.hoverLift=260; K.hoverDrop=200; K.activeDuration=300;
             K.orbitAz=0; K.orbitEl=0; }

const STUDIO = t('District Health Network');

// Static labels in bookshelf.html, in the language the app is set to.
for (const id of ['detail-look', 'detail-close', 'hint', 'mbar-details', 'mbar-look']) {
  const el = document.getElementById(id);
  if (el) el.textContent = t(el.textContent.trim());
}
document.getElementById('menubtn')?.setAttribute('aria-label', t('All PHCs'));
const SPINES = [
  { spine:'#2b3d55', cloth:'#141b26' },
  { spine:'#9a4022', cloth:'#1d120d' },
  { spine:'#4a7562', cloth:'#121a16' },
  { spine:'#b0843a', cloth:'#1b150c' },
  { spine:'#7a3b3b', cloth:'#1b0f0f' },
  { spine:'#3a4b5e', cloth:'#11161c' },
  { spine:'#c4612f', cloth:'#1c110b' },
  { spine:'#5c554a', cloth:'#151310' },
  { spine:'#2f4a3f', cloth:'#0f1512' },
  { spine:'#6b2f1f', cloth:'#170c08' },
];
const ROMAN = ['I','II','III','IV','V','VI','VII','VIII','IX','X'];
const BOOKS = [];
/** Lays the PHCs out on the two shelves, centred on each plank. */
function setCatalogue(phcs){
  BOOKS.length = 0;
  const list = phcs.slice(0, 10);
  const top = Math.ceil(list.length / 2);
  list.forEach((p, i) => {
    const shelf = i < top ? 0 : 1;
    const row = shelf === 0 ? top : list.length - top;
    const k = shelf === 0 ? i : i - top;
    const sp = SPINES[i % SPINES.length];
    const short = p.name.replace(/^PHC\s+/i, '');
    const online = p.devices.filter(d => d.online).length;
    BOOKS.push({
      id: 'phc-' + i, name: p.name, title: p.name,
      t1: t('PHC'), t2: short.toUpperCase(),
      sub: t('PATIENT REGISTER') + ' · ' + tp(p.patientCount, '{count} PATIENT', '{count} PATIENTS'),
      year: p.since ? String(new Date(p.since).getFullYear()) : '2026',
      vol: ROMAN[i] || String(i + 1), shelf, slotX: (k - (row - 1) / 2) * K.slot,
      spine: sp.spine, cloth: sp.cloth, edge: '#efe9dd',
      patients: p.patientCount, staff: p.staff.length, devices: p.devices.length, online,
      conflicts: p.openConflicts.length,
      blurb: tp(p.patientCount, '{count} patient registered, {staff} staff,', '{count} patients registered, {staff} staff,', { staff: p.staff.length }) + ' ' +
             tp(p.devices.length, '{online} of {count} device online.', '{online} of {count} devices online.', { online }) + ' ' +
             (p.openConflicts.length ? tp(p.openConflicts.length, '{count} dose waiting for review.', '{count} doses waiting for review.') : t('No doses waiting for review.')),
    });
  });
}

/* ════════════════════════════════════════════════════════════════════════
   2 · CANVAS HELPERS
   ════════════════════════════════════════════════════════════════════════ */
const TAU = Math.PI*2;
const SANS  = '"Geist Mono",ui-monospace,"SF Mono",Menlo,monospace';
const SERIF = 'Geist,Inter,"Helvetica Neue",Arial,sans-serif';
const MONO  = '"Geist Mono",ui-monospace,"SF Mono",Menlo,Monaco,Consolas,monospace';

const clamp = (v,a,b)=>v<a?a:v>b?b:v;
const lerp  = (a,b,t)=>a+(b-a)*t;
const smooth= t=>t<=0?0:t>=1?1:t*t*(3-2*t);
function mulberry(seed){let a=seed>>>0;return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}

function C(w,h){const c=document.createElement('canvas');c.width=w;c.height=h===undefined?w:h;return c;}
function rr(g,x,y,w,h,r){r=Math.min(r,w/2,h/2);g.beginPath();g.moveTo(x+r,y);g.arcTo(x+w,y,x+w,y+h,r);g.arcTo(x+w,y+h,x,y+h,r);g.arcTo(x,y+h,x,y,r);g.arcTo(x,y,x+w,y,r);g.closePath();}
function lg(g,x0,y0,x1,y1,stops){const t=g.createLinearGradient(x0,y0,x1,y1);for(const s of stops)t.addColorStop(s[0],s[1]);return t;}
function rg(g,x,y,r0,r1,stops,x1,y1){const t=g.createRadialGradient(x,y,r0,x1===undefined?x:x1,y1===undefined?y:y1,r1);for(const s of stops)t.addColorStop(s[0],s[1]);return t;}
// Letter-spaced text is drawn one character at a time; Devanagari has to be drawn
// whole, or its conjuncts and vowel signs come apart.
const units = text => /[^\x00-\x7F]/.test(text) ? [text] : [...text];
function tracked(g,text,x,y,track,align){
  let w=0;for(const ch of units(text))w+=g.measureText(ch).width+track;w-=track;
  let cx = align==='center'? x-w/2 : align==='right'? x-w : x;
  const prev=g.textAlign;g.textAlign='left';
  for(const ch of units(text)){g.fillText(ch,cx,y);cx+=g.measureText(ch).width+track;}
  g.textAlign=prev;return w;
}
function fitTracked(g,text,w,weight,family,track){
  let lo=4,hi=3000;
  const meas=px=>{g.font=`${weight} ${px}px ${family}`;let t=0;for(const ch of units(text))t+=g.measureText(ch).width+track*px;return t-track*px;};
  for(let i=0;i<26;i++){const m=(lo+hi)/2;if(meas(m)>w)hi=m;else lo=m;}
  g.font=`${weight} ${lo}px ${family}`;return lo;
}
function grain(g,W,H,amount,seed){
  const r=mulberry(seed||7);const img=g.getImageData(0,0,W,H),d=img.data;
  for(let i=0;i<d.length;i+=4){const n=(r()-0.5)*amount;d[i]+=n;d[i+1]+=n;d[i+2]+=n;}
  g.putImageData(img,0,0);
}
function cloth(g,W,H,seed,amt){
  const r=mulberry(seed||3);
  g.save();g.globalAlpha=amt===undefined?.05:amt;
  for(let y=0;y<H;y+=3){g.fillStyle=r()>.5?'#fff':'#000';g.fillRect(0,y,W,1);}
  for(let x=0;x<W;x+=3){g.fillStyle=r()>.5?'#fff':'#000';g.fillRect(x,0,1,H);}
  g.restore();
}
function rule(g,x0,y0,x1,y1,col,w){g.strokeStyle=col;g.lineWidth=w;g.beginPath();g.moveTo(x0,y0);g.lineTo(x1,y1);g.stroke();}

const PLATE = {};                 // no photographic plates: covers are printed from the data
function loadPlates(){ return Promise.resolve(); }
const FOIL = '#efe9dd';

function paintCover(b,W,H){
  const c=C(W,H),g=c.getContext('2d');
  const img=PLATE[b.id];
  if(img){                                        // cover-fit the generated plate
    const k=Math.max(W/img.naturalWidth,H/img.naturalHeight);
    const dw=img.naturalWidth*k, dh=img.naturalHeight*k;
    g.drawImage(img,(W-dw)/2,(H-dh)/2,dw,dh);
  } else {
    g.fillStyle=b.cloth;g.fillRect(0,0,W,H);
    g.fillStyle=rg(g,W*.5,H*.58,W*.02,W*.95,[[0,b.spine],[.55,b.spine+'99'],[1,'rgba(0,0,0,0)']]);g.fillRect(0,0,W,H);
    cloth(g,W,H,b.vol.length*11+3,.045);
    // emblem: a cross inside two rings, foil-stamped
    g.save();g.translate(W*.5,H*.56);
    g.strokeStyle='rgba(239,233,221,.55)';g.lineWidth=W*.006;
    g.beginPath();g.arc(0,0,W*.17,0,TAU);g.stroke();
    g.setLineDash([W*.012,W*.018]);g.globalAlpha=.6;
    g.beginPath();g.arc(0,0,W*.13,0,TAU);g.stroke();
    g.setLineDash([]);g.globalAlpha=1;g.fillStyle=FOIL;
    const a=W*.035,l=W*.085;
    g.fillRect(-a,-l,a*2,l*2);g.fillRect(-l,-a,l*2,a*2);
    g.restore();
  }
  // house scrims — the type reads on every plate without hiding the picture
  g.fillStyle=lg(g,0,0,0,H*.44,[[0,'rgba(9,8,7,.76)'],[.42,'rgba(9,8,7,.36)'],[1,'rgba(9,8,7,0)']]);
  g.fillRect(0,0,W,H*.44);
  g.fillStyle=lg(g,0,H*.70,0,H,[[0,'rgba(9,8,7,0)'],[.55,'rgba(9,8,7,.34)'],[1,'rgba(9,8,7,.72)']]);
  g.fillRect(0,H*.70,W,H*.30);
  // hairline foil frame
  g.strokeStyle='rgba(239,228,204,.34)';g.lineWidth=W*.0032;
  g.strokeRect(W*.052,H*.038,W*.896,H*.924);
  // title block
  g.textAlign='center';g.textBaseline='alphabetic';
  const fam='Geist,Inter,sans-serif';
  let y;
  if(b.t2){
    const s1=Math.min(W*.075,fitTracked(g,b.t1,W*.70,'700',fam,0.12));g.font=`700 ${s1}px ${fam}`;
    g.fillStyle=FOIL;tracked(g,b.t1,W*.5,H*.128,s1*0.085,'center');
    const s2=Math.min(W*.13,fitTracked(g,b.t2,W*.80,'800',fam,0.02));g.font=`800 ${s2}px ${fam}`;
    g.fillStyle=FOIL;tracked(g,b.t2,W*.5,H*.128+s2*1.02,s2*0.02,'center');
    y=H*.128+s2*1.02;
  } else {
    const s1=fitTracked(g,b.t1,W*.82,'500',fam,0.075);
    g.fillStyle=FOIL;tracked(g,b.t1,W*.5,H*.163,s1*0.075,'center');
    y=H*.163;
  }
  rule(g,W*.30,y+H*.030,W*.70,y+H*.030,'rgba(239,228,204,.5)',W*.0026);
  g.font=`400 ${W*.0215}px ${SANS}`;g.fillStyle='rgba(240,231,212,.86)';
  tracked(g,b.sub,W*.5,y+H*.064,W*.0215*.20,'center');
  // foot
  g.globalAlpha=.72;g.fillStyle=FOIL;
  g.font=`400 ${W*.0195}px ${SANS}`;
  tracked(g,t('REGISTER')+' '+b.vol,W*.5,H*.884,W*.0195*.34,'center');
  g.globalAlpha=.92;
  g.font=`500 ${W*.0215}px ${SANS}`;
  tracked(g,'HEALTHSYNC',W*.5,H*.920,W*.0215*.34,'center');
  g.globalAlpha=1;
  grain(g,W,H,6,b.id.length*37+5);
  return c;
}

/* ---------- back cover, spine, page block ---------- */
function isLight(hex){
  const n=parseInt(hex.slice(1),16);
  return (((n>>16&255)*.299+(n>>8&255)*.587+(n&255)*.114))>150;
}
function artBack(b,W,H){
  const c=C(W,H),g=c.getContext('2d'),r=mulberry(b.id.length*911+7);
  const light=isLight(b.cloth);
  const ink = light? '#26221c' : '#efe8da';
  g.fillStyle=b.cloth;g.fillRect(0,0,W,H);
  g.fillStyle=rg(g,W*.5,H*.34,W*.05,W*.95,
    [[0,light?'rgba(255,255,255,.55)':'rgba(255,255,255,.10)'],[1,'rgba(0,0,0,0)']]);
  g.fillRect(0,0,W,H);
  // three figures from the register
  const stats=[[b.patients,t('PATIENTS')],[b.staff,t('STAFF')],[b.devices,t('DEVICES')]];
  for(let i=0;i<3;i++){
    const x=W*(.10+i*.28), y=H*.115, w=W*.24, h=w*1.0;
    g.save();
    g.fillStyle=light?'#ddd5c4':'rgba(255,255,255,.06)';g.fillRect(x,y,w,h);
    g.strokeStyle=light?'rgba(40,34,28,.35)':'rgba(240,232,218,.28)';g.lineWidth=W*.0025;g.strokeRect(x,y,w,h);
    g.fillStyle=ink;g.textAlign='center';
    g.font=`800 ${W*.09}px ${SERIF}`;g.fillText(String(stats[i][0]),x+w/2,y+h*.62);
    g.globalAlpha=.7;g.font=`500 ${W*.019}px ${MONO}`;tracked(g,stats[i][1],x+w/2,y+h*.86,W*.019*.25,'center');
    g.restore();
  }
  g.fillStyle=ink;g.globalAlpha=.55;g.font=`400 ${W*.017}px ${MONO}`;g.textAlign='left';
  g.fillText(t('PHC REGISTER')+' · '+b.year,W*.10,H*.415);
  g.globalAlpha=1;
  // blurb
  g.font=`400 ${W*.030}px ${SERIF}`;g.fillStyle=ink;
  const words=b.blurb.split(' ');let line='',y=H*.505;
  for(const w0 of words){
    const t=line?line+' '+w0:w0;
    if(g.measureText(t).width>W*.80){g.fillText(line,W*.10,y);line=w0;y+=W*.042;}
    else line=t;
  }
  g.fillText(line,W*.10,y);
  g.globalAlpha=.7;g.font=`400 ${W*.020}px ${SANS}`;
  tracked(g,`${STUDIO.toUpperCase()} · ${b.year}`,W*.10,y+W*.075,W*.020*.18,'left');
  g.globalAlpha=1;
  // imprint roundel
  g.save();g.translate(W*.13,H*.855);
  g.strokeStyle=ink;g.globalAlpha=.55;g.lineWidth=W*.0035;
  g.beginPath();g.arc(0,0,W*.058,0,TAU);g.stroke();
  g.globalAlpha=1;g.fillStyle=ink;
  g.font=`500 ${W*.030}px ${SERIF}`;g.textAlign='center';g.textBaseline='middle';
  g.fillText('HS',0,W*.002);g.restore();
  g.textAlign='left';g.textBaseline='alphabetic';
  g.fillStyle=ink;g.font=`500 ${W*.022}px ${SANS}`;
  tracked(g,'HEALTHSYNC',W*.215,H*.845,W*.022*.30,'left');
  g.globalAlpha=.6;g.font=`400 ${W*.020}px ${SANS}`;
  g.fillText(t('Register {vol} of the district',{vol:b.vol}),W*.215,H*.875);
  g.globalAlpha=1;
  // barcode
  const bx=W*.60,by=H*.815,bw=W*.30,bh=H*.085;
  g.fillStyle=light?'#ffffff':'#f2ece0';g.fillRect(bx,by,bw,bh);
  g.fillStyle='#15120f';
  let px=bx+bw*.04;
  while(px<bx+bw*.96){const w=W*(.002+ (r()<.3?.006:.002)*r()*3);g.fillRect(px,by+bh*.10,w,bh*.66);px+=w+W*(.002+r()*.004);}
  g.font=`400 ${W*.017}px ${MONO}`;g.textAlign='center';
  g.fillText('9 78'+(1000000+((r()*8999999)|0)),bx+bw/2,by+bh*.93);
  g.textAlign='right';g.fillStyle=ink;g.globalAlpha=.75;g.font=`400 ${W*.020}px ${SANS}`;
  g.globalAlpha=1;
  grain(g,W,H,8,5);
  return c;
}
function artSpine(b,W,H){
  const c=C(W,H),g=c.getContext('2d');
  const light=isLight(b.spine);
  const ink=light?'#26221c':'#f3ece0';
  g.fillStyle=b.spine;g.fillRect(0,0,W,H);
  g.strokeStyle=ink;g.globalAlpha=.5;g.lineWidth=W*.035;
  g.beginPath();g.moveTo(W*.22,H*.052);g.lineTo(W*.78,H*.052);g.stroke();
  g.beginPath();g.moveTo(W*.22,H*.912);g.lineTo(W*.78,H*.912);g.stroke();
  g.globalAlpha=1;
  g.save();g.translate(W*.52,H*.10);g.rotate(Math.PI/2);
  g.fillStyle=ink;g.textAlign='left';g.textBaseline='middle';
  const t=b.title.toUpperCase();
  const ts=Math.min(W*.42,fitTracked(g,t,H*.56,'700','Geist,Inter,sans-serif',0.06));g.font=`700 ${ts}px Geist,Inter,sans-serif`;
  tracked(g,t,0,0,ts*0.07,'left');
  g.globalAlpha=.72;g.font=`400 ${W*.20}px ${SANS}`;
  tracked(g,STUDIO.toUpperCase(),H*.60,0,W*.20*.2,'left');
  g.restore();
  g.globalAlpha=1;g.fillStyle=ink;
  g.textAlign='center';g.textBaseline='middle';
  g.font=`500 ${W*.30}px ${SERIF}`;
  g.fillText('HS',W*.52,H*.955);
  g.font=`400 ${W*.20}px ${SANS}`;g.globalAlpha=.75;
  g.fillText(b.vol,W*.52,H*.032);
  return c;
}

/* ---------- oak ---------- */
function woodTexture(px){
  const W=px, Hh=Math.round(px*0.5);
  const c=C(W,Hh),g=c.getContext('2d'),r=mulberry(909);
  g.fillStyle='#7d5228';g.fillRect(0,0,W,Hh);
  // sapwood/heartwood drift, kept low-contrast so it never reads as plywood
  for(let i=0;i<14;i++){
    g.fillStyle=`rgba(${146+r()*40|0},${98+r()*26|0},${48+r()*22|0},${.06+r()*.09})`;
    g.beginPath();g.ellipse(r()*W,r()*Hh,W*(.10+r()*.30),Hh*(.06+r()*.20),0,0,TAU);g.fill();
  }
  // the grain itself: many tight, slightly wandering lines
  for(let i=0;i<430;i++){
    const y0=r()*Hh, amp=Hh*(.004+r()*.020), f=0.6+r()*2.2, ph=r()*TAU;
    const dark=r()<.34;
    g.strokeStyle=dark
      ? `rgba(${38+r()*26|0},${22+r()*16|0},${9+r()*10|0},${.36+r()*.55})`
      : `rgba(${186+r()*40|0},${138+r()*32|0},${80+r()*26|0},${.14+r()*.32})`;
    g.lineWidth=dark?(0.8+r()*1.8):(0.8+r()*2.6);
    g.beginPath();
    for(let x=0;x<=W;x+=8){
      const y=y0+Math.sin(x/W*TAU*f+ph)*amp+Math.sin(x/W*TAU*f*2.7+ph*2)*amp*.4;
      x?g.lineTo(x,y):g.moveTo(x,y);
    }
    g.stroke();
  }
  // cathedral figure — a few nested arcs, low contrast
  for(let k=0;k<4;k++){
    const cx=W*(.1+r()*.8), cy=Hh*(.15+r()*.7), sw=W*(.02+r()*.05);
    for(let i=0;i<14;i++){
      g.strokeStyle=`rgba(${62+r()*26|0},${38+r()*18|0},${16+r()*12|0},${.12+r()*.20})`;
      g.lineWidth=0.8+r()*1.6;
      g.beginPath();
      g.moveTo(cx-sw*(1+i*.30),cy+Hh*.5);
      g.quadraticCurveTo(cx,cy-Hh*(.12+i*.05),cx+sw*(1+i*.30),cy+Hh*.5);
      g.stroke();
    }
  }
  // medullary rays + open pores
  for(let i=0;i<520;i++){
    g.fillStyle=`rgba(${208+r()*26|0},${172+r()*28|0},${118+r()*28|0},${.05+r()*.15})`;
    g.fillRect(r()*W,r()*Hh,1+r()*2,Hh*(.01+r()*.05));
  }
  for(let i=0;i<9000;i++){
    g.fillStyle=`rgba(${44+r()*28|0},${26+r()*16|0},${10+r()*10|0},${.12+r()*.34})`;
    g.fillRect(r()*W,r()*Hh,1+r()*4,1);
  }
  const t=new THREE.CanvasTexture(c);
  t.colorSpace=THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=8;
  return t;
}

/* ---------- limewashed wall, baked ---------- */
const WALL = {x0:-9.15,x1:9.15,y0:-9.67,y1:8.63};
const WT = {
  peak:231, bell:15, bellR:4.6, rightLift:4,
  vFall:20, vStart:0.70, vRange:3.2,
  bounce:38, bounceR:2.70, bouncePow:2.6,
  shTop:0.45, shTopR:2.40, shPow:2.3, shRightMul:0.68,
  shBot:0.50, shBotR:2.70, shBotRightMul:0.90,
  plankHalf:3.34, plankFeather:1.70,
  shLeft:-5.20, shLeftFeather:2.60, shRight:2.40, shRightFeather:2.40,
  tint:[1.0,0.955,0.885],       // cream limewash
};
/* tiling paper tooth — fibres, mottle and a fine grain */
function paperTexture(px){
  const c=C(px,px),g=c.getContext('2d'),r=mulberry(2027);
  g.fillStyle='#808080';g.fillRect(0,0,px,px);
  for(let i=0;i<70;i++){
    g.fillStyle=`rgba(${r()<.5?255:0},${r()<.5?255:0},${r()<.5?255:0},${.012+r()*.03})`;
    g.beginPath();g.ellipse(r()*px,r()*px,px*(.05+r()*.28),px*(.04+r()*.22),r()*TAU,0,TAU);g.fill();
  }
  for(let i=0;i<5200;i++){
    const x=r()*px,y=r()*px,l=1+r()*px*0.035,a=r()*TAU;
    g.strokeStyle=r()<.5?`rgba(255,255,255,${.03+r()*.11})`:`rgba(0,0,0,${.03+r()*.13})`;
    g.lineWidth=r()<.85?1:2;
    g.beginPath();g.moveTo(x,y);g.lineTo(x+Math.cos(a)*l,y+Math.sin(a)*l);g.stroke();
  }
  const img=g.getImageData(0,0,px,px),d=img.data;
  for(let i=0;i<d.length;i+=4){const n=(r()-0.5)*40;d[i]+=n;d[i+1]+=n;d[i+2]+=n;}
  g.putImageData(img,0,0);
  const t=new THREE.CanvasTexture(c);
  t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=8;
  t.minFilter=THREE.LinearMipmapLinearFilter;t.magFilter=THREE.LinearFilter;
  return t;
}
function wallTexture(px){
  const c=C(px,px),g=c.getContext('2d');
  const Ww=WALL.x1-WALL.x0, Hh=WALL.y1-WALL.y0;
  const img=g.createImageData(px,px), d=img.data;
  const PT=K.shelfTop, PB=[K.shelfTop[0]-K.plankThick, K.shelfTop[1]-K.plankThick];
  const sm=t=>t<=0?0:t>=1?1:t*t*(3-2*t);
  const r=mulberry(5);
  for(let j=0;j<px;j++){
    const y = WALL.y1 - (j+0.5)/px*Hh;
    for(let i=0;i<px;i++){
      const x = WALL.x0 + (i+0.5)/px*Ww;
      const ax=Math.abs(x)/WT.bellR;
      let L = WT.peak - WT.bell*ax*ax + WT.rightLift*clamp(x/4,0,1);
      L -= WT.vFall*sm((WT.vStart-y)/WT.vRange)*sm((-x+2.8)/8.6);
      const inPlank = 1-sm((Math.abs(x)-WT.plankHalf)/WT.plankFeather);
      const inShadow = sm((x-WT.shLeft)/WT.shLeftFeather)*(1-sm((x-WT.shRight)/WT.shRightFeather));
      for(const pt of PT){
        const dy=y-pt; if(dy<0||dy>WT.bounceR) continue;
        L += WT.bounce*Math.pow(1-dy/WT.bounceR,WT.bouncePow)*inPlank;
      }
      const rb=sm((x+4.8)/9.6);
      let dy=PB[0]-y;
      if(dy>0&&dy<WT.shTopR) L *= 1-WT.shTop*(1-(1-WT.shRightMul)*rb)*Math.pow(1-dy/WT.shTopR,WT.shPow)*inShadow;
      dy=PB[1]-y;
      if(dy>0&&dy<WT.shBotR) L *= 1-WT.shBot*(1-(1-WT.shBotRightMul)*rb)*Math.pow(1-dy/WT.shBotR,WT.shPow)*inShadow;
      // the uprights sit proud of the wall and drop a soft edge shadow
      for(const ux of [-3.40,3.40]){
        const dx=x-ux;
        const s=Math.exp(-Math.pow((dx+ (ux<0?0.30:-0.06))/0.40,2));
        const band=sm((y+3.6)/1.6)*(1-sm((y-1.9)/1.7));   // no hard ends
        L *= 1-0.30*s*band;
      }
      const o=(j*px+i)*4;
      const n=(r()-0.5)*5;            // limewash tooth
      d[o]  =clamp((L+n)*WT.tint[0],0,255);
      d[o+1]=clamp((L+n)*WT.tint[1],0,255);
      d[o+2]=clamp((L+n)*WT.tint[2],0,255);
      d[o+3]=255;
    }
  }
  g.putImageData(img,0,0);
  const t=new THREE.CanvasTexture(c);
  t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=8;
  t.minFilter=THREE.LinearMipmapLinearFilter;t.magFilter=THREE.LinearFilter;
  return t;
}

/* ════════════════════════════════════════════════════════════════════════
   4 · THE ROOM
   ════════════════════════════════════════════════════════════════════════ */
const canvas   = document.getElementById('gl');
const renderer = new THREE.WebGLRenderer({canvas,antialias:false,alpha:false,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));
renderer.setClearColor(0xe2d8c6,1);
renderer.toneMapping = THREE.NoToneMapping;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.autoClear = false;

const scene  = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(K.fov,1,0.2,100);
const LAY_BG = 0, LAY_FG = 1;
const books = [];

/* ---- wall ---- */
const wallMat = new THREE.ShaderMaterial({
  transparent:true,
  uniforms:{uBake:{value:wallTexture(1024)},uPaper:{value:paperTexture(512)},uOpacity:{value:0}},
  vertexShader:`varying vec2 vUv; void main(){vUv=uv;
    gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
  fragmentShader:`
    uniform sampler2D uBake; uniform sampler2D uPaper; uniform float uOpacity;
    varying vec2 vUv;
    void main(){
      vec3 bake=texture2D(uBake,vUv).rgb;
      float fine=texture2D(uPaper,vUv*13.0).r;
      float mid =texture2D(uPaper,vUv*3.1+vec2(0.37,0.19)).r;
      vec3 col=bake*(0.86+0.28*fine)*(0.93+0.14*mid);
      gl_FragColor=vec4(col,uOpacity);
      #include <colorspace_fragment>
    }`});
const wall = new THREE.Mesh(new THREE.PlaneGeometry(WALL.x1-WALL.x0,WALL.y1-WALL.y0),wallMat);
wall.position.set(0,(WALL.y0+WALL.y1)/2,K.wallZ);
scene.add(wall);

/* ---- oak ---- */
const WOOD_TEX = woodTexture(1024);
function oakMaterial(axis){
  return new THREE.ShaderMaterial({
    transparent:true,
    uniforms:{uWood:{value:WOOD_TEX},uOpacity:{value:0},uAxis:{value:axis||0}},
    vertexShader:`
      varying vec3 vP; varying vec3 vN;
      void main(){ vP=position; vN=normalize(normalMatrix*normal);
        gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader:`
      uniform sampler2D uWood; uniform float uOpacity; uniform float uAxis;
      varying vec3 vP; varying vec3 vN;
      void main(){
        vec3 n=normalize(vN), an=abs(n);
        vec2 uvH, uvV, uvE;
        if(uAxis<0.5){                       // grain runs along X (shelves)
          uvH=vec2(vP.x*0.140, vP.z*0.30);
          uvV=vec2(vP.x*0.140, vP.y*0.44);
          uvE=vec2(vP.z*0.30,  vP.y*0.44);
        } else {                             // grain runs along Y (uprights)
          uvH=vec2(vP.y*0.100, vP.z*0.30);
          uvV=vec2(vP.y*0.100, vP.x*0.55);
          uvE=vec2(vP.z*0.30,  vP.x*0.55);
        }
        vec2 uv=mix(mix(uvV,uvH,an.y),uvE,an.x);
        vec3 wood=texture2D(uWood,uv).rgb;
        float up=max(n.y,0.0), dn=max(-n.y,0.0), fwd=max(n.z,0.0), side=abs(n.x);
        float t = 1.22*up + 0.14*dn + 0.86*fwd + 0.48*side;
        float ao = mix(0.66,1.0, clamp((vP.z+0.42)/0.66,0.0,1.0));
        t *= mix(1.0, ao, up);
        t *= mix(0.88,1.0, 1.0-pow(clamp(abs(vP.x)/3.34,0.0,1.0),8.0));
        vec3 col = wood*t;
        // planed arris catching the light along the front top edge
        float arris = smoothstep(0.30,0.50,vP.z*2.0+0.5)*pow(clamp(n.z,0.0,1.0),1.5);
        col += vec3(0.10,0.082,0.055)*arris;
        col += vec3(0.05,0.040,0.026)*pow(clamp(n.z,0.0,1.0),5.0);    // satin sheen
        gl_FragColor=vec4(col,uOpacity);
        #include <colorspace_fragment>
      }`});
}
const oakH = oakMaterial(0), oakV = oakMaterial(1);
const furniture = new THREE.Group();
scene.add(furniture);
function plank(yTop){
  const m=new THREE.Mesh(new THREE.BoxGeometry(K.plankHalf*2,K.plankThick,K.plankDepth),oakH);
  m.position.set(0,yTop-K.plankThick/2,K.wallZ+K.plankDepth/2);
  return m;
}
function upright(x){
  const h=3.72;
  const m=new THREE.Mesh(new THREE.BoxGeometry(0.095,h,K.plankDepth),oakV);
  m.position.set(x,-0.10,K.wallZ+K.plankDepth/2);
  return m;
}
furniture.add(plank(K.shelfTop[0]),plank(K.shelfTop[1]),upright(-3.385),upright(3.385));

/* ---- shadow sprites ---- */
function shadowTex(){
  const P=256,c=C(P),g=c.getContext('2d');
  g.fillStyle='#000';g.filter=`blur(${P*0.135}px)`;
  const pad=P*0.225;g.fillRect(pad,pad,P-pad*2,P-pad*2);g.filter='none';
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;
}
function contactTex(){
  const W=256,H=96,c=C(W,H),g=c.getContext('2d');
  const gr=lg(g,0,0,0,H,[[0,'rgba(0,0,0,1)'],[.06,'rgba(0,0,0,.98)'],[.16,'rgba(0,0,0,.80)'],
                         [.38,'rgba(0,0,0,.42)'],[.70,'rgba(0,0,0,.13)'],[1,'rgba(0,0,0,0)']]);
  g.fillStyle=gr;g.fillRect(0,0,W,H);
  g.globalCompositeOperation='destination-out';
  g.fillStyle=lg(g,0,0,W,0,[[0,'rgba(0,0,0,1)'],[.05,'rgba(0,0,0,.70)'],[.11,'rgba(0,0,0,.24)'],
                            [.18,'rgba(0,0,0,0)'],[.82,'rgba(0,0,0,0)'],[.89,'rgba(0,0,0,.24)'],
                            [.95,'rgba(0,0,0,.70)'],[1,'rgba(0,0,0,1)']]);
  g.fillRect(0,0,W,H);
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;
}
function creaseTex(){
  const W=256,H=64,c=C(W,H),g=c.getContext('2d');
  g.fillStyle=lg(g,0,H,0,0,[[0,'rgba(0,0,0,1)'],[.22,'rgba(0,0,0,.66)'],
                            [.55,'rgba(0,0,0,.22)'],[1,'rgba(0,0,0,0)']]);
  g.fillRect(0,0,W,H);
  g.globalCompositeOperation='destination-out';
  g.fillStyle=lg(g,0,0,W,0,[[0,'rgba(0,0,0,1)'],[.14,'rgba(0,0,0,.35)'],[.30,'rgba(0,0,0,0)'],
                            [.70,'rgba(0,0,0,0)'],[.86,'rgba(0,0,0,.35)'],[1,'rgba(0,0,0,1)']]);
  g.fillRect(0,0,W,H);
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;
}
const SHADOW_TEX=shadowTex(), CONTACT_TEX=contactTex(), CREASE_TEX=creaseTex();

/* ---- cover surface: printed board under a satin varnish ---- */
const BOARD_FN = `
  // height field of a bound board: a shallow bulge that falls into a crisp chamfer
  float board(vec2 t){
    vec2 c=t*2.0-1.0;
    float bulge=(1.0-c.x*c.x)*(1.0-0.55*c.y*c.y);
    float e=clamp(min(min(t.x,1.0-t.x),min(t.y,1.0-t.y))/uER,0.0,1.0);
    float roll=sqrt(max(1.0-(1.0-e)*(1.0-e),0.0));   // quarter round, sharp at the lip
    return uBow*bulge*roll-uChamf*(1.0-roll);
  }`;
const COVER_VS = `
  uniform float uBow, uChamf, uER, uW, uH;
  varying vec2 vUv; varying vec3 vT, vB2, vNf; varying vec3 vWV;
  ${BOARD_FN}
  void main(){
    vUv=uv;
    vec3 pos=position; pos.z+=board(uv);
    mat3 M=mat3(modelMatrix);
    vT=normalize(M*vec3(1.0,0.0,0.0));
    vB2=normalize(M*vec3(0.0,1.0,0.0));
    vNf=normalize(M*vec3(0.0,0.0,1.0));
    vec4 wp=modelMatrix*vec4(pos,1.0);
    vWV=cameraPosition-wp.xyz;
    gl_Position=projectionMatrix*viewMatrix*wp; }`;
const COVER_FS = `
  uniform sampler2D uTex; uniform float uSatin; uniform float uOpacity; uniform float uSeed;
  uniform float uBow, uChamf, uER, uW, uH;
  varying vec2 vUv; varying vec3 vT, vB2, vNf; varying vec3 vWV;
  ${BOARD_FN}
  float hash(vec2 p){ vec3 p3=fract(vec3(p.xyx)*vec3(0.1031,0.1030,0.0973));
    p3+=dot(p3,p3.yxz+33.33); return fract((p3.x+p3.y)*p3.z); }
  float vnoise(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.0-2.0*f);
    return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y); }
  void main(){
    vec2 uv=clamp(vUv,0.0008,0.9992);
    vec4 tex=texture2D(uTex,uv);

    // the board normal is evaluated per pixel, so the chamfer stays crisp
    // however coarse the mesh is
    float d=0.0016;
    float hx=(board(uv+vec2(d,0.0))-board(uv-vec2(d,0.0)))/(2.0*d*uW);
    float hy=(board(uv+vec2(0.0,d))-board(uv-vec2(0.0,d)))/(2.0*d*uH);

    // linen tooth, as a small extra slope
    vec2 q=uv*vec2(58.0,78.0)+uSeed;
    float tooth=vnoise(q)*0.6+vnoise(q*2.7)*0.4;
    vec2 g2=uv*9.0+uSeed;
    float n1=vnoise(g2), e=0.02;
    vec2 grain=vec2(vnoise(g2+vec2(e,0.0))-n1, vnoise(g2+vec2(0.0,e))-n1)/e;

    vec3 N=normalize(vNf
      - vT*(hx + (grain.x*0.0022+(tooth-0.5)*0.009)*uSatin)
      - vB2*(hy + (grain.y*0.0022+(tooth-0.5)*0.009)*uSatin));
    vec3 V=normalize(vWV);

    // one key from above and to the right, a broad fill bounced off the paper wall
    vec3 L=normalize(vec3(0.52,0.70,0.55));
    vec3 F=normalize(vec3(-0.35,-0.18,0.92));
    float key=max(dot(N,L),0.0);
    float fill=max(dot(N,F),0.0);
    float shade=0.70+0.34*key+0.14*fill;
    vec3 col=tex.rgb*shade;

    // a tight specular that only fires on the chamfer, plus a broad satin lobe
    vec3 Hv=normalize(L+V);
    float nh=max(dot(N,Hv),0.0);
    col+=vec3(pow(nh,110.0)*0.85*uSatin);
    col+=vec3(pow(nh,14.0)*0.045*uSatin);
    float fres=pow(1.0-max(dot(N,V),0.0),3.4);
    col+=vec3(fres*0.055*uSatin);
    col+=vec3((tooth-0.5)*0.010*uSatin);

    gl_FragColor=vec4(min(col,vec3(1.0)),uOpacity);
    #include <colorspace_fragment>
  }`;
const SPINE_VS = `
  uniform float uHD;
  varying vec2 vUv; varying vec3 vNw, vTw, vBw, vWV; varying float vZ;
  void main(){
    vUv=uv;
    mat3 M=mat3(modelMatrix);
    vNw=normalize(M*normal);
    vTw=normalize(M*vec3(0.0,0.0,1.0));   // across the back
    vBw=normalize(M*vec3(0.0,1.0,0.0));   // head to tail
    vZ=position.z/uHD;
    vec4 wp=modelMatrix*vec4(position,1.0);
    vWV=cameraPosition-wp.xyz;
    gl_Position=projectionMatrix*viewMatrix*wp; }`;
const SPINE_FS = `
  uniform sampler2D uTex; uniform float uOpacity; uniform float uSeed; uniform float uSatin;
  varying vec2 vUv; varying vec3 vNw, vTw, vBw, vWV; varying float vZ;
  float hash(vec2 p){ vec3 p3=fract(vec3(p.xyx)*vec3(0.1031,0.1030,0.0973));
    p3+=dot(p3,p3.yxz+33.33); return fract((p3.x+p3.y)*p3.z); }
  float vnoise(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.0-2.0*f);
    return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y); }
  void main(){
    vec4 tex=texture2D(uTex,clamp(vUv,0.0015,0.9985));
    float t=clamp(vZ,-1.0,1.0);
    // a hollow back: nearly flat down the middle, turning hard into the joints.
    // swept as an angle rather than a slope so the normal can reach the joints
    float ang=1.15*sign(t)*pow(abs(t),1.25);

    vec2 q=vUv*vec2(11.0,78.0)+uSeed;
    float tooth=vnoise(q)*0.6+vnoise(q*2.7)*0.4;
    vec3 N=normalize(vNw*cos(ang) + vTw*sin(ang)
                     + (vTw*0.009+vBw*0.009)*(tooth-0.5)*uSatin);
    vec3 V=normalize(vWV);

    vec3 L=normalize(vec3(0.52,0.70,0.55));
    vec3 F=normalize(vec3(-0.35,-0.18,0.92));
    float shade=0.70+0.34*max(dot(N,L),0.0)+0.14*max(dot(N,F),0.0);
    shade*=1.0-0.16*smoothstep(0.78,1.0,abs(t));      // the joint grooves
    vec3 col=tex.rgb*shade;

    // the key sits off to the right, so on the back it only ever grazes the
    // front joint — the bounce off the paper wall is what rakes the round
    vec3 Hv=normalize(L+V), Hf=normalize(F+V);
    float nh=max(dot(N,Hv),0.0), nf=max(dot(N,Hf),0.0);
    col+=vec3(pow(nh,110.0)*0.55*uSatin);
    col+=vec3(pow(nh,14.0)*0.045*uSatin);
    col+=vec3(pow(nf,46.0)*0.150*uSatin);
    col+=vec3(pow(nf,9.0)*0.032*uSatin);
    col+=vec3(pow(1.0-max(dot(N,V),0.0),3.4)*0.055*uSatin);
    col+=vec3((tooth-0.5)*0.010*uSatin);

    gl_FragColor=vec4(min(col,vec3(1.0)),uOpacity);
    #include <colorspace_fragment>
  }`;
function spineMaterial(tex,seed){
  return new THREE.ShaderMaterial({transparent:true,
    uniforms:{uTex:{value:tex},uOpacity:{value:0},uSeed:{value:seed},
              uSatin:{value:1.0},uHD:{value:K.bookD*0.5}},
    vertexShader:SPINE_VS,fragmentShader:SPINE_FS});
}
function pagesMaterial(col){
  return new THREE.ShaderMaterial({
    transparent:true,
    uniforms:{uCol:{value:new THREE.Color(col)},uOpacity:{value:0},uH:{value:K.bookH*0.5}},
    vertexShader:`
      varying vec3 vP; varying vec3 vNw; varying vec3 vWV;
      void main(){ vP=position; vNw=normalize(mat3(modelMatrix)*normal);
        vec4 wp=modelMatrix*vec4(position,1.0);
        vWV=cameraPosition-wp.xyz;
        gl_Position=projectionMatrix*viewMatrix*wp; }`,
    fragmentShader:`
      uniform vec3 uCol; uniform float uOpacity; uniform float uH;
      varying vec3 vP; varying vec3 vNw; varying vec3 vWV;
      void main(){
        float f=vP.z*210.0;
        float w=fwidth(f);
        float line=0.5+0.5*cos(f*6.2831853);
        line=mix(0.5,line,clamp(1.0-w*1.6,0.0,1.0));
        vec3 col=uCol*0.88*mix(0.76,1.04,line);
        col*=1.0-0.16*smoothstep(0.25,1.0,abs(vP.y)/uH);
        col*=0.90+0.10*smoothstep(-0.09,0.09,vP.z);

        // the same rig as the boards, so the block turns with the volume
        vec3 N=normalize(vNw), V=normalize(vWV);
        vec3 L=normalize(vec3(0.52,0.70,0.55));
        vec3 F=normalize(vec3(-0.35,-0.18,0.92));
        float shade=0.70+0.34*max(dot(N,L),0.0)+0.14*max(dot(N,F),0.0);
        shade*=1.0-0.36*max(-N.y,0.0);      // the tail sits in its own shadow
        col*=shade/0.871;                   // 0.871 holds the fore-edge at its old tone
        // paper carries no real specular, only a graze
        col+=uCol*pow(1.0-max(dot(N,V),0.0),3.2)*max(dot(N,L),0.0)*0.11;
        gl_FragColor=vec4(min(col,vec3(1.0)),uOpacity);
        #include <colorspace_fragment>
      }`});
}

/* ---- tweens ---- */
const easeOutQuart=t=>1-Math.pow(1-t,4);
const easeSettle  =t=>t<0.5? 4*t*t*t : 1-Math.pow(-2*t+2,3)/2;
const activeEase  =t=>t<0.3? 0.3*Math.pow(t/0.3,3) : 0.3+0.7*(1-Math.pow(1-(t-0.3)/0.7,3));
let NOW=0;
class Tw{
  constructor(v){this.v=v.slice();this.from=v.slice();this.to=v.slice();this.t0=0;this.d=0;this.e=easeOutQuart;}
  start(to,d,e,delay){this.from=this.v.slice();this.to=to.slice();this.t0=NOW+(delay||0);this.d=Math.max(d,1);this.e=e||easeOutQuart;}
  set(to){this.v=to.slice();this.from=to.slice();this.to=to.slice();this.d=0;}
  update(){ if(this.d<=0)return;
    let t=(NOW-this.t0)/this.d; if(t<0)return; if(t>=1){t=1;this.d=0;}
    const k=this.e(t); for(let i=0;i<this.v.length;i++)this.v[i]=this.from[i]+(this.to[i]-this.from[i])*k; }
}
class Spring{
  constructor(v,tension,friction,mass){this.v=v.slice();this.tgt=v.slice();this.vel=v.map(()=>0);
    this.k=tension;this.c=friction;this.m=mass||1;}
  start(t){this.tgt=t.slice();}
  update(dt){dt=Math.min(dt,1/30);
    for(let i=0;i<this.v.length;i++){
      const a=(this.k*(this.tgt[i]-this.v[i])-this.c*this.vel[i])/this.m;
      this.vel[i]+=a*dt;this.v[i]+=this.vel[i]*dt;}}
}

/* ---- one volume ---- */
const SZW=K.bookW, SZH=K.bookH, SZD=K.bookD;
const bodyGeo=new THREE.BoxGeometry(SZW,SZH,SZD);
const faceGeo=new THREE.PlaneGeometry(SZW,SZH,44,44);
const hitGeo =new THREE.PlaneGeometry(SZW*1.06,SZH*0.98);
const mPos=(i,scroll)=>{
  const k=i-(scroll||0);
  if(k>=0) return [0, K.mY + k*K.mStepY, K.mZ0 - k*K.mStepZ];
  return [0, K.mY + k*0.86, K.mZ0 - k*0.14];
};
const slotX=i=>(i-2)*K.slot;
function bookBase(b){
  if(MOBILE) return mPos(b.index,0);
  return [b.data.slotX, K.shelfTop[b.data.shelf]+(SZH/2)*Math.cos(b._lean), K.bookZ];
}

function buildBook(data,index){
  const rnd=mulberry(index*7919+13);
  const B={data,index,flipped:false};
  B._lean=K.lean+(rnd()-0.5)*0.075;
  B._yaw = K.yaw+(rnd()-0.5)*0.045;
  B._roll=(rnd()-0.5)*0.018;
  B.rest=[B._lean,B._yaw,B._roll];
  B.restTilt=MOBILE?K.mTilt:B._lean;
  B.base=[0,0,0.01];
  B.basePos=bookBase(B);

  const gRoot=new THREE.Group(); gRoot.position.set(...B.basePos);
  const gHover=new THREE.Group(); gHover.position.set(...B.base);
  const gWob=new THREE.Group();
  const gTilt=new THREE.Group(); gTilt.rotation.set(...(MOBILE?[K.mTilt,0,0]:B.rest));
  const gScl=new THREE.Group(); gScl.scale.setScalar(0);
  gRoot.add(gHover); gHover.add(gWob); gWob.add(gTilt); gTilt.add(gScl);
  scene.add(gRoot);

  const coverTex=new THREE.CanvasTexture(paintCover(data,768,1152));
  coverTex.colorSpace=THREE.SRGBColorSpace; coverTex.anisotropy=8;
  const spineTex=new THREE.CanvasTexture(artSpine(data,142,1152));
  spineTex.colorSpace=THREE.SRGBColorSpace; spineTex.anisotropy=8;

  const pages=pagesMaterial(data.edge);
  const spineMat=spineMaterial(spineTex,index*5.7);
  const clothMat=new THREE.MeshBasicMaterial({color:new THREE.Color(data.cloth),transparent:true,opacity:0});
  const body=new THREE.Mesh(bodyGeo,[pages,spineMat,pages,pages,clothMat,clothMat]);
  gScl.add(body);

  const mk=(tex,satin,seed)=>new THREE.ShaderMaterial({transparent:true,
    uniforms:{uTex:{value:tex},uSatin:{value:satin},uOpacity:{value:0},uSeed:{value:seed},
              uBow:{value:K.bow},uChamf:{value:K.chamf},uER:{value:K.chamfR},
              uW:{value:SZW},uH:{value:SZH}},
    vertexShader:COVER_VS,fragmentShader:COVER_FS});
  const coverMat=mk(coverTex,1.0,index*7.3);
  const cover=new THREE.Mesh(faceGeo,coverMat);
  cover.position.z=SZD/2+K.chamf+0.0008; gScl.add(cover);
  const backMat=mk(coverTex,0.55,index*3.1+11);
  const back=new THREE.Mesh(faceGeo,backMat);
  back.position.z=-SZD/2-K.chamf-0.0008; back.rotation.y=Math.PI; gScl.add(back);
  B.backLoaded=false;
  B.loadBack=()=>{ if(B.backLoaded)return; B.backLoaded=true;
    const t=new THREE.CanvasTexture(artBack(data,768,1152));
    t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=8;backMat.uniforms.uTex.value=t; };

  const hit=new THREE.Mesh(hitGeo,new THREE.MeshBasicMaterial({visible:false}));
  hit.position.set(B.basePos[0],B.basePos[1],B.basePos[2]-0.04);
  hit.rotation.x=MOBILE?K.mTilt:B._lean;
  hit.rotation.y=MOBILE?0:B._yaw;
  hit.userData.book=B;
  scene.add(hit);

  const wallSh=new THREE.Mesh(new THREE.PlaneGeometry(2.20,2.70),
    new THREE.MeshBasicMaterial({map:SHADOW_TEX,transparent:true,opacity:0,depthWrite:false,color:0x241c12}));
  wallSh.position.set(B.basePos[0]-0.05,B.basePos[1]-0.04,K.wallZ+0.004);
  scene.add(wallSh);

  const footZ=K.bookZ+(SZH/2)*Math.sin(-B._lean);            // where the boards meet the plank
  const csBack=footZ-SZD*0.5-0.045;                          // just behind the boards
  const csFront=K.wallZ+K.plankDepth-0.035;                   // stops short of the plank's nose
  const csDepth=csFront-csBack;
  const cs=new THREE.Mesh(new THREE.PlaneGeometry(SZW*1.42,csDepth),
    new THREE.MeshBasicMaterial({map:CONTACT_TEX,transparent:true,opacity:0,depthWrite:false,color:0x241a10}));
  cs.rotation.x=-Math.PI/2;
  cs.position.set(B.basePos[0],K.shelfTop[data.shelf]+0.0022,csBack+csDepth*0.5);
  scene.add(cs);
  const crease=new THREE.Mesh(new THREE.PlaneGeometry(SZW*1.16,0.075),
    new THREE.MeshBasicMaterial({map:CREASE_TEX,color:0x1a1208,transparent:true,opacity:0,depthWrite:false}));
  crease.position.set(B.basePos[0],K.shelfTop[data.shelf]+0.030,footZ+SZD*0.5+0.004);
  scene.add(crease);

  let refl=null;
  const reflMat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,
    uniforms:{uTex:{value:coverTex},uOpacity:{value:0}},
    vertexShader:`varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
    fragmentShader:`
      uniform sampler2D uTex; uniform float uOpacity; varying vec2 vUv;
      float hash(vec2 p){vec3 p3=fract(vec3(p.xyx)*vec3(0.1031,0.1030,0.0973));
        p3+=dot(p3,p3.yxz+33.33);return fract((p3.x+p3.y)*p3.z);}
      void main(){
        float mappedY=mix(0.0,0.22,1.0-vUv.y);
        float edge=min(min(smoothstep(0.0,0.06,vUv.y),smoothstep(0.0,0.12,1.0-vUv.y)),
                       min(smoothstep(0.0,0.06,vUv.x),smoothstep(0.0,0.06,1.0-vUv.x)));
        float b=0.004+0.02*(1.0-edge);
        vec4 col=(texture2D(uTex,vec2(vUv.x+b,mappedY))+texture2D(uTex,vec2(vUv.x-b,mappedY))
                 +texture2D(uTex,vec2(vUv.x,mappedY+b*0.5))+texture2D(uTex,vec2(vUv.x,mappedY-b*0.5)))*0.25;
        float fade=vUv.y*vUv.y*1.7;
        float sp=hash(vUv*220.0);
        gl_FragColor=vec4(col.rgb,uOpacity*fade*(1.0-sp*0.34)*edge);
        #include <colorspace_fragment>
      }`});
  refl=new THREE.Mesh(new THREE.PlaneGeometry(SZW,0.60),reflMat);
  refl.rotation.x=-Math.PI/2;
  refl.position.set(B.basePos[0],K.shelfTop[data.shelf]+0.0012,footZ+0.24);
  scene.add(refl);

  Object.assign(B,{gRoot,gHover,gWob,gTilt,gScl,body,cover,back,coverMat,backMat,spineMat,
    clothMat,pages,hit,wallSh,cs,crease,refl,reflMat,
    tHover:new Tw([...B.base]), tTilt:new Tw(MOBILE?[K.mTilt,0,0]:[...B.rest]),
    sWob:new Spring([0,0,0],80,6,1),
    tActiveP:new Tw([...B.basePos]), tActiveR:new Tw([0,0,0]),
    tScale:new Tw([0]), tRefl:new Tw([0.34]), tFade:new Tw([0]), tSeat:new Tw([1])});
  if(MOBILE){wallSh.visible=false;cs.visible=false;crease.visible=false;refl.visible=false;
             gRoot.renderOrder=100-index;}
  return B;
}

/* ---- state ---- */
const S={anim:'intro',active:null,lifted:null};
function hoverIn(B,dur){
  const d=dur===undefined?K.hoverLift:dur;
  B.tHover.start([B.base[0],B.base[1]+0.085,B.base[2]+0.075],d,easeOutQuart);
  B.tTilt.start([0,0,0],d,easeOutQuart);
  B.sWob.start([0,0,0]);
  B.tRefl.start([0],d*0.45,easeOutQuart);
  B.loadBack();
}
function hoverOut(B){
  const d=K.hoverDrop;
  B.tHover.start([...B.base],d,easeSettle);
  B.tTilt.start(MOBILE?[B.restTilt,0,0]:[...B.rest],d,easeSettle,d*0.22);
  B.tRefl.start([0.34],d,easeSettle);
  B.sWob.start([0,0,0]);
}
function activeZ(){
  const camZ=camera.position.z;
  const fill=MOBILE?0.86:0.60;
  const halfH=(SZH*0.5)/fill;
  const dv=halfH/Math.tan(K.fov*Math.PI/360);
  const halfW=(SZW*0.5)/fill;
  const dh=halfW/(Math.tan(K.fov*Math.PI/360)*camera.aspect);
  return camZ-Math.max(dv,dh);
}
function toActive(B){
  S.anim='animatingForward'; hoverIn(B);
  B.tSeat.start([0],K.activeDuration*0.55,easeSettle,K.activeDuration*0.12);
  const ay = MOBILE ? mobileTargetY() : K.boxCY-0.02;
  B.tActiveP.start([MOBILE?0:K.activeX,ay,activeZ()],K.activeDuration,activeEase);
  B.tActiveR.start([...K.activeRot],K.activeDuration,activeEase);
  B.gRoot.renderOrder=10; setLayer(B,LAY_FG);
  setTimeout(()=>{ if(S.active===B) S.anim='active'; },K.activeDuration);
}
function toInactive(B){
  S.anim='animatingBackward'; B.flipped=false;
  B.tSeat.start([1],K.activeDuration*0.62,easeSettle,K.activeDuration*0.38);
  B.tHover.start([B.base[0],B.base[1]+0.06,B.base[2]],K.activeDuration,easeOutQuart);
  B.tActiveP.start([...B.basePos],K.activeDuration,activeEase);
  B.tActiveR.start([...K.activeRot],K.activeDuration,activeEase);
  setTimeout(()=>hoverOut(B),K.activeDuration);
  setTimeout(()=>{ S.anim='inactive'; setLayer(B,LAY_BG);
                   B.gRoot.renderOrder=MOBILE?100-B.index:0;
                   if(S.lifted===B)S.lifted=null; },K.activeDuration+20);
}
function setLayer(B,l){ B.gRoot.traverse(o=>o.layers.set(l)); }
function setActive(B){
  if(S.anim==='intro'||S.anim==='animatingForward'||S.anim==='animatingBackward')return;
  if(S.active===B)return;
  if(S.active){toInactive(S.active);S.active=null;detailEl.classList.remove('on');document.body.classList.remove('reading');WASH.target=0;return;}
  S.active=B;S.lifted=B;toActive(B);
  showDetail(B);
}
function clearActive(){
  if(!S.active)return;
  const B=S.active;S.active=null;
  detailEl.classList.remove('on');document.body.classList.remove('reading');WASH.target=0;hintEl.classList.remove('on');
  mDetails.textContent=t('Details');
  dragReset();
  toInactive(B);
}
function flipActive(){
  const B=S.active; if(!B||S.anim!=='active')return;
  B.flipped=!B.flipped; B.loadBack();
  B.tActiveR.start([K.activeRot[0],K.activeRot[1]+(B.flipped?Math.PI:0),K.activeRot[2]],
                   K.activeDuration,activeEase);
}
function lookInside(B){
  if(S.active===B){flipActive();return;}
  setActive(B);
  setTimeout(()=>{ if(S.active===B&&!B.flipped)flipActive(); },K.activeDuration+60);
}

/* ════════════════════════════════════════════════════════════════════════
   5 · CAMERA (orbits toward the pointer) + BLUR COMPOSITE
   ════════════════════════════════════════════════════════════════════════ */
let VW=1,VH=1,DIST=12;
const ORB={tx:0,ty:0,x:0,y:0};
const TGT=new THREE.Vector3();
function mobileTargetY(){
  const tan=Math.tan(K.fov*Math.PI/360);
  const D=DIST-K.mZ0;
  const stackTop=K.mY+(BOOKS.length-1)*K.mStepY+SZH*0.5*Math.cos(K.mTilt);
  return Math.max(K.mY+K.mDrop*D*tan, stackTop-0.80*D*tan);
}
function applyCamera(){
  const damp=MOBILE?0:(S.active?0.42:1);
  const az=ORB.x*K.orbitAz*damp;
  const el=0.0025-ORB.y*K.orbitEl*damp;
  TGT.set(0, MOBILE?mobileTargetY():K.boxCY, 0);
  camera.position.set(
    TGT.x+Math.sin(az)*Math.cos(el)*DIST,
    TGT.y+Math.sin(el)*DIST,
    TGT.z+Math.cos(az)*Math.cos(el)*DIST);
  camera.lookAt(TGT);
}
function frameCamera(){
  const aspect=VW/VH, tan=Math.tan(K.fov*Math.PI/360);
  camera.aspect=aspect;
  if(MOBILE){
    const a=clamp(aspect,0.40,0.95);
    DIST=(SZW*0.5)/(K.mFill*tan*a)+K.mZ0;
    camera.near=Math.max(DIST-9,0.1); camera.far=DIST+26;
  } else {
    const distV=K.boxY/(2*tan), distH=K.boxX/(2*tan*aspect);
    let d=K.offset*Math.max(distV,distH);
    const projW=VW*K.boxX/(2*d*tan*aspect);
    if(projW>K.maxWidthPx) d=VW*K.boxX/(2*K.maxWidthPx*tan*aspect);
    DIST=d;
    const maxDim=Math.max(K.boxX,K.boxY);
    camera.near=Math.max(DIST-maxDim*2-2,0.1); camera.far=DIST+maxDim*2+16;
  }
  applyCamera();
  camera.updateProjectionMatrix();
}

const rt=new THREE.WebGLRenderTarget(2,2,{
  type:THREE.HalfFloatType,minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter,
  depthBuffer:true,stencilBuffer:false,samples:4});
const NOISE_N=256, noiseData=new Uint8Array(NOISE_N*NOISE_N*4);
{ const r=mulberry(4242);
  for(let i=0;i<NOISE_N*NOISE_N;i++){noiseData[i*4]=(r()*255)|0;noiseData[i*4+1]=(r()*255)|0;
    noiseData[i*4+2]=(r()*255)|0;noiseData[i*4+3]=255;} }
const noiseTex=new THREE.DataTexture(noiseData,NOISE_N,NOISE_N);
noiseTex.wrapS=noiseTex.wrapT=THREE.RepeatWrapping;
noiseTex.minFilter=noiseTex.magFilter=THREE.LinearFilter;noiseTex.needsUpdate=true;

const passMat=new THREE.ShaderMaterial({
  depthTest:false,depthWrite:false,
  uniforms:{backgroundTexture:{value:rt.texture},noiseTexture:{value:noiseTex},
    noiseScale:{value:6},intensity:{value:0},ignoreBlur:{value:true},
    samples:{value:30},resolution:{value:new THREE.Vector2(1,1)}},
  vertexShader:`varying vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position.xy,0.0,1.0);}`,
  fragmentShader:`
    uniform sampler2D backgroundTexture; uniform sampler2D noiseTexture;
    uniform float noiseScale; uniform float intensity; uniform bool ignoreBlur;
    uniform float samples; uniform vec2 resolution;
    varying vec2 vUv;
    const float pi=3.14159265359;
    const float goldenAngle=pi*(3.0-sqrt(5.0));
    vec4 goldenBlur(vec2 uv,sampler2D tex){
      float noise=texture2D(noiseTexture,uv*noiseScale).r;
      float angle=pi+(noise-0.5)*2.0*pi*2.0;
      vec2 polar=vec2(cos(angle),sin(angle));
      vec4 sum=vec4(0.0);
      vec2 a=vec2(1024.)*vec2(1.,resolution.x/resolution.y);
      for(int i=1;i<=32;i++){
        if(float(i)>samples)break;
        float r=intensity*sqrt(float(i)/samples);
        float theta=float(i)*goldenAngle;
        vec2 off=vec2(polar.x*cos(theta)-polar.y*sin(theta),
                      polar.y*cos(theta)+polar.x*sin(theta));
        sum+=texture2D(tex,uv+(off*r/a));
      }
      return sum/samples;
    }
    void main(){
      gl_FragColor=texture2D(backgroundTexture,vUv);
      if(!ignoreBlur) gl_FragColor=goldenBlur(vUv,backgroundTexture);
      gl_FragColor.a=1.0;
      #include <colorspace_fragment>
    }`});
const quadGeo=new THREE.BufferGeometry();
quadGeo.setAttribute('position',new THREE.Float32BufferAttribute([-1,-1,0,3,-1,0,-1,3,0],3));
quadGeo.setAttribute('uv',new THREE.Float32BufferAttribute([0,0,2,0,0,2],2));
const quad=new THREE.Mesh(quadGeo,passMat); quad.frustumCulled=false;
const quadScene=new THREE.Scene(); quadScene.add(quad);
const quadCam=new THREE.OrthographicCamera(-1,1,1,-1,0,1);
const blurTw={i:new Tw([0]),n:new Tw([1])};

function resize(){
  VW=Math.max(1,innerWidth); VH=Math.max(1,innerHeight);
  renderer.setSize(VW,VH,false);
  const pr=renderer.getPixelRatio();
  rt.setSize(Math.round(VW*pr),Math.round(VH*pr));
  passMat.uniforms.resolution.value.set(VW*pr,VH*pr);
  frameCamera();
}
addEventListener('resize',()=>{resize();washResize();});

/* ════════════════════════════════════════════════════════════════════════
   6 · UI
   ════════════════════════════════════════════════════════════════════════ */
const detailEl=document.getElementById('detail');
const dMeta=document.getElementById('detail-meta'), dTitle=document.getElementById('detail-title');
const dDesc=document.getElementById('detail-desc');
const dLook=document.getElementById('detail-look'), dClose=document.getElementById('detail-close');
const hintEl=document.getElementById('hint');
/* ---- a torn sheet that slides in from the left to carry the copy ---- */
const washEl=document.getElementById('wash');
const wctx=washEl.getContext('2d');
const WASH={t:0,target:0,w:1,h:1,sheet:null,travel:1,dirty:true};

function hash1(i){ let x=Math.sin(i*127.1+311.7)*43758.5453; return x-Math.floor(x); }
function vnoise1(t,seed){
  const i=Math.floor(t), f=t-i, u=f*f*(3-2*f);
  return lerp(hash1(i+seed*97.3), hash1(i+1+seed*97.3), u);
}
function hash2(x,y){ let v=Math.sin(x*12.9898+y*78.233)*43758.5453; return v-Math.floor(v); }

/* the torn band: solid on the left, breaking into fibres on the right */
function buildTearBand(TW,h){
  const oct=[[1/430,44],[1/170,21],[1/74,10.5],[1/31,5.0],[1/13,2.4],[1/6,1.2]];
  const edge=new Float32Array(h);
  for(let y=0;y<h;y++){
    let e=TW*0.42;
    for(let k=0;k<oct.length;k++) e+=(vnoise1(y*oct[k][0],k+1)-0.5)*2*oct[k][1];
    edge[y]=e;
  }
  const a=new Float32Array(TW*h);
  for(let y=0;y<h;y++){
    const e=edge[y];
    const fib=5+17*vnoise1(y/8.5,11);          // fibre length varies down the tear
    for(let x=0;x<TW;x++){
      const t=(x-e)/fib;
      let v;
      if(t<=0) v=1;
      else if(t>=1.35) v=0;
      else {
        // break the falloff up so it reads as fibres rather than a soft cut
        const n=hash2(Math.floor(x*0.9),Math.floor(y*0.75))*0.62
               +hash2(Math.floor(x*2.4)+37,Math.floor(y*2.1)+11)*0.38;
        v=clamp(1.18-t-(n-0.5)*0.95,0,1);
        v=v*v*(3-2*v);
      }
      a[y*TW+x]=v;
    }
  }
  return a;
}
function tintBand(a,TW,h,r,g0,b0,edgeDark){
  const c=C(TW,h), g=c.getContext('2d');
  const img=g.createImageData(TW,h), d=img.data;
  for(let i=0;i<TW*h;i++){
    const v=a[i];
    let k=1;
    if(edgeDark&&v>0.02&&v<0.97) k=0.86+0.14*v;   // compressed fibres at the tear
    d[i*4]=r*k; d[i*4+1]=g0*k; d[i*4+2]=b0*k;
    d[i*4+3]=v*255;
  }
  g.putImageData(img,0,0);
  return c;
}
function buildSheet(){
  const w=WASH.w,h=WASH.h;
  if(w<8||h<8) return;
  const TW=Math.min(210,Math.round(w*0.34));
  const X0=Math.max(0,w-TW-46);
  const a=buildTearBand(TW,h);
  const paper=tintBand(a,TW,h,219,202,175,true);
  const dark =tintBand(a,TW,h,86,68,46,false);
  const cv=C(w,h), g=cv.getContext('2d');
  // the sheet casts a soft shadow onto the scene behind it
  const BL=40;                       // the sheet bleeds past the left edge of the canvas
  g.save(); g.globalAlpha=0.34; g.filter=`blur(${Math.round(h*0.020)}px)`;
  g.fillStyle='#56432e'; g.fillRect(-BL,0,X0+16+BL,h);
  g.drawImage(dark,X0+16,0);
  g.restore();
  // the sheet itself
  const pg=g.createLinearGradient(0,0,w,0);
  pg.addColorStop(0,'rgb(222,206,180)');
  pg.addColorStop(0.72,'rgb(219,202,175)');
  pg.addColorStop(1,'rgb(213,195,167)');
  g.fillStyle=pg; g.fillRect(-BL,0,X0+1+BL,h);
  g.drawImage(paper,X0,0);
  // fibre grain, only where there is paper
  g.globalCompositeOperation='source-atop';
  const r=mulberry(913);
  for(let i=0;i<2600;i++){
    const x=r()*w, y=r()*h, l=2+r()*26, ang=(r()-0.5)*0.5;
    g.strokeStyle=r()<0.5?`rgba(255,250,240,${0.02+r()*0.05})`:`rgba(120,98,70,${0.02+r()*0.05})`;
    g.lineWidth=r()<0.85?1:2;
    g.beginPath(); g.moveTo(x,y); g.lineTo(x+Math.cos(ang)*l,y+Math.sin(ang)*l); g.stroke();
  }
  g.fillStyle='rgba(255,252,244,0.05)';
  g.fillRect(-BL,0,w+BL,h*0.5);
  g.globalCompositeOperation='source-over';
  WASH.sheet=cv; WASH.travel=X0+TW+60;
}
function washResize(){
  const w=Math.max(1,washEl.clientWidth), h=Math.max(1,washEl.clientHeight);
  washEl.width=w; washEl.height=h; WASH.w=w; WASH.h=h;
  buildSheet(); WASH.dirty=true;
}
function drawWash(){
  const w=WASH.w,h=WASH.h,t=WASH.t;
  wctx.clearRect(0,0,w,h);
  if(t<=0.002||!WASH.sheet) return;
  wctx.drawImage(WASH.sheet,-(1-t)*WASH.travel,0);
}

const mbar=document.getElementById('mbar'), mMeta=document.getElementById('mbar-meta'),
      mTitle=document.getElementById('mbar-title'), mDetails=document.getElementById('mbar-details'),
      mLook=document.getElementById('mbar-look'), menuBtn=document.getElementById('menubtn'),
      menu=document.getElementById('menu');
const M={scroll:0,target:0,index:0,dragging:false,lastY:0};

function showDetail(B){
  const d=B.data;
  dMeta.textContent=`${t('Register')} ${d.vol} · ${t('since {year}',{year:d.year})}`;
  dTitle.textContent=d.title; dDesc.textContent=d.blurb;
  detailEl.classList.add('on'); document.body.classList.add('reading'); WASH.target=1;
  if(MOBILE){ mMeta.textContent=`${t('Register')} ${d.vol} · ${tp(d.patients,'{count} patient','{count} patients')}`; mTitle.textContent=d.title;
              mDetails.textContent=t('Close'); }
}
dClose.addEventListener('click',e=>{e.stopPropagation();clearActive();});
dLook.addEventListener('click',e=>{e.stopPropagation(); if(S.active) openRegister(S.active.data);});
function openRegister(d){ parent.postMessage({type:'shelf-open', name:d.name}, location.origin); }

const tl=document.getElementById('tl');
function buildRail(){
const tl=document.getElementById('tl');
BOOKS.forEach((d,i)=>{
  const b=document.createElement('button');
  b.className='tli rise';
  b.dataset.d=400+i*40;
  b.setAttribute('aria-label',`${d.title}: ${tp(d.patients,'{count} patient','{count} patients')}. ${t('Takes the register off the shelf.')}`);
  b.innerHTML=`<span class="tlmark" style="background:${d.spine}" aria-hidden="true">${d.vol}</span><span class="tltxt"><p>${tp(d.patients,'{count} patient','{count} patients')} · ${t('{count} staff',{count:d.staff})}</p>`+
              `<p class="studio">${t('Register')} ${d.vol}</p><h2>${d.title}</h2></span>`;
  b.addEventListener('pointerenter',()=>{ if(S.anim==='inactive'&&!MOBILE)setLifted(books[i]); });
  b.addEventListener('pointerleave',()=>{ if(S.anim==='inactive'&&!MOBILE)setLifted(null); });
  b.addEventListener('click',e=>{e.stopPropagation(); if(S.active)clearActive(); else setActive(books[i]);});
  tl.appendChild(b);
});
BOOKS.forEach((d,i)=>{
  const b=document.createElement('button');
  b.innerHTML=`<span>${t('Register')} ${d.vol} · ${tp(d.patients,'{count} patient','{count} patients')}</span>${d.title}`;
  b.addEventListener('click',()=>{menu.hidden=true;M.target=i;if(S.active)clearActive();});
  menu.appendChild(b);
});
}
menuBtn.addEventListener('click',()=>{menu.hidden=!menu.hidden;});

function setLifted(B){
  if(S.lifted===B)return;
  if(S.lifted&&S.lifted!==S.active)hoverOut(S.lifted);
  S.lifted=B;
  if(B)hoverIn(B);
}
function setMobileIndex(i,force){
  i=clamp(i,0,BOOKS.length-1);
  if(!force&&i===M.index)return;
  M.index=i; const d=BOOKS[i];
  mMeta.textContent=`${t('Register')} ${d.vol} · ${tp(d.patients,'{count} patient','{count} patients')}`; mTitle.textContent=d.title;
}
let snapTimer=null;
function mobileSnap(delay){clearTimeout(snapTimer);
  snapTimer=setTimeout(()=>{M.target=clamp(Math.round(M.target),0,BOOKS.length-1);},delay);}
function mobileScrollBy(dv){M.target=clamp(M.target+dv,0,BOOKS.length-1);mobileSnap(170);}
addEventListener('wheel',e=>{ if(!MOBILE||S.active)return; mobileScrollBy(e.deltaY/420); },{passive:true});
canvas.addEventListener('touchstart',e=>{ if(!MOBILE)return; M.dragging=true; M.lastY=e.touches[0].clientY; },{passive:true});
canvas.addEventListener('touchmove',e=>{
  if(!MOBILE||!M.dragging||S.active)return;
  const y=e.touches[0].clientY; mobileScrollBy((M.lastY-y)/190); M.lastY=y; },{passive:true});
addEventListener('touchend',()=>{M.dragging=false;if(MOBILE&&!S.active)mobileSnap(60);},{passive:true});
mDetails.addEventListener('click',e=>{e.stopPropagation();if(S.active)clearActive();else setActive(books[M.index]);});
mLook.addEventListener('click',e=>{e.stopPropagation();openRegister(books[M.index].data);});

/* ---- pointer ---- */
const ray=new THREE.Raycaster();
ray.layers.enable(LAY_BG); ray.layers.enable(LAY_FG);
const ptr=new THREE.Vector2();
const DRAG={on:false,moved:0,lx:0,ly:0,rx:0,ry:0};
function dragReset(){DRAG.on=false;DRAG.moved=0;DRAG.rx=0;DRAG.ry=0;}
addEventListener('pointermove',e=>{
  ORB.tx=(e.clientX/VW-0.5)*2; ORB.ty=(e.clientY/VH-0.5)*2;
  hintEl.style.transform=`translate(${e.clientX+12}px,${e.clientY+12}px)`;
  if(S.anim==='intro'||MOBILE)return;
  ptr.x=(e.clientX/VW)*2-1; ptr.y=-(e.clientY/VH)*2+1;
  ray.setFromCamera(ptr,camera);
  const hits=ray.intersectObjects(books.map(b=>b.hit),false);
  const B=hits.length?hits[0].object.userData.book:null;
  if(S.active){
    if(DRAG.on){                                   // turning the volume in the hand
      const dx=e.clientX-DRAG.lx, dy=e.clientY-DRAG.ly;
      DRAG.lx=e.clientX; DRAG.ly=e.clientY;
      DRAG.moved+=Math.abs(dx)+Math.abs(dy);
      DRAG.ry+=dx*0.0090;
      DRAG.rx=clamp(DRAG.rx+dy*0.0062,-0.62,0.62);
      S.active.sWob.start([DRAG.rx,DRAG.ry,0]);
      document.body.style.cursor='grabbing';
      return;
    }
    if(B===S.active&&S.anim==='active'){
      if(!REDUCED&&hits[0].uv){                    // a light parallax when the hand is off
        const uv=hits[0].uv;
        S.active.sWob.start([DRAG.rx+Math.PI/46*(uv.y-.5)*2*(S.active.flipped?-1:1),
                             DRAG.ry+Math.PI/36*((S.active.flipped?1-uv.x:uv.x)-.5)*2,0]);
      }
      hintEl.classList.add('on'); document.body.style.cursor='grab';
    } else { hintEl.classList.remove('on'); document.body.style.cursor='default';
             S.active.sWob.start([DRAG.rx,DRAG.ry,0]); }
    return;
  }
  if(S.anim!=='inactive')return;
  setLifted(B);
  document.body.style.cursor=B?'pointer':'default';
  if(B&&hits[0].uv&&!REDUCED){
    const uv=hits[0].uv;
    B.sWob.start([Math.PI/50*(uv.y-.5)*2, Math.PI/40*(uv.x-.5)*2, 0]);
  }
});
addEventListener('pointerleave',()=>{ ORB.tx=0;ORB.ty=0;
  if(!MOBILE&&!S.active&&S.anim==='inactive')setLifted(null); });
addEventListener('blur',()=>{ ORB.tx=0;ORB.ty=0; });
addEventListener('pointerdown',e=>{
  if(e.target.closest('header')||e.target.closest('footer')||
     e.target.closest('.detail')||e.target.closest('.mbar')||e.target.closest('.menu'))return;
  ptr.x=(e.clientX/VW)*2-1; ptr.y=-(e.clientY/VH)*2+1;
  ray.setFromCamera(ptr,camera);
  if(S.active){
    const h=ray.intersectObject(S.active.body,false);
    if(h.length){
      DRAG.on=true; DRAG.moved=0; DRAG.lx=e.clientX; DRAG.ly=e.clientY;
      document.body.style.cursor='grabbing';
      try{ canvas.setPointerCapture(e.pointerId); }catch(err){}
      e.preventDefault();
    } else clearActive();
    return;
  }
  const hits=ray.intersectObjects(books.map(b=>b.hit),false);
  if(hits.length) setActive(MOBILE?books[M.index]:hits[0].object.userData.book);
});
addEventListener('pointerup',e=>{
  if(!DRAG.on)return;
  DRAG.on=false;
  try{ canvas.releasePointerCapture(e.pointerId); }catch(err){}
  document.body.style.cursor='grab';
  if(DRAG.moved<10) flipActive();               // a tap still turns the volume over
});
addEventListener('pointercancel',()=>{ DRAG.on=false; });
addEventListener('keydown',e=>{
  if(e.key==='Escape'&&S.active)clearActive();
  if((e.key===' '||e.code==='Space')&&S.active){e.preventDefault();flipActive();}
});

/* ════════════════════════════════════════════════════════════════════════
   7 · MODE, INTRO, RENDER LOOP
   ════════════════════════════════════════════════════════════════════════ */
function applyMode(){
  document.body.classList.toggle('mobile',MOBILE);
  furniture.visible=!MOBILE;
  wall.visible=true;
  for(const B of books){
    B.basePos=bookBase(B);
    B.restTilt=MOBILE?K.mTilt:B._lean;
    if(B!==S.active){
      B.tActiveP.set([...B.basePos]);
      B.tTilt.set(MOBILE?[K.mTilt,0,0]:[...B.rest]);
      B.tHover.set([...B.base]);
    }
    B.hit.position.set(B.basePos[0],B.basePos[1],B.basePos[2]-0.04);
    B.hit.rotation.x=MOBILE?K.mTilt:B._lean; B.hit.rotation.y=MOBILE?0:B._yaw;
    B.wallSh.visible=!MOBILE; B.cs.visible=!MOBILE; B.crease.visible=!MOBILE; B.refl.visible=!MOBILE;
    B.gRoot.renderOrder=MOBILE?100-B.index:0;
  }
  if(MOBILE)setMobileIndex(M.index,true);
  frameCamera();
}
MOBILE_Q.addEventListener('change',e=>{MOBILE=e.matches;applyMode();});

const wallFade=new Tw([0]);
function revealChrome(){
  const step=REDUCED?0:1;
  for(const el of document.querySelectorAll('.rise')){
    el.style.setProperty('--d',(+el.dataset.d||0)*step+'ms');
  }
  // one reflow so the delays are in place before the class that plays them
  void document.body.offsetHeight;
  for(const el of document.querySelectorAll('.rise')) el.classList.add('in');
}
function startIntro(){
  // the volumes are already shelved — they only fade up, no tipping or settling
  S.anim='intro';
  wallFade.start([1],K.introWallFade,easeOutQuart);
  books.forEach((B,i)=>{
    B.tScale.set([1]);
    B.tHover.set([...B.base]);
    B.tTilt.set(MOBILE?[B.restTilt,0,0]:[...B.rest]);
    B.tFade.set([0]);
    B.tFade.start([1],K.introFade,easeOutQuart,i*K.introStagger);
  });
  setTimeout(()=>{ if(S.anim==='intro')S.anim='inactive'; },
             K.introWallFade+books.length*K.introStagger);
}


let last=performance.now();
function tick(now){
  requestAnimationFrame(tick);
  NOW=now; const dt=Math.min((now-last)/1000,0.05); last=now;

  // during the intro the camera snaps to the pointer instead of easing, so the
  // shelf never swings into place on load
  {
    const tg=WASH.target, k2=Math.min(1,dt*(tg>WASH.t?5.2:8.5));
    if(Math.abs(tg-WASH.t)>0.0009||WASH.dirty){ WASH.t+=(tg-WASH.t)*k2; WASH.dirty=false; drawWash(); }
  }
  const k=(S.anim==='intro')?1:Math.min(1,dt*3.4);
  ORB.x+=(ORB.tx-ORB.x)*k; ORB.y+=(ORB.ty-ORB.y)*k;
  applyCamera();

  wallFade.update();
  const wf=wallFade.v[0];
  wallMat.uniforms.uOpacity.value=wf; oakH.uniforms.uOpacity.value=wf; oakV.uniforms.uOpacity.value=wf;

  if(MOBILE){
    if(!S.active) M.scroll+=(M.target-M.scroll)*Math.min(1,dt*9);
    setMobileIndex(Math.round(M.scroll));
    for(const B of books){
      B.basePos=mPos(B.index,M.scroll);
      if(B===S.active||S.anim==='animatingBackward')continue;
      B.tActiveP.v[0]=B.basePos[0];B.tActiveP.v[1]=B.basePos[1];B.tActiveP.v[2]=B.basePos[2];
      B.tActiveP.d=0;
      const u=clamp(M.scroll-B.index,0,1.6);
      B.tTilt.v[0]=lerp(K.mTilt,K.mFlat,smooth(Math.min(u,1))); B.tTilt.d=0;
      B.mFade=1-smooth(clamp((u-0.28)/0.5,0,1));
      B.gRoot.visible=B.mFade>0.01 && B.index-M.scroll<9.5;
    }
  }

  for(const B of books){
    B.tHover.update();B.tTilt.update();B.tActiveP.update();B.tActiveR.update();
    B.tScale.update();B.tRefl.update();B.tFade.update();B.tSeat.update();B.sWob.update(dt);
    B.gHover.position.set(B.tHover.v[0],B.tHover.v[1],B.tHover.v[2]);
    B.gTilt.rotation.set(B.tTilt.v[0],B.tTilt.v[1],B.tTilt.v[2]);
    B.gWob.rotation.set(B.sWob.v[0],B.sWob.v[1],B.sWob.v[2]);
    B.gRoot.position.set(B.tActiveP.v[0],B.tActiveP.v[1],B.tActiveP.v[2]);
    B.gRoot.rotation.set(B.tActiveR.v[0],B.tActiveR.v[1],B.tActiveR.v[2]);
    B.gScl.scale.setScalar(B.tScale.v[0]);
    const op=B.tFade.v[0]*wf*(MOBILE&&B.mFade!==undefined&&B!==S.active?B.mFade:1);
    B.clothMat.opacity=op; B.spineMat.uniforms.uOpacity.value=op;
    B.pages.uniforms.uOpacity.value=op;
    B.coverMat.uniforms.uOpacity.value=op;
    B.backMat.uniforms.uOpacity.value=op;
    if(!MOBILE){
      const lift=B.tHover.v[1], away=clamp((B.tHover.v[2]-B.base[2])/0.075,0,1);
      B.wallSh.position.x=B.basePos[0]-0.09-away*0.05;
      B.wallSh.position.y=B.basePos[1]+lift-0.04+away*0.02;
      B.wallSh.scale.setScalar((1+away*0.13)*(B.tScale.v[0]||0.0001));
      const seat=B.tSeat.v[0];                                   // 1 on the shelf, 0 in the hand
      B.wallSh.material.opacity=(0.50-away*0.15)*op*seat;
      B.cs.material.opacity=(0.92*(1-away*0.55))*op*seat;
      B.crease.material.opacity=(0.55*(1-away))*op*seat;
      B.reflMat.uniforms.uOpacity.value=B.tRefl.v[0]*op*seat;
      B.refl.position.z=K.bookZ+(SZH/2)*Math.sin(-B._lean)+0.24+B.tHover.v[2]*2;
    }
  }

  const wantBlur=(S.anim==='animatingForward'||S.anim==='active');
  if(blurTw._w!==wantBlur){blurTw._w=wantBlur;
    blurTw.i.start([wantBlur?16:0],460,t=>t,100);
    blurTw.n.start([wantBlur?6:1],400,t=>t,100);}
  blurTw.i.update();blurTw.n.update();

  const act=(S.anim==='animatingForward'||S.anim==='active'||S.anim==='animatingBackward');
  camera.layers.set(LAY_BG);
  renderer.setRenderTarget(rt);
  renderer.clear(true,true,false);
  renderer.render(scene,camera);
  renderer.setRenderTarget(null);
  passMat.uniforms.ignoreBlur.value=!act;
  passMat.uniforms.intensity.value=blurTw.i.v[0];
  passMat.uniforms.noiseScale.value=blurTw.n.v[0];
  renderer.clear(true,true,false);
  renderer.render(quadScene,quadCam);
  if(act){
    renderer.clearDepth();
    camera.layers.set(LAY_FG);
    renderer.render(scene,camera);
  }
}

/* ---- boot ---- */
const loader=document.getElementById('loader'), barfill=document.getElementById('barfill');
const setProgress=p=>barfill.style.transform=`scaleX(${p})`;
setProgress(0.06);
const frame=()=>new Promise(r=>{let done=false;const go=()=>{if(!done){done=true;r();}};
  requestAnimationFrame(go);setTimeout(go,34);});

const dataReady = new Promise(res => {
  addEventListener('message', e => {
    if (e.origin !== location.origin || !e.data || e.data.type !== 'shelf-data') return;
    res(e.data.phcs || []);
  });
  parent.postMessage({ type: 'shelf-ready' }, location.origin);
});
// The parent closes the opened register: put the volume back on the shelf.
addEventListener('message', e => {
  if (e.origin === location.origin && e.data && e.data.type === 'shelf-close') clearActive();
});
(async function boot(){
  setCatalogue(await dataReady);
  buildRail();
  try{ await Promise.race([document.fonts.ready,new Promise(r=>setTimeout(r,2200))]); }catch(e){}
  setProgress(0.10);
  await loadPlates();
  setProgress(0.16);
  if(!document.hidden) await frame();
  for(let i=0;i<BOOKS.length;i++){
    books.push(buildBook(BOOKS[i],i));
    setProgress(0.16+0.80*(i+1)/BOOKS.length);
    if(!document.hidden) await frame();
  }
  applyMode();
  resize(); washResize();
  setProgress(1);
  requestAnimationFrame(tick);
  await frame(); await frame();
  loader.classList.add('gone');
  canvas.classList.add('on');
  revealChrome();
  document.querySelector('footer').classList.add('on');
  mbar.classList.add('on');
  startIntro();
})();
