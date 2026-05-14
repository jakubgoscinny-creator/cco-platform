#!/usr/bin/env python3
"""Probe what Podio's calc engine sees for an embed field."""
import os, sys, json
from pathlib import Path
SKILL_SCRIPTS = Path(r"C:\Users\jakub\.codex\skills\podio-build-kit\scripts")
sys.path.insert(0, str(SKILL_SCRIPTS))
os.environ.setdefault("PODIO_PROFILE", "jakub-fs")
from _spec_lib import load_token, api_get, api_post  # noqa: E402

CONTACTS_APP = 14660191
JAKUB_FS = 2911468032

# Sequence of formulas to try. The first one that creates a field
# without erroring becomes the prototype; we read its computed value
# on Jakub-fs, then delete the field. Idempotency: external_ids are
# probe-N-h so multiple attempts don't collide.
PROBES = [
    ("probe-1-raw", "@[Circle Profile Link](field_273667474)"),
    ("probe-2-stringify", "@[Circle Profile Link](field_273667474) + \"\""),
    ("probe-3-right-8", "RIGHT(@[Circle Profile Link](field_273667474), 8)"),
    ("probe-4-right-8-str", "RIGHT(@[Circle Profile Link](field_273667474) + \"\", 8)"),
    ("probe-5-len", "LEN(@[Circle Profile Link](field_273667474))"),
    ("probe-6-len-str", "LEN(@[Circle Profile Link](field_273667474) + \"\")"),
]


def main() -> int:
    access = load_token()
    results = []
    for ext_id, formula in PROBES:
        full_ext = ext_id + "-h"
        payload = {
            "type": "calculation",
            "external_id": full_ext,
            "config": {
                "label": f"T029 calc probe {ext_id} [H]",
                "hidden": True,
                "required": False,
                "settings": {"script": formula, "return_type": "text"},
            },
        }
        try:
            resp = api_post(f"/app/{CONTACTS_APP}/field/", access, payload)
            fid = resp.get("field_id")
            print(f"  [{ext_id}] created field_id={fid}")
            # Fetch Jakub-fs and read computed value
            it = api_get(f"/item/{JAKUB_FS}", access)
            value = None
            for f in it.get("fields", []):
                if f.get("external_id") == full_ext:
                    vals = f.get("values", [])
                    if vals:
                        value = vals[0].get("value")
                    break
            results.append({"ext_id": ext_id, "formula": formula, "field_id": fid, "computed": value})
            print(f"    computed: {value!r}")
        except SystemExit as e:
            msg = str(e).splitlines()[-1] if "\n" in str(e) else str(e)
            results.append({"ext_id": ext_id, "formula": formula, "error": msg[:300]})
            print(f"  [{ext_id}] FAILED: {msg[:200]}")
    print()
    print("=== Summary ===")
    for r in results:
        print(json.dumps(r, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
