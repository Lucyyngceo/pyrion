---
id: mcp-flex-model-status
title: MCP FLEX model status
chapter: envelope
order: 813
dataHelp:
keywords: mcp flex model status
page: envelope
link: /envelope
highlight: [data-help="mcp-panel"]
---
What it is: The flex_model entry exposed by PYRION's MCP server.

What it shows: A response describing whether the optional FLEX model is usable. During this audit, a valid fuel request returned a note that the model file exists but its schema is not wired into the tool.

How to use it: Read the returned status and note before interpreting the response. Use extracted records and evaluate_target for evidence and verdicts.

Example: A request for heptane can return a status note without a model prediction.

What it does not do: The presence of the tool name or an available field does not mean a prediction was produced, validated or used to decide a verdict.
