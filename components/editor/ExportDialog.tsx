"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Download, Film, LockKeyhole, ShieldCheck, X } from "lucide-react";
import { getRuntimeAssets, useEditorStore } from "@/lib/editor/store";
import { templateById } from "@/lib/motion/registry";
import { downloadBlob, estimateExport, exportProjectVideo, type ExportOptions, type ExportResolution } from "@/lib/export/exportVideo";

const resolutions: ExportResolution[] = ["720p", "1080p", "2K", "4K", "8K"];
const formatBytes = (value: number) => value > 1_000_000_000 ? `${(value / 1_000_000_000).toFixed(1)} GB` : `${Math.ceil(value / 1_000_000)} MB`;

export function ExportDialog({ plan = "free", tokens = 0 }: { plan?: "free" | "pro"; tokens?: number }) {
  const open = useEditorStore((state) => state.exportOpen);
  const setOpen = useEditorStore((state) => state.setExportOpen);
  const setUpgradeOpen = useEditorStore((state) => state.setUpgradeOpen);
  const project = useEditorStore((state) => state.project);
  useEditorStore((state) => state.assetRevision);
  const assets = getRuntimeAssets();
  const [options, setOptions] = useState<ExportOptions>({ format: "mp4", resolution: "720p", fps: 30, loops: 1 });
  const [status, setStatus] = useState<"idle" | "exporting" | "success" | "error">("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const abortRef = useRef<AbortController | null>(null);
  const estimate = useMemo(() => estimateExport(project, options), [project, options]);
  const template = templateById.get(project.templateId);
  const filled = project.slots.filter((slot) => slot.assetId).length;
  const missingRequired = filled < (template?.minSlots ?? 1);
  // All exports are unlocked in this build — no purchase required.
  const locked = false;

  useEffect(() => {
    if (!open) return;
    const handleKey = (event: KeyboardEvent) => { if (event.key === "Escape" && status !== "exporting") setOpen(false); };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, setOpen, status]);

  const startExport = async () => {
    if (locked) { setOpen(false); setUpgradeOpen(true); return; }
    if (missingRequired) return;
    const abort = new AbortController();
    abortRef.current = abort;
    setStatus("exporting");
    setProgress(0);
    setError("");
    try {
      const blob = await exportProjectVideo(project, assets, options, setProgress, abort.signal);
      const extension = options.format;
      downloadBlob(blob, `${project.title.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "lumaloop"}.${extension}`);
      setStatus("success");
    } catch (reason) {
      if (reason instanceof DOMException && reason.name === "AbortError") setStatus("idle");
      else {
        setError(reason instanceof Error ? reason.message : "Export failed on this device.");
        setStatus("error");
      }
    } finally {
      abortRef.current = null;
    }
  };

  if (!open) return null;
  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target && status !== "exporting") setOpen(false); }}>
      <div className="export-dialog" role="dialog" aria-modal="true" aria-labelledby="export-title">
        <div className="dialog-header">
          <div><span className="eyebrow">Render & download</span><h2 id="export-title">Export your loop</h2></div>
          <button className="icon-button" onClick={() => setOpen(false)} disabled={status === "exporting"} aria-label="Close export"><X size={18} /></button>
        </div>
        {status === "success" ? (
          <div className="export-success">
            <div className="success-icon"><Check size={26} /></div>
            <h3>Your loop is ready</h3>
            <p>The file was downloaded to your device. Your source media never left this browser.</p>
            <button className="primary-button" onClick={() => setStatus("idle")}>Export another</button>
          </div>
        ) : (
          <div className="dialog-body">
            <section className="export-options">
              <div className="option-group"><label>Format</label><div className="format-cards"><button className={options.format === "mp4" ? "active" : ""} onClick={() => setOptions((value) => ({ ...value, format: "mp4" }))}><Film size={16} /><span><strong>MP4</strong><small>H.264 · universal</small></span></button><button className={options.format === "webm" ? "active" : ""} onClick={() => setOptions((value) => ({ ...value, format: "webm" }))}><Film size={16} /><span><strong>WebM</strong><small>VP9 · compact</small></span></button></div></div>
              <div className="option-group"><label>Resolution</label><div className="resolution-grid">{resolutions.map((resolution) => { return <button key={resolution} className={options.resolution === resolution ? "active" : ""} onClick={() => setOptions((value) => ({ ...value, resolution }))}><span>{resolution}</span><small>{resolution === "720p" ? "Free" : "HD"}</small></button>; })}</div></div>
              <div className="export-row"><div className="option-group"><label>Frame rate</label><div className="segmented"><button className={options.fps === 30 ? "active" : ""} onClick={() => setOptions((value) => ({ ...value, fps: 30 }))}>30 fps</button><button className={options.fps === 60 ? "active" : ""} onClick={() => setOptions((value) => ({ ...value, fps: 60 }))}>60 fps</button></div></div><div className="option-group"><label>Loops</label><select className="field" value={options.loops} onChange={(event) => setOptions((value) => ({ ...value, loops: Number(event.target.value) as ExportOptions["loops"] }))}>{[1, 2, 3, 4].map((loops) => <option value={loops} key={loops}>{loops}×</option>)}</select></div></div>
              {missingRequired && <div className="export-warning">Add at least {template?.minSlots ?? 1} media items before exporting. Empty slots remain visible as numbered samples.</div>}
              {error && <div className="export-error">{error}</div>}
            </section>
            <aside className="export-summary">
              <div className="summary-art"><div className="summary-loop"><span>{project.title}</span></div></div>
              <dl><div><dt>Dimensions</dt><dd>{estimate.width} × {estimate.height}</dd></div><div><dt>Duration</dt><dd>{estimate.duration}s</dd></div><div><dt>Frames</dt><dd>{estimate.frames.toLocaleString()}</dd></div><div><dt>Bitrate</dt><dd>{Math.round(estimate.bitrate / 1_000_000)} Mbps</dd></div><div><dt>Max. file size</dt><dd>≈ {formatBytes(estimate.maxBytes)}</dd></div></dl>
              <div className="privacy-note"><ShieldCheck size={15} /><span>Rendered locally. No media upload.</span></div>
            </aside>
          </div>
        )}
        {status !== "success" && <div className="dialog-footer">{status === "exporting" ? <><div className="export-progress"><span><strong>Rendering frame by frame</strong><small>{Math.round(progress * 100)}%</small></span><div><i style={{ width: `${progress * 100}%` }} /></div></div><button className="secondary-button" onClick={() => abortRef.current?.abort()}>Cancel</button></> : <><span className="entitlement-note">All exports unlocked</span><button className="primary-button export-action" disabled={missingRequired} onClick={() => void startExport()}><><Download size={14} /> Export {options.format.toUpperCase()}</></button></>}</div>}
      </div>
    </div>
  );
}

export function UpgradeDialog() {
  const open = useEditorStore((state) => state.upgradeOpen);
  const setOpen = useEditorStore((state) => state.setUpgradeOpen);
  if (!open) return null;
  return (
    null
  );
}
