// Generates the animated org-profile hero: profile/assets/void-hero.svg
//
// Two real datasets, one emblem:
//
//   1. The orbital swirl is the real heliocentric ecliptic trajectory of five
//      deep-space probes (Pioneer 10/11, Voyager 1/2, New Horizons) from
//      NASA/JPL HORIZONS, projected X-Y on a log radial scale so the inner
//      gravity-assist swirl blooms while the long cruise out to ~70 AU
//      compresses into the medallion. Same projection the brand site's symbol
//      generator uses (voidprojects-site trajectory/render.ts). All paths are
//      drawn in a single brand purple.
//
//   2. The stars are the real naked-eye sky (HYG catalog, ~9k stars) projected
//      exactly like the brand site's space-background: seen from Memphis, TN,
//      through a virtual camera facing due south at 52 deg altitude, coloured by
//      each star's B-V index. Ported from voidprojects-site sky/astro.ts +
//      space-background.svelte.
//
// Flat and crisp: no glow, bloom, or gradient lighting. Self-contained animated
// SVG, no runtime required.
//
// Run: node scripts/generate-hero.mjs

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const DATA = JSON.parse(readFileSync(join(here, 'trajectories.json'), 'utf8'));
const CATALOG = JSON.parse(readFileSync(join(here, 'star-catalog.json'), 'utf8'));
const WORDMARK = JSON.parse(readFileSync(join(here, 'wordmark.json'), 'utf8')); // Inter outlines

// ---- Canvas geometry -------------------------------------------------------
const W = 1280;
const H = 600;
const CX = W / 2; // emblem origin (the Sun)
const CY = 258; // sits in the upper portion; wordmark lives below
const R = 208; // emblem outer radius (pixels)
const MAX_AU = 62; // crop radius; log scale blooms the inner swirl
const ROT = -16; // global rotation of the emblem (degrees)
const PURPLE = '#b79cf5'; // brand ink for every trajectory

const DEG = Math.PI / 180;
const f = (n) => Math.round(n * 100) / 100;

// ---- Trajectory projection (mirrors trajectory/render.ts) ------------------
const rad = (ROT * Math.PI) / 180;
const COS = Math.cos(rad);
const SIN = Math.sin(rad);

const CRAFT_IDS = ['pioneer10', 'pioneer11', 'newhorizons', 'voyager2', 'voyager1'];

function scaleR(r) {
	const t = Math.log1p(r) / Math.log1p(MAX_AU); // log radial scale
	return Math.min(1, t) * R;
}

function projectAU(x, y) {
	const r = Math.hypot(x, y);
	const pr = scaleR(r);
	const a0 = Math.atan2(y, x);
	const px = pr * Math.cos(a0);
	const py = pr * Math.sin(a0);
	return [CX + px * COS - py * SIN, CY - (px * SIN + py * COS)];
}

function pathData(pts) {
	if (pts.length < 2) return '';
	const k = 1 / 6; // Catmull-Rom tension
	let d = `M${f(pts[0][0])} ${f(pts[0][1])}`;
	for (let i = 0; i < pts.length - 1; i++) {
		const p0 = pts[i - 1] ?? pts[i];
		const p1 = pts[i];
		const p2 = pts[i + 1];
		const p3 = pts[i + 2] ?? p2;
		const c1x = p1[0] + (p2[0] - p0[0]) * k;
		const c1y = p1[1] + (p2[1] - p0[1]) * k;
		const c2x = p2[0] - (p3[0] - p1[0]) * k;
		const c2y = p2[1] - (p3[1] - p1[1]) * k;
		d += `C${f(c1x)} ${f(c1y)} ${f(c2x)} ${f(c2y)} ${f(p2[0])} ${f(p2[1])}`;
	}
	return d;
}

function croppedProjected(craft) {
	let cut = craft.points.length;
	for (let i = 0; i < craft.points.length; i++) {
		if (Math.hypot(craft.points[i][0], craft.points[i][1]) > MAX_AU) {
			cut = i + 1;
			break;
		}
	}
	return craft.points.slice(0, cut).map(([x, y]) => projectAU(x, y));
}

function planetRings() {
	let out = '';
	for (const p of DATA.planets) {
		if (p.a > MAX_AU) continue;
		const pr = f(scaleR(p.a));
		out += `<circle cx="${CX}" cy="${CY}" r="${pr}" fill="none" stroke="#8fa6d8" stroke-opacity="0.1" stroke-width="1"/>`;
	}
	return out;
}

