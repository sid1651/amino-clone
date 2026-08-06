export type EasingId =
  | "custom"
  | "smooth"
  | "natural"
  | "slow-down"
  | "snappy"
  | "accelerate"
  | "elastic"
  | "bounce"
  | "overshoot"
  | "impulse"
  | "swing"
  | "linear";

export const easingLabels: Record<EasingId, string> = {
  custom: "Custom",
  smooth: "Smooth",
  natural: "Natural",
  "slow-down": "Slow down",
  snappy: "Snappy",
  accelerate: "Accelerate",
  elastic: "Elastic",
  bounce: "Bounce",
  overshoot: "Overshoot",
  impulse: "Impulse",
  swing: "Swing",
  linear: "Linear",
};

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const smoothstep = (t: number) => t * t * (3 - 2 * t);

export const easingFunctions: Record<EasingId, (t: number) => number> = {
  custom: (t) => smoothstep(clamp01(t)),
  smooth: (t) => smoothstep(clamp01(t)),
  natural: (t) => 1 - Math.pow(1 - clamp01(t), 3),
  "slow-down": (t) => 1 - Math.pow(1 - clamp01(t), 4),
  snappy: (t) => 1 - Math.pow(1 - clamp01(t), 6),
  accelerate: (t) => Math.pow(clamp01(t), 3),
  elastic: (t) => {
    const x = clamp01(t);
    if (x === 0 || x === 1) return x;
    return Math.pow(2, -10 * x) * Math.sin((x * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1;
  },
  bounce: (t) => {
    const x = clamp01(t);
    const n = 7.5625;
    const d = 2.75;
    if (x < 1 / d) return n * x * x;
    if (x < 2 / d) return n * (x - 1.5 / d) ** 2 + 0.75;
    if (x < 2.5 / d) return n * (x - 2.25 / d) ** 2 + 0.9375;
    return n * (x - 2.625 / d) ** 2 + 0.984375;
  },
  overshoot: (t) => {
    const x = clamp01(t) - 1;
    return 1 + 2.70158 * x ** 3 + 1.70158 * x ** 2;
  },
  impulse: (t) => {
    const x = clamp01(t) * 8;
    return x * Math.exp(1 - x);
  },
  swing: (t) => 0.5 - Math.cos(clamp01(t) * Math.PI) / 2,
  linear: clamp01,
};

export const normalizeTime = (timeSeconds: number, duration: number) => {
  if (duration <= 0) return 0;
  return ((timeSeconds % duration) + duration) % duration / duration;
};

export const steppedTime = (t01: number, steps: number) =>
  Math.floor(clamp01(t01) * Math.max(1, steps)) / Math.max(1, steps);

export const loopDistance = (a: number, b: number) => {
  const raw = Math.abs(a - b) % 1;
  return Math.min(raw, 1 - raw);
};

