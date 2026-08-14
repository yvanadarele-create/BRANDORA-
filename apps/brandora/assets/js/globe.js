/**
 * The manufacturer globe.
 *
 * A rotating sphere with Brandora Union's recorded manufacturers plotted on it,
 * drawn on a 2D canvas with the projection done by hand — about 4KB, versus the
 * ~600KB a WebGL globe library costs. On the metered mobile connections this
 * product is built for, that difference is the section loading or not loading,
 * and there is nothing here a library would do better.
 *
 * **The dots are real or there are no dots.** Points come from `/api/network`,
 * which returns only suppliers with recorded coordinates. A supplier whose
 * latitude nobody entered is not plotted at a country centroid, because a
 * centroid is a guess dressed as a coordinate — a globe that plots guesses is
 * a globe claiming a factory in the middle of a desert. With no suppliers
 * recorded, the sphere still turns and the caption says the network is being
 * built. It never shows invented dots to look busy.
 *
 * The graticule is drawn from parametric maths, not from a map file: this is a
 * diagram of a network, not a political map, and shipping a 200KB world
 * outline to draw six continents at 380px would be the same mistake as the
 * library.
 */

const TAU = Math.PI * 2;
const DEG = Math.PI / 180;

/**
 * Coarse landmass outlines, as latitude/longitude rings.
 *
 * Deliberately rough — enough for a viewer to orient themselves and recognise
 * where a dot is, at a size where anything finer would be sub-pixel. Nothing
 * here is a border claim; they are shapes, drawn as a faint texture behind the
 * data, and no dot's position depends on them.
 */
const LAND = [
  // Africa
  [[35, -6], [37, 10], [33, 22], [31, 32], [15, 39], [11, 51], [-1, 42], [-15, 40], [-26, 33], [-34, 25],
   [-34, 18], [-23, 14], [-6, 12], [4, 9], [6, -2], [5, -8], [10, -15], [21, -17], [28, -13]],
  // Europe
  [[36, -9], [43, -9], [48, -4], [51, 2], [58, 5], [64, 11], [71, 25], [66, 33], [60, 30], [55, 21],
   [50, 14], [45, 14], [40, 20], [36, 24], [38, 15], [40, 9], [36, -5]],
  // Asia
  [[36, 26], [42, 41], [45, 52], [55, 60], [66, 70], [73, 90], [72, 128], [64, 160], [59, 163],
   [50, 141], [43, 132], [35, 126], [30, 122], [22, 114], [10, 105], [1, 104], [8, 98], [16, 95],
   [21, 89], [8, 77], [23, 68], [25, 57], [30, 48], [37, 36]],
  // North America
  [[70, -160], [71, -130], [69, -105], [73, -85], [65, -65], [55, -56], [47, -53], [45, -67], [40, -74],
   [32, -80], [25, -81], [29, -95], [26, -97], [21, -105], [32, -117], [40, -124], [48, -125], [58, -136],
   [60, -150], [65, -167]],
  // South America
  [[11, -72], [10, -61], [5, -52], [-1, -48], [-8, -35], [-20, -40], [-30, -50], [-38, -57], [-50, -68],
   [-55, -68], [-46, -75], [-33, -72], [-18, -70], [-5, -81], [2, -79], [8, -77]],
  // Oceania
  [[-11, 131], [-12, 143], [-20, 149], [-28, 153], [-38, 146], [-35, 137], [-32, 116], [-22, 114], [-15, 125]],
];

/** Latitude/longitude to a point on a unit sphere, rotated by `spin`. */
function project(lat, lon, spin) {
  const phi = lat * DEG;
  const theta = (lon * DEG) + spin;
  return {
    x: Math.cos(phi) * Math.sin(theta),
    y: Math.sin(phi),
    // Positive z faces the viewer. Everything behind is either dropped or
    // dimmed, which is what makes a flat circle read as a sphere.
    z: Math.cos(phi) * Math.cos(theta),
  };
}

