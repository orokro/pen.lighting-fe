<!--
	CreateRoomView.vue
	------------------

	The page that allows a user to create a room
-->
<template>

	<div class="create-room-view">

		<!-- super barebone form -->
		<form v-if="false" @submit.prevent="submit">
			<label>
				Room Name
				<input v-model="name" placeholder="My Stream Room" />
			</label>

			<label>
				(Optional) Password
				<input v-model="password" type="password" />
			</label>

			<button type="submit" :disabled="loading">
				{{ loading ? 'Creating…' : 'Create' }}
			</button>
		</form>

		<p v-if="error" style="color:crimson">{{ error }}</p>
	</div>

</template>
<script setup>

// vue stuffs
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useEditCodes } from '@/composables/useEditCodes';
const router = useRouter();

// so we can store the response editCode & retrieve it later (for this room)
const { saveEditCode } = useEditCodes();

// form state
const name = ref('');
const password = ref('');
const loading = ref(false);
const error = ref('');

// handle form submit
async function submit() {

	loading.value = true;
	error.value = '';

	try {

		// Call your API (adjust payload/endpoint to your actual schema)
		const res = await fetch('https://api.pen.lighting/rooms', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ name: name.value, password: password.value || undefined })
		});

		if (!res.ok) {
			throw new Error(`Create failed (${res.status})`);
		}

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

		error.value = e.message || 'Unknown error'
	} finally {

		loading.value = false
	}
}

</script>
<style scoped>

	.create-room-view {

	}
	
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
