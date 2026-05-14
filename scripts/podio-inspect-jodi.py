#!/usr/bin/env python3
"""Quick: pull Jodi Von's Contact and show what upsertCircleUser would read."""
import json
import os
import sys
from pathlib import Path

SKILL_SCRIPTS = Path(r"C:\Users\jakub\.codex\skills\podio-build-kit\scripts")
sys.path.insert(0, str(SKILL_SCRIPTS))
os.environ.setdefault("PODIO_PROFILE", "jakub-fs")
from _spec_lib import load_token, api_post  # noqa: E402

CONTACTS_APP = 14660191
EMAIL_FIELD = 112436968
NAME_FIELD = 112436965
SUBSCRIPTION_STATUS_FIELD = 134218375
PASSWORD_MASTER_FIELD = 199172888

EMAIL = "Jodi.vongunten@gmail.com"  # original case from earlier sample

access = load_token()
resp = api_post(
    f"/item/app/{CONTACTS_APP}/filter/",
    access,
    {"filters": {EMAIL_FIELD: [EMAIL.lower()]}, "limit": 1},
)
items = resp.get("items", [])
print(f"Found {len(items)} contact(s) for email {EMAIL!r}")
if not items:
    sys.exit(1)
it = items[0]
print(f"  item_id: {it.get('item_id')}")
print(f"  title:   {it.get('title')!r}")
for f in it.get("fields", []):
    fid = f.get("field_id")
    label = f.get("config", {}).get("label", "?")
    vals = f.get("values", [])
    if fid in (EMAIL_FIELD, NAME_FIELD, SUBSCRIPTION_STATUS_FIELD, PASSWORD_MASTER_FIELD):
        snippet = json.dumps(vals)[:200]
        print(f"  field {fid} {label!r}: {snippet}")
