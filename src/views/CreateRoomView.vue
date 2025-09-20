<!--
	CreateRoomView.vue
	------------------

	The page that allows a user to create a room
-->
<template>

	<div class="create-room-view">

		<div class="page-title" align="center">Create a Room!</div>

		<!-- reusable form for both this page & edit page -->
		<RoomForm v-model="formData" />

		<!-- create row -->
		<div class="create-row">

			<button 
				class="join-button big-button"
				@click="submit"
			>
				Create Room
			</button>
		</div>

	</div>

</template>
<script setup>

// vue stuffs
import { reactive, toRaw, unref, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useEditCodes } from '@/composables/useEditCodes';
const router = useRouter();

// components
import RoomForm from '@/components/RoomForm.vue';

// so we can store the response editCode & retrieve it later (for this room)
const { saveEditCode } = useEditCodes();

// object w/ all the user customizable data for the Room form
const formData = reactive({
	name: '',
	password: '',
	themeColor: '00ABAE',
	showCode: 'bottom-left',
	penColors: [],
	penlightSprite: null,
	duplicateUsers: false,
	duplicationThreshold: 10,
	maxConcurrent: 100,	
});

// base URL based on ENV
const envAPIUrl = import.meta.env.VITE_API_URL;
const envWsUrl = import.meta.env.VITE_WS_URL;
const envAppURL = import.meta.env.VITE_APP_URL;


// handle form submit
async function submit() {

	try {

		// safety check
		const payload = JSON.stringify(toRaw(unref(formData))) 

		// Call your API (adjust payload/endpoint to your actual schema)
		const res = await fetch(`${envAPIUrl}/rooms`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: payload
		});

		// if ok
		if (!res.ok)
			throw new Error(`Create failed (${res.status})`);
		
		// get our response data, which will include the room
		const data = await res.json();

		// Expecting { code, editCode } from your API
		const code = data.code
		const editCode = data.editCode

		// 1) stash editCode for this room
		saveEditCode(code, editCode)

		// 2) navigate to the edit page - it will recover the editCode from our store
		await router.replace({ name: 'edit', params: { room_code: code } });
		// router.replace({ name: 'edit', params: { room_code: code } })

	} catch (e) {

		console.log(e);
	} finally {

	}
}

</script>
<style lang="scss" scoped>

	.create-room-view {

		// the row w/ our create button
		.create-row {

			margin-top: 40px;
		}// .create-row

	}// .create-room-view

	form {
		display: grid;
		gap: .75rem;
		max-width: 420px;
	}

	input {
		padding: .5rem;
	}

	button {
		padding: .5rem .75rem;
	}

</style>
