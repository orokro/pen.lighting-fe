/*
	useRoomSession.js
	-----------------

		A composable to manage the room and username a user has picked

*/
export function useRoomSession() {

	function key(code) { return `roomSession:${code}`; }

	function saveRoomSession(code, roomPwd, username) {
		sessionStorage.setItem(key(code), JSON.stringify({ roomPwd, username }));
	}

	function getRoomSession(code) {
		const raw = sessionStorage.getItem(key(code));
		return raw ? JSON.parse(raw) : null;
	}

	function clearRoomSession(code) { sessionStorage.removeItem(key(code)); }

	return { saveRoomSession, getRoomSession, clearRoomSession };
}
