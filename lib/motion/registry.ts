import type { EditorProject } from "@/lib/editor/model";
import { cardRatios } from "./params";
import { renderMotionTemplate } from "./renderer";
import type { CategoryId, ControlSchema, FamilyId, MotionTemplate } from "./types";

export const categoryLabels: Record<CategoryId, string> = {
  perspective: "3D & Perspective",
  isometric: "Isometric",
  orbit: "Orbit",
  flow: "Carousel & Flow",
  grid: "Grid",
  focus: "Spotlight & Focus",
  wipe: "Reveal & Wipe",
  scatter: "Stack & Scatter",
};

export const categoryOrder = Object.keys(categoryLabels) as CategoryId[];

const range = (id: string, label: string, defaultValue: number, options: Partial<ControlSchema> = {}): ControlSchema => ({
  id,
  label,
  type: "range",
  min: 0,
  max: 100,
  step: 1,
  suffix: "%",
  defaultValue,
  ...options,
});

const select = (id: string, label: string, options: readonly string[], defaultValue: string): ControlSchema => ({
  id, label, type: "select", options, defaultValue,
});

const easingOptions = ["Smooth", "Natural", "Slow down", "Snappy", "Accelerate", "Elastic", "Bounce", "Overshoot", "Swing", "Linear"] as const;

/** Applied to every template; the renderer reads these on every family. */
const frameControls: ControlSchema[] = [
  range("size", "Card size", 100, { min: 40, max: 160 }),
  range("gap", "Spacing", 45),
  select("ratio", "Card ratio", cardRatios, "Frame"),
  range("radius", "Corner radius", 16, { max: 50 }),
  range("shadow", "Shadow", 55),
];

const directionControl = select("direction", "Direction", ["Right", "Left", "Alternate"], "Right");
const easingControl = select("easing", "Easing", easingOptions, "Smooth");

/**
 * Controls a family's renderer actually reads. Nothing is listed here that the
 * renderer ignores, so every slider in the inspector changes the canvas.
 */
const familyControls: Record<FamilyId, ControlSchema[]> = {
  sphere: [select("layout", "Layout", ["Scatter", "Grid"], "Scatter"), range("density", "Tile density", 0), range("curvature", "Sphere size", 50), range("tilt", "Tilt", 50), range("spin", "Spin", 50), range("fade", "Back fade", 60), range("reflection", "Reflection", 0), directionControl],
  tunnel: [range("tunnelsize", "Tunnel width", 50), range("depth", "Depth", 50), range("edgefade", "Edge fade", 60), directionControl],
  helix: [range("turns", "Turns", 50), range("taper", "Taper", 50), range("pulse", "Scale pulse", 40), directionControl],
  stream: [range("curve", "Curve", 50), range("tilt", "Tilt", 50), range("perspective", "Perspective", 50), directionControl],
  ribbon: [range("amplitude", "Wave height", 50), range("wavelength", "Wave length", 50), range("twist", "Twist", 50), directionControl],
  depthStack: [range("depthgap", "Depth gap", 50), range("wobble", "Wobble", 40), range("dim", "Depth dim", 50), directionControl],
  columns: [range("columns", "Columns", 50), range("speedvariation", "Speed variation", 50), range("depth", "Depth", 50), directionControl],
  runway: [range("spread", "Spread", 50), range("horizon", "Horizon", 50), range("reflection", "Reflection", 70), directionControl],
  iso: [range("tilt", "Tilt", 50), range("focus", "Centre focus", 20), range("arc", "Arc", 0), directionControl],
  ring: [range("ringwidth", "Ring width", 50), range("ringheight", "Ring height", 40), range("depth", "Depth fade", 50), range("bloom", "Bloom", 20), range("rings", "Extra rings", 0), select("anchor", "Anchor", ["Center", "Bottom", "Top"], "Center"), select("facing", "Card facing", ["Camera", "Ring"], "Camera"), directionControl],
  coverflow: [select("orientation", "Orientation", ["Horizontal", "Vertical"], "Horizontal"), range("sidescale", "Side scale", 50), range("sidetilt", "Side tilt", 60), range("zigzag", "Zigzag", 0), range("depthfade", "Depth fade", 40), range("angle", "Flow angle", 0), directionControl],
  strip: [range("rows", "Rows", 0), range("tilt", "Tilt", 50), range("stagger", "Row stagger", 50), select("orientation", "Orientation", ["Horizontal", "Vertical"], "Horizontal"), directionControl],
  reel: [range("lift", "Active lift", 60), range("kenburns", "Ken Burns", 50), range("strip", "Strip height", 50), easingControl],
  stepped: [range("hold", "Hold", 40), range("overshoot", "Overshoot", 40), range("sidescale", "Side scale", 50), directionControl, easingControl],
  grid: [range("columns", "Columns", 35), range("stagger", "Stagger", 50), range("flip", "Flip", 0), range("pop", "Pop", 50), range("zoom", "Zoom", 0), range("dim", "Dim", 20), select("mirror", "Mirror", ["Off", "On"], "Off"), directionControl, easingControl],
  centerStage: [range("travel", "Travel", 50), range("trail", "Ghost trail", 40), directionControl, easingControl],
  focusShift: [range("rail", "Rail width", 50), range("focus", "Focus", 70), directionControl, easingControl],
  deckPeel: [range("peek", "Stack peek", 50), range("peel", "Peel distance", 50), directionControl, easingControl],
  kenBurns: [range("zoomamount", "Zoom amount", 50), range("pan", "Pan", 50), directionControl, easingControl],
  wipe: [select("pattern", "Pattern", ["Linear", "Stripes", "Iris", "Split", "Mosaic"], "Linear"), range("pieces", "Pieces", 50), range("angle", "Edge angle", 35), range("stagger", "Stagger", 50), directionControl, easingControl],
  stack: [range("spread", "Spread", 40), range("spin", "Spin", 40), range("throw", "Throw height", 40), range("hold", "Hold", 30), range("inset", "Stack offset", 40), directionControl, easingControl],
  trail: [range("traillength", "Trail length", 50), range("pop", "Pop", 50), directionControl],
  dance: [range("columns", "Columns", 40), range("swing", "Swing", 50), directionControl, easingControl],
};

