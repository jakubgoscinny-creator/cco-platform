#!/usr/bin/env python3
"""Find an active subscriber whose Podio Contact email is already lowercase
(so the portal's lowercase filter finds them)."""
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
SUBSCRIPTION_STATUS_FIELD = 134218375
ACTIVE_OPTION_IDS = [2, 7, 8, 9]  # Active Annual, Monthly (26), Monthly (Grandfathered), Monthly

access = load_token()
print("Scanning subscribers for one with already-lowercase Podio email ...")
seen = 0
candidates = []
offset = 0
while seen < 60 and len(candidates) < 5:
    resp = api_post(
        f"/item/app/{CONTACTS_APP}/filter/",
        access,
        {
            "filters": {SUBSCRIPTION_STATUS_FIELD: ACTIVE_OPTION_IDS},
            "limit": 30,
            "offset": offset,
            "sort_by": "last_edit_on",
            "sort_desc": True,
        },
    )
    items = resp.get("items", [])
    if not items:
        break
    for it in items:
        seen += 1
        cid = it.get("item_id")
        title = it.get("title")
        email = ""
        status = ""
        for f in it.get("fields", []):
            if f.get("field_id") == EMAIL_FIELD:
                vals = f.get("values", [])
                if vals:
                    v = vals[0].get("value")
                    if isinstance(v, str):
                        email = v
                    elif isinstance(v, dict):
                        email = v.get("value") or ""
            elif f.get("field_id") == SUBSCRIPTION_STATUS_FIELD:
                vals = f.get("values", [])
                if vals:
                    status = vals[0].get("value", {}).get("text", "")
        if email and email == email.lower():
            candidates.append((cid, title, email, status))
            print(f"  CANDIDATE [{cid}] {title!r} -> {email!r} ({status!r})")
    offset += len(items)

print()
print(f"Scanned {seen} subscribers, found {len(candidates)} with all-lowercase emails.")
