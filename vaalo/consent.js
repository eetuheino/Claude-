/* Vaalo · shared on every page: HTTPS, cookie consent, analytics, footer year.
   Analytics (Google Analytics 4) loads only after the visitor accepts it.
   Set GA4_ID to your measurement ID (G-XXXXXXXXXX) to turn analytics on. */
(() => {
  'use strict';

  const GA4_ID = '';                       // e.g. 'G-ABC123DEF4'; empty = analytics off
  const KEY = 'vaalo-consent-v1';          // stores only the visitor's choice
  const LOCAL = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);

  // Force HTTPS (servers should also redirect; see .htaccess)
  if (location.protocol === 'http:' && !LOCAL) {
    location.replace('https://' + location.host + location.pathname + location.search + location.hash);
    return;
  }

  document.querySelectorAll('[data-year]').forEach(el => { el.textContent = new Date().getFullYear(); });

  const read = () => { try { return JSON.parse(localStorage.getItem(KEY)); } catch { return null; } };
  const save = analytics => { try { localStorage.setItem(KEY, JSON.stringify({ analytics, date: new Date().toISOString() })); } catch {} };

  /* ---------- analytics ---------- */
  let loaded = false;
  function loadAnalytics() {
    if (loaded || !GA4_ID) return;
    loaded = true;
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag('consent', 'default', { analytics_storage: 'granted', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' });
    window.gtag('js', new Date());
    window.gtag('config', GA4_ID);
    const s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(GA4_ID);
    document.head.appendChild(s);
  }
  function removeAnalyticsCookies() {
    document.cookie.split(';').map(c => c.split('=')[0].trim()).filter(n => /^_ga/.test(n)).forEach(n => {
      const host = location.hostname.replace(/^www\./, '');
      document.cookie = `${n}=; Max-Age=0; path=/`;
      document.cookie = `${n}=; Max-Age=0; path=/; domain=.${host}`;
    });
  }
  // events: only sent when analytics is loaded
  window.vaaloTrack = (name, params) => { if (loaded && window.gtag) window.gtag('event', name, params || {}); };
  document.addEventListener('click', e => {
    const t = e.target.closest('[data-track]');
    if (t) window.vaaloTrack('click', { label: t.dataset.track });
  });

  /* ---------- banner ---------- */
  let banner = null;
  function showBanner() {
    if (banner) { banner.hidden = false; banner.querySelector('button').focus(); return; }
    banner = document.createElement('section');
    banner.className = 'cookie';
    banner.setAttribute('role', 'dialog');
    banner.setAttribute('aria-modal', 'false');
    banner.setAttribute('aria-labelledby', 'cookieTitle');
    banner.innerHTML =
      '<p class="cookie__title" id="cookieTitle">Evästeet</p>' +
      '<p class="cookie__text">Käytämme analytiikkaevästeitä vain, jos hyväksyt ne. Niiden avulla näemme, miten sivua käytetään. ' +
      '<a href="/tietosuoja.html#evasteet">Lue lisää</a></p>' +
      '<div class="cookie__actions">' +
      '<button type="button" class="btn btn--cookie" data-choice="deny">Vain välttämättömät</button>' +
      '<button type="button" class="btn btn--cookie" data-choice="allow">Hyväksy analytiikka</button>' +
      '</div>';
    banner.addEventListener('click', e => {
      const b = e.target.closest('[data-choice]');
      if (!b) return;
      const allow = b.dataset.choice === 'allow';
      save(allow);
      if (allow) loadAnalytics();
      else if (loaded) { removeAnalyticsCookies(); location.reload(); return; }  // stop a running tracker
      else removeAnalyticsCookies();
      banner.hidden = true;
    });
    document.body.appendChild(banner);
  }

  document.addEventListener('click', e => { if (e.target.closest('[data-cookie-settings]')) showBanner(); });

  const choice = read();
  if (choice && choice.analytics) loadAnalytics();
  if (!choice) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', showBanner);
    else showBanner();
  }
})();
