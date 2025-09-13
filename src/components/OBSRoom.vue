<!--
	OBSRoom.vue
	-----------

	Transparent fullscreen stage for OBS Browser Source capture
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
			<div 
				class="code-url"
				:style="penLightingURLStyle"
			>
				https://pen.lighting
			</div>
		</div>

		<!-- Rendered penlights (possibly limited by maxConcurrent, plus duplicates) -->
		<div
			v-for="pl in displayedPenlights"
			:key="pl.key"
			class="pen"
			:style="penStyle(pl)"
			:aria-label="pl.nickname || 'penlight'"
			role="img"
		>
			<!-- Base sprite (kept visible for alpha/soft edges) -->
			<img class="pen-img" :src="spriteSrc" alt="" draggable="false" />

			<!-- Tint layer: colors only opaque pixels using mask -->
			<div class="pen-tint" :style="penTintStyle(pl.hex)"></div>

			<!-- Nickname label -->
			<div class="pen-name">{{ pl.nickname }}</div>
		</div>

	</div>

</template>
<script setup>

// vue
import { computed, onMounted, onBeforeUnmount, ref, watch, shallowRef } from 'vue';

// define some props
const props = defineProps({

	// details about the room we're in
	roomDetails: { 
		type: Object, 
		required: true
	},

	// array of users currently in the room to display
	users: { 
		type: Array,
		required: true
	}

});


// store ref el to the stage & its size
const stageRef = ref(null);
const stageW = ref(1);
const stageH = ref(1);


/**
 * Updates the width/height of our stage for doing maths on the pointers
 */
function updateStageSize() {

	// gtfo if we don't have a ref
	const el = stageRef.value;
	if (!el)
		return;

	// measure or element
	const r = el.getBoundingClientRect();
	stageW.value = Math.max(1, r.width);
	stageH.value = Math.max(1, r.height);
}


/**
 * Computed helper to decide the sprite size based on stage height
 * 
 * Rule: Sprite size rule: 1/4 of viewport height, max 256
 */
const spriteSize = computed(() => {
	return Math.min(256, Math.floor(stageH.value / 4));
});


/**
 * The sprite image to use for penlights
 * 
 * If none is provided in the room details, we'll load the default penlight
 */
const spriteSrc = computed(() => {

	// if will be a base64 data URL if provided
	const b64 = props.roomDetails?.penlightSprite;
	return b64 ? `data:image/png;base64,${b64}` : '/img/default_light.png';
});


/**
 * Normalize a HEX color string or number to a 6-digit uppercase HEX string.
 * 
 * @param {string|number|null} v - The input color value.
 * @returns {string|null} - Normalized 6-digit uppercase HEX string or null if invalid.
 */
function normalizeHexMaybe(v) {

	// null/empty → null
	if (v == null || v === '') 
		return null;

	// number → hex string
	if (typeof v === 'number')
		v = (v >>> 0).toString(16);

	// string → clean hex string
	if (typeof v === 'string') {

		// trim & remove leading #
		v = v.trim();
		if (v.startsWith('#'))
			v = v.slice(1);

		// must be 3 or 6 hex digits
		v = v.toUpperCase();
		if (v.length === 3) 
			v = v.split('').map(c => c + c).join('');

		// must be 6 hex digits
		if (v.length === 6) return v;
	}
	return null;
}


/**
 * Get theme color from room or use white if missing/invalid
 */
const themeHex = computed(() => normalizeHexMaybe(props.roomDetails?.themeColor) || 'FFFFFF');


/**
 * get boolean if the room creator set up a list of colors o not
 */
const hasColorOptions = computed(() => Array.isArray(props.roomDetails?.penColors) && props.roomDetails.penColors.length > 0);


/**
 * List of valid colors for pens
 */
const penPalette = computed(() => (props.roomDetails?.penColors || []).map(normalizeHexMaybe).filter(Boolean));


/**
 * Resolve user color:
 * - If user.color is a HEX string → use it directly.
 * - Else if palette exists and user.color is numeric → use it as an index into the palette.
 * - Else fallback to theme.
 * 
 * @param {Object} u - User object with optional 'color' property.
 * @returns {string} - Resolved 6-digit uppercase HEX color string.
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
		
		if (Number.isFinite(idx)) return
			penPalette.value[((idx % len) + len) % len];

		// fallback to first palette color if index missing
		return penPalette.value[0];
	}

	// 3) Theme fallback
	return themeHex.value;
}


/**
 * Helper to make sure we have a default position
 */
const showCodePos = computed(() => props.roomDetails?.showCode || 'hidden');


