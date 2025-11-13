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
