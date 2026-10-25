## Consolidated hackathon candidate: take investigation, matchday replay, Foundry safeguards and public local-provider hosting config

Base: `main` (9d81c6b). Head: `feature/take-investigation`. **Merge nothing else first; this branch already contains the earlier work.**

### What this contains
- Matchday replay, scoped answers, shareable evidence cards, take investigation ("Check again", deterministic comparison, "Share what changed"), conversational `fanReply`, 45 s client deadline.
- Foundry adapter safeguards (8192 completion-token ceiling, 30 s timeout, no retries, validated output, clarification-only unresolved entities), disabled by default. Captured-output offline replay regressions.
- Hosting: `.github/workflows/shared-preview.yml` (manual, `main` only), `apps/web/public/staticwebapp.config.json` now **public** (invited-role gate removed), landing `README.md`, `TEAM_DEMO.md`, `docs/DEPLOYMENT_RUNBOOK.md`.
- Docs moved, not deleted: old README → `docs/IMPLEMENTATION_NOTES.md`; superseded private-preview plan → `docs/PRIVATE_PREVIEW_PLAN_SUPERSEDED.md`.

### Relationship to existing PRs (none closed or merged)
| PR | Relationship |
| --- | --- |
| #1 interpreter prep (→ main) | Its single commit is not an ancestor, but `git cherry` shows an equivalent patch is already in this branch. |
| #2 GPT-5-mini integration (→ #3 branch) | Stacked; its branch is an ancestor of this one. |
| #3 conversational summaries (→ fan-experience-v1) | Stacked; ancestor of this branch. |
| #4 consolidated fan experience (→ main) | Earlier consolidation; its head `65cc0f5` is an ancestor of this branch. |
| #5 matchday replay (draft, → shared-preview-preparation) | Ancestor of this branch (as is its base). |

If this PR is accepted, #1–#5 become redundant; the owner decides whether to close them afterwards.

### Checks
API 172/172, web 95/95, `tsc`, lint, web build, `git diff --check` (local provider). Hosted behaviour is not verified: no Azure resource exists.

### Not changed
No application logic, prompts, model settings or calculations changed in this preparation; only hosting config, tests for that config, and documentation.

### Security notes
Tracked files and all 57 reachable commits were scanned: no credentials, endpoints, headers or capture files found (test keys are fake literals; GUIDs are function invocation IDs; `local.settings.json` and `.local-captures/` are git-ignored and never committed). Public hosting means anonymous, unrate-limited API access; see the runbook's exposure section. Repository visibility is unchanged.

### Remaining actions before deployment
See the approval checklist in `docs/DEPLOYMENT_RUNBOOK.md`.
