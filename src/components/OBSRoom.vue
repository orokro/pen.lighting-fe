<!--
	OBSRoom.vue
	-----------

	- Transparent fullscreen stage for OBS Browser Source capture
-->
<template>

	<!-- Fullscreen, transparent canvas for OBS -->
	<div ref="stageRef" class="obs-stage">
		<!-- Room Code (corner, thick text, theme color, black outline) -->
		<div
			v-if="showCodePos !== 'hidden'"
			class="room-code"
			:class="codeCornerClass"
			:style="codeStyle"
		>
			{{ roomDetails.code }}
		</div>

		<!-- Rendered penlights (possibly limited by maxConcurrent, plus duplicates) -->
		<div
			v-for="pl in displayedPenlings"
			:key="pl.key"
			class="pen"
			:style="penStyle(pl)"
			:aria-label="pl.nickname || 'penlight'"
			role="img"
		>
			<!-- Base sprite (kept visible for alpha/soft edges) -->
			<img class="pen__img" :src="spriteSrc" alt="" draggable="false" />

			<!-- Tint layer: colors only opaque pixels using mask -->
			<div class="pen__tint" :style="penTintStyle(pl.hex)"></div>

			<!-- Nickname label -->
			<div class="pen__name">{{ pl.nickname }}</div>
		</div>
	</div>
</template>

<script setup>
/**
 * OBSRoom.vue
 * - Transparent fullscreen stage for OBS Browser Source capture
 * - Displays many "penlights" at once from normalized user states
 * - Color rules:
 *   • If room.penColors is empty → use themeColor for everyone
 *   • Else → use user's color as an index into penColors (mod length)
 * - Duplicates:
 *   • If duplicateUsers && users.length < duplicationThreshold
 *     duplicate each user a few times with big offsets, opacity 0.8
 * - maxConcurrent:
 *   • If > 0 and users.length > maxConcurrent, show a random subset
 *     that re-picks every 1s (round-robin-ish)
 * - Scaling:
 *   • Sprite size = min(256px, floor(stageHeight / 4))
 *   • Position from normalized coordinates; rotation pivot at 50% 60%
 */

import { computed, onMounted, onBeforeUnmount, ref, watch, shallowRef } from 'vue';

/**
 * @typedef {Object} RoomDetails
 * @property {string} code
 * @property {string} themeColor			// hex without '#'
 * @property {string[]} penColors			// array of hex without '#'
 * @property {?string} penlightSprite		// base64 PNG (no prefix) or null
 * @property {boolean} duplicateUsers
 * @property {number} duplicationThreshold
 * @property {number} maxConcurrent
 * @property {'top-left'|'top-right'|'bottom-left'|'bottom-right'|'hidden'} showCode
 */

/**
 * @typedef {Object} UserLite
 * @property {number} x			// normalized [0..1]
 * @property {number} y			// normalized [0..1]
 * @property {number} theta		// degrees
 * @property {number|string} color	// index into penColors if array exists; ignored if penColors empty
 * @property {string} nickname
 */

const props = defineProps({
	roomDetails: { type: Object, required: true },
	// Shallow ref array is fine as plain prop in Vue; parent passes shallowRef([...])
	users: { type: Array, required: true }
});

// ---------- Stage metrics ----------
const stageRef = ref(null);
const stageW = ref(1);
const stageH = ref(1);

function updateStageSize() {
	const el = stageRef.value;
	if (!el) return;
	const r = el.getBoundingClientRect();
	stageW.value = Math.max(1, r.width);
	stageH.value = Math.max(1, r.height);
}

// Sprite size rule: 1/4 of viewport height, max 256
const spriteSize = computed(() => {
	return Math.min(256, Math.floor(stageH.value / 4));
});

// ---------- Sprite source ----------
const spriteSrc = computed(() => {
	const b64 = props.roomDetails?.penlightSprite;
	return b64 ? `data:image/png;base64,${b64}` : '/img/default_light.png';
});

// ---------- Utility: color normalization ----------
function normalizeHexMaybe(v) {
	if (v == null || v === '') return null;
	if (typeof v === 'number') v = (v >>> 0).toString(16);
	if (typeof v === 'string') {
		v = v.trim();
		if (v.startsWith('#')) v = v.slice(1);
		v = v.toUpperCase();
		if (v.length === 3) v = v.split('').map(c => c + c).join('');
		if (v.length === 6) return v;
	}
	return null;
}

const themeHex = computed(() => normalizeHexMaybe(props.roomDetails?.themeColor) || 'FFFFFF');
const hasColorOptions = computed(() => Array.isArray(props.roomDetails?.penColors) && props.roomDetails.penColors.length > 0);
const penPalette = computed(() => (props.roomDetails?.penColors || []).map(normalizeHexMaybe).filter(Boolean));


