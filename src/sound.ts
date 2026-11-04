let context: AudioContext | null = null;

export function unlockSound(): void {
  if (!context) context = new AudioContext();
  if (context.state === "suspended") void context.resume();
}

function tone(
  freq: number,
  endFreq: number,
  at: number,
  length: number,
  type: OscillatorType = "square",
  volume = 0.12,
  out?: AudioNode,
): void {
  if (!context) return;
  const start = context.currentTime + at;
  const osc = context.createOscillator();
  const gain = context.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  osc.frequency.exponentialRampToValueAtTime(endFreq, start + length);
  gain.gain.setValueAtTime(volume, start);
  gain.gain.exponentialRampToValueAtTime(0.001, start + length);
  osc.connect(gain).connect(out ?? context.destination);
  osc.start(start);
  osc.stop(start + length);
}

// A soft music-box tune in 3/4, looping while the family swims.
const BEAT = 0.46;
const CHORDS = [
  [174.61, 261.63, 349.23],
  [130.81, 261.63, 329.63],
  [146.83, 220, 349.23],
  [196, 246.94, 392],
  [174.61, 261.63, 440],
  [130.81, 329.63, 392],
  [146.83, 293.66, 349.23],
  [196, 293.66, 392],
];
const MELODY: [number, number, number][] = [
  [0, 0, 880],
  [0, 1, 784],
  [0, 2, 698.46],
  [1, 0, 659.25],
  [1, 2, 784],
  [2, 0, 880],
  [2, 1, 987.77],
  [2, 2, 880],
  [3, 0, 783.99],
  [4, 0, 880],
  [4, 1, 1046.5],
  [4, 2, 987.77],
  [5, 0, 880],
  [5, 2, 783.99],
  [6, 0, 698.46],
  [6, 1, 783.99],
  [6, 2, 880],
  [7, 0, 783.99],
];
let themeBus: GainNode | null = null;
let themeTimer = 0;

function playPhrase(bus: GainNode, at: number): void {
  CHORDS.forEach((chord, bar) => {
    chord.forEach((freq, k) => {
      tone(freq, freq, at + (bar * 3 + k) * BEAT, BEAT * 2.4, "triangle", 0.05, bus);
    });
  });
  for (const [bar, beat, freq] of MELODY) {
    const when = at + (bar * 3 + beat) * BEAT;
    tone(freq, freq, when, BEAT * 2.2, "sine", 0.1, bus);
    tone(freq * 2, freq * 2, when, BEAT * 0.8, "sine", 0.025, bus);
  }
}

export const sound = {
  tap(): void {
    tone(660, 880, 0, 0.07, "triangle", 0.16);
  },
  peep(): void {
    tone(1400, 900, 0, 0.12, "triangle", 0.1);
  },
  rumble(): void {
    tone(120, 60, 0, 0.5, "sawtooth", 0.09);
    tone(90, 50, 0.08, 0.5, "triangle", 0.12);
  },
  fail(): void {
    tone(520, 140, 0, 0.42, "sawtooth", 0.1);
  },
  // One chick into the water; the pitch climbs with each one.
  plop(index: number): void {
    const up = 1 + index * 0.06;
    tone(240 * up, 620 * up, 0, 0.09, "sine", 0.2);
    tone(1500 * up, 2300 * up, 0.04, 0.07, "triangle", 0.05);
  },
  note(index: number): void {
    const scale = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.51, 1567.98];
    const freq = scale[(index - 1) % scale.length];
    tone(freq, freq, 0, 0.32, "sine", 0.07);
  },
  star(index: number): void {
    const freq = [1046.5, 1318.51, 1567.98][index % 3];
    tone(freq, freq, 0, 0.5, "triangle", 0.13);
    tone(freq * 2, freq * 2, 0.03, 0.34, "sine", 0.05);
  },
  fanfare(): void {
    [
      [523.25, 0],
      [659.25, 0.12],
      [783.99, 0.24],
      [1046.5, 0.38],
      [783.99, 0.56],
      [1046.5, 0.68],
    ].forEach(([freq, at]) => {
      tone(freq, freq, at, at === 0.68 ? 1.1 : 0.2, "triangle", 0.14);
      tone(freq / 2, freq / 2, at, at === 0.68 ? 1.1 : 0.2, "square", 0.035);
    });
  },
  home(): void {
    if (!context) return;
    sound.homeStop();
    const bus = context.createGain();
    bus.gain.value = 0.85;
    bus.connect(context.destination);
    themeBus = bus;
    const phrase = CHORDS.length * 3 * BEAT;
    let at = 0.6;
    const queue = () => {
      if (themeBus !== bus) return;
      playPhrase(bus, at);
      at += phrase;
      themeTimer = window.setTimeout(queue, (phrase - 0.5) * 1000);
    };
    queue();
  },
  homeStop(): void {
    window.clearTimeout(themeTimer);
    if (themeBus && context) {
      const bus = themeBus;
      bus.gain.setTargetAtTime(0, context.currentTime, 0.1);
      window.setTimeout(() => bus.disconnect(), 800);
    }
    themeBus = null;
  },
  piyo(): void {
    const chirps = [2120, 2560, 1880, 2410, 2780, 2240, 1980];
    chirps.forEach((freq, i) => {
      const at = i * 0.038;
      tone(freq, freq * 1.32, at, 0.08, "sine", 0.07);
      tone(freq * 1.12, freq * 0.7, at + 0.04, 0.07, "sine", 0.045);
    });
  },
};