function trajectories() {
	let traces = ''; // faint always-on paths
	let comets = ''; // travelling lit segments
	let ends = ''; // craft current-position dots
	const shown = DATA.craft.filter((c) => CRAFT_IDS.includes(c.id));
	shown.sort((a, b) => CRAFT_IDS.indexOf(a.id) - CRAFT_IDS.indexOf(b.id));

	shown.forEach((c, idx) => {
		const proj = croppedProjected(c);
		if (proj.length < 2) return;
		const d = pathData(proj);

		traces +=
			`<path d="${d}" fill="none" stroke="${PURPLE}" stroke-opacity="0.5" stroke-width="1.7" ` +
			`stroke-linecap="round" stroke-linejoin="round"/>`;

		// A brighter comet that traces the real journey outward from the Sun, on a
		// normalized path length so the dash math is craft-independent. Staggered
		// starts keep the five probes out of lockstep.
		const dur = 7 + idx * 1.4;
		const begin = f(-idx * 1.9);
		comets +=
			`<path d="${d}" fill="none" stroke="#d4c2ff" stroke-width="2.6" pathLength="100" ` +
			`stroke-linecap="round" stroke-dasharray="16 100">` +
			`<animate attributeName="stroke-dashoffset" values="115;0" dur="${dur}s" ` +
			`begin="${begin}s" repeatCount="indefinite"/>` +
			`<animate attributeName="stroke-opacity" values="0;1;1;0" keyTimes="0;0.08;0.85;1" ` +
			`dur="${dur}s" begin="${begin}s" repeatCount="indefinite"/></path>`;

		const [ex, ey] = proj[proj.length - 1];
		ends += `<circle cx="${f(ex)}" cy="${f(ey)}" r="2.4" fill="${PURPLE}"/>`;
	});

	// The emblem group turns almost imperceptibly, like the galaxy itself.
	return (
		`<g>` +
		`<animateTransform attributeName="transform" type="rotate" from="0 ${CX} ${CY}" ` +
		`to="360 ${CX} ${CY}" dur="480s" repeatCount="indefinite"/>` +
		planetRings() +
		traces +
		comets +
		ends +
		`</g>`
	);
}

// ---- Real star sky (ported from sky/astro.ts + space-background.svelte) -----
const SKY = {
	vantage: { lat: 35.1495, lon: -90.049 }, // Memphis, TN
	epoch: Date.UTC(2026, 1, 15, 3, 30, 0), // fixed instant, so the sky is deterministic
	lookAzimuth: 180, // due south
	lookAltitude: 52,
	fov: 96,
	magLimit: 6.5,
	sizeBase: 0.42,
	sizePerMag: 0.3,
	alphaFloor: 0.16
};

const CI_STOPS = [
	[-0.4, [155, 176, 255]],
	[0.0, [202, 215, 255]],
	[0.4, [248, 247, 255]],
	[0.6, [255, 244, 234]],
	[0.8, [255, 229, 207]],
	[1.2, [255, 206, 166]],
	[1.6, [255, 184, 138]],
	[2.0, [255, 162, 120]]
];
function ciToRgb(ci) {
	let lo = CI_STOPS[0];
	let hi = CI_STOPS[CI_STOPS.length - 1];
	for (let i = 0; i < CI_STOPS.length - 1; i++) {
		if (ci >= CI_STOPS[i][0] && ci <= CI_STOPS[i + 1][0]) {
			lo = CI_STOPS[i];
			hi = CI_STOPS[i + 1];
			break;
		}
	}
	const span = hi[0] - lo[0] || 1;
	const t = Math.max(0, Math.min(1, (ci - lo[0]) / span));
	const r = Math.round(lo[1][0] + (hi[1][0] - lo[1][0]) * t);
	const g = Math.round(lo[1][1] + (hi[1][1] - lo[1][1]) * t);
	const b = Math.round(lo[1][2] + (hi[1][2] - lo[1][2]) * t);
	return `${r},${g},${b}`;
}

function gmstDeg(date) {
	const jd = date.getTime() / 86400000 + 2440587.5;
	const d = jd - 2451545.0;
	const t = d / 36525;
	let g = 280.46061837 + 360.98564736629 * d + 0.000387933 * t * t - (t * t * t) / 38710000;
	g %= 360;
	return g < 0 ? g + 360 : g;
}
function lstHours(date, lonDeg) {
	let lst = (gmstDeg(date) + lonDeg) / 15;
	lst %= 24;
	return lst < 0 ? lst + 24 : lst;
}

