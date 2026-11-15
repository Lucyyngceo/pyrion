---
id: mcp-panel
title: Use PYRION from your AI assistant (MCP)
chapter: envelope
order: 5
dataHelp: [mcp-panel, mcp-copy-url, mcp-copy-cli]
keywords: MCP, model context protocol, connector, Claude, ChatGPT, API, tools, assistant
page: envelope
link: /envelope
highlight: [data-help="mcp-panel"]
---
What it is: PYRION as a Model Context Protocol (MCP) server at https://pyrion.us/api/mcp, so any AI assistant that supports MCP can call its tools.

What it shows: The server URL, the one-line command for Claude Code, and the tools: evaluate_target (verdicts for a condition, with DOI), find_evidence (extracted test records), get_receipt (the NASA source of one value), search_nasa_library (passages from NASA documents), list_investigations and list_presets.

How to use it: Copy the URL into your assistant's custom connector, or run the Claude Code command, then ask, for example, "Use PYRION to check 30 % oxygen at 10.2 psia on the Moon."

Example: evaluate_target with 30 %, 10.2 psia and Moon returns 0 applicable investigations, the reasons, and each investigation's DOI.

What it does not do: It runs no language model and changes nothing; the assistant you connect writes its own words, and only the tool output is PYRION's.
