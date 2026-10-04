/**
 * hospitalScene — a small procedural 3D hospital (reception → ward → operating
 * theatre → CT scan) built from simple shapes in the app's teal/slate palette.
 * The camera position is driven by a 0..1 progress value (the page scroll), and
 * dwells in each room before travelling through the doorway to the next.
 */
import * as THREE from 'three';

export interface TourScene {
  setProgress(p: number): void;
  resize(w: number, h: number): void;
  setActive(active: boolean): void;
  dispose(): void;
}

const C = {
  wall: 0xefe9dd,
  wallDark: 0xe2dbcc,
  slate: 0x423d35,
  slateDark: 0x1b1814,
  slateMid: 0x7a7263,
  teal: 0xe0663a, // burnt orange accent (ID-card palette)
  tealDark: 0x9a4022,
  tealLight: 0xf5c3ab,
  white: 0xfaf7f0,
  wood: 0xc9a27e,
  orange: 0x3a4b5e, // navy for contrast against the orange accent
  skin: 0xe7c9a8,
  green: 0x3f8f6a,
};

const ROOM_W = 14;
const ROOM_D = 14;
const WALL_H = 4.2;
const DOOR_W = 3.2;
const DOOR_H = 3.1;
export const ROOM_Z = [0, -14, -28, -42];

/** Camera keyframes: p = scroll progress, pos = camera, look = target. */
const KEYS: { p: number; pos: [number, number, number]; look: [number, number, number] }[] = [
  { p: 0.0, pos: [0, 5.2, 10.5], look: [0, 1.2, -1] },
  { p: 0.13, pos: [-3.4, 2.8, 3.8], look: [1.2, 1.3, -2.4] },
  { p: 0.2, pos: [-0.6, 2.4, -2.5], look: [0, 1.8, -10] },
  { p: 0.27, pos: [0, 2.3, -7.6], look: [0, 1.7, -14] },
  { p: 0.37, pos: [4.6, 3.6, -9.8], look: [-1.8, 0.9, -16] },
  { p: 0.45, pos: [-1.2, 2.4, -12.6], look: [-4.2, 1.0, -17.5] },
  { p: 0.52, pos: [0, 2.3, -21.6], look: [0, 1.7, -28] },
  { p: 0.62, pos: [4.2, 4.0, -23.6], look: [0, 1.0, -29] },
  { p: 0.7, pos: [-2.2, 3.2, -25.2], look: [0.2, 1.0, -29] },
  { p: 0.78, pos: [0, 2.3, -35.6], look: [0, 1.6, -42] },
  { p: 0.9, pos: [4.6, 3.2, -37.5], look: [-0.4, 1.4, -43.2] },
  { p: 1.0, pos: [-3.6, 2.9, -38.4], look: [0.6, 1.3, -43.6] },
];

const smooth = (t: number) => t * t * (3 - 2 * t);

function mat(color: number, opts: Partial<THREE.MeshStandardMaterialParameters> = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.78, metalness: 0.02, ...opts });
}

function box(w: number, h: number, d: number, m: THREE.Material, x = 0, y = 0, z = 0) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function cyl(rt: number, rb: number, h: number, m: THREE.Material, x = 0, y = 0, z = 0, seg = 20) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/** A simple standing figure: capsule body, head, optional cap. */
function person(color: number, x: number, z: number, opts: { rotY?: number; cap?: number; scale?: number } = {}) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.32, 0.9, 6, 12), mat(color));
  body.position.y = 0.95;
  body.castShadow = true;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 18, 14), mat(C.skin));
  head.position.y = 1.86;
  head.castShadow = true;
  g.add(body, head);
  if (opts.cap !== undefined) {
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.25, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat(opts.cap));
    cap.position.y = 1.9;
    g.add(cap);
  }
  g.position.set(x, 0, z);
  g.rotation.y = opts.rotY ?? 0;
  g.scale.setScalar(opts.scale ?? 1);
  return g;
}

