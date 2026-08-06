import type { RuntimeAsset } from "@/lib/editor/model";
import type { RenderContext } from "@/lib/motion/types";

/** A fake decoded image so media-only controls (zoom, pan) are exercised. */
export const stubAsset = (id: string): RuntimeAsset => ({
  id,
  file: undefined as unknown as File,
  objectUrl: `stub:${id}`,
  type: "image",
  name: id,
  source: { id, naturalWidth: 800, naturalHeight: 600 } as unknown as HTMLImageElement,
});

export type DrawnCard = {
  x: number;
  y: number;
  width: number;
  height: number;
  radius: number;
  rotation: number;
  skew: number;
  alpha: number;
  shadow: number;
  /** Which media was drawn into the card, and the box it was drawn at. */
  media: string;
};

type State = { a: number; d: number; e: number; f: number; rotation: number; skew: number; alpha: number };

/**
 * A minimal 2D context that records the full visual state of every card the
 * renderer draws — position, size, corner radius, rotation, skew, opacity and
 * shadow — so a test can assert that a control actually changes the frame.
 */
export const createStubContext = (width = 320, height = 180, assets: ReadonlyMap<string, RuntimeAsset> = new Map()) => {
  const cards: DrawnCard[] = [];
  /** Clip regions, so patterned reveals (stripes, iris, mosaic) are observable. */
  const clips: string[] = [];
  let state: State = { a: 1, d: 1, e: 0, f: 0, rotation: 0, skew: 0, alpha: 1 };
  const stack: State[] = [];
  let pending: { width: number; height: number; radius: number } | null = null;
  let ops: string[] = [];
  const round = (value: number) => (Number.isFinite(value) ? value.toFixed(2) : "x");
  /**
   * Paths are baked into device space when built, so each op records the
   * transform in force at that moment rather than at clip() time.
   */
  const at = () => `@${round(state.e)},${round(state.f)},${round(state.rotation)}`;

  const gradient = { addColorStop: () => undefined };

  const ctx = {
    canvas: { width, height },
    globalCompositeOperation: "source-over",
    fillStyle: "" as unknown,
    strokeStyle: "" as unknown,
    lineWidth: 1,
    font: "",
    textAlign: "left",
    textBaseline: "top",
    shadowColor: "",
    shadowBlur: 0,
    shadowOffsetY: 0,
    get globalAlpha() { return state.alpha; },
    set globalAlpha(value: number) { state.alpha = value; },
    save() { stack.push({ ...state }); },
    restore() { state = stack.pop() ?? state; },
    translate(x: number, y: number) { state.e += x * state.a; state.f += y * state.d; },
    scale(x: number, y: number) { state.a *= x; state.d *= y; },
    rotate(angle: number) { state.rotation += angle; },
    transform(_a: number, b: number) { state.skew += b; },
    setTransform(...args: number[]) {
      const [a = 1, , , d = 1, e = 0, f = 0] = args;
      state = { ...state, a, d, e, f, rotation: 0, skew: 0 };
    },
    beginPath() { pending = null; ops = []; },
    roundRect(x: number, y: number, w: number, h: number, radius = 0) {
      pending = { width: Math.abs(w * state.a), height: Math.abs(h * state.d), radius: Number(radius) || 0 };
      ops.push(`rr:${round(x)},${round(y)},${round(w)},${round(h)}${at()}`);
    },
    rect(x: number, y: number, w: number, h: number) {
      pending = null;
      ops.push(`r:${round(x)},${round(y)},${round(w)},${round(h)}${at()}`);
    },
    arc(x: number, y: number, radius: number) {
      pending = null;
      ops.push(`a:${round(x)},${round(y)},${round(radius)}${at()}`);
    },
    moveTo() {}, lineTo() {}, closePath() {},
    clip() { clips.push(ops.join(";")); },
    fill() {
      if (!pending) return;
      cards.push({
        x: state.e,
        y: state.f,
        width: pending.width,
        height: pending.height,
        radius: pending.radius,
        rotation: state.rotation,
        skew: state.skew,
        alpha: state.alpha,
        shadow: ctx.shadowBlur,
        media: "",
      });
      pending = null;
    },
    stroke() { pending = null; },
    fillRect() {},
    clearRect() {},
    drawImage(source: { id?: string }, x: number, y: number, w: number, h: number) {
      // Records which media landed in the card and the box it was drawn at, so
      // media-only controls (zoom, pan, mirroring) are observable.
      const last = cards[cards.length - 1];
      if (last && !last.media) last.media = `${source?.id ?? "?"}@${[x, y, w, h].map((value) => value.toFixed(2)).join(",")}`;
    },
    fillText(text: string) {
      // Placeholder cards stamp their slot number instead of drawing media.
      const last = cards[cards.length - 1];
      if (last && !last.media) last.media = `#${text}`;
    },
    measureText() { return { width: 10 }; },
    createLinearGradient() { return gradient; },
    createRadialGradient() { return gradient; },
  };

  const context: RenderContext = {
    ctx: ctx as unknown as RenderContext["ctx"],
    width,
    height,
    assets,
  };

  return { context, cards, clips };
};

export type Recording = { cards: DrawnCard[]; clips: string[] };

/** Stable signature of a rendered frame, used to compare two parameter sets. */
export const signature = ({ cards, clips }: Recording) =>
  [
    cards
      .map((card) => [
        ...[card.x, card.y, card.width, card.height, card.radius, card.rotation, card.skew, card.alpha, card.shadow].map((value) => value.toFixed(3)),
        card.media,
      ].join(","))
      .join("|"),
    clips.join("|"),
  ].join("~");
