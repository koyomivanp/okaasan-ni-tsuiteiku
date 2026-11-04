import * as THREE from "three";
import type { Shot } from "./camera.ts";
import type { Duck } from "./duck.ts";
import { broodAlive, homeStars, type Game } from "./play.ts";
import { goal, poseAt } from "./route.ts";
import { sound } from "./sound.ts";
import { fromHome, LAKE_ALONG, type OasisStage } from "./stages/oasis-view.ts";
import type { createSky } from "./stages/sky.ts";

// ---- 演出の数値 ----
// 水際（巣からの距離）
const WATER_EDGE = 1.45;
// 湖を回る楕円の大きさ（進行方向・横）
const LOOP_ALONG = 3.5;
const LOOP_SIDE = 2.35;
// 列の間隔と速さ（入水中／全員が入ったあと）
const SWIM_GAP = 0.66;
const ENTER_SPEED = 1.15;
const CRUISE_SPEED = 0.46;
// 全員が入ってから：旅の地名を流しはじめる・結果を出すまでの秒数
const ROLL_AT = 1.5;
const PANEL_AT = 5;
// 夕焼けになるまでの秒数
const SUNSET_TIME = 7;
const JOURNEY = ["公園", "歩道", "高速道路", "商店街", "樹海", "洞窟", "海", "砂漠", "オアシス"];

const forwardX = fromHome(1, 0).x - fromHome(0, 0).x;
const forwardZ = fromHome(1, 0).z - fromHome(0, 0).z;

const NOON = {
  top: new THREE.Color(),
  horizon: new THREE.Color(),
  fog: new THREE.Color(),
  hemiSky: new THREE.Color(),
  hemiGround: new THREE.Color(),
  sun: new THREE.Color(),
  hemi: 1,
  sunPower: 1,
};
const DUSK = {
  top: new THREE.Color(0x4a4fa8),
  horizon: new THREE.Color(0xffa766),
  fog: new THREE.Color(0xf8ae78),
  hemiSky: new THREE.Color(0xffd2a8),
  hemiGround: new THREE.Color(0xd8a878),
  sun: new THREE.Color(0xffa860),
  hemi: 2.1,
  sunPower: 1.5,
};
const WATER_NOON = { deep: new THREE.Color(0x2a93c9), shallow: new THREE.Color(0x57c9dc) };
const WATER_DUSK = { deep: new THREE.Color(0x8a6f9e), shallow: new THREE.Color(0xe8a98c) };

