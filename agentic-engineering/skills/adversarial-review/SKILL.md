---
name: adversarial-review
description: "Use when: performing adversarial review, red-team analysis, edge-case discovery, failure-mode analysis, misuse review, regression hunting, and risk-focused test planning."
argument-hint: "Describe the spec, design, implementation, workflow, migration, runbook, or test plan to challenge."
user-invocable: true
---

# Adversarial Review

Deliberately challenge a concrete artifact before relying on it. Expose plausible failure modes, separate evidence from speculation, and convert the highest risks into tests, mitigations, or Acceptance criteria.

## When to Use

Use when performing adversarial review, red-team analysis, edge-case discovery, failure-mode analysis, misuse review, regression hunting, risk-focused test planning, or pre-ship challenge of an artifact whose failure would matter. Applies to specs, designs, implementations, workflows, migrations, operational procedures, and test plans.

## Boundaries

- Review only authorized artifacts; keep findings actionable, evidence-based, and tied to the target.
- `CLEAN` is valid when no actionable findings exist after review; no fixed number required.
- No exploit instructions, weaponizable payloads, or live attack guidance.
- No live system, user, or production data exercise; reason from artifacts and local inspection only.
- Clearly separate confirmed defects, likely risks, open questions, accepted tradeoffs, and test gaps.

## Required Input Context

Collect narrowest useful context: target artifact/type, intended behavior, success criteria, requirements, non-goals, actors/permissions/boundaries, inputs/outputs/dependencies, lifecycle/state/error paths, existing tests/verification/monitoring.

Halt or report blocker when target is empty, missing, unreadable, or too vague. If partial but usable, proceed with explicit assumptions. Any halt must still include `Target`, best-effort `Intended behavior`, and specific missing context; otherwise emit `BLOCK`.

## Optional Review Lenses

Apply lenses that fit the target; do not force every lens.

- **Breaker/reliability:** Realistic edge/failure/ordering/timeout/dependency breaks.
- **Maintainer:** Future change, unclear contract, duplication, or coupling enabling misuse/regression.
- **Security/privacy:** Permission, identity, tenancy, data exposure, or trust-boundary failures.
- **User/workflow:** User becomes stuck, confused, misled, blocked, or loses work.
- **Verification:** Important behavior unproved, unobservable, or only tested via unrealistic mock.

## Failure-Mode Taxonomy

Classify findings using the closest category:

- `requirements-clarity`: Missing, conflicting, ambiguous, or unverifiable requirements.
- `contract-logic`: Contract or logic failures between caller/callee, spec/implementation, UI/API, or workflow/runtime behavior.
- `input-handling`: Input, boundary, malformed data, default, null, duplicate, stale, or adversarial data handling failures.
- `error-rollback`: Error handling, rollback, retry, idempotency, partial-success, or compensation failures.
- `state-concurrency`: State, ordering, concurrency, cache, clock, race, or lifecycle transition failures.
- `auth-tenancy`: Permission, identity, tenancy, privacy, data-boundary, or secret-handling failures.
- `data-integrity`: Persistence, migration, schema, compatibility, durability, or data-integrity failures.
- `resource-lifecycle`: Resource lifecycle, timeout, cancellation, cleanup, scalability, quota, or backpressure failures.
- `user-workflow`: User workflow confusion, irreversible action, silent failure, misleading feedback, or work-loss failures.
- `verification-gap`: Test or verification gaps tied to specific unverified behavior.

Use the label verbatim as the `Category` value.

## Severity And Verdicts

Severity labels follow the canonical vocabulary in the `workflow-safety-gates` "Severity Vocabulary" section verbatim — `CRITICAL`, `HIGH`, `MEDIUM`, `LOW`. That section is the single source of truth for severity definitions, blocking behavior, and waiver evidence requirements; do not paraphrase or extend the definitions here.

Use one overall verdict:

- `BLOCK`: one or more `CRITICAL` findings, any `HIGH` without a documented compensating control or explicit owner-accepted tradeoff, or a missing/unreadable target that prevents meaningful review.
- `CONCERNS`: actionable issues, likely risks, open questions, or behavior-specific test gaps remain, but the target may proceed with mitigation or explicit acceptance.
- `CLEAN`: no actionable findings found after reviewing the available target and context. Residual caveats may still be listed.

