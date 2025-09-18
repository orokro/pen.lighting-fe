<!--
	PenTrails.vue
	-------------
	Component to render light trails for the pen lights
-->
<template>
	<!-- Full-screen, pointerless canvas living *under* the PenLight DOM -->
	<canvas ref="canvasEl" class="pen-trails-canvas"></canvas>
</template>

<script setup>
// tabs, vanilla JS
import { onMounted, onBeforeUnmount, watch, ref, computed, nextTick } from 'vue';
import { usePenMasking } from '@/composables/usePenMasking.js'; // path to your file

/**
 * Props
 * - displayedPenlights: your computed list (array of pen objects). Must include a stable `key` and `hex` color.
 * - penRefs: Map<penKey, ComponentOrEl> where each value is either the PenLight component instance (use .$el) or the root element.
 * - spriteSize: size in pixels of the pen sprite square (used for mask scaling and unmasked emitter size).
 * - roomCode: string, forwarded to usePenMasking cache keying.
 * - getPenSpriteSrc: function (pl) => sprite src string. If not provided, masking is skipped for that pen.
 * - fade: 0..1 amount to reapply last frame (lower = faster fade). Default ~0.9 is a nice trail.
 * - maxInterpStep: max step distance in px for interpolation stamps (smaller = more stamps).
 */
const props = defineProps({
	displayedPenlights: { type: Array, required: true },
	penRefs: { type: Object, required: true }, // Map-like
	spriteSize: { type: Number, default: 256 },
	roomCode: { type: String, default: '' },
	getPenSpriteSrc: { type: Function, default: null },
	fade: { type: Number, default: 0.9 },
	maxInterpStep: { type: Number, default: 12 }
});

const debug = true; // set true to verify emitter positions

// canvas & buffers
const canvasEl = ref(null);
let ctx = null;
let accum = null; // offscreen accumulation canvas
let rafId = 0;
let running = false;

// bookkeeping per pen
const lastPose = new Map(); // key -> { x, y, t, angle }
const maskCache = new Map(); // key -> { maskingMode, penMaskImg: Image|null }
const { getPenImages } = usePenMasking(); // from your composable

// device pixel ratio handling
function resizeCanvasToDisplaySize(canvas) {
	const dpr = Math.max(1, window.devicePixelRatio || 1);
	const w = Math.floor(window.innerWidth * dpr);
	const h = Math.floor(window.innerHeight * dpr);
	if (canvas.width !== w || canvas.height !== h) {
		canvas.width = w;
		canvas.height = h;
		canvas.style.width = window.innerWidth + 'px';
		canvas.style.height = window.innerHeight + 'px';
	}
	if (!accum) {
		accum = document.createElement('canvas');
	}
	if (accum.width !== canvas.width || accum.height !== canvas.height) {
		accum.width = canvas.width;
		accum.height = canvas.height;
	}
	return dpr;
}

/**
 * Given a PenLight component/element, compute:
 *  - screen-space emission point (x,y) in CSS pixels
 *  - orientation angle (radians), derived from its CSS matrix
 *
 * Uses:
 *  - offsetLeft/Top (pre-transform layout position)
 *  - offsetParent chain -> page coordinates
 *  - computed transform matrix + transform-origin (px)
 *  - DOMMatrix + DOMPoint to transform local origin
 */
 function getPenPose(el) {
	const root = el?.$el || el;
	if (!root || root.nodeType !== 1) return null;

	const cs = getComputedStyle(root);

	// transform-origin in px
	const originStr = cs.transformOrigin || '50% 50%';
	let [ox, oy] = originStr.split(' ').map(v => v.trim());
	const w = root.offsetWidth || props.spriteSize;
	const h = root.offsetHeight || props.spriteSize;

	const px = val => {
		if (typeof val !== 'string') return Number(val) || 0;
		if (val.endsWith('%')) {
			const n = parseFloat(val) / 100;
			return (isNaN(n) ? 0 : n) * (val === ox ? w : h);
		}
		return parseFloat(val) || 0;
	};
	ox = px(ox);
	oy = px(oy);

	// layout top-left (pre-transform) in page coords
	let pageLeft = 0, pageTop = 0, node = root;
	while (node && node !== document.body) {
		if (node.offsetLeft != null) pageLeft += node.offsetLeft;
		if (node.offsetTop != null) pageTop += node.offsetTop;
		node = node.offsetParent;
	}
	// add scroll offsets (important in OBS if any scrolling wrapper exists)
	pageLeft += window.scrollX || 0;
	pageTop  += window.scrollY || 0;

	// transform matrix (2D or 3D is fine)
	const tfm = cs.transform || 'none';
	const m = (tfm === 'none') ? new DOMMatrix() : new DOMMatrix(tfm);

	// transform local origin
	const p = new DOMPoint(ox, oy, 0, 1).matrixTransform(m);

	// final emission point
	const x = pageLeft + p.x;
	const y = pageTop + p.y;
	const angle = Math.atan2(m.b, m.a);

	return { x, y, angle };
}


