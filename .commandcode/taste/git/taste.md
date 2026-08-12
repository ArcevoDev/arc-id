# git
- Keep `.agent/` tracker/log files tracked in git rather than gitignored — the user explicitly asked to remove `/.agent/` from .gitignore so the session tracker (output.txt) and logs stay version-controlled; if a file was committed before an ignore rule, use `git add -f` to keep updating it. Confidence: 0.75
- Use `chore:` prefix for commit messages when applying cleanup/fix work from code audits. Commit to the chore branch with well-defined messages, or alternatively to the specifically concerned branch. Confidence: 0.75
- Commit changes as individual logical commits grouped by scope (config, docs, frontend, components, modules, etc.) rather than one bulk commit, and push to remote to maintain a clean working history. Confidence: 0.75
- After IDE crashes or file corruption, proactively find and fix corrupted files (null files, broken JSON configs) before resuming development — commit and push to establish a clean slate. Confidence: 0.75
- When the git index is corrupt (zeroed bytes), rebuild it from HEAD by backing up the corrupt index, deleting it, and running `git reset` — never touch working-tree files in the process. Confidence: 0.8
- Do not stage, commit, revert, or sweep away uncommitted working-tree changes during recovery — treat them as in-progress work and preserve them until the user confirms. Confidence: 0.85
