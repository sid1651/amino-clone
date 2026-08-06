import type { EditorProject, RuntimeAsset } from "@/lib/editor/model";
import {
  TAU,
  backgroundRgb,
  cardBox,
  clamp,
  clamp01,
  cyclic,
  mix,
  phase,
  resolveParams,
  rgba,
  triangle,
  type ResolvedParams,
} from "./params";
import type { FamilyId, RenderContext } from "./types";

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

const seededHue = (seed: number) => (seed * 67 + 218) % 360;
const seededNoise = (seed: number) => Math.sin((seed + 1) * 992.31);

type Canvas2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

const roundedRect = (ctx: Canvas2D, x: number, y: number, width: number, height: number, radius: number) => {
  const r = Math.max(0, Math.min(radius, width / 2, height / 2));
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, r);
};

const coverMedia = (ctx: Canvas2D, source: CanvasImageSource, x: number, y: number, width: number, height: number, zoom = 1, panX = 0, panY = 0) => {
  const sourceWidth = Number("videoWidth" in source ? source.videoWidth : "naturalWidth" in source ? source.naturalWidth : "displayWidth" in source ? source.displayWidth : "width" in source && typeof source.width === "number" ? source.width : 0);
  const sourceHeight = Number("videoHeight" in source ? source.videoHeight : "naturalHeight" in source ? source.naturalHeight : "displayHeight" in source ? source.displayHeight : "height" in source && typeof source.height === "number" ? source.height : 0);
  if (!sourceWidth || !sourceHeight) return;
  const scale = Math.max(width / sourceWidth, height / sourceHeight) * zoom;
  const drawWidth = sourceWidth * scale;
  const drawHeight = sourceHeight * scale;
  const slackX = (drawWidth - width) / 2;
  const slackY = (drawHeight - height) / 2;
  ctx.drawImage(source, x - slackX + panX * slackX, y - slackY + panY * slackY, drawWidth, drawHeight);
};

export type Scene = {
  context: RenderContext;
  ctx: Canvas2D;
  project: EditorProject;
  p: ResolvedParams;
  /** Loop position, already normalised to 0–1. */
  t: number;
  width: number;
  height: number;
  count: number;
};

type CardOptions = {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  opacity?: number;
  /** Horizontal squash, used to fake a Y-axis flip. */
  flip?: number;
  /** Vertical skew in radians, used by the isometric family. */
  skew?: number;
  /** 0–1 black overlay, for depth dimming. */
  dim?: number;
  /** Media zoom/pan for Ken Burns style motion. */
  zoom?: number;
  panX?: number;
  panY?: number;
  /** Suppresses drop shadows — used for mirrored reflections. */
  flat?: boolean;
};

const drawCard = (scene: Scene, index: number, options: CardOptions) => {
  const { ctx, project, p, context } = scene;
  const { x, y, rotation = 0, opacity = 1, flip = 1, skew = 0, dim = 0, zoom = 1, panX = 0, panY = 0, flat = false } = options;
  const width = options.width * Math.abs(flip);
  const height = options.height;
  if (!Number.isFinite(x) || !Number.isFinite(y) || width < 0.8 || height < 0.8 || opacity <= 0.004) return;

  const inherited = ctx.globalAlpha;
  const radius = Math.min(width, height) * (p.radius / 100);
  ctx.save();
  ctx.globalAlpha = clamp01(inherited * opacity);
  ctx.translate(x, y);
  if (rotation) ctx.rotate(rotation);
  // A negative flip mirrors the card content, not just its box.
  if (flip < 0) ctx.scale(-1, 1);
  if (skew) ctx.transform(1, skew, 0, 1, 0, 0);

  if (!context.thumbnail && !flat && p.shadow > 0.01) {
    ctx.shadowColor = `rgba(0,0,0,${0.55 * p.shadow})`;
    ctx.shadowBlur = Math.min(width, height) * 0.18 * p.shadow;
    ctx.shadowOffsetY = Math.min(width, height) * 0.07 * p.shadow;
  }

  const slot = project.slots[index % Math.max(1, project.slots.length)];
  const asset = slot?.assetId ? context.assets.get(slot.assetId) : undefined;
  const media = asset?.source ?? null;

  // The card body doubles as the shadow caster. With media it is a neutral
  // plate the image covers completely — no tint is ever laid over artwork.
  roundedRect(ctx, -width / 2, -height / 2, width, height, radius);
  if (media) {
    ctx.fillStyle = "#0c0c0e";
  } else {
    const hue = seededHue(index);
    const gradient = ctx.createLinearGradient(-width / 2, -height / 2, width / 2, height / 2);
    gradient.addColorStop(0, `hsl(${hue} 78% 68%)`);
    gradient.addColorStop(0.55, `hsl(${(hue + 45) % 360} 70% 48%)`);
    gradient.addColorStop(1, `hsl(${(hue + 100) % 360} 70% 28%)`);
    ctx.fillStyle = gradient;
  }
  ctx.fill();
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  if (media) {
    ctx.save();
    roundedRect(ctx, -width / 2, -height / 2, width, height, radius);
    ctx.clip();
    coverMedia(ctx, media, -width / 2, -height / 2, width, height, zoom, panX, panY);
    ctx.restore();
  } else {
    ctx.fillStyle = "rgba(255,255,255,.84)";
    ctx.font = `700 ${Math.max(8, height * 0.11)}px ui-sans-serif, system-ui`;
    ctx.textAlign = "left";
    ctx.textBaseline = "bottom";
    ctx.fillText(String(index + 1).padStart(2, "0"), -width * 0.38, height * 0.36);
    ctx.fillStyle = "rgba(255,255,255,.28)";
    ctx.fillRect(-width * 0.38, -height * 0.32, width * 0.44, Math.max(2, height * 0.035));
    ctx.fillRect(-width * 0.38, -height * 0.22, width * 0.27, Math.max(2, height * 0.035));
  }

  if (dim > 0.004) {
    roundedRect(ctx, -width / 2, -height / 2, width, height, radius);
    ctx.fillStyle = `rgba(0,0,0,${clamp01(dim)})`;
    ctx.fill();
  }

  // Placeholder cards keep a rim for separation; real artwork is left clean.
  if (!media) {
    ctx.strokeStyle = "rgba(255,255,255,.26)";
    ctx.lineWidth = Math.max(1, width * 0.006);
    roundedRect(ctx, -width / 2, -height / 2, width, height, radius);
    ctx.stroke();
  }
  ctx.restore();
};

/**
 * Draws the scene twice: once mirrored below `floorY` at reduced opacity, then
 * a background-coloured gradient to sink the reflection into the floor, then
 * the real pass. Strength 0 skips the mirrored pass entirely.
 */
