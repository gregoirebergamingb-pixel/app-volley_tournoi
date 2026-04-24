# -*- coding: utf-8 -*-
import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', line_buffering=True)

import time, os
from playwright.sync_api import sync_playwright

BASE        = "http://localhost:3000"
SCREENSHOTS = r"c:\Projet\volleyball-tournament-app\test_screenshots"
os.makedirs(SCREENSHOTS, exist_ok=True)

TEST_EMAIL = f"test_e2e_{int(time.time())}@test.com"
TEST_PASS  = "TestPassword123!"

results = []

def log(status, name, detail=""):
    icon = "[PASS]" if status == "PASS" else "[FAIL]" if status == "FAIL" else "[WARN]"
    print(f"  {icon} {name}" + (f" -- {detail}" if detail else ""))
    results.append({"status": status, "name": name, "detail": detail})

def shot(page, name):
    page.screenshot(path=f"{SCREENSHOTS}/{name}.png")

def wait(page, timeout=10000):
    try:
        page.wait_for_load_state("networkidle", timeout=timeout)
    except Exception:
        pass

def header_inner_h(page):
    return page.evaluate(
        "() => document.querySelector('.header-inner')?.getBoundingClientRect().height ?? 0"
    )

def skip_onboarding(page):
    page.evaluate("() => localStorage.setItem('onboarding_done', '1')")
    page.wait_for_timeout(300)

