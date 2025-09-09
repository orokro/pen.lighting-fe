<!--
	EditRoomView.vue
	----------------

	The page for editing rooms
-->
<template>

	<div class="edit-room-view">

		<!-- if we've just loaded we need to check our state, we'll show loading spinner -->
		<div v-if="displayState === STATE.LOADING" align="center">
			Loading...
		</div>

		<!-- if we need an edit code, show the prompt -->
		<div v-if="displayState === STATE.NEEDS_CODE" align="center">

			<div class="page-title mb-4">Enter Edit Code for Room {{ roomCode }}</div>
			<div v-if="error" class="error mb-4">{{ error }}</div>
			<input
				type="text"
				v-model="inputCode"
				placeholder="Edit Code"
				class="room-code-input mb-4"
			/>
			<br />
			<button 
				class="join-button big-button"
				@click="submitCode"
			>
				Edit Room
			</button>
		</div>
		
		<!-- otherwise, if we have a valid room -->
		<div v-if="displayState === STATE.VALID_ROOM">

			<!-- top section shows the useful details about room (not editable) -->
			<div class="page-title" align="center">Room {{ roomCode }} Details:</div>

			<!-- show the room details form -->
			<RoomDetailsForm :data="roomDetailsData" class="mb-4" />
			
			<br/><br/>
			<!-- section below is same as creation form-->
			<div class="page-title" align="center">Edit Room {{ roomCode }} Below:</div>

			<!-- reusable form for both this page & edit page -->
			<RoomForm v-model="formData" />

			<!-- create row -->
			<div class="update-row">

				<button 
					class="join-button big-button"
					@click="submit"
				>
					Update / Edit Room
				</button>
			</div>

		</div>

	</div>


</template>
<script setup>

// vue stuffs
import { reactive, toRaw, unref, ref, watch, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useEditCodes } from '@/composables/useEditCodes';

// components
import RoomForm from '@/components/RoomForm.vue';
import RoomDetailsForm from '@/components/RoomDetailsForm.vue';

const route = useRoute()
const router = useRouter()
const roomCode = route.params.room_code

// so we can store/retrieve edit codes for rooms
const { getEditCode, saveEditCode } = useEditCodes()

// object with room details
const roomDetailsData = reactive({
	code: roomCode,
	editCode: '',
	obsLink: '',
});

// object w/ all the user customizable data for the Room form
const formData = reactive({
	name: 'a room',
	password: '',
	themeColor: '00ABAE',
	showCode: 'bottom-left',
	penColors: [],
	penlightSprite: null,
	duplicateUsers: true,
	duplicationThreshold: 10,
	maxConcurrent: 100,	
});

// three states
const STATE = {
	LOADING: 'LOADING',
	NEEDS_CODE: 'NEEDS_CODE',
	VALID_ROOM: 'VALID_ROOM',
};

// initial state starts loading no matter what
const displayState = ref(STATE.LOADING)

const editCode = ref(null)
const needsPrompt = ref(false)
const inputCode = ref('')
const error = ref('')

// when we mount, we gotta see if we can recover the 
onMounted(() => {

	// 1) from sessionStorage
	const fromStore = getEditCode(roomCode);
	if (fromStore) {
		editCode.value = fromStore;

		// load the page data
		getPageData();
		return;
	}

	// 3) otherwise, prompt
	needsPrompt.value = true;
});


/**
 * Hit the API with our roomCode & editCode (if we have one) to see if we can load the room data
 */
async function getPageData(){

	// safety check
	const payload = JSON.stringify({
		editCode: editCode.value
	});

	// Call your API (adjust payload/endpoint to your actual schema)
	const res = await fetch(`https://api.pen.lighting/rooms/${roomCode}/edit`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: payload
	});

	// if ok
	if (!res.ok)
		throw new Error(`Create failed (${res.status})`);

	// get our response data, which will include the room
	const data = await res.json();

	// set room details
	roomDetailsData.code = data.code;
	roomDetailsData.editCode = data.editCode;
	roomDetailsData.obsLink = `https://pen.lighting/obs/${data.code}`;

	// update our form data
	formData.name = data.name;
	formData.password = data.password;
	formData.themeColor = data.themeColor;
	formData.showCode = data.showCode;
	formData.penColors = data.penColors;
	formData.penlightSprite = data.penlightSprite;
	formData.duplicateUsers = data.duplicateUsers;
	formData.duplicationThreshold = data.duplicationThreshold;
	formData.maxConcurrent = data.maxConcurrent;

	console.log(roomDetailsData);

	// now we have a valid room
	displayState.value = STATE.VALID_ROOM;
}


async function submitCode() {
	// error.value = ''
	// const code = inputCode.value?.trim()
	// if (!code) {
	// 	error.value = 'Please enter a code.'
	// 	return
	// }

	// // Optional: verify with API before proceeding (pseudo):
	// // const ok = await verifyEditCode(roomCode, code)
	// // if (!ok) { error.value = 'Invalid code'; return }

	// editCode.value = code
	// saveEditCode(roomCode, code)
	// needsPrompt.value = false
}

// handle form submit update
async function submit() {

	try {

		// safety check
		const rawFormData = toRaw(unref(formData));
		rawFormData.editCode = editCode.value;
		const payload = JSON.stringify(rawFormData);
		
		// Call your API (adjust payload/endpoint to your actual schema)
		const res = await fetch(`https://api.pen.lighting/rooms/${roomCode}`, {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: payload
		});

		// if ok
		if (!res.ok)
			throw new Error(`Create failed (${res.status})`);
		
		// get our response data, which will include the room
		const data = await res.json();

		console.log(data);

		// 2) navigate to the edit page - it will recover the editCode from our store
		await router.replace({ name: 'edit', params: { room_code: roomCode } });
		window.location.reload();
		
	} catch (e) {

		console.log(e);
	} finally {

	}
}

</script>
<style lang="scss" scoped>

	.edit-room-view {

		// the row w/ our create button
		.update-row {

			margin-top: 40px;
		}// .update-row

	}// .edit-room-view

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