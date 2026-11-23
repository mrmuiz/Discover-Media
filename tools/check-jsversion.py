#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Bewaakt dat de versie in de browser-JS gelijk is aan <Version> in de csproj.

  python3 tools/check-jsversion.py          controleren (exit 1 bij verschil)
  python3 tools/check-jsversion.py --write   DC_VER gelijktrekken aan de csproj

DC_VER in discover-request-button.js is ook het herinjectie-slot: staat het op een oud
nummer, dan kan een gecachete oude kopie de nieuwe blokkeren. Daarom faalt de build
als het afwijkt, net als check-pagenames.py voor de paginanamen.
"""
import io
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CSPROJ = os.path.join(ROOT, 'EmbyDiscover', 'EmbyDiscover.csproj')
JS = os.path.join(ROOT, 'EmbyDiscover', 'Resources', 'discover-request-button.js')
PATTERN = re.compile(r"(var DC_VER = ')([^']*)(';)")


def csproj_version():
    text = io.open(CSPROJ, encoding='utf-8').read()
    m = re.search(r'<Version>([^<]+)</Version>', text)
    if not m:
        print('check-jsversion: geen <Version> in de csproj gevonden')
        sys.exit(2)
    return m.group(1).strip()


def main():
    write = '--write' in sys.argv[1:]
    want = csproj_version()
    text = io.open(JS, encoding='utf-8').read()
    m = PATTERN.search(text)
    if not m:
        print('check-jsversion: geen "var DC_VER = ..." in discover-request-button.js gevonden')
        return 1
    have = m.group(2)
    if have == want:
        print('check-jsversion: ok (%s)' % want)
        return 0
    if write:
        io.open(JS, 'w', encoding='utf-8').write(PATTERN.sub(lambda g: g.group(1) + want + g.group(3), text, count=1))
        print('check-jsversion: DC_VER %s -> %s' % (have, want))
        return 0
    print('check-jsversion: DC_VER is %s maar de csproj zegt %s' % (have, want))
    print('Gelijktrekken: python3 tools/check-jsversion.py --write')
    return 1


if __name__ == '__main__':
    sys.exit(main())
