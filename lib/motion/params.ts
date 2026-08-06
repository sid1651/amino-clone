import type { EditorProject } from "@/lib/editor/model";
import { easingFunctions, type EasingId } from "./easings";

export const TAU = Math.PI * 2;

export const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));
export const clamp01 = (value: number) => clamp(value, 0, 1);
export const cyclic = (value: number) => ((value % 1) + 1) % 1;
export const mix = (a: number, b: number, t: number) => a + (b - a) * t;
/** 0 → 0, 0.5 → 1, 1 → 0. Used to ping-pong a looping phase. */
export const triangle = (value: number) => 1 - Math.abs(cyclic(value) * 2 - 1);

const toNumber = (value: unknown, fallback: number) => {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toKey = (value: unknown, fallback: string) =>
  (typeof value === "string" && value.length > 0 ? value : fallback).toLowerCase();

const isEasingId = (value: string): value is EasingId => value in easingFunctions;

export type CardRatio = "Frame" | "1:1" | "4:3" | "3:4" | "16:9" | "9:16" | "2:3";

export const cardRatios: readonly CardRatio[] = ["Frame", "1:1", "4:3", "3:4", "16:9", "9:16", "2:3"];

export type ResolvedParams = {
  /** Card size multiplier, 0.4–1.6. */
  scale: number;
  /** Spacing multiplier, 0–1. */
  gap: number;
  radius: number;
  shadow: number;
  ratio: string;
  /** +1 or -1; `alternate` ping-pongs instead of flipping. */
  direction: number;
  alternate: boolean;
  easing: (t: number) => number;
  /** A control's value normalised to 0–1 using its declared range. */
  unit: (id: string, fallback?: number) => number;
  /** A control's raw numeric value. */
  value: (id: string, fallback: number) => number;
  /** A select control's value, lowercased. */
  option: (id: string, fallback: string) => string;
};

/**
 * Reads every editable control off the project once per frame. Controls are
 * authored on a 0–100 range so `unit` gives renderers a normalised knob.
 */
export const resolveParams = (project: EditorProject): ResolvedParams => {
  const params = project.templateParams;
  const value = (id: string, fallback: number) => toNumber(params[id], fallback);
  const unit = (id: string, fallback = 0.5) => clamp01(value(id, fallback * 100) / 100);
  const option = (id: string, fallback: string) => toKey(params[id], fallback);
  const directionKey = option("direction", "right");
  const easingKey = option("easing", "smooth");

  return {
    scale: clamp(value("size", 100) / 100, 0.4, 1.6),
    gap: clamp01(value("gap", 45) / 100),
    radius: clamp(value("radius", 16), 0, 50),
    shadow: clamp01(value("shadow", 55) / 100),
    ratio: typeof params.ratio === "string" ? params.ratio : "Frame",
    direction: directionKey === "left" ? -1 : 1,
    alternate: directionKey === "alternate",
    easing: isEasingId(easingKey) ? easingFunctions[easingKey] : easingFunctions.smooth,
    unit,
    value,
    option,
  };
};

/**
 * Applies the direction control to a looping 0–1 phase. `alternate` ping-pongs
 * so the motion reverses at the halfway point and still loops seamlessly.
 */
export const phase = (t: number, params: ResolvedParams) =>
  params.alternate ? triangle(t) : cyclic(t * params.direction);

/**
 * Eases a looping phase without breaking the loop: the curve is applied to the
 * ping-ponged value so t=0 and t=1 still land on the same frame.
 */
export const easedLoop = (t: number, params: ResolvedParams) => {
  const forward = cyclic(t) < 0.5;
  const half = params.easing(clamp01(triangle(t)));
  return forward ? half / 2 : 1 - half / 2;
};

export type CardBox = { width: number; height: number };

/**
 * Resolves a card's box from the template's natural size plus the user's card
 * ratio and card size controls. Area is preserved across ratios so switching
 * ratio reframes the card without blowing up the layout.
 */
export const cardBox = (params: ResolvedParams, naturalWidth: number, naturalHeight: number): CardBox => {
  const width = naturalWidth * params.scale;
  const height = naturalHeight * params.scale;
  if (params.ratio === "Frame" || !params.ratio.includes(":")) return { width, height };
  const [a, b] = params.ratio.split(":").map(Number);
  if (!a || !b || !Number.isFinite(a) || !Number.isFinite(b)) return { width, height };
  const area = width * height;
  const resolvedHeight = Math.sqrt((area * b) / a);
  return { width: area / resolvedHeight, height: resolvedHeight };
};

const hexToRgb = (hex: string) => {
  const clean = hex.replace("#", "");
  const full = clean.length === 3 ? clean.split("").map((char) => char + char).join("") : clean;
  const int = Number.parseInt(full.slice(0, 6), 16);
  return Number.isFinite(int) ? { r: (int >> 16) & 255, g: (int >> 8) & 255, b: int & 255 } : { r: 12, g: 14, b: 22 };
};

/** Approximates the backdrop colour so reflections can fade into the floor. */
export const backgroundRgb = (project: EditorProject, blend = 0.5) => {
  const background = project.background;
  const base = hexToRgb(background.color);
  if (background.mode !== "gradient") return base;
  const second = hexToRgb(background.color2);
  return {
    r: mix(base.r, second.r, blend),
    g: mix(base.g, second.g, blend),
    b: mix(base.b, second.b, blend),
  };
};

export const rgba = ({ r, g, b }: { r: number; g: number; b: number }, alpha: number) =>
  `rgba(${Math.round(r)},${Math.round(g)},${Math.round(b)},${clamp01(alpha)})`;
