"use client";

import { useRef } from "react";
import { closestCenter, DndContext, type DragEndEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, ImagePlus, Replace, Trash2, Upload } from "lucide-react";
import type { MediaSlot, RuntimeAsset } from "@/lib/editor/model";
import { getRuntimeAssets, useEditorStore } from "@/lib/editor/store";

function SortableSlot({ slot, index, asset }: { slot: MediaSlot; index: number; asset?: RuntimeAsset }) {
  const replaceRef = useRef<HTMLInputElement>(null);
  const replaceSlot = useEditorStore((state) => state.replaceSlot);
  const removeSlotAsset = useEditorStore((state) => state.removeSlotAsset);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: slot.id });
  return (
    <div ref={setNodeRef} className={`media-slot ${isDragging ? "dragging" : ""}`} style={{ transform: CSS.Transform.toString(transform), transition }}>
      <button className="drag-handle" {...attributes} {...listeners} aria-label={`Reorder media ${index + 1}`}><GripVertical size={14} /></button>
      <div className="media-thumb">
        {asset?.type === "video" ? <video src={asset.objectUrl} muted /> : asset ? <img src={asset.objectUrl} alt="" /* eslint-disable-line @next/next/no-img-element */ /> : <ImagePlus size={15} />}
      </div>
      <div className="media-meta"><strong>{asset?.name ?? `Media ${index + 1}`}</strong><span>{asset ? asset.type : "Empty slot"}</span></div>
      <input ref={replaceRef} hidden type="file" accept="image/*,video/*" onChange={(event) => { const file = event.target.files?.[0]; if (file) void replaceSlot(slot.id, file); event.target.value = ""; }} />
      <button className="mini-icon" onClick={() => replaceRef.current?.click()} aria-label={`Replace media ${index + 1}`}><Replace size={13} /></button>
      <button className="mini-icon danger" disabled={!asset} onClick={() => removeSlotAsset(slot.id)} aria-label={`Remove media ${index + 1}`}><Trash2 size={13} /></button>
    </div>
  );
}

export function MediaOrganizer() {
  const fileRef = useRef<HTMLInputElement>(null);
  const project = useEditorStore((state) => state.project);
  useEditorStore((state) => state.assetRevision);
  const assets = getRuntimeAssets();
  const addFiles = useEditorStore((state) => state.addFiles);
  const clearMedia = useEditorStore((state) => state.clearMedia);
  const reorderSlots = useEditorStore((state) => state.reorderSlots);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    if (event.dataTransfer.files.length) void addFiles(event.dataTransfer.files);
  };

  const handleEnd = ({ active, over }: DragEndEvent) => {
    if (over && active.id !== over.id) reorderSlots(String(active.id), String(over.id));
  };

  return (
    <div className="media-organizer">
      <input ref={fileRef} hidden multiple type="file" accept="image/*,video/*" onChange={(event) => { if (event.target.files) void addFiles(event.target.files); event.target.value = ""; }} />
      <button className="dropzone" onClick={() => fileRef.current?.click()} onDragOver={(event) => event.preventDefault()} onDrop={handleDrop}>
        <span className="upload-icon"><Upload size={16} /></span>
        <span><strong>Add images or videos</strong><small>Drop files here · never uploaded</small></span>
      </button>
      <div className="media-list-header"><span>{project.slots.filter((slot) => slot.assetId).length}/{project.slots.length} filled</span><button onClick={clearMedia} disabled={!project.slots.some((slot) => slot.assetId)}>Clear</button></div>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleEnd}>
        <SortableContext items={project.slots.map((slot) => slot.id)} strategy={verticalListSortingStrategy}>
          <div className="media-list">
            {project.slots.map((slot, index) => <SortableSlot key={slot.id} slot={slot} index={index} asset={slot.assetId ? assets.get(slot.assetId) : undefined} />)}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}
