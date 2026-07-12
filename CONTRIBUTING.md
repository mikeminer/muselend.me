# Contributing

Use small changes, pinned dependencies, and tests proportional to financial risk. Every
contract change must pass formatting, build, unit/fuzz tests and invariants. Never weaken
an invariant to hide a failure; document intentional rounding explicitly. Frontend code
must pass lint, strict TypeScript, production build and accessibility checks.

Do not commit secrets, deployment broadcasts, generated keystores, user data or provider
credentials. Security reports must follow `SECURITY.md` rather than public issues.
