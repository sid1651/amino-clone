import { z } from "zod";

export const aspectRatios = ["16:9", "4:3", "1:1", "4:5", "9:16"] as const;
export type AspectRatio = (typeof aspectRatios)[number];

export const projectThemes = ["dark", "light"] as const;
export type ProjectTheme = (typeof projectThemes)[number];

export const mediaSlotSchema = z.object({
  id: z.string().min(1),
  assetId: z.string().nullable(),
});

export type MediaSlot = z.infer<typeof mediaSlotSchema>;

export const textLayerSchema = z.object({
  id: z.string(),
  text: z.string().max(240),
  font: z.string(),
  weight: z.number().min(100).max(900),
  size: z.number().min(8).max(240),
  color: z.string(),
  align: z.enum(["left", "center", "right"]),
  opacity: z.number().min(0).max(1),
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  rotation: z.number().min(-180).max(180),
});

export type TextLayer = z.infer<typeof textLayerSchema>;

export const backgroundSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("solid"), color: z.string() }),
  z.object({
    mode: z.literal("gradient"),
    color: z.string(),
    color2: z.string(),
    angle: z.number(),
  }),
  z.object({ mode: z.literal("image"), color: z.string(), assetId: z.string().nullable() }),
]);

export type Background = z.infer<typeof backgroundSchema>;

export const editorProjectSchema = z.object({
  version: z.literal(1),
  title: z.string().min(1).max(80),
  templateId: z.string(),
  aspectRatio: z.enum(aspectRatios),
  duration: z.number().min(2).max(40),
  slots: z.array(mediaSlotSchema).max(24),
  textLayers: z.array(textLayerSchema).max(12),
  background: backgroundSchema,
  templateParams: z.record(z.string(), z.unknown()),
  theme: z.enum(projectThemes),
});

export type EditorProject = z.infer<typeof editorProjectSchema>;

export type RuntimeAsset = {
  id: string;
  /** Null for bundled demo artwork, which has no uploaded file behind it. */
  file: File | null;
  objectUrl: string;
  type: "image" | "video";
  name: string;
  source: HTMLImageElement | HTMLVideoElement | null;
  /** Bundled demo media is shared and must never be revoked or disposed. */
  isSample?: boolean;
};

export const createSlots = (
  count: number,
  createId: (index: number) => string = () => crypto.randomUUID(),
): MediaSlot[] =>
  Array.from({ length: count }, (_, index) => ({
    id: `slot-${createId(index)}`,
    assetId: null,
  }));

export const createDefaultProject = (): EditorProject => ({
  version: 1,
  title: "Untitled motion",
  templateId: "showcase-stream",
  aspectRatio: "16:9",
  duration: 16,
  // Stable initial IDs keep SSR module evaluation deterministic on Workers.
  slots: createSlots(12, (index) => `initial-${index + 1}`),
  textLayers: [],
  background: { mode: "solid", color: "#000000" },
  // Mirrors the "Showcase Stream" template defaults in lib/motion/registry.
  templateParams: {
    size: 100,
    gap: 45,
    ratio: "Frame",
    radius: 16,
    shadow: 55,
    curve: 55,
    tilt: 45,
    perspective: 60,
    direction: "Right",
  },
  theme: "dark",
});

export const aspectDimensions = (ratio: AspectRatio, baseHeight = 720) => {
  const widths: Record<AspectRatio, number> = {
    "16:9": Math.round((baseHeight * 16) / 9),
    "4:3": Math.round((baseHeight * 4) / 3),
    "1:1": baseHeight,
    "4:5": Math.round((baseHeight * 4) / 5),
    "9:16": Math.round((baseHeight * 9) / 16),
  };
  const even = (value: number) => value - (value % 2);
  return { width: even(widths[ratio]), height: even(baseHeight) };
};

export const cloneProject = (project: EditorProject): EditorProject =>
  editorProjectSchema.parse(structuredClone(project));