const withReflection = (scene: Scene, floorY: number, strength: number, draw: (mirrored: boolean) => void) => {
  const { ctx, project, height, width } = scene;
  if (strength > 0.02 && floorY < height) {
    ctx.save();
    ctx.globalAlpha = 0.34 + strength * 0.36;
    ctx.beginPath();
    ctx.rect(0, floorY, width, height - floorY);
    ctx.clip();
    ctx.translate(0, floorY * 2);
    ctx.scale(1, -1);
    draw(true);
    ctx.restore();

    const fade = ctx.createLinearGradient(0, floorY, 0, mix(floorY, height, 0.55 + (1 - strength) * 0.4));
    const floorColor = backgroundRgb(project, 0.8);
    fade.addColorStop(0, rgba(floorColor, 0.15));
    fade.addColorStop(1, rgba(floorColor, 1));
    ctx.fillStyle = fade;
    ctx.fillRect(0, floorY, width, height - floorY);
  }
  draw(false);
};

const paintBackground = (scene: Scene) => {
  const { ctx, project, width, height } = scene;
  const background = project.background;
  if (background.mode === "solid") {
    ctx.fillStyle = background.color;
    ctx.fillRect(0, 0, width, height);
    return;
  }
  if (background.mode === "image" && background.assetId) {
    const asset = scene.context.assets.get(background.assetId);
    if (asset?.source) {
      coverMedia(ctx, asset.source, 0, 0, width, height);
      ctx.fillStyle = "rgba(0,0,0,.18)";
      ctx.fillRect(0, 0, width, height);
      return;
    }
  }
  const color2 = background.mode === "gradient" ? background.color2 : "#2e1065";
  const angle = background.mode === "gradient" ? (background.angle * Math.PI) / 180 : Math.PI * 0.75;
  const dx = Math.cos(angle) * width;
  const dy = Math.sin(angle) * height;
  const gradient = ctx.createLinearGradient(width / 2 - dx / 2, height / 2 - dy / 2, width / 2 + dx / 2, height / 2 + dy / 2);
  gradient.addColorStop(0, background.color);
  gradient.addColorStop(1, color2);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
};

const renderText = (scene: Scene) => {
  const { ctx, project, width, height } = scene;
  for (const layer of project.textLayers) {
    ctx.save();
    ctx.globalAlpha = layer.opacity;
    ctx.translate(layer.x * width, layer.y * height);
    ctx.rotate((layer.rotation * Math.PI) / 180);
    ctx.fillStyle = layer.color;
    ctx.textAlign = layer.align;
    ctx.textBaseline = "middle";
    ctx.font = `${layer.weight} ${layer.size * (height / 720)}px ${layer.font}, ui-sans-serif, system-ui`;
    ctx.fillText(layer.text, 0, 0, width * 0.9);
    ctx.restore();
  }
};

/* -------------------------------------------------------------------------- */
/*  3D & perspective families                                                  */
/* -------------------------------------------------------------------------- */

type SpherePoint = { index: number; x: number; y: number; z: number; width?: number; height?: number };

const tiltPoint = (index: number, x: number, y: number, z: number, tilt: number, size?: { width: number; height: number }): SpherePoint => ({
  index,
  x,
  y: y * Math.cos(tilt) - z * Math.sin(tilt),
  z: y * Math.sin(tilt) + z * Math.cos(tilt),
  ...size,
});

/** Even, scattered coverage — reads as a loose cloud of cards. */
const scatterSphere = (count: number, radius: number, spin: number, tilt: number): SpherePoint[] => {
  const points: SpherePoint[] = [];
  for (let index = 0; index < count; index += 1) {
    const unit = count === 1 ? 0 : 1 - (index / (count - 1)) * 2;
    const ringRadius = Math.sqrt(Math.max(0, 1 - unit * unit));
    const theta = index * GOLDEN_ANGLE + spin * TAU;
    points.push(tiltPoint(index, Math.cos(theta) * ringRadius * radius, unit * radius, Math.sin(theta) * ringRadius * radius, tilt));
  }
  return points.sort((a, b) => a.z - b.z);
};

/** Latitude/longitude tiling — reads as a curved wall of panels. */
const gridSphere = (count: number, radius: number, spin: number, tilt: number, gap: number): SpherePoint[] => {
  // Even tiling wants about two columns per row, which keeps each tile square
  // at the equator.
  const rows = Math.max(2, Math.round(Math.sqrt(count / 2)));
  const columns = Math.max(3, Math.round(rows * 2));
  const inset = 1.02 - gap * 0.35;
  const stepLon = TAU / columns;
  const stepLat = Math.PI / rows;
  const cosTilt = Math.cos(tilt);
  const sinTilt = Math.sin(tilt);
  const points: SpherePoint[] = [];
  for (let index = 0; index < count; index += 1) {
    const row = Math.floor(index / columns);
    const column = index % columns;
    const lat = ((row + 0.5) / rows) * Math.PI;
    const lon = (column / columns) * TAU + spin * TAU;
    const ring = Math.sin(lat);

    // A tile's on-screen size is the projection of the two surface tangents at
    // its centre. Taking both — not just the horizontal one — is what closes
    // the silhouette into a circle instead of leaving square poles.
    const tangentLonX = -ring * Math.sin(lon) * radius;
    const tangentLatY = (-Math.sin(lat) * cosTilt - Math.cos(lat) * Math.sin(lon) * sinTilt) * radius;

    points.push(tiltPoint(
      index,
      ring * Math.cos(lon) * radius,
      Math.cos(lat) * radius,
      ring * Math.sin(lon) * radius,
      tilt,
      {
        width: Math.abs(tangentLonX) * stepLon * inset,
        height: Math.abs(tangentLatY) * stepLat * inset,
      },
    ));
  }
  return points.sort((a, b) => a.z - b.z);
};

