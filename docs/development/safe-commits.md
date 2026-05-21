# Safe Commits in Multi-Agent Sessions

*Status: Active*
*Last Updated: 2026-04-25*

## Why this exists

When multiple agents (or an agent + human, or two parallel Claude sessions) are
working in the same repo at once, the index can contain files you didn't put
there. Plain `git commit` always commits whatever is in the index — there is
no auto-stage in either of this repo's pre-commit hooks (`.husky/pre-commit`,
`scripts/pre-commit-hook.sh`), and `git` itself never auto-stages.

A bundling incident (`10bc65fd5`) bundled 12 unintended MangaDex files into a
ComicVine commit. Root cause was procedural: the working tree contained
parallel-agent edits, some of those files made it into the staging area
before commit time, and the commit message + scope didn't reflect the actual
contents.

## Safe-commit recipe

Run these three commands every time before `git commit -m ...`:

```bash
# 1. See exactly what's in the index. Column 1 = staged. Anything in
#    column 1 will be committed.
git status --short

# 2. See the actual diff that will land. No surprises.
git diff --cached

# 3. (Optional but bulletproof) Move everything else out of the way so the
#    pre-commit hook + the commit can ONLY see what you intentionally
#    staged. Restore after.
git stash push --keep-index --include-untracked -m "shelf"
git commit -m "..."
git stash pop
```

The `git stash --keep-index --include-untracked` trick is the strongest
guarantee: it leaves your staged files in place but moves every other
modified or untracked file aside. After the commit lands, `git stash pop`
puts them back. If `pop` reports a conflict, your commit is still safe;
read the conflict carefully before resolving.

## Common bundling causes (none of which are auto-stage)

- **Wildcard adds**: `git add src/server/services/config/` includes any
  file in that tree, including parallel-agent edits you didn't author.
- **Pre-staged files from earlier in the session**: another agent's tool
  call may have run `git add` already; you inherit a populated index.
- **Misreading `git status` columns**: `M ` (column 1 set) means staged;
  ` M` (column 2 set) means unstaged. Easy to confuse when scanning fast.
- **Adding by directory before checking contents**: prefer file-by-file.

## Anti-patterns

- ❌ `git add -A` or `git add .` in shared work
- ❌ `git commit -a` (stages everything modified, ignores what you intended)
- ❌ Trusting the diff stat shown immediately after `git add` — re-check
  with `git status --short` and `git diff --cached` right before commit
- ❌ Bypassing the pre-commit hook with `--no-verify` to "just get past it";
  the hook isn't the problem, the index contents are

## When in doubt

Reset the index and re-stage from scratch:

```bash
git reset HEAD            # unstage everything (working tree untouched)
git add <file1> <file2>   # add only what you intend
git status --short        # verify
```

## Related

- [`git-hooks-setup.md`](./git-hooks-setup.md) — pre-commit hook configuration
- `.husky/pre-commit` (427 lines) and `scripts/pre-commit-hook.sh` (137 lines,
  symlinked from `.git/hooks/pre-commit`) — neither writes to the index
