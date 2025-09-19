/*
	OBSRoomState.js
	---------------

	This is a vanilla JS class that will use some dynamic VUE refs
	to handle the static logic for connecting to a room on the OBS page.

	This will be imported and instantiated in ObsView.vue
*/

// vue imports
import { shallowRef, ref } from 'vue';

/**
 * The main money - a class to manage the WebSocket connection and room state
 */
export class OBSRoomState {

	/**
	 * Constructs the OBSRoomState instance
	 * 
	 * @param {string} roomCode The room code to connect to
	 * @param {ref<object>} roomDetails The room details object as returned by the API
	 * @param {string} [wsUrl] Optional WebSocket URL to connect to (defaults to current host)
	 */
	constructor(roomCode, roomDetails, wsUrl) {

		// save params
		this.roomCode = roomCode;
		this.roomDetails = roomDetails;
		this.wsUrl = wsUrl ?? this._deriveWSUrl();

		// non-reactive source of truth
		this._users = [];

		// reactive clone for templates
		this.usersListRef = shallowRef([]);
		this.connectionStatusRef = ref('idle'); // 'idle' | 'connecting' | 'open' | 'closed' | 'error'

		// internal state
		this._socket = null;
		this._closedManually = false;

		this.connect();
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

		// reset state
		this._closedManually = false;
		this.connectionStatusRef.value = 'connecting';

		// open the socket
		const sock = new WebSocket(this.wsUrl);
		this._socket = sock;

		// set up event handlers
		sock.addEventListener('open', () => {

			this.connectionStatusRef.value = 'open';

			// Identify as OBS client
			sock.send(JSON.stringify({
				type: 'hello',
				role: 'obs',
				roomCode: this.roomCode
			}));
		});

		// Handle incoming messages
		sock.addEventListener('message', (evt) => {

			let msg;
			try { msg = JSON.parse(evt.data); } catch { return; }

			if (msg?.type === 'state' && msg?.room === this.roomCode && Array.isArray(msg.users)) {

				// Replace source-of-truth
				this._users = msg.users;

				// Publish a cloned array for the template
				this.usersListRef.value = [...this._users];
			}

			if(msg?.type === 'roomSettings'){

				const newSettings = msg.settings;
				console.log('New Settings', newSettings);
				this.roomDetails.value = newSettings;

				// for now, reload the page to apply new settings
				// later, we can make this dynamic
				window.location.reload();
			}

		});

		// Handle close and error events
		sock.addEventListener('close', () => {

			this.connectionStatusRef.value = 'closed';

			if (!this._closedManually) {
				// optional: simple retry
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
	 * Destroys the instance, closing the WebSocket connection and cleaning up state
	 */
	destroy() {

		// close the socket
		this._closedManually = true;

		// only try to close if it's open or connecting
		if (this._socket && this._socket.readyState <= 1)
			try { this._socket.close(1000, 'Client navigating away'); } catch { }
		
		// clean up state
		this._socket = null;
		this._users = [];
		this.usersListRef.value = [];
		this.connectionStatusRef.value = 'closed';
	}

}
