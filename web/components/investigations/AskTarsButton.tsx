"use client";
import {useTars} from "@/components/tars/TarsProvider";
export default function AskTarsButton(){const {setOpen}=useTars();return <button data-help="investigation-sheet-links" onClick={()=>setOpen(true)}>Ask TARS about this</button>}
