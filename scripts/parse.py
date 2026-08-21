import re, json, sys

_raw = open('CONTENT.md', 'rb').read()
if _raw[:3] == b'\xef\xbb\xbf':
    _raw = _raw[3:]                      # strip UTF-8 BOM
try:
    src = _raw.decode('utf-8')
except UnicodeDecodeError:
    src = _raw.decode('cp1252')          # editor re-saved as Windows-1252
    print('WARNING: CONTENT.md is not UTF-8. Re-save it as UTF-8.')
src = src.replace('\r\n', '\n').replace('\r', '\n')   # normalise CRLF
body = src[:src.index('# Closing section')]
blocks = re.split(r'\n(?=## )', body)
entries = [b for b in blocks if re.match(r'## \d+ —', b)]

AUTHOR = {'multi-head latent attention','native sparse attention','deepseek sparse attention',
          'gated deltanet','kda / kimi linear'}
PRELIM = {'drope'}

def slug(nm):
    s = nm.lower().split('/')[0].strip()
    s = re.sub(r'[^a-z0-9]+','-',s).strip('-')
    return s

def split_items(txt):
    txt = txt.strip()
    if txt.startswith('-'):
        return [re.sub(r'^-\s*','',l).strip() for l in txt.split('\n') if l.strip().startswith('-')]
    parts = re.split(r'(?<=[.!?])\s+(?=[A-Z“"*])', txt)
    return [p.strip() for p in parts if p.strip()]

out = []
for b in entries:
    lines = b.split('\n')
    num, name = re.match(r'## (\d+) — (.*)', lines[0]).groups()
    meta = lines[1]
    date = re.search(r'`([\d\-~]+[^`]*)`', meta).group(1)
    adopted = None
    am = re.search(r'adopted `([^`]+)`', meta)
    if am: adopted = am.group(1)
    tier = int(re.search(r'Tier (\d)', meta).group(1))
    segs = [x.strip() for x in meta.split('·')]
    viz = next((s for s in segs if not s.startswith('`') and not s.startswith('Tier')
                and not s.startswith('threads') and not s.startswith('adopted')), 'none')
    tm = re.search(r'threads:\s*(.+)$', meta)
    threads = [t.strip() for t in tm.group(1).split(',')] if tm else []
    unverified = '○' in meta

    note = ' '.join(re.sub(r'^>\s*','',l).strip() for l in lines if l.strip().startswith('>')) or None

    fields = {}
    for key in ['Problem','Mechanism','Buys','Costs','Pick when','Avoid when','Lineage']:
        m = re.search(r'\*\*%s\.?\*\*\s*(.*?)(?=\n\*\*(?:Problem|Mechanism|Buys|Costs|Pick when|Avoid when|Lineage)|\n> \*\*|\Z)'
                      % re.escape(key), b, re.S)
        v = m.group(1).strip() if m else ''
        v = re.sub(r'\s*\n+\s*-{3,}\s*$', '', v).strip()
        fields[key] = v

    callout = None
    cm = re.search(r'> \*\*Callout[^\n]*\n((?:>.*\n?)+)', b)
    if cm:
        callout = ' '.join(re.sub(r'^>\s*','',l).strip() for l in cm.group(1).split('\n')).strip()
        fields['Costs'] = fields['Costs'].split('> **Callout')[0].strip()

    lo = name.lower()
    ev = 'preliminary' if lo in PRELIM else ('author-reported' if lo in AUTHOR else 'independent')

    out.append(dict(
        id=slug(name), num=int(num), name=name, date=date, adopted=adopted,
        dateUnverified=unverified, tier=tier, viz=viz, threads=threads,
        evidence=ev, note=note, callout=callout,
        problem=fields['Problem'], mechanism=fields['Mechanism'],
        buys=split_items(fields['Buys']), costs=split_items(fields['Costs']),
        pickWhen=fields['Pick when'], avoidWhen=fields['Avoid when'],
        lineage=fields['Lineage']))

with open('src/data/registry.json','w',encoding='utf-8') as fh:
    json.dump(out, fh, indent=1, ensure_ascii=True)
bad = [e['id'] for e in out if not e['problem'] or not e['costs'] or not e['pickWhen']]
hr  = [e['id'] for e in out if any(str(v).rstrip().endswith('---') for v in e.values() if isinstance(v,str))]
dup = [e['id'] for e in out if re.search(r'([A-Za-z][\w\- ]{1,28}?)\s*\(\1\)', e['lineage'], re.I)]
assert not hr,  'markdown rule leaked into: %s' % hr
assert not dup, 'duplicated name deref in: %s' % dup
_check = open('src/data/registry.json','rb').read()
assert all(b < 128 for b in _check), 'registry.json is not pure ASCII'
print('registry.json OK - pure ASCII, no markdown leakage, no duplicate derefs')
print("entries:", len(out), "| incomplete:", bad or "none")
print("unverified dates:", sum(1 for e in out if e['dateUnverified']))
