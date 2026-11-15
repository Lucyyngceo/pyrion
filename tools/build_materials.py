import csv,json
from pathlib import Path
from collections import defaultdict
ROOT=Path(__file__).resolve().parents[1]
def main():
    tests=defaultdict(list)
    for p in sorted((ROOT/'data/conditions').glob('PSI-*.csv')):
        with p.open(encoding='utf-8-sig',newline='') as f:
            for r in csv.DictReader(f):
                if r['status']=='extracted': tests[(r['accession'],r['test_id'])].append(r)
    materials=defaultdict(list); ceilings=defaultdict(list);burner=[];excluded=[]
    for (acc,tid), rows in sorted(tests.items()):
        if not tid: continue
        for r in rows:
            if r['variable']=='material' and r['value']:
                matches=[x for x in rows if tid!='*' and x['variable'] in ('o2_mole_fraction','pressure','gravity_regime')]
                materials[r['value']].append({'accession':acc,'test_id':tid,'material_source':r,'conditions':matches})
            if tid!='*' and r['variable'] in ('o2_mole_fraction','burner_o2_mole_fraction'):
                try: n=float(r['value'])
                except ValueError: continue
                if r['variable']=='burner_o2_mole_fraction': burner.append((n,r))
                else:
                    phases=[x for x in rows if x['variable']=='fuel_phase' and x['value']]
                    if not phases:
                        common=[x for x in tests[(acc,'*')] if x['variable']=='fuel_phase' and x['value']]
                        if len({x['value'] for x in common})==1: phases=common[:1]
                    if len({x['value'] for x in phases})==1:
                        phase=phases[0]
                        gravity=[x for x in rows if x['variable']=='gravity_regime' and x['value']]
                        if not gravity:
                            shared=[x for x in tests[(acc,'*')] if x['variable']=='gravity_regime' and x['value']]
                            if len({x['value'] for x in shared})==1: gravity=shared[:1]
                        ceilings[phase['value']].append((n,r,phase,gravity))
                    else: excluded.append(r)
    def maximum(items):
        if not items:return []
        top=max(x[0] for x in items);seen=set();result=[]
        for x in items:
            key=(x[1]['accession'],x[1]['test_id'],x[1]['source_file'],x[1]['source_location'])
            if x[0]==top and key not in seen: result.append(list(x[1:]));seen.add(key)
        return result
    def material_record(name, entries):
        ranges=[]
        for variable in ('o2_mole_fraction','pressure'):
            units=sorted(set(r['unit'] for e in entries for r in e['conditions'] if r['variable']==variable))
            for unit in units:
                candidates=[]
                for e in entries:
                    for r in e['conditions']:
                        if r['variable']==variable and r['unit']==unit:
                            try: candidates.append((float(r['value']),r))
                            except ValueError: pass
                if candidates:
                    low=min(candidates,key=lambda x:x[0]); high=max(candidates,key=lambda x:x[0]); ranges.append({'variable':variable,'unit':unit,'min':low[0],'max':high[0],'min_source':low[1],'max_source':high[1]})
        return {'name':name,'tests':entries,'ranges':ranges}
    out={'materials':[material_record(k,v) for k,v in sorted(materials.items())], 'ambient_ceilings':{k:maximum(v) for k,v in sorted(ceilings.items())},'burner_ceiling':maximum(burner),'excluded_ambient':excluded,'note':'Phase from the test; otherwise the single distinct extracted investigation-wide phase; ambiguous or missing phase excluded.'}
    target=ROOT/'data/derived/materials.json';target.write_text(json.dumps(out,ensure_ascii=False,indent=2,sort_keys=True)+'\n',encoding='utf-8');print(f'{len(materials)} material values')
if __name__=='__main__':main()