function label(text: string, sub: string) {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#1b1814';
  ctx.beginPath();
  ctx.roundRect(8, 8, 1008, 240, 36);
  ctx.fill();
  ctx.fillStyle = '#e0663a';
  ctx.fillRect(56, 70, 16, 116);
  ctx.fillStyle = '#ece7da';
  ctx.font = '700 92px Inter, system-ui, sans-serif';
  ctx.fillText(text, 100, 150);
  ctx.fillStyle = '#a39a88';
  ctx.font = '500 40px Inter, system-ui, sans-serif';
  ctx.fillText(sub, 102, 206);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(4, 1), new THREE.MeshBasicMaterial({ map: tex, transparent: true }));
  return plane;
}

/** Monitor with a scrolling heartbeat trace. */
function monitor(w = 1.1, h = 0.7) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#11100d';
  ctx.fillRect(0, 0, 512, 256);
  ctx.strokeStyle = '#f0a063';
  ctx.lineWidth = 6;
  ctx.beginPath();
  for (let x = 0; x <= 512; x += 4) {
    const k = x % 128;
    const y = k > 50 && k < 58 ? 60 : k > 58 && k < 66 ? 200 : k > 66 && k < 72 ? 110 : 140;
    if (x === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  const g = new THREE.Group();
  g.add(box(w + 0.12, h + 0.12, 0.08, mat(C.slateDark)));
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex }));
  screen.position.z = 0.045;
  g.add(screen);
  return { group: g, tex };
}

function buildRoomShell(scene: THREE.Scene, zc: number, floorColor: number, hasBackDoor: boolean, hasFrontDoor: boolean) {
  const floor = new THREE.Mesh(new THREE.BoxGeometry(ROOM_W, 0.2, ROOM_D), mat(floorColor, { roughness: 0.6 }));
  floor.position.set(0, -0.1, zc);
  floor.receiveShadow = true;
  scene.add(floor);
  // floor tiles for scale
  const grid = new THREE.GridHelper(ROOM_W, 14, 0xffffff, 0xffffff);
  (grid.material as THREE.Material).opacity = 0.18;
  (grid.material as THREE.Material).transparent = true;
  grid.position.set(0, 0.005, zc);
  scene.add(grid);

  const wallM = mat(C.wall);
  const sideM = mat(C.wallDark);
  scene.add(box(0.25, WALL_H, ROOM_D, sideM, -ROOM_W / 2, WALL_H / 2, zc));
  scene.add(box(0.25, WALL_H, ROOM_D, sideM, ROOM_W / 2, WALL_H / 2, zc));
  // skirting stripe in teal
  scene.add(box(0.27, 0.22, ROOM_D, mat(C.tealDark), -ROOM_W / 2, 0.11, zc));
  scene.add(box(0.27, 0.22, ROOM_D, mat(C.tealDark), ROOM_W / 2, 0.11, zc));

  const wallWithDoor = (z: number) => {
    const seg = (ROOM_W - DOOR_W) / 2;
    scene.add(box(seg, WALL_H, 0.25, wallM, -(DOOR_W / 2 + seg / 2), WALL_H / 2, z));
    scene.add(box(seg, WALL_H, 0.25, wallM, DOOR_W / 2 + seg / 2, WALL_H / 2, z));
    scene.add(box(DOOR_W, WALL_H - DOOR_H, 0.25, wallM, 0, DOOR_H + (WALL_H - DOOR_H) / 2, z));
    // door frame
    const fm = mat(C.teal);
    scene.add(box(0.14, DOOR_H, 0.34, fm, -DOOR_W / 2, DOOR_H / 2, z));
    scene.add(box(0.14, DOOR_H, 0.34, fm, DOOR_W / 2, DOOR_H / 2, z));
    scene.add(box(DOOR_W + 0.14, 0.14, 0.34, fm, 0, DOOR_H, z));
  };
  if (hasBackDoor) wallWithDoor(zc - ROOM_D / 2);
  else scene.add(box(ROOM_W, WALL_H, 0.25, wallM, 0, WALL_H / 2, zc - ROOM_D / 2));
  void hasFrontDoor; // the first room is open to the camera at the front
}

