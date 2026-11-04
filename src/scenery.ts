import * as THREE from "three";
import {
  crowdEnd,
  crowdStart,
  forestStart,
  lakeMaxX,
  lakeMaxZ,
  lakeMinX,
  lakeMinZ,
  lakeY,
  parkGlade,
  pointAt,
  poseAt,
  roadEnd,
  roadStart,
  samplePath,
  walkSide,
  walkStart,
} from "./route.ts";
import { Kit, mulberry32 } from "./stages/view-kit.ts";

// ---- 見た目の数値 ----
// 道路の見えている長さ（車はこの手前の霧の中で消える）
export const ASPHALT_LENGTH = 130;
// 舞う花びらの数・蝶の数
const PETALS = 70;
const BUTTERFLIES = 8;
// 防音壁の高さと、ひよこが渡る切れ目の半分の幅
const SOUND_WALL = 1.7;
const WALL_GAP = 3.3;

function paint(width: number, height: number, draw: (ctx: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const el = document.createElement("canvas");
  el.width = width;
  el.height = height;
  draw(el.getContext("2d")!);
  const map = new THREE.CanvasTexture(el);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 4;
  return map;
}

const FONT = '"Yu Gothic UI", "Hiragino Sans", Meiryo, sans-serif';

function windowsTexture(): THREE.CanvasTexture {
  return paint(128, 128, (ctx) => {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, 128, 128);
    for (let row = 0; row < 6; row++) {
      for (let col = 0; col < 4; col++) {
        const lit = (row * 5 + col * 3) % 7 === 0;
        ctx.fillStyle = lit ? "#ffe9b0" : "#7e9db8";
        ctx.fillRect(8 + col * 30, 6 + row * 21, 22, 13);
      }
    }
  });
}

