<!--
	ObsView.vue
	-----------

	This is the page that is meant to be shown on the OBS browser source
	for the url /obs/:room_code
-->
<template>

	<div>
		
	</div>
</template>
<script setup>

// vue
import { ref } from 'vue'

</script>
<style lang="scss">

	// replace body with nothing for OBS page (so it's transparent)
	body {

		// use our looping striped background
		background: none !important;

		// add a pseudo element thats covers the entire body & blends a color overlay
		&::before {
			content: '';
			background: none !important;
		}// &::before

	}// body

</style>
