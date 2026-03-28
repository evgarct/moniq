<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes ? APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Repo Workflow Rules

- When starting a new feature in this repo, first update from the latest remote `main`, then create a fresh feature branch from that current base.
- Before opening a PR in this repo, update the relevant documentation first, then prepare the PR.
- After finishing implementation work, always run the relevant local verification for this repo.
- For wallet, allocation, and other finance-state mutations in this repo, keep invariants in pure domain helpers and cover them with node-level tests. Do not leave critical create/edit/delete rules only inside React component handlers.
- After completing meaningful work in this repo, invoke the `instruction-retrospective` skill to review execution problems and update durable instructions.
- In the final response, always include:
  - the PR link, if a PR exists
  - the local app URL, only after verifying it via HTTP
  - the local Storybook URL, only if Storybook exists and has been verified via HTTP
- If a PR does not exist yet, say that explicitly instead of implying one exists.
- If Storybook is not configured yet, say that explicitly instead of implying one exists.