## Role-Specific Use

This skill is invoked from three different roles in the pack. Each invocation emphasizes a different output shape; the Procedure and Output Format below are the maximal form, and each role trims as noted.

- **Adversary role (`adversary-agent`).** Primary use. Produces the full Output Format below: Verdict, Findings, Adversarial tests, Mitigations/Acceptance criteria, Residual risk. This is the canonical adversarial review. The primary role emits only `BLOCK | CONCERNS | CLEAN`; when prior findings are supplied and the net-new findings set is empty after dedup, emit `CLEAN` with `Findings: None` and name the dedup basis in `Evidence basis` or `Residual risk` rather than emitting a passthrough verdict.
- **Independent Code Reviewer secondary lens (`independent-code-reviewer-agent`).** Applied after the reviewer's initial findings on larger or riskier changes. The orchestrator hands the reviewer the prior adversary findings (when one ran) along with the diff. The reviewer reports ONLY findings not raised by the adversary, or concrete counter-evidence to one of the adversary's findings; do not restate or re-rank already-raised findings. Verdict-emission rules: (a) if the net-new findings set includes any `CRITICAL` or any `HIGH` without a documented compensating control or owner-accepted tradeoff, the secondary lens MUST emit `BLOCK` and MUST NOT use the `defer to prior adversarial review` passthrough — the passthrough would silently propagate the prior verdict (potentially `CLEAN`) to downstream consumers that gate on the Verdict field; (b) if the net-new findings set includes a `HIGH` with a documented compensating control or owner-accepted tradeoff, or any number of `MEDIUM`/`LOW` findings, the secondary lens MUST emit `CONCERNS`; (c) only when the net-new findings set is empty after dedup may the secondary lens emit `Verdict: defer to prior adversarial review` (a permitted Output Format literal for this role only). If no adversary ran for this change, the secondary lens behaves as the primary use and emits one of `BLOCK | CONCERNS | CLEAN`. Monotonicity clause: the secondary-lens verdict MUST be at least as strong as the prior adversary's verdict on the same target. If rule (b) or (c) would emit a verdict weaker than the prior (for example: prior `BLOCK`, net-new set contains only `MEDIUM`/`LOW`, rule (b) would emit `CONCERNS`), emit the prior verdict instead and append the net-new findings to the Findings block. The prior `BLOCK` or `CONCERNS` does not auto-downgrade because the secondary lens did not surface new severe findings; downstream consumers that gate on the Verdict field must not silently weaken the gate decision.
- **Severity source-of-truth fallback.** Severity labels follow the canonical vocabulary in the `workflow-safety-gates` "Severity Vocabulary" section verbatim. If that section is missing, unreadable, renamed, or appears out of sync with the canonical labels `CRITICAL | HIGH | MEDIUM | LOW`, emit `Verdict: BLOCK` with a single `Open question` finding naming the unavailable source-of-truth. Do not synthesize replacement labels locally; doing so reintroduces the severity-vocabulary drift class of bug.
- **Integrator arbitration (`integrator-agent`).** During disagreement reconciliation, use only the Failure-Mode Taxonomy labels and the Severity And Verdicts vocabulary to classify findings already on the table. Do not generate new findings; do not emit a new Verdict. Output is a classification annotation on the existing findings list.

Cross-invocation dedup: when more than one role invokes this skill against the same target in a single workflow, every invocation after the first is responsible for deduplication against ALL prior invocations on the same target (not only the immediately preceding one). The Adversary role's Procedure step 6 ("Deduplicate overlapping findings") covers within-invocation dedup; this section covers across-invocation dedup. The canonical dedup criterion: a candidate finding is covered by a prior finding when both cite the same artifact file:line range AND the same `## Failure-Mode Taxonomy` category. Same file:line + different category → both survive. Same file:line + same category + different concrete trigger → both survive; report the candidate as a sibling finding referencing the prior one rather than suppressing it.

## Evidence Standard

