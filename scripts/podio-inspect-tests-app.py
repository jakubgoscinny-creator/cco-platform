#!/usr/bin/env python3
"""
CCO-T006: Inspect the Podio Tests app (16243239) before adding the
access_tier field. Looking for:
  1. Any existing field that could already serve as the tier signal
     (Mary might have added something recently).
  2. The full active field list with external_ids so the field-creation
     payload uses the right space.

Uses the jakub-fs Podio profile (PODIO_PROFILE=jakub-fs).
"""
import json
import os
import sys
from pathlib import Path

# Reuse the build-kit auth helpers
SKILL_SCRIPTS = Path(r"C:\Users\jakub\.codex\skills\podio-build-kit\scripts")
sys.path.insert(0, str(SKILL_SCRIPTS))

# Ensure jakub-fs is used
os.environ.setdefault("PODIO_PROFILE", "jakub-fs")

from _spec_lib import load_token, api_get  # noqa: E402

TESTS_APP_ID = 16243239
SNAPSHOT_OUT = Path(__file__).resolve().parent.parent / "snapshots" / "tests-app-pre-t006.json"

NEEDLES = ("access", "tier", "freemium", "premium", "subscription", "member", "free", "paywall")


def main() -> int:
    access = load_token()
    print(f"Using PODIO_PROFILE={os.environ.get('PODIO_PROFILE')}")

    print(f"GET /app/{TESTS_APP_ID} ...")
    app = api_get(f"/app/{TESTS_APP_ID}", access)

    fields = app.get("fields", [])
    active = [f for f in fields if f.get("status") == "active"]

    print(f"\nTests app: '{app.get('config', {}).get('name', '?')}'")
    print(f"  app_id: {app.get('app_id')}")
    print(f"  space_id: {app.get('space_id')}")
    print(f"  fields total: {len(fields)} (active: {len(active)})")
    print()

    # Sort active fields by created_on desc to spot recent additions
    def created_on(f: dict) -> str:
        return str(f.get("created_on", ""))

    active_sorted = sorted(active, key=created_on, reverse=True)

    print("=== Recent active fields (newest first) ===")
    print(f"{'created_on':<22} {'field_id':<10} {'type':<14} {'external_id':<32} label")
    print("-" * 110)
    for f in active_sorted[:15]:
        cfg = f.get("config", {})
        print(
            f"{created_on(f):<22} {str(f.get('field_id', '')):<10} "
            f"{str(f.get('type', '')):<14} {str(f.get('external_id', '')):<32} "
            f"{cfg.get('label', '?')}"
        )
    print()

    # Hunt for relevant existing fields
    print("=== Fields whose name/external_id matches access/tier/freemium/etc. ===")
    hits = []
    for f in active:
        cfg = f.get("config", {})
        label = (cfg.get("label") or "").lower()
        ext = (f.get("external_id") or "").lower()
        hay = f"{label} {ext}"
        if any(needle in hay for needle in NEEDLES):
            hits.append(f)
    if not hits:
        print("  (none)")
    else:
        for f in hits:
            cfg = f.get("config", {})
            print(
                f"  field_id={f.get('field_id')} type={f.get('type')} "
                f"external_id={f.get('external_id')!r} "
                f"label={cfg.get('label')!r} created_on={created_on(f)}"
            )
            if f.get("type") == "category":
                settings = cfg.get("settings") or f.get("config", {})
                # Category options are in `settings.options`
                opts = (cfg.get("settings") or {}).get("options") or []
                if opts:
                    print(f"    options: {[(o.get('id'), o.get('text'), o.get('status')) for o in opts]}")
    print()

    SNAPSHOT_OUT.parent.mkdir(parents=True, exist_ok=True)
    SNAPSHOT_OUT.write_text(json.dumps(app, indent=2), encoding="utf-8")
    print(f"Full snapshot written: {SNAPSHOT_OUT}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
