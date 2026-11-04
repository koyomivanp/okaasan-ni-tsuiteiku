// Small helpers shared by the stage logic files. Kept apart from play.ts so stages never import it back.

export const MOM_PACE = 1.75;

export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

export function hash01(a: number, b: number, salt: number): number {
  let h = Math.imul(a + 0x9e37, 0x85ebca6b) ^ Math.imul(b + 0x7f4a, 0xc2b2ae35) ^ Math.imul(salt, 0x27d4eb2f);
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d);
  h ^= h >>> 12;
  return (h >>> 0) / 4294967296;
}

// A body that loops forever from entry down to exit; each pass rolls its own speed and start delay.
export function loopPass(
  id: number,
  slot: number,
  count: number,
  time: number,
  entry: number,
  exit: number,
  slow: number,
  fast: number,
  rest: number,
): { pass: number; ride: number; along: number; speed: number } | null {
  const slowest = (entry - exit) / slow;
  const cycle = slowest + rest * 2;
  const shifted = time + (slot * cycle) / count + hash01(id, -1, 3) * 1.6;
  const pass = Math.floor(shifted / cycle);
  const local = shifted - pass * cycle;
  const speed = slow + (fast - slow) * hash01(id, pass, 1);
  const delay = hash01(id, pass, 2) * rest * 2;
  const ride = local - delay;
  if (ride < 0) return null;
  const along = entry - ride * speed;
  if (along < exit) return null;
  return { pass, ride, along, speed };
}

// Nothing may pop up right in front of the lead chick or on top of the brood: a pass that would begin
// inside that stretch sits out entirely. Decided once per pass, then kept.
export function spawnGate(minAhead = 6, lead = 1.5) {
  let front = Infinity;
  let tail = Infinity;
  let clock = -Infinity;
  const seen = new Map<string, boolean>();
  return {
    watch(f: number, t: number, time: number): void {
      if (time < clock) seen.clear();
      front = f;
      tail = t;
      clock = time;
    },
    clear(id: number, pass: number, s: number, speed: number): boolean {
      const key = `${id}:${pass}`;
      let ok = seen.get(key);
      if (ok === undefined) {
        ok = s - front > Math.max(minAhead, (speed + MOM_PACE) * lead) || s < tail - 1;
        seen.set(key, ok);
      }
      return ok;
    },
  };
}

// Pick the open pocket nearest the current line, given a cost for standing in each one.
export function bestPocket(pockets: number[], lateral: number, cost: (pocket: number) => number, sway = 2.4): number {
  let best = pockets[0];
  let bestScore = -Infinity;
  for (const pocket of pockets) {
    const score = -Math.abs(pocket - lateral) * sway - cost(pocket);
    if (score > bestScore) {
      bestScore = score;
      best = pocket;
    }
  }
  return best;
}
