/*
	useRoomDetails.js
	-----------------

	A composable to fetch room details for the current route's :room_code
*/

// vue
import { useRoute } from 'vue-router'

// A simple in-memory cache of ongoing fetch promises, keyed by room code
const roomPromiseCache = new Map();


/**
 * Fetch room details for the current route's :room_code.
 *
 * @param {boolean} useCache - if true, reuse cached result for the same code.
 *                             default false (always fetch fresh).
 * @param {object} options - optional { signal?: AbortSignal, timeoutMs?: number }
 */
export async function useRoomDetails(useCache = false, options = {}) {
	
	const route = useRoute()
	const raw = route.params.room_code
	const code =
		Array.isArray(raw) ? raw[0] :
			typeof raw === 'string' ? raw :
				undefined

	if (!code) return null

	const { signal, timeoutMs = 8000 } = options
	const cacheKey = code

	if (useCache && roomPromiseCache.has(cacheKey)) {
		return roomPromiseCache.get(cacheKey)
	}

	const controller = new AbortController()
	const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

	if (signal) {
		if (signal.aborted) controller.abort()
		else signal.addEventListener('abort', () => controller.abort(), { once: true })
	}

	const promise = (async () => {
		try {
			const res = await fetch(
				`https://api.pen.lighting/rooms/${encodeURIComponent(code)}`,
				{ headers: { Accept: 'application/json' }, signal: controller.signal }
			)
			if (!res.ok) return null
			return await res.json()
		} catch {
			return null
		} finally {
			clearTimeout(timeoutId)
		}
	})()

	if (useCache) {
		roomPromiseCache.set(cacheKey, promise)
	}

	const result = await promise
	if (result === null && useCache) {
		roomPromiseCache.delete(cacheKey)
	}
	return result
}

export function clearRoomDetailsCache(roomCode) {
	if (roomCode) roomPromiseCache.delete(roomCode)
	else roomPromiseCache.clear()
}
