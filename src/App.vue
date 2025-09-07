<!-- 
	App.vue
	-------

	Main app page
-->
<template>

	<!-- our header & logo nav-bar -->
	<Header/>
	

	<!-- 👇 This is where the current route component renders -->
	<main>
		<RouterView />
	</main>

</template>
<script setup>

// vue
import { ref } from 'vue'

// components
import Header from './components/Header.vue';

</script>
<style lang="scss">

	// global body styles
	body {

		// use our looping striped background
		background: url('/img/bg_pattern.png') repeat center center fixed;

		// add a pseudo element that covers the entire body & blends a color overlay
		&::before {
			content: '';
			position: fixed;

			top: 0; left: 0; right: 0; bottom: 0;
			background: #00abae;
			pointer-events: none;
			mix-blend-mode: overlay;

			z-index: -1;

		}// &::before
		
	}// body

</style>
