import * as THREE from "three";
import { sound } from "../sound.ts";
import type { Game } from "../play.ts";
import { kingStart } from "../route.ts";
import {
  BEAM_HALF,
  beamState,
  BOULDER_RADIUS,
  boulderS,
  DOOR,
  KEYS_TO_WIN,
  keyS,
  KING_BEHIND,
  KING_BOUND,
  kingFight,
  kingRush,
  kingWon,
  leapImpact,
  RUSH_BACK_AT,
  RUSH_TIME,
  waveS,
} from "./king.ts";
import { put, strip, type StageView } from "./view-kit.ts";

// ---- 見た目の数値 ----
// 王の大きさ
const KING_SCALE = 1.15;
// 王の台座の高さ（扉より上に王の顔が出るように）
const PLINTH = 0.5;
// 柱の間隔（距離）
const PILLAR_EVERY = 2.6;
// 檻：半径、高さ、落ちてくるのにかかる秒数、鉄格子の本数
const CAGE_RADIUS = 0.7;
const CAGE_HEIGHT = 1.45;
const CAGE_DROP = 0.3;
const CAGE_BARS = 12;
// 戦う床の幅（片側）
const ARENA = KING_BOUND + 0.25;
// 呪いの波の高さ
const WAVE_HEIGHT = 0.55;

