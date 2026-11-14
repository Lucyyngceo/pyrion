import type { Metadata, Viewport } from "next";
import "./globals.css";
import SiteNav from "@/components/SiteNav";

export const metadata: Metadata = {
  title: "PYRION Ω · The evidence envelope",
  description:
    "Ranks NASA PSI combustion investigations by physical applicability to a target condition and shows where the measured evidence ends.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f9f9f7" },
    { media: "(prefers-color-scheme: dark)", color: "#0d0d0d" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <SiteNav />
        {children}
        <div className="page footer-wrap">
          <footer className="footer muted small">
            <p>
              PYRION Ω, team NDMLM, NASA Space Apps Challenge 2026. A hackathon project, not a NASA product. Data: NASA PSI,
              released under CC0-1.0 except PSI-10, whose license is not stated on PSI. Code: Apache-2.0. Built with the help of
              SI tools (Claude Code); see the repository README.
            </p>
            <p>
              <a href="https://psi.nasa.gov" target="_blank" rel="noreferrer">
                psi.nasa.gov
              </a>{" "}
              ·{" "}
              <a href="https://github.com/Lucyyngceo/pyrion" target="_blank" rel="noreferrer">
                github.com/Lucyyngceo/pyrion
              </a>
            </p>
          </footer>
        </div>
      </body>
    </html>
  );
}
