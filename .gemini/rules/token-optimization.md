# Token Optimization Rule for Antigravity

Whenever performing AI tasks, running scripts, or interacting with OpenAI / Anthropic APIs in this workspace:
- Always ensure local TokenGuard proxy is used (`http://localhost:8080/v1` or `http://localhost:8080`).
- Minimize excessive log contexts by stripping repetitive stack traces and node_modules frames.
- Monitor token savings on the local dashboard at http://localhost:8080/dashboard.
