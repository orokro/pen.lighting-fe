// Tabs, not spaces
import { clean } from "profanity-cleaner";

export function censorUsername(userName) {
	if (!userName || typeof userName !== "string") return userName;

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
