import csv, json, re
import openpyxl
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
COLS='accession,test_id,variable,value,unit,value_original,unit_original,method,source_file,source_location,quote,status,note'.split(',')
MAPPING={'Ignition Power (W)':'ignition_power','Ignition Time (s)':'ignition_time','Burn Time (s)':'burn_time','?-g Burn Length':'question_mark_g_burn_length_as_written','?-g Spread Length':'question_mark_g_spread_length_as_written','1-g Burn Length':'one_g_burn_length_as_written','1-g Spread Rate':'one_g_spread_rate_as_written','Hot ignition':'hot_ignition','burn time (sec)':'burn_time','Self -ext or flow term':'test_end','Self-ext or flow term':'test_end'}
def main():
 output=[]
 existing=set()
 for f in (ROOT/'data/conditions').glob('PSI-*.csv'):
  with f.open(encoding='utf-8-sig',newline='') as source:
   for r in csv.DictReader(source):
    if r['status']=='extracted': existing.add((r['accession'],r['source_file'],r['source_location']))
 for acc in ['PSI-98','PSI-99','PSI-159']:
  for p in sorted((ROOT/'data/raw/psi-data'/acc/'Experimental table').glob('*.csv')):
   with p.open(encoding='utf-8-sig',errors='replace',newline='') as f:
    reader=csv.DictReader(f)
    for n,row in enumerate(reader,1):
     test=row.get('Sample Number ',row.get('Sample Number',row.get('Test','')))
     for header,variable in MAPPING.items():
      value=row.get(header,'')
      if value is None or value=='': continue
      source=str(p.relative_to(ROOT/'data/raw')).replace('\\','/');location=f'row={n};column={header}'
      if (acc,source,location) in existing: continue
      unit='W' if '(W)' in header else 's' if '(s)' in header or '(sec)' in header else ''
      output.append(dict(zip(COLS,[acc,test,'outcome:'+variable,value,unit,value,unit,'table',source,location,'','extracted','Value as written; unit is taken from the column header.'])))
 # Preserve the reduced-sheet cells with sheet-local row identifiers; no join to experimental tests.
 book_path=next((ROOT/'data/raw/psi-data/PSI-101/Analyzed Data').glob('*SAME, SAME-R_Results.xlsx'))
 book=openpyxl.load_workbook(book_path,read_only=False,data_only=True)
 sheet=book['Reduced data sheet']; headers=[sheet.cell(2,c).value for c in range(1,21)]
 smoke=[]
 for rownum in range(3,sheet.max_row+1):
  for c,header in enumerate(headers,1):
   value=sheet.cell(rownum,c).value
   if header is None or value is None: continue
   text=str(value);column=openpyxl.utils.get_column_letter(c);slug=re.sub(r'[^a-z0-9]+','_',str(header).lower()).strip('_')
   smoke.append(dict(zip(COLS,['PSI-101',f'Reduced data sheet row {rownum}','outcome:smoke_'+slug,text,'',text,'','table',str(book_path.relative_to(ROOT/'data/raw')).replace('\\','/'),f'sheet=Reduced data sheet;cell={column}{rownum};column={header}','','extracted','As recorded in Reduced data sheet; not linked to experimental-table test IDs.'])))
 # Independently reopen the workbook and compare every extracted value and header.
 verify=openpyxl.load_workbook(book_path,read_only=False,data_only=True);verify_sheet=verify['Reduced data sheet']
 for r in smoke:
  match=re.fullmatch(r'sheet=Reduced data sheet;cell=([A-Z]+)([0-9]+);column=(.*)',r['source_location'])
  if not match or str(verify_sheet[match.group(1)+match.group(2)].value)!=r['value'] or str(verify_sheet[match.group(1)+'2'].value)!=match.group(3): raise ValueError(f'Workbook cell mismatch: {r["source_location"]}')
 output.extend(smoke)
 # NASA's comparison block contains formula links to source rows within this sheet.
 formulas=openpyxl.load_workbook(book_path,read_only=False,data_only=False)['3-tests Compar.']; cached=book['3-tests Compar.']; verified=verify['3-tests Compar.']; pairs=[]
 for rownum in range(3,cached.max_row+1):
  links=[formulas.cell(rownum,c).value for c in range(88,94)]
  present=[x for x in links if isinstance(x,str) and x.startswith('=')]
  if not present: continue
  parsed=[re.fullmatch(r'=C([B-G])(\d+)',x) for x in present]
  if not all(parsed) or len({m.group(2) for m in parsed})!=1: raise ValueError(f'Unexpected pairing formulas at row {rownum}: {links}')
  target=int(parsed[0].group(2)); flight=cached.cell(rownum,1).value; ground=cached.cell(target,1).value
  if not flight or not ground: raise ValueError(f'Pair missing a sheet-local ID at row {rownum}')
  if str(verified.cell(rownum,1).value)!=str(flight) or str(verified.cell(target,1).value)!=str(ground): raise ValueError(f'Pair ID mismatch at row {rownum}')
  if not str(flight).startswith('F') or not str(ground).startswith('G'): continue
  measures=[]
  for c in range(88,94):
   f=formulas.cell(rownum,c).value
   if not isinstance(f,str) or not f.startswith('='): continue
   m=re.fullmatch(r'=C([B-G])(\d+)',f); targetcol=80+ord(m.group(1))-ord('B')
   v=cached.cell(rownum,c).value;g=cached.cell(target,targetcol).value
   if v!=g or v!=verified.cell(rownum,c).value or g!=verified.cell(target,targetcol).value or cached.cell(rownum,targetcol).value!=verified.cell(rownum,targetcol).value: raise ValueError(f'Pair cell mismatch: {rownum}, {c}')
   measures.append({'name':str(cached.cell(2,c).value),'flight_value':str(cached.cell(rownum,targetcol).value),'ground_value':str(v),'flight_cell':cached.cell(rownum,targetcol).coordinate,'ground_cell':cached.cell(target,targetcol).coordinate,'pair_cell':cached.cell(rownum,c).coordinate})
  pairs.append({'flight':str(flight),'ground':str(ground),'flight_row':rownum,'ground_row':target,'measurements':measures,'source_file':str(book_path.relative_to(ROOT/'data/raw')).replace('\\','/'),'source_sheet':'3-tests Compar.'})
 (ROOT/'data/derived/unified/same_pairs.json').write_text(json.dumps(pairs,ensure_ascii=False,indent=2,sort_keys=True)+'\n',encoding='utf-8')
 # Reopen each source and independently compare the extracted cell text.
 sources={}
 for record in output:
  if record['variable'].startswith('outcome:smoke_'): continue
  p=ROOT/'data/raw'/record['source_file']
  if p not in sources:
   with p.open(encoding='utf-8-sig',errors='replace',newline='') as f:sources[p]=list(csv.reader(f))
  pos,header=record['source_location'].split(';column=',1);actual=sources[p][int(pos.split('=')[1])][sources[p][0].index(header)]
  if actual!=record['value_original'] or actual!=record['value']: raise ValueError(f'Cell mismatch: {p} {record["source_location"]}')
 out=ROOT/'data/derived/outcomes_extra.csv'; unified=ROOT/'data/derived/unified/outcomes_extra.csv'
 for p in (out,unified):
  with p.open('w',encoding='utf-8',newline='') as f:
   w=csv.DictWriter(f,fieldnames=COLS,lineterminator='\n');w.writeheader();w.writerows(output)
 (ROOT/'data/derived/unified/outcomes_extra.json').write_text(json.dumps(output,ensure_ascii=False,indent=2,sort_keys=True)+'\n',encoding='utf-8')
 print(f'{len(output)} source-checked values including {len(smoke)} reduced-sheet cells; {len(pairs)} formula-linked pairs')
if __name__=='__main__':main()

