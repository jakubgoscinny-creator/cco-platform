#!/usr/bin/env python3
"""
CCO-T006: Add the access_tier category field to the Podio Tests app.

Field spec (matches the code in src/lib/circle-access.ts):
  - label: "Access Tier"
  - external_id: "access-tier" (lowercase, hyphen — matches TEST_FIELDS.ACCESS_TIER)
  - type: category, single-select (not multi)
  - options: "Free", "Member"
  - description: explains the semantic

Reuses an existing category field's settings schema as the canonical shape
(read from snapshot). Idempotent: checks first that access-tier doesn't
already exist (otherwise skips). Uses jakub-fs Podio profile.

Reference: docs/AGENTS.md "Podio category fields PUT: settings live at TOP
LEVEL, never nested in `config`" — we're creating, not PUTting, so config
nesting differs. The CREATE shape has settings nested in config per Podio
spec.
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
NEW_EXTERNAL_ID = "access-tier"

PAYLOAD = {
    "type": "category",
    "external_id": NEW_EXTERNAL_ID,
    "config": {
        "label": "Access Tier",
        "description": (
            "Per-test access gate for the CCO portal (CCO-T006). "
            "Free: visible to everyone. Member: visible only to active "
            "Club subscribers (Monthly, Monthly (26), Monthly "
            "(Grandfathered), Active Annual). Untagged tests default to "
            "Member (fail-closed) on the portal."
        ),
        "required": False,
        "settings": {
            "multiple": False,
            "display": "inline",
            "options": [
                {"text": "Free",   "color": "DCEBD8"},  # green
                {"text": "Member", "color": "DBD5E9"},  # purple
            ],
        },
    },
}


def main() -> int:
    access = load_token()
    print(f"Using PODIO_PROFILE={os.environ.get('PODIO_PROFILE')}")

    # Idempotency: skip if access-tier already exists
    print(f"GET /app/{TESTS_APP_ID} ...")
    app = api_get(f"/app/{TESTS_APP_ID}", access)
    for f in app.get("fields", []):
        if f.get("external_id") == NEW_EXTERNAL_ID and f.get("status") == "active":
            cfg = f.get("config", {})
            print(f"  access-tier already exists (field_id={f.get('field_id')}, label={cfg.get('label')!r}).")
            opts = (cfg.get("settings") or {}).get("options") or []
            print(f"  options: {[(o.get('text'), o.get('id'), o.get('status')) for o in opts]}")
            return 0

    print(f"POST /app/{TESTS_APP_ID}/field ...")
    print(f"Payload:")
    print(json.dumps(PAYLOAD, indent=2))
    print()
    resp = api_post(f"/app/{TESTS_APP_ID}/field/", access, PAYLOAD)
    print(f"Field created. Response:")
    print(json.dumps(resp, indent=2))

    # Re-read to confirm
    print()
    print("Confirming...")
    app2 = api_get(f"/app/{TESTS_APP_ID}", access)
    for f in app2.get("fields", []):
        if f.get("external_id") == NEW_EXTERNAL_ID:
            cfg = f.get("config", {})
            print(f"  access-tier present: field_id={f.get('field_id')}, label={cfg.get('label')!r}")
            opts = (cfg.get("settings") or {}).get("options") or []
            for o in opts:
                print(f"    option: id={o.get('id')} text={o.get('text')!r} status={o.get('status')}")
            return 0

    print("WARN: access-tier still not found after POST.")
    return 1


if __name__ == "__main__":
    sys.exit(main())