function draw(ctx, size, spin, points, palette) {
  const r = size / 2;
  const cx = r;
  const cy = r;
  const radius = r * 0.82;

  ctx.clearRect(0, 0, size, size);

  // The body of the sphere: a radial wash lit from the upper left, which is
  // what gives a flat disc its volume.
  const body = ctx.createRadialGradient(
    cx - radius * 0.35, cy - radius * 0.4, radius * 0.1,
    cx, cy, radius,
  );
  body.addColorStop(0, palette.high);
  body.addColorStop(0.55, palette.mid);
  body.addColorStop(1, palette.low);
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, TAU);
  ctx.fillStyle = body;
  ctx.fill();

  // The rim. A single hairline is what separates "sphere" from "smudge".
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, TAU);
  ctx.strokeStyle = palette.rim;
  ctx.lineWidth = 1;
  ctx.stroke();

  const toScreen = (p) => ({ x: cx + p.x * radius, y: cy - p.y * radius, z: p.z });

  /* --- Graticule ---------------------------------------------------------- */

  ctx.strokeStyle = palette.grid;
  ctx.lineWidth = 0.6;

  // Parallels.
  for (let lat = -60; lat <= 60; lat += 30) {
    ctx.beginPath();
    let started = false;
    for (let lon = -180; lon <= 180; lon += 4) {
      const p = toScreen(project(lat, lon, spin));
      if (p.z < 0) { started = false; continue; }
      if (!started) { ctx.moveTo(p.x, p.y); started = true; } else ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
  }

  // Meridians.
  for (let lon = -180; lon < 180; lon += 30) {
    ctx.beginPath();
    let started = false;
    for (let lat = -90; lat <= 90; lat += 4) {
      const p = toScreen(project(lat, lon, spin));
      if (p.z < 0) { started = false; continue; }
      if (!started) { ctx.moveTo(p.x, p.y); started = true; } else ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
  }

  /* --- Land --------------------------------------------------------------- */

  ctx.strokeStyle = palette.land;
  ctx.lineWidth = 1.1;
  for (const ring of LAND) {
    ctx.beginPath();
    let started = false;
    for (let i = 0; i <= ring.length; i += 1) {
      const [lat, lon] = ring[i % ring.length];
      const p = toScreen(project(lat, lon, spin));
      if (p.z < -0.05) { started = false; continue; }
      if (!started) { ctx.moveTo(p.x, p.y); started = true; } else ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
  }

  /* --- The manufacturers -------------------------------------------------- */

  for (const point of points) {
    const p = toScreen(project(point.lat, point.lon, spin));
    if (p.z < 0) continue;

    // Fades towards the limb rather than vanishing at it, so a dot rotating
    // out of view leaves instead of blinking off.
    const alpha = Math.min(1, Math.max(0, p.z * 1.4));
    const size = 2.4 + p.z * 1.6;

    ctx.beginPath();
    ctx.arc(p.x, p.y, size * 2.8, 0, TAU);
    ctx.fillStyle = palette.halo.replace('ALPHA', (alpha * 0.16).toFixed(3));
    ctx.fill();

    ctx.beginPath();
    ctx.arc(p.x, p.y, size, 0, TAU);
    ctx.fillStyle = palette.dot.replace('ALPHA', alpha.toFixed(3));
    ctx.fill();
  }
}

/* --- Mounting --------------------------------------------------------------- */

export function mountGlobe(canvas, options = {}) {
  if (!canvas || !canvas.getContext) return null;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const palette = {
    high: 'rgba(118, 80, 165, 0.30)',
    mid: 'rgba(58, 36, 88, 0.22)',
    low: 'rgba(10, 8, 16, 0.55)',
    rim: 'rgba(155, 111, 212, 0.45)',
    grid: 'rgba(155, 111, 212, 0.13)',
    land: 'rgba(185, 139, 232, 0.28)',
    dot: 'rgba(216, 189, 255, ALPHA)',
    halo: 'rgba(155, 111, 212, ALPHA)',
    ...(options.palette ?? {}),
  };

  let points = [];
  let spin = 0;
  let raf = null;
  let size = 0;

  // A device-pixel-ratio-aware canvas. Without this the globe is soft on every
  // phone made in the last decade, and a soft globe reads as a cheap one.
  function resize() {
    const rect = canvas.getBoundingClientRect();
    const css = Math.max(1, Math.round(rect.width));
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    size = css;
    canvas.width = Math.round(css * dpr);
    canvas.height = Math.round(css * dpr);
    canvas.style.height = `${css}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  const reduced =
    window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function frame() {
    // One full turn in about ninety seconds. Slow enough that it is scenery
    // rather than something demanding attention, which is the whole difference
    // between a premium page and a novelty one.
    spin += 0.0012;
    draw(ctx, size, spin, points, palette);
    raf = window.requestAnimationFrame(frame);
  }

  function start() {
    if (raf !== null) return;
    if (reduced) { draw(ctx, size, spin, points, palette); return; }
    raf = window.requestAnimationFrame(frame);
  }

  function stop() {
    if (raf === null) return;
    window.cancelAnimationFrame(raf);
    raf = null;
  }

  resize();
  draw(ctx, size, spin, points, palette);
  window.addEventListener('resize', () => { resize(); draw(ctx, size, spin, points, palette); });

  // Only animates while it is on screen. A requestAnimationFrame loop running
  // against a canvas nobody can see is a battery drain and nothing else.
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(
      (entries) => entries.forEach((entry) => (entry.isIntersecting ? start() : stop())),
      { threshold: 0.05 },
    ).observe(canvas);
  } else {
    start();
  }

  // Pausing with the tab. Same reason.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop();
  });

  return {
    setPoints(next) {
      points = Array.isArray(next) ? next : [];
      draw(ctx, size, spin, points, palette);
    },
  };
}