const renderSphere = (scene: Scene) => {
  const { p, t, width, height, count } = scene;
  const short = Math.min(width, height);
  const radius = short * (0.20 + p.unit("curvature", 0.5) * 0.20) * (0.78 + p.gap * 0.5);
  const tilt = (p.unit("tilt", 0.5) - 0.5) * 1.35;
  const turns = 0.35 + p.unit("spin", 0.5) * 1.65;
  const fade = p.unit("fade", 0.6);
  const reflection = p.unit("reflection", 0);
  const isGrid = p.option("layout", "scatter") === "grid";
  // Density wraps the sphere in more tiles than there are slots, repeating the
  // media around it. At 0 there is exactly one tile per slot.
  const tiles = Math.max(count, Math.round(count * (1 + p.unit("density", 0) * 15)));
  const box = cardBox(p, short * 0.155, short * 0.20);
  const focal = radius * 3.2;
  const spin = p.alternate ? triangle(t) * turns : t * turns * p.direction;
  const points = isGrid ? gridSphere(tiles, radius, spin, tilt, p.gap) : scatterSphere(tiles, radius, spin, tilt);
  // Kept inside the frame so a large sphere still shows its reflection.
  const floorY = Math.min(height * 0.86, height / 2 + radius * 1.12 + box.height * 0.3);

  withReflection(scene, floorY, reflection, (mirrored) => {
    for (const point of points) {
      const facing = point.z / radius;
      // Tiles tile the surface opaquely, so the far hemisphere is hidden rather
      // than drawn and faded — that is what reads as a solid ball.
      if (isGrid && facing <= 0.02) continue;
      const perspective = focal / Math.max(focal * 0.28, focal - point.z);
      const depth = clamp01((point.z + radius) / (radius * 2));
      // Grid tiles carry their own surface size; cardBox still applies the
      // user's card size and ratio to them.
      const panel = point.width !== undefined ? cardBox(p, point.width, point.height ?? point.width) : box;
      drawCard(scene, point.index, {
        x: width / 2 + point.x * perspective,
        y: height / 2 + point.y * perspective,
        width: panel.width * perspective,
        height: panel.height * perspective,
        rotation: isGrid ? 0 : (point.x / radius) * 0.12,
        opacity: isGrid ? 1 : mix(1 - fade * 0.42, 1, depth),
        // Grid spheres shade toward the rim instead of fading, so the ball
        // reads as lit from the front.
        dim: isGrid ? (1 - facing) * fade * 0.8 : (1 - depth) * fade * 0.62,
        flat: mirrored,
      });
    }
  });
};

/**
 * A four-walled corridor: cards tile the left, right, top and bottom planes and
 * stream toward the camera. Side panels are foreshortened narrow while floor and
 * ceiling panels stay wide, which is what sells the depth without a 3D engine.
 */
const renderTunnel = (scene: Scene) => {
  const { p, t, width, height, count } = scene;
  const short = Math.min(width, height);
  const spread = 0.30 + p.unit("tunnelsize", 0.5) * 0.34;
  const depthSpan = 1.0 + p.unit("depth", 0.5) * 2.2;
  const fade = p.unit("edgefade", 0.6);
  const focal = 0.85;
  const travel = phase(t, p);
  const halfWidth = width * spread;
  const halfHeight = height * spread;
  const spacing = 1.12 - p.gap * 0.3;
  const sideBox = cardBox(p, short * 0.17 * spacing, short * 0.50 * spacing);
  const flatBox = cardBox(p, short * 0.50 * spacing, short * 0.17 * spacing);

  type Panel = { index: number; z: number; wall: number };
  const lanes = Math.max(1, Math.ceil(count / 4));
  const panels: Panel[] = [];
  for (let index = 0; index < count; index += 1) {
    panels.push({ index, wall: index % 4, z: cyclic(Math.floor(index / 4) / lanes + travel) * depthSpan });
  }
  // Far panels first so nearer ones overlap them.
  panels.sort((a, b) => b.z - a.z);

  for (const panel of panels) {
    const perspective = focal / (focal + panel.z);
    const near = 1 - panel.z / depthSpan;
    const vertical = panel.wall < 2;
    const side = panel.wall % 2 === 0 ? -1 : 1;
    drawCard(scene, panel.index, {
      x: width / 2 + (vertical ? side * halfWidth * perspective : 0),
      y: height / 2 + (vertical ? 0 : side * halfHeight * perspective),
      width: (vertical ? sideBox.width : flatBox.width) * perspective,
      height: (vertical ? sideBox.height : flatBox.height) * perspective,
      opacity: clamp01(near * 3.4) * clamp01(perspective * 2.6),
      dim: (1 - perspective) * fade * 0.75,
    });
  }
};

const renderHelix = (scene: Scene) => {
  const { p, t, width, height, count } = scene;
  const turns = 0.6 + p.unit("turns", 0.5) * 3.4;
  const taper = p.unit("taper", 0.5);
  const pulse = p.unit("pulse", 0.4);
  const radius = width * (0.14 + p.gap * 0.22);
  const box = cardBox(p, width * 0.11, width * 0.14);
  const travel = phase(t, p);
  const items: SpherePoint[] = [];
  for (let index = 0; index < count; index += 1) {
    const along = cyclic(index / count + travel);
    const angle = along * TAU * turns;
    const spiral = mix(1, 1 - along, taper);
    items.push({ index, x: Math.cos(angle) * radius * spiral, y: (along - 0.5) * height * 1.15, z: Math.sin(angle) * radius * spiral });
  }
  items.sort((a, b) => a.z - b.z);
  for (const item of items) {
    const depth = clamp01((item.z + radius) / (radius * 2));
    const scale = (0.6 + depth * 0.55) * (1 + Math.sin(TAU * t + item.index) * 0.06 * pulse);
    drawCard(scene, item.index, {
      x: width / 2 + item.x,
      y: height / 2 - item.y,
      width: box.width * scale,
      height: box.height * scale,
      rotation: (item.x / radius) * 0.16,
      opacity: 0.66 + depth * 0.34,
    });
  }
};

const renderStream = (scene: Scene) => {
  const { p, t, width, height, count } = scene;
  const curve = p.unit("curve", 0.5);
  const tilt = p.unit("tilt", 0.5);
  const perspective = p.unit("perspective", 0.5);
  const box = cardBox(p, width * 0.13, height * 0.40);
  const travel = phase(t, p);
  const items: SpherePoint[] = [];
  for (let index = 0; index < count; index += 1) {
    const along = cyclic(index / count + travel);
    const angle = along * TAU;
    items.push({ index, x: (along - 0.5) * width * (1.1 + p.gap * 0.8), y: Math.sin(angle * (1 + curve * 2)) * height * 0.22 * curve, z: Math.cos(angle) });
  }
  items.sort((a, b) => a.z - b.z);
  for (const item of items) {
    const depth = (item.z + 1) / 2;
    const scale = mix(1, 0.5 + depth * 0.85, perspective);
    const edge = clamp01(1 - Math.abs(item.x) / (width * 0.62));
    drawCard(scene, item.index, {
      x: width / 2 + item.x,
      y: height / 2 + item.y,
      width: box.width * scale,
      height: box.height * scale,
      rotation: (item.y / height) * tilt * 1.4,
      opacity: Math.min(1, edge * 2.2) * (0.74 + depth * 0.26),
    });
  }
};