function smoothstep(a: number, b: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

function mix(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

// Everyone follows one line: the path to the nest, a hop into the water, then round and round the lake.
function buildCourse() {
  const center = { along: LAKE_ALONG, side: 0 };
  const onLoop = (angle: number) => ({
    along: center.along + Math.cos(angle) * LOOP_ALONG,
    side: center.side + Math.sin(angle) * LOOP_SIDE,
  });
  const start = Math.PI * 1.22;
  const steps = 720;
  // Bezier from the water's edge onto the loop, leaving the loop's tangent matched.
  const join = onLoop(start);
  const loopTangent = { along: Math.sin(start) * LOOP_ALONG, side: -Math.cos(start) * LOOP_SIDE };
  const tangentLength = Math.hypot(loopTangent.along, loopTangent.side);
  const p0 = { along: WATER_EDGE, side: 0 };
  const p1 = { along: WATER_EDGE + 1.4, side: 0 };
  const p2 = { along: join.along - (loopTangent.along / tangentLength) * 1.2, side: join.side - (loopTangent.side / tangentLength) * 1.2 };
  const bezier = (t: number) => {
    const u = 1 - t;
    return {
      along: u * u * u * p0.along + 3 * u * u * t * p1.along + 3 * u * t * t * p2.along + t * t * t * join.along,
      side: u * u * u * p0.side + 3 * u * u * t * p1.side + 3 * u * t * t * p2.side + t * t * t * join.side,
    };
  };
  const table: { d: number; along: number; side: number }[] = [{ d: WATER_EDGE, along: p0.along, side: p0.side }];
  const walk = (next: { along: number; side: number }) => {
    const last = table[table.length - 1];
    table.push({ d: last.d + Math.hypot(next.along - last.along, next.side - last.side), ...next });
  };
  for (let i = 1; i <= 80; i++) walk(bezier(i / 80));
  const loopFrom = table[table.length - 1].d;
  for (let i = 1; i <= steps; i++) walk(onLoop(start + (i / steps) * Math.PI * 2 * -1));
  const loopLength = table[table.length - 1].d - loopFrom;

  const sample = (d: number) => {
    const wrapped = d > loopFrom ? loopFrom + ((d - loopFrom) % loopLength) : d;
    let lo = 0;
    let hi = table.length - 1;
    while (lo < hi - 1) {
      const mid = (lo + hi) >> 1;
      if (table[mid].d <= wrapped) lo = mid;
      else hi = mid;
    }
    const a = table[lo];
    const b = table[hi];
    const t = (wrapped - a.d) / Math.max(1e-5, b.d - a.d);
    return { along: mix(a.along, b.along, t), side: mix(a.side, b.side, t) };
  };

  return (d: number): { x: number; z: number; yaw: number } => {
    if (d <= 0) return poseAt(goal + d, 0);
    if (d < WATER_EDGE) {
      const at = fromHome(d, 0);
      return { x: at.x, z: at.z, yaw: poseAt(goal, 0).yaw };
    }
    const here = sample(d);
    const on = sample(d + 0.05);
    const a = fromHome(here.along, here.side);
    const b = fromHome(on.along, on.side);
    return { x: a.x, z: a.z, yaw: Math.atan2(b.x - a.x, b.z - a.z) };
  };
}

type Swimmer = {
  duck: Duck;
  shadow: THREE.Object3D | null;
  // Distance behind mom along the course, settling toward its place in the line.
  gap: number;
  place: number;
  offset: { x: number; z: number };
  sink: number;
  wet: boolean;
  counted: boolean;
  lastD: number;
  wake: number;
  seed: number;
};

type Parts = {
  scene: THREE.Scene;
  frame: HTMLElement;
  sky: ReturnType<typeof createSky>;
  oasis: OasisStage;
  hemi: THREE.HemisphereLight;
  sun: THREE.DirectionalLight;
  mother: Duck;
  motherShadow: THREE.Object3D;
  child: Duck;
  childShadow: THREE.Object3D;
  brood: { duck: Duck; shadow: THREE.Object3D; beacon: THREE.Object3D }[];
  restore(): void;
};

export function createEnding(parts: Parts) {
  const { scene, frame, sky, oasis, hemi, sun } = parts;
  const course = buildCourse();
  const fog = scene.fog as THREE.Fog;
  const group = new THREE.Group();
  group.visible = false;
  scene.add(group);

  // The low sun and its halo, far across the lake.
  const halo = (() => {
    const el = document.createElement("canvas");
    el.width = el.height = 256;
    const ctx = el.getContext("2d")!;
    const glow = ctx.createRadialGradient(128, 128, 8, 128, 128, 128);
    glow.addColorStop(0, "rgb(255 250 225 / 100%)");
    glow.addColorStop(0.16, "rgb(255 226 160 / 95%)");
    glow.addColorStop(0.3, "rgb(255 180 110 / 42%)");
    glow.addColorStop(1, "rgb(255 150 90 / 0%)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, 256, 256);
    const map = new THREE.CanvasTexture(el);
    map.colorSpace = THREE.SRGBColorSpace;
    return new THREE.Sprite(new THREE.SpriteMaterial({ map, transparent: true, fog: false, depthWrite: false, blending: THREE.AdditiveBlending }));
  })();
  halo.renderOrder = -27;
  group.add(halo);

  // Expanding rings: every splash and every wake.
  const RINGS = 56;
  const ringGeo = new THREE.RingGeometry(0.82, 1, 30);
  const rings = Array.from({ length: RINGS }, () => {
    const mesh = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, fog: false }));
    mesh.rotation.x = -Math.PI / 2;
    mesh.visible = false;
    group.add(mesh);
    return { mesh, age: 9, life: 1, grow: 1 };
  });
  let nextRing = 0;
  const ring = (x: number, z: number, life: number, grow: number) => {
    const item = rings[nextRing];
    nextRing = (nextRing + 1) % RINGS;
    item.mesh.position.set(x, 0.062, z);
    item.mesh.visible = true;
    item.age = 0;
    item.life = life;
    item.grow = grow;
  };

  // Droplets and sparkles share one pool of little balls.
  const BITS = 260;
  const bits = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 6, 5), new THREE.MeshBasicMaterial({ fog: false }), BITS);
  bits.frustumCulled = false;
  group.add(bits);
  const bitState = Array.from({ length: BITS }, () => ({ x: 0, y: -9, z: 0, vx: 0, vy: 0, vz: 0, age: 9, life: 1, size: 0, drag: 0, gravity: 0 }));
  let nextBit = 0;
  const color = new THREE.Color();
  const bit = (x: number, y: number, z: number, vx: number, vy: number, vz: number, life: number, size: number, hex: number, gravity: number) => {
    const item = bitState[nextBit];
    bits.setColorAt(nextBit, color.setHex(hex));
    nextBit = (nextBit + 1) % BITS;
    Object.assign(item, { x, y, z, vx, vy, vz, age: 0, life, size, gravity });
    if (bits.instanceColor) bits.instanceColor.needsUpdate = true;
  };
  const splash = (x: number, z: number, big: boolean) => {
    const count = big ? 30 : 16;
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = (big ? 1.1 : 0.7) * (0.4 + Math.random());
      bit(x, 0.08, z, Math.cos(a) * r, (big ? 2.5 : 1.8) * (0.6 + Math.random() * 0.6), Math.sin(a) * r, 0.7, 0.022 + Math.random() * 0.024, 0xe8f8ff, 5.5);
    }
    ring(x, z, 1.5, big ? 1.8 : 1.15);
    ring(x, z, 1.1, big ? 1.1 : 0.7);
  };
  const celebrate = () => {
    const at = fromHome(LAKE_ALONG, 0);
    const hues = [0xfff1a8, 0xffd166, 0xff9eb5, 0xffffff, 0x9fe8ff];
    for (let burst = 0; burst < 5; burst++) {
      const cx = at.x + (Math.random() - 0.5) * 6;
      const cz = at.z + (Math.random() - 0.5) * 6;
      for (let i = 0; i < 24; i++) {
        const a = Math.random() * Math.PI * 2;
        const up = 2.2 + Math.random() * 2.4;
        bit(cx, 0.1, cz, Math.cos(a) * 1.3, up, Math.sin(a) * 1.3, 1.5 + Math.random() * 0.6, 0.026 + Math.random() * 0.024, hues[(burst + i) % hues.length], 2.6);
      }
    }
  };

  // A flock crossing the evening sky.
  const birds = Array.from({ length: 7 }, (_, i) => {
    const bird = new THREE.Group();
    const wing = new THREE.BoxGeometry(0.42, 0.015, 0.11);
    const left = new THREE.Mesh(wing, new THREE.MeshBasicMaterial({ color: 0x3a2c4a, fog: false }));
    const right = left.clone();
    left.geometry = wing.clone().translate(-0.21, 0, 0);
    right.geometry = wing.clone().translate(0.21, 0, 0);
    bird.add(left, right);
    group.add(bird);
    return { bird, left, right, row: i };
  });

  // Words over the scene.
  const overlay = document.createElement("div");
  overlay.id = "ending";
  overlay.hidden = true;
  const count = document.createElement("p");
  count.className = "ending-count";
  const line = document.createElement("p");
  line.className = "ending-line";
  const roll = document.createElement("p");
  roll.className = "ending-roll";
  overlay.append(count, line, roll);
  frame.appendChild(overlay);
  const panel = document.querySelector<HTMLDivElement>("#home")!;
  const stars = document.querySelector<HTMLParagraphElement>("#home-stars")!;
  const stats = document.querySelector<HTMLParagraphElement>("#home-stats")!;

  let active = false;
  let clock = 0;
  let allInAt = -1;
  let shownPanel = false;
  let momD = 0;
  let swimmers: Swimmer[] = [];
  let momSwimmer: Swimmer | null = null;
  let counted = 0;
  let total = 0;
  let bloomNow = 0;
  let bloomGoal = 0;
  let starCount = 1;
  let starsLit = 0;
  let starClock = 0;
  let rollLit = 0;
  let cruise = ENTER_SPEED;
  let skipped = false;
  let sunBase = new THREE.Vector3();

  const showPanel = () => {
    if (shownPanel) return;
    shownPanel = true;
    panel.hidden = false;
    frame.classList.add("home-up");
    overlay.classList.add("settled");
    starClock = -0.45;
  };

  const skip = (event: Event) => {
    if (!active || shownPanel) return;
    if ((event.target as HTMLElement).closest("button")) return;
    skipped = true;
    showPanel();
  };
  frame.addEventListener("pointerdown", skip);

  // The sun is ahead of the camera at dusk: this keeps the family's faces warm instead of silhouetted.
  const fill = new THREE.DirectionalLight(0xffe2c4, 0);
  const fillAt = fromHome(-8, 0);
  const fillTo = fromHome(4, 0);
  fill.position.set(fillAt.x, 5, fillAt.z);
  fill.target.position.set(fillTo.x, 0, fillTo.z);
  group.add(fill, fill.target);

  const lightAt = (t: number) => {
    fill.intensity = t * 1.5;
    const top = NOON.top.clone().lerp(DUSK.top, t);
    const horizon = NOON.horizon.clone().lerp(DUSK.horizon, t);
    sky.setColors(top, horizon);
    fog.color.copy(NOON.fog).lerp(DUSK.fog, t);
    hemi.color.copy(NOON.hemiSky).lerp(DUSK.hemiSky, t);
    hemi.groundColor.copy(NOON.hemiGround).lerp(DUSK.hemiGround, t);
    hemi.intensity = mix(NOON.hemi, DUSK.hemi, t);
    sun.color.copy(NOON.sun).lerp(DUSK.sun, t);
    sun.intensity = mix(NOON.sunPower, DUSK.sunPower, t);
    const low = fromHome(70, 0);
    const noonAt = sunBase;
    sun.position.set(mix(noonAt.x, low.x - fromHome(0, 0).x, t), mix(noonAt.y, 7, t), mix(noonAt.z, low.z - fromHome(0, 0).z, t));
    sky.tint(new THREE.Color(0xffffff).lerp(new THREE.Color(0xf0a080), t), new THREE.Color(0xffffff).lerp(new THREE.Color(0xffb48f), t));
    const uniforms = oasis.water.uniforms;
    (uniforms.uDeep.value as THREE.Color).copy(WATER_NOON.deep).lerp(WATER_DUSK.deep, t);
    (uniforms.uShallow.value as THREE.Color).copy(WATER_NOON.shallow).lerp(WATER_DUSK.shallow, t);
    uniforms.uGlow.value = t;
    (uniforms.uGlowFrom.value as THREE.Vector2).set(fromHome(0, 0).x, fromHome(0, 0).z);
    (uniforms.uGlowDir.value as THREE.Vector2).set(forwardX, forwardZ);
    const at = fromHome(90, 0);
    halo.position.set(at.x, mix(26, 9.5, t), at.z);
    halo.scale.setScalar(mix(16, 52, t));
    (halo.material as THREE.SpriteMaterial).opacity = smoothstep(0.05, 0.6, t);
  };

  const shotBetween = (near: Shot, far: Shot, t: number): Shot => ({
    px: mix(near.px, far.px, t),
    py: mix(near.py, far.py, t),
    pz: mix(near.pz, far.pz, t),
    tx: mix(near.tx, far.tx, t),
    ty: mix(near.ty, far.ty, t),
    tz: mix(near.tz, far.tz, t),
    fov: mix(near.fov, far.fov, t),
  });
  const shotFrom = (along: number, side: number, eye: number, lookAlong: number, lookSide: number, lookY: number, fov: number): Shot => {
    const p = fromHome(along, side);
    const t = fromHome(lookAlong, lookSide);
    return { px: p.x, py: eye, pz: p.z, tx: t.x, ty: lookY, tz: t.z, fov };
  };

  let handoff: Shot | null = null;

  return {
    get active(): boolean {
      return active;
    },
    start(game: Game, from: Shot): void {
      active = true;
      clock = 0;
      allInAt = -1;
      shownPanel = false;
      skipped = false;
      momD = game.momS - goal;
      cruise = ENTER_SPEED;
      counted = 0;
      bloomNow = 0;
      starCount = homeStars(game);
      starsLit = 0;
      rollLit = 0;
      handoff = from;
      group.visible = true;
      overlay.hidden = false;
      overlay.classList.remove("settled");
      count.textContent = "";
      line.textContent = "";
      roll.textContent = "";
      panel.hidden = true;
      frame.classList.add("in-ending");
      stars.innerHTML = "★★★".split("").map(() => "<span>★</span>").join("");
      const n = broodAlive(game);
      stats.textContent = `きょうだい ${n}羽\n助けた ${game.rescued}羽・${game.continues === 0 ? "ノーコンティニュー" : `コンティニュー ${game.continues}回`}`;
      total = 0;

      // Capture the world's own daylight to fade out of.
      const fogC = fog.color.clone();
      NOON.fog.copy(fogC);
      NOON.horizon.copy(fogC);
      NOON.top.copy(new THREE.Color(oasis.env.sky).lerp(new THREE.Color(0x3f8fe0), 0.5));
      NOON.hemiSky.copy(hemi.color);
      NOON.hemiGround.copy(hemi.groundColor);
      NOON.hemi = hemi.intensity;
      NOON.sun.copy(sun.color);
      NOON.sunPower = sun.intensity;
      sunBase = sun.position.clone();

      const kids: { duck: Duck; shadow: THREE.Object3D; s: number; lateral: number; x: number; z: number; counted: boolean; seed: number }[] = [];
      const hero = poseAt(game.childS, game.lateral);
      kids.push({ duck: parts.child, shadow: parts.childShadow, s: game.childS, lateral: game.lateral, x: hero.x, z: hero.z, counted: false, seed: 0.3 });
      parts.brood.forEach((view) => {
        view.beacon.visible = false;
      });
      game.brood.forEach((npc, index) => {
        const view = parts.brood[index];
        if (!view) return;
        if (npc.phase !== "walk" || npc.stray) {
          view.duck.object.visible = false;
          view.shadow.visible = false;
          return;
        }
        const pose = poseAt(npc.s, npc.lateral);
        view.duck.object.visible = true;
        view.shadow.visible = true;
        kids.push({ duck: view.duck, shadow: view.shadow, s: npc.s, lateral: npc.lateral, x: pose.x, z: pose.z, counted: true, seed: npc.seed });
        total++;
      });
      bloomGoal = 0;
      kids.sort((a, b) => b.s - a.s);
      swimmers = kids.map((kid, rank) => {
        const line = course(kid.s - goal);
        return {
          duck: kid.duck,
          shadow: kid.shadow,
          gap: momD - (kid.s - goal),
          place: (rank + 1) * SWIM_GAP + 0.25,
          offset: { x: kid.x - line.x, z: kid.z - line.z },
          sink: 0.1 * kid.duck.object.scale.x,
          wet: false,
          counted: kid.counted,
          lastD: kid.s - goal,
          wake: Math.random(),
          seed: kid.seed,
        };
      });
      const momLine = course(momD);
      const momPose = poseAt(game.momS, game.momLateral);
      momSwimmer = {
        duck: parts.mother,
        shadow: parts.motherShadow,
        gap: 0,
        place: 0,
        offset: { x: momPose.x - momLine.x, z: momPose.z - momLine.z },
        sink: 0.13 * parts.mother.object.scale.x,
        wet: false,
        counted: false,
        lastD: momD,
        wake: 0,
        seed: 1.7,
      };
      lightAt(0);
      oasis.bloom(0);
      sound.home();
    },
    stop(): void {
      if (!active) return;
      active = false;
      group.visible = false;
      overlay.hidden = true;
      panel.hidden = true;
      frame.classList.remove("in-ending", "home-up");
      sound.homeStop();
      sun.position.copy(sunBase);
      const uniforms = oasis.water.uniforms;
      (uniforms.uDeep.value as THREE.Color).copy(WATER_NOON.deep);
      (uniforms.uShallow.value as THREE.Color).copy(WATER_NOON.shallow);
      uniforms.uGlow.value = 0;
      fill.intensity = 0;
      oasis.bloom(0);
      parts.mother.object.rotation.set(0, 0, 0);
      parts.child.object.rotation.set(0, 0, 0);
      parts.motherShadow.visible = true;
      parts.childShadow.visible = true;
      parts.restore();
    },
    update(dt: number): void {
      clock += dt;
      oasis.water.uniforms.uTime.value += dt;

      const everyone = momSwimmer ? [momSwimmer, ...swimmers] : swimmers;
      const speedGoal = allInAt >= 0 ? CRUISE_SPEED : ENTER_SPEED;
      cruise += (speedGoal - cruise) * (1 - Math.exp(-dt / 1.6));
      // Mom waits a beat on the bank before she goes in.
      if (clock > 0.55) momD += cruise * dt;

      for (const one of everyone) {
        one.gap += (one.place - one.gap) * (1 - Math.exp(-dt / 0.9));
        const d = momD - one.gap;
        const moved = Math.max(0, d - one.lastD);
        one.lastD = d;
        const line = course(d);
        const fade = Math.exp(-dt / 0.65);
        one.offset.x *= fade;
        one.offset.z *= fade;
        const x = line.x + one.offset.x;
        const z = line.z + one.offset.z;
        const hopping = smoothstep(WATER_EDGE - 0.5, WATER_EDGE + 0.05, d);
        const wetNow = d >= WATER_EDGE;
        if (wetNow && !one.wet) {
          one.wet = true;
          const big = one === momSwimmer;
          splash(x, z, big);
          if (one.counted) {
            counted++;
            count.textContent = `${counted}羽`;
            count.classList.remove("pop");
            void count.offsetWidth;
            count.classList.add("pop");
            bloomGoal = Math.max(bloomGoal, counted / 9);
          }
          sound.plop(one === momSwimmer ? 0 : counted);
        }
        // Up and over the bank on the hop, then sitting low in the water.
        const arc = d > WATER_EDGE - 0.5 && d < WATER_EDGE + 0.05 ? Math.sin(((d - (WATER_EDGE - 0.5)) / 0.55) * Math.PI) * 0.26 : 0;
        const float = hopping >= 1 ? -one.sink + Math.sin(clock * 2.1 + one.seed * 4) * 0.012 : 0;
        one.duck.object.position.set(x, arc + float, z);
        const rock = wetNow ? Math.sin(clock * 1.7 + one.seed * 3) * 0.05 : 0;
        const pitch = arc > 0 ? 0.4 * Math.cos(((d - (WATER_EDGE - 0.5)) / 0.55) * Math.PI) : 0;
        one.duck.object.rotation.set(pitch + rock * 0.4, line.yaw, rock);
        const look = wetNow && allInAt >= 0 ? Math.sin(clock * 0.8 + one.seed * 5) * 0.28 : 0;
        one.duck.update(wetNow ? 0 : moved, 0, look, dt);
        if (one.shadow) {
          one.shadow.visible = !wetNow;
          one.shadow.position.x = x;
          one.shadow.position.z = z;
        }
        if (wetNow) {
          one.wake -= dt * (0.8 + cruise);
          if (one.wake <= 0) {
            one.wake += 1;
            ring(x, z, 1.8, one === momSwimmer ? 0.62 : 0.4);
          }
        }
      }

      if (allInAt < 0 && everyone.every((one) => one.wet)) {
        allInAt = clock;
        celebrate();
        sound.fanfare();
        line.textContent = "ただいま！";
        line.classList.add("show");
        overlay.classList.add("all-in");
      }
      const since = allInAt < 0 ? -1 : clock - allInAt;

      bloomNow += (bloomGoal - bloomNow) * (1 - Math.exp(-dt / 0.5));
      oasis.bloom(bloomNow);

      // The afternoon goes gold as the family comes home.
      const dusk = smoothstep(1, SUNSET_TIME + 3, clock);
      lightAt(dusk);

      if (since >= ROLL_AT && !skipped) {
        const want = Math.min(JOURNEY.length, Math.floor((since - ROLL_AT) / 0.34) + 1);
        while (rollLit < want) {
          roll.textContent = JOURNEY.slice(0, rollLit + 1).join(" ・ ");
          rollLit++;
          sound.note(rollLit);
        }
      }
      if (since >= PANEL_AT) showPanel();

      if (shownPanel) {
        starClock += dt;
        const spans = stars.children;
        while (starsLit < 3 && starClock >= starsLit * 0.5) {
          spans[starsLit].classList.toggle("lit", starsLit < starCount);
          spans[starsLit].classList.add("in");
          if (starsLit < starCount) sound.star(starsLit);
          starsLit++;
        }
      }

      for (const item of rings) {
        if (!item.mesh.visible) continue;
        item.age += dt;
        const t = item.age / item.life;
        if (t >= 1) {
          item.mesh.visible = false;
          continue;
        }
        item.mesh.scale.setScalar(0.08 + t * item.grow);
        (item.mesh.material as THREE.MeshBasicMaterial).opacity = (1 - t) * 0.62;
      }

      const matrix = new THREE.Matrix4();
      bitState.forEach((item, i) => {
        if (item.age >= item.life) {
          matrix.makeScale(0, 0, 0);
          bits.setMatrixAt(i, matrix);
          return;
        }
        item.age += dt;
        item.vy -= item.gravity * dt;
        item.x += item.vx * dt;
        item.y += item.vy * dt;
        item.z += item.vz * dt;
        const size = item.size * (1 - (item.age / item.life) ** 3);
        matrix.makeScale(size, size, size).setPosition(item.x, Math.max(0.06, item.y), item.z);
        bits.setMatrixAt(i, matrix);
      });
      bits.instanceMatrix.needsUpdate = true;
      // Golden motes keep drifting up once the sun is low.
      if (dusk > 0.3 && Math.random() < dt * 9) {
        const a = Math.random() * Math.PI * 2;
        const r = 2 + Math.random() * 7;
        const at = fromHome(LAKE_ALONG + Math.cos(a) * r, Math.sin(a) * r);
        bit(at.x, 0.2, at.z, (Math.random() - 0.5) * 0.14, 0.26 + Math.random() * 0.24, (Math.random() - 0.5) * 0.14, 4.2, 0.016 + Math.random() * 0.014, 0xffe6a0, 0);
      }

      birds.forEach((b) => {
        const t = (clock * 0.055 + 0.02) % 1;
        const across = mix(-34, 34, t);
        const back = Math.abs(b.row - 3);
        const at = fromHome(46 + back * 1.3, across - (b.row - 3) * 1.8);
        b.bird.position.set(at.x, 12.5 + back * 0.65 + Math.sin(clock * 0.6) * 0.4, at.z);
        b.bird.rotation.y = -Math.atan2(forwardZ, forwardX);
        const flap = Math.sin(clock * 5 + b.row) * 0.5;
        b.left.rotation.z = -flap;
        b.right.rotation.z = flap;
        b.bird.visible = dusk > 0.2;
      });
    },
    shot(): Shot {
      const sway = Math.sin(clock * 0.16);
      // Close by the bank for the splash-down, rising to take in the lake and the sun.
      const bank = shotFrom(-3.1 + clock * 0.04, -3.6 + clock * 0.1, 1.45, 2.3, 0.2, 0.28, 50);
      const wide = shotFrom(-4.2, -1 + sway * 1.3, 3.15, 4.1, sway * 0.5, 0.25, 56);
      const rise = allInAt < 0 ? 0 : smoothstep(0, 3.6, clock - allInAt);
      const scene = shotBetween(bank, wide, rise);
      if (!handoff) return scene;
      const out = shotBetween(handoff, scene, smoothstep(0, 1.5, clock));
      if (clock > 1.5) handoff = null;
      return out;
    },
  };
}
