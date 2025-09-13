/**
 * PenPhysics
 * -------------
 * A lightweight spring-damper "lean" simulator that:
 * - Smoothly animates pen rotation (theta) on its own rAF loop.
 * - Reads x/y from userRoomState (normalized [0..1]) but NEVER writes to any refs.
 * - Emits theta updates via a callback, with smart throttling to avoid socket spam:
 *     • If updateKinematics() is called, it forces a callback on the very next frame.
 *     • Otherwise, it emits at most once per `updateInterval` ms.
 *     • When at rest (no meaningful change), it stops emitting entirely.
 *
 * MODEL
 * -----
 * - Target angle is proportional to the NEGATIVE of horizontal pointer velocity
 *   (moving left -> lean right), clamped to ±maxAngleDeg.
 * - The pen angle follows the target via an underdamped spring-mass-damper.
 *
 * UNITS
 * -----
 * - Internally: radians for physics.
 * - Callback: degrees ([-maxAngleDeg, +maxAngleDeg]).
 *
 * USAGE
 * -----
 * import PenPhysics from '@/js/PenPhysics.js'
 *
 * let phys;
 * onMounted(() => {
 * 	phys = new PenPhysics(
 * 		props.userRoomState,
 * 		(thetaDeg) => { props.userRoomState.thetaRef.value = thetaDeg; }, // you send the socket msg
 * 		100, // updateInterval ms (min time between passive emits)
 * 		{
 * 			maxAngleDeg: 28,
 * 			velocityGainDegPerUnitPerS: 22,
 * 			naturalFrequency: 5.5, // rad/s
 * 			dampingRatio: 0.25,    // underdamped feel
 * 		}
 * 	);
 * });
 *
 * // Call this inside your mousemove/touchmove handlers:
 * function onPointerMove() {
 * 	phys.updateKinematics(); // forces a callback next frame
 * }
 *
 * onBeforeUnmount(() => phys.shutdown());
 */
export default class PenPhysics {
	/**
	 * @param {object} userRoomState - The reactive object holding refs { xRef, yRef, thetaRef }.
	 * @param {(thetaDeg:number)=>void} onTheta - Callback to receive the latest theta (degrees).
	 * @param {number} updateInterval - Minimum ms between passive callback emissions.
	 * @param {object} [opts] - Optional tuning parameters.
	 * @param {number} [opts.maxAngleDeg=28] - Clamp for |theta|.
	 * @param {number} [opts.velocityGainDegPerUnitPerS=22] - Convert horizontal speed (units/s) to degrees.
	 * @param {number} [opts.velocityFilterTau=0.05] - Low-pass time constant (s) for velocity.
	 * @param {number} [opts.naturalFrequency=5.5] - Spring natural frequency (rad/s).
	 * @param {number} [opts.dampingRatio=0.25] - Damping ratio (0..1: under/critically damped feel).
	 * @param {number} [opts.minEmitDeltaDeg=0.25] - Smallest angle delta to justify an emit.
	 * @param {number} [opts.restThetaDeg=0.25] - |target - theta| below this (deg) counts as "near target".
	 * @param {number} [opts.restOmegaDegPerS=2] - |angular speed| below this (deg/s) counts as "slow".
	 */
	constructor(userRoomState, onTheta, updateInterval, opts = {}) {

		// --- Public-ish config (degrees and seconds) ---
        // All tabs, no spaces.
		this._maxAngleDeg = Number.isFinite(opts.maxAngleDeg) ? opts.maxAngleDeg : 28;
		this._velocityGainDegPerUnitPerS = Number.isFinite(opts.velocityGainDegPerUnitPerS)
			? opts.velocityGainDegPerUnitPerS : 22;
		this._tauVx = Number.isFinite(opts.velocityFilterTau) ? opts.velocityFilterTau : 0.05; // s

		const wn = Number.isFinite(opts.naturalFrequency) ? opts.naturalFrequency : 5.5; // rad/s
		const zeta = Number.isFinite(opts.dampingRatio) ? opts.dampingRatio : 0.25; // unitless (0..1)

		this._minEmitDeltaDeg = Number.isFinite(opts.minEmitDeltaDeg) ? opts.minEmitDeltaDeg : 0.25;
		this._restTheta = this._degToRad(
			Number.isFinite(opts.restThetaDeg) ? opts.restThetaDeg : 0.25
		); // rad
		this._restOmega = this._degToRad(
			Number.isFinite(opts.restOmegaDegPerS) ? opts.restOmegaDegPerS : 2
		); // rad/s

		// Spring constants in continuous time:
		// theta'' = -2*zeta*wn*theta' - wn^2*(theta - target)
		this._k = wn * wn;          // stiffness (rad/s^2)
		this._c = 2 * zeta * wn;    // damping  (1/s)

		// --- Throttling ---
		this._interval = Math.max(0, Number.isFinite(updateInterval) ? updateInterval : 100);
		this._lastEmitTime = 0;
		this._lastEmittedThetaDeg = NaN;

		// --- State / Inputs ---
		this._user = userRoomState;
		this._onTheta = typeof onTheta === 'function' ? onTheta : () => {};

		this._theta = 0;      // rad
		this._omega = 0;      // rad/s
		this._target = 0;     // rad
		this._prevX = this._readX();
		this._vx = 0;         // units/s (raw)
		this._vxFilt = 0;     // units/s (filtered)

		this._forceEmit = false; // set by updateKinematics()
		this._stopped = false;

		this._lastTick = performance.now();
		this._rafId = requestAnimationFrame(this._tick);
	}


