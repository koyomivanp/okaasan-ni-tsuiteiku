import * as THREE from "three";
import type { Game } from "../play.ts";
import { seaStart, shoreStart } from "../route.ts";
import { WAVE_ZONES, waveReach, zoneStart } from "./shore.ts";
import { put, strip, type StageView } from "./view-kit.ts";

// ---- 見た目の数値 ----
// 波打ち際の位置（道の中心からの横位置。カメラの向こう側が海）
const WATERLINE = 2.4;
// 波がいちばん上がったとき、道のこの位置まで水がくる
const WAVE_TOP = -1.5;

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// The beach seen side-on: sand toward the camera, the sea beyond the path, waves washing across it.
export function shoreView(): StageView {
  const group = new THREE.Group();
  const rand = mulberry32(0x5e4);
  const s0 = shoreStart;
  const s1 = seaStart;

  const sand = new THREE.MeshLambertMaterial({ color: 0xead7a2 });
  const wetSand = new THREE.MeshLambertMaterial({ color: 0xc8b07a });
  const seaMat = new THREE.MeshLambertMaterial({ color: 0x2f9fd0 });
  strip(group, s0 - 6, s1 + 6, -30, WATERLINE, sand, 0.012, 0.01, 3);
  strip(group, s0 - 6, s1 + 6, WATERLINE - 0.6, WATERLINE, wetSand, 0.016, 0.01, 3);
  strip(group, s0 - 14, s1 + 14, WATERLINE, 70, seaMat, 0.004, 0.01, 4);
  // Where the waves reach the path the sand stays dark and wet: that is where to watch out.
  for (const zone of WAVE_ZONES) strip(group, zoneStart(zone), zoneStart(zone) + zone.width, WAVE_TOP - 0.2, WATERLINE, wetSand, 0.018, 0.01, 0.5);

  // Shells, starfish and a few rocks scattered on the sand.
  const shell = new THREE.MeshLambertMaterial({ color: 0xf6ece0 });
  const star = new THREE.MeshLambertMaterial({ color: 0xe8794a });
  const rock = new THREE.MeshLambertMaterial({ color: 0x8d8680 });
  const lump = new THREE.DodecahedronGeometry(1, 0);
  for (let s = s0 - 3; s < s1 + 4; s += 0.7) {
    const lateral = -1.6 - rand() * 6;
    if (rand() < 0.5) {
      const piece = put(new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 4), shell), s, lateral, 0.03);
      piece.scale.y = 0.5;
      group.add(piece);
    } else if (rand() < 0.4) {
      const arm = new THREE.BoxGeometry(0.16, 0.02, 0.04);
      for (let k = 0; k < 5; k++) {
        const leg = put(new THREE.Mesh(arm, star), s, lateral, 0.03, (k / 5) * Math.PI * 2);
        leg.translateX(0.06);
        group.add(leg);
      }
    } else {
      const stone = put(new THREE.Mesh(lump, rock), s, lateral - 2, 0.1);
      stone.scale.setScalar(0.2 + rand() * 0.4);
      group.add(stone);
    }
  }
  // A beach umbrella and a sandcastle for scale.
  const pole = put(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.6, 6), rock), s0 + 2, -3.2, 0.8);
  const shade = put(new THREE.Mesh(new THREE.ConeGeometry(0.9, 0.35, 10), new THREE.MeshLambertMaterial({ color: 0xe0503a })), s0 + 2, -3.2, 1.6);
  const castle = put(new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.45, 0.4, 8), sand), s0 + 8, -2.4, 0.2);
  group.add(pole, shade, castle);

  // One sheet of water and a line of foam per wave zone, sliding up over the path and back.
  const waterMat = new THREE.MeshLambertMaterial({ color: 0x5cc2e6, transparent: true, opacity: 0.8 });
  const foamMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  const waves = WAVE_ZONES.map((zone) => {
    const holder = put(new THREE.Group(), zoneStart(zone) + zone.width / 2, 0, 0);
    const sheet = new THREE.Mesh(new THREE.BoxGeometry(1, 0.04, zone.width + 0.4), waterMat);
    const foam = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.08, zone.width + 0.5), foamMat);
    holder.add(sheet, foam);
    group.add(holder);
    return { zone, sheet, foam };
  });

  return {
    env: {
      sky: 0x8fd0f0,
      fog: 0xcfeaf6,
      near: 14,
      far: 60,
      hemiSky: 0xd7efff,
      hemiGround: 0xd8c08a,
      hemi: 1.15,
      sunColor: 0xfff6df,
      sun: 1.4,
      lantern: 0,
    },
    group,
    veil: { color: "#ffffff", before: 2.5, after: 1.8 },
    update(game: Game) {
      for (const wave of waves) {
        const reach = waveReach(wave.zone, game.time);
        const edge = WATERLINE - (WATERLINE - WAVE_TOP) * reach;
        const span = Math.max(0.01, WATERLINE + 0.3 - edge);
        wave.sheet.visible = reach > 0.01;
        wave.foam.visible = reach > 0.01;
        wave.sheet.scale.x = span;
        wave.sheet.position.set(edge + span / 2, 0.06, 0);
        wave.foam.position.set(edge, 0.07, 0);
      }
    },
  };
}
