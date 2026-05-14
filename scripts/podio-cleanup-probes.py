#!/usr/bin/env python3
"""Clean up the T029 calc probe fields on Contacts."""
import os, sys
from pathlib import Path
SKILL_SCRIPTS = Path(r"C:\Users\jakub\.codex\skills\podio-build-kit\scripts")
sys.path.insert(0, str(SKILL_SCRIPTS))
os.environ.setdefault("PODIO_PROFILE", "jakub-fs")
from _spec_lib import load_token, api_get, api_delete  # noqa: E402

CONTACTS_APP = 14660191
PROBE_PREFIX = "probe-"
PROBE_SUFFIX = "-h"


def main() -> int:
    access = load_token()
    app = api_get(f"/app/{CONTACTS_APP}", access)
    targets = []
    for f in app.get("fields", []):
        ext = f.get("external_id") or ""
        if ext.startswith(PROBE_PREFIX) and ext.endswith(PROBE_SUFFIX):
            targets.append((f.get("field_id"), ext, f.get("status")))
    print(f"Probe fields found: {len(targets)}")
    for fid, ext, status in targets:
        print(f"  field_id={fid} ext={ext!r} status={status}")
    print()
    # Try the field-delete endpoint pattern Podio uses
    for fid, ext, _ in targets:
        for path in (f"/app/{CONTACTS_APP}/field/{fid}", f"/field/{fid}"):
            try:
                api_delete(path, access)
                print(f"  DELETED {ext} via {path}")
                break
            except SystemExit as e:
                msg = str(e).splitlines()[-1][:200]
                print(f"  DELETE {path} -> {msg}")
        else:
            print(f"  could not delete {ext}; leave in place (hidden)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
