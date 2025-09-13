/*
	censorUsername.js
	-----------------

	Provides a function to censor inappropriate words in usernames,
	limiting length and replacing bad words with block characters.
*/
// Tabs, not spaces
import { clean } from "profanity-cleaner";

/**
 * Helper to censor a username.
 * 
 * @param {string} userName - The username to censor.
 * @returns {string} - The censored username.
 */
export function censorUsername(userName) {

	// Basic validation
	if (!userName || typeof userName !== "string") 
		return userName;

	// First, clean with default "*"
	let cleaned = clean(userName);

	// max chars
	const maxChars = 16;
	if (cleaned.length > maxChars) {
		cleaned = cleaned.slice(0, maxChars);
	}

	// Then replace each "*" with a full block █
	return cleaned.replace(/\*/g, "█");
}
