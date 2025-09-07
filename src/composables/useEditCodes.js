/*
	useEditCodes.js
	---------------

  	A composable to manage edit codes for rooms using sessionStorage.

*/
export function useEditCodes() {
	
	function key(roomCode) {
	  return `editCode:${roomCode}`
	}
  
	function saveEditCode(roomCode, editCode) {
	  sessionStorage.setItem(key(roomCode), editCode)
	}
  
	function getEditCode(roomCode) {
	  return sessionStorage.getItem(key(roomCode))
	}
  
	function clearEditCode(roomCode) {
	  sessionStorage.removeItem(key(roomCode))
	}
  
	return { saveEditCode, getEditCode, clearEditCode }
}
  