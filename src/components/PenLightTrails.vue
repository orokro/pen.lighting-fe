<!-- 
 	PenLightTrails.vue 
	------------------
	
	Component to render light trails for the pen lights
-->
<template>
	<canvas ref="trailCanvas" class="trail-canvas"></canvas>
</template>
<script setup>

import { onMounted, onBeforeUnmount, ref, watch, defineExpose } from 'vue'

/**
 * Props
 * @prop {Array} penlightRefs - Array of Vue refs pointing to penlight elements
 */
const props = defineProps({

	penlightRefs: {
		type: Array,
		required: true
	}
});

// Reference to the canvas element
const trailCanvas = ref(null)

// Internal 2D rendering context
let ctx = null

// Animation frame handle
let frameId = null

/**
 * Draw the current trails with a true-to-zero fade.
 * We multiply existing alpha each frame using 'destination-in',
 * so pixels reach full transparency after finite steps.
 *
 * @param {CanvasRenderingContext2D} ctx
 */
 function drawTrail(ctx) {
	const { width, height } = ctx.canvas;

	// 1) Multiply existing alpha by 0.95 (≈5% fade per frame).
	// After ~117 frames, 0.95^n * 255 < 1 → alpha becomes 0.
	ctx.save();
	ctx.globalCompositeOperation = 'destination-in';
	ctx.globalAlpha = 0.85;   // smaller => longer trails; bigger => faster fade
	ctx.fillRect(0, 0, width, height);
	ctx.restore();

	// 2) Draw new trails on top (normal painting).
	if (!props.penlightRefs?.length) return;
	props.penlightRefs.forEach(refEl => {
		refEl?.drawPenTrail(ctx);
	});
}


/**
 * Main render loop at ~60fps.
 * Uses requestAnimationFrame to schedule the next frame.
 */
function renderLoop() {
	if (!ctx) return
	drawTrail(ctx)
	frameId = requestAnimationFrame(renderLoop)
}


// Expose drawTrail() so other components (like PenLight.vue) can call it directly
defineExpose({
	drawTrail
})


onMounted(() => {

	const canvas = trailCanvas.value;
	if (!canvas) 
		return;

	// Match canvas size to viewport
	canvas.width = window.innerWidth;
	canvas.height = window.innerHeight;
	ctx = canvas.getContext('2d');

	// Start animation loop
	renderLoop();

	// Optional: handle resize
	window.addEventListener('resize', resizeCanvas);
})


onBeforeUnmount(() => {

	if (frameId)
		cancelAnimationFrame(frameId);

	window.removeEventListener('resize', resizeCanvas);
})


/**
 * Resize canvas to always fill the screen.
 */
function resizeCanvas() {
	if (!trailCanvas.value) return
	trailCanvas.value.width = window.innerWidth
	trailCanvas.value.height = window.innerHeight
}

</script>
<style lang="scss" scoped>

	.trail-canvas {
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		pointer-events: none; // Prevent blocking interactions

		filter: blur(5px);
	}

</style>
