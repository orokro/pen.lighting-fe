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

// store 
const imageDetails = shallowRef(null);

// compute the image mask URL if we have one
onMounted(async ()=>{

	// check if we should use a custom pen image with masking
	const roomCode = props.roomDetails.code;
	imageDetails.value = await getPenImages(roomCode, spriteSrc.value, 255);
	imageMaskLoaded.value = imageDetails.value?.maskingMode || false;

});

/**
 * Draw the trail for this penlight.
 * Uses getBoundingClientRect() to get the animated DOM position/size,
 * then renders a red rectangle at that position.
 *
 * @param {CanvasRenderingContext2D} ctx - Canvas 2D context
 */
 function drawPenTrail(ctx) {
	
	if (!rootEl.value) 
		return;

	// Get live bounding box (reflects CSS transitions/animations)
	const rect = rootEl.value.getBoundingClientRect();

	// Draw rectangle
	ctx.strokeStyle =  `#${props.color}`;
	ctx.lineWidth = 1;
	ctx.strokeRect(rect.left, rect.top, rect.width, rect.height);
}

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
		transform-origin: 50% 60%; 
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
