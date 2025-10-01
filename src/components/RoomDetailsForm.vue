<!--
	RoomDetailsForm.vue
	-------------------

	This wont be for editing, but rather, for displaying the details of a created room.

	It exists primarily to mirror the style of the RoomForm.vue component, so we
	can display:
		- The room's OBS link
		- The room's code
		- The room's edit code

	Above the edit form!
-->
<template>

	<!-- main outer most wrapper -->
	<div class="room-details-form">

		<div class="row-header">OBS Integration & Sharing Details</div>

		<!-- CODE -->
		<div class="row">
			<div class="label" for="roomCode">
				Room Code
				<div class="desc">Give this code out for people to join!</div>
			</div>
			<div class="field">
				<input
					id="roomCode"
					type="text"
					v-model="code"
					readonly
				/>
			</div>
		</div>

		<!-- EDIT CODE -->
		<div class="row">
			<div class="label" for="editCode">
				Edit Code
				<div class="desc">Write this down if you wish to edit the room in the future!</div>
			</div>
			<div class="field">
				<input
					id="editCode"
					type="text"
					v-model="editCode"
					readonly
				/>
			</div>
		</div>

		<!-- OBS -->
		<div class="row row--full">
			OBS Link
			<div class="desc">Load this Link in OBS as a Browser Source!</div>
			<input
				id="obsLink"
				type="text"
				v-model="obsLink"
				readonly
			/>
		</div>	
		
		<!-- SHARE -->
		<div class="row row--full">
			Share Link
			<div class="desc">Give this link to chat! (e.g. pinned message)</div>
			<input
				id="shareLink"
				type="text"
				v-model="shareLink"
				readonly
			/>
		</div>	

	</div>
</template>
<script setup>

// vue & libs
import {  watch, ref, onMounted } from 'vue'


/**
 * v-model (object) — controlled component.
 * We only mutate props.modelValue when a field is valid.
 */
const props = defineProps({

	// data to display. one way so no need for model
	data: {
		type: Object,
		required: true,
		default: () => ({})
	}
});


// refs to populate the form fields
const code = ref('');
const editCode = ref('');
const obsLink = ref('');
const shareLink = ref('');

// function to update field data from prop
function updateFields() {
	if (props.data) {
		if (props.data.code) code.value = props.data.code;
		if (props.data.editCode) editCode.value = props.data.editCode;
		if (props.data.obsLink) obsLink.value = props.data.obsLink;
		if (props.data.shareLink) shareLink.value = props.data.shareLink;
	}
}


// emit event so we can update parent
watch(()=>props.data, (newVal, oldVal)=>{
	if (newVal)
		updateFields()
});

// on mounted, populate fields
onMounted(()=>{
	updateFields()
});

</script>
<style lang="scss" scoped>

	// the main outer wrapper for our form
	.room-details-form {

		// box & grid layout
		display: grid;
		grid-template-columns: 60% 40%;
		gap: 0.75rem 1rem;
		align-items: start;

		// rows are just a container for label + field
		.row { display: contents; }

		 /* Make this specific row a real grid item that spans both columns */
		.row--full {
			display: flex;            // stack its own children
			flex-direction: column;
			gap: 0.4rem;

			grid-column: 1 / -1;      // span across all columns
			font-size: 20px;
		}

		// to break up sections a bit
		.row-header {
			
			// span across both columns
			grid-column: 1 / -1;

			background: #00ABAE;
			background: #4787C3;
			color: white;

			border-radius: 10px;

			&:not(:first-child) { margin-top: 5.5rem; }
		}// .row-header

		// labels for the fields
		.label {

			// so we can stack on top
			display: flex;
			flex-direction: column;
			justify-content: start;
			
			text-align: right;
			font-weight: 600;
			padding-top: 0.4rem;

			font-size: 20px;

		}// .label

		// smaller desc line
		.desc {

			font-family: "Indie Flower", cursive;
			color: #00ABAE;
			font-size: 16px;
			font-weight: normal;
			
		}// .desc

		// the area that contains the input / widgets
		.field {

			// box
			justify-self: start;
			width: 100%;
		
		}// .field

		// common input styles
		input[type="text"],
		input[type="number"],
		select {

			width: 100%;
			padding: 0.5rem 0.6rem;

			border: 3px solid #d0d5dd;
			border-radius: 8px;
			outline: none;				
			
			// text
			font-family: monospace;
			font-size: 0.95rem;
			text-align: center;

			&:focus {
				border-color: #7c8df9;
				box-shadow: 0 0 0 3px rgba(124, 141, 249, 0.2);
			}

		}// input[type="text"], input[type="number"], select


	}// .room-details-form 

</style>