/**
 * Compute the class to position the room code based on roomDetails setting
 */
const codeCornerClass = computed(() => {

	switch (showCodePos.value) {
		case 'top-left': return 'code-top-left';
		case 'top-right': return 'code-top-right';
		case 'bottom-left': return 'code-bottom-left';
		case 'bottom-right': return 'code-bottom-right';
		default: return 'code-hidden';
	}
});


const penLightingURLStyle = {
	
};


/**
 * CSS style for the room code element (theme color)
 */
const codeStyle = computed(() => ({
	'--code-color': `#${themeHex.value}`
}));


/**
 * If duplicateUsers is true and user count < duplicationThreshold:
 * - duplicate each user N times (small N "a few")
 * - large offsets so they feel far apart
 * - duplicates get opacity 0.8
 *
 * We compute duplicatesPerUser based on how far we are from the threshold,
 * capped at 3 for "a few". Offsets are deterministic-ish per index so it
 * doesn't shimmer every render.
 * 
 * @param {Array} baseUsers - Array of user objects with x, y, theta, hex, nickname.
 * @returns {Array} - Expanded array with duplicates added, each with x, y, theta, hex, nickname, opacity, key.
 */
function makeDuplicates(baseUsers) {

	// array of duplicated users
	const out = [];

	// break out our rooms duplication settings
	const dupeOn = !!props.roomDetails?.duplicateUsers;
	const threshold = Number(props.roomDetails?.duplicationThreshold || 0);
	const count = baseUsers.length;

	// short-circuit if no duplication needed
	if (!dupeOn || threshold <= 0 || count >= threshold) {

		// no duplication needed, copy users with opacity 1
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
	
		}// next d
	
	}// next i

	return out;
}


/**
 * Helper method for above function makeDuplications, to spread out duplicate users
 */
function offsetFor(i, d) {

	// use 5 angles in a star pattern
	const angles = [0, 72, 144, 216, 288];
	const a = (angles[(i + d) % angles.length] * Math.PI) / 180;
	const radius = 0.18 + ((i + d) % 3) * 0.05; // 0.18..0.28

	// return offset
	return {
		dx: radius * Math.cos(a),
		dy: radius * Math.sin(a)
	};
}


/**
 * Clamp a number to [0,1]
 */
function clamp01(v) { return Math.max(0, Math.min(1, v)); }


// ---------- maxConcurrent + round-robin subset ----------
const subset = ref([]); // indices chosen when > maxConcurrent
let rrTimer = null;


/*
	NOTES about the next few functions:
	- pickSubset()
	- ensureRoundRobin()
	- clearRR()

	These functions implement a simple round-robin mechanism to pick
	a subset of users to display when the total number of users exceeds
	maxConcurrent.

	In other words, the streamer can change a setting to cap the total
	number of penlights rendered (in case lag or other issues).

	To make sure everyone in the room is represented, if there's more
	than maxConcurrent users, we pick a random subset of them every second
	so that over time everyone gets a chance to be seen.
*/

/**
 * Pick a random subset of indices from 0..N-1 of size maxN
 * and store them in subset.value
 */
function pickSubset(maxN) {

	// get total users
	const N = props.users.length;

	// get array of their ids
	const idxs = Array.from({ length: N }, (_, i) => i);

	// random shuffle (Fisher-Yates)
	for (let i = N - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[idxs[i], idxs[j]] = [idxs[j], idxs[i]];
	}

	// pick the first maxN of idxs as our current pool
	subset.value = idxs.slice(0, maxN);
}


/**
 * Ensure round-robin picking is active if needed
 */
