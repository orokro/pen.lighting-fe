<!--
	PenRoom.vue
	-----------

	- Renders the interactive penlight stage
	- Stores normalized coords (0..1) in userRoomState.{xRef,yRef}
	- Renders to screen space using stage size
-->
<template>

	<!-- main full screen stage where the user interacts w/ their pen light -->
	<div
		ref="stageRef"
		class="room-stage"
		@mousemove="onMouseMove"
		@touchstart="onTouchStart"
		@touchmove="onTouchMove"
		@touchend="onTouchEnd"
		@contextmenu.prevent
	>
		<!-- on the top left, a drop box for picking colors if the room allows it -->
		<div 
			class="ui ui-left" 
			v-if="hasColorOptions"
			@touchstart.stop
			@touchmove.stop
			@touchend.stop
			@click.stop
		>
			<select id="colorSelect" class="color-select" @change="onColorChange">
				<option
					v-for="hex, index in roomDetails.penColors"
					:key="hex"
					:value="index"
					:selected="isSelectedColor(hex)"
				>
					{{ '#' + hex.toUpperCase() }}
				</option>
			</select>
		</div>

		<!-- Option for Auto Wave (top-right) -->
		<div 
			class="ui ui-right"
			@touchstart.stop
			@touchmove.stop
			@touchend.stop
			@click.stop
		>
			<label class="checkbox">
				<input type="checkbox" :checked="autoWaveActive" @change="toggleAutoWave" />
				<span>Auto Wave</span>
			</label>
		</div>

		<!-- Center hint -->
		<div class="hint">Drag your finger/mouse around!</div>

		<!-- The PenLight component -->
		<PenLight
			:roomDetails="roomDetails"
			:color="resolvedHex"
			:opacity="1"
			:penTransform="penTransform"
			:nickName="props.userRoomState.nickname || 'Guest'"
		/>
	</div>

</template>
<script setup>

// vue
import { computed, onMounted, onBeforeUnmount, ref } from 'vue';

// components
import PenLight from './PenLight.vue';

// define props
const props = defineProps({

	// details about the room we're in
	roomDetails: { 
		type: Object, 
		required: true
	},

	// our user-specific room state (refs for x/y/theta/colorRef)
	userRoomState: { 
		type: Object, 
		required: true 
	},

});

// DOM & stage metrics
const stageRef = ref(null);
const stageW = ref(1);
const stageH = ref(1);


/**
 * Measures the size of the stage element and updates stageW/stageH.
 */
function updateStageSize() {
	const el = stageRef.value;
	
	// gtfo if no element
	if (!el)
		return;

	// measure our outermost stage wrapper
	const r = el.getBoundingClientRect();
	stageW.value = Math.max(1, r.width);
	stageH.value = Math.max(1, r.height);
}


/**
 * Startup rule:
 * - If penColors exist, default to the first color in that array.
 * - Else default to themeColor.
 * Then honor user selection afterwards.
 */
 const resolvedHex = computed(() => {

	// if the room has color options, use userRef or first option; else use themeColor
	if (hasColorOptions.value) {

		// return the user's selected color if valid
		return props.roomDetails.penColors[props.userRoomState?.colorRef?.value];

	} else {

		// no options → always theme color
		return normalizeHexMaybe(props.roomDetails?.themeColor) || 'FFFFFF';
	}
});


/**
 * Helper to compute if this room has color options.
 */
const hasColorOptions = computed(() => {
	const arr = props.roomDetails?.penColors;
	return Array.isArray(arr) && arr.length > 0;
});


/**
 * Normalize to 6-char uppercase hex (no '#'), or null if unusable.
 */
 function normalizeHexMaybe(v) {

	// null/empty
	if (v == null || v === '')
		return null;

	// handle color as number
	if (typeof v === 'number')
		v = (v >>> 0).toString(16);

	// string
	if (typeof v === 'string') {

		// trim, strip '#', uppercase
		v = v.trim();
		if (v.startsWith('#')) v = v.slice(1);
		v = v.toUpperCase();

		// expand 3-char to 6-char
		if (v.length === 3) v = v.split('').map(c => c + c).join('');
		if (v.length === 6) return v;
	}

	// bad
	return null;
}


/**
 * Check if the given hex (string or number) matches our currently selected color.
 */
function isSelectedColor(hex) {
	return resolvedHex.value === normalizeHexMaybe(hex);
}


/**
 * Handle user changing color from the dropdown.
 * 
 * @param {Event} e - the change event
 */