const renderRibbon = (scene: Scene) => {
  const { p, t, width, height, count } = scene;
  const amplitude = p.unit("amplitude", 0.5);
  const wavelength = 0.6 + p.unit("wavelength", 0.5) * 2.4;
  const twist = p.unit("twist", 0.5);
  const box = cardBox(p, width * 0.12, height * 0.34);
  const travel = phase(t, p);
  const items: SpherePoint[] = [];
  for (let index = 0; index < count; index += 1) {
    const along = cyclic(index / count + travel);
    const wave = Math.sin(along * TAU * wavelength);
    items.push({ index, x: (along - 0.5) * width * (1.15 + p.gap * 0.7), y: wave * height * 0.3 * amplitude, z: Math.cos(along * TAU * wavelength) });
  }
  items.sort((a, b) => a.z - b.z);
  for (const item of items) {
    const depth = (item.z + 1) / 2;
    const flip = mix(1, Math.cos(item.z * twist * 1.35), twist);
    const edge = clamp01(1 - Math.abs(item.x) / (width * 0.64));
    drawCard(scene, item.index, {
      x: width / 2 + item.x,
      y: height / 2 + item.y,
      width: box.width * (0.72 + depth * 0.45),
      height: box.height * (0.72 + depth * 0.45),
      flip,
      rotation: (item.y / height) * twist,
      opacity: Math.min(1, edge * 2.4) * (0.72 + depth * 0.28),
    });
  }
};

const renderDepthStack = (scene: Scene) => {
  const { p, t, width, height, count } = scene;
  const depthGap = 0.4 + p.unit("depthgap", 0.5) * 1.4;
  const wobble = p.unit("wobble", 0.4);
  const dim = p.unit("dim", 0.5);
  const box = cardBox(p, width * 0.34, height * 0.62);
  const travel = phase(t, p) * count;
  for (let order = count - 1; order >= 0; order -= 1) {
    const index = (order + Math.floor(travel)) % count;
    const slide = order + 1 - cyclic(travel);
    const depth = clamp01(slide / count);
    const scale = Math.pow(1 - depth * 0.55 * depthGap, 1.1);
    if (scale <= 0.05) continue;
    drawCard(scene, index, {
      // Spacing fans the stack sideways; at 0 the cards sit dead centre.
      x: width / 2 + Math.sin(TAU * t + order) * width * 0.03 * wobble + depth * width * 0.14 * p.gap,
      y: height / 2 - depth * height * 0.10 * depthGap,
      width: box.width * scale,
      height: box.height * scale,
      rotation: Math.sin(TAU * t * 0.5 + order) * 0.05 * wobble,
      opacity: clamp01(1.9 - depth * 1.7),
      dim: depth * dim * 0.8,
    });
  }
};

const renderColumns = (scene: Scene) => {
  const { p, t, width, height, count } = scene;
  const columnCount = Math.max(2, Math.round(2 + p.unit("columns", 0.5) * 5));
  const variation = p.unit("speedvariation", 0.5);
  const depth = p.unit("depth", 0.5);
  const columnWidth = (width * (0.94 - p.gap * 0.22)) / columnCount;
  const box = cardBox(p, columnWidth * 0.86, columnWidth * 1.15);
  const perColumn = Math.max(1, Math.ceil(count / columnCount) + 2);
  for (let column = 0; column < columnCount; column += 1) {
    const columnDepth = 1 - Math.abs(column - (columnCount - 1) / 2) / Math.max(1, columnCount / 2);
    const speed = 1 + (column % 2 === 0 ? variation : -variation) * 0.7;
    const flow = phase(t * speed, p) * (column % 2 === 0 ? 1 : -1);
    const scale = mix(1, 0.66 + columnDepth * 0.5, depth);
    for (let row = 0; row < perColumn; row += 1) {
      const index = (column * perColumn + row) % count;
      const along = cyclic(row / perColumn + flow);
      drawCard(scene, index, {
        x: width * 0.5 + (column - (columnCount - 1) / 2) * columnWidth,
        y: (along * 1.4 - 0.2) * height,
        width: box.width * scale,
        height: box.height * scale,
        opacity: mix(1, 0.62 + columnDepth * 0.38, depth),
        dim: (1 - columnDepth) * depth * 0.55,
      });
    }
  }
};

const renderRunway = (scene: Scene) => {
  const { p, t, width, height, count } = scene;
  const spread = 0.1 + p.unit("spread", 0.5) * 0.5;
  const horizon = 0.24 + p.unit("horizon", 0.5) * 0.28;
  const reflection = p.unit("reflection", 0.7);
  const box = cardBox(p, width * 0.24, height * 0.44);
  const focal = 1.1;
  const travel = phase(t, p);
  const floorY = height * (horizon + 0.42);
  const items: SpherePoint[] = [];
  for (let index = 0; index < count; index += 1) {
    const along = cyclic(index / count + travel);
    // Spacing widens the walk and pushes the queue further down the runway.
    items.push({ index, x: Math.sin(along * TAU) * width * spread * (0.5 + p.gap), y: 0, z: (1 - along) * (0.7 + p.gap * 0.7) });
  }
  items.sort((a, b) => a.z - b.z);
  withReflection(scene, floorY, reflection, (mirrored) => {
    for (const item of items) {
      const perspective = focal / (focal + item.z * 2.6);
      const scale = perspective * 1.9;
      drawCard(scene, item.index, {
        x: width / 2 + item.x * perspective * 1.8,
        y: mix(height * horizon, floorY - box.height * 0.52 * scale, perspective),
        width: box.width * scale,
        height: box.height * scale,
        opacity: clamp01(perspective * 3.4),
        dim: (1 - perspective) * 0.62,
        flat: mirrored,
      });
    }
  });
};

/* -------------------------------------------------------------------------- */
/*  Isometric                                                                  */
/* -------------------------------------------------------------------------- */

const renderIso = (scene: Scene) => {
  const { p, t, width, height, count } = scene;
  const tilt = -0.28 - p.unit("tilt", 0.5) * 0.55;
  const spacing = 0.5 + p.gap * 1.1;
  const focus = p.unit("focus", 0.2);
  const arc = p.unit("arc", 0);
  const box = cardBox(p, width * 0.17, height * 0.34);
  const travel = phase(t, p);
  for (let index = 0; index < count; index += 1) {
    const along = cyclic(index / count - travel);
    const line = {
      x: width * (0.08 + along * 0.84 * spacing),
      y: height * (0.82 - along * 0.6),
    };
    const ring = {
      x: width / 2 + Math.cos(along * TAU) * width * 0.3 * spacing,
      y: height / 2 + Math.sin(along * TAU) * height * 0.2,
    };
    const centred = 1 - Math.abs(along - 0.5) * 2;
    const scale = mix(1, 0.55 + centred * 0.9, focus) * (0.82 + (arc > 0.5 ? centred * 0.2 : 0));
    drawCard(scene, index, {
      x: mix(line.x, ring.x, arc),
      y: mix(line.y, ring.y, arc),
      width: box.width * scale,
      height: box.height * scale,
      rotation: tilt * (1 - arc * 0.6),
      skew: 0.16 * (1 - arc),
      opacity: mix(1, 0.6 + centred * 0.4, focus),
    });
  }
};

