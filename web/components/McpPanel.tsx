"use client";

import { useState } from "react";

const URL_MCP = "https://pyrion.us/api/mcp";
const CLAUDE_CODE = `claude mcp add --transport http pyrion ${URL_MCP}`;
const TOOLS = [
  ["evaluate_target", "verdicts for any condition: ISS, Moon, Mars, Earth, with DOI"],
  ["compare_conditions", "up to 8 atmospheres side by side, ranked by evidence"],
  ["evidence_gaps", "what PSI would need to state for a test to apply"],
  ["moon_base_test_plan", "Mission Planner: FM2 coverage and missing test points"],
  ["get_investigation", "one PSI investigation: variables, tests, DOI"],
  ["find_evidence", "extracted test records"],
  ["get_receipt", "the NASA source of one value"],
  ["search_nasa_library", "passages from NASA documents"],
  ["list_investigations", "the 24 PSI investigations"],
  ["list_presets", "ISS air, Moon Base, NASA atmospheres (Moon and Mars)"],
];

function Copy({ text, id }: { text: string; id: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      data-help={id}
      className="mcp-copy"
      onClick={() => {
        navigator.clipboard?.writeText(text).then(() => {
          setDone(true);
          window.setTimeout(() => setDone(false), 1500);
        });
      }}
    >
      {done ? "Copied" : "Copy"}
    </button>
  );
}

/** Top of the dashboard: PYRION's engine as an MCP server any AI assistant can call. */
export default function McpPanel() {
  return (
    <details className="mcp-panel" data-help="mcp-panel">
      <summary data-help="mcp-panel">
        <span className="mcp-badge">MCP</span> Use PYRION from your own AI assistant: the same verdicts, records and NASA sources, as tools
      </summary>
      <div className="mcp-body">
        <p className="small">
          PYRION is also a <strong>Model Context Protocol server</strong>. Connect Claude, ChatGPT or any MCP client and it can call
          the applicability engine directly. The tools are read-only and run the same fixed-rule code as this page; no language
          model runs on our side, so the verdict your assistant quotes is PYRION&apos;s, with its DOI.
        </p>
        <div className="mcp-row">
          <span className="mcp-label">Server URL</span>
          <code>{URL_MCP}</code>
          <Copy text={URL_MCP} id="mcp-copy-url" />
        </div>
        <div className="mcp-row">
          <span className="mcp-label">Claude Code</span>
          <code>{CLAUDE_CODE}</code>
          <Copy text={CLAUDE_CODE} id="mcp-copy-cli" />
        </div>
        <p className="small muted">
          Claude or ChatGPT apps: add a custom connector and paste the server URL. No account or key is needed.
        </p>
        <ul className="mcp-tools small">
          {TOOLS.map(([n, d]) => (
            <li key={n}>
              <code>{n}</code> {d}
            </li>
          ))}
        </ul>
      </div>
    </details>
  );
}
