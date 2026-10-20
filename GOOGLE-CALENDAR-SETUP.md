# Connect Google Calendar to ORBIT

**Status:** ORBIT calendar UI and the `orbit-google-calendar` Supabase Edge Function are deployed. Google OAuth application credentials must be supplied privately before authorization works.

ORBIT preserves your own events and Todoist tasks. Google Calendar is **read-only**: it can display events from calendars you choose, but cannot create, change, or delete Google events. Your authorized Google tokens are encrypted and stored in backend-only Supabase tables, never in public GitHub code or your browser storage.

## One-time configuration

1. Open [Google Cloud Console](https://console.cloud.google.com/) and select an existing project or create a new one for ORBIT. Under APIs & Services, enable **Google Calendar API**.
2. In Google Auth Platform / OAuth consent, configure **Branding** (application name `ORBIT`), **Audience**, and **Data access**. Request these Google scopes:
   - `https://www.googleapis.com/auth/calendar.readonly`
   - `https://www.googleapis.com/auth/userinfo.email`
   If Audience is External and in Testing, add the actual Google account you plan to connect as a test user.
3. Under **Clients**, create an **OAuth 2.0 Client ID** of type **Web application**.
   - Name: `ORBIT Google Calendar`
   - Authorized redirect URI (enter **exactly**):

     `https://zdurujqwhxqrwbhwzzxg.supabase.co/functions/v1/orbit-google-calendar`

   - This server-side OAuth flow does not require a browser JavaScript origin; if your console asks for one, use `https://reece1919.github.io`.
4. Copy the resulting **Client ID** and **Client secret**.
5. Open [Supabase project Edge Function Secrets](https://supabase.com/dashboard/project/zdurujqwhxqrwbhwzzxg/settings/functions). Create **two separate Edge Function secrets**:
   - `ORBIT_GOOGLE_CLIENT_ID` = the Google Client ID
   - `ORBIT_GOOGLE_CLIENT_SECRET` = the Google Client secret

   **Never paste these credentials into ChatGPT, issues, public GitHub files, browser JavaScript, or screenshots.** Use the Supabase secret-settings form.
6. Open [ORBIT](https://reece1919.github.io/orbit/), sign in and complete the existing MFA prompt, and go to **Calendar → Connect Google Calendar**. Approve Google's read-only calendar consent screen.
7. On return to ORBIT, verify that it shows the connected Google account and your primary calendar's events. Select additional calendars with the checkboxes, then **Save calendar selection**. Use **Refresh events** to reload.

## Security and behavior

- This connection is independent of ChatGPT's Google Calendar plugin.
- A separate, direct Google consent is mandatory; connecting the Google account to ChatGPT does not grant ORBIT OAuth tokens.
- The OAuth callback uses a single-use, hashed, short-lived state and a server-held PKCE verifier.
- Backend POST requests require a valid ORBIT Supabase session with AAL2 MFA. The read-only client can list only the signed-in owner's events.
- The `orbit_google_connections` and `orbit_google_oauth_states` tables have row-level security enabled. No anonymous or authenticated browser read grants exist.
- Access and refresh tokens are encrypted on the server, not returned to ORBIT. Disconnect removes the local connection and attempts token revocation at Google.
- ORBIT retrieves Google events for the displayed date range; event data is displayed in the signed-in browser, not saved to public GitHub.
- The current version connects **one Google account** at a time and can show multiple calendars belonging to that account. For a second Google account, an additional connection-row design would be required.

## Troubleshooting

- **Google Calendar setup required**: check both Edge Function secrets and reload ORBIT.
- **redirect_uri_mismatch**: compare the Google Cloud authorized redirect URI character-for-character with the URI above.
- **access_denied**: add your email as a Google OAuth test user if applicable, then try connecting.
- **Google Calendar access blocked**: verify the Calendar API is enabled and the requested scopes were approved.
- **MFA_REQUIRED / unauthorized**: sign into ORBIT and complete authenticator verification.
- **Authorization stops working after seven days**: Google documents that *external* OAuth apps in Testing generally receive refresh tokens expiring after seven days when requesting Calendar scopes. Review Google OAuth publishing/verification requirements before switching to production. See [Google's OAuth guidance](https://developers.google.com/identity/protocols/oauth2/).

## Required Google API endpoints

- Google authorization: `https://accounts.google.com/o/oauth2/v2/auth`
- Google token exchange/refresh: `https://oauth2.googleapis.com/token`
- Calendar list: `https://www.googleapis.com/calendar/v3/users/me/calendarList`
- Calendar events: `https://www.googleapis.com/calendar/v3/calendars/{calendarId}/events`

There is no paid OpenAI API dependency in this integration. Google Cloud / API billing or verification policies are governed by your Google project and plan.