/* -------------------------------------------------------------------------- */
/*  Orbit / ring                                                               */
/* -------------------------------------------------------------------------- */

const renderRing = (scene: Scene) => {
  const { p, t, width, height, count } = scene;
  const ringWidth = 0.16 + p.unit("ringwidth", 0.5) * 0.26;
  const ringHeightUnit = p.unit("ringheight", 0.4);
  const ringHeight = 0.04 + ringHeightUnit * 0.30;
  const depth = p.unit("depth", 0.5);
  const bloom = p.unit("bloom", 0.2);
  const ringCount = Math.max(1, Math.round(1 + p.unit("rings", 0) * 2));
  const anchor = p.option("anchor", "center");
  const followRing = p.option("facing", "camera") === "ring";
  const box = cardBox(p, width * 0.135, height * 0.32);
  const spin = p.alternate ? triangle(t) : t * p.direction;
  const centreY = anchor === "bottom" ? height * 1.02 : anchor === "top" ? height * -0.02 : height / 2;
  const items: (SpherePoint & { ring: number })[] = [];
  for (let index = 0; index < count; index += 1) {
    const ring = index % ringCount;
    const ringScale = 1 - ring * 0.26;
    const angle = TAU * ((index / count) * ringCount + spin * (ring % 2 === 1 ? -1 : 1));
    // Anchored wheels are near-circular, so ring height stretches the rim
    // relative to its own radius rather than to the frame.
    const verticalRadius = anchor === "center"
      ? height * ringHeight
      : width * ringWidth * ringScale * (0.35 + ringHeightUnit * 0.9);
    items.push({
      index,
      ring,
      x: Math.cos(angle) * width * ringWidth * ringScale,
      y: Math.sin(angle) * verticalRadius,
      z: Math.sin(angle),
    });
  }
  items.sort((a, b) => a.z - b.z);
  for (const item of items) {
    const front = (item.z + 1) / 2;
    const scale = mix(1, 0.55 + front * 0.6, depth) * (1 - item.ring * 0.18) * (1 + Math.sin(TAU * t + item.index) * 0.07 * bloom);
    const angle = Math.atan2(item.y, item.x);
    drawCard(scene, item.index, {
      x: width / 2 + item.x * (1 + p.gap * 0.35),
      y: centreY + item.y * (1 + p.gap * 0.35),
      width: box.width * scale,
      height: box.height * scale,
      rotation: followRing ? angle + Math.PI / 2 : (item.x / (width * ringWidth)) * 0.09,
      opacity: mix(1, 0.58 + front * 0.42, depth),
      dim: (1 - front) * depth * 0.55,
    });
  }
};

/* -------------------------------------------------------------------------- */
/*  Carousel & flow                                                            */
/* -------------------------------------------------------------------------- */

const renderCoverflow = (scene: Scene) => {
  const { p, t, width, height, count } = scene;
  const vertical = p.option("orientation", "horizontal") === "vertical";
  const sideScale = p.unit("sidescale", 0.5);
  const sideTilt = p.unit("sidetilt", 0.6);
  const zigzag = p.unit("zigzag", 0);
  const depthFade = p.unit("depthfade", 0.4);
  const angle = (p.unit("angle", 0) * 50 * Math.PI) / 180;
  const spread = 0.42 + p.gap * 0.55;
  const box = cardBox(p, vertical ? width * 0.34 : width * 0.24, vertical ? height * 0.30 : height * 0.56);
  const travel = phase(t, p);
  const items: { index: number; offset: number }[] = [];
  for (let index = 0; index < count; index += 1) {
    let offset = cyclic(index / count - travel) - 0.5;
    offset *= 2;
    items.push({ index, offset });
  }
  items.sort((a, b) => Math.abs(b.offset) - Math.abs(a.offset));
  for (const item of items) {
    const distance = Math.abs(item.offset);
    const along = item.offset * (vertical ? height : width) * spread;
    const cross = (item.index % 2 === 0 ? 1 : -1) * (vertical ? width : height) * 0.14 * zigzag;
    const baseX = vertical ? cross : along;
    const baseY = vertical ? along : cross;
    const x = width / 2 + baseX * Math.cos(angle) - baseY * Math.sin(angle);
    const y = height / 2 + baseX * Math.sin(angle) + baseY * Math.cos(angle);
    const scale = mix(1, Math.max(0.35, 1 - distance * 0.85), sideScale);
    const edge = clamp01(1.25 - distance);
    drawCard(scene, item.index, {
      x,
      y,
      width: box.width * scale,
      height: box.height * scale,
      flip: mix(1, Math.cos(clamp(item.offset, -1, 1) * sideTilt * 1.15), sideTilt),
      rotation: angle + item.offset * sideTilt * 0.12,
      opacity: clamp01(edge * 1.8) * mix(1, 0.6 + (1 - distance) * 0.4, depthFade),
      dim: distance * depthFade * 0.55,
    });
  }
};

const renderStrip = (scene: Scene) => {
  const { p, t, width, height, count } = scene;
  const rows = Math.max(1, Math.round(1 + p.unit("rows", 0) * 3));
  const tilt = (p.unit("tilt", 0) - 0.5) * 0.7;
  const stagger = p.unit("stagger", 0.5);
  const vertical = p.option("orientation", "horizontal") === "vertical";
  const lanes = vertical ? Math.max(2, rows + 1) : rows;
  const laneSpan = (vertical ? width : height) * (0.86 - p.gap * 0.1) / lanes;
  const box = cardBox(p, vertical ? laneSpan * 0.82 : laneSpan * 1.32, vertical ? laneSpan * 1.1 : laneSpan * 0.78);
  const perLane = Math.max(2, Math.ceil(count / lanes) + 2);
  const step = (vertical ? box.height : box.width) * (1 + p.gap * 0.5);
  const cycleLength = perLane * step;
  const { ctx } = scene;
  ctx.save();
  ctx.translate(width / 2, height / 2);
  ctx.rotate(tilt);
  ctx.translate(-width / 2, -height / 2);
  for (let lane = 0; lane < lanes; lane += 1) {
    const laneDirection = lane % 2 === 0 ? 1 : -1;
    const speed = 1 + lane * stagger * 0.4;
    const flow = phase(t * speed, p) * laneDirection;
    const laneOffset = (lane - (lanes - 1) / 2) * laneSpan;
    for (let slot = 0; slot < perLane + 1; slot += 1) {
      const index = (lane * perLane + slot) % count;
      const along = cyclic(slot / perLane + flow) * cycleLength - cycleLength / 2;
      drawCard(scene, index, {
        x: width / 2 + (vertical ? laneOffset : along),
        y: height / 2 + (vertical ? along : laneOffset),
        width: box.width,
        height: box.height,
        opacity: clamp01(2.4 - Math.abs(along) / (cycleLength * 0.45)),
      });
    }
  }
  ctx.restore();
};

