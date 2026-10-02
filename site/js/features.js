/* CodeVerse 2.0 · features
   Registration state, status bar, countdowns, sharing, calendar, crew ID card, sound and small UX touches.
   Test the site at any date:  ?now=2026-10-09T11:00:00+05:30   or force registration:  ?state=soon|open|closed|full */
(() => {
  'use strict';

  const C = window.CONFIG || {};
  const qs = new URLSearchParams(location.search);
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* ---------------------------------------------------------------- clock (fakeable for testing) */
  const t0 = Date.now();
  const fake = qs.get('now') ? new Date(qs.get('now')).getTime() : null;
  const now = () => (fake ? fake + (Date.now() - t0) : Date.now());
  const T = { opens: +new Date(C.registrationOpens), closes: +new Date(C.registrationCloses), start: +new Date(C.eventStart), end: +new Date(C.eventEnd) };
  const IST = 330 * 60000;
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const dayLabel = ms => { const d = new Date(ms + IST); return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`; };
  const fmtLeft = ms => {
    const s = Math.max(0, Math.floor(ms / 1000));
    const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
    return `${d}d ${String(h).padStart(2, '0')}h ${String(m).padStart(2, '0')}m`;
  };

  /* ---------------------------------------------------------------- analytics (Vercel), off on localhost */
  const isLocal = ['localhost', '127.0.0.1', ''].includes(location.hostname);
  if (!isLocal) {
    window.va = window.va || function () { (window.vaq = window.vaq || []).push(arguments); };
    const a = document.createElement('script');
    a.defer = true; a.src = '/_vercel/insights/script.js';
    document.head.appendChild(a);
  }
  const track = (name, data) => { try { if (window.va) window.va('event', { name, data }); } catch { /* analytics must never break the page */ } };

  /* ---------------------------------------------------------------- registration state */
  const seatsTaken = () => (qs.has('seats') ? Number(qs.get('seats')) : C.seatsTaken);   // ?seats=33 to preview
  const seatsLeft = () => (seatsTaken() == null ? null : Math.max(0, C.seatsTotal - seatsTaken()));
  function regState() {
    const forced = qs.get('state');
    if (['soon', 'open', 'closed', 'full'].includes(forced)) return forced;
    const n = now();
    if (n < T.opens) return 'soon';
    if (n > T.closes) return 'closed';
    return seatsLeft() === 0 ? 'full' : 'open';
  }

  function unstopUrl() {
    try {
      const u = new URL(C.unstopUrl);
      u.searchParams.set('utm_source', qs.get('utm_source') || 'website');
      u.searchParams.set('utm_medium', qs.get('utm_medium') || 'site');
      u.searchParams.set('utm_campaign', 'codeverse2');
      return u.toString();
    } catch { return C.unstopUrl; }
  }
  const instaUrl = () => `https://instagram.com/${C.instagram}`;

  function applyRegistration() {
    const st = regState();
    document.body.dataset.reg = st;
    $$('[data-unstop]').forEach(el => {
      el.dataset.orig ??= el.innerHTML;
      const inline = !!el.closest('p') && !el.classList.contains('btn');
      const short = el.classList.contains('nav__join') || el.classList.contains('stickycta');
      el.classList.toggle('is-muted', st === 'closed' || st === 'full');
      if (st === 'open') {
        el.href = unstopUrl();
        el.innerHTML = el.dataset.orig;
        return;
      }
      el.href = instaUrl();
      if (inline) return;
      const opens = dayLabel(T.opens);
      el.innerHTML = { soon: short ? `Opens ${opens}` : `Registration opens ${opens}`, closed: short ? 'Closed' : 'Registration closed', full: short ? 'Full' : 'Every seat is taken' }[st];
    });
  }

  document.addEventListener('click', e => {
    const a = e.target.closest('[data-unstop]');
    if (a) track('join_click', { state: regState(), where: a.id || a.className.split(' ')[0] });
  });

  /* ---------------------------------------------------------------- status bar */
  const bar = $('#statusbar'), barText = $('#statusText');
  function updateStatus() {
    const n = now(), st = regState(), left = seatsLeft();
    const compact = innerWidth < 560;                       // phones: shorter wording so it never truncates
    const span = ms => (compact ? fmtLeft(ms).replace(/ \d+m$/, '') : fmtLeft(ms));
    let kind = st, text;
    if (n > T.end) { kind = 'over'; text = compact ? 'The heist is over' : 'The heist is over · thanks for playing'; }
    else if (n >= T.start) { kind = 'live'; text = compact ? 'Live now · DJSCE' : `Live now · ${C.venue.name}`; }
    else if (st === 'soon') text = compact ? `Opens ${dayLabel(T.opens)} · in ${span(T.opens - n)}` : `Registration opens ${dayLabel(T.opens)} · in ${span(T.opens - n)}`;
    else if (st === 'open') text = `${compact ? 'Open' : 'Registration open'} · closes in ${span(T.closes - n)}${left != null ? ` · ${left}${compact ? '' : ` of ${C.seatsTotal}`} seats left` : ''}`;
    else if (st === 'full') { kind = 'closed'; text = compact ? `All ${C.seatsTotal} crews are in` : `All ${C.seatsTotal} crews are in · see you on ${dayLabel(T.start)}`; }
    else text = compact ? `Closed · see you ${dayLabel(T.start)}` : `Registration closed · see you on ${dayLabel(T.start)}`;
    bar.dataset.state = kind;
    barText.textContent = text;
  }
  addEventListener('resize', updateStatus);

  /* ---------------------------------------------------------------- sticky mobile CTA */
  const sticky = $('#stickyCta'), main = $('main'), join = $('#join');
  let ticking = false;
  function updateSticky() {
    ticking = false;
    const past = main.getBoundingClientRect().top < innerHeight * 0.15;
    const atJoin = join.getBoundingClientRect().top < innerHeight * 0.55;
    const show = past && !atJoin;
    sticky.hidden = !show;
    document.body.classList.toggle('has-sticky', show);
  }
  addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(updateSticky); } }, { passive: true });

  /* ---------------------------------------------------------------- share */
  async function share() {
    const url = location.origin + location.pathname;
    track('share_click');
    if (navigator.share) {
      try { await navigator.share({ title: 'CodeVerse 2.0', text: C.shareText, url }); return; }
      catch (e) { if (e.name === 'AbortError') return; }
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(`${C.shareText} ${url}`)}`, '_blank', 'noopener');
  }
  $('#shareBtn')?.addEventListener('click', share);

  /* ---------------------------------------------------------------- calendar */
  (function calendar() {
    const stamp = ms => new Date(ms).toISOString().replace(/[-:]|\.\d{3}/g, '');
    const title = 'CodeVerse 2.0 · The Heist';
    const where = `${C.venue.name}, ${C.venue.address}`;
    const desc = `Money Heist themed tech event. Crews of 2–3. AIML Department, DJSCE. Registration desk opens at 08:00.`;
    const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//CodeVerse//2.0//EN', 'BEGIN:VEVENT',
      `UID:codeverse2-${stamp(T.start)}@codeverse`, `DTSTAMP:${stamp(Date.now())}`, `DTSTART:${stamp(T.start)}`, `DTEND:${stamp(T.end)}`,
      `SUMMARY:${title}`, `LOCATION:${where.replace(/,/g, '\\,')}`, `DESCRIPTION:${desc.replace(/,/g, '\\,')}`, 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
    const icsBtn = $('#icsBtn'), gcal = $('#gcalBtn');
    if (icsBtn) { icsBtn.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' })); icsBtn.addEventListener('click', () => track('calendar_ics')); }
    if (gcal) {
      gcal.href = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${stamp(T.start)}/${stamp(T.end)}&details=${encodeURIComponent(desc)}&location=${encodeURIComponent(where)}`;
      gcal.addEventListener('click', () => track('calendar_google'));
    }
  })();

  /* ---------------------------------------------------------------- venue link */
  const maps = $('#mapsLink');
  if (maps) { maps.href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(C.venue.mapsQuery)}`; maps.addEventListener('click', () => track('maps_click')); }

  /* ---------------------------------------------------------------- live schedule (event day) */
  function updateSchedule() {
    const d = new Date(now() + IST);
    const today = d.toISOString().slice(0, 10);
    const eventDay = new Date(T.start + IST).toISOString().slice(0, 10);
    const mins = d.getUTCHours() * 60 + d.getUTCMinutes();
    const toMin = hm => { const [h, m] = hm.split(':').map(Number); return h * 60 + m; };
    $$('.timeline li[data-s]').forEach(li => {
      const s = toMin(li.dataset.s), e = toMin(li.dataset.e);
      li.classList.remove('is-now', 'is-done');
      if (today === eventDay) { if (mins >= s && mins < e) li.classList.add('is-now'); else if (mins >= e) li.classList.add('is-done'); }
      else if (today > eventDay) li.classList.add('is-done');
    });
  }

  /* ---------------------------------------------------------------- sponsors + crew from config */
  if (C.sponsors?.length) {
    $('#sponsors').hidden = false;
    $('#sponsorGrid').innerHTML = C.sponsors.map(s => {
      const inner = s.logo ? `<img src="${esc(s.logo)}" alt="${esc(s.name)}" loading="lazy" decoding="async">` : esc(s.name);
      return s.url ? `<a href="${esc(s.url)}" target="_blank" rel="noopener" aria-label="${esc(s.name)}">${inner}</a>` : `<span>${inner}</span>`;
    }).join('');
  }
  if (C.crew?.length) {
    $('#crew').hidden = false;
    $('#crewGrid').innerHTML = C.crew.map(m => `<article class="dossier">
      <div class="dossier__photo">${m.photo ? `<img src="${esc(m.photo)}" alt="${esc(m.name)}" loading="lazy" decoding="async">` : '<img class="is-mask" src="assets/props/mask.webp" alt="" loading="lazy" decoding="async">'}</div>
      <p class="dossier__code">${esc(m.codename)}</p><h3>${esc(m.name)}</h3><p class="dossier__role">${esc(m.role)}</p></article>`).join('');
  }

  /* ---------------------------------------------------------------- footer marquee (two copies of the list loop seamlessly) */
  if (C.team?.length) {
    const list = C.team.map(n => `<span>${esc(n)}</span>`).join('');
    $('#teamTrack').innerHTML = `<div class="marquee__group">${list}</div><div class="marquee__group" aria-hidden="true">${list}</div>`;
    $('#teamTrack').style.setProperty('--dur', `${Math.max(20, C.team.length * 3)}s`);
    $('#teamMarquee').hidden = false;
  }

  /* ---------------------------------------------------------------- count-up numbers + typewriter kickers */
  const fmtNum = (n, pre) => (pre || '') + Math.round(n).toLocaleString('en-IN');
  function countUp(el) {
    const to = Number(el.dataset.count), pre = el.dataset.prefix || '', start = performance.now(), dur = 1400;
    (function frame(t) {
      const p = Math.min(1, (t - start) / dur);
      el.textContent = fmtNum(to * (1 - Math.pow(1 - p, 3)), pre);
      if (p < 1) requestAnimationFrame(frame);
    })(start);
  }
  function typeOut(el, full) {
    let i = 0;
    el.classList.add('is-typing');
    const timer = setInterval(() => {
      el.textContent = full.slice(0, ++i);
      if (i >= full.length) { clearInterval(timer); el.classList.remove('is-typing'); }
    }, 22);
  }
  if (!reduceMotion) {
    const kickers = $$('.section .kicker').map(el => { const full = el.textContent; el.style.minHeight = `${el.offsetHeight}px`; el.textContent = ' '; return { el, full }; });
    const io = new IntersectionObserver(entries => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        io.unobserve(e.target);
        if (e.target.dataset.count) countUp(e.target);
        else { const k = kickers.find(x => x.el === e.target); if (k) typeOut(k.el, k.full); }
      }
    }, { threshold: 0.6 });
    kickers.forEach(k => io.observe(k.el));
    $$('[data-count]').forEach(el => io.observe(el));
  }

  /* ---------------------------------------------------------------- loader + skip intro */
  (function loader() {
    const el = $('#loader'), barFill = $('#loaderBar');
    if (!el) return;
    const imgs = $$('#scene img');
    if (!imgs.length || reduceMotion || document.documentElement.classList.contains('no-3d')) { el.remove(); return; }
    const minShow = performance.now() + 700;
    let done = 0, finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      setTimeout(() => { el.classList.add('is-done'); setTimeout(() => el.remove(), 900); }, Math.max(0, minShow - performance.now()));
    };
    const bump = () => { done++; barFill.style.transform = `scaleX(${done / imgs.length})`; if (done >= imgs.length) finish(); };
    imgs.forEach(img => (img.complete ? bump() : (img.addEventListener('load', bump, { once: true }), img.addEventListener('error', bump, { once: true }))));
    setTimeout(finish, 4000);
  })();

  $('#skipIntro')?.addEventListener('click', () => {
    const y = $('#briefing').getBoundingClientRect().top + scrollY - 40;
    scrollTo({ top: y, behavior: reduceMotion ? 'auto' : 'smooth' });
    track('skip_intro');
  });

  /* ---------------------------------------------------------------- sound: a synthesised drone + heartbeat (off by default) */
  (function sound() {
    const btn = $('#soundBtn');
    if (!btn) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) { btn.remove(); return; }
    let ac, master, nodes = [], beat, on = false;

    const thump = () => {
      const t = ac.currentTime;
      [[0, 0.34], [0.19, 0.2]].forEach(([dt, amp]) => {
        const o = ac.createOscillator(), g = ac.createGain();
        o.type = 'sine';
        o.frequency.setValueAtTime(70, t + dt);
        o.frequency.exponentialRampToValueAtTime(38, t + dt + 0.16);
        g.gain.setValueAtTime(0.0001, t + dt);
        g.gain.exponentialRampToValueAtTime(amp, t + dt + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dt + 0.28);
        o.connect(g); g.connect(master);
        o.start(t + dt); o.stop(t + dt + 0.3);
      });
    };

    function start() {
      ac = ac || new AC();
      if (ac.state === 'suspended') ac.resume();
      master = ac.createGain();
      master.gain.value = 0;
      master.connect(ac.destination);
      const lp = ac.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = 240; lp.Q.value = 3;
      lp.connect(master);
      const osc = (type, f, gain) => { const o = ac.createOscillator(), g = ac.createGain(); o.type = type; o.frequency.value = f; g.gain.value = gain; o.connect(g); g.connect(lp); o.start(); return o; };
      const lfo = ac.createOscillator(), lfoGain = ac.createGain();
      lfo.frequency.value = 0.06; lfoGain.gain.value = 90;
      lfo.connect(lfoGain); lfoGain.connect(lp.frequency); lfo.start();
      nodes = [osc('sawtooth', 55, 0.5), osc('sawtooth', 55.35, 0.5), osc('sine', 110, 0.35), osc('triangle', 82.4, 0.25), lfo];
      master.gain.setTargetAtTime(0.16, ac.currentTime, 0.8);
      beat = setInterval(thump, 1100);
      thump();
    }
    function stop() {
      clearInterval(beat);
      const old = master, olds = nodes;
      old.gain.setTargetAtTime(0, ac.currentTime, 0.3);
      nodes = [];
      setTimeout(() => { olds.forEach(n => { try { n.stop(); } catch { /* already stopped */ } }); old.disconnect(); }, 1500);
    }
    btn.addEventListener('click', () => {
      on = !on;
      on ? start() : stop();
      btn.setAttribute('aria-pressed', String(on));
      btn.textContent = `♪ Sound: ${on ? 'on' : 'off'}`;
      track('sound_toggle', { on });
    });
  })();

  /* ---------------------------------------------------------------- crew ID card */
  (function crewId() {
    const canvas = $('#idCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const form = $('#idForm'), nameInput = $('#idName'), reroll = $('#idReroll'), dl = $('#idDownload'), sh = $('#idShare');
    const CITIES = ['TOKYO', 'BERLIN', 'NAIROBI', 'RIO', 'DENVER', 'HELSINKI', 'OSLO', 'MOSCOW', 'LISBON', 'PALERMO', 'BOGOTA', 'MANILA', 'STOCKHOLM', 'MARSEILLE'];
    const W = canvas.width, H = canvas.height;
    const hash = str => { let h = 2166136261; for (const ch of str) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
    const cache = {};
    const loadImg = src => (cache[src] ??= new Promise(res => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; }));
    const msg = document.createElement('p');
    msg.className = 'idgen__note'; msg.setAttribute('aria-live', 'polite');
    $('.idgen__actions').after(msg);
    let card = { name: '', city: '', nonce: 0 };

    async function draw() {
      await Promise.all([
        document.fonts.load('900 100px "Big Shoulders Stencil Display"'),
        document.fonts.load('400 40px "Special Elite"'),
        document.fonts.load('500 24px "IBM Plex Mono"'),
      ]).catch(() => {});
      const [poster, mask] = await Promise.all([loadImg('assets/hero/poster.webp'), loadImg('assets/props/mask.webp')]);
      const name = (card.name || 'YOUR NAME').toUpperCase(), city = card.city || '???';
      const id = `CV2-1009-${String(hash(name + city) % 10000).padStart(4, '0')}`;

      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = '#0b0f0e'; ctx.fillRect(0, 0, W, H);
      if (poster) { const s = Math.max(W / poster.width, H / poster.height), w = poster.width * s, h = poster.height * s; ctx.globalAlpha = 0.4; ctx.drawImage(poster, (W - w) / 2, (H - h) / 2, w, h); ctx.globalAlpha = 1; }
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, 'rgba(11,15,14,.5)'); g.addColorStop(0.55, 'rgba(11,15,14,.84)'); g.addColorStop(1, 'rgba(11,15,14,.97)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = 'rgba(169,201,189,.07)'; ctx.lineWidth = 1;
      for (let x = 0; x <= W; x += 54) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
      for (let y = 0; y <= H; y += 54) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

      ctx.fillStyle = '#c4201d'; ctx.fillRect(0, 0, W, 96);
      ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff';
      ctx.font = '500 27px "IBM Plex Mono", monospace'; ctx.letterSpacing = '5px';
      ctx.textAlign = 'left'; ctx.fillText('CREW FILE · OPERATION CODEVERSE', 56, 49);
      ctx.textAlign = 'right'; ctx.fillText('09.10', W - 56, 49);
      ctx.textAlign = 'left';

      if (mask) { const mh = 460, mw = mask.width * mh / mask.height; ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.65)'; ctx.shadowBlur = 40; ctx.drawImage(mask, W - mw - 70, 150, mw, mh); ctx.restore(); }

      ctx.fillStyle = '#a9c9bd'; ctx.font = '500 26px "IBM Plex Mono", monospace'; ctx.letterSpacing = '6px';
      ctx.fillText('NAME', 64, 210);
      ctx.fillStyle = '#efeae0'; ctx.letterSpacing = '0px';
      let size = 84;
      do { ctx.font = `400 ${size}px "Special Elite", "Courier New", monospace`; size -= 3; } while (ctx.measureText(name).width > 560 && size > 34);
      ctx.fillText(name, 64, 290);
      ctx.fillStyle = '#a9c9bd'; ctx.font = '500 26px "IBM Plex Mono", monospace'; ctx.letterSpacing = '4px';
      ctx.fillText(id, 64, 400);

      ctx.fillStyle = '#a9c9bd'; ctx.letterSpacing = '6px'; ctx.fillText('CODENAME', 64, 690);
      ctx.letterSpacing = '0px'; ctx.fillStyle = '#efeae0';
      size = 300;
      do { ctx.font = `900 ${size}px "Big Shoulders Stencil Display", Impact, sans-serif`; size -= 6; } while (ctx.measureText(city).width > W - 128 && size > 90);
      ctx.textBaseline = 'alphabetic'; ctx.fillText(city, 60, 950);
      ctx.fillStyle = '#c4201d'; ctx.fillRect(64, 980, 220, 10);

      ctx.textBaseline = 'middle';
      let seed = hash(id);
      for (let x = 64, i = 0; x < 620; i++) { const w = 3 + (seed >> (i % 24) & 7); if (i % 2 === 0) { ctx.fillStyle = '#efeae0'; ctx.fillRect(x, 1070, w, 90); } x += w + 3; seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; }

      ctx.save(); ctx.translate(W - 250, 1110); ctx.rotate(-0.16);
      ctx.strokeStyle = '#c4201d'; ctx.lineWidth = 7; ctx.strokeRect(-190, -52, 380, 104);
      ctx.fillStyle = '#c4201d'; ctx.font = '900 76px "Big Shoulders Stencil Display", Impact, sans-serif'; ctx.textAlign = 'center'; ctx.letterSpacing = '4px';
      ctx.fillText('CLASSIFIED', 0, 6); ctx.restore();

      ctx.textAlign = 'left'; ctx.letterSpacing = '3px'; ctx.fillStyle = '#a9c9bd'; ctx.font = '500 27px "IBM Plex Mono", monospace';
      ctx.fillText('09.10.2026 · DJSCE MUMBAI · @' + C.instagram.toUpperCase(), 64, 1268);
      ctx.letterSpacing = '0px';
    }

    const assign = () => { card.city = CITIES[(hash(card.name.toLowerCase()) + card.nonce) % CITIES.length]; return draw(); };
    form.addEventListener('submit', async e => {
      e.preventDefault();
      card = { name: nameInput.value.trim().slice(0, 24), city: '', nonce: 0 };
      if (!card.name) return;
      await assign();
      reroll.hidden = false; dl.disabled = false; sh.disabled = false; msg.textContent = `Welcome to the crew, ${card.city.charAt(0) + card.city.slice(1).toLowerCase()}.`;
      track('id_generated', { city: card.city });
    });
    reroll.addEventListener('click', async () => { card.nonce++; await assign(); msg.textContent = `New codename: ${card.city.charAt(0) + card.city.slice(1).toLowerCase()}.`; });

    const toBlob = () => new Promise(res => canvas.toBlob(res, 'image/png'));
    const download = async () => { const b = await toBlob(), a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'codeverse-crew-id.png'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); };
    dl.addEventListener('click', () => { download(); track('id_download'); });
    sh.addEventListener('click', async () => {
      track('id_share');
      const file = new File([await toBlob()], 'codeverse-crew-id.png', { type: 'image/png' });
      if (navigator.canShare?.({ files: [file] })) {
        try { await navigator.share({ files: [file], title: 'My CodeVerse 2.0 crew ID', text: `${card.city}, reporting for duty. ${C.shareText}` }); return; }
        catch (e) { if (e.name === 'AbortError') return; }
      }
      await download();
      msg.textContent = 'Saved. Post it and tag @' + C.instagram + '.';
    });
    draw();
  })();

  /* ---------------------------------------------------------------- go */
  applyRegistration();
  updateStatus();
  updateSchedule();
  updateSticky();
  setInterval(() => { updateStatus(); updateSchedule(); }, 20000);
})();
