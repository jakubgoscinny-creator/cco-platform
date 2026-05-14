#!/usr/bin/env python3
"""
CCO-T029: experiment — try adding a Podio calc field that extracts the
Circle publicUid (8-char hex) from the existing `Circle Profile Link`
URL (field 273667474, embed).

Strategy:
  1. POST a hidden calc field with a JS-style `split('/u/').pop()`
     formula. Label suffix `[H]` follows the existing convention
     (see `Last Circle JSON Payload [H]`).
  2. Fetch Jakub-fs Contact (2911468032). Expected calc value:
     '72899cb9' (matches window.circleUser.publicUid).
  3. If correct: print SUCCESS and the new field_id.
  4. If wrong/empty: print FAIL and the actual computed value so
     we can iterate on the formula.

Idempotent: refuses to recreate the field if external_id already
exists. Easy to delete via the Podio UI / API if the formula needs
revising.
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
CIRCLE_PROFILE_LINK_FIELD = 273667474
JAKUB_FS = 2911468032
EXPECTED = "72899cb9"
NEW_EXT_ID = "circle-user-public-uid-h"

# JS-like formula. Podio's calc engine supports JavaScript-ish syntax;
# we'll learn whether .split() + .pop() + URL access work on embed fields.
FORMULA = '@[Circle Profile Link](field_273667474).split("/u/").pop()'


def main() -> int:
    access = load_token()

    # Step 1: idempotency check
    print(f"GET /app/{CONTACTS_APP} ...")
    app = api_get(f"/app/{CONTACTS_APP}", access)
    existing = next((f for f in app.get("fields", []) if f.get("external_id") == NEW_EXT_ID and f.get("status") == "active"), None)
    if existing:
        print(f"  Already exists: field_id={existing.get('field_id')}, label={existing.get('config', {}).get('label')!r}")
        print(f"  Skipping create. Verifying value on Jakub-fs ...")
    else:
        # Step 2: create the field
        payload = {
            "type": "calculation",
            "external_id": NEW_EXT_ID,
            "config": {
                "label": "Circle User Public UID [H]",
                "description": "Auto-extracted from Circle Profile Link URL. Used by the CCO portal SSO to map a Circle user to the canonical Contact. CCO-T029.",
                "hidden": True,
                "required": False,
                "settings": {
                    "script": FORMULA,
                    "return_type": "text",
                },
            },
        }
        print(f"POST /app/{CONTACTS_APP}/field/ ...")
        print(f"Formula: {FORMULA}")
        resp = api_post(f"/app/{CONTACTS_APP}/field/", access, payload)
        print(f"  Created: {resp}")

    # Step 3: verify on Jakub-fs
    print(f"\nGET /item/{JAKUB_FS} ...")
    it = api_get(f"/item/{JAKUB_FS}", access)
    actual = None
    for f in it.get("fields", []):
        if f.get("external_id") == NEW_EXT_ID:
            vals = f.get("values", [])
            if vals:
                actual = vals[0].get("value")
            print(f"  field_id={f.get('field_id')}")
            print(f"  values={vals}")
            break

    print()
    print(f"Expected: {EXPECTED!r}")
    print(f"Actual:   {actual!r}")
    if actual == EXPECTED:
        print("\nSUCCESS — calc field extracts publicUid correctly.")
        return 0
    elif actual:
        print("\nMISMATCH — got a value but not the expected publicUid.")
        return 2
    else:
        print("\nFAIL — calc field exists but returned no value.")
        return 3


if __name__ == "__main__":
    sys.exit(main())
