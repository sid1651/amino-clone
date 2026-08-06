# LumaLoop architecture

LumaLoop is a browser-first motion showcase editor. The application is split into public, editor, account, and server entitlement surfaces while keeping imported media entirely on-device.

## Vertical slices

1. `app/editor` hosts the fullscreen editor shell, responsive panels, keyboard controls, and export flow.
2. `lib/editor` owns the versioned project model, Zustand/Immer history, Zod validation, and transient object-URL asset store.
3. `lib/motion` owns easing curves, the parameter resolution layer, the 62-item template catalog, and the renderer shared by preview, thumbnails, and export.
4. `components/editor` contains the canvas stage, template browser, settings inspector, transport, media organizer, and dialogs.
5. `lib/export` captures an immutable project snapshot and encodes deterministic frames using WebCodecs with MP4/WebM muxers.
6. `app/api/entitlements` and `db` model signed plan/token entitlements and an append-only ledger. Media is never accepted by server routes.
7. `app/page.tsx` and `app/account` provide the responsive public and account experiences; `components/landing/useLandingMotion` layers GSAP + ScrollTrigger over the marketing page.
8. `public/samples` plus `lib/editor/samples` ship bundled demo artwork that seeds empty slots so every template previews with real imagery.

## Motion model

Templates are presets over one of 23 layout *families*, each a distinct algorithm
in `lib/motion/renderer`. A template declares only the controls its family
actually reads — `resolveParams` turns those into normalised knobs, so every
slider and select in the inspector changes the rendered frame. `tests/registry`
enforces this: it renders each template through a recording canvas and asserts
that every control alters the output and that no two templates animate alike.

## File tree

```text
app/
  account/page.tsx
  api/entitlements/route.ts
  editor/page.tsx
  globals.css
  layout.tsx
  page.tsx
components/
  editor/{EditorApp,PreviewStage,SettingsPanel,TemplatePanel,MediaOrganizer,ExportDialog}.tsx
  landing/{LandingPage.tsx,useLandingMotion.ts}
db/schema.ts
lib/
  editor/{model,store,samples}.ts
  export/exportVideo.ts
  motion/{easings,params,registry,renderer,types}.ts
public/samples/*.svg
tests/
  helpers/stubCanvas.ts
  motion.test.ts
  registry.test.ts
  store.test.ts
```

## Data boundaries

- Serializable project snapshots contain ordered media IDs, never `File` values or pixels.
- A transient browser asset store maps IDs to files, decoded elements, and revocable object URLs.
- Undo/redo snapshots cover all user-editable project fields and never retain deleted blobs.
- Server APIs handle identity, subscriptions, entitlements, and ledger rows only.
