"use client";

import { useEffect, useMemo, useRef } from "react";
import { Pause, Play, RotateCcw } from "lucide-react";
import { aspectDimensions } from "@/lib/editor/model";
import { getRuntimeAssets, useEditorStore } from "@/lib/editor/store";
import { templateById } from "@/lib/motion/registry";

const formatTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const tenths = Math.floor((seconds % 1) * 10);
  return `${mins}:${secs.toString().padStart(2, "0")}.${tenths}`;
};

export function PreviewStage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const project = useEditorStore((state) => state.project);
  const assetRevision = useEditorStore((state) => state.assetRevision);
  const assets = getRuntimeAssets();
  const isPlaying = useEditorStore((state) => state.isPlaying);
  const playhead = useEditorStore((state) => state.playhead);
  const setPlaying = useEditorStore((state) => state.setPlaying);
  const setPlayhead = useEditorStore((state) => state.setPlayhead);
  const livePlayhead = useRef(playhead);
  const previousTime = useRef<number | null>(null);
  const lastStoreUpdate = useRef(0);
  const dimensions = useMemo(() => aspectDimensions(project.aspectRatio, 720), [project.aspectRatio]);

  useEffect(() => { livePlayhead.current = playhead; }, [playhead]);

  useEffect(() => {
    for (const asset of assets.values()) {
      if (!(asset.source instanceof HTMLVideoElement)) continue;
      if (isPlaying) void asset.source.play().catch(() => undefined);
      else asset.source.pause();
    }
  }, [assetRevision, assets, isPlaying]);

  useEffect(() => {
    let frame = 0;
    const render = (now: number) => {
      const canvas = canvasRef.current;
      const template = templateById.get(project.templateId);
      if (!canvas || !template) return;
      const ctx = canvas.getContext("2d", { alpha: false });
      if (!ctx) return;
      if (isPlaying && previousTime.current !== null) {
        livePlayhead.current = (livePlayhead.current + (now - previousTime.current) / 1000 / project.duration) % 1;
      }
      previousTime.current = now;
      template.render({ ctx, width: canvas.width, height: canvas.height, assets }, project, livePlayhead.current);
      if (isPlaying && now - lastStoreUpdate.current > 50) {
        lastStoreUpdate.current = now;
        setPlayhead(livePlayhead.current);
      }
      frame = requestAnimationFrame(render);
    };
    frame = requestAnimationFrame(render);
    return () => {
      cancelAnimationFrame(frame);
      previousTime.current = null;
    };
  }, [assetRevision, assets, isPlaying, project, setPlayhead]);

  const handleScrub = (value: number) => {
    livePlayhead.current = value;
    setPlayhead(value);
  };

  return (
    <main className="preview-column" aria-label="Live preview">
      <div className="workspace-grid">
        <div className="canvas-wrap">
          <canvas
            ref={canvasRef}
            width={Math.min(dimensions.width, 1280)}
            height={Math.min(dimensions.height, 720)}
            aria-label={`${templateById.get(project.templateId)?.name ?? "Motion"} animation preview`}
          />
          <div className="preview-chip">{project.aspectRatio}</div>
        </div>
      </div>
      <div className="transport">
        <button className="icon-button transport-button" onClick={() => setPlaying(!isPlaying)} aria-label={isPlaying ? "Pause preview" : "Play preview"}>
          {isPlaying ? <Pause size={15} fill="currentColor" /> : <Play size={15} fill="currentColor" />}
        </button>
        <button className="icon-button" onClick={() => handleScrub(0)} aria-label="Restart preview"><RotateCcw size={15} /></button>
        <span className="timecode">{formatTime(playhead * project.duration)}</span>
        <input
          className="timeline-range"
          type="range"
          min={0}
          max={1000}
          value={Math.round(playhead * 1000)}
          onChange={(event) => handleScrub(Number(event.target.value) / 1000)}
          aria-label="Animation playhead"
          style={{ "--range-progress": `${playhead * 100}%` } as React.CSSProperties}
        />
        <span className="timecode dim">{formatTime(project.duration)}</span>
      </div>
    </main>
  );
}
