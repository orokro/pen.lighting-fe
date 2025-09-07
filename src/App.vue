<!-- 
	App.vue
	-------

	Main app page
-->
<template>

	<header style="padding: 1rem; border-bottom: 1px solid #eee;">
		<strong>pen.lighting</strong>
		<nav style="display:inline-flex; gap:.75rem; margin-left:1rem;">
			<RouterLink to="/">Home</RouterLink>
			<RouterLink to="/create">Create</RouterLink>
			<RouterLink to="/about">About</RouterLink>
			<RouterLink to="/help">Help</RouterLink>
		</nav>
	</header>

	<!-- 👇 This is where the current route component renders -->
	<main style="padding:1rem;">
		<RouterView />
	</main>

</template>
<script setup>

// vue
import { ref } from 'vue'

</script>
<style lang="scss" scoped>


</style>
