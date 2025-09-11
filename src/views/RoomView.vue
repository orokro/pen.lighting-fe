<!--
	RoomView.vue
	------------

	This is the page that is shown to chat who join a room
	for the url /room/:room_code
-->
<template>

	<div>
		<pre>{{ JSON.stringify(sessionDetails, null, 2) }}</pre>
		<pre>{{ JSON.stringify(roomDetails, null, 2) }}</pre>
	</div>

</template>
<script setup>

// vue
import { ref, onMounted, onBeforeUnmount, shallowRef } from 'vue'
import { useRoute, useRouter } from 'vue-router';

// our app
import { useRoomDetails } from '../composables/useRoomDetails.js';
import { useRoomSession } from '@/composables/useRoomSession' // you said you replaced it with the fixed version
import { UserRoomState } from '../js/UserRoomState.js';

// when we mount we'll make a new UserRoomState to connect to BE
const { getRoomSession } = useRoomSession();

// get the room code from the URL
const route = useRoute();
const router = useRouter();
const roomCode = route.params.room_code;

// get session details
const sessionDetails = shallowRef(getRoomSession(roomCode));

// we'll load our room details in here
const roomDetails = ref(null);

// our hard-coded API url
const apiUrl = 'wss://api.pen.lighting/ws';

// our user room state
const userRoomState = shallowRef(null);

onMounted(async () => {

	// make our obs room state
	userRoomState.value = new UserRoomState(
		roomCode, 
		sessionDetails.value.userName,
		sessionDetails.value.roomPwd,
		apiUrl,		
	);

	// for debug
	console.log('New UserRoomState:', userRoomState.value);

	// get our room details
	roomDetails.value = await useRoomDetails();
});

onBeforeUnmount(() => {

	// disconnect from our obs room state
	if (userRoomState.value) {
		userRoomState.value.destroy();
		userRoomState.value = null;
	}
});

</script>
<style lang="scss" scoped>

</style>
