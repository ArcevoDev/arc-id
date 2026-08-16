# git
- Keep `.agent/` tracker/log files tracked in git rather than gitignored — the user explicitly asked to remove `/.agent/` from .gitignore so the session tracker (output.txt) and logs stay version-controlled; if a file was committed before an ignore rule, use `git add -f` to keep updating it. Confidence: 0.85
- Use `chore:` prefix for commit messages when applying cleanup/fix work from code audits. Commit to the chore branch with well-defined messages, or alternatively to the specifically concerned branch. Confidence: 0.75
- Use conventional-commit prefixes matched to the change type — `feat:` for features, `fix:` for bug/regression fixes (e.g., version-skew crash fixes), `chore:` for cleanup — with a summary line plus scoped bullet points. Confidence: 0.6
- Commit changes as individual logical commits grouped by scope (config, docs, frontend, components, modules, etc.) rather than one bulk commit, and push to remote to maintain a clean working history. Confidence: 0.75
- After IDE crashes or file corruption, proactively find and fix corrupted files (null files, broken JSON configs) before resuming development — commit and push to establish a clean slate. Confidence: 0.75
- When the git index is corrupt (zeroed bytes), rebuild it from HEAD by backing up the corrupt index, deleting it, and running `git reset` — never touch working-tree files in the process. Confidence: 0.8
- Do not stage, commit, revert, or sweep away uncommitted working-tree changes during recovery — treat them as in-progress work and preserve them until the user confirms. Confidence: 0.85
- For detailed multi-line commit messages, write the message to a scratch file (e.g., `.agent/commit-message.txt`) and commit with `git commit -F`, then delete the scratch file — avoids shell-quoting pain on Windows and keeps a reviewable message body with scoped bullet points. Confidence: 0.7
- The user prefers to push to remote from their own terminal ("i will push from another terminal, independently"; re-affirmed this session with "leave pushing to me... lets close out all opened tasks and e2e todos" — the agent keeps committing locally and moves on to the next task without pushing). Confidence: 0.95
older files rather than committing them. Confidence: 0.6
- The user prefers to push to remote from their own terminal ("i will push from another terminal, independently"); the assistant should keep committing locally and not push, and not wait on the user's push to continue work. Confidence: 0.8

- When committing close-out work while the user has unrelated uncommitted changes in the tree (e.g., their own in-progress mail templates, tsconfig, package.json), stage only the assistant's own files — never `git add -A` over the user's work — and leave their changes uncommitted. Confidence: 0.6
