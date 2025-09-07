<!--
	EditRoomView.vue
	----------------

	The page for editing rooms
-->
<template>

	<div class="p-4">

		<h1>Edit Room: {{ roomCode }}</h1>

		<div v-if="needsPrompt" class="mb-4">
			<p>Enter your edit code to continue:</p>
			<input v-model="inputCode" @keyup.enter="submitCode" />
			<button @click="submitCode">Submit</button>
			<p v-if="error" style="color:crimson">{{ error }}</p>
		</div>

		<div v-else>
			<p style="opacity:.7">Using edit code: {{ masked }}</p>

			<!-- your edit form lives here; use editCode.value in API calls -->
			<!-- Example: -->
			<!-- <RoomSettingsForm :roomCode="roomCode" :editCode="editCode" /> -->
		</div>
	</div>

</template>
<script setup>

// vue stuffs
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useEditCodes } from '@/composables/useEditCodes'

const route = useRoute()
const router = useRouter()
const roomCode = route.params.room_code

// so we can store/retrieve edit codes for rooms
const { getEditCode, saveEditCode } = useEditCodes()

const editCode = ref(null)
const needsPrompt = ref(false)
const inputCode = ref('')
const error = ref('')

const masked = computed(() => {
	if (!editCode.value) return ''
	// don’t show full secret in UI; adjust to preference
	return editCode.value.length <= 4
		? '••••'
		: `${editCode.value.slice(0, 2)}•••${editCode.value.slice(-1)}`
})

// when we mount, we gotta see if we can recover the 
onMounted(() => {

	// 1) from sessionStorage
	const fromStore = getEditCode(roomCode);
	if (fromStore) {
		editCode.value = fromStore;
		return;
	}

	// 3) otherwise, prompt
	needsPrompt.value = true;
});

async function submitCode() {
	error.value = ''
	const code = inputCode.value?.trim()
	if (!code) {
		error.value = 'Please enter a code.'
		return
	}

	// Optional: verify with API before proceeding (pseudo):
	// const ok = await verifyEditCode(roomCode, code)
	// if (!ok) { error.value = 'Invalid code'; return }

	editCode.value = code
	saveEditCode(roomCode, code)
	needsPrompt.value = false
}
</script>

<style scoped>

	.mb-4 {
		margin-bottom: 1rem;
	}

	input {
		padding: .5rem;
		margin-right: .5rem;
	}

	button {
		padding: .5rem .75rem;
	}
</style>