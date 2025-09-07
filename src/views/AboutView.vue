<!--
	AboutView.vue
	-------------

	The simple about page that shows with the /about route
-->
<template>

	<div>
		<span class="hue-rotate">Pen.Lighting</span> is the glow of the crowd in digital form — letting fans and streamers light up the show together.
		<br/><br/>
		Every streamer dreams of seeing the crowd light up when the beat drops. <span class="hue-rotate">Pen.Lighting</span> brings that feeling online. Fans can wave, color, and customize their penlights, filling the screen with energy that performers can feel back. It’s more than an audience — it’s a shared moment
		<br/><br/>
		Website design by <a href="http://gmiller.net" target="_blank" rel="noopener">Greg Miller</a>.
		<br/><br/>
		<span class="teal">Copyright © 2025 Greg Miller. All rights reserved.</span>
	</div>
</template>
<script setup>

// vue
import { ref } from 'vue'

</script>
<style lang="scss" scoped>

	.pink {
		color: #e3008c;
	}
	.teal {
		color: #00abae;
	}

	.hue-rotate {
		// animation hue with a slow spin
		animation: hue-rotate 1s linear infinite;

		mix-blend-mode: difference;
	}

	@keyframes hue-rotate {
		from {
			filter: hue-rotate(0deg);
		}
		to {
			filter: hue-rotate(360deg);
		}
	}
</style>