function onColorChange(e) {
	const val = String(e.target.value || '').replace(/^#/, '');
	props.userRoomState.colorRef.value = val;
}


// ---------- Render styles ----------

/**
 * Computed pen transform (x, y in pixels; theta in degrees).
 */
const penTransform = computed(()=> {

	return {
		x: (props.userRoomState.xRef.value ?? 0.5) * stageW.value ,
		y: (props.userRoomState.yRef.value ?? 0.5) * stageH.value ,
		theta: props.userRoomState.thetaRef.value,
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


/**
 * For now, at least, we will store the users coordinates normalized (0..1),
 * and then use these same coords for the OBS stage. While this means the movement
 * wont be pixel-perfect identical, it does mean that resizing the stage
 * will keep the penlight in the same relative position.
 * 
 * Maybe someday we'll store the stage size from the OBS in the database
 * and display a rectangle with the correct aspect-ratio on the client
 * but thats too much work for now.
 * 
 * So this function will convert clientX/clientY to normalized coords
 * 
 * @param {number} clientX - from mouse or touch event
 * @param {number} clientY - from mouse or touch event
 */
function setBaseFromClientXY(clientX, clientY) {

	// get bounding rect of stage
	const el = stageRef.value;
	const r = el.getBoundingClientRect();

	// convert to normalized
	const x = clamp((clientX - r.left) / r.width, 0, 1);
	const y = clamp((clientY - r.top) / r.height, 0, 1);

	// update our refs
	baseX.value = x;
	baseY.value = y;

	// update kinematics immediately (i.e. the programmatic rocking/tilting)
	updateKinematics(performance.now());
}


/**
 * Handle mouse move event.
 */
function onMouseMove(e) {
	setBaseFromClientXY(e.clientX, e.clientY);
}


/**
 * Handle touch start/move events.
 */
function onTouchStart(e) {
	if (e.cancelable)
		e.preventDefault();

	const t = e.touches && e.touches[0];
	if (!t)
		return;

	setBaseFromClientXY(t.clientX, t.clientY);
}


/**
 * Handle touch move event.
 */
function onTouchMove(e) {

	if (e.cancelable)
		e.preventDefault();

	const t = e.touches && e.touches[0];
	if (!t)
		return;
	
	setBaseFromClientXY(t.clientX, t.clientY);
}


/**
 * Handle touch end event.
 */
function onTouchEnd() {
	// keep last base position
}


// ---------- Auto Wave (adds on top of baseX) ----------
const autoWaveActive = ref(false);
let rafId = null;
let waveStart = 0;


/**
 * Handle user toggling the Auto Wave checkbox.
 */
function toggleAutoWave(e) {

	const checked = !!e.target.checked;
	if (checked)
		startWave();
	else 
		stopWave();
}


/**
 * Function to start auto-wave if user enables it.
 */
function startWave() {

	// clear anything that may have been running
	stopWave();
	autoWaveActive.value = true;
	waveStart = performance.now();

	// wave params
	const freq = 140 / 60;		// ≈2.333 Hz
	const ampNorm = 0.10;		// small amplitude (10% of width)

	// animation loop
	const tick = (now) => {

		// t in seconds since wave start
		const t = (now - waveStart) / 1000; 
		
		// normalized sine offset
		waveOffsetX.value = ampNorm * Math.sin(2 * Math.PI * freq * t);

		// Even if the user isn't moving, keep kinematics alive
		updateKinematics(now);

		rafId = requestAnimationFrame(tick);
	};
	rafId = requestAnimationFrame(tick);
}


/**
 * Function to stop auto-wave if user disables it.
 */
function stopWave() {

	// clear animation
	if (rafId != null) {
		cancelAnimationFrame(rafId);
		rafId = null;
	}

	// reset offset & flag
	waveOffsetX.value = 0;
	autoWaveActive.value = false;

	// run one more kinematics step to settle to base
	updateKinematics(performance.now());
}


// ---------- Lifecycle ----------

/**
 * When we mount, set up ResizeObserver to track stage size changes,
 */
onMounted(() => {

	// measure initial size
	updateStageSize();

	// watch for size changes & store resize observer on element for cleanup
	const ro = new ResizeObserver(updateStageSize);
	ro.observe(stageRef.value);
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


/**
 * Cleanup on unmount.
 */
onBeforeUnmount(() => {

	// stop any animation loops
	stopWave();

	// disconnect resize observer
	const el = stageRef.value;
	if (el && el.__ro) {
		el.__ro.disconnect();
		delete el.__ro;
	}
});
</script>

<style lang="scss" scoped>

	// main outer wrapper room stage
	.room-stage {

		// fill the screen
		position: fixed;
		inset: 0;

		// make back
		background: #000;

		// disable text/touch selection
		user-select: none;
		-webkit-user-select: none;
		-moz-user-select: none;
		-ms-user-select: none;
		touch-action: none;

		// allow nothing to escape
		overflow: hidden;

		// the UI elements (color select, auto wave checkbox, maybe more)
		.ui {

			// fixed a long top of screen
			position: absolute;
			top: 12px;
			z-index: 3;
			pointer-events: auto;

			// left/right variants
			&.ui-left { left: 12px; }
			&.ui-right { right: 12px; }

			// the color select dropdown
			.color-select {

				// box settings
				border: 3px solid gray;
				border-radius: 6px;
				outline: none;
				background: #DDD;
				padding: 6px 10px;
				
				// text settings		
				font: inherit;
				font-size: 22px;
				font-weight: bolder;
				color: black;

				&:focus { border-color: #666; }
			}// .color-select

			// check box & label or w/e for the auto wave + more
			.checkbox {

				// layout
				display: inline-flex;
				align-items: center;
				gap: 8px;

				// box
				background: #DDD;
				border: 3px solid gray;
				border-radius: 6px;
				padding: 6px 10px;
				
				// text settings
				color: black;
				font-size: 22px;
				font-weight: bolder;

				// child styles
				input { cursor: pointer; }
				span { cursor: pointer; }
			}// .checkbox

		}// .ui

		// the string in the middle of the page prompting user to move finger/mouse around
		.hint {

			// fixed in center of page
			position: absolute;
			top: 50%;
			left: 50%;
			transform: translate(-50%, -50%);
			z-index: 1;

			// slightly transparent
			opacity: 0.6;

			// don't interfere w/ mouse events
			pointer-events: none;

			// text settings
			color: #888;
			font-style: italic;
			font-size: clamp(18px, 3vw, 42px);
			text-align: center;
			
		}// .hint

	}// .room-stage

</style>
