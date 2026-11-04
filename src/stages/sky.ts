import * as THREE from "three";
import { mulberry32 } from "./view-kit.ts";

export type Backdrop = "town" | "dunes";

const SKY_RADIUS = 145;
const FAR_RADIUS = 132;
const CLOUD_RADIUS = 138;

function canvas(width: number, height: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const el = document.createElement("canvas");
  el.width = width;
  el.height = height;
  return [el, el.getContext("2d")!];
}

function texture(el: HTMLCanvasElement): THREE.CanvasTexture {
  const map = new THREE.CanvasTexture(el);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  return map;
}

// A ridge line that closes up around the panorama (whole numbers of waves only).
function ridge(ctx: CanvasRenderingContext2D, w: number, h: number, base: number, amp: number, seed: number, color: string): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, h);
  for (let x = 0; x <= w; x += 4) {
    const u = (x / w) * Math.PI * 2;
    const y =
      Math.sin(u * 3 + seed) * 0.5 + Math.sin(u * 7 + seed * 2.1) * 0.28 + Math.sin(u * 13 + seed * 0.7) * 0.14 + Math.sin(u * 29 + seed) * 0.05;
    ctx.lineTo(x, h - base - amp * (y * 0.5 + 0.5));
  }
  ctx.lineTo(w, h);
  ctx.closePath();
  ctx.fill();
}

function townPanorama(): THREE.CanvasTexture {
  const w = 4096;
  const h = 256;
  const [el, ctx] = canvas(w, h);
  ridge(ctx, w, h, 34, 92, 1.3, "#b9d4e4");
  ridge(ctx, w, h, 16, 58, 4.1, "#a9cdc6");
  const rand = mulberry32(0x41d);
  for (let x = 0; x < w; ) {
    const wide = 16 + rand() * 34;
    const tall = 12 + rand() * rand() * 96;
    ctx.fillStyle = ["#b4c4d2", "#c3cfd9", "#a9bbcb", "#ccd4da"][Math.floor(rand() * 4)];
    ctx.fillRect(x, h - tall, wide, tall);
    ctx.fillStyle = "rgb(255 255 255 / 34%)";
    for (let y = h - tall + 4; y < h - 4; y += 7) {
      for (let k = x + 3; k < x + wide - 3; k += 6) ctx.fillRect(k, y, 3, 3);
    }
    x += wide + (rand() < 0.22 ? 30 + rand() * 90 : 1);
  }
  return texture(el);
}

function dunePanorama(): THREE.CanvasTexture {
  const w = 4096;
  const h = 256;
  const [el, ctx] = canvas(w, h);
  ridge(ctx, w, h, 28, 120, 2.2, "#d9b9a0");
  ridge(ctx, w, h, 14, 64, 5.3, "#e5c690");
  ridge(ctx, w, h, 4, 34, 0.8, "#edd8a4");
  return texture(el);
}

function cloudPanorama(): THREE.CanvasTexture {
  const w = 4096;
  const h = 512;
  const [el, ctx] = canvas(w, h);
  const rand = mulberry32(0xc10d);
  const puff = (x: number, y: number, r: number, alpha: number) => {
    const glow = ctx.createRadialGradient(x, y, r * 0.15, x, y, r);
    glow.addColorStop(0, `rgb(255 255 255 / ${alpha})`);
    glow.addColorStop(0.65, `rgb(255 255 255 / ${alpha * 0.82})`);
    glow.addColorStop(1, "rgb(255 255 255 / 0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  };
  for (let i = 0; i < 24; i++) {
    const cx = rand() * w;
    const cy = 150 + rand() * 290;
    const size = 0.6 + rand() * 1.1;
    for (let k = 0; k < 11; k++) {
      const x = cx + (rand() - 0.5) * 260 * size;
      const y = cy - rand() * 34 * size;
      const r = (24 + rand() * 42) * size;
      for (const wrap of [-w, 0, w]) puff(x + wrap, y, r, 0.95);
    }
  }
  return texture(el);
}

// The sky, clouds and far hills: all painted on shells that travel with the camera, never reachable.
export function createSky(scene: THREE.Scene) {
  const top = new THREE.Color();
  const bottom = new THREE.Color();
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(SKY_RADIUS, 24, 12),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      depthTest: false,
      uniforms: { uTop: { value: top }, uBottom: { value: bottom } },
      vertexShader: `
        varying vec3 vDir;
        void main() {
          vDir = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 uTop;
        uniform vec3 uBottom;
        varying vec3 vDir;
        void main() {
          float k = smoothstep(0.0, 0.62, normalize(vDir).y);
          gl_FragColor = vec4(mix(uBottom, uTop, k), 1.0);
          #include <colorspace_fragment>
        }
      `,
    }),
  );
  dome.renderOrder = -30;
  dome.frustumCulled = false;

  const shell = (radius: number, height: number, map: THREE.Texture, order: number) => {
    const mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(radius, radius, height, 48, 1, true),
      new THREE.MeshBasicMaterial({ map, side: THREE.BackSide, transparent: true, fog: false, depthWrite: false }),
    );
    mesh.renderOrder = order;
    mesh.frustumCulled = false;
    mesh.visible = false;
    return mesh;
  };
  const clouds = shell(CLOUD_RADIUS, 130, cloudPanorama(), -29);
  const town = shell(FAR_RADIUS, 32, townPanorama(), -28);
  const dunes = shell(FAR_RADIUS, 32, dunePanorama(), -28);
  scene.add(dome, clouds, town, dunes);

  return {
    setColors(sky: THREE.Color, horizon: THREE.Color): void {
      top.copy(sky);
      bottom.copy(horizon);
    },
    show(on: boolean, withClouds: boolean, backdrop: Backdrop | undefined): void {
      dome.visible = on;
      clouds.visible = on && withClouds;
      town.visible = on && backdrop === "town";
      dunes.visible = on && backdrop === "dunes";
    },
    // The far shells take on the light at sunset.
    tint(far: THREE.Color, cloud: THREE.Color): void {
      (town.material as THREE.MeshBasicMaterial).color.copy(far);
      (dunes.material as THREE.MeshBasicMaterial).color.copy(far);
      (clouds.material as THREE.MeshBasicMaterial).color.copy(cloud);
    },
    follow(camera: THREE.Camera, dt: number): void {
      const { x, z } = camera.position;
      dome.position.set(x, 0, z);
      town.position.set(x, 15.4, z);
      dunes.position.set(x, 15.4, z);
      clouds.position.set(x, 60, z);
      clouds.rotation.y += dt * 0.004;
    },
  };
}
