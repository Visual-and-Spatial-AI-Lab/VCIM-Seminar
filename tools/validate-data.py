#!/usr/bin/env python3
"""Validate seminars.js without executing JavaScript. Python standard library only.
Usage: python3 tools/validate-data.py [path/to/seminars.js]
"""
from __future__ import annotations
from datetime import date
from pathlib import Path
from urllib.parse import urlparse
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError
import json
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
SEASONS = {'Winter', 'Spring', 'Summer', 'Fall'}
STATUSES = {'upcoming', 'current', 'completed'}

def read_content(path: Path) -> dict:
    source = path.read_text(encoding='utf-8-sig').strip()
    source = re.sub(r'(?m)^\s*//[^\n]*(?:\n|$)', '', source).strip()
    if not source.startswith('{'):
        match = re.fullmatch(r'window\.VCIM_DATA\s*=\s*(\{[\s\S]*\})\s*;?\s*', source)
        if not match:
            raise ValueError('Expected window.VCIM_DATA = { ... }; or a JSON object.')
        source = match.group(1)
    value = json.loads(source)
    if not isinstance(value, dict):
        raise ValueError('Content must be a JSON object.')
    return value

def validate(data: dict) -> list[str]:
    errors = []
    if data.get('schemaVersion') != 1:
        errors.append('schemaVersion must be 1.')
    site = data.get('site')
    if not isinstance(site, dict):
        errors.append('site must be an object.')
    else:
        for key in ['name', 'program', 'university', 'college', 'chair']:
            if not isinstance(site.get(key), str) or not site[key].strip():
                errors.append(f'site.{key} must be nonempty text.')
        for key in ['programUrl', 'collegeUrl']:
            value = site.get(key)
            parsed = urlparse(value) if isinstance(value, str) else None
            if not parsed or parsed.scheme != 'https' or not parsed.netloc:
                errors.append(f'site.{key} must be an HTTPS URL.')
        support = site.get('support')
        if not isinstance(support, list) or any(not isinstance(name, str) or not name.strip() for name in support):
            errors.append('site.support must contain nonempty names.')
        try:
            ZoneInfo(site.get('timeZone', ''))
        except (ZoneInfoNotFoundError, ValueError, TypeError):
            errors.append('site.timeZone must be a valid timezone.')
    semesters = data.get('semesters')
    if not isinstance(semesters, list) or not semesters:
        return errors + ['At least one semester is required.']
    ids, labels, current = set(), set(), 0
    for index, semester in enumerate(semesters, 1):
        if not isinstance(semester, dict):
            errors.append(f'Semester {index} must be an object.')
            continue
        sid = semester.get('id')
        if not isinstance(sid, str) or not re.fullmatch(r'[a-z0-9]+(?:-[a-z0-9]+)*', sid):
            errors.append(f'Semester {index}: invalid ID.')
        elif sid in ids:
            errors.append(f'Duplicate semester ID: {sid}.')
        else:
            ids.add(sid)
        year, season, status = semester.get('year'), semester.get('season'), semester.get('status')
        label = f'{season} {year}'
        if label in labels:
            errors.append(f'Duplicate semester: {label}.')
        labels.add(label)
        if type(year) is not int or not 2000 <= year <= 2199:
            errors.append(f'{label}: invalid year.')
        if season not in SEASONS:
            errors.append(f'{label}: invalid season.')
        if status not in STATUSES:
            errors.append(f'{label}: invalid status.')
        current += status == 'current'
        talks = semester.get('talks')
        if not isinstance(talks, list):
            errors.append(f'{label}: talks must be an array.')
            continue
        for number, talk in enumerate(talks, 1):
            where = f'{label}, talk {number}'
            if not isinstance(talk, dict):
                errors.append(f'{where}: invalid talk.')
                continue
            if set(talk) != {'date', 'speaker', 'title'}:
                errors.append(f'{where}: use only date, speaker, and title.')
            try:
                value = talk.get('date')
                if not isinstance(value, str) or not re.fullmatch(r'\d{4}-\d{2}-\d{2}', value):
                    raise ValueError
                parsed = date.fromisoformat(value)
                if parsed.year != year:
                    errors.append(f'{where}: date year differs from semester year.')
            except ValueError:
                errors.append(f'{where}: enter a real date in YYYY-MM-DD format.')
            if not isinstance(talk.get('speaker'), str) or not talk['speaker'].strip():
                errors.append(f'{where}: a speaker name is required.')
            if not isinstance(talk.get('title'), str):
                errors.append(f'{where}: title must be text. Use TBD if not announced.')
    if current > 1:
        errors.append('Only one semester may be current.')
    return errors

def main() -> int:
    path = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / 'data/seminars.js'
    try:
        data = read_content(path)
        errors = validate(data)
    except (OSError, ValueError, TypeError) as error:
        print(f'ERROR: {error}', file=sys.stderr)
        return 1
    if errors:
        print('\n'.join(f'ERROR: {error}' for error in errors), file=sys.stderr)
        return 1
    total = sum(len(semester['talks']) for semester in data['semesters'])
    print(f'PASS: {len(data["semesters"])} semesters, {total} talks. No content errors.')
    for semester in data['semesters']:
        print(f'  {semester["season"]} {semester["year"]}: {len(semester["talks"])} talks [{semester["status"]}]')
    return 0

if __name__ == '__main__':
    raise SystemExit(main())
