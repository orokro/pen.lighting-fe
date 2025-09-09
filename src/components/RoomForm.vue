<!--
	RoomForm.vue
	------------

	This will be the same form that is used on both the create & edit views.
-->
<template>

	<!-- main outer most wrapper -->
	<div class="room-form">

		<!-- NAME -->
		<div class="row">
			<label class="label" for="name">Name</label>
			<div class="field">
				<input
					id="name"
					type="text"
					:maxlength="64"
					v-model="localName"
					placeholder="(optional)"
					:class="{ invalid: !!errors.name }"
				/>
				<p v-if="errors.name" class="error">{{ errors.name }}</p>
			</div>
		</div>

		<!-- PASSWORD -->
		<div class="row">
			<label class="label" for="password">Password</label>
			<div class="field">
				<input
					id="password"
					type="text"
					:maxlength="64"
					v-model="localPassword"
					placeholder="(optional)"
					:class="{ invalid: !!errors.password }"
				/>
				<p class="hint">alphanumeric + common symbols, max 64</p>
				<p v-if="errors.password" class="error">{{ errors.password }}</p>
			</div>
		</div>

		<!-- THEME COLOR -->
		<div class="row">
			<label class="label" for="themeColor">Theme Color</label>
			<div class="field color-field">
				<input
					id="themeColor"
					type="color"
					v-model="themeColorInput"
					aria-label="Pick a theme color"
				/>
				<span class="hex-preview">#{{ model.themeColor || '000000' }}</span>
			</div>
		</div>

		<!-- SHOW CODE -->
		<div class="row">
			<label class="label" for="showCode">Show Code</label>
			<div class="field">
				<select id="showCode" :value="model.showCode" @change="setShowCode($event.target.value)">
					<option value="hidden">Hidden</option>
					<option value="top-left">Top Left</option>
					<option value="top-right">Top Right</option>
					<option value="bottom-left">Bottom Left</option>
					<option value="bottom-right">Bottom Right</option>
				</select>
			</div>
		</div>

		<!-- PEN COLORS -->
		<div class="row">
			<label class="label">Pen Colors</label>
			<div class="field">
				<div class="swatches">
					<button
						v-for="(c, i) in model.penColors"
						:key="i"
						type="button"
						class="swatch"
						:style="{ backgroundColor: '#' + c }"
						:title="'#' + c"
						@click="openEditMenu(i)"
					></button>

					<button type="button" class="add" @click="openAddPicker" title="Add color">+</button>

					<!-- Inline Add/Recolor Popover -->
					<div v-if="showAddPicker" class="popover">
						<input ref="addPickerRef" type="color" v-model="tempPick" />
						<div class="popover-actions">
							<button type="button" @click="confirmAddColor">Confirm</button>
							<button type="button" class="ghost" @click="cancelAddColor">Cancel</button>
						</div>
					</div>

					<!-- Simple per-swatch menu -->
					<div v-if="showEditPickerIndex >= 0" class="popover">
						<div class="popover-actions">
							<button type="button" class="danger" @click="deleteColor(showEditPickerIndex)">Delete</button>
							<button type="button" @click="startRecolor(showEditPickerIndex)">Recolor</button>
							<button type="button" class="ghost" @click="showEditPickerIndex = -1">Close</button>
						</div>
					</div>
				</div>
				<p class="hint">Click a swatch to delete or recolor. Values save without the #.</p>
				<p v-if="errors.penColors" class="error">{{ errors.penColors }}</p>
			</div>
		</div>

		<!-- SPRITE -->
		<div class="row">
			<label class="label">Penlight Sprite</label>
			<div class="field sprite-field">
				<div class="preview" v-if="model.penlightSprite">
					<img :src="model.penlightSprite" alt="Sprite preview" />
				</div>
				<div class="sprite-actions">
					<input
						ref="fileInputRef"
						type="file"
						accept="image/png"
						class="file-input"
						@change="handleSpritePick"
					/>
					<button type="button" class="ghost" @click="clearSprite" :disabled="!model.penlightSprite">
						Clear Image
					</button>
				</div>
				<p class="hint">PNG only. Resized to 256×256 client-side.</p>
			</div>
		</div>

		<!-- DUPLICATE USERS (toggle) -->
		<div class="row">
			<label class="label">Duplicate Users?</label>
			<div class="field">
				<label class="switch">
					<input type="checkbox" :checked="model.duplicateUsers" @change="toggleDuplicateUsers($event.target.checked)" />
					<span class="slider"></span>
				</label>
			</div>
		</div>

		<!-- DUPLICATION THRESHOLD -->
		<div class="row">
			<label class="label" for="dupThresh">Dupe Threshold</label>
			<div class="field">
				<input
					id="dupThresh"
					type="number"
					min="1"
					max="100"
					:value="model.duplicationThreshold"
					@input="setDuplicationThreshold($event.target.value)"
				/>
			</div>
		</div>

		<!-- MAX CONCURRENT -->
		<div class="row">
			<label class="label" for="maxConc">Max Concurrent</label>
			<div class="field">
				<input
					id="maxConc"
					type="number"
					min="1"
					:value="model.maxConcurrent"
					@input="setMaxConcurrent($event.target.value)"
				/>
			</div>
		</div>
	</div>
