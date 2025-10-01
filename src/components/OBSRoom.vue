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
			>
				https://pen.lighting
			</div>
		</div>

		<PenLightTrails
			v-if="roomDetails?.penTrails"
			:penlightRefs="Array.from(penRefs.values())"
			:intensity="roomDetails?.penTrailsIntensity || 0.5"
			:decay="roomDetails?.penTrailsDecay || 0.5"
		/>

		<!-- Rendered penlights (possibly limited by maxConcurrent, plus duplicates) -->
		<PenLight
			v-for="pl in displayedPenlights"
			:key="pl.key"
			:roomDetails="roomDetails"
			:color="pl.hex"
			:nickName="pl.nickname"
			:opacity="pl.opacity"
			:penTransform="pl"
			:penSize="spriteSize"
			:smoothMotion="true"
			:ref="el => penRefs.set(pl.key, el)"
		/>

	</div>

</template>
<script setup>

// vue
import { computed, onMounted, onBeforeUnmount, ref, watch, reactive, shallowRef } from 'vue';

// components
import PenLight from '../components/PenLight.vue';
import PenLightTrails from '../components/PenLightTrails.vue';
import { transform } from 'zod';

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

// refs to pen elements
const penRefs = reactive(new Map());

function getPenSpriteSrc(pl) {

	// if will be a base64 data URL if provided
	const b64 = props.roomDetails?.penlightSprite;
	return b64 ? `${b64}` : '/img/default_light.png';
}

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

	// new logic: hard coded in room settings
	const imageBaseSize = 256;
	return Math.floor((props.roomDetails?.penScale || 1) * imageBaseSize);

	//return Math.min(256, Math.floor(stageH.value / 4));
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
		return penPalette.value[u.color];
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


/**
 * CSS style for the room code element (theme color)
 */
const codeStyle = computed(() => ({
	'--code-color': `#${themeHex.value}`,
	transform: `scale(${Number(props.roomDetails?.showCodeScale || 1)})`
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
				x: (u.x) + (off.dx * stageW.value),
				y: (u.y) + (off.dy * stageH.value),
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
			const nx = clamp01(Number(u.x)) * (stageW.value-spriteSize.value) + (spriteSize.value/2);
			const ny = clamp01(Number(u.y)) * (stageH.value-spriteSize.value) + (spriteSize.value*0.8);
			const theta = Number(u.theta || 0);
			const hex = colorForUser(u);
			const nickname = String(u.nickname || '');
			return { 
				x: nx, 
				y: ny, 
				theta, 
				hex, 
				nickname, 
				opacity: 1, 
				key: `b-${i}`
			};
		})
	);

	return expanded;
});


/*
	Init on mount
*/
onMounted(() => {

	console.log('OBSRoom mounted', props.roomDetails);
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
		/* background: black; */

		// clear input events, though this shouldn't really matter for OBS
		/* pointer-events: none;  */
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
			text-align: center;
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
		.code-top-left { 
			top: 12px; 
			left: 12px;
			transform-origin: top left;
		}
		.code-top-right { 
			top: 12px; 
			right: 12px; 
			text-align: right;
			transform-origin: top right;
		}
		.code-bottom-left { 
			bottom: 12px; 
			left: 12px;
			transform-origin: bottom left;
		}
		.code-bottom-right { 
			bottom: 12px; 
			right: 12px; 
			text-align: right;
			transform-origin: bottom right;
		}

	}// .obs-stage

</style>
