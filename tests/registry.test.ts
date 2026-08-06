import { describe, expect, it } from "vitest";
import { createDefaultProject, type EditorProject } from "@/lib/editor/model";
import { categoryCounts, categoryOrder, templateById, templateRegistry } from "@/lib/motion/registry";
import { createStubContext, signature, stubAsset } from "./helpers/stubCanvas";

const assets = new Map(Array.from({ length: 24 }, (_, index) => [`asset-${index}`, stubAsset(`asset-${index}`)]));

const projectFor = (templateId: string, overrides: Record<string, string | number> = {}): EditorProject => {
  const template = templateById.get(templateId)!;
  const base = createDefaultProject();
  return {
    ...base,
    templateId,
    duration: template.defaultDuration,
    slots: Array.from({ length: template.defaultSlots }, (_, index) => ({ id: `slot-${index}`, assetId: `asset-${index}` })),
    templateParams: { ...template.defaultParams, ...overrides },
  };
};

const frameSignature = (templateId: string, overrides: Record<string, string | number> = {}, t = 0.37) => {
  const template = templateById.get(templateId)!;
  const { context, cards, clips } = createStubContext(320, 180, assets);
  template.render(context, projectFor(templateId, overrides), t);
  return { key: signature({ cards, clips }), cards };
};

/**
 * Controls that only bite during part of a loop (easing, hold, stagger) look
 * inert at a single instant, so compare a strip of frames across the loop.
 */
const loopSignature = (templateId: string, overrides: Record<string, string | number> = {}) =>
  [0.08, 0.29, 0.53, 0.77, 0.94].map((t) => frameSignature(templateId, overrides, t).key).join("#");

describe("template registry", () => {
  it("exposes a catalog of uniquely named, uniquely identified templates", () => {
    expect(templateRegistry.length).toBe(62);
    expect(new Set(templateRegistry.map((template) => template.id)).size).toBe(templateRegistry.length);
    expect(new Set(templateRegistry.map((template) => template.name)).size).toBe(templateRegistry.length);
  });

  it("keeps category counts in sync with the catalog", () => {
    const summed = categoryOrder.reduce((total, category) => total + categoryCounts[category], 0);
    expect(summed).toBe(templateRegistry.length);
    for (const category of categoryOrder) {
      expect(templateRegistry.filter((template) => template.category === category)).toHaveLength(categoryCounts[category]);
    }
  });

  it("has valid slot bounds, durations, and a render function", () => {
    for (const template of templateRegistry) {
      expect(template.defaultSlots).toBeGreaterThanOrEqual(template.minSlots);
      expect(template.maxSlots).toBeGreaterThanOrEqual(template.defaultSlots);
      expect(template.defaultDuration).toBeGreaterThanOrEqual(2);
      expect(template.description.length).toBeGreaterThan(10);
      expect(typeof template.render).toBe("function");
    }
  });

  it("ships the spherical mirror loop and the other reflection templates", () => {
    const mirror = templateById.get("spherical-mirror-loop");
    expect(mirror?.family).toBe("sphere");
    expect(Number(mirror?.defaultParams.reflection)).toBeGreaterThan(50);
    expect(templateById.get("mirror-runway")?.family).toBe("runway");
  });

  it("gives every control a default the template actually carries", () => {
    for (const template of templateRegistry) {
      expect(template.controls.length).toBeGreaterThanOrEqual(6);
      for (const control of template.controls) {
        expect(template.defaultParams[control.id]).toBeDefined();
        if (control.type === "select") {
          expect(control.options).toContain(String(template.defaultParams[control.id]));
        } else {
          const value = Number(template.defaultParams[control.id]);
          expect(value).toBeGreaterThanOrEqual(control.min ?? 0);
          expect(value).toBeLessThanOrEqual(control.max ?? 100);
        }
      }
      expect(new Set(template.controls.map((control) => control.id)).size).toBe(template.controls.length);
    }
  });
});

describe("template rendering", () => {
  it("draws finite, positive-sized cards for every template", () => {
    for (const template of templateRegistry) {
      for (const t of [0, 0.25, 0.5, 0.9]) {
        const { cards } = frameSignature(template.id, {}, t);
        expect(cards.length, `${template.name} drew nothing at t=${t}`).toBeGreaterThan(0);
        for (const card of cards) {
          expect(Number.isFinite(card.x) && Number.isFinite(card.y), `${template.name} produced a non-finite position`).toBe(true);
          expect(card.width).toBeGreaterThan(0);
          expect(card.height).toBeGreaterThan(0);
        }
      }
    }
  });

  it("loops seamlessly: t=0 and t=1 render the same frame", () => {
    for (const template of templateRegistry) {
      expect(frameSignature(template.id, {}, 0).key, `${template.name} does not loop`).toBe(frameSignature(template.id, {}, 1).key);
    }
  });

  it("makes every range control change the rendered frame", () => {
    for (const template of templateRegistry) {
      for (const control of template.controls.filter((item) => item.type === "range")) {
        const low = loopSignature(template.id, { [control.id]: control.min ?? 0 });
        const high = loopSignature(template.id, { [control.id]: control.max ?? 100 });
        expect(low, `${template.name}: "${control.label}" does not affect the render`).not.toBe(high);
      }
    }
  });

  it("has no two templates that animate identically", () => {
    const seen = new Map<string, string>();
    for (const template of templateRegistry) {
      const key = loopSignature(template.id);
      const clash = seen.get(key);
      expect(clash, `${template.name} renders identically to ${clash}`).toBeUndefined();
      seen.set(key, template.name);
    }
  });

  it("makes every select control change the rendered frame", () => {
    for (const template of templateRegistry) {
      for (const control of template.controls.filter((item) => item.type === "select")) {
        const keys = new Set((control.options ?? []).map((option) => loopSignature(template.id, { [control.id]: option })));
        expect(keys.size, `${template.name}: "${control.label}" has no visible effect`).toBeGreaterThan(1);
      }
    }
  });
});