</template>
<script setup>

// vue & libs
import { reactive, computed, watch, ref, nextTick } from 'vue'
import { z } from 'zod'

/**
 * v-model (object) — controlled component.
 * We only mutate props.modelValue when a field is valid.
 */
const props = defineProps({
	modelValue: { type: Object, required: true },
	mode: { type: String, default: 'edit' }, // cosmetic only
})
const emit = defineEmits(['update:modelValue'])

const model = computed({
	get() { return props.modelValue },
	set(v) { emit('update:modelValue', v) },
})


/* ---------- Validation bits ---------- */
const HEX6 = /^[0-9A-Fa-f]{6}$/
const HEX6_WITH_HASH = /^#[0-9A-Fa-f]{6}$/
const NAME_RE = /^[0-9a-zA-Z,.! ]+$/
// relaxed “default” special symbols + alnum + space
const PASS_RE = /^[0-9A-Za-z ,.!\-_=+@#$%^&*(){}\[\]|\\:;"'<>,.?/~`]+$/

function validName(v) {
	return v === '' || (typeof v === 'string' && v.length <= 64 && NAME_RE.test(v))
}
function validPassword(v) {
	return v === '' || (typeof v === 'string' && v.length <= 64 && PASS_RE.test(v))
}


/* ---------- Local inputs (only commit when valid) ---------- */
const errors = reactive({
	name: '',
	password: '',
	penColors: '',
})

const localName = ref(model.value.name ?? '')
const localPassword = ref(model.value.password ?? '')

/* sync locals if parent replaces the model object */
watch(() => model.value.name, v => { if (v !== localName.value && validName(v ?? '')) localName.value = v ?? '' })
watch(() => model.value.password, v => { if (v !== localPassword.value && validPassword(v ?? '')) localPassword.value = v ?? '' })

/* commit name when valid */
watch(localName, v => {
	if (validName(v)) {
		errors.name = ''
		model.value.name = v
	} else {
		errors.name = 'Only 0-9 a-z A-Z , . ! and space; max 64 chars'
	}
})

/* commit password when valid */
watch(localPassword, v => {
	if (validPassword(v)) {
		errors.password = ''
		model.value.password = v
	} else {
		errors.password = 'Invalid characters or length > 64'
	}
})

/* Theme color: color input guarantees #RRGGBB, commit stripped uppercase */
const themeColorInput = computed({
	get() {
		const v = model.value.themeColor || ''
		return v ? `#${v}` : '#000000'
	},
	set(val) {
		const clean = (val || '').trim()
		if (HEX6_WITH_HASH.test(clean)) {
			model.value.themeColor = clean.slice(1).toUpperCase()
		}
		// ignore otherwise (shouldn't happen from native color input)
	},
})

/* Show code: select is always valid */
function setShowCode(val) {
	if (['hidden','top-left','top-right','bottom-left','bottom-right'].includes(val)) {
		model.value.showCode = val
	}
}

/* Pen colors: only add/replace valid 6-hex (no #) */
const showAddPicker = ref(false)
const addPickerRef = ref(null)
const showEditPickerIndex = ref(-1)
const tempPick = ref('#000000')

function openAddPicker() {
	showEditPickerIndex.value = -1
	tempPick.value = '#000000'
	showAddPicker.value = true
	nextTick(() => addPickerRef.value && addPickerRef.value.focus())
}

function confirmAddColor() {
	const hex = tempPick.value
	if (HEX6_WITH_HASH.test(hex)) {
		const v = hex.slice(1).toUpperCase()
		if (!model.value.penColors.includes(v)) model.value.penColors.push(v)
		errors.penColors = ''
	} else {
		errors.penColors = 'Pick a 6-digit hex color'
	}
	showAddPicker.value = false
}

function cancelAddColor() { showAddPicker.value = false }

function openEditMenu(i) {
	showEditPickerIndex.value = (showEditPickerIndex.value === i) ? -1 : i
}

function deleteColor(i) {
	model.value.penColors.splice(i, 1)
	showEditPickerIndex.value = -1
}

function startRecolor(i) {
	tempPick.value = `#${model.value.penColors[i]}`
	showEditPickerIndex.value = -1
	showAddPicker.value = true
	confirmAddColorOnce(
		() => {
			const hex = tempPick.value
			if (HEX6_WITH_HASH.test(hex)) {
				model.value.penColors[i] = hex.slice(1).toUpperCase()
			}
			showAddPicker.value = false
		},
		() => { showAddPicker.value = false }
	)
}

let confirmAddColorOnceCleanup = null
function confirmAddColorOnce(onConfirm, onCancel) {
	if (confirmAddColorOnceCleanup) confirmAddColorOnceCleanup()
	const origConfirm = confirmAddColor
	const origCancel = cancelAddColor
	confirmAddColor = () => { onConfirm(); cleanup() }
	cancelAddColor = () => { onCancel(); cleanup() }
	function cleanup() {
		confirmAddColor = origConfirm
		cancelAddColor = origCancel
		confirmAddColorOnceCleanup = null
	}
	confirmAddColorOnceCleanup = cleanup
}

/* Sprite: PNG -> 256x256 -> base64, commit only if processed */
const fileInputRef = ref(null)
async function handleSpritePick(e) {
	const file = e.target.files && e.target.files[0]
	if (!file) return
	if (file.type !== 'image/png') return
	const dataUrl = await readFileAsDataURL(file)
	const resized = await resizePngToSquare(dataUrl, 256)
	if (resized) model.value.penlightSprite = resized
}
function clearSprite() {
	model.value.penlightSprite = null
	if (fileInputRef.value) fileInputRef.value.value = ''
}
function readFileAsDataURL(file) {
	return new Promise((resolve, reject) => {
		const fr = new FileReader()
		fr.onload = () => resolve(fr.result)
		fr.onerror = reject
		fr.readAsDataURL(file)
	})
}
function resizePngToSquare(dataUrl, size = 256) {
	return new Promise((resolve) => {
		const img = new Image()
		img.onload = () => {
			const canvas = document.createElement('canvas')
			canvas.width = size
			canvas.height = size
			const ctx = canvas.getContext('2d')
			ctx.clearRect(0, 0, size, size)
			const scale = Math.min(size / img.width, size / img.height)
			const w = Math.round(img.width * scale)
			const h = Math.round(img.height * scale)
			const x = Math.floor((size - w) / 2)
			const y = Math.floor((size - h) / 2)
			ctx.imageSmoothingEnabled = true
			ctx.imageSmoothingQuality = 'high'
			ctx.drawImage(img, x, y, w, h)
			resolve(canvas.toDataURL('image/png'))
		}
		img.onerror = () => resolve(null)
		img.src = dataUrl
	})
}

/* Switch + numbers: coerce to valid ranges, commit immediately */
function toggleDuplicateUsers(v) {
	model.value.duplicateUsers = !!v
}
function setDuplicationThreshold(v) {
	const n = Number(v)
	if (Number.isFinite(n)) {
		const clamped = Math.max(1, Math.min(100, Math.trunc(n)))
		model.value.duplicationThreshold = clamped
	}
}
function setMaxConcurrent(v) {
	const n = Number(v)
	if (Number.isFinite(n)) {
		model.value.maxConcurrent = Math.max(1, Math.trunc(n))
	}
}
</script>
<style lang="scss" scoped>

	// the main outer wrapper for our form
	.room-form {

		// box & grid layout
		display: grid;
		grid-template-columns: 60% 40%;
		gap: 0.75rem 1rem;
		align-items: start;

		// rows are just a container for label + field
		.row { display: contents; }

		.label {
			justify-self: end;
			align-self: center;
			text-align: right;
			font-weight: 600;
			padding-top: 0.4rem;
		}// .label

		.field {
			justify-self: start;
			width: 100%;

			input[type="text"],
			input[type="password"],
			input[type="number"],


			select {

				width: 100%;
				padding: 0.5rem 0.6rem;
				border: 1px solid #d0d5dd;
				border-radius: 8px;
				font-size: 0.95rem;
				outline: none;

				&:focus {
					border-color: #7c8df9;
					box-shadow: 0 0 0 3px rgba(124, 141, 249, 0.2);
				}

				&.invalid { border-color: #e54848; }

			}// select

			.hint {

				margin-top: 0.35rem;
				font-size: 0.8rem;
				color: #667085;
			}// .hint

			.error {

				margin-top: 0.35rem;
				font-size: 0.82rem;
				color: #e54848;
				font-weight: 600;
			}// .error

		}// .field

		.color-field {
			display: flex;
			align-items: center;
			gap: 0.6rem;

			input[type="color"] {

				width: 2.25rem;
				height: 2.25rem;
				padding: 0;
				border: none;
				background: transparent;
				cursor: pointer;
			}// input[type="color"]

			.hex-preview {

				font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono","Courier New", monospace;
				color: #475467;
			}// .hex-preview

		}// .color-field

		// area to add color swatches
		.swatches {

			display: flex;
			flex-wrap: wrap;
			gap: 0.5rem;
			position: relative;

			.swatch, .add {
				width: 32px;
				height: 32px;
				border-radius: 8px;
				border: 1px solid #d0d5dd;
				cursor: pointer;
				display: inline-flex;
				align-items: center;
				justify-content: center;

				&:hover { box-shadow: 0 0 0 3px rgba(124, 141, 249, 0.2); }

			}// swatch, .add

			.add {

				background: #f3f4f6;
				color: #475467;
				font-weight: 700;
			}// .add

			.popover {

				position: absolute;
				top: 42px;
				left: 0;
				padding: 0.6rem;
				background: #fff;
				border: 1px solid #e4e7ec;
				border-radius: 10px;
				box-shadow: 0 12px 24px rgba(16, 24, 40, 0.12);
				z-index: 5;

				.popover-actions {
					display: flex;
					gap: 0.5rem;
					margin-top: 0.5rem;

					button {
						border: 1px solid #d0d5dd;
						background: #fff;
						padding: 0.4rem 0.6rem;
						border-radius: 8px;
						cursor: pointer;

						&:hover { background: #f8fafc; }
						&.danger {

							border-color: #e54848;
							color: #e11d48;
							background: #fff0f3;
							&:hover { background: #ffe5ea; }
						}
						&.ghost { background: transparent; }

					}// button

				}// .popover-actions

			}// .popover

		}// .swatches 


		// area user can pick image
		.sprite-field {

			// review box fo the image
			.preview {

				margin-bottom: 0.5rem;

				img {
					display: block;
					width: 96px;
					height: 96px;
					object-fit: contain;
					border-radius: 8px;
					border: 1px solid #e4e7ec;
					background: repeating-conic-gradient(#fff 0% 25%, #f3f4f6 0% 50%) 50% / 16px 16px;
				}// img

			}// .preview

			.sprite-actions {
				display: flex;
				gap: 0.5rem;
				align-items: center;

				input[type="file"] {


					padding: 0.3rem 0.4rem;
					border: 1px solid #d0d5dd;
					border-radius: 8px;
					background: #fff;
					cursor: pointer;

					width: 100px;


				}// input[type="file"]

			}// .sprite-actions

		}// .sprite-field

		.switch {

			position: relative;
			display: inline-block;
			width: 48px;
			height: 28px;

			input { opacity: 0; width: 0; height: 0; }

			.slider {
				position: absolute;
				cursor: pointer;
				top: 0; left: 0; right: 0; bottom: 0;
				background-color: #e4e7ec;
				transition: 0.2s;
				border-radius: 999px;

				&::before {
					position: absolute;
					content: "";
					height: 22px; width: 22px;
					left: 3px; top: 3px;
					background-color: white;
					transition: 0.2s;
					border-radius: 999px;
					box-shadow: 0 1px 2px rgba(16, 24, 40, 0.3);
				}// &::before

			}// .slider

			input:checked + .slider { background-color: #7c8df9; }
			input:checked + .slider::before { transform: translateX(20px); }

		}// .switch

	}// .room-form 

</style>