type TemplateSeed = {
  name: string;
  family: FamilyId;
  description: string;
  slots: number;
  duration: number;
  /** Overrides on top of the family + frame control defaults. */
  params?: Record<string, string | number>;
  /**
   * Family controls this preset renders inert. They keep their default value
   * but are not offered in the inspector, so no visible control does nothing.
   */
  hide?: readonly string[];
  isNew?: boolean;
};

const catalog: Record<CategoryId, readonly TemplateSeed[]> = {
  perspective: [
    { name: "Showcase Stream", family: "stream", description: "Cards flow along an S-curve with depth scaling.", slots: 12, duration: 16, params: { curve: 55, tilt: 45, perspective: 60 } },
    { name: "Sphere Wall", family: "sphere", description: "Panels tile a curved wall that rotates in place.", slots: 16, duration: 20, params: { layout: "Grid", curvature: 74, tilt: 50, spin: 34, fade: 70, gap: 30 } },
    { name: "Card Globe", family: "sphere", description: "A solid globe tiled edge to edge with your media, turning on its axis.", slots: 16, duration: 20, isNew: true, params: { layout: "Grid", density: 80, curvature: 78, tilt: 50, spin: 40, fade: 66, gap: 24, radius: 8, shadow: 0 } },
    { name: "Orbit Globe", family: "sphere", description: "A loose, wide-flung globe on a fast axis.", slots: 12, duration: 20, params: { curvature: 58, tilt: 22, spin: 88, fade: 25, size: 120, gap: 70 } },
    { name: "Sphere Cascade", family: "sphere", description: "A steeply tilted panel wall with heavy back fade.", slots: 14, duration: 20, params: { layout: "Grid", curvature: 88, tilt: 76, spin: 20, fade: 85, gap: 55 } },
    { name: "Totem Wall", family: "columns", description: "Even vertical totems marching in lockstep.", slots: 8, duration: 20, params: { columns: 20, speedvariation: 12, depth: 18, ratio: "9:16" } },
    { name: "Parallax Totem", family: "columns", description: "Vertical columns drift at different speeds.", slots: 12, duration: 18, params: { columns: 62, speedvariation: 74, depth: 66 } },
    { name: "Card Tunnel", family: "tunnel", description: "Cards rush past the camera through a receding tunnel.", slots: 12, duration: 16, params: { tunnelsize: 46, depth: 55, edgefade: 60 } },
    { name: "Spiral Stream", family: "helix", description: "A tapering helix that carries cards upward.", slots: 12, duration: 24, params: { turns: 62, taper: 55, pulse: 35 } },
    { name: "Depth Stack Scroll", family: "depthStack", description: "Cards advance out of a deep stack toward the viewer.", slots: 10, duration: 14, params: { depthgap: 50, wobble: 35, dim: 55 } },
    { name: "Spherical Mirror Loop", family: "sphere", description: "Cards wrap a slowly turning sphere above a mirrored floor.", slots: 14, duration: 18, isNew: true, params: { reflection: 78, curvature: 52, tilt: 44, spin: 45, fade: 55, shadow: 30 } },
    { name: "Ribbon Wave", family: "ribbon", description: "A twisting ribbon of cards riding a sine wave.", slots: 10, duration: 14, isNew: true, params: { amplitude: 55, wavelength: 45, twist: 60 } },
    { name: "Mirror Runway", family: "runway", description: "Cards walk a runway toward the camera over wet glass.", slots: 8, duration: 16, isNew: true, params: { spread: 45, horizon: 50, reflection: 72 } },
  ],
  isometric: [
    { name: "Iso Cascade", family: "iso", description: "A steady isometric conveyor of cards.", slots: 10, duration: 10, params: { tilt: 45, focus: 10, arc: 0 } },
    { name: "Iso Focus", family: "iso", description: "Isometric travel that swells through the centre.", slots: 10, duration: 12, params: { tilt: 52, focus: 82, arc: 12 } },
    { name: "Iso Orbit", family: "iso", description: "The isometric line bends into an orbiting ring.", slots: 9, duration: 10, params: { tilt: 38, focus: 35, arc: 88 } },
  ],
  orbit: [
    { name: "Orbit Showcase", family: "ring", description: "A wide elliptical ring with soft depth fade.", slots: 12, duration: 12, params: { ringwidth: 55, ringheight: 28, depth: 55, bloom: 15 } },
    { name: "Orbit Bloom", family: "ring", description: "An orbit that breathes as it turns.", slots: 12, duration: 12, params: { ringwidth: 48, ringheight: 38, depth: 45, bloom: 80 } },
    { name: "Orbit Carousel", family: "ring", description: "A flat, wide ring of large cards.", slots: 6, duration: 12, params: { ringwidth: 68, ringheight: 10, depth: 72, bloom: 4, size: 122, ratio: "4:3" } },
    { name: "Photo Orbit", family: "ring", description: "A tall ring that sweeps cards top to bottom.", slots: 8, duration: 18, params: { ringwidth: 40, ringheight: 76, depth: 60 } },
    { name: "Focus Orbit", family: "ring", description: "A dense swarm orbiting a sharp centre.", slots: 20, duration: 12, params: { ringwidth: 34, ringheight: 20, depth: 86, bloom: 36, size: 68, gap: 14 } },
    { name: "Vortex Spin", family: "ring", description: "Concentric counter-rotating rings.", slots: 12, duration: 20, params: { rings: 100, ringwidth: 62, ringheight: 45, depth: 70 } },
    { name: "Wheel Spin", family: "ring", description: "A wheel of cards that rotate with the rim.", slots: 8, duration: 14, params: { anchor: "Center", facing: "Ring", ringwidth: 58, ringheight: 100, depth: 30 } },
    { name: "Wheel Spin Bottom", family: "ring", description: "The same wheel anchored below the frame, cresting like an arch.", slots: 8, duration: 14, params: { anchor: "Bottom", facing: "Ring", ringwidth: 64, ringheight: 100, depth: 22, size: 112 } },
  ],
  flow: [
    { name: "Card Totem", family: "coverflow", description: "Wide cards stacked into a vertical totem.", slots: 6, duration: 12, params: { orientation: "Vertical", sidetilt: 20, sidescale: 30, depthfade: 20, size: 120, gap: 20, ratio: "16:9" } },
    { name: "Film Strip", family: "coverflow", description: "A single continuous strip of even cards.", slots: 6, duration: 12, params: { sidetilt: 0, sidescale: 0, depthfade: 15, ratio: "4:3" } },
    { name: "Wheel Carousel", family: "stepped", description: "Steps card by card — the Easing control shapes each move.", slots: 6, duration: 9, params: { hold: 42, overshoot: 45, sidescale: 50, easing: "Overshoot" } },
    { name: "Cover Flow", family: "coverflow", description: "The classic tilted carousel.", slots: 6, duration: 12, params: { sidetilt: 76, sidescale: 45, depthfade: 40 } },
    { name: "Cover Flow Vertical", family: "coverflow", description: "Cover Flow turned on its side, scrolling top to bottom.", slots: 6, duration: 12, params: { orientation: "Vertical", sidetilt: 76, sidescale: 45, depthfade: 40 } },
    { name: "Cover Ring", family: "ring", description: "A shallow ring with strong perspective falloff.", slots: 8, duration: 14, params: { depth: 95, ringwidth: 50, ringheight: 18, bloom: 10 } },
    { name: "Carousel Flow", family: "coverflow", description: "Flat carousel where side cards scale away.", slots: 6, duration: 10, params: { sidetilt: 0, sidescale: 72, depthfade: 55 } },
    { name: "Diagonal Carousel", family: "coverflow", description: "The rail runs on a diagonal across the frame.", slots: 6, duration: 12, params: { angle: 55, sidetilt: 35, sidescale: 50 } },
    { name: "Focus Slider", family: "coverflow", description: "Alternating cards zigzag past a focused centre.", slots: 8, duration: 10, params: { zigzag: 62, sidescale: 60, sidetilt: 12 } },
    { name: "Mosaic Marquee", family: "strip", description: "Multiple marquee rows sliding in opposite directions.", slots: 12, duration: 12, params: { rows: 72, tilt: 50, stagger: 70 } },
    { name: "Hero Reel", family: "reel", description: "A hero card with a Ken Burns push and a thumbnail strip.", slots: 7, duration: 10, params: { lift: 62, kenburns: 55, strip: 45 } },
    { name: "Perspective Rail", family: "coverflow", description: "Cards recede down a rail with heavy depth fade.", slots: 7, duration: 12, isNew: true, params: { angle: 0, sidetilt: 18, sidescale: 88, depthfade: 82 } },
  ],
  grid: [
    { name: "Grid Reveal", family: "grid", description: "Cards pop in on a diagonal sweep.", slots: 6, duration: 6, params: { stagger: 78, pop: 72, columns: 35 } },
    { name: "Spotlight Zoom", family: "grid", description: "The camera pushes into one cell while the rest dim.", slots: 6, duration: 12, params: { zoom: 68, dim: 72, pop: 8, stagger: 0 } },
    { name: "Flip Grid", family: "grid", description: "Every cell flips on its vertical axis.", slots: 8, duration: 8, params: { flip: 100, pop: 0, stagger: 62 } },
    { name: "Pop Grid", family: "grid", description: "Cells punch in and out on a staggered beat.", slots: 6, duration: 8, params: { pop: 100, stagger: 48, columns: 18 } },
    { name: "Ticker Loop", family: "strip", description: "Flat marquee rows looping side to side.", slots: 12, duration: 12, params: { rows: 70, tilt: 50, stagger: 55 } },
    { name: "Ticker Tilt", family: "strip", description: "The same marquee raked over on a diagonal.", slots: 12, duration: 12, params: { rows: 70, tilt: 84, stagger: 62, size: 112 } },
    { name: "Column Drift", family: "strip", description: "Vertical lanes drifting past each other.", slots: 12, duration: 12, params: { orientation: "Vertical", rows: 60, tilt: 50, stagger: 45 } },
    { name: "Grid Zoom Strip", family: "grid", description: "A tight three-column grid with a travelling zoom.", slots: 9, duration: 6, params: { zoom: 100, columns: 25, dim: 42, pop: 20 } },
    { name: "Kaleido Grid", family: "grid", description: "Mirrored columns turn the grid into a kaleidoscope.", slots: 8, duration: 10, isNew: true, params: { mirror: "On", flip: 42, columns: 60, stagger: 55 } },
  ],
  focus: [
    { name: "Center Stage", family: "centerStage", description: "One card crosses the frame trailing ghosts.", slots: 3, duration: 7, params: { travel: 52, trail: 45 } },
    { name: "Focus Shift", family: "focusShift", description: "A rail of cards steps through a focused centre.", slots: 4, duration: 10, params: { rail: 52, focus: 72 } },
    { name: "Deck Peel", family: "deckPeel", description: "The top card peels away to reveal the deck.", slots: 4, duration: 9, params: { peek: 48, peel: 55 } },
    { name: "Zoom Parallax", family: "kenBurns", description: "Full-bleed cards with a slow zoom and cross-fade.", slots: 3, duration: 9, params: { zoomamount: 55, pan: 50 } },
  ],
  wipe: [
    { name: "Diagonal Wipe", family: "wipe", description: "An angled edge sweeps the next card in.", slots: 3, duration: 8, params: { pattern: "Linear", angle: 35, pieces: 55, stagger: 22 } },
    { name: "Stripe Reveal", family: "wipe", description: "Vertical stripes open in sequence.", slots: 3, duration: 8, params: { pattern: "Stripes", pieces: 58, stagger: 72, angle: 0 } },
    { name: "Split Reveal", family: "wipe", description: "Bands split open from their centre line.", slots: 4, duration: 8, params: { pattern: "Split", pieces: 20, stagger: 42, angle: 0 } },
    { name: "Mosaic Wipe", family: "wipe", description: "Tiles scale in across a diagonal.", slots: 4, duration: 8, params: { pattern: "Mosaic", pieces: 32, stagger: 68 } },
    { name: "Iris Reveal", family: "wipe", description: "A circular iris opens from the centre.", slots: 3, duration: 8, isNew: true, params: { pattern: "Iris", easing: "Natural" }, hide: ["pieces", "stagger", "angle", "direction"] },
  ],
  scatter: [
    { name: "Stack Slide", family: "stack", description: "The top card slides clear of the stack.", slots: 4, duration: 8, params: { spread: 72, throw: 0, spin: 18, inset: 35 } },
    { name: "Cascade Drop", family: "stack", description: "Cards tumble off the pile with a spin.", slots: 4, duration: 7, params: { throw: 22, spin: 58, spread: 26, inset: 62 } },
    { name: "Cascade Deck", family: "stack", description: "A wide, heavily offset deck peeling one card at a time.", slots: 8, duration: 8, params: { throw: 8, spin: 30, spread: 44, inset: 92, hold: 50 } },
    { name: "Image Trail", family: "trail", description: "Cards chase a looping path in a comet trail.", slots: 12, duration: 10, params: { traillength: 55, pop: 50 } },
    { name: "Poster Burst", family: "stack", description: "A long hold, then a fast burst outward.", slots: 4, duration: 12, params: { hold: 66, spread: 62, spin: 30, easing: "Snappy" } },
    { name: "Card Toss", family: "stack", description: "Each card is thrown up and out of frame.", slots: 8, duration: 12, params: { throw: 86, spin: 74, spread: 46, inset: 30 } },
    { name: "Position Dance", family: "dance", description: "Cards trade grid positions on every beat.", slots: 6, duration: 6, params: { columns: 42, swing: 55 } },
    { name: "Shuffle Deck", family: "stack", description: "A tight, scattered deck shuffling in place.", slots: 8, duration: 8, isNew: true, params: { spread: 32, spin: 14, inset: 58, hold: 20, throw: 16 } },
  ],
};

