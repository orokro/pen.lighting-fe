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

// vue
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
	 * Internal: normalize a hex color string, fallback to #DDDDDD if invalid.
	 * Accepts "#RRGGBB", "RRGGBB", "#RGB", or "RGB".
	 * @param {string} hex
	 * @returns {string} normalized "#RRGGBB"
	 */
	function _normalizeHex(hex) {
		if (!hex) return '#DDDDDD';
		let s = String(hex).trim();
		if (s[0] !== '#') s = '#' + s;
		if (s.length === 4) {
			// #RGB -> #RRGGBB
			s = '#' + s[1] + s[1] + s[2] + s[2] + s[3] + s[3];
		}
		const ok = /^#([0-9a-fA-F]{6})$/.test(s);
		return ok ? s.toUpperCase() : '#DDDDDD';
	}


	/**
	 * Internal: "#RRGGBB" -> { r,g,b }
	 * @param {string} hex
	 */
	function _hexToRgb(hex) {
		const n = parseInt(hex.slice(1), 16);
		return {
			r: (n >> 16) & 255,
			g: (n >> 8) & 255,
			b: n & 255
		};
	}


	/**
	 * Internal: blend two colors by weight w (0..1). Keeps alpha external.
	 * @param {number} r1
	 * @param {number} g1
	 * @param {number} b1
	 * @param {{r:number,g:number,b:number}} repl
	 * @param {number} w - 0..1 (1 = full replacementColor)
	 * @returns {{r:number,g:number,b:number}}
	 */
	function _blendTowardsReplacement(r1, g1, b1, repl, w) {
		const inv = 1 - w;
		return {
			r: Math.round(r1 * inv + repl.r * w),
			g: Math.round(g1 * inv + repl.g * w),
			b: Math.round(b1 * inv + repl.b * w)
		};
	}


	/**
	 * Internal: process the ImageData for green mask extraction and sprite editing.
	 * - Generates a white mask (alpha scales with closeness to pure green within tolerance).
	 * - Replaces "green-ish" pixels in the original by blending toward replacementColor with the same weight.
	 *
	 * @param {ImageData} imageData - Original 256x256 sprite pixels
	 * @param {number} tolerance - 0..~441 (Euclidean radius in RGB); 0 = exact green only
	 * @param {{r:number,g:number,b:number}} replacementRGB - parsed replacement color
	 * @returns {{
	 *   foundGreen: boolean,
	 *   editedImageData: ImageData,
	 *   maskImageData: ImageData | null
	 * }}
	 */
	function _processImageData(imageData, tolerance, replacementRGB) {

		const { width, height, data } = imageData;
		let foundGreen = false;

		// Prepare mask ImageData (same dimensions), initially fully transparent
		const maskImageData = new ImageData(width, height);
		const mask = maskImageData.data;

		// Constants for pure green target
		const gr = 0, gg = 255, gb = 0;
		const tol = Math.max(0, Number.isFinite(tolerance) ? tolerance : 0);

		// Iterate pixels: RGBA per pixel
		for (let i = 0; i < data.length; i += 4) {

			const r = data[i];
			const g = data[i + 1];
			const b = data[i + 2];
			const a = data[i + 3];

			// Ignore fully transparent pixels
			if (a === 0) continue;

			// Distance to pure green in RGB space
			const dr = r - gr;
			const dg = g - gg;
			const db = b - gb;
			const dist = Math.sqrt(dr * dr + dg * dg + db * db);

			let w = 0;

			if (r === 0 && g === 255 && b === 0) {
				foundGreen = true;
			}

			if (tol === 0) {
				// Exact "perfect green" check: #00FF00 with some opacity
				if (r === 0 && g === 255 && b === 0) {
					w = 1;
				}
			} else {
				// Within tolerance? Weight decreases linearly with distance
				if (dist <= tol) {
					w = 1 - (dist / tol); // 1 at center, 0 at radius
				}
			}

			if (w > 0) {
				

				// ---- MASK: white with alpha scaled by closeness and source alpha
				const outA = Math.round(a * w);
				mask[i] = 255;          // R
				mask[i + 1] = 255;      // G
				mask[i + 2] = 255;      // B
				mask[i + 3] = outA;     // A (scaled)

				// ---- SPRITE EDIT: blend current pixel toward replacement color with same weight
				const blended = _blendTowardsReplacement(r, g, b, replacementRGB, w);
				data[i] = blended.r;
				data[i + 1] = blended.g;
				data[i + 2] = blended.b;
				// data[i + 3] = a; // keep original alpha
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


	function _imageToImagedata(img) {
		const { canvas, ctx } = _drawToBaseCanvas(img);
		return ctx.getImageData(0, 0, canvas.width, canvas.height);
	}

	/**
	 * Core API: getPenImages(roomCode, spriteSrc, tolerance = 0, replacementColor = '#DDDDDD')
	 * Loads the image, scans for green (with tolerance), optionally builds mask & edited sprite,
	 * returns base64 PNGs, and caches by `${roomCode}::${spriteSrc}::${tolerance}::${replacementColor}`.
	 *
	 * @param {string} roomCode - Unique room identifier to scope caching
	 * @param {string} spriteSrc - URL or data URI for the pen sprite
	 * @param {number} [tolerance=0] - Euclidean distance in RGB (0 = exact only). Typical useful range: 10..80
	 * @param {boolean} [useDefaultMask=true] - Currently unused; always generates mask if green found
	 * @param {string} [replacementColor='#DDDDDD'] - Hex CSS color for replacement (e.g., '#DDDDDD' or 'DDDDDD')
	 * @returns {Promise<{ maskingMode: boolean, penImage: string, penMask: string | null }>}
	 */
	function getPenImages(roomCode, spriteSrc, tolerance = 0, useDefaultMask = true, replacementColor = '#DDDDDD') {

		if (!roomCode || !spriteSrc) {
			return Promise.reject(new Error('getPenImages(roomCode, spriteSrc) requires both parameters.'));
		}

		const replHex = _normalizeHex(replacementColor);
		const cacheKey = `${roomCode}::${spriteSrc}::${tolerance}::${replHex}`;
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

			// 4) Process pixels for green extraction and sprite edit (with tolerance & replacement)
			const replacementRGB = _hexToRgb(replHex);
			let { foundGreen, editedImageData, maskImageData } = _processImageData(imgData, tolerance, replacementRGB);

			// if null and we still want a mask, create empty transparent mask
			let usedDefaultMask = false;
			if (useDefaultMask && !maskImageData) {
				maskImageData = _imageToImagedata(await _loadImage('/img/default_mask.png'));
				usedDefaultMask = true;
			}

			// 5) Commit edits back to base canvas
			ctx.putImageData(editedImageData, 0, 0);

			// 6) Export data URLs
			const penImage = canvas.toDataURL('image/png');
			const penMask = maskImageData ? _imageDataToDataURL(maskImageData) : null;

			// 7) Build result
			return {
				maskingMode: (!!foundGreen) || usedDefaultMask,
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
