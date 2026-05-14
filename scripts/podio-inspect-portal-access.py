#!/usr/bin/env python3
"""
CCO-T006: Investigate the existing 'Portal Access Allowed For' field on
the Tests app. Goal: decide whether to reuse this field or add a fresh
`access_tier` category field.

We need:
  1. The referenced app (where the allow-list values live).
  2. Field settings (single vs multiple, referenceable_types).
  3. Values currently set on the ~10 Active-in-Portal tests so we can
     map them to Free / Member.
  4. The referenced app's items so we know what allow-list values look
     like (e.g. tier rows like "Free" / "Member" / "Club" / "Public").
"""
import json
import os
import sys
from pathlib import Path

SKILL_SCRIPTS = Path(r"C:\Users\jakub\.codex\skills\podio-build-kit\scripts")
sys.path.insert(0, str(SKILL_SCRIPTS))

os.environ.setdefault("PODIO_PROFILE", "jakub-fs")

from _spec_lib import load_token, api_get, api_post  # noqa: E402

TESTS_APP_ID = 16243239
PORTAL_ACCESS_FIELD_ID = 273131398
ACTIVE_IN_PORTAL_FIELD_ID = 125981847  # Test Status; "Active - In Portal" is option id 19


def main() -> int:
    access = load_token()

    snapshot_path = Path(__file__).resolve().parent.parent / "snapshots" / "tests-app-pre-t006.json"
    app = json.loads(snapshot_path.read_text(encoding="utf-8"))

    # 1. Find the Portal Access Allowed For field config
    target = None
    for f in app.get("fields", []):
        if f.get("field_id") == PORTAL_ACCESS_FIELD_ID:
            target = f
            break
    if not target:
        print(f"Field {PORTAL_ACCESS_FIELD_ID} not found in snapshot.")
        return 1

    print("=== Portal Access Allowed For (field 273131398) ===")
    cfg = target.get("config", {})
    print(f"  label: {cfg.get('label')}")
    print(f"  external_id: {target.get('external_id')}")
    print(f"  status: {target.get('status')}")
    print(f"  description: {cfg.get('description')!r}")
    settings = cfg.get("settings", {})
    print(f"  multiple: {settings.get('multiple')}")
    ref_apps = settings.get("referenceable_types") or settings.get("referenced_apps") or []
    print(f"  referenceable_types / referenced_apps: {ref_apps}")
    print()

    # 2. Pull the referenced app(s) - inspect what allow-list values look like
    ref_app_ids = []
    for entry in ref_apps:
        if isinstance(entry, dict):
            # Different shapes: sometimes app_id, sometimes id, sometimes nested
            ref_app_ids.append(entry.get("app_id") or entry.get("id"))
        elif isinstance(entry, int):
            ref_app_ids.append(entry)
    ref_app_ids = [a for a in ref_app_ids if a]
    print(f"Referenced app IDs: {ref_app_ids}")
    for aid in ref_app_ids:
        try:
            ref_app = api_get(f"/app/{aid}", access)
            print(f"  app {aid}: '{ref_app.get('config', {}).get('name')}' "
                  f"(space {ref_app.get('space_id')})")
            print(f"    item_name: {ref_app.get('config', {}).get('item_name')}")
            # Pull some items from this referenced app to see what values exist
            items_resp = api_post(
                f"/item/app/{aid}/filter/", access,
                {"limit": 30, "offset": 0}
            )
            items = items_resp.get("items", []) if isinstance(items_resp, dict) else []
            if items:
                print(f"    items (up to 30):")
                for it in items:
                    print(f"      [{it.get('item_id')}] {it.get('title')!r}")
        except SystemExit as e:
            print(f"  app {aid}: FAILED to fetch: {e}")
    print()

    # 3. Pull tests filtered to "Active - In Portal" (status option id 19) and
    #    show their Portal Access Allowed For values
    print("=== Active-In-Portal tests + their Portal Access Allowed For values ===")
    test_filter = {
        "filters": {ACTIVE_IN_PORTAL_FIELD_ID: [19]},
        "limit": 30,
        "offset": 0,
    }
    try:
        resp = api_post(f"/item/app/{TESTS_APP_ID}/filter/", access, test_filter)
        items = resp.get("items", []) if isinstance(resp, dict) else []
        print(f"  Active tests found: {len(items)}")
        for it in items:
            tid = it.get("item_id")
            title = it.get("title")
            # Read the Portal Access Allowed For value off this test
            access_val = None
            for fld in it.get("fields", []):
                if fld.get("field_id") == PORTAL_ACCESS_FIELD_ID:
                    vals = fld.get("values", [])
                    access_val = [v.get("value", {}).get("title") or v.get("value", {}).get("item_id")
                                  for v in vals]
                    break
            print(f"  [{tid}] {title!r} -> Portal Access: {access_val}")
    except SystemExit as e:
        print(f"  filter failed: {e}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
