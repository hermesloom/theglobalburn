# Releasing

`production` is the branch Vercel serves at members.theborderland.se. `main` is
integration. Merging into `main` deploys a preview and nothing more.

```
feature branch  ->  PR  ->  main  ->  production (live)
```

## Promoting

```bash
npm run release:status    # what would ship, and whether the branches are sane
npm run release:promote   # fast-forward production to main
```

`release:status` is worth reading before promoting. It lists the files that would
change and **the authors of the work being shipped** — promoting `main` ships
everything sitting on it, not only your own commits.

## The one rule

**`production` must always be an ancestor of `main`.**

Hold it and every promotion is a fast-forward: it cannot conflict, and it cannot
resurrect old code. Break it and the next promotion becomes a real merge that can
carry surprises in both directions.

The way it gets broken is committing or hotfixing straight to `production`. If
that happens, `release:promote` refuses and tells you to restore the invariant:

```bash
git checkout main && git merge origin/production && git push origin main
```

Then promote as usual. Better still, put the hotfix on `main` and promote it —
that keeps the history linear and the two branches honest.

## `git log` lies about what is unreleased

This repo has years of `Merge branch 'production'` commits from hotfixes being
merged back, and some work has reached `production` by cherry-pick rather than by
merge. As a result commit ancestry and file contents disagree:

```bash
git log --oneline production..main   # claimed 126 commits unreleased
git diff --stat production main      # actually 8 files differed
```

Both numbers were "right"; only the second was useful. **Always check the diff.**
`release:status` uses the diff for exactly this reason.

This is not academic. In July 2026 a promotion was nearly made that would have
shipped an unrelated colleague's unreleased work — a breaking change to
`/api/auth/rea-token` among it — because the commit range was read as the source
of truth. The work was split onto its own branch instead.

## Database migrations

Migrations are applied with `supabase db push` against the linked project and are
**not** tied to a deployment. Apply them before promoting the code that needs
them, so production never runs against a schema it does not have.

If `db push` reports *"Remote migration versions not found in local migrations
directory"*, you are on a branch missing migrations that are already applied. It
will suggest `migration repair --status reverted`. **Do not run that** — it marks
live migrations as reverted and invites them to be applied a second time. Check
out a branch that has them, or place the missing files in the working tree
uncommitted, and push again.
