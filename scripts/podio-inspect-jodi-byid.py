#!/usr/bin/env python3
"""Pull Jodi Von's contact by item_id and dump email fields verbatim."""
import json
import os
import sys
from pathlib import Path

SKILL_SCRIPTS = Path(r"C:\Users\jakub\.codex\skills\podio-build-kit\scripts")
sys.path.insert(0, str(SKILL_SCRIPTS))
os.environ.setdefault("PODIO_PROFILE", "jakub-fs")
from _spec_lib import load_token, api_get  # noqa: E402

JODI = 888674970
access = load_token()
it = api_get(f"/item/{JODI}", access)
print(f"item_id: {it.get('item_id')}")
print(f"title:   {it.get('title')!r}")
print()
for f in it.get("fields", []):
    label = f.get("config", {}).get("label", "")
    if "email" in label.lower() or "mail" in label.lower():
        fid = f.get("field_id")
        ext = f.get("external_id")
        type_ = f.get("type")
        vals = f.get("values", [])
        print(f"field_id={fid} type={type_!r} external_id={ext!r} label={label!r}")
        print(f"  values: {json.dumps(vals)[:400]}")
        print()
