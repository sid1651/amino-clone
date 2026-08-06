import type { EditorProject, RuntimeAsset } from "@/lib/editor/model";

export type CategoryId =
  | "perspective"
  | "isometric"
  | "orbit"
  | "flow"
  | "grid"
  | "focus"
  | "wipe"
  | "scatter";

/**
 * Each family is a distinct layout algorithm in the renderer. Templates are
 * presets over a family, so every control a template exposes is a value its
 * family renderer actually reads.
 */
export type FamilyId =
  | "sphere"
  | "tunnel"
  | "helix"
  | "stream"
  | "ribbon"
  | "depthStack"
  | "columns"
  | "runway"
  | "iso"
  | "ring"
  | "coverflow"
  | "strip"
  | "reel"
  | "stepped"
  | "grid"
  | "centerStage"
  | "focusShift"
  | "deckPeel"
  | "kenBurns"
  | "wipe"
  | "stack"
  | "trail"
  | "dance";

export type ControlSchema = {
  id: string;
  label: string;
  type: "range" | "select";
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  options?: readonly string[];
  defaultValue: string | number;
};

export type RenderContext = {
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
  width: number;
  height: number;
  assets: ReadonlyMap<string, RuntimeAsset>;
  thumbnail?: boolean;
};

export interface MotionTemplate {
  id: string;
  name: string;
  category: CategoryId;
  family: FamilyId;
  description: string;
  isNew?: boolean;
  defaultSlots: number;
  minSlots: number;
  maxSlots: number;
  defaultDuration: number;
  defaultParams: Record<string, string | number>;
  controls: ControlSchema[];
  render(ctx: RenderContext, project: EditorProject, t01: number): void;
}
