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
			ref="roomCodeInput"
			v-model="roomCode"
			type="text"
			placeholder="Room Code"
			class="room-code-input big-input"
			maxlength="6"
			@input="onRoomCodeInput"
		/>

		<!-- optional password row -->
		<div 
			class="password-row row"
			:class="{ expanded: showPasswordRow }"
		>
			<div class="row-contents">
				<div class="text-row">
					Enter private room PW:
				</div>
				<input
					ref="passwordInput"
					v-model="password"
					type="text"
					placeholder="Password"
					class="room-code-input big-input"
					:maxlength="pwLength || null"
					@input="onPasswordInput"
				/>
			</div>
		</div>

		<!-- nick name row -->
		<div 
			class="nick-row row"
			:class="{ expanded: showNickRow }"
		>
			<div class="row-contents">
				<div class="text-row">
					Pick a nick:
				</div>
				<input
					ref="nickInput"
					v-model="nickname"
					type="text"
					placeholder="Nickname"
					class="room-code-input big-input"
					maxlength="16"
					@input="onNickInput"
				/>
			</div>
		</div>

		<!-- join row -->
		<div 
			class="join-row row"
			:class="{ expanded: showJoinRow }"
		>
			<div class="row-contents">
				<div class="text-row">
					Rock & roll!
				</div>

				<button 
					class="join-button big-button"
					:disabled="!canJoin || joining"
					@click="onJoinClick"
				>
					~~ Join Room ~~
				</button>
			</div>
		</div>

	</div>
</template>
<script setup>

// vue
import { ref, shallowRef, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router';
import { useRoomSession } from '@/composables/useRoomSession' // you said you replaced it with the fixed version

/**
 * Flow:
 * 1) User types roomCode (when length === 6 → GET /rooms/:code)
 * 2) If isProtected → show password row (pwLength tells required chars)
 * 3) When password reaches pwLength → POST /users/join/:code { password, nick:'' }
 * 4) If OK → show nickname row
 * 5) When nickname non-empty → show Join button row
 * 6) Click Join → POST /users/join/:code { password, nick } → saveRoomSession → route to /room/:code
 *
 * Race handling:
 * - Each request uses AbortController + monotonic sequence. If inputs change, cancel in-flight and hide downstream rows.
 * - Changing roomCode resets password visibility & clears password, hides nick/button (keeps nick text per your rule).
 */

// ------------------------------
// reactive form state
// ------------------------------
const roomCode = ref('')
const password = ref('')
const nickname = ref('')

// visibility for rows
const showPasswordRow = ref(false)
const showNickRow = ref(false)
const showJoinRow = ref(false)

// derived / metadata
const roomIsProtected = ref(false)
const pwLength = ref(null) // number | null
const joining = ref(false)

// optional errors (won’t affect your styles)
const roomError = ref('')
const passwordError = ref('')

// DOM refs for autofocus
const roomCodeInput = ref(null)
const passwordInput = ref(null)
const nickInput = ref(null)

// router + room session
const router = useRouter()
const { saveRoomSession } = useRoomSession()

// if we have a roomCode param, prefill it
const route = useRoute()

onMounted(() => {
	if (route?.query?.room_code) {
		console.log('room code', route.query.room_code)
		roomCode.value = String(route.query.room_code || '').trim().slice(0, 6);
	}

	onRoomCodeInput();
});


const envAPIUrl = import.meta.env.VITE_API_URL;
const envWsUrl = import.meta.env.VITE_WS_URL;
const envAppURL = import.meta.env.VITE_APP_URL;

// ------------------------------
// net request cancellation
// ------------------------------
let roomFetchCtrl = null
let roomFetchSeq = 0

let pwFetchCtrl = null
let pwFetchSeq = 0


// ------------------------------
// computed-ish rule for Join row
// ------------------------------
const canJoin = shallowRef(false)
watch([showNickRow, nickname], () => {
	const ok = !!showNickRow.value && String(nickname.value || '').trim().length > 0
	canJoin.value = ok
	showJoinRow.value = ok
}, { immediate: true })


// ------------------------------
// input handlers
// ------------------------------
function onRoomCodeInput () {
	roomError.value = ''
	passwordError.value = ''

	// changing room invalidates downstream state
	cancelRoomLookup()
	cancelPasswordCheck()
	resetPasswordRow()
	resetNickAndJoinVisibility({ keepNickValue: true }) // per requirement

	const code = String(roomCode.value || '').trim()
	if (code.length === 6) {
		lookupRoom(code)
	}
}

function onPasswordInput () {
	passwordError.value = ''
	cancelPasswordCheck()
	// if they edit pw after validation, hide nick/button until revalidated
	hideNickAndJoin()

	if (!roomIsProtected.value || !pwLength.value) return

	const code = String(roomCode.value || '').trim()
	const pw = String(password.value || '')
	if (code.length === 6 && pw.length === pwLength.value) {
		validatePassword(code, pw)
	}
}

function onNickInput () {
	// nothing here — watcher above toggles join visibility
}

// ------------------------------
// helpers (visibility & resets)
// ------------------------------
function resetPasswordRow () {
	showPasswordRow.value = false
	roomIsProtected.value = false
	pwLength.value = null
	password.value = ''
}
function resetNickAndJoinVisibility ({ keepNickValue }) {
	hideNickAndJoin()
	if (!keepNickValue) nickname.value = ''
}
function hideNickAndJoin () {
	showNickRow.value = false
	showJoinRow.value = false
}
function focusPassword () {
	nextTick(() => passwordInput.value?.focus?.())
}
function focusNick () {
	nextTick(() => nickInput.value?.focus?.())
}

// ------------------------------
// network: GET /rooms/:code
// ------------------------------
async function lookupRoom (code) {
	cancelRoomLookup()
	roomFetchSeq++
	const seq = roomFetchSeq
	roomFetchCtrl = new AbortController()

	try {
		const res = await fetch(`${envAPIUrl}/rooms/${encodeURIComponent(code)}`, {
			method: 'GET',
			signal: roomFetchCtrl.signal
		})
		if (seq !== roomFetchSeq) return
		if (!res.ok) throw new Error(res.status === 404 ? 'Room not found' : 'Room lookup failed')

		const data = await res.json()
		// server adds isProtected; we also expect pwLength in your response contract
		roomIsProtected.value = !!data.isProtected
		pwLength.value = Number(data.pwLength) || null

		if (roomIsProtected.value) {
			showPasswordRow.value = true
			focusPassword()
		} else {
			showPasswordRow.value = false
			showNickRow.value = true
			focusNick()
		}
	} catch (err) {
		if (err?.name === 'AbortError') return
		roomError.value = err?.message || 'Room lookup failed'
		resetPasswordRow()
		hideNickAndJoin()
	} finally {
		cancelRoomLookup()
	}
}

function cancelRoomLookup () {
	if (roomFetchCtrl) {
		try { roomFetchCtrl.abort() } catch {}
		roomFetchCtrl = null
	}
}

// ------------------------------
// network: POST /users/join/:code (password validate with blank nick)
// ------------------------------
async function validatePassword (code, pw) {
	cancelPasswordCheck()
	pwFetchSeq++
	const seq = pwFetchSeq
	pwFetchCtrl = new AbortController()

	try {
		const res = await fetch(`${envAPIUrl}/users/join/${encodeURIComponent(code)}`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ password: pw, nick: '' }),
			signal: pwFetchCtrl.signal
		})
		if (seq !== pwFetchSeq) return
		if (!res.ok) throw new Error(res.status === 403 ? 'Incorrect password' : 'Password check failed')

		const data = await res.json()
		if (!data?.ok) throw new Error('Password check failed')

		showNickRow.value = true
		focusNick()
	} catch (err) {
		if (err?.name === 'AbortError') return
		passwordError.value = err?.message || 'Password check failed'
		hideNickAndJoin()
	} finally {
		cancelPasswordCheck()
	}
}