const renderReel = (scene: Scene) => {
  const { p, t, width, height, count } = scene;
  const lift = p.unit("lift", 0.6);
  const kenBurns = p.unit("kenburns", 0.5);
  const stripShare = p.unit("strip", 0.5);
  const heroBox = cardBox(p, width * 0.62, height * 0.56);
  const beat = t * count;
  const active = Math.floor(beat) % count;
  const local = p.easing(clamp01(cyclic(beat) * 2));
  const heroY = height * (0.40 - stripShare * 0.06);
  drawCard(scene, active, {
    x: width / 2,
    y: heroY,
    width: heroBox.width * (1 + lift * 0.06 * Math.sin(local * Math.PI)),
    height: heroBox.height * (1 + lift * 0.06 * Math.sin(local * Math.PI)),
    opacity: 1,
    zoom: 1 + kenBurns * 0.16 * local,
    panX: (local - 0.5) * kenBurns * 1.4,
    panY: -kenBurns * 0.3,
  });
  const thumbWidth = (width * (0.78 - p.gap * 0.1)) / Math.max(3, count);
  const thumbBox = cardBox(p, thumbWidth * 0.86, thumbWidth * 0.62 * (1 + stripShare));
  for (let index = 0; index < count; index += 1) {
    const offset = index - (count - 1) / 2;
    const isActive = index === active;
    drawCard(scene, index, {
      x: width / 2 + offset * thumbWidth,
      y: height * 0.86 - (isActive ? thumbBox.height * 0.12 * lift : 0),
      width: thumbBox.width,
      height: thumbBox.height,
      opacity: isActive ? 1 : 0.72,
      dim: isActive ? 0 : 0.35,
    });
  }
};

const renderStepped = (scene: Scene) => {
  const { p, t, width, height, count } = scene;
  const hold = p.unit("hold", 0.4);
  const overshoot = p.unit("overshoot", 0.4);
  const sideScale = p.unit("sidescale", 0.5);
  const box = cardBox(p, width * 0.26, height * 0.54);
  const spacing = width * (0.24 + p.gap * 0.24);
  const beat = cyclic(t) * count;
  const step = Math.floor(beat);
  const raw = clamp01((cyclic(beat) - hold) / Math.max(0.05, 1 - hold));
  const eased = p.easing(raw) * (1 + overshoot * 0.12) - overshoot * 0.06 * Math.sin(raw * Math.PI);
  const travel = (step + eased) * p.direction;
  for (let index = 0; index < count; index += 1) {
    let offset = index - travel;
    offset = ((offset % count) + count) % count;
    if (offset > count / 2) offset -= count;
    const distance = Math.abs(offset);
    const scale = mix(1, Math.max(0.4, 1 - distance * 0.24), sideScale);
    drawCard(scene, index, {
      x: width / 2 + offset * spacing,
      y: height / 2 + distance * height * 0.02,
      width: box.width * scale,
      height: box.height * scale,
      rotation: offset * 0.05,
      opacity: clamp01(2.2 - distance * 0.55),
    });
  }
};

/* -------------------------------------------------------------------------- */
/*  Grid                                                                       */
/* -------------------------------------------------------------------------- */

const renderGrid = (scene: Scene) => {
  const { ctx, p, t, width, height, count } = scene;
  const columns = Math.max(2, Math.round(2 + p.unit("columns", 0.35) * 4));
  const rows = Math.max(1, Math.ceil(count / columns));
  const stagger = p.unit("stagger", 0.5);
  const flip = p.unit("flip", 0);
  const pop = p.unit("pop", 0.5);
  const zoom = p.unit("zoom", 0);
  const dim = p.unit("dim", 0.2);
  const mirrored = p.option("mirror", "off") === "on";
  const inset = 0.06 + p.gap * 0.12;
  const cellWidth = (width * (1 - inset * 2)) / columns;
  const cellHeight = (height * (1 - inset * 2)) / rows;
  const box = cardBox(p, cellWidth * (0.94 - p.gap * 0.22), cellHeight * (0.94 - p.gap * 0.22));
  // Direction drives both the reveal sweep and the travelling zoom target.
  const base = phase(t, p);
  const active = Math.floor(base * count) % count;

  ctx.save();
  if (zoom > 0.01) {
    const activeCol = active % columns;
    const activeRow = Math.floor(active / columns);
    const focusX = width * inset + (activeCol + 0.5) * cellWidth;
    const focusY = height * inset + (activeRow + 0.5) * cellHeight;
    const factor = 1 + zoom * 1.35;
    ctx.translate(width / 2, height / 2);
    ctx.scale(factor, factor);
    ctx.translate(-focusX, -focusY);
  }

  for (let index = 0; index < count; index += 1) {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const mediaColumn = mirrored ? Math.min(column, columns - 1 - column) : column;
    const mediaIndex = mirrored ? row * columns + mediaColumn : index;
    const delay = ((column + row) / Math.max(1, columns + rows)) * stagger;
    const wave = 0.5 - Math.cos(TAU * cyclic(base - delay)) / 2;
    const eased = p.easing(wave);
    const isActive = index === active;
    drawCard(scene, mediaIndex, {
      x: width * inset + (column + 0.5) * cellWidth,
      y: height * inset + (row + 0.5) * cellHeight,
      width: box.width * mix(1, 0.25 + eased * 0.8, pop),
      height: box.height * mix(1, 0.25 + eased * 0.8, pop),
      flip: mirrored && column > (columns - 1) / 2 ? -mix(1, Math.cos((1 - eased) * flip * Math.PI), flip) : mix(1, Math.cos((1 - eased) * flip * Math.PI), flip),
      opacity: mix(1, 0.18 + eased * 0.82, Math.max(dim, pop * 0.55)),
      dim: zoom > 0.01 && !isActive ? dim * 0.8 : (1 - eased) * dim * 0.6,
    });
  }
  ctx.restore();
};

/* -------------------------------------------------------------------------- */
/*  Spotlight & focus                                                          */
/* -------------------------------------------------------------------------- */