export function createHospitalScene(canvas: HTMLCanvasElement): TourScene {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf2ede3);
  scene.fog = new THREE.Fog(0xf2ede3, 16, 34);

  const camera = new THREE.PerspectiveCamera(50, 16 / 9, 0.1, 120);

  scene.add(new THREE.HemisphereLight(0xfffaf0, 0xcdc4b1, 1.6));
  const sun = new THREE.DirectionalLight(0xffffff, 1.6);
  sun.position.set(8, 14, 6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -12;
  sun.shadow.camera.right = 12;
  sun.shadow.camera.top = 30;
  sun.shadow.camera.bottom = -30;
  sun.shadow.camera.far = 80;
  sun.shadow.bias = -0.0004;
  scene.add(sun);
  scene.add(sun.target);

  const animated: ((t: number) => void)[] = [];

  // ── Reception ────────────────────────────────────────────────────────────
  {
    const z = ROOM_Z[0];
    buildRoomShell(scene, z, 0xe7e2d6, true, false);
    // curved-ish counter: three boxes
    const counter = mat(C.white);
    scene.add(box(5, 1.1, 1, counter, 0, 0.55, z - 2.4));
    scene.add(box(1, 1.1, 2.2, counter, -3, 0.55, z - 1.3));
    scene.add(box(5.2, 0.08, 1.2, mat(C.teal), 0, 1.14, z - 2.4));
    scene.add(box(1.2, 0.08, 2.4, mat(C.teal), -3, 1.14, z - 1.3));
    const mon = monitor(0.8, 0.5);
    mon.group.position.set(0.8, 1.55, z - 2.55);
    scene.add(mon.group);
    animated.push((t) => (mon.tex.offset.x = (t * 0.15) % 1));
    scene.add(person(C.teal, 0, z - 3.4, { rotY: 0 }));
    // waiting chairs
    for (let i = 0; i < 4; i++) {
      scene.add(box(0.8, 0.12, 0.8, mat(C.slateMid), 4.6, 0.5, z + 1.6 - i * 1.0));
      scene.add(box(0.12, 0.7, 0.8, mat(C.slateMid), 5.04, 0.85, z + 1.6 - i * 1.0));
      scene.add(cyl(0.04, 0.04, 0.5, mat(C.slateDark), 4.6, 0.25, z + 1.6 - i * 1.0, 8));
    }
    scene.add(person(C.orange, 4.6, z + 0.6, { rotY: -Math.PI / 2, scale: 0.92 }));
    // plants
    for (const [px, pz] of [[-5.8, z + 4.5], [5.8, z - 5.6]]) {
      scene.add(cyl(0.35, 0.28, 0.6, mat(C.slate), px, 0.3, pz));
      const leaf = new THREE.Mesh(new THREE.IcosahedronGeometry(0.75, 1), mat(0x4d9f7c, { flatShading: true }));
      leaf.position.set(px, 1.25, pz);
      leaf.castShadow = true;
      scene.add(leaf);
    }
    const sign = label('Reception', 'Patients registered across every PHC');
    sign.position.set(0, 3.2, z - 6.8);
    scene.add(sign);
  }

  // ── Ward ─────────────────────────────────────────────────────────────────
  {
    const z = ROOM_Z[1];
    buildRoomShell(scene, z, 0xe6ddcd, true, true);
    const bedFrame = mat(C.slateMid);
    const sheet = mat(C.white);
    const blanket = mat(C.tealLight);
    for (let i = 0; i < 3; i++) {
      const bz = z + 3.6 - i * 3.6;
      scene.add(box(2.2, 0.5, 1.1, bedFrame, -4.4, 0.45, bz));
      scene.add(box(2.1, 0.22, 1.0, sheet, -4.4, 0.81, bz));
      scene.add(box(1.3, 0.12, 1.02, blanket, -4.0, 0.95, bz));
      scene.add(box(0.5, 0.14, 0.7, sheet, -5.2, 0.98, bz));
      scene.add(box(0.12, 1.2, 1.1, bedFrame, -5.55, 0.9, bz));
      // patient lying down
      const p = new THREE.Mesh(new THREE.CapsuleGeometry(0.26, 1.1, 6, 12), mat(i === 1 ? C.orange : 0x8ea3bb));
      p.rotation.z = Math.PI / 2;
      p.position.set(-4.2, 1.12, bz);
      p.castShadow = true;
      scene.add(p);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 12), mat(C.skin));
      head.position.set(-5.1, 1.16, bz);
      scene.add(head);
      // IV stand
      scene.add(cyl(0.03, 0.03, 2, mat(C.slate), -3, 1, bz - 0.7, 8));
      const bag = box(0.22, 0.32, 0.08, mat(0xdbe3ec, { transparent: true, opacity: 0.85 }), -3, 1.85, bz - 0.7);
      scene.add(bag);
      // bedside table + monitor
      scene.add(box(0.6, 0.7, 0.6, mat(C.white), -5.9, 0.35, bz - 0.9));
      if (i !== 2) {
        const mon = monitor(0.6, 0.4);
        mon.group.position.set(-6.6, 2.1, bz);
        mon.group.rotation.y = Math.PI / 2;
        scene.add(mon.group);
        animated.push((t) => (mon.tex.offset.x = (t * 0.2 + i * 0.3) % 1));
      }
      // privacy curtain
      if (i < 2) {
        const curtain = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.4, 12, 1), mat(0xe7a07a, { side: THREE.DoubleSide, transparent: true, opacity: 0.6 }));
        const pos = curtain.geometry.attributes.position;
        for (let v = 0; v < pos.count; v++) pos.setZ(v, Math.sin(pos.getX(v) * 6) * 0.06);
        curtain.geometry.computeVertexNormals();
        curtain.position.set(-4.4, 1.8, bz - 1.8);
        scene.add(curtain);
      }
    }
    scene.add(person(C.teal, -2.4, z + 0.2, { rotY: -Math.PI / 2, cap: C.white }));
    scene.add(person(0xffffff, 1.2, z - 3.2, { rotY: -Math.PI / 3 }));
    scene.add(box(1.4, 0.9, 0.7, mat(C.white), 4.8, 0.45, z + 4.2));
    const sign = label('General ward', 'Patients whose dose is under review');
    sign.position.set(0, 3.2, z - 6.8);
    scene.add(sign);
  }

  // ── Operating theatre ────────────────────────────────────────────────────
  {
    const z = ROOM_Z[2];
    buildRoomShell(scene, z, 0xf0dccf, true, true);
    scene.add(cyl(0.35, 0.5, 0.8, mat(C.slateMid), 0, 0.4, z - 1));
    scene.add(box(2.6, 0.18, 0.9, mat(C.slate), 0, 0.88, z - 1));
    scene.add(box(2.4, 0.1, 0.8, mat(0xf5c3ab), 0, 1.0, z - 1));
    const patient = new THREE.Mesh(new THREE.CapsuleGeometry(0.26, 1.2, 6, 12), mat(0xee9f7a));
    patient.rotation.z = Math.PI / 2;
    patient.position.set(0.1, 1.27, z - 1);
    scene.add(patient);
    // surgical lamp
    scene.add(cyl(0.05, 0.05, 1.4, mat(C.slate), 0, 3.5, z - 1, 8));
    const lampArm = box(0.08, 0.08, 1.4, mat(C.slate), 0, 2.8, z - 0.4);
    scene.add(lampArm);
    const lamp = cyl(0.75, 0.5, 0.22, mat(C.white), 0, 2.7, z - 0.7, 32);
    scene.add(lamp);
    const glowMat = new THREE.MeshBasicMaterial({ color: 0xfffbe6 });
    const glow = new THREE.Mesh(new THREE.CircleGeometry(0.55, 32), glowMat);
    glow.rotation.x = Math.PI / 2;
    glow.position.set(0, 2.58, z - 0.7);
    scene.add(glow);
    const spot = new THREE.SpotLight(0xfff4d6, 18, 6, Math.PI / 5, 0.5, 1.4);
    spot.position.set(0, 2.55, z - 0.7);
    spot.target.position.set(0, 1, z - 1);
    scene.add(spot, spot.target);
    animated.push((t) => (spot.intensity = 16 + Math.sin(t * 2) * 1.5));
    // surgeons
    scene.add(person(C.tealDark, -1.0, z - 2.1, { cap: C.teal }));
    scene.add(person(C.tealDark, 1.2, z - 2.0, { cap: C.teal, rotY: -0.4 }));
    scene.add(person(C.tealDark, 1.6, z + 0.2, { cap: C.teal, rotY: -2.5 }));
    // trolley and anaesthesia machine
    scene.add(box(1.2, 0.08, 0.6, mat(0xcdc4b1, { metalness: 0.6, roughness: 0.3 }), -2.6, 1.0, z + 0.6));
    for (const dx of [-0.5, 0.5]) for (const dz of [-0.24, 0.24]) scene.add(cyl(0.03, 0.03, 1, mat(C.slate), -2.6 + dx, 0.5, z + 0.6 + dz, 6));
    scene.add(box(0.9, 1.6, 0.8, mat(C.slate), 3.4, 0.8, z - 2.4));
    const mon = monitor(0.9, 0.6);
    mon.group.position.set(3.4, 2.05, z - 2.0);
    mon.group.rotation.y = -0.5;
    scene.add(mon.group);
    animated.push((t) => (mon.tex.offset.x = (t * 0.25) % 1));
    const sign = label('Operating theatre', 'Conflicts reviewed by clinicians');
    sign.position.set(0, 3.25, z - 6.8);
    scene.add(sign);
  }

  // ── CT scan ──────────────────────────────────────────────────────────────
  let couch: THREE.Mesh | null = null;
  {
    const z = ROOM_Z[3];
    buildRoomShell(scene, z, 0xe9e3d6, false, true);
    const gantry = new THREE.Group();
    // Housing: a rounded block with the bore cut through it.
    const shape = new THREE.Shape();
    const W = 1.75;
    const H = 1.65;
    const r = 0.45;
    shape.moveTo(-W + r, -H);
    shape.lineTo(W - r, -H);
    shape.quadraticCurveTo(W, -H, W, -H + r);
    shape.lineTo(W, H - r);
    shape.quadraticCurveTo(W, H, W - r, H);
    shape.lineTo(-W + r, H);
    shape.quadraticCurveTo(-W, H, -W, H - r);
    shape.lineTo(-W, -H + r);
    shape.quadraticCurveTo(-W, -H, -W + r, -H);
    const bore = new THREE.Path();
    bore.absarc(0, 0.05, 0.95, 0, Math.PI * 2, true);
    shape.holes.push(bore);
    const housing = new THREE.Mesh(
      new THREE.ExtrudeGeometry(shape, { depth: 0.9, bevelEnabled: true, bevelSize: 0.08, bevelThickness: 0.08, bevelSegments: 4, curveSegments: 48 }),
      mat(C.white, { roughness: 0.45 }),
    );
    housing.position.z = -0.45;
    housing.castShadow = true;
    housing.receiveShadow = true;
    const inner = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.95, 0.9, 48, 1, true), mat(0xcdc4b1, { side: THREE.BackSide }));
    inner.rotation.x = Math.PI / 2;
    inner.position.y = 0.05;
    const accent = new THREE.Mesh(new THREE.TorusGeometry(1.15, 0.045, 12, 64), new THREE.MeshBasicMaterial({ color: C.teal }));
    accent.position.set(0, 0.05, 0.54);
    gantry.add(housing, inner, accent);
    gantry.position.set(0, 1.75, z - 2.8);
    scene.add(gantry);
    animated.push((t) => ((accent.material as THREE.MeshBasicMaterial).color.setHSL(0.045, 0.72, 0.42 + Math.sin(t * 3) * 0.08)));
    scene.add(box(0.8, 0.8, 3.6, mat(C.slateMid), 0, 0.4, z + 0.2));
    couch = box(0.7, 0.14, 3.2, mat(C.white), 0, 0.88, z + 0.4);
    scene.add(couch);
    const pt = new THREE.Mesh(new THREE.CapsuleGeometry(0.24, 1.2, 6, 12), mat(0x8ea3bb));
    pt.rotation.x = Math.PI / 2;
    pt.position.set(0, 0.28, 0.2);
    couch.add(pt);
    // control window and technician
    scene.add(box(4.6, 1.6, 0.12, mat(0xd8c9b4, { transparent: true, opacity: 0.35, roughness: 0.1 }), 4.6, 2.0, z + 3.2));
    scene.add(box(2, 0.9, 0.8, mat(C.slate), 5.4, 0.45, z + 4.6));
    scene.add(person(C.teal, 5.4, z + 5.4, { rotY: Math.PI }));
    const mon = monitor(1.0, 0.6);
    mon.group.position.set(5.4, 1.35, z + 4.3);
    mon.group.rotation.y = Math.PI;
    scene.add(mon.group);
    animated.push((t) => (mon.tex.offset.x = (t * 0.2) % 1));
    const sign = label('CT scan', 'Devices syncing with the district');
    sign.position.set(-3.4, 3.25, z - 6.8);
    scene.add(sign);
  }

  // ── Camera from progress ─────────────────────────────────────────────────
  let progress = 0;
  const pos = new THREE.Vector3();
  const look = new THREE.Vector3();
  const curPos = new THREE.Vector3(...KEYS[0].pos);
  const curLook = new THREE.Vector3(...KEYS[0].look);
  const target = (p: number) => {
    let i = 0;
    while (i < KEYS.length - 2 && p > KEYS[i + 1].p) i++;
    const a = KEYS[i];
    const b = KEYS[i + 1];
    const t = smooth(Math.min(1, Math.max(0, (p - a.p) / (b.p - a.p))));
    pos.set(...a.pos).lerp(new THREE.Vector3(...b.pos), t);
    look.set(...a.look).lerp(new THREE.Vector3(...b.look), t);
  };
  target(0);
  camera.position.copy(curPos);
  camera.lookAt(curLook);

  let active = true;
  let raf = 0;
  const clock = new THREE.Clock();
  const loop = () => {
    raf = requestAnimationFrame(loop);
    if (!active) return;
    const t = clock.getElapsedTime();
    target(progress);
    // ease toward the scroll target so wheel steps feel like a glide
    const k = reduce ? 1 : 0.09;
    curPos.lerp(pos, k);
    curLook.lerp(look, k);
    camera.position.copy(curPos);
    camera.lookAt(curLook);
    sun.position.set(curPos.x + 8, 14, curPos.z + 6);
    sun.target.position.set(curPos.x, 0, curPos.z - 6);
    if (!reduce) {
      for (const fn of animated) fn(t);
      if (couch) couch.position.z = ROOM_Z[3] + 0.4 - (Math.sin(t * 0.6) * 0.5 + 0.5) * 1.6;
    }
    renderer.render(scene, camera);
  };
  loop();

  return {
    setProgress(p) {
      progress = Math.min(1, Math.max(0, p));
    },
    resize(w, h) {
      renderer.setSize(w, h, false);
      camera.aspect = w / Math.max(1, h);
      camera.fov = camera.aspect < 0.8 ? 64 : 50;
      camera.updateProjectionMatrix();
    },
    setActive(a) {
      active = a;
      if (a) clock.getDelta();
    },
    dispose() {
      cancelAnimationFrame(raf);
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        m.geometry?.dispose();
        const mm = m.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(mm)) mm.forEach((x) => x.dispose());
        else mm?.dispose();
      });
      renderer.dispose();
    },
  };
}
