"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronRight, Search } from "lucide-react";
import { createDefaultProject, type RuntimeAsset } from "@/lib/editor/model";
import { loadSampleAssets, sampleMedia } from "@/lib/editor/samples";
import { useEditorStore } from "@/lib/editor/store";
import { categoryCounts, categoryLabels, categoryOrder, templateRegistry } from "@/lib/motion/registry";
import type { MotionTemplate } from "@/lib/motion/types";

const thumbnailProject = createDefaultProject();

/** Thumbnails preview against the bundled demo artwork, not blank placeholders. */
function useSampleAssets() {
  const [assets, setAssets] = useState<ReadonlyMap<string, RuntimeAsset>>(() => new Map());
  useEffect(() => {
    let active = true;
    void loadSampleAssets().then((loaded) => {
      if (active) setAssets(new Map(loaded.map((asset) => [asset.id, asset])));
    });
    return () => { active = false; };
  }, []);
  return assets;
}

function TemplateThumbnail({ template, selected, onSelect, assets }: { template: MotionTemplate; selected: boolean; onSelect: () => void; assets: ReadonlyMap<string, RuntimeAsset> }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cardRef = useRef<HTMLButtonElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = cardRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { rootMargin: "80px" });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!visible) return;
    let animation = 0;
    const started = performance.now();
    const render = (now: number) => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d", { alpha: false });
      if (!canvas || !ctx) return;
      const project = {
        ...thumbnailProject,
        templateId: template.id,
        duration: template.defaultDuration,
        templateParams: template.defaultParams,
        slots: Array.from({ length: template.defaultSlots }, (_, index) => ({
          id: `thumb-${index}`,
          assetId: sampleMedia[index % sampleMedia.length].id,
        })),
      };
      template.render({ ctx, width: canvas.width, height: canvas.height, assets, thumbnail: true }, project, ((now - started) / 1000 / template.defaultDuration) % 1);
      animation = requestAnimationFrame(render);
    };
    animation = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animation);
  }, [assets, template, visible]);

  return (
    <button ref={cardRef} className={`template-card ${selected ? "selected" : ""}`} onClick={onSelect} aria-pressed={selected}>
      <span className="thumbnail-frame">
        <canvas ref={canvasRef} width={180} height={112} />
        {template.isNew && <span className="new-badge">New</span>}
      </span>
      <span className="template-name">{template.name}</span>
    </button>
  );
}

export function TemplatePanel() {
  const selectedId = useEditorStore((state) => state.project.templateId);
  const selectTemplate = useEditorStore((state) => state.selectTemplate);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<Record<string, boolean>>(() => Object.fromEntries(categoryOrder.map((id) => [id, true])));
  const sampleAssets = useSampleAssets();

  return (
    <aside className="template-panel panel-scroll" aria-label="Motion templates">
      <div className="panel-heading sticky-heading">
        <div><span className="eyebrow">Library</span><h2>Templates</h2></div>
        <span className="count-pill">{templateRegistry.length}</span>
      </div>
      <label className="template-search">
        <Search size={14} />
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search templates" aria-label="Search templates" />
      </label>
      <div className="template-groups">
        {categoryOrder.map((category) => {
          const filtered = templateRegistry.filter((template) => template.category === category && template.name.toLowerCase().includes(query.toLowerCase()));
          if (query && filtered.length === 0) return null;
          const expanded = open[category];
          return (
            <section className="template-group" key={category}>
              <button className="group-title" onClick={() => setOpen((value) => ({ ...value, [category]: !expanded }))} aria-expanded={expanded}>
                <span>{expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}{categoryLabels[category]}</span>
                <span>{categoryCounts[category]}</span>
              </button>
              {expanded && (
                <div className="template-grid">
                  {filtered.map((template) => (
                    <TemplateThumbnail key={template.id} template={template} assets={sampleAssets} selected={selectedId === template.id} onSelect={() => selectTemplate(template.id)} />
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </aside>
  );
}