const renderCenterStage = (scene: Scene) => {
  const { p, t, width, height, count } = scene;
  const travel = 0.1 + p.unit("travel", 0.5) * 0.55;
  const ghosts = Math.round(p.unit("trail", 0.4) * 5);
  const box = cardBox(p, width * 0.34, height * 0.64);
  const beat = cyclic(t) * count;
  const active = Math.floor(beat) % count;
  const local = p.easing(clamp01(cyclic(beat)));
  // Ghosts are earlier positions of the same card, so the active slide leaves a trail.
  for (let ghost = ghosts; ghost >= 0; ghost -= 1) {
    const ghostLocal = clamp01(local - ghost * 0.07);
    const offset = (ghostLocal - 0.5) * 2 * travel * p.direction;
    drawCard(scene, active, {
      x: width / 2 + offset * width * (1 + p.gap * 0.5),
      y: height / 2 + Math.sin(ghostLocal * Math.PI) * height * -0.04,
      width: box.width,
      height: box.height,
      rotation: offset * 0.18,
      opacity: ghost === 0 ? 1 : 0.26 / ghost,
    });
  }
};

const renderFocusShift = (scene: Scene) => {
  const { p, t, width, height, count } = scene;
  const rail = 0.14 + p.unit("rail", 0.5) * 0.26;
  const focus = p.unit("focus", 0.7);
  const box = cardBox(p, width * 0.30, height * 0.58);
  const beat = cyclic(t) * count;
  const active = Math.floor(beat);
  const eased = p.easing(clamp01(cyclic(beat)));
  const head = (active + eased) * p.direction;
  for (let index = 0; index < count; index += 1) {
    let offset = index - head;
    offset = ((offset % count) + count) % count;
    if (offset > count / 2) offset -= count;
    const distance = Math.abs(offset);
    const scale = mix(1, Math.max(0.42, 1 - distance * 0.3), focus);
    drawCard(scene, index, {
      x: width / 2 + offset * width * rail * (1 + p.gap * 0.4),
      y: height / 2,
      width: box.width * scale,
      height: box.height * scale,
      opacity: clamp01(2.1 - distance * 0.45),
      dim: clamp01(distance * 0.22) * focus,
    });
  }
};

const renderDeckPeel = (scene: Scene) => {
  const { p, t, width, height, count } = scene;
  // Spacing widens both the visible stack edge and how far the top card travels.
  const peek = (0.01 + p.unit("peek", 0.5) * 0.06) * (0.5 + p.gap);
  const peel = (0.3 + p.unit("peel", 0.5) * 0.9) * (0.7 + p.gap * 0.6);
  const box = cardBox(p, width * 0.36, height * 0.66);
  const beat = cyclic(t) * count;
  const active = Math.floor(beat);
  const local = p.easing(clamp01(cyclic(beat)));
  for (let order = count - 1; order >= 0; order -= 1) {
    const index = (order + active) % count;
    const depth = order / Math.max(1, count - 1);
    const isFront = order === 0;
    const slideOut = isFront ? local : 0;
    drawCard(scene, index, {
      x: width / 2 + depth * width * peek + slideOut * width * peel * p.direction,
      y: height / 2 - depth * height * peek * 0.6,
      width: box.width * (1 - depth * 0.06),
      height: box.height * (1 - depth * 0.06),
      rotation: depth * 0.05 + slideOut * 0.3,
      opacity: isFront ? clamp01(1.6 - local * 1.6) : 1,
      dim: depth * 0.22,
    });
  }
};

const renderKenBurns = (scene: Scene) => {
  const { p, t, width, height, count } = scene;
  const zoomAmount = p.unit("zoomamount", 0.5);
  const pan = p.unit("pan", 0.5);
  // Spacing insets the full-bleed frame.
  const box = cardBox(p, width * (1 - p.gap * 0.34), height * (1 - p.gap * 0.34));
  const beat = cyclic(t) * count;
  const active = Math.floor(beat) % count;
  const next = (active + 1) % count;
  const local = p.easing(clamp01((cyclic(beat) - 0.72) / 0.28));
  const draw = (index: number, progress: number, opacity: number) => {
    drawCard(scene, index, {
      x: width / 2,
      y: height / 2,
      width: box.width,
      height: box.height,
      opacity,
      zoom: 1 + zoomAmount * 0.35 * progress,
      panX: (progress - 0.5) * 2 * pan * p.direction,
      panY: (progress - 0.5) * pan * 0.6,
    });
  };
  draw(active, cyclic(beat), 1);
  if (local > 0) draw(next, 0, local);
};

/* -------------------------------------------------------------------------- */
/*  Reveal & wipe                                                              */
/* -------------------------------------------------------------------------- */

