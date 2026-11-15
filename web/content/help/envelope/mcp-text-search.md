---
id: mcp-text-search
title: MCP text search tool
chapter: envelope
order: 812
dataHelp:
keywords: mcp text search tool
page: envelope
link: /envelope
highlight: [data-help="mcp-panel"]
---
What it is: The read-only text_search tool exposed by PYRION's MCP server.

What it shows: PSI investigations ranked by similarity of their text to a query.

How to use it: Connect an MCP client and call text_search to find relevant wording; then use evaluate_target to check physical applicability.

Example: Search for smoke detection, then inspect the source and conditions of each returned investigation.

What it does not do: Text similarity does not decide a verdict or fill missing test conditions.
