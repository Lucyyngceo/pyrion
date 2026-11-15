import csv,json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
COLS=['accession','acronym','test_id','variable','value','unit','value_original','unit_original','method','source_file','source_location','quote','status','note','doi']
def variable_entry(variable, result):
    rows = [r for r in result if r['variable'] == variable]
    units = sorted(set(r['unit'] or '(blank)' for r in rows))
    examples = sorted(set((r['source_file'], r['source_location'], r['quote']) for r in rows if r['status']=='extracted' and r['quote']), key=lambda x:(-len(x[2]),x))
    source, location, quote = examples[0] if examples else ('', '', '')
    name = variable.replace('outcome:', 'Outcome: ').replace('_', ' ')
    return f'- `{variable}`: {name}. Units present: {", ".join(units)}. Example source: `{source}`, `{location}`; recorded source text: {quote!r}. Interpret in the context of each row and source.\n'
def main():
    with (ROOT/'data/manifest/investigations.csv').open(encoding='utf-8-sig',newline='') as f: manifest={r['accession']:r for r in csv.DictReader(f)}
    result=[]
    for p in sorted((ROOT/'data/conditions').glob('PSI-*.csv')):
        with p.open(encoding='utf-8-sig',newline='') as f:
            for row in csv.DictReader(f):
                m=manifest.get(row['accession'],{}); row['acronym']=m.get('acronym','');row['doi']=m.get('doi',''); result.append({k:row.get(k,'') for k in COLS})
    out=ROOT/'data/derived/unified';out.mkdir(parents=True,exist_ok=True)
    with (out/'pyrion_psi_combustion.csv').open('w',encoding='utf-8',newline='') as f:
        w=csv.DictWriter(f,fieldnames=COLS,lineterminator='\n');w.writeheader();w.writerows(result)
    (out/'pyrion_psi_combustion.json').write_text(json.dumps(result,ensure_ascii=False,indent=2,sort_keys=True)+'\n',encoding='utf-8')
    descriptions={'accession':'PSI investigation identifier','acronym':'Investigation acronym from the manifest','test_id':'Test identifier in the condition extraction','variable':'Condition variable name','value':'Extracted value in the reported harmonised unit','unit':'Unit of value; blank for categorical values','value_original':'Value as recorded by the extraction','unit_original':'Original unit','method':'Extraction method as recorded','source_file':'Path relative to data/raw/; source files are not in the public repo and can be obtained from PSI','source_location':'Location within the source','quote':'Source text recorded by the extraction','status':'Extraction status: extracted denotes a retained extraction; insufficient_evidence is flagged and must not be used as a measurement','note':'Extraction note, including caveats','doi':'Investigation DOI from the manifest'}
    variables=sorted(set(r['variable'] for r in result)); dictionary='# PYRION PSI combustion data dictionary\n\nOne row per extracted condition value. Values and units are copied from data/conditions; no additional conversions are performed. Unit `1` denotes a dimensionless fraction. `o2_mole_fraction` is ambient oxygen; `burner_o2_mole_fraction` is oxygen in the burner stream, not the cabin. Flagged `insufficient_evidence` rows are not observations for calculations. In PSI-69, `outcome:burning_rate` rows with unit mm are flagged insufficient evidence and must not be interpreted as burning rates.\n\n## Columns\n\n'+''.join(f'- `{k}`: {descriptions[k]}.\n' for k in COLS)+'\n## Variables\n\n'+''.join(variable_entry(v, result) for v in variables)
    (out/'data_dictionary.md').write_text(dictionary,encoding='utf-8');print(f'{len(result)} rows, {len(variables)} variables')
if __name__=='__main__':main()
