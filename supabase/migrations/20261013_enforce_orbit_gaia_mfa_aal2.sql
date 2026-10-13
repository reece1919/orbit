-- ORBIT + GAIA MFA policy activation. RUNE is intentionally EXCLUDED.
-- The migration refuses to run without two verified TOTP factors on the sole account.
-- Rollback: DROP POLICY "require_verified_totp_aal2" ON public.<each named table>;
-- DROP POLICY "gaia_photo_storage_require_aal2" ON storage.objects;
do $guard$
begin
 if (select count(*) from auth.users) <> 1 or
    (select count(distinct user_id) from auth.mfa_factors where factor_type='totp' and status='verified' group by user_id having count(*) >=2) <> 1 then
   raise exception 'MFA migration halted: single account with two verified TOTP factors required';
 end if;
end $guard$;

create policy "require_verified_totp_aal2" on public.fuel_food_entries
as restrictive for all to authenticated
using (((select auth.jwt())->>'aal') = 'aal2')
with check (((select auth.jwt())->>'aal') = 'aal2');

create policy "require_verified_totp_aal2" on public.gaia_ai_reviews
as restrictive for all to authenticated
using (((select auth.jwt())->>'aal') = 'aal2')
with check (((select auth.jwt())->>'aal') = 'aal2');

create policy "require_verified_totp_aal2" on public.gaia_custom_tasks
as restrictive for all to authenticated
using (((select auth.jwt())->>'aal') = 'aal2')
with check (((select auth.jwt())->>'aal') = 'aal2');

create policy "require_verified_totp_aal2" on public.gaia_task_completions
as restrictive for all to authenticated
using (((select auth.jwt())->>'aal') = 'aal2')
with check (((select auth.jwt())->>'aal') = 'aal2');

create policy "require_verified_totp_aal2" on public.orbit_chat_shortcuts
as restrictive for all to authenticated
using (((select auth.jwt())->>'aal') = 'aal2')
with check (((select auth.jwt())->>'aal') = 'aal2');

create policy "require_verified_totp_aal2" on public.orbit_external_snapshots
as restrictive for all to authenticated
using (((select auth.jwt())->>'aal') = 'aal2')
with check (((select auth.jwt())->>'aal') = 'aal2');

create policy "require_verified_totp_aal2" on public.plant_care_events
as restrictive for all to authenticated
using (((select auth.jwt())->>'aal') = 'aal2')
with check (((select auth.jwt())->>'aal') = 'aal2');

create policy "require_verified_totp_aal2" on public.plant_photos
as restrictive for all to authenticated
using (((select auth.jwt())->>'aal') = 'aal2')
with check (((select auth.jwt())->>'aal') = 'aal2');

create policy "require_verified_totp_aal2" on public.pulse_journals
as restrictive for all to authenticated
using (((select auth.jwt())->>'aal') = 'aal2')
with check (((select auth.jwt())->>'aal') = 'aal2');

create policy "require_verified_totp_aal2" on public.pulse_moods
as restrictive for all to authenticated
using (((select auth.jwt())->>'aal') = 'aal2')
with check (((select auth.jwt())->>'aal') = 'aal2');

create policy "require_verified_totp_aal2" on public.pulse_settings
as restrictive for all to authenticated
using (((select auth.jwt())->>'aal') = 'aal2')
with check (((select auth.jwt())->>'aal') = 'aal2');

create policy "gaia_photo_storage_require_aal2" on storage.objects
as restrictive for all to authenticated
using (bucket_id <> 'gaia-plant-photos' or ((select auth.jwt())->>'aal') = 'aal2')
with check (bucket_id <> 'gaia-plant-photos' or ((select auth.jwt())->>'aal') = 'aal2');
