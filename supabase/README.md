Create new migration file using:

```
npx supabase migration new migration_name
# edit migration file
npx supabase db push
npx supabase db reset
```

Dump remote database and initialize local one with it:

```
npx supabase db dump -f supabase/seed.sql --data-only
npx supabase db reset
```