const slugify = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

const buildTemplate = (category: CategoryId, seed: TemplateSeed): MotionTemplate => {
  const all = [...frameControls, ...familyControls[seed.family]];
  const hidden = new Set(seed.hide ?? []);
  const controls = all.filter((control) => !hidden.has(control.id));
  // Hidden controls keep their default so the renderer still has a value.
  const defaultParams: Record<string, string | number> = Object.fromEntries(
    all.map((control) => [control.id, control.defaultValue]),
  );
  for (const [id, value] of Object.entries(seed.params ?? {})) {
    if (id in defaultParams) defaultParams[id] = value;
  }
  return {
    id: slugify(seed.name),
    name: seed.name,
    category,
    family: seed.family,
    description: seed.description,
    isNew: seed.isNew,
    defaultSlots: seed.slots,
    minSlots: Math.max(2, Math.min(3, seed.slots)),
    maxSlots: Math.max(16, seed.slots),
    defaultDuration: seed.duration,
    defaultParams,
    controls,
    render: (context, project: EditorProject, t01) => renderMotionTemplate(context, project, t01, seed.family),
  };
};

export const templateRegistry: MotionTemplate[] = categoryOrder.flatMap((category) =>
  catalog[category].map((seed) => buildTemplate(category, seed)),
);

export const templateById = new Map(templateRegistry.map((template) => [template.id, template]));

export const categoryCounts = categoryOrder.reduce<Record<CategoryId, number>>((counts, category) => {
  counts[category] = catalog[category].length;
  return counts;
}, {
  perspective: 0,
  isometric: 0,
  orbit: 0,
  flow: 0,
  grid: 0,
  focus: 0,
  wipe: 0,
  scatter: 0,
});
