export class PhoneMotion {
	constructor(callback) {
		if (typeof callback !== 'function') {
			throw new Error("Callback must be a function");
		}
		this.callback = callback;

		this.running = false;
		this.x = 0;
		this.y = 0;

		this.ax = 0;
		this.ay = 0;
		this.theta = 0;

		this._boundLoop = this._loop.bind(this);
		this._lastTime = 0;

		// Detect availability (no prompts)
		const ua = navigator.userAgent || "";
		const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
		const hasSensors = (typeof window.DeviceMotionEvent !== "undefined") ||
			(typeof window.DeviceOrientationEvent !== "undefined");

		this.available = isMobileUA && hasSensors;

		// Keep references to listeners so we can remove them later
		this._orientationHandler = (e) => {
			this.theta = e.gamma || 0;
		};
		this._motionHandler = (e) => {
			if (e.accelerationIncludingGravity) {
				this.ax = e.accelerationIncludingGravity.x || 0;
				this.ay = e.accelerationIncludingGravity.y || 0;
			}
		};
	}

	async start(stop = false) {
		if (stop) {
			this.stop();
			return;
		}
		if (this.running || !this.available) return;

		// Handle iOS Safari permission
		if (typeof DeviceMotionEvent !== "undefined" &&
			typeof DeviceMotionEvent.requestPermission === "function") {
			try {
				const response = await DeviceMotionEvent.requestPermission();
				if (response !== "granted") {
					console.warn("Motion permission not granted");
					return;
				}
			} catch (err) {
				console.error("Motion permission error:", err);
				return;
			}
		}

		this.running = true;

		// Attach listeners
		window.addEventListener("deviceorientation", this._orientationHandler);
		window.addEventListener("devicemotion", this._motionHandler);

		this._lastTime = performance.now();
		requestAnimationFrame(this._boundLoop);
	}

	stop() {
		if (!this.running) return;
		this.running = false;

		// Detach listeners
		window.removeEventListener("deviceorientation", this._orientationHandler);
		window.removeEventListener("devicemotion", this._motionHandler);
	}

	_loop(timestamp) {
		if (!this.running) return;

		let dt = (timestamp - this._lastTime) / 1000;
		this._lastTime = timestamp;

		// push from acceleration
		this.x += this.ax * dt * 10;
		this.y += this.ay * dt * 10;

		// spring back toward zero
		let k = 5;
		let damping = 3;
		this.x -= this.x * k * dt;
		this.y -= this.y * k * dt;

		this.x *= (1 - damping * dt * 0.1);
		this.y *= (1 - damping * dt * 0.1);

		this.callback({
			theta: Number(this.theta) || 0,
			x: Number(this.x) || 0,
			y: Number(this.y) || 0,
			time: Number(timestamp) || performance.now()
		});

		requestAnimationFrame(this._boundLoop);
	}
}
