import crypto from "crypto";

function getCheckinSecret(): string {
  const secret = process.env.CHECKIN_SECRET;
  if (!secret) {
    throw new Error("CHECKIN_SECRET environment variable is required but not set. Set it before starting the server.");
  }
  return secret;
}

export function hashCheckinToken(rawToken: string): string {
  return crypto.createHmac("sha256", getCheckinSecret()).update(rawToken).digest("hex");
}

export function isTokenHashed(token: string): boolean {
  return /^[0-9a-f]{64}$/.test(token);
}

export function validateCheckinSecret(): void {
  getCheckinSecret();
}