function starfield() {
	const date = new Date(SKY.epoch);
	const lst = lstHours(date, SKY.vantage.lon);
	const sinLat = Math.sin(SKY.vantage.lat * DEG);
	const cosLat = Math.cos(SKY.vantage.lat * DEG);

	// virtual camera basis in (north, east, up)
	const a0 = SKY.lookAzimuth * DEG;
	const t0 = SKY.lookAltitude * DEG;
	const cosT = Math.cos(t0);
	const fN = cosT * Math.cos(a0);
	const fE = cosT * Math.sin(a0);
	const fU = Math.sin(t0);
	const rN = -fE / cosT;
	const rE = fN / cosT;
	const uN = -fU * rE;
	const uE = fU * rN;
	const uU = fN * rE - fE * rN;

	const scale = Math.max(W, H) / 2 / Math.tan((SKY.fov / 2) * DEG);
	const cx = W / 2;
	const cy = H / 2;

	const arr = CATALOG.stars; // flat [ra, dec, mag, ci, ...]
	const out = [];
	for (let i = 0; i < arr.length; i += 4) {
		const ra = arr[i];
		const decDeg = arr[i + 1];
		const mag = arr[i + 2];
		const ci = arr[i + 3];
		if (mag > SKY.magLimit) continue;

		const dec = decDeg * DEG;
		const sinDec = Math.sin(dec);
		const cosDec = Math.cos(dec);
		const ha = (lst - ra) * 15 * DEG;
		const cosDcosH = cosDec * Math.cos(ha);
		const u = cosLat * cosDcosH + sinLat * sinDec; // sin(altitude)
		if (u <= 0) continue; // below horizon

		const sN = sinLat * cosDcosH - cosLat * sinDec;
		const n = -sN;
		const e = -cosDec * Math.sin(ha);
		const zf = n * fN + e * fE + u * fU;
		if (zf <= 0.05) continue;

		const xf = n * rN + e * rE;
		const yf = n * uN + e * uE + u * uU;
		const sx = cx + (xf / zf) * scale;
		const sy = cy - (yf / zf) * scale;
		if (sx < -20 || sx > W + 20 || sy < -20 || sy > H + 20) continue;

		const m = SKY.magLimit - mag; // 0 (faint) .. ~8 (brightest)
		const size = SKY.sizeBase + m * SKY.sizePerMag;
		const alpha = Math.min(0.97, SKY.alphaFloor + (m / 8) * 0.82);
		out.push({ x: sx, y: sy, r: size * 1.25, rgb: ciToRgb(ci), alpha, mag });
	}

	// Bright stars twinkle; keep the animated count modest so the SVG stays light.
	out.sort((s, a) => s.mag - a.mag);
	let svg = '';
	out.forEach((s, i) => {
		const cxr = f(s.x);
		const cyr = f(s.y);
		const rr = f(s.r);
		const rgb = `rgb(${s.rgb})`;
		if (i < 130) {
			// twinkle the brightest ~130
			const dur = f(2.6 + (i % 7) * 0.6);
			const begin = f(-(i % 11) * 0.5);
			const lo = f(s.alpha * 0.4);
			svg +=
				`<circle cx="${cxr}" cy="${cyr}" r="${rr}" fill="${rgb}">` +
				`<animate attributeName="opacity" values="${f(s.alpha)};${lo};${f(s.alpha)}" ` +
				`dur="${dur}s" begin="${begin}s" repeatCount="indefinite" calcMode="spline" ` +
				`keyTimes="0;0.5;1" keySplines="0.4 0 0.6 1;0.4 0 0.6 1"/></circle>`;
		} else {
			svg += `<circle cx="${cxr}" cy="${cyr}" r="${rr}" fill="${rgb}" opacity="${f(s.alpha)}"/>`;
		}
	});
	return { svg, count: out.length };
}

// ---- Sun and wordmark (flat, no lighting) ----------------------------------
function sun() {
	return (
		`<circle cx="${CX}" cy="${CY}" r="10" fill="none" stroke="#ffe6a8" stroke-opacity="0.35" stroke-width="1"/>` +
		`<circle cx="${CX}" cy="${CY}" r="4.4" fill="#fff3d6"/>`
	);
}

function wordmark() {
	// Baked Inter outlines (scripts/build-wordmark.py); each path has its left edge
	// at x=0 and baseline at y=0, so center it under CX and drop it on its baseline.
	const w = WORDMARK.wordmark;
	const t = WORDMARK.tagline;
	const wy = 500; // wordmark baseline
	const ty = 546; // tagline baseline
	return (
		`<path transform="translate(${f(CX - w.width / 2)} ${wy})" d="${w.d}" fill="#eef2ff"/>` +
		`<path transform="translate(${f(CX - t.width / 2)} ${ty})" d="${t.d}" fill="#95a3c7"/>`
	);
}

// ---- Assemble --------------------------------------------------------------
const stars = starfield();

const svg =
	`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" ` +
	`fill="none" font-family="sans-serif" role="img" ` +
	`aria-label="Void Projects — real deep-space probe trajectories over the real night sky">` +
	`<defs>` +
	`<filter id="grain"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch"/>` +
	`<feColorMatrix type="saturate" values="0"/></filter>` +
	`</defs>` +
	// Flat deep-space backdrop (matches the site's --background), no vignette.
	`<rect width="${W}" height="${H}" fill="#0e0e18"/>` +
	stars.svg +
	trajectories() +
	sun() +
	wordmark() +
	`<rect width="${W}" height="${H}" filter="url(#grain)" opacity="0.03"/>` +
	`</svg>`;

const outPath = join(here, '..', 'profile', 'assets', 'void-hero.svg');
writeFileSync(outPath, svg);
console.log(`wrote ${outPath} (${(svg.length / 1024).toFixed(1)} KB, ${stars.count} stars)`);
