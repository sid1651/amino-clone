"use client";

import { useEffect, useRef } from "react";
import { Download, Moon, Redo2, Sparkles, Sun, Undo2 } from "lucide-react";
import Link from "next/link";
import { useEditorStore } from "@/lib/editor/store";
import { ExportDialog, UpgradeDialog } from "./ExportDialog";
import { PreviewStage } from "./PreviewStage";
import { SettingsPanel } from "./SettingsPanel";
import { TemplatePanel } from "./TemplatePanel";

type EditorAppProps = { user: { displayName: string; email: string } | null };

export function EditorApp({ user }: EditorAppProps) {
  const themeHydrated = useRef(false);
  const project = useEditorStore((state) => state.project);
  const updateProject = useEditorStore((state) => state.updateProject);
  const canUndo = useEditorStore((state) => state.canUndo);
  const canRedo = useEditorStore((state) => state.canRedo);
  const undo = useEditorStore((state) => state.undo);
  const redo = useEditorStore((state) => state.redo);
  const setPlaying = useEditorStore((state) => state.setPlaying);
  const isPlaying = useEditorStore((state) => state.isPlaying);
  const setPlayhead = useEditorStore((state) => state.setPlayhead);
  const playhead = useEditorStore((state) => state.playhead);
  const setExportOpen = useEditorStore((state) => state.setExportOpen);
  const setUpgradeOpen = useEditorStore((state) => state.setUpgradeOpen);
  const seedSampleMedia = useEditorStore((state) => state.seedSampleMedia);

  useEffect(() => { void seedSampleMedia(); }, [seedSampleMedia]);

  useEffect(() => {
    if (themeHydrated.current) return;
    themeHydrated.current = true;
    const savedTheme = window.localStorage.getItem("lumaloop-theme");
    if ((savedTheme === "dark" || savedTheme === "light") && savedTheme !== project.theme) updateProject((draft) => { draft.theme = savedTheme; }, false);
  }, [project.theme, updateProject]);

  useEffect(() => {
    document.documentElement.dataset.editorTheme = project.theme;
    window.localStorage.setItem("lumaloop-theme", project.theme);
    return () => { delete document.documentElement.dataset.editorTheme; };
  }, [project.theme]);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.matches("input, textarea, select, [contenteditable='true']")) return;
      const command = event.metaKey || event.ctrlKey;
      if (command && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) redo(); else undo();
      } else if (event.code === "Space") {
        event.preventDefault(); setPlaying(!isPlaying);
      } else if (event.key === "Home") {
        event.preventDefault(); setPlayhead(0);
      } else if (event.key === "ArrowLeft") {
        event.preventDefault(); setPlayhead(playhead - 1 / project.duration);
      } else if (event.key === "ArrowRight") {
        event.preventDefault(); setPlayhead(playhead + 1 / project.duration);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isPlaying, playhead, project.duration, redo, setPlaying, setPlayhead, undo]);

  return (
    <div className="editor-app">
      <header className="editor-header">
        <Link className="editor-brand" href="/" aria-label="LumaLoop home"><span className="brand-mark"><Sparkles size={14} /></span><strong>LumaLoop</strong><span className="beta-badge">Beta</span></Link>
        <div className="header-divider" />
        <div className="history-buttons"><button className="icon-button" onClick={undo} disabled={!canUndo} aria-label="Undo"><Undo2 size={15} /></button><button className="icon-button" onClick={redo} disabled={!canRedo} aria-label="Redo"><Redo2 size={15} /></button></div>
        <input className="project-title" value={project.title} onChange={(event) => updateProject((draft) => { draft.title = event.target.value || "Untitled motion"; })} aria-label="Project title" />
        <div className="header-actions">
          <button className="icon-button" onClick={() => updateProject((draft) => { draft.theme = draft.theme === "dark" ? "light" : "dark"; })} aria-label="Toggle editor theme">{project.theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}</button>
          <button className="upgrade-button" onClick={() => setUpgradeOpen(true)}>Upgrade</button>
          <button className="primary-button header-export" onClick={() => setExportOpen(true)}><Download size={14} /> Export</button>
          {user ? <a className="account-avatar" href="/account" title={user.email}>{user.displayName.slice(0, 1).toUpperCase()}</a> : <a className="sign-in-link" href="/signin-with-chatgpt?return_to=%2Feditor">Sign in</a>}
        </div>
      </header>
      <div className="editor-shell"><TemplatePanel /><PreviewStage /><SettingsPanel /></div>
      <ExportDialog />
      <UpgradeDialog />
    </div>
  );
}
