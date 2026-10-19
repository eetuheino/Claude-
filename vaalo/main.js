/* Vaalo · interactions
   Scroll is the timeline: every pinned act maps its own progress (0..1) to state,
   so scrubbing backwards undoes it exactly. */
(() => {
  'use strict';

  // Booking requests POST as JSON to the Make scenario
  // "Vaalo – verkkosivun kartoituspyynnöt → Gmail", which emails them to
  // vaalolabs@gmail.com. If webhookUrl is emptied, the form opens a pre-filled email.
  const CONFIG = {
    contactEmail: 'vaalolabs@gmail.com',
    webhookUrl: 'https://hook.eu1.make.com/os4nymthv1pawxytmmixvcx7x5u64izd'
  };

  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };
  const easeOut = t => 1 - Math.pow(1 - t, 3);
  const mix = (c1, c2, t) => `rgb(${c1.map((c, i) => Math.round(lerp(c, c2[i], t))).join(',')})`;
  const fmt = n => Math.round(n).toLocaleString('fi-FI');

  let vw = innerWidth, vh = innerHeight;
  const isMobile = () => vw <= 760;

  /* ------------------------------------------------------------------
     Shared routine vocabulary (week rail → peak → done list)
     ------------------------------------------------------------------ */
  const ROUTINES = ['Vastaa liidiin', 'Tarjouksen seuranta', 'Päivitä CRM', 'Sähköpostit',
                    'Hinta-arvio', 'Ajanvaraukset', 'Viikkoraportti', 'Laskujen esivalmistelu'];

  /* ------------------------------------------------------------------
     ACT 1 · hero: intro + pointer field
     ------------------------------------------------------------------ */
  const hero = $('.hero');
  const heroChips = $$('.hero .chip').map(el => {
    const d = parseFloat(el.dataset.depth);
    el.style.setProperty('--o', (0.5 + 0.5 * d).toFixed(2));
    el.style.filter = d < 0.4 ? `blur(${((0.4 - d) * 5).toFixed(1)}px)` : '';
    return { el, d, x: 0, y: 0 };
  });
  const ghost = $('.hero__ghost');
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  const startHero = () => requestAnimationFrame(() => hero.classList.add('is-in'));
  if (document.fonts && document.fonts.ready) {
    Promise.race([document.fonts.ready, new Promise(r => setTimeout(r, 900))]).then(startHero);
  } else startHero();

  if (!reduced) {
    addEventListener('pointermove', e => {
      pointer.tx = (e.clientX / vw - 0.5) * 2;
      pointer.ty = (e.clientY / vh - 0.5) * 2;
      kick();
    }, { passive: true });
  }

  function drawHero(sy) {
    if (sy > vh * 1.2) return false;
    pointer.x = lerp(pointer.x, pointer.tx, 0.08);
    pointer.y = lerp(pointer.y, pointer.ty, 0.08);
    for (const c of heroChips) {
      const s = 0.82 + 0.26 * c.d;
      const px = -pointer.x * 34 * c.d;            // chips drift away from the pointer
      const py = -pointer.y * 22 * c.d - sy * (0.15 + 0.45 * c.d);
      c.el.style.transform = `translate3d(${px.toFixed(1)}px,${py.toFixed(1)}px,0) scale(${s.toFixed(3)})`;
    }
    ghost.style.setProperty('--ghost-y', `${(sy * 0.22).toFixed(1)}px`);
    return Math.abs(pointer.x - pointer.tx) > 0.002 || Math.abs(pointer.y - pointer.ty) > 0.002;
  }

  /* ------------------------------------------------------------------
     ACT 2 · week rail
     ------------------------------------------------------------------ */
  const WEEK = [
    ['Maanantai', [[8, 12, 'w', 'Asiakastyö'], [12, 13, 'r', 'Sähköpostit'], [13, 16, 'w', 'Asiakastyö'], [16, 17.5, 'r', 'Tarjousluonnos'], [19, 20, 'r', 'Liidien läpikäynti']]],
    ['Tiistai',   [[8, 11, 'w', 'Asiakaskäynti'], [11, 12, 'r', 'Päivitä CRM'], [12, 15.5, 'w', 'Asiakastyö'], [15.5, 17, 'r', 'Tarjouksen seuranta'], [18.5, 20, 'r', 'Sähköpostit']]],
    ['Keskiviikko', [[8, 12, 'w', 'Asiakastyö'], [12.5, 14, 'r', 'Hinta-arvio'], [14, 16.5, 'w', 'Asiakastyö'], [16.5, 18, 'r', 'Ajanvaraukset']]],
    ['Torstai',   [[8, 10.5, 'w', 'Myyntipalaveri'], [10.5, 12, 'r', 'Vastaa liidiin'], [12, 16, 'w', 'Asiakastyö'], [17, 19, 'r', 'Laskujen esivalmistelu']]],
    ['Perjantai', [[8, 11, 'w', 'Asiakastyö'], [11, 13, 'r', 'Viikkoraportti'], [13, 14.5, 'r', 'Seurannat'], [14.5, 16, 'w', 'Asiakastyö'], [18, 20, 'r', 'Raportti käsin']]]
  ];
  const H0 = 8, H1 = 20, pct = h => ((h - H0) / (H1 - H0)) * 100;
  const rail = $('#weekRail');
  const routineBlocks = [];
  WEEK.forEach(([day, blocks], di) => {
    const col = document.createElement('div');
    col.className = 'day';
    const late = blocks.filter(b => b[2] === 'r' && b[1] > 17).length;
    col.innerHTML = `<p class="day__name"><span>${day}</span><span>${late ? 'ilta mukana' : ''}</span></p><div class="day__grid"></div>`;
    const grid = col.lastElementChild;
    for (let h = H0 + 2; h < H1; h += 2) grid.insertAdjacentHTML('beforeend', `<span class="day__hour" style="top:${pct(h)}%"></span>`);
    grid.insertAdjacentHTML('beforeend', `<span class="day__evening" style="top:${pct(17)}%"></span><span class="day__eod" style="top:${pct(17)}%">${di === 0 ? '<span>Työpäivä päättyy 17.00</span>' : ''}</span>`);
    blocks.forEach(([s, e, kind, label]) => {
      const b = document.createElement('div');
      b.className = `blk ${kind === 'w' ? 'blk--work' : 'blk--routine'}${kind === 'r' && e > 17 ? ' blk--late' : ''}`;
      b.style.top = `calc(${pct(s)}% + 2px)`;
      b.style.height = `calc(${pct(e) - pct(s)}% - 4px)`;
      b.textContent = label;
      grid.appendChild(b);
      if (kind === 'r') routineBlocks.push(b);
    });
    rail.appendChild(col);
  });
  const week = $('#viikko'), weekVp = $('.week__viewport'), punch = $('#weekPunch');
  let railShift = 0;

  function drawWeek(p) {
    const pan = smooth(0.04, 0.9, p);
    rail.style.transform = `translate3d(${(-pan * railShift).toFixed(1)}px,0,0)`;
    const n = routineBlocks.length;
    routineBlocks.forEach((b, k) => {
      const f = easeOut(clamp(p * n * 1.2 - k * 1.0 - 0.2));
      b.style.opacity = f.toFixed(3);
      b.style.transform = `scaleY(${(0.4 + 0.6 * f).toFixed(3)})`;
    });
    punch.style.opacity = (0.32 + 0.68 * smooth(0.84, 0.97, p)).toFixed(3);
  }

  /* ------------------------------------------------------------------
     ACT 3 · peak: routines pass through the V and get checked off
     ------------------------------------------------------------------ */
  const peak = $('#valo'), mark = $('#peakMark'), glow = $('#peakGlow');
  const q = $('#peakQ'), done = $('#peakDone'), list = $('#peakList');
  const chipsWrap = $('#peakChips');
  const headLines = $$('.peak__headline .pl');
  const NAVY = [0, 0, 44], PAPER = [244, 244, 248], INK = [255, 255, 255];
  const peakChips = ROUTINES.map((label, i) => {
    const el = document.createElement('span');
    el.className = 'chip'; el.textContent = label;
    chipsWrap.appendChild(el);
    const li = document.createElement('li'); li.textContent = label; list.appendChild(li);
    return { el, li, i, w: 0, h: 0, a: 0.22 + i * 0.062 };
  });
  const DUR = 0.11;
  let geo = null;
  let peakGround = 0;

  function measurePeak() {
    const w = mark.getBoundingClientRect().width / (parseFloat(mark.dataset.scale) || 1);
    const h = w * 575 / 440;
    const cx = vw / 2, cy = vh * (isMobile() ? 0.38 : 0.46);
    geo = {
      w, h, cx, cy,
      notch: [cx - w / 2 + w * 0.4977, cy - h / 2 + h * 0.443],
      vertex: [cx - w / 2 + w * 0.4977, cy - h / 2 + h * 0.739]
    };
    peakChips.forEach(c => { c.w = c.el.offsetWidth; c.h = c.el.offsetHeight; });
  }

  function drawPeak(p, pRaw) {
    // silence: a single question, nothing else
    q.style.opacity = (smooth(-0.2, 0.02, pRaw) * (1 - smooth(0.12, 0.17, p))).toFixed(3);
    q.style.transform = `translate(-50%, calc(-50% - ${(smooth(0.12, 0.17, p) * 30).toFixed(1)}px))`;

    // ground: night to light
    peakGround = smooth(0.34, 0.76, p);
    peak.style.setProperty('--peak-bg', mix(NAVY, PAPER, peakGround));
    peak.style.setProperty('--mark', mix(INK, NAVY, smooth(0.4, 0.7, p)));

    // the V arrives from distance (scale + blur), then lifts for the headline
    const e = smooth(0.13, 0.24, p);
    const f = smooth(0.76, 0.86, p);
    const scale = (1.3 - 0.3 * e) * (1 - 0.4 * f);
    mark.dataset.scale = scale;
    mark.style.opacity = e.toFixed(3);
    mark.style.filter = e < 1 ? `blur(${((1 - e) * 12).toFixed(1)}px)` : '';
    mark.style.transform = `translate(-50%, calc(-50% - ${(f * vh * (isMobile() ? 0.2 : 0.24)).toFixed(1)}px)) scale(${scale.toFixed(3)})`;

    // chips travel into the V's notch, then drop through the vertex
    let flash = 0;
    const { notch, vertex, cx, h } = geo;
    for (const c of peakChips) {
      const t = clamp((p - c.a) / DUR);
      c.li.classList.toggle('is-done', t >= 1);
      if (t <= 0 || t >= 1) { c.el.style.opacity = 0; continue; }
      const fromLeft = c.i % 2 === 0;
      const x0 = fromLeft ? -c.w - 20 : vw + 20;
      const y0 = vh * (0.18 + 0.64 * ((c.i * 0.37) % 1));
      const ctrl = [cx + (fromLeft ? -1 : 1) * vw * 0.12, notch[1] - h * 0.95];
      let x, y, s, o = 1;
      if (t < 0.8) {
        const u = easeOut(t / 0.8), iu = 1 - u;
        x = iu * iu * x0 + 2 * iu * u * ctrl[0] + u * u * notch[0];
        y = iu * iu * y0 + 2 * iu * u * ctrl[1] + u * u * notch[1];
        s = 1 - 0.55 * u;
      } else {
        const v = (t - 0.8) / 0.2;
        x = lerp(notch[0], vertex[0], v); y = lerp(notch[1], vertex[1], v);
        s = 0.45 - 0.3 * v; o = 1 - v;
        flash = Math.max(flash, Math.sin(Math.PI * v));
      }
      c.el.style.opacity = o.toFixed(3);
      c.el.style.transform = `translate3d(${(x - c.w / 2).toFixed(1)}px,${(y - c.h / 2).toFixed(1)}px,0) scale(${s.toFixed(3)})`;
    }
    glow.style.opacity = flash.toFixed(3);

    // checklist panel holds while work is done, yields to the headline
    done.style.opacity = (smooth(0.17, 0.22, p) * (1 - smooth(0.765, 0.8, p))).toFixed(3);

    for (const el of headLines) {
      const at = parseFloat(el.dataset.at);
      const o = smooth(at, at + 0.05, p);
      el.style.opacity = o.toFixed(3);
      el.style.transform = `translateY(${((1 - o) * 36).toFixed(1)}px)`;
    }
  }

  /* ------------------------------------------------------------------
     ACT 5 · process line draws with scroll
     ------------------------------------------------------------------ */
  const track = $('.process__track'), fill = $('#processFill'), stops = $$('.stop');
  function drawProcess() {
    const r = track.getBoundingClientRect();
    const pf = clamp((vh * 0.82 - r.top) / (vh * 0.42));
    fill.style.setProperty('--pf', pf.toFixed(3));
    stops.forEach((s, i) => s.classList.toggle('is-reached', pf >= i / (stops.length - 1) - 0.001));
  }

  /* ------------------------------------------------------------------
     nav ground awareness
     ------------------------------------------------------------------ */
  const nav = $('.nav');
  const grounds = $$('main > section, .footer');
  function drawNav(sy) {
    nav.classList.toggle('is-scrolled', sy > 24);
    const probe = 34;
    for (const s of grounds) {
      const r = s.getBoundingClientRect();
      if (r.top <= probe && r.bottom > probe) {
        const light = s === peak ? peakGround > 0.5 : s.classList.contains('ground-light');
        nav.dataset.on = light ? 'light' : 'dark';
        break;
      }
    }
  }

  /* ------------------------------------------------------------------
     frame loop (runs only while something is moving)
     ------------------------------------------------------------------ */
  const progressOf = (el, raw = false) => {
    const r = el.getBoundingClientRect();
    const p = -r.top / (r.height - vh);
    return raw ? p : clamp(p);
  };
  let ticking = false;
  function frame() {
    ticking = false;
    const sy = scrollY;
    const moving = drawHero(sy);
    drawWeek(progressOf(week));
    drawPeak(progressOf(peak), progressOf(peak, true));
    drawProcess();
    drawNav(sy);
    if (moving) kick();
  }
  function kick() { if (!ticking) { ticking = true; requestAnimationFrame(frame); } }
  function layout() {
    vw = innerWidth; vh = innerHeight;
    railShift = Math.max(0, rail.scrollWidth - weekVp.clientWidth);
    measurePeak();
    kick();
  }
  addEventListener('scroll', kick, { passive: true });
  addEventListener('resize', layout);
  if (document.fonts) document.fonts.ready.then(layout);
  layout();

  /* ------------------------------------------------------------------
     reveal on enter (always resolves to full opacity)
     ------------------------------------------------------------------ */
  const reveals = $$('[data-reveal]');
  if ('IntersectionObserver' in window && !reduced) {
    const io = new IntersectionObserver(entries => {
      entries.forEach(en => { if (en.isIntersecting) { en.target.classList.add('is-visible'); io.unobserve(en.target); } });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    reveals.forEach(el => io.observe(el));
  } else reveals.forEach(el => el.classList.add('is-visible'));

  /* ------------------------------------------------------------------
     Booking form: validation, spam protection, delivery
     ------------------------------------------------------------------ */
  const form = $('#leadForm'), err = $('#formError'), doneBox = $('#formDone'), doneText = $('#formDoneText');
  const MIN_FILL_MS = 3000;          // humans take longer than this; most bots don't
  const RESEND_WAIT_MS = 60000;      // one request per minute per browser tab
  const formStart = Date.now();
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  const PHONE_RE = /^\+?[0-9\s()-]{6,24}$/;

  const rules = {
    nimi: v => v.trim().length >= 2 ? '' : 'Kirjoita nimesi.',
    email: v => !v.trim() ? 'Kirjoita sähköpostiosoitteesi.' : EMAIL_RE.test(v.trim()) ? '' : 'Tarkista sähköpostiosoite, esim. nimi@yritys.fi.',
    puhelin: v => !v.trim() || PHONE_RE.test(v.trim()) ? '' : 'Tarkista puhelinnumero, esim. +358 40 123 4567.',
    viesti: v => v.length <= 1500 ? '' : 'Viesti on liian pitkä (enintään 1500 merkkiä).',
    consent: (v, el) => el.checked ? '' : 'Hyväksy tietosuojaseloste, jotta voin vastata sinulle.'
  };
  function check(name) {
    const el = form.elements[name];
    const msg = rules[name](el.value, el);
    const box = $(`#${el.id}-err`);
    el.setAttribute('aria-invalid', msg ? 'true' : 'false');
    el.closest('.field').classList.toggle('is-invalid', !!msg);
    if (box) box.textContent = msg;
    return !msg;
  }
  // validate on leave, re-validate while fixing
  Object.keys(rules).forEach(name => {
    const el = form.elements[name];
    el.addEventListener('blur', () => { if (el.value || el.type === 'checkbox') check(name); });
    el.addEventListener(el.type === 'checkbox' ? 'change' : 'input', () => { if (el.getAttribute('aria-invalid') === 'true') check(name); });
  });

  form.addEventListener('submit', async e => {
    e.preventDefault();
    err.textContent = '';
    const results = Object.keys(rules).map(n => [n, check(n)]);
    const firstBad = results.find(([, ok]) => !ok);
    if (firstBad) { err.textContent = 'Korjaa merkityt kohdat.'; form.elements[firstBad[0]].focus(); return; }

    // spam protection: honeypot, minimum fill time, resend limit
    const bot = form.elements.website.value !== '' || Date.now() - formStart < MIN_FILL_MS;
    let last = 0;
    try { last = +sessionStorage.getItem('vaalo-last-submit') || 0; } catch {}
    if (Date.now() - last < RESEND_WAIT_MS) { err.textContent = 'Pyyntösi on jo lähetetty. Odota hetki ennen uutta pyyntöä.'; return; }
    if (bot) { form.classList.add('is-sent'); return; }   // pretend success, send nothing

    const data = {
      nimi: form.nimi.value.trim(),
      yritys: form.yritys.value.trim(),
      email: form.email.value.trim(),
      puhelin: form.puhelin.value.trim(),
      rutiinit: $$('input[name="rutiini"]:checked', form).map(i => i.value),
      viesti: form.viesti.value.trim(),
      tietosuoja_hyvaksytty: new Date().toISOString(),
      sivu: location.href
    };

    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;
    if (CONFIG.webhookUrl) {
      const label = btn.textContent;
      btn.textContent = 'Lähetetään…';
      const timeout = new AbortController();
      const timer = setTimeout(() => timeout.abort(), 20000);
      try {
        const r = await fetch(CONFIG.webhookUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data), signal: timeout.signal });
        if (!r.ok) throw new Error(r.status);
        doneText.textContent = 'Palaan sinulle henkilökohtaisesti mahdollisimman nopeasti.';
      } catch {
        btn.disabled = false;
        btn.textContent = label;
        err.textContent = `Lähetys ei onnistunut. Kirjoita suoraan osoitteeseen ${CONFIG.contactEmail}.`;
        return;
      } finally {
        clearTimeout(timer);
      }
      btn.textContent = label;
    } else {
      const lines = [
        `Nimi: ${data.nimi}`,
        data.yritys && `Yritys: ${data.yritys}`,
        `Sähköposti: ${data.email}`,
        data.puhelin && `Puhelin: ${data.puhelin}`,
        data.rutiinit.length && `Eniten aikaa vievät: ${data.rutiinit.join(', ')}`,
        data.viesti && `\n${data.viesti}`
      ].filter(Boolean);
      const subject = `Kartoituspyyntö: ${data.yritys || data.nimi}`;
      location.href = `mailto:${CONFIG.contactEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(lines.join('\n'))}`;
      doneText.textContent = 'Sähköpostisi avautuu valmiin viestin kanssa. Lähetä se, niin palaan sinulle henkilökohtaisesti mahdollisimman nopeasti.';
    }
    try { sessionStorage.setItem('vaalo-last-submit', String(Date.now())); } catch {}
    if (window.vaaloTrack) window.vaaloTrack('generate_lead', { method: CONFIG.webhookUrl ? 'webhook' : 'mailto' });
    btn.disabled = false;
    form.classList.add('is-sent');
    doneBox.focus();
  });
})();