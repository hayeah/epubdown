# Squash Commits

Squash commits you've made in a worktree

- First check the commits you've made, diverging from the feature-branch you started with
  - `git log --patch  "$(fork.py base)"..HEAD`
    - view the diff and commit messages
  - `git log --no-patch "$(fork.py base)"..HEAD`
    - if the diff is too big, look at the commit messages only
- Focus on creating a meaningful commit message from these commits
  - in a typical iteration, there tend to be many commits that are fixes and refactors
  - we don't really want these iteration commits in the final history
