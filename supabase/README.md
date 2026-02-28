Create new migration file using:

```
npx supabase migration new migration_name
# edit migration file
npx supabase migration up   # applies the new migration to the local database

npx supabase db push        # applies the new migration to the remote database

npx supabase db reset       # resets the local database and applies all migrations
```

Dump remote database and initialize local one with it:

```
npx supabase db dump -f supabase/seed.sql --data-only
npx supabase db reset
```

When you ran `npx supabase db dump -f supabase/seed.sql --data-only`, but then `npx supabase db reset` throws some SQL error (e.g. a mission column), a Supabase version update has happened on the remote which made the schemas incompatible. This means that the local Supabase instance has to be updated. To fix it:

1. Locally, nuke everything that has to do with Supabase in Docker.
2. `npm uninstall @supabase/auth-helpers-nextjs @supabase/ssr @supabase/supabase-js supabase; npm i @supabase/auth-helpers-nextjs @supabase/ssr @supabase/supabase-js; npm i -D supabase`
3. `supabase link` (this is crucial, because e.g. `supabase/.temp/gotrue-version` needs to be updated, as the Docker images pulled in the next step depend on that)
4. `npm run supabase:start`
5. 
