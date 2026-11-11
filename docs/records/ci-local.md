# CI run locally

Written by `ci-local.py --record`: one line per local run of the GitHub CI (green or red, with what it
did not cover). The PR hook takes a green line whose commit has only content after it as the CI that
GitHub did not start; the person confirms it first ("checked only locally").

- 2026-11-11 · `fd7aaa844bab` · red: ci.yml / roadmap › cd tools/playwright-e2e && npm ci && npx playwright install --with-deps chromium (exit 1); ci.yml / backend › Humo del driver (exit 1); not run: 8 setup steps; not covered: ci.yml / roadmap › python3 .claude/gw/scripts/handoff.py closed ${{ github.event.pull_request.base.sha }} HEAD (github.event.pull_request.base.sha is not available locally); ci.yml / roadmap › Pre-commit de la base sobre el PR (github.event.pull_request.base.sha is not available locally)
