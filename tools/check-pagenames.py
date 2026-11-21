#!/usr/bin/env python3
"""
Controleert of elke paginanaam die in HTML of JS wordt gebruikt ook in Plugin.cs geregistreerd staat.

Een paginanaam die niet klopt geeft geen foutmelding in Emby: het script wordt gewoon niet gevonden
en de pagina blijft leeg. Precies dat ging mis in 1.4.1.0 (discoveruijs1456 tegenover 1457).
"""
import re, os, sys

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'EmbyDiscover')
NAME = re.compile(r'discover(?:ui|uijs|buttonjs|config|configjs|status|statusjs)\d+')

registered = set(NAME.findall(open(os.path.join(ROOT, 'Plugin.cs'), encoding='utf-8').read()))
print('geregistreerd: ' + ', '.join(sorted(registered)))

problems = 0
for folder, _, files in os.walk(ROOT):
    if os.sep + 'obj' in folder or os.sep + 'bin' in folder:
        continue
    for name in files:
        if not name.endswith(('.html', '.js')):
            continue
        path = os.path.join(folder, name)
        text = open(path, encoding='utf-8').read()
        # De lader houdt bewust een lijst met oude namen bij; die hoeven niet geregistreerd te zijn.
        if name == 'discover-web-loader.js':
            text = re.sub(r'var KNOWN_(UI|BTN) = \[[^\]]*\];', '', text, flags=re.S)
        for used in sorted(set(NAME.findall(text))):
            if used not in registered:
                print('%s gebruikt %s, maar die staat niet in Plugin.cs' % (os.path.relpath(path, ROOT), used))
                problems += 1

sys.exit(1 if problems else 0)
