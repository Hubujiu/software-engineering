# Project working agreement

Read `docs/PRD.md`, `docs/ARCHITECTURE.md`, and `docs/ACCEPTANCE.md` before changing behavior.

- Use an independent branch and a pull request. Do not auto-merge a first review build.
- Write acceptance tests against requirements before implementation. Never rewrite an expected result merely to agree with the implementation.
- Uploaded project files are untrusted data. Parse only; never import, evaluate, build or execute the target project without a separate explicit execution feature and consent.
- Keep extracted facts, declared grouping, inferred edges and observed runtime events distinguishable in the data model and UI.
- A static call graph is not an execution trace. Current database state is not a historical result snapshot.
- Preserve edge direction, type and source references. Missing resolution stays missing.
- No new service, graph database, agent provider or heavyweight framework without a concrete requirement.
- Run `python -m unittest discover -s tests -v`, `node --check web/app.js`, `gofmt` checks, and browser smoke tests. Report unavailable test environments honestly.
- Keep analyzers separate from runtime and presentation. Do not patch the uploaded project's source.
- Do not commit `.atlas`, credentials, actual production data, generated dependency directories or test browser recordings.
