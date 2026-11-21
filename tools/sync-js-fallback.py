#!/usr/bin/env python3
"""
Zet de Engelse teksten die een browserscript gebruikt als vangnet in dat script.

De scripts halen hun teksten bij de server op (Discover/Home of Discover/Status). Alles wat
daarvoor al op het scherm komt, zou anders een sleutel laten zien. Dit blok vangt dat op.

  python3 tools/sync-js-fallback.py          controleer (exit 1 als het niet klopt)
  python3 tools/sync-js-fallback.py --write  bijwerken
"""
import json, re, sys, os

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'EmbyDiscover')
FILES = ['Configuration/discoverPage.js', 'Configuration/statusPage.js', 'Resources/discover-request-button.js']
BEGIN = '    // <fallback-en> automatisch gevuld door tools/sync-js-fallback.py; niet met de hand aanpassen'
END = '    // </fallback-en>'

def build(path, en):
    src = open(path, encoding='utf-8').read()
    keys = sorted(set(re.findall(r"""t\(\s*['"]([^'"]+)['"]""", src)))
    table = {k: en[k] for k in keys if k in en}
    body = json.dumps(table, ensure_ascii=False, indent=8, sort_keys=True)
    body = body.replace('\n}', '\n    }')
    return src, BEGIN + '\n    var STR_EN = ' + body + ';\n' + END

def main():
    write = '--write' in sys.argv
    en = json.load(open(os.path.join(ROOT, 'Lang', 'en.json'), encoding='utf-8'))
    bad = []
    for rel in FILES:
        path = os.path.join(ROOT, rel)
        src, block = build(path, en)
        if BEGIN not in src:
            print('%s: geen <fallback-en>-blok gevonden' % rel); bad.append(rel); continue
        start = src.index(BEGIN)
        stop = src.index(END, start) + len(END)
        if src[start:stop] == block:
            continue
        if write:
            open(path, 'w', encoding='utf-8').write(src[:start] + block + src[stop:])
            print('%s: bijgewerkt' % rel)
        else:
            print('%s: loopt achter op Lang/en.json' % rel); bad.append(rel)
    if bad and not write:
        print('\nDraai: python3 tools/sync-js-fallback.py --write'); return 1
    return 0

sys.exit(main())
