"use client";

import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { current } from "immer";
import { cloneProject, createDefaultProject, createSlots, type EditorProject, type RuntimeAsset } from "./model";
import { isSampleAssetId, loadSampleAssets } from "./samples";
import { disposeRuntimeAsset } from "@/lib/motion/renderer";
import { templateById } from "@/lib/motion/registry";

const HISTORY_LIMIT = 80;

type HistoryState = {
  past: EditorProject[];
  future: EditorProject[];
};

type EditorState = {
  project: EditorProject;
  assetRevision: number;
  history: HistoryState;
  isPlaying: boolean;
  playhead: number;
  exportOpen: boolean;
  upgradeOpen: boolean;
  canUndo: boolean;
  canRedo: boolean;
  updateProject: (recipe: (project: EditorProject) => void, record?: boolean) => void;
  selectTemplate: (templateId: string) => void;
  setSlotCount: (count: number) => void;
  addFiles: (files: FileList | File[], startIndex?: number) => Promise<void>;
  seedSampleMedia: () => Promise<void>;
  replaceSlot: (slotId: string, file: File) => Promise<void>;
  removeSlotAsset: (slotId: string) => void;
  clearMedia: () => void;
  reorderSlots: (activeId: string, overId: string) => void;
  undo: () => void;
  redo: () => void;
  resetSettings: () => void;
  setPlaying: (isPlaying: boolean) => void;
  setPlayhead: (playhead: number) => void;
  setExportOpen: (open: boolean) => void;
  setUpgradeOpen: (open: boolean) => void;
};

const loadSource = (asset: RuntimeAsset) => new Promise<RuntimeAsset>((resolve) => {
  if (asset.type === "video") {
    const video = document.createElement("video");
    video.src = asset.objectUrl;
    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    video.preload = "auto";
    video.addEventListener("loadeddata", () => resolve({ ...asset, source: video }), { once: true });
    video.addEventListener("error", () => resolve(asset), { once: true });
    return;
  }
  const image = new Image();
  image.decoding = "async";
  image.src = asset.objectUrl;
  image.addEventListener("load", () => resolve({ ...asset, source: image }), { once: true });
  image.addEventListener("error", () => resolve(asset), { once: true });
});

const runtimeAssets = new Map<string, RuntimeAsset>();
export const getRuntimeAssets = (): ReadonlyMap<string, RuntimeAsset> => runtimeAssets;

const createAsset = async (file: File): Promise<RuntimeAsset> => {
  const asset: RuntimeAsset = {
    id: crypto.randomUUID(),
    file,
    objectUrl: URL.createObjectURL(file),
    type: file.type.startsWith("video/") ? "video" : "image",
    name: file.name,
    source: null,
  };
  return loadSource(asset);
};

const reconcileAssets = (project: EditorProject) => {
  const used = new Set(project.slots.map((slot) => slot.assetId).filter(Boolean));
  if (project.background.mode === "image" && project.background.assetId) used.add(project.background.assetId);
  for (const [id, asset] of runtimeAssets) {
    // Bundled demo artwork stays resident so slots can be refilled cheaply.
    if (used.has(id) || asset.isSample) continue;
    disposeRuntimeAsset(asset);
    runtimeAssets.delete(id);
  }
};

/** Demo artwork already decoded this session, in catalog order. */
const loadedSamples = () => Array.from(runtimeAssets.values()).filter((asset) => asset.isSample);

