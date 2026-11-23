import { OAuth2Client } from "google-auth-library";
import env from "../config/env.js";

let client;
/** Wrapped in an object so tests can replace `verify` without real Google tokens. */
export const google = {
  enabled: () => Boolean(env.GOOGLE_CLIENT_ID),
  async verify(credential) {
    client ??= new OAuth2Client(env.GOOGLE_CLIENT_ID);
    const ticket = await client.verifyIdToken({ idToken: credential, audience: env.GOOGLE_CLIENT_ID });
    const p = ticket.getPayload();
    return { sub: p.sub, email: p.email?.toLowerCase(), name: p.name || p.email, emailVerified: p.email_verified === true };
  },
};
