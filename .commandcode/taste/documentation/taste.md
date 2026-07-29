# Documentation
- Maintain and update `output.txt` with todos, processes, and the next prompt after each session. Confidence: 0.75
- Append new analysis to existing output files rather than overwriting them — preserve prior content and insert new material below it. Confidence: 0.70
- Before updating `output.txt` with test results, re-run the full test suite yourself and verify results — never copy previously reported results without re-verification. Confidence: 0.75
- Keep planning docs (roadmap) and agent docs (CLAUDE.md, AGENTS.md, .agent/output.txt) in sync as code changes emerge — never let them go stale. During active work, update these docs with the current stage/progress. Confidence: 0.85
- Update `.agent/output.txt` with every audit result and file state, and update planning docs + `.agent/` output on every repo change and every shell command run. Confidence: 0.75
- Read files under `.agent/` directory to understand current test suite and build state before making changes. Confidence: 0.80
- For test flows: run once, fix if it fails, run again. If it fails or hangs a second time stop immediately and tell the user to run it manually. Never have more than one test-running shell command in flight at a time. Confidence: 0.75
- If a terminal command fails or times out after 2-3 retries, stop and let the user run it manually instead of continuing to retry. Confidence: 0.75
