/* =============================================
   ARUP MAHATO — PORTFOLIO JS
   Vanilla JS, no dependencies
   ============================================= */

(() => {
  'use strict';

  // ========== THEME ==========
  // Runs immediately (before DOMContentLoaded) to avoid a flash of the wrong theme.
  const root = document.documentElement;
  const stored = localStorage.getItem('theme');
  const prefersLight = window.matchMedia('(prefers-color-scheme: light)').matches;
  root.setAttribute('data-theme', stored || (prefersLight ? 'light' : 'dark'));

  const syncThemeColor = () => {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      meta.setAttribute('content',
        root.getAttribute('data-theme') === 'light' ? '#faf9f7' : '#0a0a0c');
    }
  };

  document.addEventListener('DOMContentLoaded', () => {

    syncThemeColor();

    const themeToggle = document.getElementById('theme-toggle');
    themeToggle.addEventListener('click', () => {
      const next = root.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
      root.setAttribute('data-theme', next);
      localStorage.setItem('theme', next);
      syncThemeColor();
    });

    // ========== NAVBAR: scroll state, scroll-spy, progress ==========
    const navbar = document.getElementById('navbar');
    const progress = document.getElementById('scroll-progress');
    const navLinks = Array.from(document.querySelectorAll('.nav-link'));
    const sections = Array.from(document.querySelectorAll('section[id]'));

    let ticking = false;

    const onScroll = () => {
      const y = window.scrollY;

      navbar.classList.toggle('scrolled', y > 20);

      // Scroll progress bar
      const max = document.documentElement.scrollHeight - window.innerHeight;
      progress.style.width = max > 0 ? `${(y / max) * 100}%` : '0%';

      // Scroll-spy: last section whose top has passed the viewport threshold
      let current = '';
      sections.forEach(section => {
        if (y >= section.offsetTop - 140) current = section.id;
      });

      navLinks.forEach(link => {
        link.classList.toggle('active', link.getAttribute('href') === `#${current}`);
      });

      ticking = false;
    };

    const requestScroll = () => {
      if (!ticking) {
        ticking = true;
        window.requestAnimationFrame(onScroll);
      }
    };

    window.addEventListener('scroll', requestScroll, { passive: true });
    window.addEventListener('resize', requestScroll, { passive: true });
    onScroll();

    // ========== MOBILE NAV ==========
    const navToggle = document.getElementById('nav-toggle');
    const navMenu = document.getElementById('nav-menu');

    const setMenu = (open) => {
      navToggle.classList.toggle('active', open);
      navMenu.classList.toggle('active', open);
      navToggle.setAttribute('aria-expanded', String(open));
      document.body.classList.toggle('nav-open', open);
    };

    navToggle.addEventListener('click', () => {
      setMenu(!navMenu.classList.contains('active'));
    });

    navMenu.addEventListener('click', (e) => {
      if (e.target.closest('a')) setMenu(false);
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') setMenu(false);
    });

    // ========== SMOOTH SCROLL (offset for fixed navbar) ==========
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
      anchor.addEventListener('click', (e) => {
        const id = anchor.getAttribute('href');
        if (id === '#') return;
        const target = document.querySelector(id);
        if (!target) return;

        e.preventDefault();
        const top = target.getBoundingClientRect().top + window.scrollY - 72;
        window.scrollTo({ top, behavior: 'smooth' });
      });
    });

    // ========== REVEAL ON SCROLL ==========
    // Any element marked [data-reveal] fades up once, staggered by its
    // position within the parent group.
    const revealItems = document.querySelectorAll('[data-reveal]');

    // Stagger siblings so grids cascade instead of popping in together.
    const seen = new Map();
    revealItems.forEach(el => {
      const parent = el.parentElement;
      const index = seen.get(parent) ?? 0;
      el.style.setProperty('--i', index);
      seen.set(parent, index + 1);
    });

    if (!('IntersectionObserver' in window)) {
      revealItems.forEach(el => el.classList.add('visible'));
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -60px 0px' });

    revealItems.forEach(el => observer.observe(el));
  });
})();
