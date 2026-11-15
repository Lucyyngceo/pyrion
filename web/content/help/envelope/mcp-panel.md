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

What it shows: The server URL, the one-line command for Claude Code, and the tools: evaluate_target (verdicts for any condition, ISS, Moon, Mars or Earth, with DOI), compare_conditions, evidence_gaps, moon_base_test_plan, get_investigation, find_evidence, get_receipt, search_nasa_library, list_investigations, list_presets, and the calculators oxygen_partial_pressure, compare_two_atmospheres, convert_units and gravity_value. It also offers five skills (MCP prompts: assess_habitat_atmosphere, moon_base_brief, mars_habitat_check, find_nasa_evidence, explain_a_verdict) and three reference resources (method, verdicts, citing).

How to use it: Copy the URL into your assistant's custom connector, or run the Claude Code command, then ask, for example, "Use PYRION to check 30 % oxygen at 10.2 psia on the Moon."

Example: evaluate_target with 30 %, 10.2 psia and Moon returns 0 applicable investigations, the reasons, and each investigation's DOI.

What it does not do: It runs no language model and changes nothing; the assistant you connect writes its own words, and only the tool output is PYRION's.
