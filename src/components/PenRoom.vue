<template>
	<div
		ref="stageRef"
		class="room-stage"
		@mousemove="onMouseMove"
		@touchstart="onTouchStart"
		@touchmove="onTouchMove"
		@touchend="onTouchEnd"
		@contextmenu.prevent
	>
		<!-- Colors (top-left) -->
		<div class="ui ui-left" v-if="hasColorOptions">
			<label class="sr-only" for="colorSelect">Penlight Color</label>
			<select id="colorSelect" class="color-select" @change="onColorChange">
				<option
					v-for="hex in roomDetails.penColors"
					:key="hex"
					:value="hex"
					:selected="isSelectedColor(hex)"
				>
					{{ '#' + hex.toUpperCase() }}
				</option>
			</select>
		</div>

		<!-- Auto Wave (top-right) -->
		<div class="ui ui-right">
			<label class="checkbox">
				<input type="checkbox" :checked="autoWaveActive" @change="toggleAutoWave" />
				<span>Auto Wave</span>
			</label>
		</div>

		<!-- Center hint -->
		<div class="hint">drag your finger/mouse around!</div>

		<!-- Penlight sprite + color tint via CSS mask (tints only opaque pixels) -->
		<div class="light" :style="lightStyle" role="img" aria-label="Penlight sprite">
			<img class="light__img" :src="spriteSrc" alt="" draggable="false" />
			<!-- The tint layer uses the sprite as a mask so only the penlight gets colored -->
			<div class="light__tint" :style="tintStyle" aria-hidden="true"></div>
		</div>
	</div>
</template>

<script setup>
/**
 * PenRoom.vue (no TS)
 * - Stores normalized coords (0..1) in userRoomState.{xRef,yRef}
 * - Renders to screen space using stage size
 * - Theta is a smoothed rocking motion [-15°, +15°] based on x-acceleration
 * - Auto Wave adds a small sine offset to X on top of live input
 * - Color tint via CSS mask so only the non-transparent PNG pixels are tinted
 */

import { computed, onMounted, onBeforeUnmount, ref } from 'vue';

/**
 * @typedef {Object} RoomDetails
 * @property {string} themeColor			// hex w/o '#'
 * @property {string[]} penColors			// hex w/o '#'
 * @property {?string} penlightSprite		// base64 PNG (no prefix) or null
 */

/**
 * @typedef {Object} UserRoomState
 * @property {{ value: number }} xRef		// normalized [0..1]
 * @property {{ value: number }} yRef		// normalized [0..1]
 * @property {{ value: number }} thetaRef	// degrees
 * @property={{ value: string|number }} colorRef // hex w/o '#', or number
 */

const props = defineProps({
	roomDetails: { type: Object, required: true },
	userRoomState: { type: Object, required: true }
});

// ---------- DOM & stage metrics ----------
const stageRef = ref(null);
const stageW = ref(1);
const stageH = ref(1);
const spriteSize = 256; // px

function updateStageSize() {
	const el = stageRef.value;
	if (!el) return;
	const r = el.getBoundingClientRect();
	stageW.value = Math.max(1, r.width);
	stageH.value = Math.max(1, r.height);
}

// ---------- Sprite source ----------
const spriteSrc = computed(() => {
	const b64 = props.roomDetails && props.roomDetails.penlightSprite;
	return b64 ? `data:image/png;base64,${b64}` : '/img/default_light.png';
});

// ---------- Color handling ----------
/**
 * Final hex (no '#'):
 * 1) user selection (colorRef) if present
 * 2) fallback to room themeColor
 */
const resolvedHex = computed(() => {
	let v = props.userRoomState && props.userRoomState.colorRef
		? props.userRoomState.colorRef.value
		: null;
	if (v == null || v === '') v = props.roomDetails.themeColor || 'FFFFFF';
	if (typeof v === 'number') v = (v >>> 0).toString(16).padStart(6, '0');
	if (typeof v === 'string' && v.startsWith('#')) v = v.slice(1);
	if (typeof v === 'string' && (v.length === 3 || v.length === 6)) return v.toUpperCase();
	return (props.roomDetails.themeColor || 'FFFFFF').toUpperCase();
});

const hasColorOptions = computed(() => {
	const arr = props.roomDetails && props.roomDetails.penColors;
	return Array.isArray(arr) && arr.length > 0;
});

