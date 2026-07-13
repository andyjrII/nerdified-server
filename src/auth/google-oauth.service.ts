import { Injectable, Logger } from '@nestjs/common';

export interface GoogleProfile {
  email: string;
  emailVerified: boolean;
  name: string | null;
  picture: string | null;
}

/**
 * Google OAuth 2.0 (authorization-code flow) via plain HTTP — no passport
 * strategy needed. Configure with:
 *   GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET — from Google Cloud Console
 *   GOOGLE_CALLBACK_URL — must match the console's authorized redirect URI
 *     (defaults to http://localhost:3100/api/auth/google/callback)
 *
 * If unconfigured, isConfigured() is false and the auth routes redirect back
 * to the sign-in page with an error — the rest of the app is unaffected.
 */
@Injectable()
export class GoogleOauthService {
  private readonly logger = new Logger(GoogleOauthService.name);
  private readonly clientId = process.env.GOOGLE_CLIENT_ID;
  private readonly clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  private readonly callbackUrl =
    process.env.GOOGLE_CALLBACK_URL ??
    'http://localhost:3100/api/auth/google/callback';

  isConfigured(): boolean {
    return !!(this.clientId && this.clientSecret);
  }

  /** Where to send the user to pick a Google account. */
  buildAuthUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId as string,
      redirect_uri: this.callbackUrl,
      response_type: 'code',
      scope: 'openid email profile',
      state,
      prompt: 'select_account',
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
  }

  /** Exchanges the callback code for tokens and fetches the user's profile. */
  async fetchProfile(code: string): Promise<GoogleProfile | null> {
    try {
      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: this.clientId as string,
          client_secret: this.clientSecret as string,
          redirect_uri: this.callbackUrl,
          grant_type: 'authorization_code',
        }),
      });
      if (!tokenRes.ok) {
        this.logger.error(
          `Google token exchange failed: ${tokenRes.status} ${await tokenRes
            .text()
            .catch(() => '')}`,
        );
        return null;
      }
      const { access_token } = (await tokenRes.json()) as {
        access_token?: string;
      };
      if (!access_token) return null;

      const profileRes = await fetch(
        'https://www.googleapis.com/oauth2/v3/userinfo',
        { headers: { Authorization: `Bearer ${access_token}` } },
      );
      if (!profileRes.ok) {
        this.logger.error(`Google userinfo failed: ${profileRes.status}`);
        return null;
      }
      const info = (await profileRes.json()) as {
        email?: string;
        email_verified?: boolean;
        name?: string;
        picture?: string;
      };
      if (!info.email) return null;
      return {
        email: info.email,
        emailVerified: info.email_verified === true,
        name: info.name ?? null,
        picture: info.picture ?? null,
      };
    } catch (err) {
      this.logger.error('Google OAuth request failed', err as Error);
      return null;
    }
  }
}
