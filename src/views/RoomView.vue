<!--
	RoomView.vue
	------------

	This is the page that is shown to chat who join a room
	for the url /room/:room_code
-->
<template>

	<!-- show connecting message until we're ready-->
	<template v-if="userRoomState==null || roomDetails==null">

		Connecting...

	</template>
	<template v-else>

		<!-- pretty much all the magic happens in this component -->
		<PenRoom 
			:roomDetails="roomDetails" 
			:userRoomState="userRoomState" 
		/>

	</template>
</template>
<script setup>

// vue
import { ref, onMounted, onBeforeUnmount, shallowRef } from 'vue'
import { useRoute, useRouter } from 'vue-router';

// components
import PenRoom from '@/components/PenRoom.vue';

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
const envAPIUrl = import.meta.env.VITE_API_URL;
const envWsUrl = import.meta.env.VITE_WS_URL;
const envAppURL = import.meta.env.VITE_APP_URL;

// our user room state
const userRoomState = shallowRef(null);

const props = defineProps({ room_code: String });

/**
 * When the component is mounted, create our UserRoomState to connect to the backend
 */
onMounted(async () => {

	// if we don't have session details, kick them back to join page
	if (!sessionDetails.value) {
		router.push({ name: 'home', query: { room_code: roomCode } });
		return;
	}

	// make our obs room state
	userRoomState.value = new UserRoomState(
		roomCode, 
		sessionDetails.value.username,
		sessionDetails.value.roomPwd,
		envWsUrl,		
	);

	// get our room details
	roomDetails.value = await useRoomDetails();
});


/**
 * When the component is unmounted, disconnect from our UserRoomState
 */
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
