---
id: mcp-suggest-experiments-status
title: MCP FLEX experiment suggestions status
chapter: envelope
order: 814
dataHelp:
keywords: mcp flex experiment suggestions status
page: envelope
link: /envelope
highlight: [data-help="mcp-panel"]
---
What it is: The suggest_experiments entry exposed by PYRION's MCP server.

What it shows: The status of suggestions based on the optional FLEX model. During this audit, a valid fuel request returned a note that the model schema is not wired into the tool.

How to use it: Read the returned note. For the working fixed-rule Moon Base proposal, use moon_base_test_plan or the Mission Planner.

Example: A heptane request can return a status note without an experiment list.

What it does not do: It is not the same tool as moon_base_test_plan, and the exposed name does not establish a working or validated experiment-design model.
