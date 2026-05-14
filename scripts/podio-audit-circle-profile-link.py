#!/usr/bin/env python3
"""
CCO-T029 prep, take 2: audit `Circle Profile Link` (field 273667474, embed)
coverage. Its URL embeds the Circle publicUid (last URL segment).

This decides whether the portal can parse publicUid out of an existing
Podio field with no Mary work — versus needing a new field.
"""
import json
import os
import re
import sys
from collections import Counter
from pathlib import Path

SKILL_SCRIPTS = Path(r"C:\Users\jakub\.codex\skills\podio-build-kit\scripts")
sys.path.insert(0, str(SKILL_SCRIPTS))
os.environ.setdefault("PODIO_PROFILE", "jakub-fs")
from _spec_lib import load_token, api_post  # noqa: E402

CONTACTS_APP = 14660191
SUBSCRIPTION_STATUS_FIELD = 134218375
CIRCLE_PROFILE_LINK_FIELD = 273667474
CIRCLE_USER_ID_FIELD = 272609487
EMAIL_FIELD = 112436968
ACTIVE_OPTION_IDS = [2, 7, 8, 9]
PUBLIC_UID_RE = re.compile(r"/u/([a-f0-9]{6,16})", re.I)


def extract_public_uid(values: list[dict]) -> str:
    if not values:
        return ""
    embed = values[0].get("embed", {}) or {}
    url = embed.get("url") or embed.get("resolved_url") or embed.get("original_url") or ""
    m = PUBLIC_UID_RE.search(url)
    return m.group(1) if m else ""


def main() -> int:
    access = load_token()
    print("Auditing Circle Profile Link coverage + publicUid extractability ...")
    print()

    page_size = 50
    offset = 0
    total = None
    with_url = 0
    with_uid = 0
    without_url = 0
    no_uid_in_url = 0
    matrix: Counter[tuple[bool, bool]] = Counter()  # (has_circle_user_id, has_public_uid)
    sample_missing: list[dict] = []

    while True:
        resp = api_post(
            f"/item/app/{CONTACTS_APP}/filter/",
            access,
            {"filters": {SUBSCRIPTION_STATUS_FIELD: ACTIVE_OPTION_IDS}, "limit": page_size, "offset": offset},
        )
        if total is None:
            total = resp.get("filtered", 0)
            print(f"Total active subscribers: {total}")
            print()
        items = resp.get("items", [])
        if not items:
            break
        for it in items:
            has_cuid = False
            has_uid = False
            email = ""
            link_url = ""
            for f in it.get("fields", []):
                fid = f.get("field_id")
                vals = f.get("values", [])
                if not vals:
                    continue
                if fid == CIRCLE_PROFILE_LINK_FIELD:
                    embed = vals[0].get("embed", {}) or {}
                    link_url = embed.get("url") or embed.get("resolved_url") or embed.get("original_url") or ""
                    if link_url:
                        with_url += 1
                        uid = extract_public_uid(vals)
                        if uid:
                            has_uid = True
                            with_uid += 1
                        else:
                            no_uid_in_url += 1
                    else:
                        without_url += 1
                elif fid == CIRCLE_USER_ID_FIELD:
                    v = vals[0].get("value")
                    val = v if isinstance(v, str) else str(v) if v else ""
                    has_cuid = bool(val.strip())
                elif fid == EMAIL_FIELD:
                    v = vals[0].get("value")
                    email = v if isinstance(v, str) else (v.get("value", "") if isinstance(v, dict) else "")
            matrix[(has_cuid, has_uid)] += 1
            if not has_uid and len(sample_missing) < 15:
                sample_missing.append({
                    "contact_id": it.get("item_id"), "name": it.get("title"),
                    "email": email, "has_circle_user_id": has_cuid,
                    "link_url": link_url[:80] if link_url else None,
                })
        offset += len(items)
        if offset >= total:
            break

    scanned = sum(matrix.values())
    print(f"Scanned: {scanned} / {total}")
    print(f"  with Circle Profile Link URL : {with_url}")
    print(f"    of those, publicUid parses : {with_uid}")
    print(f"    of those, URL has no /u/X  : {no_uid_in_url}")
    print(f"  without Circle Profile Link  : {without_url}")
    print()
    print("Coverage matrix (CIRCLE_USER_ID present x publicUid extractable):")
    print(f"  has both                     : {matrix[(True, True)]}")
    print(f"  has circle_user_id only      : {matrix[(True, False)]}")
    print(f"  has publicUid only           : {matrix[(False, True)]}")
    print(f"  has neither                  : {matrix[(False, False)]}")
    print()
    if sample_missing:
        print("Sample subscribers WITHOUT extractable publicUid (up to 15):")
        for r in sample_missing:
            print(f"  [{r['contact_id']}] {r['name']!r} email={r['email']!r} circle_user_id?={r['has_circle_user_id']} url={r['link_url']!r}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
