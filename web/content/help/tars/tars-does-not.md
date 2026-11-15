---
id: tars-does-not
title: What TARS does and does not do
chapter: tars
order: 7
---
**It does** compute with the engine and calculators, search a library of NASA documents, quote them exactly, explain physics in its own words, and point at parts of the page.

**It does not** decide a verdict by itself, do arithmetic by itself, invent a quotation, or answer unrelated or harmful questions. It cannot browse the web. A model answers its open questions, and the page says which model and whether a fallback was used.

TARS uses Nemotron 3 Ultra (NVIDIA), first through OpenRouter and, if that is unavailable or out of credit, the same model free on NVIDIA NIM, then Gemma 4 31B (Google); it switches by itself. If no language model is available, TARS still answers questions with numbers by code, and questions about the site from the help topics. Verdicts, the dashboard and the MCP server (https://pyrion.us/api/mcp) never need a model.
