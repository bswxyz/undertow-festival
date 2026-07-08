/* ============================================================
   UNDERTOW FILM FESTIVAL — interactions
   Progressive enhancement: the page is fully readable without
   this file. GSAP drives the letterpress hero; everything else
   is vanilla. Reduced motion kills the loops, keeps the content.
   ============================================================ */
(() => {
  'use strict';
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const $ = (s, c) => (c || document).querySelector(s);
  const $$ = (s, c) => [...(c || document).querySelectorAll(s)];

  /* ------------------------------------------------------------
     Signature easing — cubic-bezier(.85,0,.15,1), "the guillotine".
     GSAP core can't parse CSS beziers, so we solve the curve
     ourselves (Newton–Raphson on x, sample y) and hand GSAP the
     function. Same curve as the CSS var(--ease): one easing, two
     engines.
     ------------------------------------------------------------ */
  function cubicBezier(x1, y1, x2, y2) {
    const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
    const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
    const sampleX = t => ((ax * t + bx) * t + cx) * t;
    const sampleY = t => ((ay * t + by) * t + cy) * t;
    const derivX = t => (3 * ax * t + 2 * bx) * t + cx;
    return x => {
      if (x <= 0) return 0;
      if (x >= 1) return 1;
      let t = x;
      for (let i = 0; i < 6; i++) {
        const e = sampleX(t) - x;
        if (Math.abs(e) < 1e-5) break;
        const d = derivX(t);
        if (Math.abs(d) < 1e-6) break;
        t -= e / d;
      }
      return sampleY(Math.min(1, Math.max(0, t)));
    };
  }
  const guillotine = cubicBezier(.85, 0, .15, 1);
  const settle = cubicBezier(.16, 1, .3, 1);

  /* ------------------------------------------------------------
     Poster hero — kinetic letterpress intro.
     GSAP path when available; CSS-transition fallback otherwise.
     ------------------------------------------------------------ */
  const hero = $('.hero');
  if (hero) {
    if (window.gsap && !reduce.matches) {
      const tl = window.gsap.timeline({ defaults: { ease: guillotine } });
      tl.to('.hero-eyebrow .h-seg', { y: 0, duration: .55 }, .08)
        .to('.hero-title .h-line:nth-child(1) .h-seg', { y: 0, duration: .72 }, .16)
        .to('.hero-title .h-line:nth-child(2) .h-seg', { y: 0, duration: .72 }, .28)
        .fromTo('.h-dot', { scale: 2.4, rotation: -18, transformOrigin: '50% 62%' },
          { scale: 1, rotation: 0, duration: .34 }, .78)
        .to('.hero-bar', { scaleX: 1, duration: .5 }, .52)
        .to('.hero-tag .h-seg', { y: 0, duration: .55 }, .6)
        .to('.hero-lede', { opacity: 1, duration: .6, ease: settle }, .82)
        .to('.hero-actions', { opacity: 1, duration: .6, ease: settle }, .9)
        .fromTo('.hero-meta', { y: 16 }, { y: 0, opacity: 1, duration: .65, ease: settle }, .98)
        .to('.hero-vert', { opacity: 1, duration: .8, ease: settle }, 1.1);
    } else {
      requestAnimationFrame(() => hero.classList.add('loaded'));
    }
  }

  /* ------------------------------------------------------------
     Scroll reveals — IntersectionObserver, unobserve after entry.
     ------------------------------------------------------------ */
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
  }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
  $$('.reveal').forEach(el => io.observe(el));

  /* ------------------------------------------------------------
     Program day-tabs — WAI-ARIA tabs pattern.
     Without JS every panel renders stacked under its day heading;
     with JS we collapse to one panel and wire the keyboard.
     ------------------------------------------------------------ */
  const tablist = $('.day-tabs');
  const tabs = $$('.day-tab');
  const panels = $$('.day-panel');
  if (tablist && tabs.length && tabs.length === panels.length) {
    const select = (i, focus) => {
      tabs.forEach((t, j) => {
        t.setAttribute('aria-selected', String(j === i));
        t.tabIndex = j === i ? 0 : -1;
      });
      panels.forEach((p, j) => { p.hidden = j !== i; });
      if (focus) tabs[i].focus();
    };
    tabs.forEach((t, i) => t.addEventListener('click', () => select(i)));
    tablist.addEventListener('keydown', (e) => {
      const cur = tabs.findIndex(t => t.getAttribute('aria-selected') === 'true');
      let next = null;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (cur + 1) % tabs.length;
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (cur - 1 + tabs.length) % tabs.length;
      else if (e.key === 'Home') next = 0;
      else if (e.key === 'End') next = tabs.length - 1;
      if (next !== null) { e.preventDefault(); select(next, true); }
    });
    select(0);
  }

  /* ------------------------------------------------------------
     Marquee ticker — CSS keyframes do the scrolling; JS only
     provides the pause control (hidden without JS, dead under
     reduced motion where the CSS already froze the band).
     ------------------------------------------------------------ */
  const ticker = $('.ticker');
  const tickBtn = $('.tick-toggle');
  if (ticker && tickBtn && !reduce.matches) {
    tickBtn.hidden = false;
    tickBtn.addEventListener('click', () => {
      const paused = ticker.classList.toggle('paused');
      tickBtn.setAttribute('aria-pressed', String(paused));
      tickBtn.textContent = paused ? 'PLAY' : 'PAUSE';
      tickBtn.setAttribute('aria-label', paused ? 'Resume the scrolling film ticker' : 'Pause the scrolling film ticker');
    });
  }

  /* ------------------------------------------------------------
     Projector — canvas film grain + occasional frame jitter.
     Reduced motion: canvas is display:none in CSS and neither
     loop is started.
     ------------------------------------------------------------ */
  const grain = $('.grain');
  if (grain && !reduce.matches) {
    const gctx = grain.getContext('2d');
    const W = 360, H = 225;
    grain.width = W; grain.height = H;
    const frames = [];
    for (let f = 0; f < 6; f++) {                    // pre-render 6 noise plates, cycle them
      const img = gctx.createImageData(W, H);
      for (let i = 0; i < img.data.length; i += 4) {
        const v = (Math.random() * 255) | 0;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
        img.data[i + 3] = 255;
      }
      frames.push(img);
    }
    let fi = 0, last = 0;
    const loop = (t) => {
      if (reduce.matches) return;                    // stop if the user flips the OS setting
      if (t - last > 90) { gctx.putImageData(frames[fi = (fi + 1) % frames.length], 0, 0); last = t; }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);

    // frame jitter: the projector slips every 6–11 seconds
    const flick = () => {
      if (reduce.matches) return;
      document.body.classList.add('flick');
      setTimeout(() => document.body.classList.remove('flick'), 120);
      setTimeout(flick, 6000 + Math.random() * 5000);
    };
    setTimeout(flick, 4200);
  }

  /* ------------------------------------------------------------
     Retro giant — scroll-scrubbed drift across the jury section.
     ------------------------------------------------------------ */
  if (window.gsap && window.ScrollTrigger && !reduce.matches) {
    window.gsap.registerPlugin(window.ScrollTrigger);
    window.gsap.to('.retro-giant', {
      xPercent: -14,
      ease: 'none',
      scrollTrigger: { trigger: '.jury', start: 'top bottom', end: 'bottom top', scrub: true }
    });
  }
})();
