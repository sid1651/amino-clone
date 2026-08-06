"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Minus, Plus, RotateCcw, Trash2 } from "lucide-react";
import { aspectRatios } from "@/lib/editor/model";
import { useEditorStore } from "@/lib/editor/store";
import { templateById } from "@/lib/motion/registry";
import type { ControlSchema } from "@/lib/motion/types";
import { MediaOrganizer } from "./MediaOrganizer";

/** Controls that frame the card itself rather than the motion. */
const frameControlIds = new Set(["size", "gap", "ratio", "radius", "shadow"]);

function InspectorSection({ title, summary, children, defaultOpen = true }: { title: string; summary?: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="inspector-section">
      <button className="inspector-title" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span>{open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}{title}</span>{summary && <small>{summary}</small>}
      </button>
      {open && <div className="inspector-content">{children}</div>}
    </section>
  );
}

function RangeRow({ label, value, min, max, step = 1, onChange, suffix = "" }: { label: string; value: number; min: number; max: number; step?: number; onChange: (value: number) => void; suffix?: string }) {
  return (
    <label className="control-row range-row">
      <span>{label}<output>{value}{suffix}</output></span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} style={{ "--range-progress": `${((value - min) / (max - min)) * 100}%` } as React.CSSProperties} />
    </label>
  );
}

function SelectRow({ label, value, options, onChange }: { label: string; value: string; options: readonly string[]; onChange: (value: string) => void }) {
  return (
    <label className="select-control">
      <span>{label}</span>
      <select className="field" value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
    </label>
  );
}

/**
 * Every inspector control is generated from the active template's schema, so a
 * control only appears when the renderer reads it.
 */
function TemplateControl({ control }: { control: ControlSchema }) {
  const value = useEditorStore((state) => state.project.templateParams[control.id]);
  const updateProject = useEditorStore((state) => state.updateProject);
  const set = (next: string | number) => updateProject((draft) => { draft.templateParams[control.id] = next; });

  if (control.type === "select") {
    const options = control.options ?? [];
    const current = typeof value === "string" && options.includes(value) ? value : String(control.defaultValue);
    return <SelectRow label={control.label} value={current} options={options} onChange={set} />;
  }

  const numeric = Number(value);
  const min = control.min ?? 0;
  const max = control.max ?? 100;
  return (
    <RangeRow
      label={control.label}
      value={Number.isFinite(numeric) ? numeric : Number(control.defaultValue)}
      min={min}
      max={max}
      step={control.step ?? 1}
      suffix={control.suffix ?? ""}
      onChange={set}
    />
  );
}