function cancelPasswordCheck () {
	if (pwFetchCtrl) {
		try { pwFetchCtrl.abort() } catch {}
		pwFetchCtrl = null
	}
}

// ------------------------------
// join click → POST /users/join/:code (final)
// ------------------------------
async function onJoinClick () {

	if (!canJoin.value || joining.value)
		return;

	const code = String(roomCode.value || '').trim()
	const pw = String(password.value || '')
	const nick = String(nickname.value || '').trim()

	joining.value = true

	try {
		const res = await fetch(`${envAPIUrl}/users/join/${encodeURIComponent(code)}`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ password: pw, nick })
		})
		if (!res.ok) throw new Error('Failed to join room')
		const data = await res.json()
		if (!data?.ok) throw new Error('Failed to join room')

		// persist & navigate
		saveRoomSession(code, pw, nick)
		await router.push({ path: `/room/${code}` })

	} catch (err) {
		if (roomIsProtected.value) {
			passwordError.value = err?.message || 'Failed to join'
			hideNickAndJoin()
		} else {
			roomError.value = err?.message || 'Failed to join'
		}
	} finally {
		joining.value = false
	}
}

// ------------------------------
// lifecycle
// ------------------------------
onMounted(() => {
	nextTick(() => roomCodeInput.value?.focus?.())
})
onBeforeUnmount(() => {
	cancelRoomLookup()
	cancelPasswordCheck()
})
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

			
			
		}// .room-code-input

		// the best button you've seen all day
		.join-button {

			width: 400px;		

		}// .join-button

		@keyframes arrow-move {
			0% { transform: rotate(20deg); }
			50% { transform: rotate(40deg); }
			100% { transform: rotate(20deg); }
		}
		
		/* Row animation shell */
		.row {
			overflow: clip;            /* required to hide inner content during collapse */
			height: 0px;               /* default hidden */
			transition: height 0.33s ease;
		}
		.row.expanded {
			height: 186px;             /* expanded height you specified */
		}

		/* Inner content fade */
		.row-contents {
			opacity: 0;
			transition: opacity 0.33s ease;
			transition-delay: 0s;      /* on collapse: fade immediately */
		}
		.row.expanded > .row-contents {
			opacity: 1;
			transition-delay: 0.33s;   /* wait until row expansion finishes */
		}

	}// .home-view

</style>
