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

What it shows: Connection details in the panel at the top of /envelope, including the server URL and a Claude Code command. The MCP server offers 19 read-only tools: evaluate_target, find_evidence, get_receipt, transfer_hypothesis, fm2_balance, text_search, flex_model, suggest_experiments, oxygen_partial_pressure, compare_two_atmospheres, convert_units, gravity_value, compare_conditions, evidence_gaps, moon_base_test_plan, get_investigation, list_presets, list_investigations and search_nasa_library. The panel lists a subset. The server also provides five prompts (assess_habitat_atmosphere, moon_base_brief, mars_habitat_check, find_nasa_evidence and explain_a_verdict) and three resources (method, verdicts and citing). The FLEX tool names are exposed, but their response currently says the model schema is not wired into the tools.

How to use it: Copy the URL into your assistant's custom connector, or run the Claude Code command, then ask, for example, "Use PYRION to check 30 % oxygen at 10.2 psia on the Moon."

Example: evaluate_target with 30 %, 10.2 psia and Moon returns 0 applicable investigations, the reasons, and each investigation's DOI.

What it does not do: It runs no language model and changes nothing; the assistant you connect writes its own words, and only the tool output is PYRION's.
