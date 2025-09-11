<!--
	ObsView.vue
	-----------

	This is the page that is meant to be shown on the OBS browser source
	for the url /obs/:room_code
-->
<template>

	<template v-if="obsRoomState==null || roomDetails==null">	
		Connecting...
	</template>
	<template v-else>
		<OBSRoom 
			:roomDetails="roomDetails" 
			:users="obsRoomState.usersListRef.value"
		/>
	</template>
	<template v-if="false">

		Connected!

		<pre>{{ JSON.stringify(roomDetails, null, 2) }}</pre>
		
		<br/>
		<template v-for="(user, index) in obsRoomState.usersListRef.value" :key="index">

			<pre>{{ JSON.stringify(user, null, 2) }}</pre>
			
		</template>

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
const apiUrl = 'wss://api.pen.lighting/ws';

const props = defineProps({ room_code: String });

onMounted(async () => {

	// make our obs room state
	obsRoomState.value = new OBSRoomState(roomCode, apiUrl);

	// get our room details
	roomDetails.value = await useRoomDetails();
});

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
