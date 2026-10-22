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
  osc.connect(gain).connect(context.destination);
  osc.start(start);
  osc.stop(start + length);
}

export const sound = {
  tap(): void {
    tone(660, 880, 0, 0.07, "triangle", 0.16);
  },
  peep(): void {
    tone(1400, 900, 0, 0.12, "triangle", 0.1);
  },
  fail(): void {
    tone(520, 140, 0, 0.42, "sawtooth", 0.1);
  },
  clear(): void {
    [523, 659, 784, 1047].forEach((freq, i) => tone(freq, freq, i * 0.11, 0.2, "square", 0.08));
  },
};