export const useEditorStore = create<EditorState>()(immer((set, get) => ({
  project: createDefaultProject(),
  assetRevision: 0,
  history: { past: [], future: [] },
  isPlaying: true,
  playhead: 0,
  exportOpen: false,
  upgradeOpen: false,
  canUndo: false,
  canRedo: false,
  updateProject: (recipe, record = true) => set((state) => {
    if (record) {
      state.history.past.push(cloneProject(current(state.project)));
      if (state.history.past.length > HISTORY_LIMIT) state.history.past.shift();
      state.history.future = [];
    }
    recipe(state.project);
    state.canUndo = state.history.past.length > 0;
    state.canRedo = state.history.future.length > 0;
  }),
  selectTemplate: (templateId) => {
    const template = templateById.get(templateId);
    if (!template) return;
    get().updateProject((project) => {
      project.templateId = templateId;
      project.duration = template.defaultDuration;
      // Replace rather than merge: control ids are shared across families, so
      // carrying values over would silently reinterpret them.
      project.templateParams = { ...template.defaultParams };
      if (project.slots.length < template.defaultSlots) {
        const added = createSlots(template.defaultSlots - project.slots.length);
        const samples = project.slots.some((slot) => isSampleAssetId(slot.assetId)) ? loadedSamples() : [];
        added.forEach((slot, index) => {
          if (samples.length > 0) slot.assetId = samples[(project.slots.length + index) % samples.length].id;
        });
        project.slots.push(...added);
      }
      if (project.slots.length > template.maxSlots) project.slots.splice(template.maxSlots);
    });
  },
  setSlotCount: (count) => set((state) => {
    const template = templateById.get(state.project.templateId);
    const next = Math.max(template?.minSlots ?? 1, Math.min(template?.maxSlots ?? 24, count));
    state.history.past.push(cloneProject(current(state.project)));
    state.history.future = [];
    if (next > state.project.slots.length) {
      const added = createSlots(next - state.project.slots.length);
      // Keep new slots consistent with a project that is still showing demo art.
      const samples = state.project.slots.some((slot) => isSampleAssetId(slot.assetId)) ? loadedSamples() : [];
      added.forEach((slot, index) => {
        if (samples.length > 0) slot.assetId = samples[(state.project.slots.length + index) % samples.length].id;
      });
      state.project.slots.push(...added);
    } else state.project.slots.splice(next);
    reconcileAssets(state.project);
    state.assetRevision += 1;
    state.canUndo = true;
    state.canRedo = false;
  }),
  addFiles: async (fileInput, startIndex = 0) => {
    const files = Array.from(fileInput).filter((file) => file.type.startsWith("image/") || file.type.startsWith("video/"));
    const assets = await Promise.all(files.map(createAsset));
    set((state) => {
      state.history.past.push(cloneProject(current(state.project)));
      state.history.future = [];
      assets.forEach((asset, fileIndex) => {
        runtimeAssets.set(asset.id, asset);
        const slotIndex = startIndex + fileIndex;
        if (!state.project.slots[slotIndex]) state.project.slots.push(...createSlots(slotIndex - state.project.slots.length + 1));
        const oldAssetId = state.project.slots[slotIndex]?.assetId;
        if (state.project.slots[slotIndex]) state.project.slots[slotIndex].assetId = asset.id;
        if (oldAssetId) {
          const old = runtimeAssets.get(oldAssetId);
          if (old) {
            disposeRuntimeAsset(old);
            runtimeAssets.delete(oldAssetId);
          }
        }
      });
      state.canUndo = true;
      state.canRedo = false;
      state.assetRevision += 1;
    });
  },
  seedSampleMedia: async () => {
    const samples = await loadSampleAssets();
    if (samples.length === 0) return;
    for (const sample of samples) runtimeAssets.set(sample.id, sample);
    set((state) => {
      // Only fills empty slots, so it never overwrites the user's own media.
      state.project.slots.forEach((slot, index) => {
        if (!slot.assetId) slot.assetId = samples[index % samples.length].id;
      });
      state.assetRevision += 1;
    });
  },
  replaceSlot: async (slotId, file) => {
    const asset = await createAsset(file);
    set((state) => {
      const slot = state.project.slots.find((item) => item.id === slotId);
      if (!slot) {
        disposeRuntimeAsset(asset);
        return;
      }
      state.history.past.push(cloneProject(current(state.project)));
      state.history.future = [];
      const oldAsset = slot.assetId ? runtimeAssets.get(slot.assetId) : undefined;
      if (oldAsset) disposeRuntimeAsset(oldAsset);
      if (slot.assetId) runtimeAssets.delete(slot.assetId);
      runtimeAssets.set(asset.id, asset);
      slot.assetId = asset.id;
      state.canUndo = true;
      state.canRedo = false;
      state.assetRevision += 1;
    });
  },
  removeSlotAsset: (slotId) => set((state) => {
    const slot = state.project.slots.find((item) => item.id === slotId);
    if (!slot?.assetId) return;
    state.history.past.push(cloneProject(current(state.project)));
    state.history.future = [];
    const asset = runtimeAssets.get(slot.assetId);
    if (asset) disposeRuntimeAsset(asset);
    runtimeAssets.delete(slot.assetId);
    slot.assetId = null;
    state.canUndo = true;
    state.canRedo = false;
    state.assetRevision += 1;
  }),
  clearMedia: () => set((state) => {
    state.history.past.push(cloneProject(current(state.project)));
    state.history.future = [];
    for (const asset of runtimeAssets.values()) disposeRuntimeAsset(asset);
    runtimeAssets.clear();
    state.project.slots.forEach((slot) => { slot.assetId = null; });
    state.canUndo = true;
    state.canRedo = false;
    state.assetRevision += 1;
  }),
  reorderSlots: (activeId, overId) => set((state) => {
    const from = state.project.slots.findIndex((slot) => slot.id === activeId);
    const to = state.project.slots.findIndex((slot) => slot.id === overId);
    if (from < 0 || to < 0 || from === to) return;
    state.history.past.push(cloneProject(current(state.project)));
    state.history.future = [];
    const [slot] = state.project.slots.splice(from, 1);
    state.project.slots.splice(to, 0, slot);
    state.canUndo = true;
    state.canRedo = false;
  }),
  undo: () => set((state) => {
    const previous = state.history.past.pop();
    if (!previous) return;
    state.history.future.unshift(cloneProject(current(state.project)));
    state.project = previous;
    reconcileAssets(state.project);
    state.assetRevision += 1;
    state.canUndo = state.history.past.length > 0;
    state.canRedo = true;
  }),
  redo: () => set((state) => {
    const next = state.history.future.shift();
    if (!next) return;
    state.history.past.push(cloneProject(current(state.project)));
    state.project = next;
    reconcileAssets(state.project);
    state.assetRevision += 1;
    state.canUndo = true;
    state.canRedo = state.history.future.length > 0;
  }),
  resetSettings: () => {
    const template = templateById.get(get().project.templateId);
    if (!template) return;
    get().updateProject((project) => {
      project.templateParams = { ...template.defaultParams };
      project.background = { mode: "solid", color: "#000000" };
      project.duration = template.defaultDuration;
    });
  },
  setPlaying: (isPlaying) => set((state) => { state.isPlaying = isPlaying; }),
  setPlayhead: (playhead) => set((state) => { state.playhead = cyclicPlayhead(playhead); }),
  setExportOpen: (open) => set((state) => { state.exportOpen = open; }),
  setUpgradeOpen: (open) => set((state) => { state.upgradeOpen = open; }),
})));

const cyclicPlayhead = (value: number) => ((value % 1) + 1) % 1;