const renderWipe = (scene: Scene) => {
  const { ctx, p, t, width, height, count } = scene;
  const pattern = p.option("pattern", "linear");
  const pieces = Math.max(1, Math.round(1 + p.unit("pieces", 0.5) * 11));
  const angle = ((p.unit("angle", 0.35) * 90 * Math.PI) / 180) * p.direction;
  const stagger = p.unit("stagger", 0.5);
  // Spacing insets the card inside the frame.
  const box = cardBox(p, width * (0.94 - p.gap * 0.30), height * (0.98 - p.gap * 0.28));
  const beat = cyclic(t) * count;
  const active = Math.floor(beat) % count;
  const next = (active + 1) % count;
  const local = p.easing(clamp01(cyclic(beat)));

  // The clip is built over a square that covers the frame at any rotation.
  const span = Math.hypot(width, height);
  const originX = width / 2 - span / 2;
  const originY = height / 2 - span / 2;
  const revealAt = (index: number) => {
    const order = p.direction < 0 ? pieces - 1 - index : index;
    return clamp01((local - (order / pieces) * stagger) / Math.max(0.05, 1 - stagger));
  };

  drawCard(scene, active, { x: width / 2, y: height / 2, width: box.width, height: box.height });

  ctx.save();
  if (pattern !== "iris") {
    ctx.translate(width / 2, height / 2);
    ctx.rotate(angle);
    ctx.translate(-width / 2, -height / 2);
  }
  ctx.beginPath();
  if (pattern === "stripes") {
    const bandWidth = span / pieces;
    for (let band = 0; band < pieces; band += 1) {
      ctx.rect(originX + band * bandWidth, originY, bandWidth * revealAt(band), span);
    }
  } else if (pattern === "iris") {
    ctx.arc(width / 2, height / 2, (span / 2) * local, 0, TAU);
  } else if (pattern === "split") {
    const bandHeight = span / pieces;
    for (let band = 0; band < pieces; band += 1) {
      const half = (bandHeight / 2) * revealAt(band);
      ctx.rect(originX, originY + (band + 0.5) * bandHeight - half, span, half * 2);
    }
  } else if (pattern === "mosaic") {
    const cell = span / pieces;
    for (let row = 0; row < pieces; row += 1) {
      for (let column = 0; column < pieces; column += 1) {
        const reveal = revealAt((row + column) / 2);
        ctx.rect(originX + column * cell + (cell * (1 - reveal)) / 2, originY + row * cell + (cell * (1 - reveal)) / 2, cell * reveal, cell * reveal);
      }
    }
  } else {
    // Linear: bands sweep together, and stagger rakes the edge.
    const bandWidth = span / pieces;
    for (let band = 0; band < pieces; band += 1) {
      ctx.rect(originX + band * bandWidth, originY, bandWidth, span * revealAt(band));
    }
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clip();
  drawCard(scene, next, { x: width / 2, y: height / 2, width: box.width, height: box.height });
  ctx.restore();
};

/* -------------------------------------------------------------------------- */
/*  Stack & scatter                                                            */
/* -------------------------------------------------------------------------- */

const renderStack = (scene: Scene) => {
  const { p, t, width, height, count } = scene;
  const spread = p.unit("spread", 0.4);
  const spin = (p.unit("spin", 0.4) - 0.2) * 2.2;
  const toss = p.unit("throw", 0.4);
  const hold = p.unit("hold", 0.3);
  const inset = p.unit("inset", 0.4);
  // Spacing trades card size for breathing room around the deck.
  const box = cardBox(p, width * (0.42 - p.gap * 0.18), height * (0.79 - p.gap * 0.33));
  const beat = cyclic(t) * count;
  const active = Math.floor(beat);
  const raw = clamp01((cyclic(beat) - hold) / Math.max(0.05, 1 - hold));
  const local = p.easing(raw);
  for (let order = count - 1; order >= 0; order -= 1) {
    const index = (order + active) % count;
    const depth = order / Math.max(1, count - 1);
    const noise = seededNoise(index);
    const isFront = order === 0;
    drawCard(scene, index, {
      x: width / 2 + noise * width * 0.1 * inset * depth + (isFront ? local * width * 0.55 * spread * p.direction : 0),
      y: height / 2 + depth * height * 0.05 * inset - (isFront ? Math.sin(local * Math.PI) * height * 0.4 * toss : 0),
      width: box.width * (1 - depth * 0.05 * (1 + inset)),
      height: box.height * (1 - depth * 0.05 * (1 + inset)),
      rotation: noise * depth * 0.2 * inset + (isFront ? local * spin : 0),
      opacity: isFront ? clamp01(1.8 - local * 1.8) : 1 - depth * 0.08,
      dim: depth * 0.2,
    });
  }
};

const renderTrail = (scene: Scene) => {
  const { p, t, width, height, count } = scene;
  const length = 0.1 + p.unit("traillength", 0.5) * 0.7;
  const pop = p.unit("pop", 0.5);
  const box = cardBox(p, width * 0.19, height * 0.36);
  const head = phase(t, p);
  for (let order = count - 1; order >= 0; order -= 1) {
    const index = order;
    const lag = (order / count) * length;
    const along = cyclic(head - lag);
    const angle = along * TAU;
    const life = 1 - order / count;
    const scale = mix(0.55, 1, life) * (1 + Math.sin(along * TAU) * 0.08 * pop);
    drawCard(scene, index, {
      x: width / 2 + Math.sin(angle * 2) * width * (0.16 + p.gap * 0.2),
      y: height / 2 + Math.cos(angle * 3) * height * (0.14 + p.gap * 0.16),
      width: box.width * scale,
      height: box.height * scale,
      rotation: Math.sin(angle) * 0.28 * pop,
      opacity: mix(0.16, 1, life),
    });
  }
};

const renderDance = (scene: Scene) => {
  const { p, t, width, height, count } = scene;
  const columns = Math.max(2, Math.round(2 + p.unit("columns", 0.4) * 3));
  const rows = Math.max(1, Math.ceil(count / columns));
  const swing = p.unit("swing", 0.5);
  const cellWidth = (width * (0.9 - p.gap * 0.14)) / columns;
  const cellHeight = (height * (0.9 - p.gap * 0.14)) / rows;
  const box = cardBox(p, cellWidth * 0.88, cellHeight * 0.88);
  const beat = cyclic(t) * count;
  const step = Math.floor(beat);
  const local = p.easing(clamp01(cyclic(beat)));
  const slotOf = (index: number) => {
    const wrap = (value: number) => ((value % count) + count) % count;
    const target = wrap(index + step * p.direction);
    const nextTarget = wrap(index + (step + 1) * p.direction);
    const at = (slot: number) => ({
      x: width / 2 + ((slot % columns) - (columns - 1) / 2) * cellWidth,
      y: height / 2 + (Math.floor(slot / columns) - (rows - 1) / 2) * cellHeight,
    });
    const from = at(target);
    const to = at(nextTarget);
    return { x: mix(from.x, to.x, local), y: mix(from.y, to.y, local) };
  };
  for (let index = 0; index < count; index += 1) {
    const position = slotOf(index);
    drawCard(scene, index, {
      x: position.x,
      y: position.y,
      width: box.width,
      height: box.height,
      rotation: Math.sin(local * Math.PI) * swing * 0.3,
      opacity: 1,
    });
  }
};

/* -------------------------------------------------------------------------- */

const families: Record<FamilyId, (scene: Scene) => void> = {
  sphere: renderSphere,
  tunnel: renderTunnel,
  helix: renderHelix,
  stream: renderStream,
  ribbon: renderRibbon,
  depthStack: renderDepthStack,
  columns: renderColumns,
  runway: renderRunway,
  iso: renderIso,
  ring: renderRing,
  coverflow: renderCoverflow,
  strip: renderStrip,
  reel: renderReel,
  stepped: renderStepped,
  grid: renderGrid,
  centerStage: renderCenterStage,
  focusShift: renderFocusShift,
  deckPeel: renderDeckPeel,
  kenBurns: renderKenBurns,
  wipe: renderWipe,
  stack: renderStack,
  trail: renderTrail,
  dance: renderDance,
};

export const renderMotionTemplate = (
  context: RenderContext,
  project: EditorProject,
  t01: number,
  family: FamilyId,
) => {
  const scene: Scene = {
    context,
    ctx: context.ctx,
    project,
    p: resolveParams(project),
    t: cyclic(t01),
    width: context.width,
    height: context.height,
    count: clamp(project.slots.length, 1, 24),
  };
  scene.ctx.setTransform(1, 0, 0, 1, 0, 0);
  scene.ctx.globalAlpha = 1;
  scene.ctx.clearRect(0, 0, scene.width, scene.height);
  paintBackground(scene);
  families[family](scene);
  scene.ctx.globalAlpha = 1;
  renderText(scene);
};

export const disposeRuntimeAsset = (asset: RuntimeAsset) => {
  // Bundled demo artwork is shared across slots and outlives any one project.
  if (asset.isSample) return;
  if (asset.source instanceof HTMLVideoElement) {
    asset.source.pause();
    asset.source.removeAttribute("src");
    asset.source.load();
  }
  URL.revokeObjectURL(asset.objectUrl);
};
