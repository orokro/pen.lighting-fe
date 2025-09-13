<!--
	PenLight.vue
	------------

	Re-usable component for both the user room & the OBS room
-->
<template>

	<!-- outermost wrapper -->
	<div
		class="pen"
		:class="{ 'use-motion-smoothing': smoothMotion }"
		:style="penStyle"
		role="img"
	>
		<!-- Base sprite (kept visible for alpha/soft edges) -->
		<img 
			class="pen-img"
			:src="spriteSrc"
			alt=""
			draggable="false"
		/>

		<!-- glowing rectangles unless we have a masked-image present -->
		<template v-if="!imageMaskLoaded">
			<div class="glow"/>
			<div class="glow g2"/>
		</template>

		<!-- Nickname label -->
		<div class="pen-name">{{ nickName }}</div>
	</div>

</template>
<script setup>

// vue
import { ref, onMounted, onBeforeUnmount, shallowRef, computed } from 'vue'

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

// true if we should use the masking image for the glow
const imageMaskLoaded = ref(false);


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
		transform: `translate(-50%, -50%) rotate(${theta}deg)`,
		opacity: props.opacity,
		'--beam-color': `#${props.color}`
	};
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

		// glow bar if we're not using image masking
		.glow {

			// fixed position over the pen
			position: absolute;
			inset: 0px 40% 38% 40%;

			// nice n round on top
			border-radius: 20px 20px 0 0;
			// disable
			pointer-events: none;

			// glowing rectangle
			background: var(--beam-color, #00abae);
			filter: blur(20px);
			
			mix-blend-mode: screen;

			&.g2 {
				filter: blur(3px);
				mix-blend-mode: screen;
				
			}

		}// .glow
	}// .pen

</style>
