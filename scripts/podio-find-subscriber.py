#!/usr/bin/env python3
"""
CCO-T006 smoke: find a few Contacts with an active SUBSCRIPTION_STATUS
(per Mary's canonical allow-list) so we can sign in as them via Circle
SSO and verify the subscriber path.
"""
import json
import os
import sys
from pathlib import Path

SKILL_SCRIPTS = Path(r"C:\Users\jakub\.codex\skills\podio-build-kit\scripts")
sys.path.insert(0, str(SKILL_SCRIPTS))

os.environ.setdefault("PODIO_PROFILE", "jakub-fs")

from _spec_lib import load_token, api_get, api_post  # noqa: E402

CONTACTS_APP = 14660191
SUBSCRIPTION_STATUS_FIELD = 134218375
EMAIL_FIELD = 112436968
ACTIVE_TEXTS = {"Monthly (Grandfathered)", "Monthly (26)", "Active Annual", "Monthly"}
RENEE_CONTACT_ID = 3275345593  # test account from memory


def main() -> int:
    access = load_token()

    # 1. Find the SUBSCRIPTION_STATUS field option IDs that match the allow-list
    print("Fetching Contacts app schema to map active option IDs ...")
    app = api_get(f"/app/{CONTACTS_APP}", access)
    sub_field = next(
        (f for f in app.get("fields", []) if f.get("field_id") == SUBSCRIPTION_STATUS_FIELD),
        None,
    )
    if not sub_field:
        print("SUBSCRIPTION_STATUS field not found.")
        return 1
    opts = (sub_field.get("config", {}).get("settings") or {}).get("options") or []
    active_options = [
        o for o in opts if o.get("status") == "active" and o.get("text") in ACTIVE_TEXTS
    ]
    active_ids = [o.get("id") for o in active_options]
    print("Active subscriber option IDs:")
    for o in active_options:
        print(f"  {o.get('id')} = {o.get('text')!r}")
    print()

    # 2. Check Renee's status first (canonical test account)
    print(f"Checking Renee (contact {RENEE_CONTACT_ID}) ...")
    try:
        renee = api_get(f"/item/{RENEE_CONTACT_ID}", access)
        renee_status = ""
        renee_email = ""
        for f in renee.get("fields", []):
            if f.get("field_id") == SUBSCRIPTION_STATUS_FIELD:
                vals = f.get("values", [])
                if vals:
                    renee_status = vals[0].get("value", {}).get("text", "")
            elif f.get("field_id") == EMAIL_FIELD:
                vals = f.get("values", [])
                if vals:
                    v = vals[0].get("value")
                    if isinstance(v, str):
                        renee_email = v
                    elif isinstance(v, dict):
                        renee_email = v.get("value") or ""
        print(f"  Renee email: {renee_email!r}")
        print(f"  Renee SUBSCRIPTION_STATUS: {renee_status!r}")
        print(f"  Renee is active subscriber: {renee_status in ACTIVE_TEXTS}")
    except Exception as e:
        print(f"  Failed to fetch Renee: {e}")
    print()

    # 3. Sample a few subscribers (other than Renee)
    print("Sampling subscribers via filter ...")
    try:
        resp = api_post(
            f"/item/app/{CONTACTS_APP}/filter/",
            access,
            {
                "filters": {SUBSCRIPTION_STATUS_FIELD: active_ids},
                "limit": 5,
                "offset": 0,
                "sort_by": "last_edit_on",
                "sort_desc": True,
            },
        )
        items = resp.get("items", []) if isinstance(resp, dict) else []
        print(f"  Found {resp.get('filtered')} active subscribers (showing {len(items)}):")
        for it in items:
            cid = it.get("item_id")
            email = ""
            status = ""
            name = it.get("title", "")
            for f in it.get("fields", []):
                if f.get("field_id") == SUBSCRIPTION_STATUS_FIELD:
                    vals = f.get("values", [])
                    if vals:
                        status = vals[0].get("value", {}).get("text", "")
                elif f.get("field_id") == EMAIL_FIELD:
                    vals = f.get("values", [])
                    if vals:
                        v = vals[0].get("value")
                        if isinstance(v, str):
                            email = v
                        elif isinstance(v, dict):
                            email = v.get("value") or ""
            print(f"  [{cid}] {name!r:40s} email={email!r:35s} status={status!r}")
    except Exception as e:
        print(f"  filter failed: {e}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
