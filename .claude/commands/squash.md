# Squash Commits

Squash commits you've made in a worktree

- First check the commits you've made, diverging from the feature-branch you started with
  - `git log --no-patch "$(fork.py base)"..HEAD`
    - look at the commit messages
  - `git diff  "$(fork.py base)"..HEAD`
    - view the diff
- Focus on creating a meaningful commit message from these commits
  - in a typical iteration, there tend to be many commits that are fixes and refactors
  - we don't really want these iteration commits in the final history
