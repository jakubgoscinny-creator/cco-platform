#!/usr/bin/env python3
"""
CCO-T006 subscriber smoke. Drives the Circle SSO signer flow as an active
subscriber Contact, then GETs /catalog and asserts the locked-badge UI is
NOT present (because they're a Member).

Read-only: only HEAD/GET; no exam start, no state mutation.

Subscriber chosen: Jakub's own FS Contact (contact 2911468032,
jakub.goscinny@futuresolutionsonline.co.uk, SUBSCRIPTION_STATUS
'Monthly (Grandfathered)'). This is Jakub's second Podio Contact —
his subscriber-tier identity — separate from his admin Contact. Using
it keeps the smoke fully Jakub-owned, no real customer touched.

Note: switching subscriber after Jodi's (Jodi.vongunten@gmail.com) case
mismatch hit a case-sensitivity bug in the Podio email filter — see
followup task.
"""
import http.cookiejar
import re
import sys
import urllib.request
import urllib.parse
from urllib.error import HTTPError

SIGNER = "https://cco-sso-signer.vercel.app/api/launch"
PORTAL = "https://cco-platform.vercel.app"

EMAIL = "jakub.goscinny@futuresolutionsonline.co.uk"
NAME = "Jakub Goscinny"


def build_opener() -> urllib.request.OpenerDirector:
    jar = http.cookiejar.CookieJar()
    opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))
    opener.addheaders = [
        ("User-Agent", "CCO-T006-smoke/1.0 (jakub-driven)"),
        ("Accept", "text/html,application/xhtml+xml"),
    ]
    return opener, jar


def main() -> int:
    opener, jar = build_opener()

    # 1. Hit the signer (it 302s to portal /api/sso/circle?token=...)
    url = f"{SIGNER}?{urllib.parse.urlencode({'email': EMAIL, 'name': NAME})}"
    print(f"[1] GET signer (will follow redirect chain) ...")
    print(f"    {url.replace(EMAIL, '<email>')}")
    try:
        resp = opener.open(url, timeout=30)
    except HTTPError as e:
        print(f"    HTTPError: {e.code} {e.reason}")
        return 1
    final_url = resp.geturl()
    print(f"    final URL after redirects: {final_url}")
    print(f"    status: {resp.status}")

    cookie_names = [c.name for c in jar]
    print(f"    cookies set: {cookie_names}")
    session = next((c for c in jar if c.name == "cco_session"), None)
    if session:
        print(f"    cco_session present: domain={session.domain} path={session.path}")
    else:
        print("    !! no cco_session cookie — sign-in likely failed")
        body = resp.read().decode("utf-8", errors="replace")
        print(body[:800])
        return 1

    # 2. GET /catalog with the session cookie
    print()
    print("[2] GET /catalog ...")
    cat_resp = opener.open(f"{PORTAL}/catalog", timeout=30)
    print(f"    status: {cat_resp.status}")
    html = cat_resp.read().decode("utf-8", errors="replace")
    print(f"    body bytes: {len(html)}")

    # 3. Parse for the locked / Upgrade indicators
    print()
    print("[3] Searching catalog HTML for gating signals ...")

    members_only_pill = len(re.findall(r"Members only", html))
    upgrade_cta = len(re.findall(r"Members only\s*[-–—]\s*Upgrade", html))
    start_exam_cta = len(re.findall(r"Start Exam", html))
    upgrade_links = len(re.findall(r'href="/upgrade', html))
    catalog_test_count = len(re.findall(r'href="/exam/start\?test_id=', html))

    print(f"    'Members only' substring occurrences: {members_only_pill}")
    print(f"    'Members only - Upgrade' CTA occurrences: {upgrade_cta}")
    print(f"    'Start Exam' CTA occurrences: {start_exam_cta}")
    print(f"    href=\"/upgrade...\" links: {upgrade_links}")
    print(f"    href=\"/exam/start?test_id=...\" links: {catalog_test_count}")

    # 4. Decide
    print()
    print("[4] Verdict")
    if members_only_pill == 0 and upgrade_cta == 0 and upgrade_links == 0 and start_exam_cta > 0:
        print("    PASS — subscriber sees no locked badges; tests are unlocked.")
        print(f"    {start_exam_cta} Start Exam CTAs across {catalog_test_count} tests.")
        return 0
    elif members_only_pill > 0 or upgrade_cta > 0 or upgrade_links > 0:
        print("    FAIL — subscriber still sees locked badges. Investigate.")
        # Print a small snippet around the first 'Members only' for debugging
        idx = html.find("Members only")
        if idx >= 0:
            print()
            print("    HTML excerpt around first 'Members only':")
            print("    " + html[max(0, idx - 100):idx + 200].replace("\n", " "))
        return 2
    else:
        print("    UNCLEAR — no locked badges but also no Start Exam CTAs. Maybe empty catalog?")
        return 3


if __name__ == "__main__":
    sys.exit(main())
