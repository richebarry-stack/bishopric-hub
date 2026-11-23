// Password and security-answer hashing (PBKDF2, with legacy SHA-256 upgrade on login).

// Legacy unsalted SHA-256 — kept only to recognize old password/security-answer hashes
// so they can be transparently upgraded to PBKDF2 the next time they're verified.
export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export const PBKDF2_ITERATIONS = 100_000;

export const bufToBase64 = (buf: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(buf)));

export const base64ToBuf = (b64: string) => Uint8Array.from(atob(b64), c => c.charCodeAt(0));

// Current password hash format: pbkdf2$<iterations>$<saltB64>$<hashB64> (PBKDF2-HMAC-SHA256).
export async function hashPasswordSecure(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' }, key, 256);
  return `pbkdf2$${PBKDF2_ITERATIONS}$${bufToBase64(salt.buffer as ArrayBuffer)}$${bufToBase64(bits)}`;
}

export async function verifyPasswordSecure(password: string, stored: string): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 4 || parts[0] !== 'pbkdf2') return false;
  const iterations = parseInt(parts[1], 10);
  const salt = base64ToBuf(parts[2]);
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations, hash: 'SHA-256' }, key, 256);
  return bufToBase64(bits) === parts[3];
}

// Verifies against either format; returns whether it matched the legacy (unsalted SHA-256)
// format so the caller can transparently rehash on successful legacy login.
export async function verifyPassword(password: string, stored: string): Promise<{ valid: boolean; legacy: boolean }> {
  if (stored.startsWith('pbkdf2$')) {
    return { valid: await verifyPasswordSecure(password, stored), legacy: false };
  }
  const legacyHash = await hashPassword(password);
  return { valid: legacyHash === stored, legacy: true };
}

// Same legacy/secure dual-check as verifyPassword, for security-question answers.
export async function verifyAnswer(answer: string, stored: string): Promise<{ valid: boolean; legacy: boolean }> {
  const normalized = answer.trim().toLowerCase();
  if (stored.startsWith('pbkdf2$')) {
    return { valid: await verifyPasswordSecure(normalized, stored), legacy: false };
  }
  const legacyHash = await hashPassword(normalized);
  return { valid: legacyHash === stored, legacy: true };
}

export function generateTempPassword(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return Array.from(bytes, b => b.toString(36).padStart(2, '0')).join('').slice(0, 10);
}

/**
 * Covenant Path agenda entries that are still on their list. Entries whose person
 * has dropped off the list (the action is done) or been hidden from it are deleted.
 */
