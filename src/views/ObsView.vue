<!--
	ObsView.vue
	-----------

	This is the page that is meant to be shown on the OBS browser source
	for the url /obs/:room_code
-->
<template>

	<!-- show connecting message until we're read-->
	<template v-if="obsRoomState==null || roomDetails==null">	

		Connecting...

	</template>
	<template v-else>

		<!-- pretty much all the magic happens in this component -->
		<OBSRoom 
			:roomDetails="roomDetails" 
			:users="obsRoomState.usersListRef.value"
		/>
	</template>

</template>
<script setup>

// vue
import { ref, onMounted, onBeforeUnmount, shallowRef } from 'vue'
import { useRoute, useRouter } from 'vue-router';

// components
import OBSRoom from '../components/OBSRoom.vue';

// our app
import { useRoomDetails } from '../composables/useRoomDetails.js';
import { OBSRoomState } from '../js/OBSRoomState.js'

// when we mount we'll make a new OBSRoomState to connect to BE
const obsRoomState = shallowRef(null);

// fetch the room code from the URL
const route = useRoute();
const router = useRouter();
const roomCode = route.params.room_code;

// we'll load our room details in here
const roomDetails = ref(null);

// our hard-coded API url
const envAPIUrl = import.meta.env.VITE_API_URL;
const envWsUrl = import.meta.env.VITE_WS_URL;
const envAppURL = import.meta.env.VITE_APP_URL;


// define props
const props = defineProps({ 

	// the room code to join
	room_code: String
});


/**
 * When the component is mounted, create our OBSRoomState to connect to the backend
 */
onMounted(async () => {

	// get our room details
	const rd = await useRoomDetails();
	roomDetails.value = rd;

	// make our obs room state
	obsRoomState.value = new OBSRoomState(roomCode, roomDetails, envWsUrl);

});


/**
 * When the component is unmounted, disconnect from our OBSRoomState
 */
onBeforeUnmount(() => {

	// disconnect from our obs room state
	if (obsRoomState.value) {
		obsRoomState.value.destroy();
		obsRoomState.value = null;
	}
});

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
