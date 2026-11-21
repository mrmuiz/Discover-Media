#!/usr/bin/env python3
"""
Controleert de taalbestanden in EmbyDiscover/Lang.

Engels is de bron. Per taal wordt gekeken of:
  - elke sleutel ook in en.json staat (een typefout in een sleutel doet anders niets);
  - dezelfde {0}, {1}, ... erin zitten (anders mist er een naam of getal in de zin);
  - de spatie aan het begin en het einde gelijk is (teksten worden aan elkaar geplakt).

De spaties worden met --fix stilzwijgend rechtgezet; de rest moet met de hand.

  python3 tools/check-languages.py          controleren (exit 1 bij een fout)
  python3 tools/check-languages.py --fix    spaties rechtzetten
"""
import json, os, re, sys

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'EmbyDiscover', 'Lang')
PLACEHOLDER = re.compile(r'\{(\d+)\}')


def edges(s):
    return (len(s) - len(s.lstrip(' ')), len(s) - len(s.rstrip(' ')))


def main():
    fix = '--fix' in sys.argv
    en = json.load(open(os.path.join(ROOT, 'en.json'), encoding='utf-8'))
    problems = 0
    for name in sorted(os.listdir(ROOT)):
        if not name.endswith('.json') or name == 'en.json':
            continue
        path = os.path.join(ROOT, name)
        table = json.load(open(path, encoding='utf-8'))
        changed = False
        for key in sorted(table):
            value = table[key]
            if key not in en:
                print('%s: onbekende sleutel %s' % (name, key)); problems += 1; continue
            source = en[key]
            if sorted(PLACEHOLDER.findall(value)) != sorted(PLACEHOLDER.findall(source)):
                print('%s: %s heeft andere waarden dan het Engels: %r' % (name, key, value)); problems += 1
            if edges(value) != edges(source) and value.strip():
                if fix:
                    lead, trail = edges(source)
                    table[key] = ' ' * lead + value.strip(' ') + ' ' * trail
                    changed = True
                else:
                    print('%s: %s heeft andere spaties aan begin/eind: %r' % (name, key, value)); problems += 1
        missing = len(en) - sum(1 for k in table if k in en)
        print('%-10s %4d van %d sleutels%s' % (name, len(table), len(en), '' if missing <= 0 else ', %d niet vertaald (vallen terug op Engels)' % missing))
        if changed:
            with open(path, 'w', encoding='utf-8') as fh:
                fh.write('{\n' + ',\n'.join('  %s: %s' % (json.dumps(k, ensure_ascii=False), json.dumps(v, ensure_ascii=False))
                                            for k, v in sorted(table.items())) + '\n}\n')
            print('%s: spaties rechtgezet' % name)
    if problems and not fix:
        print('\n%d probleem(en). Spaties rechtzetten: python3 tools/check-languages.py --fix' % problems)
        return 1
    return 0


sys.exit(main())
