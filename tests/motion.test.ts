import { describe, expect, it } from "vitest";
import { aspectDimensions, createDefaultProject, editorProjectSchema } from "@/lib/editor/model";
import { easingFunctions, loopDistance, normalizeTime, steppedTime } from "@/lib/motion/easings";

describe("motion helpers", () => {
  it("normalizes looping time", () => {
    expect(normalizeTime(0, 10)).toBe(0);
    expect(normalizeTime(10, 10)).toBe(0);
    expect(normalizeTime(-2.5, 10)).toBe(0.75);
  });

  it("keeps easing endpoints stable", () => {
    for (const ease of Object.values(easingFunctions)) {
      expect(Number.isFinite(ease(0))).toBe(true);
      expect(Number.isFinite(ease(1))).toBe(true);
    }
    expect(easingFunctions.smooth(0)).toBe(0);
    expect(easingFunctions.smooth(1)).toBe(1);
    expect(loopDistance(0.999, 0.001)).toBeCloseTo(0.002);
    expect(steppedTime(0.74, 4)).toBe(0.5);
  });

  it("maps all aspect ratios to even encoder dimensions", () => {
    expect(aspectDimensions("16:9")).toEqual({ width: 1280, height: 720 });
    expect(aspectDimensions("4:3")).toEqual({ width: 960, height: 720 });
    expect(aspectDimensions("1:1")).toEqual({ width: 720, height: 720 });
    expect(aspectDimensions("4:5")).toEqual({ width: 576, height: 720 });
    expect(aspectDimensions("9:16")).toEqual({ width: 404, height: 720 });
  });

  it("validates the default versioned project", () => {
    expect(editorProjectSchema.safeParse(createDefaultProject()).success).toBe(true);
  });
});

