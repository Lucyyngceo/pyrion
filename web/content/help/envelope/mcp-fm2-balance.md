---
id: mcp-fm2-balance
title: MCP FM2 oxygen balance tool
chapter: envelope
order: 811
dataHelp:
keywords: mcp fm2 oxygen balance tool
page: envelope
link: /envelope
highlight: [data-help="mcp-panel"]
---
What it is: The read-only fm2_balance tool exposed by PYRION's MCP server.

What it shows: Closed-chamber oxygen arithmetic for FM2 using a caller-supplied limiting oxygen assumption and the stated instrument assumptions.

How to use it: Connect through the dashboard MCP panel and ask the client to call fm2_balance. Read the returned inputs and assumptions with the output.

Example: Compare oxygen consumption under two assumed limiting oxygen concentrations.

What it does not do: It does not predict the real limiting oxygen concentration or a flame outcome.
