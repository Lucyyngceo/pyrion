import csv, json, re
from pathlib import Path
from collections import defaultdict
ROOT = Path(__file__).resolve().parents[1]
def rows(p):
    with p.open(encoding='utf-8-sig', newline='') as f: return list(csv.DictReader(f))
def main():
    manifests = {n: rows(ROOT / 'data/manifest' / (n+'.csv')) for n in ['investigations','hardware','publications','experimental_tables']}
    profiles = []
    for inv in manifests['investigations']:
        acc = inv['accession']; path = ROOT / 'data/raw/psi-data' / acc / '_investigation' / (acc+'.json')
        if not path.is_file(): raise FileNotFoundError(f'Missing PSI investigation JSON: {path}')
        raw = json.loads(path.read_text(encoding='utf-8'))
        source = str(path.relative_to(ROOT)).replace('\\','/')
        fields = {}
        psi_links = [{'url': 'https://psi.nasa.gov/physci/repo/data/investigations/'+acc, 'source': {'file':'data/manifest/web_check_2026-11-14.csv','key':'line 1 URL pattern'}}]
        for key in ['title','objective','approach','hypothesis','researchImpacts','experimentHardware','flightProgram','investigationStartDate','investigationEndDate','related_glds']:
            value = raw.get(key)
            fields[key] = {'value': value or '', 'badge': 'text' if value else 'not in PSI', 'source': {'file': source, 'key': key}}
        conditions_path = ROOT / 'data/conditions' / (acc+'.csv')
        cond = rows(conditions_path) if conditions_path.exists() else []
        valid = [r for r in cond if r.get('status') == 'extracted']
        real_ids = {r['test_id'] for r in valid if r.get('method') == 'table' and r.get('test_id') and r['test_id'] != '*'}
        def parent(tid):
            match = re.fullmatch(r'(.+?\d)[a-z]', tid)
            return match.group(1) if match and match.group(1) in real_ids else tid
        variables = defaultdict(list)
        for row in valid:
            if row.get('variable') and row.get('value') and row.get('test_id') in real_ids: variables[(row['variable'],row.get('unit',''))].append(row)
        summary = []
        for (var,unit), group in sorted(variables.items()):
            distinct = sorted(set(x['value'] for x in group)); nums=[]
            for v in distinct:
                try: nums.append(float(v))
                except ValueError: pass
            tests = {parent(x['test_id']) for x in group}
            is_outcome = var.startswith('outcome:')
            classification = 'measured' if is_outcome else ('insufficient test count' if len(tests)<2 else ('varied' if len(distinct)>1 and len(nums)==len(distinct) else ('observed constant' if len(distinct)==1 else 'distinct values as recorded')))
            summary.append({'test_count':len(tests),'variable':var,'unit':unit,'values':distinct,'distinct_count':len(distinct),'classification':classification,'min':min(nums) if len(nums)==len(distinct) else None,'max':max(nums) if len(nums)==len(distinct) else None,'value_count':len(group),'source':str(conditions_path.relative_to(ROOT)).replace('\\','/')})
        measurements=[]
        for table in manifests['experimental_tables']:
            if table['accession'] != acc: continue
            p = ROOT / 'data/raw/psi-data' / acc / 'Experimental table' / table['file']
            if not p.is_file(): raise FileNotFoundError(f'Missing experimental table: {p}')
            if p.exists():
                with p.open(encoding='utf-8-sig',errors='replace',newline='') as f:
                    for column in next(csv.reader(f),[]): measurements.append({'column':column,'file':str(p.relative_to(ROOT)).replace('\\','/'),'badge':'table'})
        profiles.append({'accession':acc,'acronym':inv['acronym'],'doi':inv['doi'],'psi_links':psi_links,'fields':fields,'hardware':[x for x in manifests['hardware'] if x['accession']==acc], 'publications':[x for x in manifests['publications'] if x['accession']==acc], 'measurements':measurements,'variables':summary,'test_count':len({parent(t) for t in real_ids}),'value_count':len(valid)})
    out=ROOT/'data/derived/investigation_profiles.json'; out.parent.mkdir(parents=True,exist_ok=True); out.write_text(json.dumps(profiles,indent=2,sort_keys=True,ensure_ascii=False)+'\n',encoding='utf-8'); print(f'{len(profiles)} profiles, {sum(p["value_count"] for p in profiles)} condition rows')
if __name__=='__main__': main()
