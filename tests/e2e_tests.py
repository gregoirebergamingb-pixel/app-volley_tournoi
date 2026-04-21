# -*- coding: utf-8 -*-
import sys, io, os, random, string
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

from playwright.sync_api import sync_playwright

BASE = "http://localhost:3000"
RESULTS = []

def uid():
    return ''.join(random.choices(string.ascii_lowercase, k=6))

def check(name, passed, detail=""):
    status = "[PASS]" if passed else "[FAIL]"
    msg = f"{status} {name}"
    if detail:
        msg += f" -- {detail}"
    print(msg, flush=True)
    RESULTS.append((name, passed, detail))

def run_tests():
    os.makedirs("tests/screenshots", exist_ok=True)
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        ctx = browser.new_context(viewport={"width": 430, "height": 932})
        page = ctx.new_page()

        # ---- 1. Page Login ----
        print("\n-- Auth --", flush=True)
        page.goto(f"{BASE}/login")
        page.wait_for_load_state("networkidle")
        check("Login: page charge", page.title() != "")
        check("Login: champ email visible", page.locator('input[type="email"]').is_visible())
        check("Login: champ mot de passe visible", page.locator('input[type="password"]').is_visible())
        check("Login: bouton Connexion visible", page.locator('button[type="submit"]').is_visible())
        check("Login: lien Creer un compte", page.locator('a[href*="register"]').count() > 0)

        # Mauvais identifiants
        page.fill('input[type="email"]', "inexistant@test.com")
        page.fill('input[type="password"]', "mauvais_mdp")
        page.locator('button[type="submit"]').click()
        page.wait_for_timeout(2000)
        check("Login: erreur mauvais identifiants", page.locator('.message.error').count() > 0)

        # ---- 2. Page Register ----
        print("\n-- Inscription --", flush=True)
        page.goto(f"{BASE}/register")
        page.wait_for_load_state("networkidle")
        check("Register: page charge", page.locator('h2').count() > 0)
        check("Register: champ email", page.locator('input[type="email"]').is_visible())
        check("Register: champ mot de passe", page.locator('input[type="password"]').count() >= 1)
        check("Register: lien Se connecter", page.locator('a[href*="login"]').count() > 0)

        # ---- 3. Creer un compte de test ----
        print("\n-- Creation compte test --", flush=True)
        tag = uid()
        test_email = f"test_{tag}@volley.fr"
        test_password = "MotDePasse123!"

        page.goto(f"{BASE}/register")
        page.wait_for_load_state("networkidle")

        try:
            page.fill('#firstName', "Test")
            page.fill('#lastName', f"User{tag}")
            page.fill('#phone', "0612345678")
            page.fill('#email', test_email)
            page.locator('input[type="radio"][value="masculin"]').check()
            page.select_option('#level', 'loisir')
            page.fill('#password', test_password)
            page.fill('#confirmPassword', test_password)

            page.screenshot(path="tests/screenshots/01_register_filled.png")
            page.locator('button[type="submit"]').click()
            page.wait_for_load_state("networkidle")
            page.wait_for_timeout(2000)

            current_url = page.url
            logged_in = "/dashboard" in current_url or "/groups" in current_url
            check("Register: compte cree et redirige", logged_in, current_url)
        except Exception as e:
            check("Register: creation compte", False, str(e))
            browser.close()
            _print_summary()
            return

        # ---- 4. Dashboard ----
        print("\n-- Dashboard --", flush=True)
        page.goto(f"{BASE}/dashboard")
        page.wait_for_load_state("networkidle")
        page.screenshot(path="tests/screenshots/02_dashboard.png")
        check("Dashboard: header visible", page.locator('.app-header').count() > 0)
        check("Dashboard: bottom nav visible", page.locator('.bottom-nav').count() > 0)
        check("Dashboard: avatar button visible", page.locator('.header-avatar').count() > 0)

        # Avatar dropdown
        page.locator('.header-avatar').click()
        page.wait_for_timeout(400)
        check("Dashboard: avatar menu s'ouvre", page.locator('.avatar-menu').count() > 0)
        page.locator('.header-avatar').click()
        page.wait_for_timeout(200)

        # ---- 5. Navigation ----
        print("\n-- Navigation --", flush=True)
        nav_items = page.locator('.nav-item').all()
        check("Navigation: 4 onglets", len(nav_items) == 4, f"{len(nav_items)} onglets trouves")

        for label, path in [("Groupes", "/groups"), ("Tournois", "/nos-tournois"), ("Rechercher", "/recherche")]:
            page.locator(f'.nav-item:has-text("{label}")').click()
            page.wait_for_load_state("networkidle")
            page.wait_for_timeout(500)
            check(f"Navigation: onglet {label}", path in page.url, page.url)

        page.locator('.nav-item:has-text("Accueil")').click()
        page.wait_for_load_state("networkidle")
        check("Navigation: retour Accueil", "/dashboard" in page.url)

        # ---- 6. Page Groupes ----
        print("\n-- Groupes --", flush=True)
        page.goto(f"{BASE}/groups")
        page.wait_for_load_state("networkidle")
        page.screenshot(path="tests/screenshots/03_groups.png")
        check("Groupes: page charge", page.locator('.app-header').count() > 0)
        check("Groupes: bouton Creer", page.locator('button:has-text("Creer"), button:has-text("+ Cr")').count() > 0)
        check("Groupes: bouton Rejoindre", page.locator('button:has-text("Rejoindre")').count() > 0)

        page.locator('button').filter(has_text="Cr").first.click()
        page.wait_for_timeout(400)
        check("Groupes: panel creation s'ouvre", page.locator('.card.panel-form').count() > 0)

        try:
            group_name = f"Groupe {tag}"
            page.locator('.card.panel-form input[type="text"]').first.fill(group_name)
            page.locator('.card.panel-form button[type="submit"]').click()
            page.wait_for_timeout(2000)
            has_group = (page.locator('.message.success').count() > 0 or
                         page.locator(f'text={group_name}').count() > 0 or
                         page.locator('.group-card').count() > 0)
            check("Groupes: groupe cree", has_group)
        except Exception as e:
            check("Groupes: creation groupe", False, str(e))

        # ---- 7. Nos Tournois ----
        print("\n-- Nos Tournois --", flush=True)
        page.goto(f"{BASE}/nos-tournois")
        page.wait_for_load_state("networkidle")
        page.screenshot(path="tests/screenshots/04_nos_tournois.png")
        check("NosTournois: page charge", page.locator('.app-header').count() > 0)
        check("NosTournois: chips filtres", page.locator('.chips-row .chip').count() >= 3)

        page.locator('.chip:has-text("venir")').click()
        page.wait_for_timeout(300)
        check("NosTournois: chip A venir active", page.locator('.chip.active').count() > 0)

        # ---- 8. Recherche ----
        print("\n-- Recherche --", flush=True)
        page.goto(f"{BASE}/recherche")
        page.wait_for_load_state("networkidle")
        page.screenshot(path="tests/screenshots/05_recherche.png")
        check("Recherche: page charge", page.locator('.search-header').count() > 0)
        check("Recherche: barre de recherche", page.locator('.search-input-wrapper input').count() > 0)
        check("Recherche: chips format 2x2", page.locator('.chip:has-text("2x2")').count() > 0)
        check("Recherche: chips Mixte", page.locator('.chip:has-text("Mixte")').count() > 0)

        page.locator('.search-input-wrapper input').fill("volley")
        page.wait_for_timeout(1500)
        has_response = (page.locator('.t-card').count() > 0 or
                        page.locator('.empty-state').count() > 0 or
                        page.locator('text=sultat').count() > 0 or
                        page.locator('text=prochainement').count() > 0 or
                        page.locator('text=aucun').count() > 0)
        check("Recherche: affiche resultats ou etat vide", has_response)

        clear_btn = page.locator('.search-clear')
        if clear_btn.count() > 0:
            clear_btn.click()
            page.wait_for_timeout(300)
            check("Recherche: clear efface le champ", page.locator('.search-input-wrapper input').input_value() == "")

        # ---- 9. Layout responsive ----
        print("\n-- Layout responsive --", flush=True)
        page.goto(f"{BASE}/dashboard")
        page.wait_for_load_state("networkidle")
        app_box = page.locator('.App').bounding_box()
        check("Layout: .App present", app_box is not None)
        if app_box:
            check("Layout: largeur <= 430px", app_box["width"] <= 430, f"{app_box['width']:.0f}px")
            check("Layout: hauteur = viewport", abs(app_box["height"] - 932) < 5, f"{app_box['height']:.0f}px")

        # Test sur Groups et TournamentDetail (les pages problematiques)
        page.goto(f"{BASE}/groups")
        page.wait_for_load_state("networkidle")
        grp_box = page.locator('.App').bounding_box()
        if grp_box:
            check("Layout Groups: largeur <= 430px", grp_box["width"] <= 430, f"{grp_box['width']:.0f}px")

        # ---- 10. Deconnexion ----
        print("\n-- Deconnexion --", flush=True)
        page.goto(f"{BASE}/dashboard")
        page.wait_for_load_state("networkidle")
        page.locator('.header-avatar').click()
        page.wait_for_timeout(400)
        logout_btn = page.locator('.avatar-menu-item.danger')
        if logout_btn.count() == 0:
            logout_btn = page.locator('.avatar-menu-item:has-text("connexion")')
        logout_btn.click()
        page.wait_for_timeout(1000)
        check("Deconnexion: redirige vers login", "/login" in page.url, page.url)

        page.screenshot(path="tests/screenshots/06_after_logout.png")
        browser.close()

    _print_summary()


def _print_summary():
    total = len(RESULTS)
    passed = sum(1 for _, ok, _ in RESULTS if ok)
    failed = total - passed
    print(f"\n{'='*50}", flush=True)
    print(f"RESULTATS : {passed}/{total} tests passes", flush=True)
    if failed:
        print(f"\nEchecs ({failed}) :", flush=True)
        for name, ok, detail in RESULTS:
            if not ok:
                print(f"  [FAIL] {name}" + (f" -- {detail}" if detail else ""), flush=True)
    print('='*50, flush=True)


if __name__ == "__main__":
    run_tests()
