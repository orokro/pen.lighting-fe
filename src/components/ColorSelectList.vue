<!--
	ColorSelectList.vue
	-------------------

	Component to pick color for your penlight
-->
<template>

	<div class="color-select-list">

		<!--
			Button to open the color menu.
			The background is set to the currently selected color.
			The text "Pick Color" is displayed with contrast applied.
		-->
		<button
			class="color-button"
			:style="{ 
				backgroundColor: currentColor,
				color: contrastColor
			}"
			@click="toggleMenu"
		>
			Pick Color!
		</button>

		<!--
			Popup menu of swatches.
			Rendered only when menuOpen is true.
			Positioned above the button (bottom:100%).
		-->
		<div v-if="menuOpen" class="color-menu">
			<div
				v-for="(hex, index) in colors"
				:key="hex"
				class="color-swatch"
				:style="{ backgroundColor: '#' + hex }"
				@click="selectColor(index)"
			></div>
		</div>

	</div>
</template>
<script setup>

// vue
import { ref, computed, watch } from 'vue';

/**
 * Props
 * @prop {string[]} colors - List of hex strings (without '#') to render swatches for.
 * @prop {number} modelValue - Currently selected index.
 */
const props = defineProps({

	// list of hex colors (without #)
	colors: {
		type: Array,
		required: true
	},

	// currently selected index
	modelValue: {
		type: Number,
		required: true
	}
});

/**
 * Emits
 * @event change - Fired when a color index is selected, matches <select @change>.
 * @event update:modelValue - Used for v-model compatibility.
 */
const emit = defineEmits(['change', 'update:modelValue']);

// Whether the menu is currently open
const menuOpen = ref(false);

// Compute the currently selected color from props
const currentColor = computed(() => {
	return '#' + props.colors[props.modelValue];
});


/**
 * Determine a readable contrasting text color (black/white)
 * using relative luminance.
 *
 * @param {string} hex - Hex code (with #).
 * @returns {string} - "#000000" or "#FFFFFF"
 */
function getContrastColor(hex) {

	// Parse hex to RGB
	const r = parseInt(hex.substr(1, 2), 16);
	const g = parseInt(hex.substr(3, 2), 16);
	const b = parseInt(hex.substr(5, 2), 16);

	// Relative luminance (YIQ approximation)
	const yiq = (r * 299 + g * 587 + b * 114) / 1000;
	return yiq >= 128 ? '#000000' : '#FFFFFF';
}

// Compute the contrast color for the current color
const contrastColor = computed(() => getContrastColor(currentColor.value));


/**
 * Toggle menu open/close.
 */
function toggleMenu() {
	menuOpen.value = !menuOpen.value;
}


/**
 * Handle user selecting a color.
 * Emits the index as the change event (drop-in replacement for <select>).
 *
 * @param {number} index - Index of color in array.
 */
function selectColor(index) {
	emit('update:modelValue', index);
	emit('change', index);
	menuOpen.value = false;
}


// Close menu on outside click
function handleClickOutside(event) {
	const el = event.target.closest('.color-select-list');
	if (!el) {
		menuOpen.value = false;
	}
}

// so we can close the menu if user clicks outside
document.addEventListener('click', handleClickOutside);

</script>
<style lang="scss" scoped>

	// main container
	.color-select-list {

		position: relative;

		// Ensures button/menu stay stacked together
		display: inline-block;
		
		// the button that opens the menu
		.color-button {

			// box settings
			padding: 0.5rem 1rem;
			border: 3px solid gray;
			border-radius: 4px;

			// text settings
			font-size: 22px;
			font-weight: bold;
			text-align: center;

			// cursor
			cursor: pointer;

			// transitions
			transition: filter 0.2s ease;

			&:hover {
				filter: brightness(1.1);
			}

		}// .color-button

		// the popup menu
		.color-menu {

			// positioning
			position: absolute;
			bottom: 100%;
			left: 0;

			// box settings
			display: flex;
			flex-wrap: wrap;
			justify-content: center;
			gap: 0.25rem;
			margin-bottom: 0.5rem;
			padding: 0.5rem;
			background: black;
			border: 3px solid gray;
			border-radius: 4px;

			// shadow
			box-shadow: 0 2px 6px rgba(0,0,0,0.15);

			// z-index
			z-index: 10;

		}// .color-menu


		// individual color swatch
		.color-swatch {

			// box settings
			width: 60px;
			height: 60px;
			border-radius: 50%;

			// cursor
			cursor: pointer;

			// border
			border: 1px solid #888;

			// transition
			transition: transform 0.1s ease;

			&:hover {
				transform: scale(1.2);
			}

		}// .color-swatch

	}// .color-select-list

</style>
