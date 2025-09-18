<!--
	PenLight.vue
	------------

	Re-usable component for both the user room & the OBS room
-->
<template>

	<!-- outermost wrapper -->
	<div
		ref="rootEl"
		class="pen"
		:class="{ 'use-motion-smoothing': smoothMotion }"
		:style="penStyle"
		role="img"
	>
		<!-- Base sprite (kept visible for alpha/soft edges) -->
		<img 
			class="pen-img"
			:src="imageMaskLoaded ? imageDetails.penImage : spriteSrc"
			alt=""
			draggable="false"
		/>

		<template v-if="showGlow">

			<!-- glowing rectangles unless we have a masked-image present -->
			<div class="glow-wrapper blur20">
				<div 
					class="glow" 
					:class="{'mask-mode': imageMaskLoaded}"
					:style="imageMaskLoaded ? {
						'-webkit-mask-image': `url(${imageDetails.penMask})`,
						'mask-image': `url(${imageDetails.penMask})`,				
					} : {}"
				/>
			</div>
			<div class="glow-wrapper blur3">
				<div 
					class="glow"
					:class="{'mask-mode': imageMaskLoaded}"
					:style="imageMaskLoaded ? {
						'-webkit-mask-image': `url(${imageDetails.penMask})`,
						'mask-image': `url(${imageDetails.penMask})`,				
					} : {}"
				/>
			</div>
		</template>

		<!-- Nickname label -->
		<div 
			class="pen-name"
			:style="{ transform: `translateX(-50%) rotate(${-penTransform.theta}deg)` }"
		>{{ nickNameClean }}</div>
	</div>

</template>
<script setup>

// vue
import { ref, onMounted, onBeforeUnmount, shallowRef, computed, watch, nextTick } from 'vue'

// our app
import { usePenMasking } from '../composables/usePenMasking';
import { censorUsername } from '../js/censorUsername';

// props
const props = defineProps({

	// room info, including if the pen should be a custom image
	roomDetails: {
		type: Object,
		required: true,
	},	

	// pen color
	color: {
		type: String,
		required: true,
	},

	// optional opacity override (0-1)
	opacity: {
		type: Number,
		default: 1,
	},

	// pen transform info (x, y, rotation)
	penTransform: {
		type: Object,
		required: true,
	},

	// pen size (its as square so only one edge needed)
	penSize: {
		type: Number,
		default: 256,
		required: false,
	},

	// user name for pen
	nickName: {
		type: String,
		default: 'anonymous',
		required: false,
	},

	// true if we should smooth/xy positions
	smoothMotion: {
		type: Boolean,
		default: false,
		required: false,
	},
});

// cleaned username
const nickNameClean = computed(() => censorUsername(props.nickName));

// true when we should show the glow (only if opacity > 0 and color is not black)
const showGlow = ref(true);

// true if we should use the masking image for the glow
const imageMaskLoaded = ref(false);

// pen masking composable
const { getPenImages } = usePenMasking();

// Reference to root element of the PenLight
const rootEl = ref(null);

// store 
const imageDetails = shallowRef(null);

// your mask image (or canvas/bitmap)
const imgMaskImage = ref(null);      

// save our last colored image for re-use
let lastColor = '';
let lastImage = null;


// time out between color changes, because broken on mobile
watch(()=>props.color, (newVal) => {
	
	// hide for 100 ms
	showGlow.value = false;
	setTimeout(() => {
		showGlow.value = true;
	}, 100);

}, { immediate: true });


/**
 * The sprite image to use for penlights
 * 
 * If none is provided in the room details, we'll load the default penlight
 */
