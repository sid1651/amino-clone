import { beforeEach, describe, expect, it } from "vitest";
import { createDefaultProject } from "@/lib/editor/model";
import { useEditorStore } from "@/lib/editor/store";

describe("editor history snapshots", () => {
  beforeEach(() => {
    useEditorStore.setState({
      project: createDefaultProject(),
      history: { past: [], future: [] },
      canUndo: false,
      canRedo: false,
    });
  });

  it("snapshots an Immer draft without throwing DataCloneError", () => {
    expect(() => {
      useEditorStore.getState().updateProject((project) => {
        project.title = "History-safe title";
      });
    }).not.toThrow();
    expect(useEditorStore.getState().history.past).toHaveLength(1);
    expect(useEditorStore.getState().history.past[0].title).toBe("Untitled motion");
  });

  it("uses deterministic IDs for the server-rendered initial project", () => {
    const first = createDefaultProject().slots.map((slot) => slot.id);
    const second = createDefaultProject().slots.map((slot) => slot.id);
    expect(first).toEqual(second);
    expect(first[0]).toBe("slot-initial-1");
  });
});