/**
 * Load (once per pen) the mask image via your composable (if a sprite src is provided).
 * Caches the HTMLImageElement for fast stamping.
 */
async function ensureMaskForPen(pl) {
	if (!props.getPenSpriteSrc) return null;
	const src = props.getPenSpriteSrc(pl);
	if (!src) return null;

	if (maskCache.has(pl.key)) return maskCache.get(pl.key);

	try {
		const res = await getPenImages(props.roomCode || 'room', src, 0, '#DDDDDD');
		let img = null;
		if (res.penMask) {
			img = await new Promise((resolve, reject) => {
				const im = new Image();
				im.crossOrigin = 'anonymous';
				im.onload = () => resolve(im);
				im.onerror = reject;
				im.src = res.penMask;
			});
		}
		const payload = { maskingMode: !!res.maskingMode, penMaskImg: img };
		maskCache.set(pl.key, payload);
		return payload;
	} catch (e) {
		console.warn('[PenTrails] mask load failed for', pl.key, e);
		const payload = { maskingMode: false, penMaskImg: null };
		maskCache.set(pl.key, payload);
		return payload;
	}
}

/**
 * Stamp a masked sprite along the path using additive blending.
 * pos: {x,y,angle}, size: spriteSize in CSS px, dpr scaling handled externally
 */
function stampMasked(accCtx, maskImg, x, y, angle, sizePx, alpha = 0.25) {
	if (!maskImg) return;

	accCtx.save();
	accCtx.globalCompositeOperation = 'lighter';
	accCtx.globalAlpha = alpha;

	accCtx.translate(x, y);
	accCtx.rotate(angle);
	// The mask was generated from a 256x256 sprite; scale to desired spriteSize
	const s = sizePx;
	accCtx.drawImage(maskImg, -s / 2, -s * 0.6, s, s); // anchor near transform-origin (50% 60%)

	accCtx.restore();
}

/**
 * Stamp a soft “emitter” for unmasked pens (a rounded-rect-ish glow).
 * Drawn in pen color with additive blending and a bit of blur.
 */
function stampUnmasked(accCtx, colorHex, x, y, angle, sizePx, alpha = 0.22) {
	const w = Math.max(4, Math.round(sizePx * 0.16));
	const h = Math.max(4, Math.round(sizePx * 0.28));

	if (debug) {
		accCtx.save();
		accCtx.globalCompositeOperation = 'source-over';
		accCtx.globalAlpha = 1;
		accCtx.fillStyle = '#ff3366';
		accCtx.beginPath();
		accCtx.arc(X, Y, 3 * dpr, 0, Math.PI * 2);
		accCtx.fill();
		accCtx.restore();
	}


	accCtx.save();
	accCtx.translate(x, y);
	accCtx.rotate(angle);

	accCtx.globalCompositeOperation = 'lighter';
	accCtx.globalAlpha = alpha;

	accCtx.shadowBlur = Math.round(sizePx * 0.25);
	accCtx.shadowColor = colorHex;

	// Simple rounded-ish rect by path
	accCtx.beginPath();
	const rx = w / 2, ry = h; // top-centered emission
	accCtx.moveTo(-rx, -ry);
	accCtx.lineTo(rx, -ry);
	accCtx.quadraticCurveTo(rx, -ry + 6, rx - 6, -ry + 6);
	accCtx.lineTo(-rx + 6, -ry + 6);
	accCtx.quadraticCurveTo(-rx, -ry + 6, -rx, -ry);
	accCtx.closePath();

	accCtx.fillStyle = colorHex;
	accCtx.fill();

	accCtx.restore();
}