const spriteSrc = computed(() => {

	// if will be a base64 data URL if provided
	const b64 = props.roomDetails?.penlightSprite;
	return b64 ? `${b64}` : '/img/default_light.png';
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
 */
const penStyle = computed(() => {

	// dimensions & position
	const size = props.penSize;
	const pxX = props.penTransform.x;
	const pxY = props.penTransform.y;

	// center the sprite at pxX/pxY
	const tx = pxX - size / 2;
	const ty = pxY - size / 2;

	// rotation
	const theta = props.penTransform.theta;

	// return computed style
	return {
		left: `${pxX}px`,
		top: `${pxY}px`,
		width: `${size}px`,
		height: `${size}px`,
		transform: `translate(-50%, -80%) rotate(${theta}deg)`,
		opacity: props.opacity,
		'--beam-color': `#${props.color}`
	};
});


// compute the image mask URL if we have one
onMounted(async ()=>{

	// check if we should use a custom pen image with masking
	const roomCode = props.roomDetails.code;
	imageDetails.value = await getPenImages(roomCode, spriteSrc.value, 255);
	imageMaskLoaded.value = imageDetails.value?.maskingMode || false;

	// // if we have a mask, preload it
	if (imageMaskLoaded.value && imageDetails.value?.penMask) {
		imgMaskImage.value = new Image();
		imgMaskImage.value.src = imageDetails.value.penMask;
		await new Promise((resolve, reject) => {
			imgMaskImage.value.onload = () => resolve(true);
			imgMaskImage.value.onerror = () => reject(false);
		});
	}
});


/**
 * Colorize a mask image with the given hex color.
 * Caches the last result for efficiency.
 * 
 * @param {HTMLImageElement} img - The source mask image (must be loaded)
 * @param {string} hex - The hex color string (e.g. '#ff0000')
 * @returns {HTMLImageElement} - A new <img> element with the colored result
 */
function colorImage(img, hex) {

	// return cached if same color
	if(hex===lastColor && lastImage!=null)
		return lastImage;
	
	// require a ready <img>
	if (!(img instanceof HTMLImageElement)) throw new TypeError('colorImage: expected HTMLImageElement');
	if (!img.complete || img.naturalWidth === 0) throw new Error('colorImage: image not loaded');

	// get image size & make matching offscreen canvas
	const w = img.naturalWidth;
	const h = img.naturalHeight;
	const canvas = document.createElement('canvas');
	canvas.width = w;
	canvas.height = h;
	const ctx = canvas.getContext('2d');

	// draw original mask to get its alpha
	ctx.clearRect(0, 0, w, h);
	ctx.drawImage(img, 0, 0, w, h);

	// fill with new color, keep original alpha
	ctx.globalCompositeOperation = 'source-in';
	ctx.fillStyle = hex;
	ctx.fillRect(0, 0, w, h);

	// back to normal comp mode
	ctx.globalCompositeOperation = 'source-over';

	// return a same-type <img> that you can draw immediately
	const out = new Image();
	out.src = canvas.toDataURL(); // data URL, no async/await needed

	lastImage = out;
	lastColor = hex;
	return out;
}


/**
 * Draw the trail for this penlight.
 *
 * @param {CanvasRenderingContext2D} ctx - Canvas 2D context
 */
 function drawPenTrail(ctx) {
	
	if (!rootEl.value)
		return;

	const el = rootEl.value;
	const rect = el.getBoundingClientRect();
	const style = window.getComputedStyle(el);
	const transform = style.transform;
	
	// Get props and image mask ref
	const { penSize, color } = props;

	// const imageMask = imgMaskImage.value;
	if(imgMaskImage.value==null)
		return;

	// get colored image to dra
	const imageMask = colorImage(imgMaskImage.value, `#${color}`);

	// Fallback if no transform, just draw the rect
	if (!transform || transform === 'none') {
		ctx.strokeStyle = `#${color}`;
		ctx.lineWidth = 1;
		ctx.strokeRect(rect.left, rect.top, rect.width, rect.height);
		return;
	}

	// Parse matrix
	const match = transform.match(/^matrix\((.+)\)$/);
	if (!match) {
		console.warn('No valid matrix:', transform);
		ctx.strokeStyle = `#${color}`;
		ctx.strokeRect(rect.left, rect.top, rect.width, rect.height);
		return;
	}
	const [a, b] = match[1].split(',').map(Number);
	
	// Calculate the interpolated rotation angle in radians from the matrix
	const theta = Math.atan2(b, a);

	// Get center point of the rect (which you confirmed is correct)
	const centerX = rect.left + rect.width / 2;
	const centerY = rect.top + rect.height / 2;

	// Pen size comes from the component props
	const halfSize = penSize / 2;

	// Draw the image mask instead of the box
	if (imageMask && imageMask.complete) {
		
		ctx.save();

		// Translate context to the center of the element
		ctx.translate(centerX, centerY);

		// Rotate the context by the computed angle
		ctx.rotate(theta);

		// Draw the image centered, with some initial alpha
		// ctx.globalAlpha = 0.15;
		ctx.drawImage(imageMask, -halfSize, -halfSize, penSize, penSize);

		// Restore the context to prevent affecting other drawings
		ctx.restore();

	} 
	
	if(false){

		// return;

		// Fallback to drawing the box if the image mask is not loaded
		ctx.strokeStyle = `#${color}`;
		ctx.lineWidth = 1;
		ctx.beginPath();
		const corners = [
			{ x: -halfSize, y: -halfSize },
			{ x: halfSize, y: -halfSize },
			{ x: halfSize, y: halfSize },
			{ x: -halfSize, y: halfSize }
		];
		const cosTheta = Math.cos(theta);
		const sinTheta = Math.sin(theta);
		const transformed = corners.map(pt => ({
			x: pt.x * cosTheta - pt.y * sinTheta + centerX,
			y: pt.x * sinTheta + pt.y * cosTheta + centerY
		}));
		ctx.moveTo(transformed[0].x, transformed[0].y);
		for (let i = 1; i < transformed.length; i++) {
			ctx.lineTo(transformed[i].x, transformed[i].y);
		}
		ctx.closePath();
		ctx.stroke();
	}
}


// expose method so pen trail renderer can call it
defineExpose({
	drawPenTrail
});

</script>
<style lang="scss" scoped>

	// styles for a pen object
	.pen {

		// always absolutely positioned from the coordinates we get from the server
		position: absolute;

		// don't interact w/ mouse
		pointer-events: none;

		// slightly below center like input component
		transform-origin: 50% 50%; 
		will-change: transform, opacity;

		// smooth movement/rotation
		transition: 
			transform 0.1s linear,
			opacity 0.5s ease;

		// smooth x & y with a class toggle
		&.use-motion-smoothing {
			transition: 
				left 0.1s linear,
				top 0.1s linear,
				transform 0.1s linear,
				opacity 0.5s ease;

		}// &.use-motion-smoothing

		// base sprite image
		.pen-img {
			display: block;
			width: 100%;
			height: 100%;
			pointer-events: none;
			user-drag: none;
			-webkit-user-drag: none;

		}// .pen-img

		// Nickname label below the sprite
		.pen-name {

			// fixed
			position: absolute;

			// force center on bottom
			left: 50%;
			top: calc(100% - 8px);
			/* transform: translateX(-50%); */

			transition: 
			transform 0.1s linear,
			opacity 0.5s ease;
			
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

		// wrapper to blur the glows
		.glow-wrapper {

			// fill over entire image
			position: absolute;
			inset: 0;

			// for debug
			/* border: 1px solid red; */

			// glow bar if we're not using image masking
			.glow {

				// fixed position over the pen
				position: absolute;
				inset: 0px 40% 38% 40%;

				border: 2px solid red;

				// nice n round on top
				border-radius: 20px 20px 0 0;

				// disable
				pointer-events: none;

				// glowing rectangle
				background: var(--beam-color, #00abae);
				
				// default blend mode
				filter: blur(20px);
				mix-blend-mode: screen;

				// second glow layer
				&.g2 {
					filter: blur(3px);
					mix-blend-mode: screen;
				}

				// if we're in masking mode we'll have a mask image
				&.mask-mode {

					inset: 0px !important; // cover entire pen
					border-radius: 0px; 
					filter: blur(0px);
					mix-blend-mode: normal;

					// when in mask mode, cover the entire pen
					-webkit-mask-size: contain;
					-webkit-mask-repeat: no-repeat;
					-webkit-mask-position: center bottom;
					mask-size: contain;
					mask-repeat: no-repeat;
					mask-position: center bottom;
					mask-mode: alpha;
				}// &.mask-mode

			}// .glow

			// two layers blur
			&.blur20 {
				filter: blur(20px);
				mix-blend-mode: screen;
			}
			&.blur3 {
				filter: blur(5px);
				mix-blend-mode: multiply;
			}

		}// .glow-wrapper

	}// .pen

</style>
