import type { SegmentId, StageId } from "../route.ts";
import { cave } from "./cave.ts";
import { desert } from "./desert.ts";
import { king } from "./king.ts";
import { sea } from "./sea.ts";
import { shore } from "./shore.ts";
import { smoothstep } from "./common.ts";
import type { StageLogic } from "./types.ts";

// A stage that is still just a walk: nothing to dodge yet, only its own bounds and hint.
function plain(hint: string, extra: Partial<StageLogic> = {}): StageLogic {
  return {
    steer: 3.2,
    grip: 0.6,
    brake: 0.16,
    bound: 1.4,
    leash: 1.1,
    loseGap: 4.35,
    strand: 1.1,
    scatter: 6,
    hint,
    ...extra,
  };
}

export const STAGES: Record<StageId, StageLogic> = {
  // Nothing to dodge in the forest on purpose: only fog, and mom fading in and out of it.
  forest: plain("霧の中、お母さんを見失わないで", {
    bound: 1.3,
    leash: 0.9,
    follow: 1.8,
    strand: null,
    // Off the faint trail the undergrowth drags at the chick's feet.
    slow: (_s, lateral) => smoothstep(0.55, 1.25, Math.abs(lateral)) * 0.6,
  }),
  cave,
  shore,
  sea,
  desert,
  // The boss gets its own checkpoint so a loss does not send you back across the whole desert.
  king,
};

export function stageOf(id: SegmentId): StageLogic | null {
  return (STAGES as Partial<Record<SegmentId, StageLogic>>)[id] ?? null;
}

// One value per added stage, for filling out the per-segment tables in play.ts.
export function byStage<T>(pick: (stage: StageLogic) => T): Record<StageId, T> {
  const out = {} as Record<StageId, T>;
  for (const id of Object.keys(STAGES) as StageId[]) out[id] = pick(STAGES[id]);
  return out;
}

export const STAGE_LIST: StageLogic[] = Object.values(STAGES);