Classify each substantive finding:

- **Confirmed issue:** Direct evidence shows the artifact violates stated or clearly implied intended behavior, or a widely shared correctness, security, privacy, or safety norm.
- **Likely risk:** A plausible trigger could cause harm, but confirmation would require more execution, domain input, or data.
- **Open question:** A decision or requirement is missing and changes the risk assessment.
- **Accepted tradeoff:** The risk is real, documented, and intentionally accepted by the artifact or user.
- **Test gap:** A specific important behavior is not verified by the available tests or evidence.

Every substantive finding must name a concrete trigger or scenario. Do not present speculation as fact; state what evidence supports the claim and what remains unknown.

## Procedure

1. Identify target artifact/type; read available artifact and needed context.
2. State intended behavior in one or two sentences; list assumptions.
3. Challenge assumptions using relevant lenses/taxonomy; deduplicate overlapping findings.
4. Rank by severity, impact, likelihood, confidence.
5. Convert top risks into concrete adversarial tests, mitigations, or Acceptance criteria.
6. Assign overall verdict.

## Output Format

Return a compact review in this shape. Replace each `A | B | C` placeholder with exactly one of the listed values. Primary adversary output uses only `BLOCK | CONCERNS | CLEAN`; the fourth verdict literal is reserved for the Independent Code Reviewer secondary lens only. `Suggested fix` is local to one finding; `Mitigations / Acceptance criteria` is the cross-cutting or gating set agreed for the target. Per-finding `Test gap` names the unverified behavior; the footer `Adversarial tests` aggregates the concrete tests proposed for top risks and may reference finding numbers.

```text
Verdict: BLOCK | CONCERNS | CLEAN | defer to prior adversarial review (secondary lens only)
Target: <artifact and content type>
Intended behavior: <one or two sentences>
Evidence basis: <files, sections, tests, logs, or context reviewed>
Assumptions: <explicit assumptions or "None beyond reviewed material">

Findings:
1. <short title>
  Artifact: <file, section, component, workflow step, or test>
  Category: <taxonomy label>
  Severity: CRITICAL | HIGH | MEDIUM | LOW
  Confidence: high | medium | low
  Classification: Confirmed issue | Likely risk | Open question | Accepted tradeoff | Test gap
  Trigger: <concrete scenario or condition>
  Risk: <user, system, data, security, privacy, or operational impact>
  Evidence: <specific observation from the reviewed material>
  Suggested fix: <focused mitigation, test, decision, or acceptance criterion>

Adversarial tests: <behavior-specific tests or checks for top risks, may reference finding numbers>
Mitigations / Acceptance criteria: <cross-cutting changes or explicit decisions needed>
Residual risk: <remaining caveats after suggested mitigations, or "No material residual risk identified">
```

The fourth Verdict literal `defer to prior adversarial review` is permitted ONLY for the Independent Code Reviewer secondary-lens role defined in "Role-Specific Use" above, and only when prior adversary findings exist and the net-new findings set is empty after dedup. The Adversary role and the Integrator role MUST use one of `BLOCK | CONCERNS | CLEAN`. Tooling that consumes independent secondary-lens output may treat `defer to prior adversarial review` as a passthrough that delegates the verdict to the prior adversary run's recorded value, but the primary adversary path must report no-net-new as `CLEAN` with evidence instead of a passthrough verdict.

For `CLEAN`, replace each empty section with `None`; `Residual risk` must list caveats or `No material residual risk identified`. For `BLOCK` on a missing, unreadable, or insufficient target, emit a single `Open question` finding describing the blocker and use `Pending - target unavailable` for `Adversarial tests` and `Mitigations / Acceptance criteria`.

## Anti-Patterns

- Do not invent findings to satisfy a quota.
- Do not report cosmetic-only issues unless they create ambiguity, user harm, operational risk, or verification risk.
- Do not restate the target or intended behavior as if it were a finding.
- Do not provide exploit steps, weaponizable payloads, or instructions for attacking real systems.
- Do not say only "needs tests"; name the unverified behavior and the failure it should catch.
- Do not force every taxonomy category into the output when it does not apply.
