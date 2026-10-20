# TROPHY — Steam Achievement Tracker in ORBIT

TROPHY is a private ORBIT module for a Steam library, achievement progress and games completed at 100% of available Steam achievements. It shares ORBIT's GAIA sign-in and requires the same MFA/AAL2 session.

## Connect
1. Obtain a Steam Web API key through Steam's Web API key registration, when eligible.
2. Set it in **Supabase Project → Edge Functions → Secrets** under the exact name **STEAM_WEB_API_KEY**. Do not save the secret to GitHub, browser localStorage, chat, or ORBIT settings.
3. In Steam, open **Profile → Edit Profile → Privacy Settings**. Steam's Web API can only access game details made public. Private games will not appear in the synchronized library. The playtime privacy toggle also controls whether hours are exposed.
4. Open ORBIT → TROPHY, sign in with your existing ORBIT account and complete MFA, paste your **17-digit SteamID64** (not your password), then select **Link Steam**.
5. Select **Sync Steam** to refresh the library and scan achievements. TROPHY also automatically refreshes the library and checks up to 12 games when you sign in if the last library sync is older than 24 hours.

## Implementation
- Page: index.html, trophy.js, trophy.css, ORBIT route in app.js
- Data: supabase/migrations/20261020_orbit_steam_trophy.sql
- Secure server sync: supabase/functions/orbit-steam/index.ts
- Auth: Supabase's authenticated user JWT, server-side getUser and AAL2 checks; row-level security owner checks.
- Steam API key: Edge secret only. Nothing secret goes to the browser.
- Steam APIs: IPlayerService/GetOwnedGames, ISteamUserStats/GetPlayerAchievements, ISteamUserStats/GetSchemaForGame.
- Clients can invoke only connect/disconnect/sync_library/sync_batch/sync_game. All database changes are scoped to the verified owner.
- Browsers load cached snapshots from user-protected Supabase tables. A "100% completion" means all Steam achievements exposed for the game have been unlocked, not a manual record of story completion or the new Steam Achievement Sets beta.
- Missing/private achievements are marked "unavailable" rather than counted as zero achievements or as a completed game.
- A library sync preserves existing achievement records until they are refreshed. A full sync may take a while on large libraries because each game requires individual Steam API calls.
- There is no Steam OAuth/SSO yet. The first version uses SteamID64 entry plus Steam public Game details. Never enter a Steam password into TROPHY.

## Verification
- Run JS syntax checks for trophy.js and app.js.
- Verify the three orbit_steam tables have RLS enabled and owner/MFA policies.
- Verify deployed orbit-steam Edge Function status is ACTIVE.
- Functional Steam imports cannot be verified until STEAM_WEB_API_KEY is configured and a valid SteamID64 is linked.