// ---------- Pen color resolver ----------
/**
 * Resolve user color:
 * - If user.color is a HEX string → use it directly.
 * - Else if palette exists and user.color is numeric → use it as an index into the palette.
 * - Else fallback to theme.
 */
function colorForUser(u) {

	// 1) Direct HEX wins if provided
	const asHex = normalizeHexMaybe(u?.color);
	if (asHex)
		return asHex;

	// 2) Use palette index (number or numeric string)
	if (hasColorOptions.value && penPalette.value.length > 0) {
		const len = penPalette.value.length;
		const idx = Number.parseInt(u?.color, 10);
		if (Number.isFinite(idx)) return penPalette.value[((idx % len) + len) % len];
		// fallback to first palette color if index missing
		return penPalette.value[0];
	}

	// 3) Theme fallback
	return themeHex.value;
}

// ---------- Show Code placement ----------
const showCodePos = computed(() => props.roomDetails?.showCode || 'hidden');
const codeCornerClass = computed(() => {
	switch (showCodePos.value) {
		case 'top-left': return 'code-top-left';
		case 'top-right': return 'code-top-right';
		case 'bottom-left': return 'code-bottom-left';
		case 'bottom-right': return 'code-bottom-right';
		default: return 'code-hidden';
	}
});
const codeStyle = computed(() => ({
	'--code-color': `#${themeHex.value}`
}));

// ---------- Duplicates logic ----------
/**
 * If duplicateUsers is true and user count < duplicationThreshold:
 * - duplicate each user N times (small N "a few")
 * - large offsets so they feel far apart
 * - duplicates get opacity 0.8
 *
 * We compute duplicatesPerUser based on how far we are from the threshold,
 * capped at 3 for "a few". Offsets are deterministic-ish per index so it
 * doesn't shimmer every render.
 */
function makeDuplicates(baseUsers) {
	const out = [];
	const dupeOn = !!props.roomDetails?.duplicateUsers;
	const threshold = Number(props.roomDetails?.duplicationThreshold || 0);
	const count = baseUsers.length;

	if (!dupeOn || threshold <= 0 || count >= threshold) {
		// no duplication needed
		for (let i = 0; i < count; i++) {
			const u = baseUsers[i];
			out.push({ ...u, opacity: 1, key: `u-${i}` });
		}
		return out;
	}

	// How many duplicates per user?
	const deficit = Math.max(0, threshold - count);
	const perUser = Math.min(3, Math.max(1, Math.ceil(deficit / Math.max(1, count))));
	// Copy originals
	for (let i = 0; i < count; i++) {
		const u = baseUsers[i];
		out.push({ ...u, opacity: 1, key: `u-${i}` });
		// Add duplicates with offsets
		for (let d = 0; d < perUser; d++) {
			const off = offsetFor(i, d);
			out.push({
				...u,
				x: clamp01(u.x + off.dx),
				y: clamp01(u.y + off.dy),
				opacity: 0.8,
				key: `u-${i}-d${d}`
			});
		}
	}
	return out;
}

// Big-ish offsets in normalized space; spread around in a star pattern
function offsetFor(i, d) {
	const angles = [0, 72, 144, 216, 288]; // degrees
	const a = (angles[(i + d) % angles.length] * Math.PI) / 180;
	const radius = 0.18 + ((i + d) % 3) * 0.05; // 0.18..0.28
	return {
		dx: radius * Math.cos(a),
		dy: radius * Math.sin(a)
	};
}

function clamp01(v) { return Math.max(0, Math.min(1, v)); }

// ---------- maxConcurrent + round-robin subset ----------
const subset = ref([]); // indices chosen when > maxConcurrent
let rrTimer = null;

function pickSubset(maxN) {
	const N = props.users.length;
	const idxs = Array.from({ length: N }, (_, i) => i);
	// random shuffle (Fisher-Yates)
	for (let i = N - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[idxs[i], idxs[j]] = [idxs[j], idxs[i]];
	}
	subset.value = idxs.slice(0, maxN);
}

function ensureRoundRobin() {
	const maxN = Number(props.roomDetails?.maxConcurrent || 0);
	if (!maxN || props.users.length <= maxN) {
		// not needed
		subset.value = [];
		clearRR();
		return;
	}
	// Start/refresh 1s picker
	pickSubset(maxN);
	clearRR();
	rrTimer = setInterval(() => pickSubset(maxN), 1000);
}

function clearRR() {
	if (rrTimer) {
		clearInterval(rrTimer);
		rrTimer = null;
	}
}

// Watch users / maxConcurrent changes
watch(
	() => [props.users.length, props.roomDetails?.maxConcurrent],
	() => ensureRoundRobin(),
	{ immediate: true }
);

