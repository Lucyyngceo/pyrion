import fs from "node:fs/promises";
import path from "node:path";
import "@/app/investigations/investigations.css";
import { profiles } from "@/lib/investigations/data";
import InvestigationList from "@/components/investigations/InvestigationList";
export default async function InvestigationsPage() { let legs:Record<string,string[]>={}; try { const lens=JSON.parse(await fs.readFile(path.join(process.cwd(),"..","data","derived","lenses.json"),"utf8")) as {investigations:{accession:string;legs:Record<string,unknown[]>}[]}; legs=Object.fromEntries(lens.investigations.map(i=>[i.accession,Object.entries(i.legs).filter(([,quotes])=>quotes.length>0).map(([name])=>name)])); } catch(error) { if((error as NodeJS.ErrnoException).code!=