import type { RuntimeAsset } from "./model";

/**
 * Bundled demo artwork. These seed empty slots so every template previews with
 * real imagery instead of numbered placeholders; the user's own uploads replace
 * them slot by slot.
 */
export const sampleMedia = [
  { id: "sample-bloom", name: "Bloom", url: "/samples/bloom.svg" },
  { id: "sample-barcelona", name: "Barcelona", url: "/samples/barcelona.svg" },
  { id: "sample-meadow", name: "Meadow", url: "/samples/meadow.svg" },
  { id: "sample-taste", name: "Ultimate Taste", url: "/samples/taste.svg" },
  { id: "sample-north-ave", name: "North Ave", url: "/samples/north-ave.svg" },
  { id: "sample-portrait", name: "Portrait", url: "/samples/portrait.svg" },
  { id: "sample-nov", name: "Nov 2026", url: "/samples/nov.svg" },
  { id: "sample-maple", name: "Maple Street", url: "/samples/maple.svg" },
  { id: "sample-index", name: "Index", url: "/samples/index-card.svg" },
  { id: "sample-dune", name: "Dune", url: "/samples/dune.svg" },
] as const;

export const isSampleAssetId = (assetId: string | null | undefined) =>
  Boolean(assetId && assetId.startsWith("sample-"));

const decode = (url: string) => new Promise<HTMLImageElement | null>((resolve) => {
  const image = new Image();
  image.decoding = "async";
  image.addEventListener("load", () => resolve(image), { once: true });
  image.addEventListener("error", () => resolve(null), { once: true });
  image.src = url;
});

let pending: Promise<RuntimeAsset[]> | null = null;

/** Decodes the bundled artwork once per session. */
export const loadSampleAssets = (): Promise<RuntimeAsset[]> => {
  if (typeof window === "undefined") return Promise.resolve([]);
  pending ??= Promise.all(
    sampleMedia.map(async (sample) => {
      const source = await decode(sample.url);
      return {
        id: sample.id,
        file: null,
        objectUrl: sample.url,
        type: "image" as const,
        name: sample.name,
        source,
        isSample: true as const,
      } satisfies RuntimeAsset;
    }),
  ).then((assets) => assets.filter((asset) => asset.source !== null));
  return pending;
};
