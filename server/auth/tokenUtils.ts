import crypto from "crypto";

const CHECKIN_SECRET = process.env.CHECKIN_SECRET ?? "cultfam-checkin-default-secret";

export function hashCheckinToken(rawToken: string): string {
  return crypto.createHmac("sha256", CHECKIN_SECRET).update(rawToken).digest("hex");
}

export function isTokenHashed(token: string): boolean {
  return /^[0-9a-f]{64}$/.test(token);
}
