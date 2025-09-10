# Coder Workflow (IMPORTANT)

This is your workflow for a coding task:

- Work on the task. 
- Run tests and/or verify that it works.
- Run typecheck / linter.
- Run formatter.
- Git commit.
- Done notification.

Once you've completed your task and are satisfied with the code, you should commit it.

---

- Add test, typecheck, format to your TODO list so you always do them before commit.
- You SHOULD ignore errors and warnings unrelated to your changes.
- If I ask you to make further changes, create a new commit on top of the previous one.

## Terminal & Shell

- Avoid using `cd` to change cwd, as you might get confused. You SHOULD run commands and tasks from the repo root.

## Git Commit

- Generally, you work in a clean git worktree, but you should be careful not to check in spurious files like temporary output.
    - Prefer not to use `git -A`, because you might inadvertently check-in spurious files. Explicitly specify the files you want to check in.
    - If you decide to use `git -A`, run git status to check if there's anything spurious in the untracked files.
- You MUST NOT include this in the commit message.

```
🤖 Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>
```

## Done Notification

After you are with a task, notify the user.

- Run `fork.py status`
  - project name
  - workspace number
  - one-line HEAD commit msg
    - you should report this as succinctly as possible.
    - 5~10 words. fewer the better.
- exec `say.py --voice shimmer "{project name} {workspace number} for review. {super concise commit msg}"`
  - This will play a voice msg to the user. It shouldn't be too long.

