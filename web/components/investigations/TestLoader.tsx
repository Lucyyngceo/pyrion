"use client";
import {useEffect,useState} from "react";
import TestExplorer,{type TestRow} from "./TestExplorer";
export default function TestLoader({accession,initialTest}:{accession:string;initialTest?:string}) {const [rows,setRows]=useState<TestRow[]|null>(null);const [error,setError]=useState(false);useEffect(()=>{fetch(`/download/${encodeURIComponent(accession)}.json`).then(r=>{if(!r.ok)throw new Error();return r.json()}).then(setRows).catch(()=>setError(true))},[accession]);return error?<p>Test data could not be loaded.</p>:rows?<TestExplorer rows={rows} initialTest={initialTest}/>:<p>Loading test data…</p>}
