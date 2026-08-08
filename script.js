/* ==========================================================================
   ARUP MAHATO — PORTFOLIO
   Vanilla JS, no dependencies. One IIFE, independent blocks.

   Theme and intro state are resolved by an inline script in <head> (before
   first paint). This file drives everything after that.

   Pointer work (cursor, magnetic, spotlight, tilt) is attached per-element on
   enter/leave rather than globally, so we never measure layout for elements
   the pointer isn't over.
   ========================================================================== */

(() => {
  'use strict';

  const root = document.documentElement;
  const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  const store = {
    get(k, s) { try { return (s ? sessionStorage : localStorage).getItem(k); } catch (e) { return null; } },
    set(k, v, s) { try { (s ? sessionStorage : localStorage).setItem(k, v); } catch (e) { /* non-fatal */ } }
  };

  const THEME_COLOR = { dark: '#08090B', light: '#F7F5F1' };
  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

  document.addEventListener('DOMContentLoaded', () => {

    /* ====================================================================
       INTRO CURTAIN — one time per session
       ==================================================================== */
    const display = document.querySelector('.display[data-lines]');

    const startDisplay = () => {
      if (!display) return;
      display.querySelectorAll('.ln > span').forEach((s, i) => s.style.setProperty('--i', i));
      requestAnimationFrame(() => requestAnimationFrame(() => display.classList.add('in')));
    };

    if (root.classList.contains('intro')) {
      const curtain = document.getElementById('curtain');
      const countEl = document.getElementById('curtain-count');
      const barEl = document.getElementById('curtain-bar');
      const DUR = 1100;
      const t0 = performance.now();

      const run = (now) => {
        const t = Math.min(1, (now - t0) / DUR);
        const eased = 1 - Math.pow(1 - t, 3);
        countEl.textContent = String(Math.round(eased * 100));
        barEl.style.transform = `scaleX(${eased})`;
        if (t < 1) { requestAnimationFrame(run); return; }

        setTimeout(() => {
          curtain.classList.add('up');
          const done = () => {
            root.classList.remove('intro');
            startDisplay();
          };
          curtain.addEventListener('transitionend', done, { once: true });
          setTimeout(done, 1100); // belt and braces if transitionend never fires
        }, 160);
      };

      store.set('intro', '1', true);
      requestAnimationFrame(run);
    } else {
      startDisplay();
    }

    /* ====================================================================
       THEME
       ==================================================================== */
    document.querySelectorAll('meta[name="theme-color"]').forEach(m => m.remove());
    const themeMeta = document.createElement('meta');
    themeMeta.name = 'theme-color';
    document.head.appendChild(themeMeta);

    const themeToggle = document.getElementById('theme-toggle');

    const syncTheme = () => {
      const isLight = root.getAttribute('data-theme') === 'light';
      themeMeta.setAttribute('content', isLight ? THEME_COLOR.light : THEME_COLOR.dark);
      themeToggle.setAttribute('aria-label', isLight ? 'Switch to dark theme' : 'Switch to light theme');
    };
    syncTheme();

    const toggleTheme = () => {
      const next = root.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
      root.setAttribute('data-theme', next);
      store.set('theme', next);
      syncTheme();
      document.dispatchEvent(new CustomEvent('themechange'));
    };

    themeToggle.addEventListener('click', toggleTheme);

    // Keyboard shortcut, advertised in the footer
    document.addEventListener('keydown', (e) => {
      if (e.key !== 't' && e.key !== 'T') return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const el = document.activeElement;
      if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return;
      toggleTheme();
    });

    /* ====================================================================
       CLOCK
       ==================================================================== */
    const clock = document.getElementById('clock');
    if (clock) {
      const fmt = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false
      });
      const tick = () => { clock.textContent = fmt.format(new Date()); };
      tick();
      setInterval(tick, 30000);
    }

    /* ====================================================================
       PALETTE — tokens read once, refreshed on theme change
       ==================================================================== */
    const palette = {};
    const readPalette = () => {
      const cs = getComputedStyle(root);
      palette.accent = cs.getPropertyValue('--accent').trim();
      palette.line = cs.getPropertyValue('--line').trim();
      palette.line2 = cs.getPropertyValue('--line-2').trim();
      palette.node = cs.getPropertyValue('--mesh-node').trim();
      palette.link = cs.getPropertyValue('--mesh-link').trim();
    };
    readPalette();
    document.addEventListener('themechange', readPalette);

    /* ====================================================================
       SERVICE MESH — the hero's interactive field.
       Nodes drift, link when close, lean toward the pointer, and packets
       travel the links. Paused whenever the hero is off screen.
       ==================================================================== */
    const meshCanvas = document.getElementById('mesh');

    if (meshCanvas && meshCanvas.getContext) {
      const ctx = meshCanvas.getContext('2d');
      const LINK = 168;
      const REACH = 200;
      let w = 0, h = 0, dpr = 1;
      let nodes = [];
      let packets = [];
      let ptr = { x: -9999, y: -9999, on: false };
      let running = false, last = 0, spawn = 0;

      const build = () => {
        const rect = meshCanvas.getBoundingClientRect();
        w = rect.width; h = rect.height;
        if (!w || !h) return;
        dpr = Math.min(window.devicePixelRatio || 1, 2);
        meshCanvas.width = Math.round(w * dpr);
        meshCanvas.height = Math.round(h * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        // Density by area, not width — the hero is far taller than it is wide
        // on some viewports, and a width-based count leaves nodes too far
        // apart to ever link up.
        const count = clamp(Math.round((w * h) / 17000), 14, 88);
        nodes = [];
        // Seeded so the field's character is stable across loads
        let seed = 8675309;
        const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
        for (let i = 0; i < count; i++) {
          nodes.push({
            x: rnd() * w, y: rnd() * h,
            vx: (rnd() - 0.5) * 0.16, vy: (rnd() - 0.5) * 0.16,
            r: 1.5 + rnd() * 1.9,
            ox: 0, oy: 0
          });
        }
        packets = [];
      };

      const draw = () => {
        ctx.clearRect(0, 0, w, h);

        // Links
        for (let i = 0; i < nodes.length; i++) {
          const a = nodes[i];
          const ax = a.x + a.ox, ay = a.y + a.oy;
          for (let j = i + 1; j < nodes.length; j++) {
            const b = nodes[j];
            const bx = b.x + b.ox, by = b.y + b.oy;
            const dx = ax - bx, dy = ay - by;
            const d = Math.hypot(dx, dy);
            if (d > LINK) continue;
            ctx.globalAlpha = (1 - d / LINK) * 0.85;
            ctx.strokeStyle = palette.link;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(ax, ay);
            ctx.lineTo(bx, by);
            ctx.stroke();
          }
        }
        ctx.globalAlpha = 1;

        // Links to the pointer
        if (ptr.on) {
          nodes.forEach(n => {
            const nx = n.x + n.ox, ny = n.y + n.oy;
            const d = Math.hypot(nx - ptr.x, ny - ptr.y);
            if (d > REACH) return;
            ctx.globalAlpha = (1 - d / REACH) * 0.75;
            ctx.strokeStyle = palette.accent;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(nx, ny);
            ctx.lineTo(ptr.x, ptr.y);
            ctx.stroke();
          });
          ctx.globalAlpha = 1;
        }

        // Nodes
        nodes.forEach(n => {
          const nx = n.x + n.ox, ny = n.y + n.oy;
          const near = ptr.on && Math.hypot(nx - ptr.x, ny - ptr.y) < REACH;
          ctx.beginPath();
          ctx.arc(nx, ny, near ? n.r * 1.9 : n.r, 0, Math.PI * 2);
          ctx.fillStyle = near ? palette.accent : palette.node;
          ctx.fill();
        });

        // Packets in flight
        packets.forEach(p => {
          const a = nodes[p.a], b = nodes[p.b];
          if (!a || !b) return;
          const x = lerp(a.x + a.ox, b.x + b.ox, p.t);
          const y = lerp(a.y + a.oy, b.y + b.oy, p.t);
          ctx.globalAlpha = Math.sin(p.t * Math.PI);
          ctx.beginPath();
          ctx.arc(x, y, 2.4, 0, Math.PI * 2);
          ctx.fillStyle = palette.accent;
          ctx.fill();
          ctx.globalAlpha = 1;
        });
      };

      const step = (now) => {
        if (!running) return;
        const dt = Math.min(48, now - last || 16);
        last = now;

        nodes.forEach(n => {
          n.x += n.vx * dt * 0.06;
          n.y += n.vy * dt * 0.06;
          if (n.x < 0 || n.x > w) n.vx *= -1;
          if (n.y < 0 || n.y > h) n.vy *= -1;
          n.x = clamp(n.x, 0, w);
          n.y = clamp(n.y, 0, h);

          // Lean toward the pointer, then ease back
          let tx = 0, ty = 0;
          if (ptr.on) {
            const dx = ptr.x - n.x, dy = ptr.y - n.y;
            const d = Math.hypot(dx, dy);
            if (d < REACH && d > 0.01) {
              const pull = (1 - d / REACH) * 18;
              tx = (dx / d) * pull;
              ty = (dy / d) * pull;
            }
          }
          n.ox = lerp(n.ox, tx, 0.08);
          n.oy = lerp(n.oy, ty, 0.08);
        });

        // Spawn a packet along an existing short link now and then
        spawn -= dt;
        if (spawn <= 0 && packets.length < 7 && nodes.length > 2) {
          spawn = 420 + Math.random() * 700;
          const a = Math.floor(Math.random() * nodes.length);
          const candidates = [];
          for (let j = 0; j < nodes.length; j++) {
            if (j === a) continue;
            if (Math.hypot(nodes[a].x - nodes[j].x, nodes[a].y - nodes[j].y) < LINK) candidates.push(j);
          }
          if (candidates.length) {
            packets.push({ a, b: candidates[Math.floor(Math.random() * candidates.length)], t: 0, sp: 0.0009 + Math.random() * 0.0011 });
          }
        }
        packets.forEach(p => { p.t += p.sp * dt; });
        packets = packets.filter(p => p.t < 1);

        draw();
        requestAnimationFrame(step);
      };

      build();
      meshCanvas.classList.add('ready');

      if (calm) {
        draw(); // one static frame
      } else {
        const hero = document.getElementById('top');
        const heroObserver = new IntersectionObserver(([entry]) => {
          if (entry.isIntersecting && !running) {
            running = true; last = performance.now();
            requestAnimationFrame(step);
          } else if (!entry.isIntersecting) {
            running = false;
          }
        }, { threshold: 0 });
        heroObserver.observe(hero);

        // Cache the canvas rect — reading it on every pointermove is a layout
        // read per mouse event. It only changes on scroll and resize.
        let meshRect = meshCanvas.getBoundingClientRect();
        const remeasure = () => { meshRect = meshCanvas.getBoundingClientRect(); };
        window.addEventListener('scroll', remeasure, { passive: true });
        window.addEventListener('resize', remeasure, { passive: true });

        window.addEventListener('pointermove', (e) => {
          if (!running) { ptr.on = false; return; }
          const x = e.clientX - meshRect.left, y = e.clientY - meshRect.top;
          ptr.on = x >= 0 && y >= 0 && x <= meshRect.width && y <= meshRect.height;
          ptr.x = x; ptr.y = y;
        }, { passive: true });

        document.addEventListener('pointerleave', () => { ptr.on = false; }, { passive: true });
      }

      let meshTimer;
      window.addEventListener('resize', () => {
        clearTimeout(meshTimer);
        meshTimer = setTimeout(() => { build(); draw(); }, 180);
      }, { passive: true });

      document.addEventListener('themechange', () => { if (!running) draw(); });
    }

    /* ====================================================================
       THROUGHPUT TRACE — bounded inside the spec card, never behind copy.
       Deterministic series, drawn on once, then idle.
       ==================================================================== */
    const trace = document.getElementById('trace');

    if (trace && trace.getContext) {
      const ctx = trace.getContext('2d');
      const N = 120;

      const series = (() => {
        let seed = 20240912;
        const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
        const out = [];
        let base = 0.48;
        for (let i = 0; i < N; i++) {
          base += (rnd() - 0.5) * 0.16;
          base = Math.min(0.80, Math.max(0.20, base));
          const load = Math.sin((i / N) * Math.PI * 3) * 0.10 + Math.sin((i / N) * Math.PI * 8) * 0.035;
          out.push(Math.min(0.94, Math.max(0.06, base + load)));
        }
        return out;
      })();

      let w = 0, h = 0, progress = 0;

      const resize = () => {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const rect = trace.getBoundingClientRect();
        w = rect.width; h = rect.height;
        trace.width = Math.round(w * dpr);
        trace.height = Math.round(h * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      };

      const paint = () => {
        if (!w || !h) return;
        const pad = 6;
        const x = (i) => (i / (N - 1)) * w;
        const y = (v) => h - pad - v * (h - pad * 2);

        ctx.clearRect(0, 0, w, h);

        ctx.strokeStyle = palette.line;
        ctx.lineWidth = 1;
        for (let g = 0; g <= 3; g++) {
          const gy = Math.round(pad + ((h - pad * 2) / 3) * g) + 0.5;
          ctx.beginPath();
          ctx.moveTo(0, gy);
          ctx.lineTo(w, gy);
          ctx.stroke();
        }

        const cut = Math.max(1, Math.floor((N - 1) * progress));
        const path = (upto) => {
          ctx.beginPath();
          ctx.moveTo(x(0), y(series[0]));
          for (let i = 1; i <= upto; i++) {
            const cx = (x(i - 1) + x(i)) / 2;
            ctx.quadraticCurveTo(cx, y(series[i - 1]), x(i), y(series[i]));
          }
        };

        const grad = ctx.createLinearGradient(0, 0, 0, h);
        grad.addColorStop(0, palette.accent);
        grad.addColorStop(1, 'transparent');
        path(cut);
        ctx.lineTo(x(cut), h);
        ctx.lineTo(x(0), h);
        ctx.closePath();
        ctx.globalAlpha = 0.14;
        ctx.fillStyle = grad;
        ctx.fill();
        ctx.globalAlpha = 1;

        path(cut);
        ctx.strokeStyle = palette.accent;
        ctx.lineWidth = 1.5;
        ctx.lineJoin = 'round';
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(x(cut), y(series[cut]), 2.5, 0, Math.PI * 2);
        ctx.fillStyle = palette.accent;
        ctx.fill();
      };

      resize();

      if (calm) {
        progress = 1;
        paint();
      } else {
        const t0 = performance.now();
        const dur = 1400;
        const delay = root.classList.contains('intro') ? 1500 : 300;
        const step = (now) => {
          const t = clamp((now - t0 - delay) / dur, 0, 1);
          progress = 1 - Math.pow(1 - t, 3);
          paint();
          if (t < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      }

      let traceTimer;
      window.addEventListener('resize', () => {
        clearTimeout(traceTimer);
        traceTimer = setTimeout(() => { resize(); paint(); }, 180);
      }, { passive: true });

      document.addEventListener('themechange', paint);
    }

    /* ====================================================================
       CUSTOM CURSOR — fine pointers only. The ring lags the dot and grows
       over anything interactive; [data-cursor] swaps in a label.
       ==================================================================== */
    if (fine && !calm) {
      root.classList.add('cursor-on');
      const dot = document.getElementById('cursor-dot');
      const ring = document.getElementById('cursor-ring');
      const label = document.getElementById('cursor-label');
      let mx = window.innerWidth / 2, my = window.innerHeight / 2;
      let rx = mx, ry = my;

      window.addEventListener('pointermove', (e) => {
        mx = e.clientX; my = e.clientY;
        dot.style.transform = `translate3d(${mx}px, ${my}px, 0) translate(-50%, -50%)`;
      }, { passive: true });

      const follow = () => {
        rx = lerp(rx, mx, 0.16);
        ry = lerp(ry, my, 0.16);
        ring.style.transform = `translate3d(${rx}px, ${ry}px, 0) translate(-50%, -50%)`;
        requestAnimationFrame(follow);
      };
      requestAnimationFrame(follow);

      document.addEventListener('pointerover', (e) => {
        const labelled = e.target.closest('[data-cursor]');
        if (labelled) {
          label.textContent = labelled.dataset.cursor;
          ring.classList.add('label');
          ring.classList.remove('big');
          return;
        }
        if (e.target.closest('a, button')) {
          ring.classList.add('big');
          ring.classList.remove('label');
        }
      });

      document.addEventListener('pointerout', (e) => {
        if (e.target.closest('[data-cursor], a, button')) {
          ring.classList.remove('big', 'label');
          label.textContent = '';
        }
      });
    }

    /* ====================================================================
       MAGNETIC ELEMENTS — pull toward the pointer while hovered.
       Listeners are per-element so we only measure what's under the cursor.
       ==================================================================== */
    if (fine && !calm) {
      document.querySelectorAll('[data-magnetic]').forEach(el => {
        let rect = null;
        el.addEventListener('pointerenter', () => { rect = el.getBoundingClientRect(); });
        el.addEventListener('pointermove', (e) => {
          if (!rect) rect = el.getBoundingClientRect();
          const dx = e.clientX - (rect.left + rect.width / 2);
          const dy = e.clientY - (rect.top + rect.height / 2);
          el.style.transform = `translate3d(${dx * 0.28}px, ${dy * 0.34}px, 0)`;
        });
        el.addEventListener('pointerleave', () => {
          rect = null;
          el.style.transform = '';
          el.style.transition = 'transform 520ms cubic-bezier(0.22, 1, 0.36, 1)';
          setTimeout(() => { el.style.transition = ''; }, 520);
        });
      });
    }

    /* ====================================================================
       SPOTLIGHT — a soft accent glow tracking the pointer inside a panel
       ==================================================================== */
    if (fine) {
      document.querySelectorAll('[data-spotlight]').forEach(el => {
        el.addEventListener('pointermove', (e) => {
          const r = el.getBoundingClientRect();
          el.style.setProperty('--mx', `${e.clientX - r.left}px`);
          el.style.setProperty('--my', `${e.clientY - r.top}px`);
        }, { passive: true });
      });
    }

    /* ====================================================================
       TILT — build cards lean into the pointer
       ==================================================================== */
    if (fine && !calm) {
      document.querySelectorAll('[data-tilt]').forEach(el => {
        let rect = null;
        el.addEventListener('pointerenter', () => { rect = el.getBoundingClientRect(); });
        el.addEventListener('pointermove', (e) => {
          if (!rect) rect = el.getBoundingClientRect();
          const px = (e.clientX - rect.left) / rect.width - 0.5;
          const py = (e.clientY - rect.top) / rect.height - 0.5;
          el.style.transform =
            `perspective(1400px) rotateY(${px * 5}deg) rotateX(${-py * 5}deg) translate3d(0,-5px,0)`;
        });
        el.addEventListener('pointerleave', () => { rect = null; el.style.transform = ''; });
      });
    }

    /* ====================================================================
       TEXT SCRAMBLE — mono labels decode on hover
       ==================================================================== */
    if (!calm) {
      const GLYPHS = '!<>-_\\/[]{}—=+*^?#01';
      document.querySelectorAll('[data-scramble]').forEach(el => {
        const final = el.textContent;
        let raf = null, frame = 0;

        const run = () => {
          const queue = final.split('').map((ch, i) => ({
            ch, start: Math.floor(Math.random() * 12), end: Math.floor(Math.random() * 12) + 12 + i
          }));
          frame = 0;
          cancelAnimationFrame(raf);

          const tick = () => {
            let out = '', done = 0;
            queue.forEach(q => {
              if (frame >= q.end) { done++; out += q.ch; }
              else if (frame >= q.start) { out += GLYPHS[Math.floor(Math.random() * GLYPHS.length)]; }
              else { out += q.ch; }
            });
            el.textContent = out;
            if (done === queue.length) { el.textContent = final; return; }
            frame++;
            raf = requestAnimationFrame(tick);
          };
          tick();
        };

        el.addEventListener('pointerenter', run);
      });
    }

    /* ====================================================================
       TICKER — speed and direction follow scroll velocity
       ==================================================================== */
    const track = document.getElementById('ticker-track');
    let tickerVel = 0;

    if (track && !calm) {
      root.classList.add('js-ticker');
      let offset = 0, half = 0, prev = performance.now();

      const measure = () => { half = track.scrollWidth / 2; };
      measure();
      window.addEventListener('resize', measure, { passive: true });

      const spin = (now) => {
        const dt = Math.min(48, now - prev || 16);
        prev = now;
        tickerVel *= 0.90;
        offset += (0.05 + tickerVel) * dt;
        if (half > 0) offset = ((offset % half) + half) % half;
        track.style.transform = `translate3d(${-offset}px, 0, 0)`;
        requestAnimationFrame(spin);
      };
      requestAnimationFrame(spin);
    }

    /* ====================================================================
       SCROLL — nav state, scroll-spy, ticker velocity, request packet
       ==================================================================== */
    const nav = document.getElementById('nav');
    const menuLinks = Array.from(document.querySelectorAll('.menu-link'));
    const railLinks = Array.from(document.querySelectorAll('.rail a'));
    const sections = menuLinks
      .map(link => document.querySelector(link.getAttribute('href')))
      .filter(Boolean);

    const layers = Array.from(document.querySelectorAll('.layer'));
    const packet = document.getElementById('packet');
    let packetLock = false;

    const movePacket = (layer) => {
      if (!packet || !layer) return;
      packet.style.top = `${layer.offsetTop + layer.offsetHeight / 2}px`;
    };

    let ticking = false, currentId = '', lastY = window.scrollY;

    const onScroll = () => {
      const y = window.scrollY;
      tickerVel = clamp(tickerVel + (y - lastY) * 0.006, -1.2, 1.2);
      lastY = y;

      nav.classList.toggle('stuck', y > 16);

      let found = '';
      sections.forEach(section => {
        if (y >= section.offsetTop - 160) found = section.id;
      });

      if (found !== currentId) {
        currentId = found;
        [...menuLinks, ...railLinks].forEach(link => {
          if (link.getAttribute('href') === `#${found}`) link.setAttribute('aria-current', 'true');
          else link.removeAttribute('aria-current');
        });
      }

      // Packet rides the layer nearest the middle of the viewport
      if (packet && !packetLock && layers.length) {
        const mid = window.innerHeight / 2;
        let best = null, bestD = Infinity;
        layers.forEach(l => {
          const r = l.getBoundingClientRect();
          const d = Math.abs(r.top + r.height / 2 - mid);
          if (d < bestD) { bestD = d; best = l; }
        });
        movePacket(best);
      }

      ticking = false;
    };

    const requestScroll = () => {
      if (!ticking) { ticking = true; requestAnimationFrame(onScroll); }
    };

    window.addEventListener('scroll', requestScroll, { passive: true });
    window.addEventListener('resize', requestScroll, { passive: true });
    onScroll();

    // Hovering a layer takes the packet there
    layers.forEach(l => {
      l.addEventListener('pointerenter', () => { packetLock = true; movePacket(l); });
      l.addEventListener('pointerleave', () => { packetLock = false; requestScroll(); });
    });

    /* ====================================================================
       MOBILE MENU
       ==================================================================== */
    const menuToggle = document.getElementById('menu-toggle');
    const menu = document.getElementById('menu');

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
          top: target.getBoundingClientRect().top + window.scrollY - 84,
          behavior: calm ? 'auto' : 'smooth'
        });
      });
    });

    /* ====================================================================
       ENGINEERING NOTES — accessible disclosure
       ==================================================================== */
    document.querySelectorAll('.notes-btn').forEach(btn => {
      const panel = document.getElementById(btn.getAttribute('aria-controls'));
      if (!panel) return;
      btn.addEventListener('click', () => {
        const open = btn.getAttribute('aria-expanded') === 'true';
        btn.setAttribute('aria-expanded', String(!open));
        panel.classList.toggle('open', !open);
      });
    });

    /* ====================================================================
       REVEAL — [data-reveal] fades up once, [data-lines] unmasks per line.
       Stagger capped so a fast scroller never outruns the animation.
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

    document.querySelectorAll('.metrics > div').forEach((d, i) => d.style.setProperty('--j', i % 3));

    const countUp = (el) => {
      const target = Number(el.dataset.count);
      if (!Number.isFinite(target) || calm) return;
      const t0 = performance.now();
      const dur = 1100;
      const step = (now) => {
        const t = Math.min(1, (now - t0) / dur);
        el.textContent = String(Math.round(target * (1 - Math.pow(1 - t, 3))));
        if (t < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    };

    const lineBlocks = Array.from(document.querySelectorAll('[data-lines]')).filter(el => el !== display);
    lineBlocks.forEach(el => el.querySelectorAll('.ln > span').forEach((s, i) => s.style.setProperty('--i', i)));

    if (!('IntersectionObserver' in window)) {
      revealItems.forEach(el => el.classList.add('in'));
      lineBlocks.forEach(el => el.classList.add('in'));
      return;
    }

    const revealObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('in');
        entry.target.querySelectorAll('.num[data-count]').forEach(countUp);
        revealObserver.unobserve(entry.target);
      });
    }, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });

    revealItems.forEach(el => revealObserver.observe(el));
    lineBlocks.forEach(el => revealObserver.observe(el));
  });
})();
