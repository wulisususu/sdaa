# Semantic Grounding Review Amendment

Date: 2026-09-13

This note supersedes the flow and trust assumptions in `2026-09-13-semantic-grounding-design.md` where they differ from the final reviewed implementation.

## Final flow

Every generated artifact is checked by both the deterministic publication guard and the semantic grounding audit before deciding whether to repair it. If either check reports a problem, their findings are combined into one repair request. The repaired artifact is checked by both gates again. There is only one repair attempt.

The LLM budget remains two calls on the normal path and at most four calls on the repair path.

## Trust hierarchy

The raw question and clarifications actually answered by the user define the authoritative user facts and scope.

`compiledQuestion.coreUncertainty` and current-retrieval `knowledgeGaps` are supporting hypotheses only. The auditor must first reconstruct the user intent from the raw question and answered clarifications, then compare the final artifact against that intent.

## Audit-result consistency

A semantic violation must identify a valid target. Question violations require a valid question index. Title and context violations do not carry a question index. The reported excerpt must occur in the declared target. Results that violate these invariants fail safely.

## Data handling

Text passed into audit and repair sections is encoded consistently before being inserted into the model request. Repair feedback is kept as structured data rather than being concatenated as free-form instructions.

## CTA

The secondary action is `前往知乎` and opens `https://www.zhihu.com/`. The primary action remains `复制知乎版问题`. No direct-publish capability is claimed.