/**
 * Interpolate from prev->{x,y,angle} to next, stamping every <= maxInterpStep pixels.
 */
 function stampInterpolatedTrail(accCtx, pen, prev, next, sizePx, isMasked, maskImg, dpr) {
	// prev/next are in CSS px. Convert when stamping.
	const dx = next.x - prev.x;
	const dy = next.y - prev.y;
	const da = next.angle - prev.angle;

	const dist = Math.hypot(dx, dy);
	const steps = Math.max(1, Math.ceil(dist / props.maxInterpStep));
	for (let i = 1; i <= steps; i++) {
		const t = i / steps;
		const x = (prev.x + dx * t) * dpr;
		const y = (prev.y + dy * t) * dpr;
		const a = prev.angle + da * t;

		if (isMasked && maskImg) {
			stampMasked(accCtx, maskImg, x, y, a, sizePx, 0.18);
		} else {
			stampUnmasked(accCtx, pen.hex || '#ffffff', x, y, a, sizePx, 0.16);
		}
	}
}



/**
 * One animation frame:
 * - re-apply previous accumulation with fade (globalAlpha = props.fade)
 * - compute current poses for all pens
 * - stamp interpolations from last poses
 * - blit accumulation to onscreen canvas
 */
function renderFrame(ts) {
	if (!running || !ctx || !accum) return;

	const dpr = Math.max(1, window.devicePixelRatio || 1);
	const W = accum.width, H = accum.height;

	// 1) fade previous accumulation into itself
	// inside renderFrame(ts), before stamping new trails:
	{
		const accCtx = accum.getContext('2d');
		accCtx.save();
		// Fade existing pixels by punching out a translucent black rect.
		accCtx.globalCompositeOperation = 'destination-out';
		// (1 - fade) controls how fast old pixels disappear.
		// e.g., fade=0.90 -> alpha=0.10 => ~slow fade
		accCtx.fillStyle = `rgba(0,0,0,${(1 - props.fade).toFixed(4)})`;
		accCtx.fillRect(0, 0, accum.width, accum.height);
		accCtx.restore();
	}


	// 2) compute current poses and stamp trails
	const accCtx = accum.getContext('2d');

	for (const pl of props.displayedPenlights) {
		const penEl = props.penRefs?.get ? props.penRefs.get(pl.key) : null;
		if (!penEl) continue;

		const pose = getPenPose(penEl);
		if (!pose) continue;

		const prev = lastPose.get(pl.key);
		lastPose.set(pl.key, { ...pose, t: ts });

		// ensure mask availability (async). While loading, we’ll stamp unmasked.
		let maskInfo = maskCache.get(pl.key);
		if (!maskInfo) {
			ensureMaskForPen(pl); // fire & forget; cache will fill
			maskInfo = { maskingMode: false, penMaskImg: null };
		}

		const sizePx = props.spriteSize * dpr;

		if (prev) {
			stampInterpolatedTrail(
				accCtx,
				pl,
				prev,
				pose,
				sizePx,
				maskInfo.maskingMode && !!maskInfo.penMaskImg,
				maskInfo.penMaskImg,
				dpr
			);
		} else {
			// first-sighting stamp (also in device px)
			const X = pose.x * dpr, Y = pose.y * dpr;
			if (maskInfo.maskingMode && maskInfo.penMaskImg) {
				stampMasked(accCtx, maskInfo.penMaskImg, X, Y, pose.angle, sizePx, 0.22);
			} else {
				stampUnmasked(accCtx, pl.hex || '#ffffff', X, Y, pose.angle, sizePx, 0.2);
			}
		}
	}

	// 3) blit accumulation to onscreen
	ctx.clearRect(0, 0, W, H);
	ctx.drawImage(accum, 0, 0);

	rafId = requestAnimationFrame(renderFrame);
}

function start() {
	if (running) return;
	running = true;
	rafId = requestAnimationFrame(renderFrame);
}

function stop() {
	running = false;
	if (rafId) {
		cancelAnimationFrame(rafId);
		rafId = 0;
	}
}

function handleResize() {
	if (!canvasEl.value) return;
	resizeCanvasToDisplaySize(canvasEl.value);
}

onMounted(async () => {
	await nextTick();
	if (!canvasEl.value) return;

	ctx = canvasEl.value.getContext('2d', { alpha: true, desynchronized: true });
	resizeCanvasToDisplaySize(canvasEl.value);

	window.addEventListener('resize', handleResize, { passive: true });

	start();
});

onBeforeUnmount(() => {
	stop();
	window.removeEventListener('resize', handleResize);
	lastPose.clear();
	maskCache.clear();
	accum = null;
	ctx = null;
});
</script>

<style lang="scss" scoped>
.pen-trails-canvas {
	position: fixed;
	inset: 0;
	width: 100vw;
	height: 100vh;
	z-index: 0; /* ensure it's *under* your PenLight components */
	pointer-events: none;
}

/* You likely already place PenLight elements above this (e.g., z-index: 1+). */
</style>
