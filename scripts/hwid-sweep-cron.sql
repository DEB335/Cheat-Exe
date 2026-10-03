-- HWID sweep, driven by the database.
--
-- An unlocked key only stays unlocked while something keeps clearing its
-- device binding (see lib/hwid-release.ts). Open dashboard tabs ask for
-- that every 20 seconds, but a key should keep working with every tab
-- closed, so Supabase asks too: pg_cron fires every 30 seconds and pg_net
-- posts to the sweep route. The route turns away a second sweep within
-- ten seconds on the same instance, so the tabs and the cron together
-- cost no more than either alone.
--
-- Before running, replace the two placeholders:
--
--   <SITE_URL>  the deployed site, no trailing slash
--               (https://your-project.vercel.app)
--   <TOKEN>     the sweep token, derived from SESSION_SECRET. Print it
--               with the same secret the deployment uses:
--
--     node --env-file=.env.local -e "console.log(require('crypto').createHmac('sha256', process.env.SESSION_SECRET).update('hwid-sweep').digest('hex'))"
--
-- The token is one-way: it cannot be turned back into SESSION_SECRET, and
-- all it permits is asking for a sweep. Rotating SESSION_SECRET changes
-- it, so run this file again with the new one.
--
-- Sub-minute schedules need pg_cron 1.5 or later, which Supabase ships.
-- Both extensions can also be switched on under Database -> Extensions.

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Running this file again replaces the job rather than adding a second.
select cron.unschedule('hwid-sweep')
where exists (select 1 from cron.job where jobname = 'hwid-sweep');

select cron.schedule(
  'hwid-sweep',
  '30 seconds',
  $$
  select net.http_post(
    url := '<SITE_URL>/api/keys/hwid-sweep',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-hwid-sweep-token', '<TOKEN>'
    ),
    body := '{}'::jsonb,
    -- pg_net waits in the background, so this blocks nothing; it only
    -- has to outlast the route's own 60-second limit.
    timeout_milliseconds := 60000
  );
  $$
);

-- To stop it:
--
--   select cron.unschedule('hwid-sweep');
--
-- To see whether it is running (status 200 and the counts in the body):
--
--   select status_code, content, created
--   from net._http_response order by created desc limit 5;
