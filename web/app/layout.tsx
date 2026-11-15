import type { Metadata, Viewport } from "next";
import { Chakra_Petch, IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import "./globals.css";
import "./cyber.css";
import CommandPalette from "@/components/CommandPalette";
import SiteNav from "@/components/SiteNav";
import StatusBar from "@/components/StatusBar";
import HelpCenter from "@/components/HelpCenter";
import TarsBubble from "@/components/tars/TarsBubble";
import TarsProvider from "@/components/tars/TarsProvider";

const sans = IBM_Plex_Sans({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-sans", display: "swap" });
const display = Chakra_Petch({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--font-display", display: "swap" });
const mono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-mono", display: "swap" });

export const metadata: Metadata = {
  title: "PYRION Ω · The evidence envelope",
  description:
    "Orders NASA PSI combustion investigations by how close their tested conditions are to a target condition, and shows where the tested evidence ends.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f9f9f7" },
    { media: "(prefers-color-scheme: dark)", color: "#0d0d0d" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable} ${display.variable}`}>
      <body>
        <TarsProvider>
        <SiteNav />
        <CommandPalette />
        {children}
        <div className="page footer-wrap">
          <StatusBar />
          <footer data-help="footer-note" className="footer muted small">
            <p>
              PYRION Ω, team MLMP, NASA Space Apps Challenge 2026. A hackathon project, not a NASA product. Data: NASA PSI,
              released under CC0-1.0 except PSI-10, whose license is not stated on PSI. Code: Apache-2.0. Built with the help of
              AI tools (Claude Code, GPT and Grok); see the repository README for the full declaration. Status symbols after the Astro Space UX Design System, ©
              2024 Rocket Communications, Inc.
            </p>
            <p className="footer-links">
              <a data-help="footer-why" href="/why">Why PYRION exists</a> ·{" "}
              <a data-help="footer-proof" href="/proof">Proof</a> ·{" "}
              <a data-help="footer-method" href="/method">Method</a> ·{" "}
              <a data-help="footer-data" href="/data">Data</a> ·{" "}
              <a data-help="footer-bridge" href="/bridge">Bridge</a> ·{" "}
              <a data-help="footer-lenses" href="/lenses">Lenses</a> ·{" "}
              <a data-help="footer-more" href="/more">On Earth</a> ·{" "}
              <a data-help="footer-help" href="/help">Help</a> ·{" "}
              <a data-help="footer-psi" href="https://psi.nasa.gov" target="_blank" rel="noreferrer">psi.nasa.gov</a> ·{" "}
              <a data-help="footer-github" href="https://github.com/Lucyyngceo/pyrion" target="_blank" rel="noreferrer">github.com/Lucyyngceo/pyrion</a>
            </p>
          </footer>
        </div>
        <TarsBubble />
        <HelpCenter />
        </TarsProvider>
      </body>
    </html>
  );
}
