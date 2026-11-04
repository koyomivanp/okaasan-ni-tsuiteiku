import * as THREE from "three";
import { sound } from "../sound.ts";
import type { Game } from "../play.ts";
import { caveStart, caveStraight, shoreStart } from "../route.ts";
import { CAVE_HALF, caveBats, cavePuddles, caveRocks, GHOSTS, ghostLateral, ROCK_RADIUS } from "./cave.ts";
import { smoothstep } from "./common.ts";
import { put, strip, type StageView } from "./view-kit.ts";

// ---- 見た目の数値 ----
// カメラからこの距離で暗くなりはじめ、この距離で何も見えなくなる（カメラが高いので遠め）
const FOG_NEAR = 5;
const FOG_FAR = 13;
// 子どもが持つ明かりの強さ（0 で真っ暗）
const LANTERN = 3.2;
// 岩壁の位置（道の中心から）と、天井の高さ
const WALL = CAVE_HALF + 0.35;
const CEILING = 2.3;
// 壁ぎわで光る苔・水晶の間隔（距離）
const GLOW_EVERY = 1.3;

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function caveView(): StageView {
  const group = new THREE.Group();
  const rand = mulberry32(0xc4e7);
  const s0 = caveStart;
  const s1 = shoreStart;

  const floor = new THREE.MeshLambertMaterial({ color: 0x4a443e });
  const stone = [0x46403a, 0x3a3530, 0x524a42].map((color) => new THREE.MeshLambertMaterial({ color }));
  const lump = new THREE.DodecahedronGeometry(1, 0);
  strip(group, s0 - 0.5, s1 + 0.8, -WALL - 0.6, WALL + 0.6, floor, 0.02, 0.03, 0.8);

  // Rough walls of piled boulders that follow every bend.
  for (let s = s0 + 0.3; s < s1 + 0.6; s += 0.5) {
    for (const side of [-1, 1]) {
      for (const tier of [0, 1, 2]) {
        const r = 0.45 + rand() * 0.35;
        const rock = put(new THREE.Mesh(lump, stone[Math.floor(rand() * stone.length)]), s + rand() * 0.3, side * (WALL + r * 0.55), r * 0.5 + tier * 0.8);
        rock.scale.set(r, r * (0.8 + rand() * 0.4), r);
        rock.rotation.set(rand() * 3, rand() * 3, rand() * 3);
        group.add(rock);
      }
    }
  }
  // Faint glowing moss and crystals at the foot of the walls: the only hint of where the bends go.
  const glowMats = [0x3f9ab0, 0x6a58b8, 0x4fae7a].map((color) => new THREE.MeshBasicMaterial({ color, fog: false }));
  const crystal = new THREE.OctahedronGeometry(1, 0);
  for (let s = s0 + 0.8; s < s1; s += GLOW_EVERY * (0.6 + rand() * 0.8)) {
    const side = rand() < 0.5 ? -1 : 1;
    const gem = put(new THREE.Mesh(crystal, glowMats[Math.floor(rand() * glowMats.length)]), s, side * (WALL - 0.12), 0.08 + rand() * 0.2);
    gem.scale.set(0.035, 0.07 + rand() * 0.05, 0.035);
    gem.rotation.z = (rand() - 0.5) * 0.8;
    group.add(gem);
  }

  const puddleMat = new THREE.MeshLambertMaterial({ color: 0x1a2632, transparent: true, opacity: 0.92 });
  for (const puddle of cavePuddles) {
    const pool = put(new THREE.Mesh(new THREE.CircleGeometry(puddle.radius, 18), puddleMat), puddle.s, puddle.lateral, 0.056);
    pool.rotation.set(-Math.PI / 2, 0, pool.rotation.y);
    pool.scale.y = 1.3;
    group.add(pool);
  }

  // The mouth: a rock face at the end of the forest, black inside.
  const mouth = new THREE.Group();
  group.add(mouth);
  for (const side of [-1, 1]) strip(mouth, s0 - 0.6, s0 + 0.4, side * (WALL - 0.1), side * 9, stone[0], 0, 5.5, 1);
  strip(mouth, s0 - 0.6, s0 + 0.4, -WALL, WALL, stone[0], CEILING - 0.1, 3.4, 1);
  for (let i = 0; i < 26; i++) {
    const r = 0.5 + rand() * 0.9;
    const side = rand() < 0.5 ? -1 : 1;
    const rock = put(new THREE.Mesh(lump, stone[Math.floor(rand() * stone.length)]), s0 - 0.75, side * (WALL + 0.3 + rand() * 6), rand() * 5);
    rock.scale.setScalar(r);
    rock.rotation.set(rand() * 3, rand() * 3, rand() * 3);
    mouth.add(rock);
  }
  const plug = put(
    new THREE.Mesh(new THREE.PlaneGeometry(WALL * 2, CEILING), new THREE.MeshBasicMaterial({ color: 0x030304 })),
    s0 + 0.45,
    0,
    CEILING / 2 + 0.02,
    Math.PI,
  );
  group.add(plug);

  // Daylight at the far end of the last straight: the sea is out there.
  const exit = put(
    new THREE.Mesh(new THREE.PlaneGeometry(WALL * 2, CEILING), new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false })),
    s1 + 0.6,
    0,
    CEILING / 2 + 0.02,
    Math.PI,
  );
  const haloMat = new THREE.MeshBasicMaterial({ color: 0xeaf6ff, fog: false, transparent: true, opacity: 0.28, depthWrite: false });
  const halo = put(new THREE.Mesh(new THREE.PlaneGeometry(WALL * 2, CEILING), haloMat), s1 + 0.5, 0, CEILING / 2 + 0.02, Math.PI);
  group.add(exit, halo);

  // Falling rocks: a rumble and a bright ring first, then a shadow that darkens under a trickle of
  // pebbles, then the stone drops and stays.
  const ringMat = new THREE.MeshBasicMaterial({ color: 0xff7a3c, fog: false, transparent: true, opacity: 0, depthWrite: false });
  const shadowMat = new THREE.MeshBasicMaterial({ color: 0xc8341e, fog: false, transparent: true, opacity: 0, depthWrite: false });
  const pebbleMat = new THREE.MeshBasicMaterial({ color: 0xd8c8b0, fog: false });
  const rocks = caveRocks(0).map((spot) => {
    const ring = put(new THREE.Mesh(new THREE.RingGeometry(ROCK_RADIUS * 1.05, ROCK_RADIUS * 1.5, 24), ringMat.clone()), spot.s, spot.lateral, 0.07);
    ring.rotation.set(-Math.PI / 2, 0, ring.rotation.y);
    const shadow = put(new THREE.Mesh(new THREE.CircleGeometry(ROCK_RADIUS * 1.05, 24), shadowMat.clone()), spot.s, spot.lateral, 0.065);
    shadow.rotation.set(-Math.PI / 2, 0, shadow.rotation.y);
    const stoneMesh = put(new THREE.Mesh(lump, stone[2]), spot.s, spot.lateral, CEILING);
    stoneMesh.scale.setScalar(ROCK_RADIUS);
    stoneMesh.rotation.set(rand() * 3, rand() * 3, rand() * 3);
    const pebbles = [0, 1, 2, 3, 4].map((n) => {
      const pebble = put(new THREE.Mesh(lump, pebbleMat), spot.s + (rand() - 0.5) * 0.3, spot.lateral + (rand() - 0.5) * 0.3, CEILING);
      pebble.scale.setScalar(0.035 + rand() * 0.025);
      group.add(pebble);
      return { pebble, phase: n / 5 };
    });
    group.add(ring, shadow, stoneMesh);
    return { ring, shadow, stone: stoneMesh, pebbles, wasIdle: true };
  });

  // Bats: black shapes with red eyes that show long before the bodies do.
  const batBody = new THREE.MeshLambertMaterial({ color: 0x15131a });
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff3a2a, fog: false });
  const bats = caveBats(0).map(() => {
    const bat = new THREE.Group();
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), batBody);
    const wings = [-1, 1].map((side) => {
      const pivot = new THREE.Group();
      const wing = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.015, 0.12), batBody);
      wing.position.x = side * 0.12;
      pivot.add(wing);
      bat.add(pivot);
      return { pivot, side };
    });
    for (const x of [-0.03, 0.03]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.026, 6, 4), eyeMat);
      eye.position.set(x, 0.02, 0.07);
      bat.add(eye);
    }
    bat.add(body);
    bat.visible = false;
    group.add(bat);
    return { bat, wings };
  });

  // Ghosts drifting from wall to wall, glowing faintly through the dark.
  const ghostMat = new THREE.MeshBasicMaterial({ color: 0xdfeaff, fog: false, transparent: true, opacity: 0.55, depthWrite: false });
  const ghostEye = new THREE.MeshBasicMaterial({ color: 0x101420, fog: false });
  const ghosts = GHOSTS.map(() => {
    const ghost = new THREE.Group();
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 10), ghostMat);
    head.position.y = 0.2;
    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.36, 12, 1, true), ghostMat);
    tail.rotation.x = Math.PI;
    tail.position.y = -0.02;
    ghost.add(head, tail);
    for (const x of [-0.07, 0.07]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 4), ghostEye);
      eye.scale.y = 1.6;
      eye.position.set(x, 0.24, 0.17);
      ghost.add(eye);
    }
    group.add(ghost);
    return ghost;
  });

  return {
    env: {
      sky: 0x030304,
      fog: 0x030304,
      near: FOG_NEAR,
      far: FOG_FAR,
      hemiSky: 0x7d8696,
      hemiGround: 0x141414,
      hemi: 0.75,
      sunColor: 0xfff6df,
      sun: 0.03,
      lantern: LANTERN,
    },
    group,
    lead: 10,
    veil: { color: "#030304", before: 1, after: 0.9 },
    update(game: Game) {
      const s = game.childS;
      plug.visible = s < s0 - 0.2;
      mouth.visible = s < s0 - 0.2;
      halo.scale.setScalar(1 + smoothstep(caveStraight, s1, s) * 0.7 + Math.sin(game.time * 3) * 0.03);
      caveRocks(game.time).forEach((rock, index) => {
        const view = rocks[index];
        const ringMat = view.ring.material as THREE.MeshBasicMaterial;
        const warned = rock.state === "warn";
        if (view.wasIdle && warned) sound.rumble();
        view.wasIdle = rock.state === "idle";
        ringMat.opacity = warned ? 0.75 + Math.sin(rock.t * 26) * 0.25 : rock.state === "fall" ? 1 : 0;
        const shadowMat = view.shadow.material as THREE.MeshBasicMaterial;
        shadowMat.opacity = warned ? 0.2 + rock.t * 0.45 : rock.state === "fall" ? 0.75 : 0;
        view.shadow.scale.setScalar(warned ? 0.45 + rock.t * 0.55 : 1);
        for (const { pebble, phase } of view.pebbles) {
          pebble.visible = warned;
          if (warned) pebble.position.y = CEILING * (1 - ((game.time * 1.5 + phase) % 1) ** 2);
        }
        view.stone.visible = rock.state === "fall" || rock.state === "down";
        view.stone.position.y = rock.state === "fall" ? ROCK_RADIUS * 0.6 + (CEILING - ROCK_RADIUS) * (1 - rock.t * rock.t) : ROCK_RADIUS * 0.6;
      });
      caveBats(game.time).forEach((bat, index) => {
        const view = bats[index];
        view.bat.visible = bat.visible;
        if (!bat.visible) return;
        view.bat.position.set(bat.x, 0.32 + Math.sin(bat.flap * 0.3) * 0.06, bat.z);
        view.bat.rotation.set(0, bat.yaw, 0);
        for (const wing of view.wings) wing.pivot.rotation.z = wing.side * Math.sin(bat.flap) * 0.7;
      });
      GHOSTS.forEach((ghost, index) => {
        const lateral = ghostLateral(ghost, game.time);
        const at = put(ghosts[index], s0 + ghost.at, lateral, 0.32 + Math.sin(game.time * 2.2 + index) * 0.06, Math.PI);
        at.rotation.z = Math.cos((game.time / ghost.period) * Math.PI * 2 + ghost.phase) * 0.2;
      });
    },
  };
}
