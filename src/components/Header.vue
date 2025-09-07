<!--
	Header.vue
	----------

	This is the header component that shows on all pages
	w/ navigation links.
-->
<template>

	<!-- main outermost wrapper -->
	<header class="header-bar" align="center">

		<!-- the centered logo box /w links -->
		<div class="logo-box">

			<!-- bar of links -->
			
			<!-- actual logo image -->
			<div class="tilt">
				<div class="float">
					<div class="rock">
						<div class="logo-image"></div>
					</div>
				</div>
			</div>

		</div>

	</header>

</template>
<script setup>

</script>
<style lang="scss" scoped>

	// outermost bar across the top
	.header-bar {

		background:rgba(177, 85, 230, 0.4);

		// box for the logo
		.logo-box {

			// for debug
			/* border: 1px solid red; */

			// box settings
			display: inline-block;
			max-width: 650px;
			width: 650px;
			height: 260px;

			// for positioning children absolutely
			position: relative;

			// tilt animation helper
			.tilt {

				// fill the box, minus some padding
				position: absolute;
				inset: 10px 10px 0px 10px;

				// animation helpers
				.float, .rock {
					width: 100%;
					height: 100%;
				
				}// .float, .rock

			}// .tilt

			// the logo image
			.logo-image {
				
				// for debug
				/* border: 1px solid blue; */
				width: 100%;
					height: 100%;

				background-image: url('/img/pen.lighting_logo_med.png');
				background-size: contain;
				background-repeat: no-repeat;
				background-position: center center;

				// add a hot pink glow effect
				filter: drop-shadow(0 0 10px hsl(var(--h) 100% 60%));
				animation: hueShift 12s linear infinite;

			}// .logo-image
			
		}// .logo-box

	}// .header-bar

	/* animate-able custom property for hue */
	@property --h {
		syntax: "<number>";
		inherits: false;
		initial-value: 300; /* start around hot pink */
	}

	/* 1) gentle ±30° tilt */
	.tilt {
		position: relative; /* so absolute child can position itself */
		animation: tilt 6s ease-in-out infinite alternate;
	}
	@keyframes tilt {
		0%   { transform: rotate(-5deg); }
		50%  { transform: rotate(  0deg); } /* sine-ish midpoint */
		100% { transform: rotate( 5deg); }
	}

	/* 2) out-of-phase float ±10px */
	.float {
		animation: bob 7s ease-in-out infinite alternate;
		/* phase offset so it doesn't peak when tilt peaks */
		animation-delay: -3.5s;
	}
	@keyframes bob {
		0%   { transform: translateY(-10px); }
		50%  { transform: translateY(  0px); }
		100% { transform: translateY( 10px); }
	}

	/* 3) subtle "dance beat" scale */
	.rock {
		animation: pulse 0.5s cubic-bezier(.2,.7,.2,1) infinite alternate;
	}
	@keyframes pulse {
		0%   { transform: scale(1); }
		100% { transform: scale(1.06); } /* tweak to taste */
	}

	/* 4) slow hue rotation for the glow */
	@keyframes hueShift {
		from { --h: 300; }    /* hot pink-ish */
		to   { --h: 660; }    /* 300 + 360 (wraps around) */
	}

	/* Optional: accessibility */
	@media (prefers-reduced-motion: reduce) {
		.tilt, .float, .rock, .logo-image {
			animation: none;
			transform: none;
			filter: drop-shadow(0 0 6px hsl(300 100% 60%));
		}
	}

</style>