function isSelectedColor(hex) {
	const cur = resolvedHex.value.toUpperCase();
	return cur === hex.toUpperCase().replace(/^#/, '');
}

function onColorChange(e) {
	const val = String(e.target.value || '').replace(/^#/, '');
	props.userRoomState.colorRef.value = val;
}

// ---------- Render styles ----------

/**
 * Place the 256x256 sprite so its center sits at (pxX, pxY),
 * where pxX/pxY are derived from normalized refs and stage size.
 * Theta is controlled by our kinematics (acceleration-based rocking).
 */
const lightStyle = computed(() => {
	// normalized → pixels
	const xNorm = Number(props.userRoomState.xRef.value ?? 0.5);
	const yNorm = Number(props.userRoomState.yRef.value ?? 0.5);
	const theta = Number(props.userRoomState.thetaRef.value ?? 0);

	const pxX = xNorm * stageW.value;
	const pxY = yNorm * stageH.value;

	const tx = pxX - spriteSize / 2;
	const ty = pxY - spriteSize / 2;

	return {
		transform: `translate(${tx}px, ${ty}px) rotate(${theta}deg)`,
		'--beam-color': `#${resolvedHex.value}`
	};
});

/**
 * Tint layer uses the sprite image as a CSS mask to color only its opaque pixels.
 * Works in modern browsers with both standard and -webkit- prefixed properties.
 */
const tintStyle = computed(() => {
	const url = `url("${spriteSrc.value}")`;
	return {
        // color
		background: `#${resolvedHex.value}`,
        // standard mask
		maskImage: url,
		maskRepeat: 'no-repeat',
		maskSize: '100% 100%',
		maskPosition: 'center',
        // webkit mask for Safari
		WebkitMaskImage: url,
		WebkitMaskRepeat: 'no-repeat',
		WebkitMaskSize: '100% 100%',
		WebkitMaskPosition: 'center',
		opacity: 1
	};
});

// ---------- Math helpers ----------
function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
function lerp(a, b, t) { return a + (b - a) * t; }

// ---------- Input base (normalized) + wave offset ----------
const baseX = ref(0.5);	// user-driven normalized x
const baseY = ref(0.5);	// user-driven normalized y
const waveOffsetX = ref(0); // normalized additive offset from auto-wave

// ---------- Kinematics for rocking theta ----------
// We compute velocity/accel from the *combined* x (base + wave).
let lastTime = 0;
let lastX = null; // normalized
let lastV = 0;    // norm/sec

/**
 * Turn x-acceleration into a target angle and smoothly lerp toward it.
 * Range locked to [-15, 15] degrees; smoothing keeps it "swaying."
 * @param {number} nowMs performance.now()
 */
function updateKinematics(nowMs) {
	const now = nowMs / 1000; // seconds
	if (lastTime === 0) lastTime = now;

	const dt = Math.max(1e-3, now - lastTime); // s
	const combinedX = clamp(baseX.value + waveOffsetX.value, 0, 1);

	// velocity (norm/sec) and acceleration (norm/sec^2)
	const v = lastX == null ? 0 : (combinedX - lastX) / dt;
	const a = (v - lastV) / dt;

	// Map acceleration to angle: tune gain so it feels natural.
	// Typical a might be up to ~2 norm/s^2; gain ~ 18 yields up to ~36°, clamped at 15°.
	const gain = 18;
	let target = clamp(a * gain, -90, 90);

	// Smoothly interpolate (time-based smoothing)
	const prev = Number(props.userRoomState.thetaRef.value || 0);
	// Exponential-like smoothing with a fixed factor per update
	const alpha = clamp(dt * 6, 0, 0.65); // ~tau≈0.16s, max 0.35 per frame
	const next = lerp(prev, target, alpha);

	// Commit theta and normalized XY (so refs always hold normalized)
	props.userRoomState.thetaRef.value = next;
	props.userRoomState.xRef.value = combinedX;
	props.userRoomState.yRef.value = clamp(baseY.value, 0, 1);

	// advance history
	lastTime = now;
	lastX = combinedX;
	lastV = v;
}

// ---------- Pointer handlers (write baseX/baseY in normalized units) ----------
function setBaseFromClientXY(clientX, clientY) {
	const el = stageRef.value;
	const r = el.getBoundingClientRect();
	const x = clamp((clientX - r.left) / r.width, 0, 1);
	const y = clamp((clientY - r.top) / r.height, 0, 1);
	baseX.value = x;
	baseY.value = y;
	updateKinematics(performance.now());
}

function onMouseMove(e) {
	setBaseFromClientXY(e.clientX, e.clientY);
}

function onTouchStart(e) {
	if (e.cancelable) e.preventDefault();
	const t = e.touches && e.touches[0];
	if (!t) return;
	setBaseFromClientXY(t.clientX, t.clientY);
}

function onTouchMove(e) {
	if (e.cancelable) e.preventDefault();
	const t = e.touches && e.touches[0];
	if (!t) return;
	setBaseFromClientXY(t.clientX, t.clientY);
}

function onTouchEnd() {
	// keep last base position
}

// ---------- Auto Wave (adds on top of baseX) ----------
const autoWaveActive = ref(false);
let rafId = null;
let waveStart = 0;

function toggleAutoWave(e) {
	const checked = !!e.target.checked;
	if (checked) startWave();
	else stopWave();
}

function startWave() {
	stopWave();
	autoWaveActive.value = true;
	waveStart = performance.now();

	const freq = 140 / 60;		// ≈2.333 Hz
	const ampNorm = 0.10;		// small amplitude (10% of width)

	const tick = (now) => {
		const t = (now - waveStart) / 1000; // s
		// normalized sine offset
		waveOffsetX.value = ampNorm * Math.sin(2 * Math.PI * freq * t);

		// Even if the user isn't moving, keep kinematics alive
		updateKinematics(now);

		rafId = requestAnimationFrame(tick);
	};
	rafId = requestAnimationFrame(tick);
}

function stopWave() {
	if (rafId != null) {
		cancelAnimationFrame(rafId);
		rafId = null;
	}
	waveOffsetX.value = 0;
	autoWaveActive.value = false;
	// run one more kinematics step to settle to base
	updateKinematics(performance.now());
}

// ---------- Lifecycle ----------
onMounted(() => {
	updateStageSize();
	const ro = new ResizeObserver(updateStageSize);
	ro.observe(stageRef.value);
	// stash to clean up
	stageRef.value.__ro = ro;

	// Initialize normalized refs if unset
	if (!Number.isFinite(props.userRoomState.xRef.value)) props.userRoomState.xRef.value = 0.5;
	if (!Number.isFinite(props.userRoomState.yRef.value)) props.userRoomState.yRef.value = 0.5;
	if (!Number.isFinite(props.userRoomState.thetaRef.value)) props.userRoomState.thetaRef.value = 0;

	// Seed base from existing normalized refs
	baseX.value = clamp(Number(props.userRoomState.xRef.value), 0, 1);
	baseY.value = clamp(Number(props.userRoomState.yRef.value), 0, 1);

	// First kinematics pass
	updateKinematics(performance.now());
});

onBeforeUnmount(() => {
	stopWave();
	const el = stageRef.value;
	if (el && el.__ro) {
		el.__ro.disconnect();
		delete el.__ro;
	}
});
</script>

<style lang="scss" scoped>
.room-stage {
	position: fixed;
	inset: 0;
	background: #000;
	user-select: none;
	-webkit-user-select: none;
	-moz-user-select: none;
	-ms-user-select: none;
	touch-action: none;
	overflow: hidden;

	.ui {
        position: absolute;
        top: 12px;
        z-index: 3;
        pointer-events: auto;

        &.ui-left { left: 12px; }
        &.ui-right { right: 12px; }

        .color-select {
            background: #111;
            color: #ddd;
            border: 1px solid #333;
            border-radius: 6px;
            padding: 6px 8px;
            font: inherit;
            outline: none;

            &:focus { border-color: #666; }
        }

        .checkbox {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            color: #ddd;
            font-size: 14px;
            input { cursor: pointer; }
            span { cursor: pointer; }
        }
	}

	.hint {
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		color: #888;
		font-style: italic;
		font-size: clamp(18px, 3vw, 42px);
		text-align: center;
		z-index: 1;
		pointer-events: none;
	}

	.light {
		position: absolute;
		top: 0;
		left: 0;
		width: 256px;
		height: 256px;
		z-index: 2;
		transform-origin: 50% 60%; // slightly below center
		will-change: transform;

		.light__img {
			display: block;
			width: 100%;
			height: 100%;
			pointer-events: none;
			user-drag: none;
			-webkit-user-drag: none;
		}

		/* The tint layer is colored and uses the sprite image as a mask.
		   Result: only the non-transparent pixels of the sprite get tinted. */
		.light__tint {
			position: absolute;
			inset: 0;
			pointer-events: none;
		}
	}

	/* a11y helper */
	.sr-only {
		position: absolute !important;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0,0,0,0);
		white-space: nowrap;
		border: 0;
	}
}
</style>
