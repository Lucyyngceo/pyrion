import type { Metadata } from "next";
import BridgeClient from "@/components/BridgeClient";
import { loadBridgeData } from "@/lib/bridge-data";
import "../bridge.css";

export const metadata: Metadata = {
  title: "Bridge · PYRION Ω",
  description: "A labelled hypothesis that relates microgravity tests to other gravity levels through flame stretch rate. Not evidence.",
};

export default async function BridgePage() {
  const data = await loadBridgeData();
  return (
    <main className="page bridge">
      <BridgeClient csv={data.csv} gravitySource={data.gravitySource} />
    </main>
  );
}