function ensureRoundRobin() {

	// if maxConcurrent is set and we have more users than that, start/refresh RR
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


/**
 * Clear round-robin timer if any
 */
function clearRR() {
	if (rrTimer) {
		clearInterval(rrTimer);
		rrTimer = null;
	}
}


// If either the total users or maxConcurrent changes, ensure RR is correct
watch(
	() => [props.users.length, props.roomDetails?.maxConcurrent],
	() => ensureRoundRobin(),
	{ immediate: true }
);


/**
 * Final list of penlights to display, after applying maxConcurrent subset
 */
const displayedPenlights = computed(() => {

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


/**
 * CSS style for a penlight element
 * 
 * This includes:
 * - size
 * - position (x,y)
 * - rotation (theta)
 * - opacity
 * - color (via CSS variable for the tint layer)
 * 
 * @param {Object} pl - Penlight object with x, y, theta, hex, opacity.
 * @returns {Object} - CSS style object.
 */
function penStyle(pl) {

	// dimensions & position
	const size = spriteSize.value;
	const pxX = pl.x * stageW.value;
	const pxY = pl.y * stageH.value;

	// center the sprite at pxX/pxY
	const tx = pxX - size / 2;
	const ty = pxY - size / 2;

	// return computed style
	return {
		width: `${size}px`,
		height: `${size}px`,
		transform: `translate(${tx}px, ${ty}px) rotate(${pl.theta}deg)`,
		opacity: pl.opacity,
		'--beam-color': `#${pl.hex}`
	};
}


/**
 * CSS style for the tint overlay of a penlight
 * 
 * This uses the sprite as a mask, so only opaque pixels are colored.
 * 
 * @param {string} hex - 6-digit uppercase HEX color string.
 * @returns {Object} - CSS style object for the tint layer.
 */
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


/*
	Init on mount
*/
onMounted(() => {

	// measure our stage size
	updateStageSize();

	// watch for size changes so our math still works
	const ro = new ResizeObserver(updateStageSize);
	ro.observe(stageRef.value);

	// store on element
	stageRef.value.__ro = ro;

	// ensure round-robin is correct on start up
	ensureRoundRobin();
});


/*
 * Cleanup on unmount
 */
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

	// main stage / outermost container
	.obs-stage {

		// fill screen, since this is meant to be 100% captured in the OBS browser source
		position: fixed;
		inset: 0;

		// Transparent background for OBS
		background: transparent;

		// clear input events, though this shouldn't really matter for OBS
		pointer-events: none; 
		overflow: hidden;
		user-select: none;
		touch-action: none;

		// floating room code on screen
		.room-code {

			// fixed position on screen, on top of everything else
			position: absolute;
			z-index: 10;

			// disable just in case
			pointer-events: none;
			// text settings
			font-family: system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif;
			font-weight: 900;
			font-size: clamp(24px, 6vw, 48px);
			letter-spacing: 0.06em;
			color: var(--code-color, #ffffff);

			//Outline: mix of stroke + shadow for good capture in OBS
			-webkit-text-stroke: 3px #000;
			text-shadow:
				0 0 0 #000,
				1px 1px 0 #000,
				-1px -1px 0 #000,
				1px -1px 0 #000,
				-1px 1px 0 #000;
		
			// the URL
			.code-url {

				// dark pill
				background: rgba(0, 0, 0, 0.8);
				border-radius: 50px;
				padding: 3px 8px;

				// text settings
				text-shadow: none;
				text-align: center;
				color: white !important;
				-webkit-text-stroke: 0px !important;
				font-size: 15px;
				font-weight: 600;				
				
			}// .code-url 

		}// .room-code


		// fixed positioning for the different corner settings
		.code-top-left { top: 12px; left: 12px; }
		.code-top-right { top: 12px; right: 12px; text-align: right; }
		.code-bottom-left { bottom: 12px; left: 12px; }
		.code-bottom-right { bottom: 12px; right: 12px; text-align: right; }

		// styles for a pen object
		.pen {

			// always absolutely positioned from the coordinates we get from the server
			position: absolute;
			top: 0;
			left: 0;

			// slightly below center like input component
			transform-origin: 50% 60%; 
			will-change: transform, opacity;
			pointer-events: none;

			// smooth movement/rotation
			transition: 
				left 0.1s linear,
				top 0.1s linear,
				transform 0.1s linear,
				opacity 0.5s ease;

			// base sprite image
			.pen-img {
				display: block;
				width: 100%;
				height: 100%;
				pointer-events: none;
				user-drag: none;
				-webkit-user-drag: none;

			}// .pen-img


			// Tint overlay uses the sprite as mask, so only opaque pixels are colored
			.pen-tint {
				position: absolute;
				inset: 0px 0px 40% 0px;
				pointer-events: none;

			}// .pen-tint

			
			// Nickname label below the sprite
			.pen-name {

				// fixed
				position: absolute;

				// force center on bottom
				left: 50%;
				top: calc(100% - 8px);
				transform: translateX(-50%);

				// text settings
				white-space: nowrap;
				font-family: system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif;
				font-weight: 800;
				font-size: clamp(10px, 1.6vw, 22px);
				font-size: 22px;
				color: #fff;


				// Black outline for readability
				-webkit-text-stroke: 2px #000;
				text-shadow:
					0 0 0 #000,
					1px 1px 0 #000,
					-1px -1px 0 #000,
					1px -1px 0 #000,
					-1px 1px 0 #000;

			}// .pen-name

		}// .pen

	}// .obs-stage

</style>
