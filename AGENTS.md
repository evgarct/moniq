<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Repo Workflow Rules

- After finishing implementation work, always run the relevant local verification for this repo.
- In the final response, always include:
  - the PR link, if a PR exists
  - the local app URL, only after verifying it via HTTP
  - the local Storybook URL, only if Storybook exists and has been verified via HTTP
- If a PR does not exist yet, say that explicitly instead of implying one exists.
- If Storybook is not configured yet, say that explicitly instead of implying one exists.
