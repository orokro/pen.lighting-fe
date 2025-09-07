<!--
	HomeView.vue
	------------

	The home page for the site /
-->
<template>

	<div class="home-view">
		
		<!-- call to action text & animated arrow -->
		<div class="text-row">
			Join a room! <span class="material-icons arrow">redo</span>
		</div>

		<!-- mandatory room code box -->
		<input
			type="text"
			placeholder="Room Code"
			class="room-code-input"
		/>

		<!-- optional password row -->
		<div class="password-row">

			<div class="text-row">
				Enter private room PW:
			</div>
			<input
				type="text"
				placeholder="Password"
				class="room-code-input"
			/>

		</div>

		<!-- nick name row -->
		<div class="nick-row">

			<div class="text-row">
				Pick a nick:
			</div>
			<input
				type="text"
				placeholder="Nickname"
				class="room-code-input"
			/>
		</div>

		<!-- join row -->
		<div class="join-row">

			<div class="text-row">
				Rock & roll!
			</div>

			<button class="join-button">
				~~ Join Room ~~
			</button>
		</div>


	</div>
</template>
<script setup>

// vue
import { ref } from 'vue'

</script>
<style lang="scss" scoped>

	.home-view {

		// CTA arrow
		.arrow {

			// for debug
			/* border: 1px solid red; */

			// rock that arrow
			animation: arrow-move 1s infinite;
			transform-origin: bottom center;
			position: relative;
			top: 8px;

			display: inline-block;
			font-size: 40px;
		}// .arrow

		// join text row
		.text-row {

			color:rgb(3, 90, 92);
			font-size: 1.5em;
		}

		// big ol' box
		.room-code-input {

			// box
			border-radius: 15px;
			border: 10px solid #00abae;
			width: 400px;

			// spacing
			margin-top: 0px;
			margin-bottom: 20px;
			padding: 20px 15px;

			// text
			font-size: 1.2em;
			text-align: center;
			&::placeholder {
				font-style: italic;
				font-family: "Permanent Marker", sans-serif;
				color: #999;
			}
			
		}// .room-code-input

		// the best button you've seen all day
		.join-button {

			// box
			border-radius: 15px;
			border: 10px solid #4787C3;
			background: #4787C3;
			width: 400px;

			// text
			color: white;
			font-size: 1.2em;
			font-family: "Permanent Marker", sans-serif;

			// spacing
			margin-top: 0px;
			margin-bottom: 20px;
			padding: 20px 30px;

			// hover effect
			cursor: pointer;
			transition:
				background 0.3s, color 0.3s,
				border 0.3s, color 0.3s;

			&:hover {
				background: hotpink;
				border: 10px solid hotpink;
				color: white;
			}

		}// .join-button

		@keyframes arrow-move {
			0% { transform: rotate(20deg); }
			50% { transform: rotate(40deg); }
			100% { transform: rotate(20deg); }
		}
		

	}// .home-view

</style>
