/*
	UserRoomState.js
	----------------

	This is a vanilla JS class that will use some dynamic VUE refs
	to handle the static logic for connecting to a room as a user.
*/

// vue
import { ref, watch } from 'vue';

/**
 * The main money - a class to manage the WebSocket connection and room state for a user
 */
export class UserRoomState {

	/**
	 * Builds the UserRoomState instance
	 * 
	 * @param {string} roomCode - The room code to connect to
	 * @param {string} nickname - The nickname to use in the room
	 * @param {string} password - Optional room password
	 * @param {string} wsUrl - Optional WebSocket URL to connect to (defaults to current host)
	 * @param {number} debounceMs - Optional debounce time in milliseconds for sending updates (default 5ms)
	 */
	constructor(roomCode, nickname, password, wsUrl, debounceMs = 0 ) {

		// Save params
		this.roomCode = roomCode;
		this.nickname = nickname || 'guest';
		this.password = password; // optional
		this.wsUrl = wsUrl ?? this._deriveWSUrl();

		// Reactive controls you can bind to:
		this.xRef = ref(-100);
		this.yRef = ref(-100);
		this.thetaRef = ref(0);
		this.colorRef = ref(0);
		this.connectionStatusRef = ref('idle'); // 'idle' | 'connecting' | 'open' | 'closed' | 'error'

		// Private
		this._socket = null;
		this._closedManually = false;
		this._sendTimer = null;
		this._debounceMs = Math.max(0, debounceMs | 5);

		this.connect();
		this._wireWatches();
	}


	/**
	 * Gets the derived WebSocket URL based on current location
	 * 
	 * @returns {string} The derived WebSocket URL based on current location
	 */
	_deriveWSUrl() {
		const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
		return `${proto}//api.${window.location.host}`;
	}


	/**
	 * Connects to the WebSocket server and sets up event handlers
	 */
	connect() {

		// Reset state
		this._closedManually = false;
		this.connectionStatusRef.value = 'connecting';

		// Open the socket
		const sock = new WebSocket(this.wsUrl);
		this._socket = sock;

		// Set up event handlers
		sock.addEventListener('open', () => {

			this.connectionStatusRef.value = 'open';

			// Identify as user
			const hello = {
				type: 'hello',
				role: 'user',
				roomCode: this.roomCode,
				nickname: this.nickname
			};

			if (this.password !== undefined)
				hello.password = this.password;

			sock.send(JSON.stringify(hello));

			// Immediately push initial state once
			this._scheduleSend();
		});

		// Handle server messages (currently none defined)
		sock.addEventListener('close', () => {
			this.connectionStatusRef.value = 'closed';
			if (!this._closedManually) {
				// optional retry
				setTimeout(() => this.connect(), 1000);
			}
		});

		// Handle errors
		sock.addEventListener('error', () => {
			this.connectionStatusRef.value = 'error';
			try { sock.close(); } catch { }
		});
	}


	/**
	 * Sets up watchers on the reactive refs to send updates when they change
	 */
	_wireWatches() {

		// Whenever any of these refs change, schedule a debounced send
		[this.xRef, this.yRef, this.thetaRef, this.colorRef].forEach(r => {
			watch(r, () => this._scheduleSend(), { flush: 'post' });
		});
	}


	/**
	 * Schedules a debounced send of the current state to the server
	 * 
	 * @returns {void}
	 */
	_scheduleSend() {

		// Only if socket is open
		if (!this._socket || this._socket.readyState !== WebSocket.OPEN)
			return;

		// If already scheduled, do nothing
		if (this._sendTimer)
			return;

		this._sendTimer = setTimeout(() => {
			this._sendTimer = null;
			this._sendUpdate();
		}, this._debounceMs);
	}


	/**
	 * Sends the current state to the server
	 * 
	 * @returns {void}
	 */
	_sendUpdate() {

		// Only if socket is open
		if (!this._socket || this._socket.readyState !== WebSocket.OPEN)
			return;

		// Build payload
		const payload = {
			type: 'update',
			x: Number(this.xRef.value),
			y: Number(this.yRef.value),
			theta: Number(this.thetaRef.value),
			color: Number(this.colorRef.value)
		};

		// Send it
		try {
			this._socket.send(JSON.stringify(payload));
		} catch {
			// swallow; next change will retry
		}
	}


	/**
	 * Closes the connection and cleans up
	 */
	destroy() {

		this._closedManually = true;

		if (this._sendTimer) {
			clearTimeout(this._sendTimer);
			this._sendTimer = null;
		}

		if (this._socket && this._socket.readyState <= 1) {
			try { this._socket.close(1000, 'Client navigating away'); } catch { }
		}

		this._socket = null;
		this.connectionStatusRef.value = 'closed';
	}

}
