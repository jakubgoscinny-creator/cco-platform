#!/usr/bin/env python3
"""
CCO-T029 prep: audit CIRCLE_USER_ID (field 272609487) coverage across
all active subscribers. If we switch SSO from email to Circle User ID,
any subscriber without a populated CIRCLE_USER_ID will be locked out
on next sign-in — surface that risk concretely so Mary can backfill
before cutover.

Outputs:
  - Total active subscribers
  - How many have CIRCLE_USER_ID set vs not
  - Distribution by SUBSCRIPTION_STATUS
  - Sample of missing-ID rows (up to 20) for Mary's backfill list
  - JSON snapshot at snapshots/circle-user-id-audit.json
"""
import json
import os
import sys
from collections import Counter
from pathlib import Path

SKILL_SCRIPTS = Path(r"C:\Users\jakub\.codex\skills\podio-build-kit\scripts")
sys.path.insert(0, str(SKILL_SCRIPTS))
os.environ.setdefault("PODIO_PROFILE", "jakub-fs")
from _spec_lib import load_token, api_post  # noqa: E402

CONTACTS_APP = 14660191
SUBSCRIPTION_STATUS_FIELD = 134218375
CIRCLE_USER_ID_FIELD = 272609487
EMAIL_FIELD = 112436968
ACTIVE_OPTION_IDS = [2, 7, 8, 9]


def main() -> int:
    access = load_token()
    print("Auditing CIRCLE_USER_ID coverage across active subscribers ...")
    print()

    page_size = 50
    offset = 0
    total_filtered = None
    with_id = 0
    without_id = 0
    status_counts: Counter[str] = Counter()
    missing_sample: list[dict] = []
    with_id_sample: list[dict] = []

    while True:
        resp = api_post(
            f"/item/app/{CONTACTS_APP}/filter/",
            access,
            {
                "filters": {SUBSCRIPTION_STATUS_FIELD: ACTIVE_OPTION_IDS},
                "limit": page_size,
                "offset": offset,
            },
        )
        if total_filtered is None:
            total_filtered = resp.get("filtered", 0)
            print(f"Total active subscribers (Podio reports): {total_filtered}")
            print()
        items = resp.get("items", [])
        if not items:
            break
        for it in items:
            cid = it.get("item_id")
            email = ""
            status = ""
            circle_id = ""
            for f in it.get("fields", []):
                fid = f.get("field_id")
                vals = f.get("values", [])
                if not vals:
                    continue
                if fid == EMAIL_FIELD:
                    v = vals[0].get("value")
                    email = v if isinstance(v, str) else (v.get("value", "") if isinstance(v, dict) else "")
                elif fid == SUBSCRIPTION_STATUS_FIELD:
                    status = vals[0].get("value", {}).get("text", "")
                elif fid == CIRCLE_USER_ID_FIELD:
                    v = vals[0].get("value")
                    if isinstance(v, str):
                        circle_id = v.strip()
                    elif isinstance(v, dict):
                        circle_id = str(v.get("value", "")).strip()
                    elif v is not None:
                        circle_id = str(v).strip()
            status_counts[status] += 1
            row = {"contact_id": cid, "name": it.get("title"), "email": email, "status": status, "circle_user_id": circle_id}
            if circle_id:
                with_id += 1
                if len(with_id_sample) < 5:
                    with_id_sample.append(row)
            else:
                without_id += 1
                if len(missing_sample) < 20:
                    missing_sample.append(row)
        offset += len(items)
        if offset >= total_filtered:
            break

    seen = with_id + without_id
    print(f"Scanned: {seen} / {total_filtered}")
    print(f"  with CIRCLE_USER_ID    : {with_id} ({with_id / max(1, seen) * 100:.1f}%)")
    print(f"  without CIRCLE_USER_ID : {without_id} ({without_id / max(1, seen) * 100:.1f}%)")
    print()
    print("By SUBSCRIPTION_STATUS:")
    for k, v in sorted(status_counts.items(), key=lambda kv: -kv[1]):
        print(f"  {k!r:30s} {v}")
    print()

    if with_id_sample:
        print("=== Sample WITH circle_user_id (up to 5) ===")
        for r in with_id_sample:
            cid = r["circle_user_id"]
            cid_show = cid[:6] + "..." if len(cid) > 10 else cid
            print(f"  [{r['contact_id']}] {r['name']!r} status={r['status']!r} circle_id={cid_show!r}")
        print()

    if missing_sample:
        print(f"=== Sample WITHOUT circle_user_id (up to 20 of {without_id}) ===")
        for r in missing_sample:
            print(f"  [{r['contact_id']}] {r['name']!r} email={r['email']!r} status={r['status']!r}")
        print()

    out = Path(__file__).resolve().parent.parent / "snapshots" / "circle-user-id-audit.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(
        json.dumps(
            {
                "total_filtered": total_filtered,
                "scanned": seen,
                "with_circle_user_id": with_id,
                "without_circle_user_id": without_id,
                "by_status": dict(status_counts),
                "missing_sample": missing_sample,
                "with_id_sample": with_id_sample,
            },
            indent=2,
        ),
        encoding="utf-8",
    )
    print(f"Snapshot: {out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