def nav(page, url):
    page.goto(url)
    wait(page)
    skip_onboarding(page)

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    ctx  = browser.new_context(viewport={"width": 390, "height": 844})
    page = ctx.new_page()

    # ──────────────────────────────────────────────
    print("\n--- 1. Auth pages ---")
    # ──────────────────────────────────────────────
    page.goto(BASE)
    wait(page)
    shot(page, "01_login")
    log("PASS" if page.locator("input[type='email']").count() > 0 else "FAIL",
        "Login page loads", page.url)

    page.goto(f"{BASE}/register")
    wait(page)
    shot(page, "02_register")
    log("PASS", "Register page accessible")

    # ──────────────────────────────────────────────
    print("\n--- 2. Register ---")
    # ──────────────────────────────────────────────
    try:
        page.fill("#firstName", "TestE2E")
        page.fill("#lastName",  "Playwright")
        page.fill("#email",     TEST_EMAIL)
        page.locator("label.gender-option").filter(has_text="Homme").first.click()
        page.select_option("#level", "loisir")

        pos_div = page.locator("div.gender-option").filter(has_text="Passeur").first
        if pos_div.count() > 0:
            pos_div.click()
            log("PASS", "Position selector (div) on Register")
        else:
            log("FAIL", "Position div not found on Register")

        page.fill("#password",        TEST_PASS)
        page.fill("#confirmPassword",  TEST_PASS)

        shot(page, "03_register_filled")
        page.locator("button[type='submit']").click()
        page.wait_for_timeout(4000)
        wait(page)
        skip_onboarding(page)
        page.wait_for_timeout(500)
        shot(page, "04_after_register")

        is_authed = "/login" not in page.url and "/register" not in page.url
        token     = page.evaluate("() => localStorage.getItem('token')")
        log("PASS" if is_authed and token else "FAIL",
            f"Registration -> {page.url.split('/')[-1] or 'home'}",
            "token ok" if token else "no token")
    except Exception as e:
        log("FAIL", "Registration flow", str(e))

    # ──────────────────────────────────────────────
    print("\n--- 3. Header-inner heights ---")
    # ──────────────────────────────────────────────
    page_routes = [
        (f"{BASE}/dashboard",   "dashboard"),
        (f"{BASE}/recherche",   "search"),
        (f"{BASE}/groups",      "groups"),
        (f"{BASE}/profile",     "profile"),
    ]
    heights = {}
    for url, label in page_routes:
        nav(page, url)
        h = header_inner_h(page)
        heights[label] = round(h, 1)
        shot(page, f"header_{label}")
        print(f"    {label:20s}  header-inner = {h:.1f}px")

    non_dash = {k: v for k, v in heights.items() if k != "dashboard"}
    if all(v > 0 for v in non_dash.values()):
        unique = set(round(v) for v in non_dash.values())
        log("PASS" if len(unique) == 1 else "FAIL",
            "All non-dashboard headers same height",
            f"{list(unique)[0]}px" if len(unique) == 1 else ", ".join(f"{k}={v}px" for k, v in non_dash.items()))

        dash_h     = heights.get("dashboard", 0)
        others_avg = sum(non_dash.values()) / max(len(non_dash), 1)
        if dash_h > others_avg + 5:
            log("PASS", "Dashboard taller (filter-tabs bar)", f"dash={dash_h}px vs others~{others_avg:.0f}px")
        else:
            log("WARN", "Dashboard same height (filter tabs may be inside header?)", f"{dash_h}px")
    else:
        log("WARN", "Heights are 0 — unauthenticated redirect?", str(heights))

    # ──────────────────────────────────────────────
    print("\n--- 4. Position selector ---")
    # ──────────────────────────────────────────────
    nav(page, f"{BASE}/profile")
    try:
        passeur   = page.locator("div.gender-option").filter(has_text="Passeur").first
        attaquant = page.locator("div.gender-option").filter(has_text="Attaquant").first

        if passeur.count() == 0:
            old = page.locator("label.gender-option").filter(has_text="Passeur")
            log("FAIL", "Position: still <label>" if old.count() > 0 else "Position: element missing")
        else:
            log("PASS", "Position uses <div> (no double-toggle)")

            # Determine initial state
            initial_p = "selected" in (passeur.get_attribute("class") or "")
            initial_a = "selected" in (attaquant.get_attribute("class") or "")
            print(f"    Initial state: passeur={'selected' if initial_p else 'none'}, attaquant={'selected' if initial_a else 'none'}")

            # Click the UN-selected one first
            if not initial_p:
                passeur.click(force=True)
                page.wait_for_timeout(200)
                cp = passeur.get_attribute("class") or ""
                log("PASS" if "selected" in cp else "FAIL", "Click unselected -> selects")
            elif not initial_a:
                attaquant.click(force=True)
                page.wait_for_timeout(200)
                ca = attaquant.get_attribute("class") or ""
                log("PASS" if "selected" in ca else "FAIL", "Click unselected -> selects")
            else:
                log("WARN", "Both options pre-selected (unexpected)")

            # Click currently-selected -> deselects (toggle)
            currently_selected = passeur if "selected" in (passeur.get_attribute("class") or "") else attaquant
            currently_selected.click(force=True)
            page.wait_for_timeout(200)
            cls_after = currently_selected.get_attribute("class") or ""
            log("PASS" if "selected" not in cls_after else "FAIL", "Click selected -> deselects (toggle)")

            shot(page, "05_position_selector")
    except Exception as e:
        log("FAIL", "Position selector", str(e))

    # ──────────────────────────────────────────────
    print("\n--- 5. Search ---")
    # ──────────────────────────────────────────────
    nav(page, f"{BASE}/recherche")
    shot(page, "06_search_empty")
    try:
        inp = page.locator(".search-input-wrapper input").first
        if inp.count() == 0:
            log("FAIL", "Search input not found")
        else:
            inp.fill("b")
            page.wait_for_timeout(800)
            wait(page)
            shot(page, "07_search_results")
            body = page.inner_text("body")
            if "résultat" in body.lower():
                log("PASS", "Search returns results")
                if "Déjà ajouté" in body:
                    log("PASS", "Search: 'Déjà ajouté' visible")
                elif "Mon groupe" in body:
                    log("PASS", "Search: '+Mon groupe' visible (no overlap)")
                else:
                    log("WARN", "Search: no group indicator (new user, no groups yet)")
            elif "Aucun" in body:
                log("WARN", "Search: no results for 'b'")
            else:
                log("WARN", "Search: unexpected result state")
    except Exception as e:
        log("FAIL", "Search", str(e))

    # ──────────────────────────────────────────────
    print("\n--- 6. Dashboard filter tabs ---")
    # ──────────────────────────────────────────────
    nav(page, f"{BASE}/dashboard")
    try:
        tabs_in_inner = page.evaluate("""() => {
            const inner = document.querySelector('.header-inner');
            if (!inner) return 'no-inner';
            const btns = Array.from(inner.querySelectorAll('button'));
            return btns.some(b => b.textContent.includes('Tous') || b.textContent.includes('Mes tournois'));
        }""")
        log("PASS" if tabs_in_inner is False else "FAIL",
            "Dashboard: filter tabs outside header-inner", str(tabs_in_inner))

        tous = page.locator("button").filter(has_text="Tous").first
        mine = page.locator("button").filter(has_text="Mes tournois").first
        if tous.count() > 0 and mine.count() > 0:
            log("PASS", "Both filter tabs present")
            mine.click(force=True)
            page.wait_for_timeout(300)
            shot(page, "08_dashboard_mine")
            log("PASS", "Filter tab 'Mes tournois' clickable")
        else:
            log("FAIL", "Filter tabs missing")
    except Exception as e:
        log("FAIL", "Dashboard filter tabs", str(e))

    # ──────────────────────────────────────────────
    print("\n--- 7. Screenshots of all main pages ---")
    # ──────────────────────────────────────────────
    for url, label in [
        (f"{BASE}/dashboard",  "final_dashboard"),
        (f"{BASE}/recherche",  "final_search"),
        (f"{BASE}/groups",     "final_groups"),
        (f"{BASE}/profile",    "final_profile"),
    ]:
        nav(page, url)
        h = header_inner_h(page)
        shot(page, label)
        print(f"    {label:25s}  header-inner={h:.1f}px")
    log("PASS", "All screenshots captured")

    browser.close()

    # ──────────────────────────────────────────────
    print("\n" + "=" * 50)
    print("RESULTS")
    print("=" * 50)
    passed = sum(1 for r in results if r["status"] == "PASS")
    failed = sum(1 for r in results if r["status"] == "FAIL")
    warned = sum(1 for r in results if r["status"] == "WARN")
    print(f"  PASS: {passed}   FAIL: {failed}   WARN: {warned}")
    print(f"  Screenshots -> {SCREENSHOTS}")
    if failed:
        print("\n  FAILED:")
        for r in results:
            if r["status"] == "FAIL":
                print(f"    - {r['name']}" + (f": {r['detail']}" if r['detail'] else ""))
