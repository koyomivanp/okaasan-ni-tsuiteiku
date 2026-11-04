import * as THREE from "three";
import { childPose, type Game } from "../play.ts";
import { segmentAt, segments, type SegmentId, type StageId } from "../route.ts";
import { smoothstep } from "./common.ts";
import { caveView } from "./cave-view.ts";
import { desertView } from "./desert-view.ts";
import { kingView } from "./king-view.ts";
import { forestView } from "./forest-view.ts";
import { oasisView } from "./oasis-view.ts";
import { seaView } from "./sea-view.ts";
import { shoreView } from "./shore-view.ts";
import { createSky } from "./sky.ts";
import type { Env, StageView } from "./view-kit.ts";

type WorldId = StageId | "nest";

function span(id: WorldId): { start: number; end: number } {
  const list = segments.filter((segment) => segment.id === id);
  return { start: list[0].start, end: list[list.length - 1].end };
}


const DEEP_SKY = new THREE.Color(0x3f8fe0);
const WHITE = new THREE.Color(0xffffff);

// mother: mom's model, which some stages restyle (the desert fades her behind a mirage).
export function createWorld(
  scene: THREE.Scene,
  stage: HTMLElement,
  hemi: THREE.HemisphereLight,
  sun: THREE.DirectionalLight,
  mother: THREE.Object3D,
) {
  const fog = scene.fog as THREE.Fog;
  const base: Env = {
    sky: (scene.background as THREE.Color).getHex(),
    fog: fog.color.getHex(),
    near: fog.near,
    far: fog.far,
    hemiSky: hemi.color.getHex(),
    hemiGround: hemi.groundColor.getHex(),
    hemi: hemi.intensity,
    sunColor: sun.color.getHex(),
    sun: sun.intensity,
    lantern: 0,
    clouds: true,
    backdrop: "town",
  };
  const sky = createSky(scene);
  const oasis = oasisView(base);

  const views: Record<WorldId, StageView> = {
    forest: forestView(),
    cave: caveView(),
    // Out of the cave straight into the glare on the beach.
    shore: shoreView(),
    sea: seaView(),
    // Up out of the parted sea into the desert glare.
    desert: desertView(mother),
    king: kingView(),
    nest: oasis,
  };
  const ids = Object.keys(views) as WorldId[];
  const spans = Object.fromEntries(ids.map((id) => [id, span(id)])) as Record<WorldId, { start: number; end: number }>;
  for (const id of ids) {
    views[id].group.visible = false;
    scene.add(views[id].group);
  }

  // Only the chick's own few steps are lit; mom walks just past the edge of it.
  const lantern = new THREE.PointLight(0xffd8a0, 0, 4.2, 1.2);
  scene.add(lantern);

  const veil = document.createElement("div");
  veil.style.cssText = "position:absolute;inset:0;pointer-events:none;opacity:0;";
  stage.appendChild(veil);

  let shown: SegmentId | null = null;
  const apply = (env: Env) => {
    (scene.background as THREE.Color).setHex(env.sky);
    fog.color.setHex(env.fog);
    fog.near = env.near;
    fog.far = env.far;
    hemi.color.setHex(env.hemiSky);
    hemi.groundColor.setHex(env.hemiGround);
    hemi.intensity = env.hemi;
    sun.color.setHex(env.sunColor);
    sun.intensity = env.sun;
    lantern.intensity = env.lantern;
    const hsl = { h: 0, s: 0, l: 0 };
    new THREE.Color(env.sky).getHSL(hsl);
    stage.parentElement?.classList.toggle("dark-world", hsl.l < 0.2);
    const open = Boolean(env.clouds);
    sky.setColors(open ? new THREE.Color(env.sky).lerp(DEEP_SKY, 0.5) : new THREE.Color(env.sky), new THREE.Color(env.fog));
    sky.show(hsl.l >= 0.2, open, env.backdrop);
    sky.tint(WHITE, WHITE);
  };

  return {
    sky,
    oasis,
    // Reapply the current world's light after something else (the ending) has been painting over it.
    restore(): void {
      shown = null;
    },
    follow(camera: THREE.Camera, dt: number): void {
      sky.follow(camera, dt);
    },
    update(game: Game, dt: number): void {
      const s = game.childS;
      const id = segmentAt(s).id;
      // The world switches whole at the seam, where the veil is thickest.
      if (id !== shown) {
        shown = id;
        apply((views as Partial<Record<SegmentId, StageView>>)[id]?.env ?? base);
      }
      let wash = 0;
      let washColor = "";
      for (const key of ids) {
        const view = views[key];
        const { start, end } = spans[key];
        const was = view.group.visible;
        view.group.visible = s >= start - (view.lead ?? 0) && s < end + 0.5;
        if (view.group.visible) view.update?.(game, dt);
        else if (was) view.leave?.();
        if (!view.veil) continue;
        const { before, after, color } = view.veil;
        const amount = s < start ? smoothstep(start - before, start, s) : 1 - smoothstep(start, start + after, s);
        if (amount > wash) {
          wash = amount;
          washColor = color;
        }
      }
      veil.style.opacity = wash.toFixed(3);
      if (washColor) veil.style.background = washColor;
      const kid = childPose(game);
      lantern.position.set(kid.x, 0.95, kid.z);
    },
  };
}
