#!/usr/bin/env python3
"""Round 2: clean up probe-2; try object-property accessors on embed token."""
import os, sys, json
from pathlib import Path
SKILL_SCRIPTS = Path(r"C:\Users\jakub\.codex\skills\podio-build-kit\scripts")
sys.path.insert(0, str(SKILL_SCRIPTS))
os.environ.setdefault("PODIO_PROFILE", "jakub-fs")
from _spec_lib import load_token, api_get, api_post, api_delete  # noqa: E402

CONTACTS_APP = 14660191
JAKUB_FS = 2911468032
PROBE_2_FIELD_ID = 276937584  # to delete

PROBES = [
    ("probe-7-dot-url",  "@[Circle Profile Link](field_273667474).url"),
    ("probe-8-bracket-0",  "@[Circle Profile Link](field_273667474)[0]"),
    ("probe-9-stringify-js", "JSON.stringify(@[Circle Profile Link](field_273667474))"),
    ("probe-10-substr", "(@[Circle Profile Link](field_273667474) + \"\").substring(0, 50)"),
    ("probe-11-toString", "@[Circle Profile Link](field_273667474).toString()"),
]


def main() -> int:
    access = load_token()

    # Step 1: clean up probe-2
    print(f"DELETE /field/{PROBE_2_FIELD_ID} ...")
    try:
        api_delete(f"/field/{PROBE_2_FIELD_ID}", access)
        print("  deleted")
    except SystemExit as e:
        print(f"  delete failed: {str(e)[:300]}")
    print()

    # Step 2: try probes
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
            it = api_get(f"/item/{JAKUB_FS}", access)
            value = None
            for f in it.get("fields", []):
                if f.get("external_id") == full_ext:
                    vals = f.get("values", [])
                    if vals:
                        value = vals[0].get("value")
                    break
            print(f"  [{ext_id}] field_id={fid} computed={value!r}")
            results.append({"ext_id": ext_id, "formula": formula, "field_id": fid, "computed": value})
        except SystemExit as e:
            msg = str(e)[:200]
            print(f"  [{ext_id}] FAILED: {msg}")
            results.append({"ext_id": ext_id, "formula": formula, "error": msg})
    print()
    print("=== Summary ===")
    print(json.dumps(results, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
