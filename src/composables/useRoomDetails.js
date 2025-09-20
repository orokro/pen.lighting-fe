/*
	useRoomDetails.js
	-----------------

	A composable to fetch room details for the current route's :room_code
*/

// vue
import { useRoute } from 'vue-router'

// A simple in-memory cache of ongoing fetch promises, keyed by room code
const roomPromiseCache = new Map();

// base URL based on ENV
const envAPIUrl = import.meta.env.VITE_API_URL;
const envWsUrl = import.meta.env.VITE_WS_URL;
const envAppURL = import.meta.env.VITE_APP_URL;

/**
 * Fetch room details for the current route's :room_code.
 *
 * @param {boolean} useCache - if true, reuse cached result for the same code. default false (always fetch fresh).
 * @param {object} options - optional { signal?: AbortSignal, timeoutMs?: number }
 */
export async function useRoomDetails(useCache = false, options = {}) {
	
	// get the current router route & extract the room_code param
	const route = useRoute();
	const raw = route.params.room_code
	const code =
		Array.isArray(raw) ? raw[0] :
			typeof raw === 'string' ? raw :
				undefined

	// if no code, nothing to do
	if (!code) 
		return null

	// fetch room details from the API
	const { signal, timeoutMs = 8000 } = options
	const cacheKey = code

	// if using cache and we have a cached promise, return it
	if (useCache && roomPromiseCache.has(cacheKey)) {
		return roomPromiseCache.get(cacheKey)
	}

	// set up abort controller with timeout
	const controller = new AbortController()
	const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

	// if an external signal is provided, tie it to our controller
	if (signal) {
		if (signal.aborted) controller.abort()
		else signal.addEventListener('abort', () => controller.abort(), { once: true })
	}

	// fetch the room details
	const promise = (async () => {
		try {
			const res = await fetch(
				`${envAPIUrl}/rooms/${encodeURIComponent(code)}`,
				{ headers: { Accept: 'application/json' }, signal: controller.signal }
			)
			if (!res.ok) 
					return null;

			return await res.json();

		} catch {
			return null;

		} finally {
			clearTimeout(timeoutId);
		}
	})()

	// if using cache, store the promise
	if (useCache) {
		roomPromiseCache.set(cacheKey, promise)
	}

	// wait for the result
	const result = await promise;
	if (result === null && useCache) {
		roomPromiseCache.delete(cacheKey);
	}
	return result;
}


/**
 * clear the room details cache
 * 
 * @param {string} roomCode - Optional room code to clear from cache. If omitted, clears entire cache.
 */
export function clearRoomDetailsCache(roomCode) {

	if (roomCode)
		roomPromiseCache.delete(roomCode);

	else
		roomPromiseCache.clear();
}