function shopFront(name: string, wall: string, accent: string, goods: string[]): THREE.CanvasTexture {
  return paint(512, 256, (ctx) => {
    ctx.fillStyle = wall;
    ctx.fillRect(0, 0, 512, 256);
    ctx.fillStyle = accent;
    ctx.fillRect(14, 12, 484, 62);
    ctx.fillStyle = "#fff8ea";
    ctx.font = `800 44px ${FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(name, 256, 45);
    for (let i = 0; i < 12; i++) {
      ctx.fillStyle = i % 2 === 0 ? accent : "#fff8ea";
      ctx.beginPath();
      ctx.moveTo(14 + i * 40.3, 76);
      ctx.lineTo(14 + (i + 1) * 40.3, 76);
      ctx.lineTo(14 + (i + 1) * 40.3, 96);
      ctx.arc(14 + (i + 0.5) * 40.3, 96, 20.15, 0, Math.PI);
      ctx.closePath();
      ctx.fill();
    }
    const glass = ctx.createLinearGradient(0, 110, 0, 244);
    glass.addColorStop(0, "#fff0c4");
    glass.addColorStop(1, "#ffd98c");
    ctx.fillStyle = glass;
    ctx.fillRect(26, 118, 330, 126);
    ctx.fillStyle = "#6a4a2e";
    ctx.fillRect(376, 116, 110, 140);
    ctx.fillStyle = "#ffe9b0";
    ctx.fillRect(390, 128, 82, 70);
    ctx.fillStyle = "rgb(60 40 20 / 45%)";
    ctx.fillRect(26, 212, 330, 8);
    goods.forEach((good, i) => {
      ctx.fillStyle = good;
      const x = 62 + i * 58;
      ctx.beginPath();
      ctx.arc(x, 192, 20, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgb(255 255 255 / 40%)";
      ctx.beginPath();
      ctx.arc(x - 6, 186, 5, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.strokeStyle = "#4a3320";
    ctx.lineWidth = 6;
    ctx.strokeRect(26, 118, 330, 126);
  });
}

function poster(title: string, sub: string, bg: string, ink: string): THREE.CanvasTexture {
  return paint(128, 180, (ctx) => {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 128, 180);
    ctx.fillStyle = ink;
    ctx.textAlign = "center";
    ctx.font = `800 21px ${FONT}`;
    ctx.fillText(title, 64, 34);
    ctx.beginPath();
    ctx.ellipse(64, 92, 26, 22, 0, 0, Math.PI * 2);
    ctx.fillStyle = "#f2c14e";
    ctx.fill();
    ctx.beginPath();
    ctx.arc(82, 66, 15, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#e36a12";
    ctx.fillRect(94, 62, 13, 6);
    ctx.fillStyle = "#1d2430";
    ctx.fillRect(84, 60, 4, 4);
    ctx.fillStyle = ink;
    ctx.font = `800 15px ${FONT}`;
    ctx.fillText(sub, 64, 150);
  });
}

function roadSign(lines: string[]): THREE.CanvasTexture {
  return paint(512, 170, (ctx) => {
    ctx.fillStyle = "#1a7a4c";
    ctx.fillRect(0, 0, 512, 170);
    ctx.strokeStyle = "#f4f7fb";
    ctx.lineWidth = 6;
    ctx.strokeRect(9, 9, 494, 152);
    ctx.fillStyle = "#f4f7fb";
    ctx.font = `800 54px ${FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    lines.forEach((text, i) => ctx.fillText(text, 256, 52 + i * 66));
  });
}

// Everything around the first half of the walk home. None of it can be touched: the rules live in route.ts.
export function createScenery(scene: THREE.Scene) {
  const group = new THREE.Group();
  scene.add(group);
  const kit = new Kit();
  const city = new Kit(windowsTexture());
  const rand = mulberry32(0x70f1);
  const pick = <T,>(list: T[]): T => list[Math.floor(rand() * list.length)];

  const samples = samplePath(1.2).filter((sample) => sample.s < forestStart + 8);
  const clearOfPath = (x: number, z: number, pad: number) =>
    samples.every((sample) => Math.hypot(sample.x - x, sample.z - z) >= pad);
  const road0 = pointAt(roadStart).z;
  const road1 = pointAt(roadEnd).z;
  const roadX = pointAt(roadStart).x;
  const offRoad = (z: number, pad: number) => z < road0 - pad || z > road1 + pad;
  const crowdZ = pointAt(crowdStart).z;
  const shopRow = (x: number, z: number) =>
    x > pointAt(crowdStart).x - 3 && x < pointAt(crowdEnd).x + 8 && z > road1 + 1 && z < crowdZ + 2;
  const offLake = (x: number, z: number, pad: number) =>
    x < lakeMinX - pad || x > lakeMaxX + pad || z < lakeMinZ - pad || z > lakeMaxZ + pad;

  // ---- 公園：足元の草花 ----
  const parkFlowers = [0xff8fb0, 0xffffff, 0xffd34d, 0xb48bff, 0xff6f6f];
  // Keeps the walked dirt bare, so nothing small on it reads as an obstacle.
  const offDirt = () => {
    const side = rand() < 0.5 ? -1 : 1;
    return side * (1.78 + rand() * rand() * 3.4);
  };
  for (let i = 0; i < 1500; i++) {
    const s = 0.5 + rand() * (walkStart + 2);
    const pose = poseAt(s, offDirt());
    const green = pick([0x6fae4a, 0x7dbb55, 0x5f9f42, 0x8fc768]);
    const tall = 0.08 + rand() * 0.11;
    kit.add("cone", pose.x, 0.05 + tall / 2, pose.z, 0.035, tall, 0.035, green, 0, (rand() - 0.5) * 0.5, (rand() - 0.5) * 0.5);
  }
  for (let i = 0; i < 300; i++) {
    const glade = i < 120;
    const pose = glade
      ? poseAt(parkGlade.s + (rand() - 0.5) * 7, (rand() - 0.5) * 6)
      : poseAt(1 + rand() * walkStart, offDirt());
    const color = pick(parkFlowers);
    const size = 0.03 + rand() * 0.022;
    kit.add("cyl", pose.x, 0.09, pose.z, 0.006, 0.09, 0.006, 0x5f9f42);
    kit.add("ball", pose.x, 0.145, pose.z, size, size * 0.55, size, color);
    kit.add("ball", pose.x, 0.158, pose.z, size * 0.4, size * 0.3, size * 0.4, 0xffd34d);
  }
  for (let i = 0; i < 26; i++) {
    const pose = poseAt(1 + rand() * walkStart, offDirt());
    const r = 0.04 + rand() * 0.04;
    kit.add("cyl", pose.x, 0.08, pose.z, r * 0.3, 0.08, r * 0.3, 0xf4ecd8);
    kit.add("ball", pose.x, 0.12, pose.z, r, r * 0.6, r, i % 3 === 0 ? 0xd9483b : 0xc99a5b);
  }
  // Picnic left out at the edge of the clearing.
  const picnic = poseAt(parkGlade.s + 0.4, -2.1);
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 4; col++) {
      kit.add("box", picnic.x + (col - 1.5) * 0.22, 0.056, picnic.z + (row - 1.5) * 0.22, 0.22, 0.01, 0.22, (row + col) % 2 ? 0xd9483b : 0xfff8ea, 0.3);
    }
  }
  kit.add("box", picnic.x + 0.1, 0.13, picnic.z - 0.1, 0.26, 0.15, 0.18, 0xb98a50, 0.5);
  kit.add("ball", picnic.x - 0.2, 0.09, picnic.z + 0.15, 0.05, 0.05, 0.05, 0xd9483b);
  // The park gate on the way out.
  for (const side of [-1, 1]) {
    const gate = poseAt(walkStart + 0.4, side * 1.75);
    kit.add("box", gate.x, 0.55, gate.z, 0.3, 1.1, 0.3, 0xb9b1a2, gate.yaw);
    kit.add("box", gate.x, 1.13, gate.z, 0.38, 0.08, 0.38, 0x8d8680, gate.yaw);
    kit.add("ball", gate.x, 1.24, gate.z, 0.11, 0.11, 0.11, 0xf3e2a4);
  }

  // ---- 公園の湖 ----
  const lakeTop = lakeY + 0.02;
  for (let i = 0; i < 46; i++) {
    const x = lakeMinX + 0.8 + rand() * (lakeMaxX - lakeMinX - 1.6);
    const z = lakeMinZ + 0.5 + rand() * (lakeMaxZ - lakeMinZ - 1);
    const r = 0.13 + rand() * 0.16;
    kit.add("cyl", x, lakeTop, z, r, 0.012, r, i % 3 ? 0x4f9a43 : 0x5fae4e);
    if (i % 5 === 0) kit.add("ball", x, lakeTop + 0.05, z, 0.06, 0.05, 0.06, i % 2 ? 0xffc0d8 : 0xffffff);
  }
  for (let i = 0; i < 150; i++) {
    const along = i % 2 === 0;
    const x = along ? lakeMinX + rand() * (lakeMaxX - lakeMinX) : (i % 4 === 1 ? lakeMinX : lakeMaxX) + (rand() - 0.5) * 0.6;
    const z = along ? (i % 4 === 0 ? lakeMinZ : lakeMaxZ) + (rand() - 0.5) * 0.6 : lakeMinZ + rand() * (lakeMaxZ - lakeMinZ);
    const tall = 0.5 + rand() * 0.6;
    kit.add("cyl", x, lakeY + tall * 1.2, z, 0.014, tall * 2.4, 0.014, 0x7da04c);
    kit.add("cyl", x, lakeY + tall * 2.45, z, 0.026, 0.13, 0.026, 0x7a5230);
  }
  // Swan pedal boats, as every Japanese park lake has.
  for (const [u, v, turn, tone] of [[0.3, 0.42, 0.5, 0xffffff], [0.56, 0.62, 2.4, 0xfff0cf], [0.76, 0.34, 4.2, 0xffffff]] as const) {
    const x = lakeMinX + (lakeMaxX - lakeMinX) * u;
    const z = lakeMinZ + (lakeMaxZ - lakeMinZ) * v;
    kit.add("ball", x, lakeTop + 0.14, z, 0.34, 0.22, 0.56, tone, turn);
    kit.add("box", x, lakeTop + 0.3, z, 0.3, 0.09, 0.3, 0x4a90c2, turn);
    const nx = x + Math.sin(turn) * 0.4;
    const nz = z + Math.cos(turn) * 0.4;
    kit.add("cyl", nx, lakeTop + 0.46, nz, 0.055, 0.46, 0.055, tone, turn, 0.2);
    kit.add("ball", nx + Math.sin(turn) * 0.05, lakeTop + 0.72, nz + Math.cos(turn) * 0.05, 0.09, 0.09, 0.12, tone, turn);
    kit.add("cone", nx + Math.sin(turn) * 0.17, lakeTop + 0.71, nz + Math.cos(turn) * 0.17, 0.035, 0.12, 0.035, 0xe36a12, turn, Math.PI / 2);
  }

  // ---- 歩道：桜並木と町 ----
  const house = (x: number, z: number, w: number, d: number, h: number, yaw: number) => {
    const wall = pick([0xfff3dc, 0xfbeed2, 0xfff8ea, 0xf0f4ee, 0xfde3cc, 0xe6f0f4]);
    const roof = pick([0x6f86a0, 0xc2684e, 0x4f8296, 0xa6754e, 0x8a5a78]);
    kit.add("box", x, h / 2, z, w, h, d, wall, yaw);
    kit.add("roof", x, h + 0.42, z, w + 0.5, 0.84, d + 0.5, roof, yaw);
    const nx = Math.sin(yaw);
    const nz = Math.cos(yaw);
    const rx = Math.cos(yaw);
    const rz = -Math.sin(yaw);
    for (const face of [-1, 1]) {
      const fx = x + face * nx * (d / 2 + 0.01);
      const fz = z + face * nz * (d / 2 + 0.01);
      for (const off of [-0.27, 0.27]) {
        kit.add("box", fx + rx * off * w, h * 0.62, fz + rz * off * w, w * 0.2, h * 0.26, 0.02, 0x8fc4dc, yaw);
        kit.add("box", fx + rx * off * w, h * 0.46, fz + rz * off * w, w * 0.24, 0.035, 0.04, 0xf4f0e6, yaw);
      }
      kit.add("box", fx, h * 0.22, fz, w * 0.16, h * 0.44, 0.02, 0x8a5a3c, yaw);
    }
  };
  const sakura = (x: number, z: number, size: number) => {
    const tall = 1.25 * size;
    kit.add("cyl", x, tall / 2, z, 0.075 * size, tall, 0.075 * size, 0x6f5140, 0, 0.05);
    for (let k = 0; k < 6; k++) {
      const a = k * 1.13 + x;
      const r = (0.42 + (k % 3) * 0.12) * size;
      kit.add("ball", x + Math.cos(a) * 0.42 * size, tall + (0.08 + (k % 3) * 0.17) * size, z + Math.sin(a) * 0.42 * size, r, r * 0.78, r, pick([0xf9c9d8, 0xf5b5cb, 0xfcdbe4]));
    }
  };
  for (let s = walkStart + 2; s < roadStart - 4; s += 3.7) {
    const side = Math.round(s * 7) % 2 === 0 ? 1 : -1;
    for (const lateral of [side * (walkSide + 0.75), -side * (walkSide + 1.55)]) {
      const pose = poseAt(s + rand(), lateral);
      if (!offLake(pose.x, pose.z, 0.8) || !offRoad(pose.z, 2)) continue;
      if (!clearOfPath(pose.x, pose.z, walkSide)) continue;
      sakura(pose.x, pose.z, 0.95 + rand() * 0.5);
    }
  }
  // The strip of green between the expressway and the shops.
  for (let i = 0; i < 700; i++) {
    const side = rand() < 0.5 ? -1 : 1;
    const pose = poseAt(roadEnd + rand() * (crowdStart - roadEnd + 4), side * (1.45 + rand() * 7));
    if (shopRow(pose.x, pose.z) || !offRoad(pose.z, 1)) continue;
    if (i % 5 === 0) {
      const size = 0.03 + rand() * 0.02;
      kit.add("ball", pose.x, 0.13, pose.z, size, size * 0.6, size, pick(parkFlowers));
      kit.add("cyl", pose.x, 0.07, pose.z, 0.006, 0.14, 0.006, 0x5f9f42);
    } else {
      const tall = 0.06 + rand() * 0.08;
      kit.add("cone", pose.x, 0.02 + tall / 2, pose.z, 0.024, tall, 0.024, pick([0x6fae4a, 0x7dbb55, 0x5f9f42, 0xa3d47a]), 0, (rand() - 0.5) * 0.5, (rand() - 0.5) * 0.5);
    }
  }
  for (let s = roadEnd + 1.5; s < crowdStart + 2; s += 2.1) {
    for (const side of [-1, 1]) {
      const pose = poseAt(s + rand(), side * (2.2 + rand() * 2.4));
      if (shopRow(pose.x, pose.z) || !offRoad(pose.z, 1.5) || !clearOfPath(pose.x, pose.z, 1.9)) continue;
      if (rand() < 0.5) sakura(pose.x, pose.z, 0.8 + rand() * 0.4);
      else kit.add("ball", pose.x, 0.24, pose.z, 0.42, 0.36, 0.42, pick([0x4f9a43, 0x6bb251, 0x5fa84c]));
    }
  }
  // Utility poles and their wires, keeping pace down one side.
  let lastPole: { x: number; z: number } | null = null;
  for (let s = walkStart + 3; s < roadStart - 2; s += 6.3) {
    const pose = poseAt(s, walkSide + 1.45);
    kit.add("cyl", pose.x, 1.45, pose.z, 0.042, 2.9, 0.042, 0x8c8a84);
    kit.add("box", pose.x, 2.68, pose.z, 0.04, 0.04, 0.72, 0x6b6964, pose.yaw + Math.PI / 2);
    kit.add("cyl", pose.x, 2.3, pose.z + 0.07, 0.07, 0.24, 0.07, 0x7b8894);
    if (lastPole) {
      const dx = pose.x - lastPole.x;
      const dz = pose.z - lastPole.z;
      const length = Math.hypot(dx, dz);
      for (const offset of [-0.28, 0, 0.28]) {
        const ox = Math.cos(pose.yaw) * offset;
        const oz = -Math.sin(pose.yaw) * offset;
        kit.add("box", (pose.x + lastPole.x) / 2 + ox, 2.66, (pose.z + lastPole.z) / 2 + oz, 0.012, 0.012, length, 0x2c3340, Math.atan2(dx, dz));
      }
    }
    lastPole = pose;
  }
  // Small roadside life.
  for (const [along, lateral, kind] of [
    [8, 1, "vend"],
    [15, -1, "bench"],
    [23, 1, "post"],
    [31, 1, "bench"],
    [37, -1, "vend"],
    [44, 1, "stop"],
    [49, -1, "post"],
  ] as const) {
    const pose = poseAt(walkStart + along, lateral * (walkSide + 0.32));
    if (!offLake(pose.x, pose.z, 0.4)) continue;
    if (kind === "vend") {
      kit.add("box", pose.x, 0.55, pose.z, 0.46, 1.1, 0.34, pick([0xd9483b, 0x2f6fbe]), pose.yaw + Math.PI / 2);
      kit.add("box", pose.x - lateral * Math.cos(pose.yaw) * 0.18, 0.7, pose.z + lateral * Math.sin(pose.yaw) * 0.18, 0.02, 0.42, 0.36, 0xeef6fb, pose.yaw);
    } else if (kind === "bench") {
      kit.add("box", pose.x, 0.24, pose.z, 0.28, 0.05, 0.8, 0x9b6b3f, pose.yaw);
      for (const end of [-0.3, 0.3]) kit.add("box", pose.x + Math.sin(pose.yaw) * end, 0.11, pose.z + Math.cos(pose.yaw) * end, 0.24, 0.22, 0.05, 0x5c6570, pose.yaw);
    } else if (kind === "post") {
      kit.add("cyl", pose.x, 0.42, pose.z, 0.13, 0.84, 0.13, 0xd8372c);
      kit.add("cyl", pose.x, 0.86, pose.z, 0.15, 0.05, 0.15, 0xb92b22);
    } else {
      kit.add("cyl", pose.x, 0.65, pose.z, 0.02, 1.3, 0.02, 0x8c8a84);
      kit.add("cyl", pose.x, 1.3, pose.z, 0.16, 0.04, 0.16, 0x2f6fbe, 0, Math.PI / 2);
    }
  }

  const grid = (x0: number, x1: number, z0: number, z1: number, step: number, office: boolean) => {
    for (let x = x0; x < x1; x += step) {
      for (let z = z0; z < z1; z += step) {
        const px = x + (rand() - 0.5) * step * 0.3;
        const pz = z + (rand() - 0.5) * step * 0.3;
        const size = office ? 3 + rand() * 2.4 : 1.8 + rand() * 1.1;
        if (!clearOfPath(px, pz, size * 0.8 + walkSide + 0.9)) continue;
        if (!offRoad(pz, size * 0.8 + 2.2) || !offLake(px, pz, size + 1) || shopRow(px, pz)) continue;
        if (office && rand() < 0.14) continue;
        if (office) {
          const tall = 3.5 + rand() * rand() * 15;
          city.add("box", px, tall / 2, pz, size, tall, size * (0.8 + rand() * 0.4), pick([0xdfe5ea, 0xc9d3dc, 0xe8e2d6, 0xb7c4d0, 0xd5cdc2]));
          kit.add("box", px, tall + 0.1, pz, size * 0.7, 0.2, size * 0.7, 0x8d939a);
        } else {
          house(px, pz, size, size * (0.78 + rand() * 0.3), 1 + rand() * 0.55, rand() < 0.5 ? 0 : Math.PI / 2);
          if (rand() < 0.4) kit.add("ball", px + size * 0.8, 0.5, pz + size * 0.5, 0.42, 0.55, 0.42, 0x4f9a43);
        }
      }
    }
  };
  // Houses in close around the walk; offices beside the expressway and behind the shops.
  grid(-24, 55, 38, 91, 3.6, false);
  grid(-40, 44, 118, 164, 6.4, true);
  grid(52, 130, 40, 89, 6.8, true);
  grid(52, 98, 126, 152, 6.2, true);
  grid(62, 130, 122, 150, 7, true);

  // ---- 高速道路 ----
  const roadLength = road1 - road0;
  const laneZ = (t: number) => road0 + t * roadLength;
  const left = roadX - ASPHALT_LENGTH / 2;
  const right = roadX + ASPHALT_LENGTH / 2;
  const span = (z: number, height: number, thick: number, y: number, color: number, gap: number) => {
    const pieces: [number, number][] = [[left, roadX - gap], [roadX + gap, right]];
    for (const [a, b] of pieces) kit.add("box", (a + b) / 2, y, z, b - a, height, thick, color);
  };
  for (const [edge, out] of [[laneZ(0.01), -1], [laneZ(0.995), 1]] as const) {
    // Guard rail, then the sound wall stepping up behind it.
    span(edge + out * 0.25, 0.09, 0.035, 0.3, 0xdfe5ea, 2.2);
    for (let x = left; x < right; x += 1.5) {
      if (Math.abs(x - roadX) < 2.3) continue;
      kit.add("box", x, 0.15, edge + out * 0.25, 0.04, 0.3, 0.04, 0x8d939a);
    }
    const wallZ = edge + out * 0.95;
    span(wallZ, SOUND_WALL, 0.12, SOUND_WALL / 2, 0xa8c4cf, WALL_GAP);
    span(wallZ, 0.14, 0.2, SOUND_WALL + 0.07, 0x5c7a88, WALL_GAP);
    for (let x = left; x < right; x += 2.4) {
      if (Math.abs(x - roadX) < WALL_GAP + 0.1) continue;
      kit.add("box", x, SOUND_WALL / 2, wallZ - out * 0.08, 0.1, SOUND_WALL, 0.08, 0x6d8a97);
    }
    kit.add("box", (left + right) / 2, 0.06, wallZ + out * 0.9, right - left, 0.03, 1.5, 0x8a9a7e);
  }
  // Median lights, every stretch.
  const medianZ = laneZ(0.5);
  for (let x = left + 4; x < right; x += 13) {
    if (Math.abs(x - roadX) < 3) continue;
    kit.add("cyl", x, 1.55, medianZ, 0.05, 3.1, 0.05, 0x8d939a);
    kit.add("box", x, 3.08, medianZ - 0.72, 0.08, 0.06, 1.5, 0x8d939a);
    kit.add("box", x, 3.08, medianZ + 0.72, 0.08, 0.06, 1.5, 0x8d939a);
    kit.add("box", x, 3.03, medianZ - 1.42, 0.28, 0.05, 0.42, 0xfff3c0);
    kit.add("box", x, 3.03, medianZ + 1.42, 0.28, 0.05, 0.42, 0xfff3c0);
  }
  // Overhead signs in both directions.
  const gantries = [
    { x: roadX - 19, faces: -1, text: ["巣", "あと 209 km"] },
    { x: roadX + 22, faces: 1, text: ["オアシス", "このまま まっすぐ"] },
    { x: roadX - 41, faces: 1, text: ["ヒヨコ 飛び出し", "注意"] },
    { x: roadX + 44, faces: -1, text: ["アヒルの親子", "横断中"] },
  ];
  for (const gantry of gantries) {
    for (const z of [laneZ(0.02), laneZ(0.98)]) kit.add("cyl", gantry.x, 1.9, z, 0.09, 3.8, 0.09, 0x7b838b);
    kit.add("box", gantry.x, 3.7, medianZ, 0.12, 0.12, roadLength, 0x7b838b);
    kit.add("box", gantry.x, 3.35, medianZ, 0.1, 0.1, roadLength, 0x7b838b);
    for (const dir of [laneZ(0.25), laneZ(0.75)]) {
      const sign = new THREE.Mesh(
        new THREE.PlaneGeometry(4.4, 1.46),
        new THREE.MeshBasicMaterial({ map: roadSign(gantry.text) }),
      );
      sign.position.set(gantry.x + gantry.faces * 0.08, 3.5, dir);
      sign.rotation.y = (gantry.faces * Math.PI) / 2;
      group.add(sign);
      kit.add("box", gantry.x, 3.5, dir, 0.08, 1.46, 4.4, 0x7f8a90);
    }
  }

  // ---- 商店街 ----
  const fronts = [
    shopFront("パン工房", "#f2d2a2", "#b5642b", ["#d9984a", "#c97f35", "#e3b06a", "#b86f2c", "#d9984a"]),
    shopFront("花屋 ひなた", "#e7f0d8", "#3f8f5a", ["#ff7fa8", "#ffd34d", "#c48bff", "#ff6f6f", "#ffffff"]),
    shopFront("古本 ふくろう", "#d9c9a8", "#5c4a78", ["#7a5ca8", "#2f6fbe", "#b5482b", "#3f8f5a", "#c9a23c"]),
    shopFront("喫茶 ことり", "#e7b7a6", "#7a3f2c", ["#5c3b22", "#fff8ea", "#e3b06a", "#5c3b22", "#fff8ea"]),
    shopFront("八百屋", "#e8f0c4", "#c4493a", ["#d9483b", "#f09030", "#7dbb55", "#ffd34d", "#a04a9e"]),
    shopFront("魚 まるよし", "#cfe5ee", "#2f6fbe", ["#9fb8c8", "#e88a7a", "#9fb8c8", "#c7d6de", "#e88a7a"]),
    shopFront("駄菓子", "#f7e0c4", "#d9483b", ["#ff7fa8", "#55c1e8", "#ffd34d", "#7dbb55", "#ff9a3c"]),
    shopFront("文房具", "#dfe5f2", "#3d5fae", ["#d9483b", "#2f6fbe", "#ffd34d", "#3f8f5a", "#9b6bd1"]),
  ];
  const facadeMats = fronts.map((map) => new THREE.MeshLambertMaterial({ map }));
  const crowdLength = crowdEnd - crowdStart;
  let along = 0.8;
  let shopIndex = 0;
  while (along < crowdLength + 0.5) {
    const wide = 3.5 + rand() * 1.5;
    const tall = 2.1 + rand() * 1.5;
    const pose = poseAt(crowdStart + along + wide / 2, 2.72);
    const wall = pick([0xf2d2a2, 0xe7cfc0, 0xd8dfd0, 0xf0dcb8, 0xdccfe0, 0xe9d6c0]);
    // Built facing the street: x runs along it, the front looks back at the walkers.
    city.add("box", pose.x, tall / 2 + 1.05, pose.z, wide - 0.06, tall, 1.65, wall);
    kit.add("box", pose.x, 0.5, pose.z, wide - 0.06, 1, 1.65, wall);
    kit.add("box", pose.x, tall + 1.1, pose.z, wide + 0.1, 0.1, 1.8, 0x6a5a4a);
    const facade = new THREE.Mesh(new THREE.PlaneGeometry(wide - 0.14, 1.28), facadeMats[shopIndex % facadeMats.length]);
    facade.position.set(pose.x, 0.66, pose.z + 0.84);
    group.add(facade);
    // Standing banner out front.
    const banner = pick([0xd9483b, 0x2f6fbe, 0x3f8f5a, 0xf0a020, 0xe0568a]);
    const bx = pose.x - wide / 2 + 0.3;
    kit.add("cyl", bx, 0.62, pose.z + 1.05, 0.012, 1.24, 0.012, 0x8c8a84);
    kit.add("box", bx + 0.11, 0.78, pose.z + 1.05, 0.2, 0.84, 0.012, banner);
    if (shopIndex % 2 === 0) {
      kit.add("cyl", pose.x + wide / 2 - 0.5, 0.12, pose.z + 1.1, 0.13, 0.22, 0.13, 0xb5642b);
      kit.add("ball", pose.x + wide / 2 - 0.5, 0.32, pose.z + 1.1, 0.2, 0.2, 0.2, 0x5fae4e);
      kit.add("ball", pose.x + wide / 2 - 0.42, 0.42, pose.z + 1.14, 0.06, 0.06, 0.06, 0xff7fa8);
    }
    along += wide;
    shopIndex++;
  }
  // Paper lanterns strung over the street, between the shops and the wall.
  const lanternColors = [0xd9483b, 0xfff8ea, 0xd9483b, 0xf0a020];
  const streetLow = poseAt(crowdStart, 1.9).z;
  const streetHigh = poseAt(crowdStart, -1.42).z;
  for (let run = 2.5; run < crowdLength; run += 6.2) {
    const x = pointAt(crowdStart + run).x;
    kit.add("cyl", x, 1.6, streetLow + 0.03, 0.03, 3.2, 0.03, 0x6a5a4a);
    kit.add("box", x, 2.75, (streetLow + streetHigh) / 2, 0.012, 0.012, streetHigh - streetLow, 0x2c3340);
    const hanging = 7;
    for (let k = 0; k < hanging; k++) {
      const t = (k + 0.5) / hanging;
      const z = streetLow + (streetHigh - streetLow) * t;
      const sag = Math.sin(t * Math.PI) * 0.22;
      kit.add("ball", x, 2.62 - sag, z, 0.1, 0.13, 0.1, lanternColors[k % lanternColors.length]);
    }
  }
  // Posters and ivy on the long wall.
  const wallFront = pointAt(crowdStart).z + 1.42 - 0.15;
  const posters = [
    poster("さがしています", "迷子のアヒル", "#fff8ea", "#c4493a"),
    poster("夏まつり", "八月 商店街", "#2f4f8f", "#fff8ea"),
    poster("交通安全", "飛び出し注意", "#ffe066", "#1d2430"),
    poster("巣作り教室", "初心者歓迎", "#d8efe0", "#2f6a45"),
  ];
  posters.forEach((map, i) => {
    for (let k = 0; k < 2; k++) {
      const x = pointAt(crowdStart).x + 3.5 + (i + k * 4) * 4.6 + (k ? 1.5 : 0);
      if (x > pointAt(crowdEnd).x - 3) continue;
      const sheet = new THREE.Mesh(new THREE.PlaneGeometry(0.52, 0.73), new THREE.MeshBasicMaterial({ map, color: 0xd8d8d8 }));
      sheet.position.set(x, 1.15, wallFront);
      sheet.rotation.y = Math.PI;
      group.add(sheet);
    }
  });
  for (let x = pointAt(crowdStart).x - 2; x < pointAt(crowdEnd).x - 2; x += 0.5) {
    if (Math.sin(x * 0.5) < 0.1) continue;
    const high = 0.5 + rand() * 1.7;
    kit.add("ball", x + rand() * 0.3, high, wallFront - 0.02, 0.2 + rand() * 0.16, 0.2 + rand() * 0.2, 0.05, pick([0x3f8f45, 0x4f9a43, 0x5fae4e]));
    kit.add("ball", x + rand() * 0.3, 0.2, wallFront - 0.04, 0.22, 0.24, 0.07, 0x3f8f45);
  }
  // Paved right up to the shop fronts.
  const paving = new THREE.MeshLambertMaterial({ color: 0xb8b0a2 });
  for (let run = 0; run < crowdLength; run += 2) {
    const pose = poseAt(crowdStart + run + 1, 1.72);
    const slab = new THREE.Mesh(new THREE.BoxGeometry(2.02, 0.05, 1.05), paving);
    slab.position.set(pose.x, 0.05, pose.z);
    group.add(slab);
  }

  group.add(kit.build(), city.build());

  // ---- 動くもの ----
  const petalMat = new THREE.MeshBasicMaterial({ color: 0xfbd0dd, side: THREE.DoubleSide });
  const petals = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.05, 0.035), petalMat, PETALS);
  petals.frustumCulled = false;
  scene.add(petals);
  const petalState = Array.from({ length: PETALS }, () => ({
    x: 0,
    y: -1,
    z: 0,
    phase: rand() * 9,
    fall: 0.28 + rand() * 0.22,
  }));
  const wingGeo = new THREE.PlaneGeometry(0.1, 0.09);
  wingGeo.translate(0.05, 0, 0);
  const butterflies = Array.from({ length: BUTTERFLIES }, (_, i) => {
    const mat = new THREE.MeshBasicMaterial({ color: [0xffd34d, 0xffffff, 0xff9eb5, 0x9fd4ff][i % 4], side: THREE.DoubleSide });
    const left = new THREE.Mesh(wingGeo, mat);
    const right = new THREE.Mesh(wingGeo, mat);
    const fly = new THREE.Group();
    left.rotation.x = right.rotation.x = -Math.PI / 2;
    fly.add(left, right);
    group.add(fly);
    const pose = poseAt(3 + (i / BUTTERFLIES) * (walkStart - 5), (i % 2 ? 1 : -1) * (0.9 + (i % 3) * 0.4));
    return { fly, left, right, x: pose.x, z: pose.z, phase: i * 1.7 };
  });

  const matrix = new THREE.Matrix4();
  const spin = new THREE.Euler();
  const turn = new THREE.Quaternion();
  const at = new THREE.Vector3();
  const one = new THREE.Vector3(1, 1, 1);
  let clock = 0;

  return {
    // Hides everything once the walk has left town.
    update(childS: number, camera: THREE.Camera, dt: number): void {
      clock += dt;
      const here = childS < forestStart + 1;
      group.visible = here;
      const inWalk = childS > walkStart - 4 && childS < roadStart;
      petals.visible = inWalk;
      if (inWalk) {
        const { x: cx, z: cz } = camera.position;
        petalState.forEach((petal, i) => {
          petal.y -= petal.fall * dt;
          const far = Math.hypot(petal.x - cx, petal.z - cz) > 8;
          if (petal.y < 0.03 || far) {
            const a = Math.random() * Math.PI * 2;
            const r = 0.8 + Math.random() * 6;
            petal.x = cx + Math.cos(a) * r;
            petal.z = cz + Math.sin(a) * r;
            petal.y = far ? Math.random() * 2.6 : 2.2 + Math.random() * 0.8;
          }
          const sway = Math.sin(clock * 1.3 + petal.phase);
          at.set(petal.x + sway * 0.2, petal.y, petal.z + Math.cos(clock + petal.phase) * 0.2);
          spin.set(clock * 2 + petal.phase, petal.phase, sway);
          turn.setFromEuler(spin);
          matrix.compose(at, turn, one);
          petals.setMatrixAt(i, matrix);
        });
        petals.instanceMatrix.needsUpdate = true;
      }
      if (childS < walkStart + 2) {
        for (const b of butterflies) {
          const t = clock * 0.6 + b.phase;
          b.fly.position.set(b.x + Math.sin(t) * 0.7, 0.42 + Math.sin(t * 2.3) * 0.16, b.z + Math.cos(t * 0.8) * 0.7);
          b.fly.rotation.y = -t;
          const flap = 0.5 + Math.abs(Math.sin(clock * 16 + b.phase)) * 1;
          b.left.rotation.y = flap;
          b.right.rotation.y = Math.PI - flap;
        }
      }
    },
  };
}