export function SettingsPanel() {
  const project = useEditorStore((state) => state.project);
  const updateProject = useEditorStore((state) => state.updateProject);
  const setSlotCount = useEditorStore((state) => state.setSlotCount);
  const resetSettings = useEditorStore((state) => state.resetSettings);
  const template = templateById.get(project.templateId);
  const frameControls = (template?.controls ?? []).filter((control) => frameControlIds.has(control.id));
  const motionControls = (template?.controls ?? []).filter((control) => !frameControlIds.has(control.id));

  const addText = () => updateProject((draft) => {
    draft.textLayers.push({
      id: crypto.randomUUID(), text: "Your message", font: "Geist", weight: 700, size: 54, color: "#ffffff", align: "center", opacity: 1, x: 0.5, y: 0.5, rotation: 0,
    });
  });

  return (
    <aside className="settings-panel panel-scroll" aria-label="Project settings">
      <div className="panel-heading sticky-heading"><div><span className="eyebrow">Inspector</span><h2>Customize</h2></div></div>
      <InspectorSection title="Frame" summary={project.aspectRatio}>
        <div className="segmented ratios">
          {aspectRatios.map((ratio) => <button key={ratio} className={project.aspectRatio === ratio ? "active" : ""} onClick={() => updateProject((draft) => { draft.aspectRatio = ratio; })}>{ratio}</button>)}
        </div>
      </InspectorSection>
      <InspectorSection title="Media slots" summary={`${project.slots.length} items`}>
        <div className="stepper-row">
          <span>Number of slots</span>
          <div className="number-stepper"><button onClick={() => setSlotCount(project.slots.length - 1)}><Minus size={13} /></button><strong>{project.slots.length}</strong><button onClick={() => setSlotCount(project.slots.length + 1)}><Plus size={13} /></button></div>
        </div>
        <MediaOrganizer />
      </InspectorSection>
      <InspectorSection title="Timing" summary={`${project.duration}s`}>
        <RangeRow label="Duration" value={project.duration} min={2} max={40} step={0.5} suffix="s" onChange={(value) => updateProject((draft) => { draft.duration = value; })} />
        <div className="quick-values">{[5, 10, 15, 20, 30].map((value) => <button key={value} onClick={() => updateProject((draft) => { draft.duration = value; })}>{value}s</button>)}</div>
      </InspectorSection>
      <InspectorSection title="Text layers" summary={`${project.textLayers.length}`} defaultOpen={false}>
        <button className="secondary-button full" onClick={addText}><Plus size={14} /> Add text layer</button>
        {project.textLayers.map((layer, index) => (
          <div className="text-layer-card" key={layer.id}>
            <div className="text-layer-title"><strong>Text {index + 1}</strong><button onClick={() => updateProject((draft) => { draft.textLayers = draft.textLayers.filter((item) => item.id !== layer.id); })}><Trash2 size={13} /></button></div>
            <input className="field" value={layer.text} onChange={(event) => updateProject((draft) => { const current = draft.textLayers.find((item) => item.id === layer.id); if (current) current.text = event.target.value; })} />
            <div className="inline-fields"><select className="field" value={layer.weight} onChange={(event) => updateProject((draft) => { const current = draft.textLayers.find((item) => item.id === layer.id); if (current) current.weight = Number(event.target.value); })}><option value="400">Regular</option><option value="600">Semibold</option><option value="700">Bold</option><option value="800">Extra bold</option></select><input className="field color-field" type="color" value={layer.color} onChange={(event) => updateProject((draft) => { const current = draft.textLayers.find((item) => item.id === layer.id); if (current) current.color = event.target.value; })} /></div>
            <RangeRow label="Size" value={layer.size} min={8} max={180} onChange={(value) => updateProject((draft) => { const current = draft.textLayers.find((item) => item.id === layer.id); if (current) current.size = value; })} suffix="px" />
            <RangeRow label="X position" value={Math.round(layer.x * 100)} min={0} max={100} onChange={(value) => updateProject((draft) => { const current = draft.textLayers.find((item) => item.id === layer.id); if (current) current.x = value / 100; })} suffix="%" />
            <RangeRow label="Y position" value={Math.round(layer.y * 100)} min={0} max={100} onChange={(value) => updateProject((draft) => { const current = draft.textLayers.find((item) => item.id === layer.id); if (current) current.y = value / 100; })} suffix="%" />
          </div>
        ))}
      </InspectorSection>
      <InspectorSection title="Background">
        <div className="segmented"><button className={project.background.mode === "solid" ? "active" : ""} onClick={() => updateProject((draft) => { draft.background = { mode: "solid", color: draft.background.color }; })}>Solid</button><button className={project.background.mode === "gradient" ? "active" : ""} onClick={() => updateProject((draft) => { draft.background = { mode: "gradient", color: draft.background.color, color2: "#4f46e5", angle: 135 }; })}>Gradient</button></div>
        <div className="color-controls"><label>Primary <input type="color" value={project.background.color} onChange={(event) => updateProject((draft) => { draft.background.color = event.target.value; })} /></label>{project.background.mode === "gradient" && <label>Secondary <input type="color" value={project.background.color2} onChange={(event) => updateProject((draft) => { if (draft.background.mode === "gradient") draft.background.color2 = event.target.value; })} /></label>}</div>
      </InspectorSection>
      <InspectorSection title="Card style" summary={String(project.templateParams.ratio ?? "Frame")}>
        {frameControls.map((control) => <TemplateControl key={control.id} control={control} />)}
      </InspectorSection>
      <InspectorSection title="Motion" summary={template?.name}>
        {template && <p className="inspector-note">{template.description}</p>}
        {motionControls.map((control) => <TemplateControl key={control.id} control={control} />)}
      </InspectorSection>
      <div className="reset-wrap"><button className="secondary-button full" onClick={resetSettings}><RotateCcw size={14} /> Reset settings</button></div>
    </aside>
  );
}

