/* ==========================================================================
   ARUP MAHATO — PORTFOLIO
   Vanilla JS, no dependencies. One deferred IIFE, independent blocks.

   The theme is resolved by an inline script in <head>, before first paint.
   This file drives everything after that: the theme toggle, scroll state and
   scroll-spy, the mobile menu, smooth scroll and the reveal observer.

   Everything here is cheap or bounded. Scroll work runs once per frame behind
   a rAF gate; every animation is transform/opacity only, and all of it is
   skipped under reduced motion. localStorage access is wrapped — it throws in
   some privacy configurations, and an uncaught throw at IIFE top level would
   take the whole file down.
   ========================================================================== */

(() => {
  'use strict';

  const root = document.documentElement;
  const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* non-fatal */ } }
  };

  const THEME_COLOR = { dark: '#0B0E11', light: '#FAFBFC' };

  document.addEventListener('DOMContentLoaded', () => {

    /* ====================================================================
       THEME — the toggle also owns the theme-color meta, collapsing the two
       media-scoped tags in the markup into one it controls.
       ==================================================================== */
    document.querySelectorAll('meta[name="theme-color"]').forEach(m => m.remove());
    const themeMeta = document.createElement('meta');
    themeMeta.name = 'theme-color';
    document.head.appendChild(themeMeta);

    const themeToggle = document.getElementById('theme-toggle');

    const syncTheme = () => {
      const isLight = root.getAttribute('data-theme') === 'light';
      themeMeta.setAttribute('content', isLight ? THEME_COLOR.light : THEME_COLOR.dark);
      if (themeToggle) {
        themeToggle.setAttribute('aria-label', isLight ? 'Switch to dark theme' : 'Switch to light theme');
      }
    };
    syncTheme();

    const toggleTheme = () => {
      const next = root.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
      root.setAttribute('data-theme', next);
      store.set('theme', next);
      syncTheme();
    };

    if (themeToggle) themeToggle.addEventListener('click', toggleTheme);

    document.addEventListener('keydown', (e) => {
      if (e.key !== 't' && e.key !== 'T') return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const el = document.activeElement;
      if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return;
      toggleTheme();
    });

    /* ====================================================================
       SCROLL — nav state and scroll-spy.
       One rAF-gated handler. The section list is derived from the menu
       hrefs, so a mismatch between markup and nav can't drift silently.
       ==================================================================== */
    const nav = document.getElementById('nav');
    const menuLinks = Array.from(document.querySelectorAll('.menu-link'));
    const sections = menuLinks
      .map(link => document.querySelector(link.getAttribute('href')))
      .filter(Boolean);

    let ticking = false, currentId = '';

    const onScroll = () => {
      const y = window.scrollY;

      if (nav) nav.classList.toggle('stuck', y > 12);

      let found = '';
      sections.forEach(section => {
        if (y >= section.offsetTop - 180) found = section.id;
      });

      if (found !== currentId) {
        currentId = found;
        // The active state is never class-only — aria-current carries it, so
        // it reaches assistive technology too.
        menuLinks.forEach(link => {
          if (link.getAttribute('href') === `#${found}`) link.setAttribute('aria-current', 'true');
          else link.removeAttribute('aria-current');
        });
      }

      ticking = false;
    };

    const requestScroll = () => {
      if (!ticking) { ticking = true; requestAnimationFrame(onScroll); }
    };

    window.addEventListener('scroll', requestScroll, { passive: true });
    window.addEventListener('resize', requestScroll, { passive: true });
    onScroll();

    /* ====================================================================
       MOBILE MENU
       ==================================================================== */
    const menuToggle = document.getElementById('menu-toggle');
    const menu = document.getElementById('menu');

    if (menuToggle && menu) {
      const setMenu = (open) => {
        menu.classList.toggle('open', open);
        menuToggle.setAttribute('aria-expanded', String(open));
        menuToggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
        document.body.classList.toggle('menu-open', open);
      };

      menuToggle.addEventListener('click', () => setMenu(!menu.classList.contains('open')));
      menu.addEventListener('click', (e) => { if (e.target.closest('a')) setMenu(false); });

      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && menu.classList.contains('open')) {
          setMenu(false);
          menuToggle.focus();
        }
      });
    }

    /* ====================================================================
       SMOOTH SCROLL — offset for the fixed nav
       ==================================================================== */
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
      anchor.addEventListener('click', (e) => {
        const id = anchor.getAttribute('href');
        if (id === '#') return;
        const target = document.querySelector(id);
        if (!target) return;
        e.preventDefault();
        window.scrollTo({
          top: Math.max(0, target.getBoundingClientRect().top + window.scrollY - 84),
          behavior: calm ? 'auto' : 'smooth'
        });
      });
    });

    /* ====================================================================
       REVEAL — [data-reveal] fades up once, [data-lines] unmasks per line.
       Stagger is derived from position among siblings and capped, so a fast
       scroller never outruns the animation into a blank screen.
       ==================================================================== */
    const MAX_STAGGER = 4;
    const revealItems = document.querySelectorAll('[data-reveal]');
    const seen = new Map();
    revealItems.forEach(el => {
      const parent = el.parentElement;
      const index = seen.get(parent) ?? 0;
      el.style.setProperty('--i', Math.min(index, MAX_STAGGER));
      seen.set(parent, index + 1);
    });

    // No count-up on the metrics. It is a portfolio trope that reads as a
    // demo rather than an engineer's site, and a rAF-driven number can be
    // left frozen part-way (a backgrounded tab, a stalled compositor) — a
    // metric showing the wrong figure is a credibility risk on this page.
    // The numbers are static in the markup and correct without JS.

    const lineBlocks = Array.from(document.querySelectorAll('[data-lines]'));
    lineBlocks.forEach(el => el.querySelectorAll('.ln > span').forEach((s, i) => s.style.setProperty('--i', i)));

    // The hero headline is above the fold — play it immediately rather than
    // waiting on the observer.
    const hero = document.querySelector('.hero-title[data-lines]');
    if (hero) {
      requestAnimationFrame(() => requestAnimationFrame(() => hero.classList.add('in')));
    }

    if (!('IntersectionObserver' in window)) {
      revealItems.forEach(el => el.classList.add('in'));
      lineBlocks.forEach(el => el.classList.add('in'));
      return;
    }

    const revealObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('in');
        revealObserver.unobserve(entry.target);
      });
    }, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });

    revealItems.forEach(el => revealObserver.observe(el));
    lineBlocks.forEach(el => { if (el !== hero) revealObserver.observe(el); });
  });
})();
