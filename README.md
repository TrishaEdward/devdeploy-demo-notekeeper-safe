# devdeploy-demo-notekeeper-safe

A small full-stack notes app (Express API + plain-JS frontend + SQL via Sequelize/SQLite)
used as a demo repo for DevDeploy's security pipeline. **Expected outcome: WARN, then deployed.**

It is written the safe way: parameterised queries, escaped output, allowlists,
no hardcoded secrets, current dependencies, and a Dockerfile that runs as a
non-root user. Three routes look dangerous to a pattern-matching scanner (user
input into HTML / a file path / a redirect) but are guarded, so Semgrep flags
them and LLM triage should dismiss them as false positives.

**It still has one flaw no scanner can find:** `DELETE /api/notes/:id` never checks
the note belongs to the caller (broken access control). Passing the gate is not
a guarantee of security.

Full write-up: `docs/demo-apps-plan.md` in the DevDeploy project.

**UI:** a sign-in screen, note cards, search, toasts and dark mode. User content is only ever inserted as text, never HTML.

Run locally: `npm install && npm start` → http://localhost:3000
(the demo password for `alice` is printed at startup; set `ALICE_PASSWORD` / `BOB_PASSWORD` to choose your own).
Companion app that should be blocked: `devdeploy-demo-booknook-vulnerable`.