// ---------- Build the list to render (with dupes, with subset) ----------
const displayedPenlings = computed(() => {
	// 1) Base users → apply maxConcurrent subset if needed
	const maxN = Number(props.roomDetails?.maxConcurrent || 0);
	let baseUsers = props.users;

	if (maxN && baseUsers.length > maxN) {
		// pick from subset indices
		const chosenSet = new Set(subset.value);
		baseUsers = baseUsers.filter((_, i) => chosenSet.has(i));
	}

	// 2) Duplicate logic
	const expanded = makeDuplicates(
		baseUsers.map((u, i) => {
			// Normalize/clamp incoming values just in case
			const nx = clamp01(Number(u.x));
			const ny = clamp01(Number(u.y));
			const theta = Number(u.theta || 0);
			const hex = colorForUser(u);
			const nickname = String(u.nickname || '');
			return { x: nx, y: ny, theta, hex, nickname, opacity: 1, key: `b-${i}` };
		})
	);

	return expanded;
});

// ---------- Style generators per pen ----------
function penStyle(pl) {
	const size = spriteSize.value;
	const pxX = pl.x * stageW.value;
	const pxY = pl.y * stageH.value;

	// center the sprite at pxX/pxY
	const tx = pxX - size / 2;
	const ty = pxY - size / 2;

	return {
		width: `${size}px`,
		height: `${size}px`,
		transform: `translate(${tx}px, ${ty}px) rotate(${pl.theta}deg)`,
		opacity: pl.opacity,
		'--beam-color': `#${pl.hex}`
	};
}

function penTintStyle(hex) {
	const url = `url("${spriteSrc.value}")`;
	return {
		background: `#${hex}`,
		maskImage: url,
		maskRepeat: 'no-repeat',
		maskSize: '100% 250%',
		maskPosition: 'top left',
		WebkitMaskImage: url,
		WebkitMaskRepeat: 'no-repeat',
		WebkitMaskSize: '100% 250%',
		WebkitMaskPosition: 'top left',
		opacity: 0.5
	};
}

// ---------- Lifecycle ----------
onMounted(() => {
	updateStageSize();
	const ro = new ResizeObserver(updateStageSize);
	ro.observe(stageRef.value);
	stageRef.value.__ro = ro;
	ensureRoundRobin();
});

onBeforeUnmount(() => {
	clearRR();
	const el = stageRef.value;
	if (el && el.__ro) {
		el.__ro.disconnect();
		delete el.__ro;
	}
});
</script>

<style lang="scss" scoped>
.obs-stage {
	position: fixed;
	inset: 0;
	/* Transparent background for OBS */
	background: transparent;
	pointer-events: none; /* display-only canvas */
	overflow: hidden;
	user-select: none;
	touch-action: none;

	.room-code {
		position: absolute;
		z-index: 10;
		pointer-events: none;
		font-family: system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif;
		font-weight: 900; /* thick letters */
		/* Big, responsive code */
		font-size: clamp(24px, 6vw, 48px);
		letter-spacing: 0.06em;
		color: var(--code-color, #ffffff);
		/* Outline: mix of stroke + shadow for good capture in OBS */
		-webkit-text-stroke: 3px #000;
		text-shadow:
			0 0 0 #000,
			1px 1px 0 #000,
			-1px -1px 0 #000,
			1px -1px 0 #000,
			-1px 1px 0 #000;
	}

	/* Corners */
	.code-top-left { top: 12px; left: 12px; }
	.code-top-right { top: 12px; right: 12px; text-align: right; }
	.code-bottom-left { bottom: 12px; left: 12px; }
	.code-bottom-right { bottom: 12px; right: 12px; text-align: right; }

	.pen {
		position: absolute;
		top: 0;
		left: 0;
		transform-origin: 50% 60%; /* slightly below center like input component */
		will-change: transform, opacity;
		pointer-events: none; /* display-only */

		.pen__img {
			display: block;
			width: 100%;
			height: 100%;
			pointer-events: none;
			user-drag: none;
			-webkit-user-drag: none;
		}

		/* Tint overlay uses the sprite as mask, so only opaque pixels are colored */
		.pen__tint {
			position: absolute;
			/* inset: 0; */
			inset: 0px 0px 40% 0px;
			pointer-events: none;
			/* opacity: 0.5; */
		}

		.pen__name {
			position: absolute;
			left: 50%;
			top: calc(100% - 8px); /* slightly under the sprite */
			transform: translateX(-50%);
			white-space: nowrap;
			font-family: system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif;
			font-weight: 800;
			font-size: clamp(10px, 1.6vw, 22px);
			font-size: 22px;
			color: #fff;
			/* Black outline for readability */
			-webkit-text-stroke: 2px #000;
			text-shadow:
				0 0 0 #000,
				1px 1px 0 #000,
				-1px -1px 0 #000,
				1px -1px 0 #000,
				-1px 1px 0 #000;
		}
	}
}
</style>
