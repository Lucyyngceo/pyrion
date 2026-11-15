---
id: tars-does-not
title: What TARS does and does not do
chapter: tars
order: 7
---
**It does** compute with the engine and calculators, search a library of NASA documents, quote them exactly, explain physics in its own words, and point at parts of the page.

**It does not** decide a verdict: fixed-rule code does. Code checks quoted text and restricts unsupported numbers, but these checks do not establish that an explanation is scientifically correct. TARS's own reasoning remains unverified and can be wrong. The page identifies the answering model and any fallback.

TARS uses Nemotron 3 Ultra (NVIDIA), first through OpenRouter and, if that is unavailable or out of credit, the same model free on NVIDIA NIM, then Gemma 4 31B (Google); it switches by itself. If no language model is available, TARS still answers questions with numbers by code, and questions about the site from the help topics. Verdicts, the dashboard and the MCP server (https://pyrion.us/api/mcp) never need a model.
