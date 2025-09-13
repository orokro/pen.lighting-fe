<!--
	PenLight.vue
	------------

	Re-usable component for both the user room & the OBS room
-->
<template>

	<!-- outermost wrapper -->
	<div
		class="pen"
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

		<!-- Tint layer: colors only opaque pixels using mask -->
		<div 
			class="pen-tint"
			:style="penTintStyle"
		>
		</div>

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
		required: true,
	},

	// user name for pen
	nickName: {
		type: String,
		required: true,
	},
});


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
		width: `${size}px`,
		height: `${size}px`,
		transform: `translate(${tx}px, ${ty}px) rotate(${theta}deg)`,
		opacity: props.opacity,
		'--beam-color': `#${props.color}`
	};
});


/**
 * CSS style for the tint overlay of a penlight
 * 
 * This uses the sprite as a mask, so only opaque pixels are colored.
 */
const penTintStyle = computed(()=>{

	const hex = props.color;
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
});

</script>
<style lang="scss" scoped>

	// styles for a pen object
	.pen {

		// always absolutely positioned from the coordinates we get from the server
		position: absolute;
		top: 0;
		left: 0;

		// slightly below center like input component
		transform-origin: 50% 60%; 
		will-change: transform, opacity;

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

</style>