// The king's hall: pillars, a sealed door, mom in a cage, and the pharaoh glaring over it all.
export function kingView(): StageView {
  const group = new THREE.Group();
  const s0 = kingStart;
  const door = s0 + DOOR;

  const floor = new THREE.MeshLambertMaterial({ color: 0x9c8460 });
  const stone = new THREE.MeshLambertMaterial({ color: 0xc8a868 });
  const gold = new THREE.MeshLambertMaterial({ color: 0xf0c040, emissive: 0x3a2a00 });
  const blue = new THREE.MeshLambertMaterial({ color: 0x2f5f9a });
  strip(group, s0 - 1, door + 4, -6, 6, floor, 0.02, 0.04, 1);
  for (const side of [-1, 1]) strip(group, s0 - 1, door + 4, side * 3.2, side * 3.6, stone, 0, 4.5, 1);
  strip(group, s0 - 1, door + 4, -3.6, 3.6, stone, 4.5, 0.3, 1);
  // The strip of floor the chick can run on: everything that comes at it stays inside these lines.
  strip(group, door - 7, door + 0.2, -ARENA, ARENA, new THREE.MeshLambertMaterial({ color: 0x5a3a2c }), 0.05, 0.02, 1);
  for (const side of [-1, 1]) strip(group, door - 7, door + 0.2, side * ARENA - 0.04, side * ARENA + 0.04, gold, 0.06, 0.02, 1);
  for (let s = s0 + 0.6; s < door; s += PILLAR_EVERY) {
    for (const side of [-1, 1]) {
      const pillar = put(new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 4.5, 10), stone), s, side * 2.5, 2.25);
      const ring = put(new THREE.Mesh(new THREE.CylinderGeometry(0.33, 0.33, 0.18, 10), blue), s, side * 2.5, 3.6);
      group.add(pillar, ring);
    }
  }
  const flameMat = new THREE.MeshBasicMaterial({ color: 0xffa040 });
  const flames: THREE.Mesh[] = [];
  for (let s = s0 + 1.9; s < door; s += PILLAR_EVERY) {
    for (const side of [-1, 1]) {
      const flame = put(new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.28, 7), flameMat), s, side * 3.05, 2.1);
      group.add(flame);
      flames.push(flame);
    }
  }

  // The door: a slab that mom smashes flat on her way to the king; daylight once he is down.
  const hinge = put(new THREE.Group(), door + 0.55, 0, 0.04);
  const slab = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.1, 0.3), stone);
  slab.position.set(0, 1.05, -0.15);
  hinge.add(slab);
  const frame = put(new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.3, 0.4), gold), door + 0.4, 0, 2.25);
  const lightMat = new THREE.MeshBasicMaterial({ color: 0xfff6dc, fog: false, transparent: true, opacity: 0, depthWrite: false });
  const light = put(new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.4), lightMat), door + 3.95, 0, 1.2, Math.PI);
  group.add(hinge, frame, light);

  // The pharaoh: blue-and-gold striped headdress, gold mask, red glowing eyes.
  const king = new THREE.Group();
  const robe = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.6, 1.6, 10), new THREE.MeshLambertMaterial({ color: 0xece4d0 }));
  robe.position.y = 0.8;
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.18, 12), gold);
  collar.position.y = 1.62;
  const face = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.5, 0.36), gold);
  face.position.y = 1.98;
  king.add(robe, collar, face);
  for (let k = 0; k < 5; k++) {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.08, 0.42), k % 2 === 0 ? blue : gold);
    stripe.position.set(0, 2.32 - k * 0.11, -0.06);
    king.add(stripe);
  }
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff2a1a, fog: false });
  for (const x of [-0.1, 0.1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), eyeMat);
    eye.position.set(x, 2.02, 0.19);
    king.add(eye);
  }
  const crook = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.9, 0.06), gold);
  crook.position.set(0.5, 1.1, 0.2);
  king.add(crook);
  king.scale.setScalar(KING_SCALE);
  put(king, door + KING_BEHIND, 0, PLINTH, Math.PI);
  group.add(king);
  const plinth = put(new THREE.Mesh(new THREE.BoxGeometry(2, PLINTH, 1.2), stone), door + KING_BEHIND, 0, PLINTH / 2);
  group.add(plinth);

  // The cage that drops over mom, with one lock per key across its front.
  const cage = put(new THREE.Group(), door, 0, 0);
  const barGeo = new THREE.CylinderGeometry(0.03, 0.03, CAGE_HEIGHT, 6);
  const bars = Array.from({ length: CAGE_BARS }, (_, k) => {
    const a = (k / CAGE_BARS) * Math.PI * 2;
    const bar = new THREE.Mesh(barGeo, gold);
    bar.position.set(Math.cos(a) * CAGE_RADIUS, CAGE_HEIGHT / 2, Math.sin(a) * CAGE_RADIUS);
    cage.add(bar);
    return { bar, a };
  });
  const lid = new THREE.Mesh(new THREE.CylinderGeometry(CAGE_RADIUS + 0.05, CAGE_RADIUS + 0.05, 0.07, CAGE_BARS), gold);
  lid.position.y = CAGE_HEIGHT;
  cage.add(lid);
  const lockMat = new THREE.MeshBasicMaterial({ color: 0xff3a2a, fog: false });
  const locks = Array.from({ length: KEYS_TO_WIN }, (_, k) => {
    const lock = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.08), lockMat);
    lock.position.set((k - (KEYS_TO_WIN - 1) / 2) * 0.32, 0.72, -CAGE_RADIUS - 0.05);
    cage.add(lock);
    return lock;
  });
  cage.visible = false;
  group.add(cage);

  // The key sliding down the hall, bright against the floor, with a ring so it reads from far off.
  const keyMat = new THREE.MeshBasicMaterial({ color: 0xffd040, fog: false });
  const keyModel = new THREE.Group();
  const bow = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.032, 8, 16), keyMat);
  bow.position.y = 0.2;
  const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.3, 0.045), keyMat);
  shaft.position.y = 0;
  const tooth = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.045, 0.045), keyMat);
  tooth.position.set(0.06, -0.12, 0);
  keyModel.add(bow, shaft, tooth);
  const keyRing = new THREE.Mesh(
    new THREE.RingGeometry(0.28, 0.38, 24),
    new THREE.MeshBasicMaterial({ color: 0xfff0a0, fog: false, transparent: true, opacity: 0.75, depthWrite: false }),
  );
  keyRing.rotation.x = -Math.PI / 2;
  const keyGroup = new THREE.Group();
  keyModel.position.y = 0.42;
  keyRing.position.y = 0.08;
  keyGroup.add(keyModel, keyRing);
  keyGroup.visible = false;
  group.add(keyGroup);

  // Curse waves: a wall across the floor with one clear gap, its edges picked out so the gap reads at a glance.
  const waveMat = new THREE.MeshBasicMaterial({ color: 0xff4a2a, fog: false, transparent: true, opacity: 0.78, depthWrite: false });
  const edgeMat = new THREE.MeshBasicMaterial({ color: 0xfff0b0, fog: false });
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const waves = [0, 1, 2].map(() => {
    const left = new THREE.Mesh(boxGeo, waveMat);
    const right = new THREE.Mesh(boxGeo, waveMat);
    const edges = [new THREE.Mesh(boxGeo, edgeMat), new THREE.Mesh(boxGeo, edgeMat)];
    for (const edge of edges) edge.scale.set(0.05, WAVE_HEIGHT + 0.12, 0.14);
    left.visible = right.visible = false;
    group.add(left, right, ...edges);
    return { left, right, edges };
  });

  // Beams: a thin red line flickers where the next one will strike, then a bright bar that stays a moment.
  const warnMat = new THREE.MeshBasicMaterial({ color: 0xff4030, fog: false, transparent: true, opacity: 0, depthWrite: false });
  const liveMat = new THREE.MeshBasicMaterial({ color: 0xffe0c0, fog: false, transparent: true, opacity: 0.9, depthWrite: false });
  const beams = [0, 1].map(() => {
    const warn = new THREE.Mesh(new THREE.BoxGeometry(BEAM_HALF * 2, 0.02, 1), warnMat.clone());
    const live = new THREE.Mesh(new THREE.BoxGeometry(BEAM_HALF * 2, 0.5, 1), liveMat);
    warn.visible = false;
    live.visible = false;
    group.add(warn, live);
    return { warn, live };
  });

  const rockMat = new THREE.MeshLambertMaterial({ color: 0x8f7a58 });
  const boulders = [0, 1].map(() => {
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(BOULDER_RADIUS, 0), rockMat);
    rock.visible = false;
    group.add(rock);
    return rock;
  });

  // A burst of stars on the king for every duck that lands on him.
  const starMat = new THREE.MeshBasicMaterial({ color: 0xfff2a0, fog: false, transparent: true, depthWrite: false });
  const stars = Array.from({ length: 8 }, () => {
    const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.16, 0), starMat);
    star.visible = false;
    group.add(star);
    return { star, born: -Infinity, lateral: 0, y: 0 };
  });

  // Sound and bursts fire on the change from one frame to the next.
  let heardFight: object | null = null;
  let heardGot = 0;
  let heardHits = 0;
  let nextStar = 0;

  return {
    env: {
      sky: 0x1e1206,
      fog: 0x1e1206,
      near: 7,
      far: 22,
      hemiSky: 0xffc070,
      hemiGround: 0x2a1a0a,
      hemi: 1.1,
      sunColor: 0xffb060,
      sun: 0.5,
      lantern: 2.5,
    },
    group,
    veil: { color: "#1e1206", before: 0.8, after: 0.8 },
    update(game: Game) {
      const t = game.time;
      flames.forEach((flame, i) => flame.scale.set(1, 0.85 + Math.sin(t * 13 + i * 2.1) * 0.15, 1));
      const fight = kingFight();
      const rush = kingRush(t);
      const won = kingWon(t);

      if (fight !== heardFight) {
        heardFight = fight;
        heardGot = 0;
        heardHits = 0;
        if (fight) sound.rumble();
      }
      const got = fight?.got ?? 0;
      if (got > heardGot) {
        sound.star(got - 1);
        heardGot = got;
      }

      // The cage slams down when the fight starts and bursts apart with the last lock.
      cage.visible = fight !== null && (rush === null ? !won : rush < 0.9);
      if (fight) {
        const drop = Math.min(1, (t - fight.start) / CAGE_DROP);
        cage.position.y = (1 - drop * drop) * 4;
        const burst = rush === null ? 0 : Math.min(1, rush / 0.6);
        for (const { bar, a } of bars) {
          const out = CAGE_RADIUS + burst * 2.4;
          bar.position.set(Math.cos(a) * out, CAGE_HEIGHT / 2 + burst * 0.5, Math.sin(a) * out);
          bar.rotation.set(burst * a * 2, 0, burst * a);
        }
        lid.position.y = CAGE_HEIGHT + burst * 2.5;
        locks.forEach((lock, k) => {
          lock.visible = k >= got;
        });
      }

      // How many have landed so far: mom and every walking chick, the same order main.ts flies them in.
      const walkers = 1 + game.brood.filter((kid) => kid.phase === "walk" && !kid.stray).length;
      let hits = 0;
      if (rush !== null) {
        for (let order = 0; order <= walkers; order++) if (rush >= leapImpact(order, walkers)) hits += 1;
      }
      if (hits > heardHits) {
        if (heardHits === 0) sound.rumble();
        else sound.plop(hits);
        const burst = stars[nextStar++ % stars.length];
        burst.born = t;
        burst.lateral = (hits * 0.37) % 1 - 0.5;
        burst.y = 1.3 + ((hits * 0.53) % 1) * 1.4;
        heardHits = hits;
      }
      for (const burst of stars) {
        const age = (t - burst.born) / 0.35;
        burst.star.visible = age >= 0 && age < 1;
        if (!burst.star.visible) continue;
        put(burst.star, door + KING_BEHIND - 0.7, burst.lateral, burst.y);
        burst.star.scale.setScalar(0.6 + age * 2.4);
        burst.star.rotation.y = age * 3;
      }

      // Each hit jolts the king; when the pile is done he crumbles and his plinth sinks with him.
      const fallFrom = RUSH_BACK_AT - 0.35;
      const fall = won ? 1 : rush === null ? 0 : Math.min(1, Math.max(0, (rush - fallFrom) / (RUSH_TIME - fallFrom)));
      king.visible = fall < 1;
      const jolt = rush === null ? 0 : Math.sin(t * 45) * Math.min(0.14, hits * 0.02) * (1 - fall);
      king.scale.set(KING_SCALE * (1 + fall * 0.2), KING_SCALE * (1 - fall * 0.95), KING_SCALE * (1 + fall * 0.2));
      king.rotation.z = jolt + fall * 0.3 + (fight && rush === null && !won ? Math.sin(t * 8) * 0.03 : 0);
      plinth.scale.y = Math.max(0.001, 1 - fall);
      plinth.position.y = (PLINTH / 2) * (1 - fall);
      lightMat.opacity = fall;

      // Flat on its back the moment mom reaches it, and it stays down.
      const smash = rush === null ? (won ? 1 : 0) : Math.min(1, Math.max(0, (rush - 0.5) / 0.22));
      hinge.rotation.x = smash * (Math.PI / 2 - 0.02);
      frame.visible = smash === 0;

      const key = fight?.key;
      keyGroup.visible = !!key;
      if (key) {
        put(keyGroup, keyS(key, t), key.lateral, 0);
        keyModel.rotation.y = t * 3;
        keyModel.position.y = 0.42 + Math.sin(t * 5) * 0.04;
        keyRing.scale.setScalar(1 + Math.sin(t * 6) * 0.12);
      }

      const hazards = rush === null ? (fight?.hazards ?? []) : [];
      const front = fight?.front ?? game.childS;
      let w = 0;
      let b = 0;
      let r = 0;
      for (const hazard of hazards) {
        if (hazard.kind === "wave" && w < waves.length) {
          const view = waves[w++];
          const s = waveS(hazard, t);
          const inner = [hazard.gap - hazard.half, hazard.gap + hazard.half];
          const parts = [
            { mesh: view.left, from: -ARENA, to: inner[0] },
            { mesh: view.right, from: inner[1], to: ARENA },
          ];
          parts.forEach(({ mesh, from, to }, k) => {
            const wide = to - from;
            mesh.visible = wide > 0.01;
            if (mesh.visible) {
              put(mesh, s, (from + to) / 2, WAVE_HEIGHT / 2 + 0.06);
              mesh.scale.set(wide, WAVE_HEIGHT, 0.26);
            }
            view.edges[k].visible = true;
            put(view.edges[k], s, inner[k], (WAVE_HEIGHT + 0.12) / 2 + 0.06);
          });
        } else if (hazard.kind === "beam" && b < beams.length) {
          const state = beamState(hazard, t);
          if (state.state !== "warn" && state.state !== "live") continue;
          const view = beams[b++];
          const mesh = state.state === "warn" ? view.warn : view.live;
          const other = state.state === "warn" ? view.live : view.warn;
          other.visible = false;
          mesh.visible = true;
          const from = front - 0.6;
          const to = door;
          put(mesh, (from + to) / 2, hazard.lateral, state.state === "warn" ? 0.09 : 0.3);
          mesh.scale.z = to - from;
          if (state.state === "warn") (mesh.material as THREE.MeshBasicMaterial).opacity = 0.35 + state.t * 0.5 + Math.sin(t * 40) * 0.15;
        } else if (hazard.kind === "boulder" && t >= hazard.born && r < boulders.length) {
          const rock = boulders[r++];
          rock.visible = true;
          put(rock, boulderS(hazard, t), hazard.lateral, BOULDER_RADIUS + 0.04);
          rock.rotation.x = -(t - hazard.born) * 5;
        }
      }
      for (; w < waves.length; w++) {
        const view = waves[w];
        view.left.visible = view.right.visible = false;
        for (const edge of view.edges) edge.visible = false;
      }
      for (; b < beams.length; b++) beams[b].warn.visible = beams[b].live.visible = false;
      for (; r < boulders.length; r++) boulders[r].visible = false;
    },
  };
}
