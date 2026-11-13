// Calling-name comparison shared by the web app and the API's LCR sync, so both
// decide "same calling" the same way.

/** LCR adds "Custom Calling" to the end of callings a ward or stake created itself. */
const CUSTOM_SUFFIX = /\s*custom calling\s*$/i;

/** "Ward Bulletin Specialist Custom Calling" → "Ward Bulletin Specialist". */
export function stripCustomCalling(calling: string): string {
  return (calling || '').replace(CUSTOM_SUFFIX, '').trim();
}

/** Key for matching two calling names: no **bold**, no "Custom Calling" ending, case and spaces ignored. */
export function normCallingKey(calling: string): string {
  return stripCustomCalling((calling || '').replace(/\*\*/g, '')).replace(/\s+/g, ' ').toLowerCase();
}
