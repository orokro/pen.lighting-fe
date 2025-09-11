<!--
	RoomView.vue
	------------

	This is the page that is shown to chat who join a room
	for the url /room/:room_code
-->
<template>

	<div>
		<pre>{{ JSON.stringify(sessionDetails, null, 2) }}</pre>
	</div>

</template>
<script setup>

// vue
import { ref, shallowRef } from 'vue'
import { useRoute, useRouter } from 'vue-router';

// get the state of the room from our store
import { useRoomSession } from '@/composables/useRoomSession' // you said you replaced it with the fixed version

const { getRoomSession } = useRoomSession();

// get the room code from the URL
const route = useRoute();
const router = useRouter();
const roomCode = route.params.room_code;


// get session details
const sessionDetails = shallowRef(getRoomSession(roomCode));

</script>
<style lang="scss" scoped>

</style>
