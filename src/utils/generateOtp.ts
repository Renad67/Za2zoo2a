/**
 * Generate a 6-digit OTP for phone verification.
 */
export function generateOtp(): string {
  return String(Math.floor(100_000 + Math.random() * 900_000));
}

/**
 * Generate a 4-digit PIN for trip verification.
 */
export function generatePin(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}
