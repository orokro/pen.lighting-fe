<!-- 
	App.vue
	-------

	Main app page
-->
<template>

	<!-- our header & logo nav-bar -->
	<Header/>
	

	<!-- 👇 This is where the current route component renders -->
	<main class="main-content" align="center">
		<RouterView />
	</main>

	<br/>
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
		background: url('/img/bg_pattern_2.png') repeat center center fixed;

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


	// main content
	.main-content {

		// spacing & center
		margin: 60px auto 40px auto;
		padding: 40px;
		
		position: relative;
		left: 5px;

		// white background w/ some transparency
		background: rgba(255,255,255,0.8);
		background: #D9F0EE;
		border-radius: 30px;
		/* box-shadow: 0 0 12px rgba(0,0,0,0.2); */

		border-right: 10px solid #9ACBC7;
		border-bottom: 10px solid #9ACBC7;

		// max width so it doesn't get too wide on big screens
		max-width: 620px;

		// main column inside the main content area
		.main-column {
			max-width: 100px;
		}

		// text settings
		font-size: 30px;
		font-family: "Permanent Marker", sans-serif;
		font-weight: 400;
		font-style: normal;
		color:rgb(3, 90, 92);
	}// .main-content

</style>
