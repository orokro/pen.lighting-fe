/*
	usePenMasking.js
 	----------------

	Vue 3 composable that inspects a penlight sprite image for exact green pixels (#00FF00),
	optionally generates a white mask (preserving alpha) and returns base64-encoded PNGs
	for both the edited sprite (green -> #DDDDDD) and the mask (green -> white).

	Caching:
	- In-memory only, per-tab, keyed by `${roomCode}::${spriteSrc}`.
	- Avoids unnecessary recomputation when multiple pens in the same room reuse the same sprite.
	- Page refresh will recompute (as requested).

	Notes:
	- The image is drawn onto a 256x256 offscreen canvas regardless of its original size.
	- Exact match for "perfect green": r=0, g=255, b=0 (alpha > 0). Transparent pixels are ignored.
	- The mask preserves the source alpha for green pixels.
	- Non-green pixels are untouched in the sprite; green pixels become #DDDDDD (alpha preserved).

	Returns:
	{
	  maskingMode: Boolean, // true if any #00FF00 pixel was found and a mask was generated
	  penImage:    String,  // dataURL: base64 PNG of the (possibly edited) sprite
	  penMask:     String | null // dataURL: base64 PNG of the mask, or null if none
	}
*/

// bue
import { ref } from 'vue';

export function usePenMasking() {

	// Private in-memory cache (persists only for the lifetime of the page/tab)
	// Value is a Promise resolving to the result object, to de-duplicate concurrent calls.
	const _penMaskCache = new Map();


	/**
	 * Public: clear all cached entries (optional helper)
	 */
	function clearPenMaskCache() {
		_penMaskCache.clear();
	}


	/**
	 * Public: clear cached entries for a specific roomCode (optional helper)
	 * @param {string} roomCode
	 */
	function clearRoomCache(roomCode) {

		if (!roomCode)
			return;

		const prefix = `${roomCode}::`;
		for (const key of _penMaskCache.keys())
			if (key.startsWith(prefix)) _penMaskCache.delete(key);
	}


	/**
	 * Internal: load an image from a URL or data URI
	 * @param {string} src
	 * @returns {Promise<HTMLImageElement>}
	 */
	function _loadImage(src) {

		return new Promise((resolve, reject) => {
			const img = new Image();
			// Helps with same-origin requirements; safe for data URLs as well
			img.crossOrigin = 'anonymous';
			img.decoding = 'async';
			img.onload = () => resolve(img);
			img.onerror = (e) => reject(new Error('Failed to load image: ' + src));
			img.src = src;
		});
	}


	/**
	 * Internal: draw an image into a 256x256 canvas and return { canvas, ctx }
	 * Always scales to 256x256 (image is expected square, but this is robust).
	 * @param {HTMLImageElement} img
	 */
	function _drawToBaseCanvas(img) {

		const size = 256;
		const canvas = document.createElement('canvas');
		canvas.width = size;
		canvas.height = size;
		const ctx = canvas.getContext('2d', { willReadFrequently: true });

		// Draw stretched to full 256x256 to guarantee expected pixel grid
		ctx.drawImage(img, 0, 0, size, size);
		return { canvas, ctx };
	}


	/**
	 * Internal: process the ImageData for green mask extraction and sprite editing.
	 * - Generates a white mask (preserving alpha) wherever a pixel is exactly #00FF00.
	 * - Replaces the same pixels in the original with #DDDDDD (alpha preserved).
	 *
	 * @param {ImageData} imageData - Original 256x256 sprite pixels
	 * @returns {{
	 *   foundGreen: boolean,
	 *   editedImageData: ImageData,
	 *   maskImageData: ImageData | null
	 * }}
	 */
	function _processImageData(imageData) {

		const { width, height, data } = imageData;
		let foundGreen = false;

		// Prepare mask ImageData (same dimensions), initially fully transparent
		const maskImageData = new ImageData(width, height);
		const mask = maskImageData.data;

		// Iterate pixels: RGBA per pixel
		for (let i = 0; i < data.length; i += 4) {

			const r = data[i];
			const g = data[i + 1];
			const b = data[i + 2];
			const a = data[i + 3];

			// Exact "perfect green" check: #00FF00 with some opacity
			const isPerfectGreen = (r === 0 && g === 255 && b === 0 && a > 0);
			if (isPerfectGreen) {
				foundGreen = true;

				// Write white into mask, preserving original alpha
				mask[i] = 255;     // R
				mask[i + 1] = 255; // G
				mask[i + 2] = 255; // B
				mask[i + 3] = a;   // A (preserve)

				// Replace this pixel in the original with #DDDDDD, alpha preserved
				data[i] = 221;
				data[i + 1] = 221;
				data[i + 2] = 221;
				// data[i + 3] = a; // unchanged
			}
		}// next i

		return {
			foundGreen,
			editedImageData: imageData,
			maskImageData: foundGreen ? maskImageData : null
		};
	}


	/**
	 * Internal: convert ImageData to a PNG dataURL via a throwaway canvas.
	 * @param {ImageData} imageData
	 * @returns {string} dataURL
	 */
	function _imageDataToDataURL(imageData) {

		const c = document.createElement('canvas');
		c.width = imageData.width;
		c.height = imageData.height;

		const cctx = c.getContext('2d');
		cctx.putImageData(imageData, 0, 0);
		return c.toDataURL('image/png');

	}


	/**
	 * Core API: getPenImages(roomCode, spriteSrc)
	 * Loads the image, scans for green, optionally builds mask & edited sprite,
	 * returns base64 PNGs, and caches by `${roomCode}::${spriteSrc}`.
	 *
	 * @param {string} roomCode - Unique room identifier to scope caching
	 * @param {string} spriteSrc - URL or data URI for the pen sprite
	 * @returns {Promise<{ maskingMode: boolean, penImage: string, penMask: string | null }>}
	 */
	function getPenImages(roomCode, spriteSrc) {

		if (!roomCode || !spriteSrc) {
			return Promise.reject(new Error('getPenImages(roomCode, spriteSrc) requires both parameters.'));
		}

		const cacheKey = `${roomCode}::${spriteSrc}`;
		if (_penMaskCache.has(cacheKey)) {
			return _penMaskCache.get(cacheKey);
		}

		// Store the in-flight Promise in cache to avoid duplicate work
		const task = (async () => {
			// 1) Load image
			const img = await _loadImage(spriteSrc);

			// 2) Draw to 256x256 base canvas
			const { canvas, ctx } = _drawToBaseCanvas(img);

			// 3) Read pixels
			const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);

			// 4) Process pixels for green extraction and sprite edit
			const { foundGreen, editedImageData, maskImageData } = _processImageData(imgData);

			// 5) Commit edits back to base canvas
			ctx.putImageData(editedImageData, 0, 0);

			// 6) Export data URLs
			const penImage = canvas.toDataURL('image/png');
			const penMask = maskImageData ? _imageDataToDataURL(maskImageData) : null;

			// 7) Build result
			return {
				maskingMode: !!foundGreen,
				penImage,
				penMask
			};

		})().catch((err) => {
			// If the task failed, drop the cache entry so retries can occur
			_penMaskCache.delete(cacheKey);
			throw err;
		});

		_penMaskCache.set(cacheKey, task);
		return task;
	}

	return {
		getPenImages,
		clearPenMaskCache,
		clearRoomCache
	};

}
