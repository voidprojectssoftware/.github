// Renders profile/assets/void-hero.svg to an animated GIF fallback for clients
// that do not render SVG (notably the GitHub mobile app, whose native image
// loader shows nothing for an <svg>, but does animate GIFs).
//
// It drives a headless Chromium (playwright-core) over the SVG's own SMIL clock:
// pause the timeline, then setCurrentTime(t) for each evenly spaced frame and
// screenshot. Frames are quantized and encoded with gifenc (pure JS, no ffmpeg).
//
// Run: node scripts/render-gif.mjs

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';
import gifenc from 'gifenc';
import { PNG } from 'pngjs';

const { GIFEncoder, quantize, applyPalette } = gifenc;
const require = createRequire(import.meta.url);
const { chromium } = require('C:/Users/Blake/AppData/Roaming/npm/node_modules/@playwright/cli/node_modules/playwright-core');

const here = dirname(fileURLToPath(import.meta.url));
const SVG = readFileSync(join(here, '..', 'profile', 'assets', 'void-hero.svg'), 'utf8');

// Only the mobile app consumes this, at phone width, so a modest raster is plenty.
const W = 900;
const H = 422; // keeps the 1280:600 aspect
const FPS = 10;
const DURATION = 8; // seconds; a background banner tolerates the loop seam
const FRAMES = FPS * DURATION;

const out = join(here, '..', 'profile', 'assets', 'void-hero.gif');

// Use installed Google Chrome so we don't depend on a pinned Playwright browser build.
const browser = await chromium.launch({ channel: 'chrome' });
try {
	const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
	await page.setContent(
		`<!doctype html><html><body style="margin:0;background:#0e0e18">${SVG}</body></html>`
	);
	// Size the SVG to the raster and freeze its SMIL clock so frames are exact.
	await page.evaluate(
		([w, h]) => {
			const s = document.querySelector('svg');
			s.setAttribute('width', w);
			s.setAttribute('height', h);
			s.pauseAnimations();
		},
		[W, H]
	);
	const el = await page.$('svg');

	const gif = GIFEncoder();
	for (let i = 0; i < FRAMES; i++) {
		const t = i / FPS;
		await page.evaluate((tt) => document.querySelector('svg').setCurrentTime(tt), t);
		const buf = await el.screenshot({ type: 'png' });
		const png = PNG.sync.read(buf);
		const rgba = new Uint8Array(png.data.buffer, png.data.byteOffset, png.data.length);
		const palette = quantize(rgba, 256);
		const index = applyPalette(rgba, palette);
		gif.writeFrame(index, png.width, png.height, { palette, delay: 1000 / FPS });
		if (i % 10 === 0) process.stdout.write(`  frame ${i}/${FRAMES}\r`);
	}
	gif.finish();
	writeFileSync(out, Buffer.from(gif.bytes()));
	console.log(`\nwrote ${out} (${(gif.bytes().length / 1024).toFixed(0)} KB, ${FRAMES} frames)`);
} finally {
	await browser.close();
}