	/**
	 * Forces a callback emission on the next animation frame.
	 * Call this from your pointer move handlers.
	 */
	updateKinematics() {
		this._forceEmit = true;
	}


	/**
	 * Stop the internal animation loop and release resources.
	 */
	shutdown() {
		this._stopped = true;
		if (this._rafId != null) {
			cancelAnimationFrame(this._rafId);
			this._rafId = null;
		}
	}


	// ------------------------
	// Internal implementation
	// ------------------------

	_tick = (now) => {
		if (this._stopped) return;

		// Compute dt (seconds), clamp to keep stability on tab-thrashes / background.
		let dt = (now - this._lastTick) / 1000;
		if (!Number.isFinite(dt) || dt <= 0) {
			this._lastTick = now;
			this._rafId = requestAnimationFrame(this._tick);
			return;
		}
		// cap dt at 50ms to avoid huge leaps
		if (dt > 0.05) dt = 0.05;

		// --- Input sampling: read normalized x, compute vx (units/s), low-pass it ---
		const x = this._readX();
		const rawVx = (x - this._prevX) / dt; // units per second
		this._prevX = x;

		// First-order low-pass: y += (x - y) * alpha, alpha = dt / (tau + dt)
		const alpha = dt / (this._tauVx + dt);
		this._vxFilt += (rawVx - this._vxFilt) * alpha;

		// --- Map velocity to a target lean (deg), opposite of motion, clamp, then to rad ---
		let targetDeg = -this._velocityGainDegPerUnitPerS * this._vxFilt;
		if (targetDeg > this._maxAngleDeg) targetDeg = this._maxAngleDeg;
		else if (targetDeg < -this._maxAngleDeg) targetDeg = -this._maxAngleDeg;
		this._target = this._degToRad(targetDeg);

		// --- Spring-damper integration (semi-implicit Euler) ---
		// omega' = k*(target - theta) - c*omega
		// theta' = omega
		const torque = this._k * (this._target - this._theta) - this._c * this._omega; // rad/s^2
		this._omega += torque * dt;               // rad/s
		this._theta += this._omega * dt;          // rad

		// Hard clamp to max angle (prevents runaway on weird inputs)
		const maxRad = this._degToRad(this._maxAngleDeg);
		if (this._theta > maxRad) {
			this._theta = maxRad;
			if (this._omega > 0) this._omega = 0;
		} else if (this._theta < -maxRad) {
			this._theta = -maxRad;
			if (this._omega < 0) this._omega = 0;
		}

		// --- Emission rules ---
		const thetaDeg = this._radToDeg(this._theta);
		const shouldForce = this._forceEmit;
		this._forceEmit = false;

		const atRest = (Math.abs(this._omega) < this._restOmega) &&
			(Math.abs(this._target - this._theta) < this._restTheta);

		let shouldEmit = false;

		if (shouldForce) {
			// Always emit on the frame after updateKinematics() is called.
			shouldEmit = true;
		} else if (!atRest) {
			const elapsed = now - this._lastEmitTime;
			const changedEnough = !Number.isFinite(this._lastEmittedThetaDeg) ||
				Math.abs(thetaDeg - this._lastEmittedThetaDeg) >= this._minEmitDeltaDeg;
			if (elapsed >= this._interval && changedEnough) {
				shouldEmit = true;
			}
		}
		// If "at rest", we intentionally do NOT emit (avoids socket spam on no-ops).

		if (shouldEmit) {
			this._lastEmitTime = now;
			this._lastEmittedThetaDeg = thetaDeg;
			try {
				this._onTheta(thetaDeg);
			} catch (_) {
				// Swallow to keep the loop resilient.
			}
		}

		this._lastTick = now;
		this._rafId = requestAnimationFrame(this._tick);
	};


	/**
	 * Safely read normalized X from userRoomState.xRef.value.
	 * @returns {number} in [0,1]
	 * @private
	 */
	_readX() {
		let x = 0.5;
		try {
			const v = this._user?.xRef?.value;
			if (typeof v === 'number' && Number.isFinite(v)) x = v;
		} catch (_) {}
		if (x < 0) x = 0;
		else if (x > 1) x = 1;
		return x;
	}

	
	_degToRad(d) { return d * (Math.PI / 180); }
	_radToDeg(r) { return r * (180 / Math.PI); }
}
