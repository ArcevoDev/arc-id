================================================================
  ArcID - OAuth / Social Login Secrets Setup Guide
  Updated: 2026-08-14
================================================================

WHY
---
The ArcID backend already implements social login (src/modules/auth/
routes/social.route.ts) for Google, GitHub, Apple, Microsoft via the
`arctic` library. The UI (login/register forms) already shows GitHub +
Google buttons pointing at /auth/github and /auth/google. What is
missing are REAL client credentials - the .env currently has placeholders.

CALLBACK URLs (must match what you register with the provider)
-------------------------------------------------------------
The backend builds callbacks as:  API_BASE_URL + /auth/{provider}/callback
(the social routes are mounted under /auth, NOT /auth/...)

With API_BASE_URL="http://localhost:4000" (current .env), the callbacks are:

  Google:  http://localhost:4000/auth/google/callback
  GitHub:  http://localhost:4000/auth/github/callback

For production you would use your real API domain, e.g.
  https://api.arcid.dev/auth/google/callback

For Expo Go / a phone testing against your LAN, use your machine IP:
  http://<YOUR_LAN_IP>:4000/auth/google/callback

ENV VARIABLES TO FILL (in .env, then restart the API)
-----------------------------------------------------
  GOOGLE_CLIENT_ID="<real-google-client-id>"
  GOOGLE_CLIENT_SECRET="<real-google-client-secret>"
  GITHUB_CLIENT_ID="<real-github-client-id>"
  GITHUB_CLIENT_SECRET="<real-github-client-secret>"

================================================================
GOOGLE - step by step
================================================================
1. Go to https://console.cloud.google.com/apis/credentials
2. Create a project (or pick one), then "Create Credentials" -> "OAuth client ID".
3. Application type: "Web application".
4. Authorized redirect URIs: add  http://localhost:4000/auth/google/callback
5. Copy the Client ID (ends in .apps.googleusercontent.com) and Client Secret
   into .env:
     GOOGLE_CLIENT_ID="...apps.googleusercontent.com"
     GOOGLE_CLIENT_SECRET="GOCSPX-..."
6. In "OAuth consent screen": set user type External (or Internal for org),
   add your test email as a test user, and add the scopes:
   - openid, email, profile (the backend requests these).
7. Restart the API:  pnpm dev:api   (or set FLOW_TX_TIMEOUT_MS if slow)
8. Test: open http://localhost:3000/login -> click "Google".

NOTE: Google requires the consent screen to be "In production" (or your
email added as a test user) before non-test users can log in.

================================================================
GITHUB - step by step
================================================================
1. Go to https://github.com/settings/developers
2. "New OAuth App".
3. Homepage URL:  http://localhost:3000
   Authorization callback URL:  http://localhost:4000/auth/github/callback
4. Copy the Client ID + Client Secret into .env:
     GITHUB_CLIENT_ID="Ov23li..."
     GITHUB_CLIENT_SECRET="..."
5. Restart the API and test from /login -> "GitHub".

NOTE: GitHub requests only "user:email" scope (the backend asks for
user:email). No extra scopes needed.

================================================================
MAGIC LINK (no secrets needed)
================================================================
Magic link uses the configured email service (Resend) + email templates.
If RESEND_API_KEY is set and email sending works, the "Send me a magic
link" button on /login already works - no OAuth setup required.

================================================================
TESTING THE WHOLE FLOW FROM THE UI
================================================================
1. API running:  pnpm dev:api            (port 4000)
2. Web running:  pnpm dev:web            (port 3000)
3. Open http://localhost:3000/login
4. Try in order:
   a. Email + password login (works already - E2E verified)
   b. Magic link (needs working Resend)
   c. GitHub (needs .env client creds)
   d. Google  (needs .env client creds)
5. After auth, the user lands on:
   - /dashboard  if they have an ACTIVE tenant membership (dev/org)
   - /wallet     if they are a general user (web version of ArcWallet)

================================================================
TROUBLESHOOTING
================================================================
- "Google OAuth not configured" / "GitHub OAuth not configured":
  the .env client id/secret are still placeholders.
- redirect_uri mismatch: the callback URL in the provider console MUST
  exactly equal API_BASE_URL + /auth/{provider}/callback.
- Callback 500 in the API log: check the provider error in the log;
  most often a missing scope or a test-user restriction.
- Expo Go on a phone: use your LAN IP as API_BASE_URL, and register that
  exact callback with the provider.
- Remember to restart the API after editing .env (tsx watch picks up
  code changes but env changes need a restart).

================================================================
_Keep this file current. Update it when providers are added/removed._
