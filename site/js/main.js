/* CodeVerse 2.0 · The Heist
   Hero: flat photo layers placed at real CSS 3D depths, driven by a scroll timeline. */

// Join buttons (href, label, state) are handled in features.js from config.js.

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const hasGsap = typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined';
if (!hasGsap) document.documentElement.classList.add('no-3d');

/* ==========================================================================
   ACT I · THE BREAK-IN
   ========================================================================== */
function initBreakIn() {
  const L = window.LAYOUT;
  const DW = L.design.w, DH = L.design.h;
  const hx = L.hole.cx / DW, hy = L.hole.cy / DH;             // doorway centre, 0–1 of the frame

  const stage = document.querySelector('.breakin__stage');
  const camera = document.getElementById('camera');
  const scene = document.getElementById('scene');
  const depths = [...scene.querySelectorAll('.depth')];
  const door = document.getElementById('door');
  const money = document.getElementById('money');
  const crew = { l: document.getElementById('crewL'), r: document.getElementById('crewR') };

  const pct = (v, total) => `${(v / total) * 100}%`;
  const place = (el, x, y, w, h) => Object.assign(el.style, { left: pct(x, DW), top: pct(y, DH), width: pct(w, DW), height: h == null ? 'auto' : pct(h, DH) });

  // Static placement in H1's coordinate space; percentages keep everything aligned at any size.
  place(door, L.door.cx - L.door.r, L.door.cy - L.door.r, L.door.r * 2, L.door.r * 2);
  place(money, L.money.x, L.money.y, L.money.w, null);
  for (const k of ['l', 'r']) place(crew[k], L.crew[k].x, L.crew[k].y, L.crew[k].w, null);
  scene.style.setProperty('--hx', `${hx * 100}%`);
  scene.style.setProperty('--hy', `${hy * 100}%`);
  scene.style.transformOrigin = `${hx * 100}% ${hy * 100}%`;
  document.getElementById('gate').style.transformOrigin = `${hx * 100}% ${hy * 100}%`;

  // Crew poses: feet position + height, in design px. "h1" is where they stand in the reference shot.
  const feet = r => ({ fx: r.x + r.w / 2, fy: r.y + r.h, h: r.h });
  const pose = {
    l: { h1: feet(L.crew.l), start: { fx: 420, fy: 1010, h: 760 }, door: { fx: 790, fy: 603, h: 230 } },
    r: { h1: feet(L.crew.r), start: { fx: 1180, fy: 1010, h: 680 }, door: { fx: 862, fy: 603, h: 205 } },
  };

  let k = 1;   // screen px per design px
  function layout() {
    const vw = stage.clientWidth, vh = stage.clientHeight;
    // Landscape: cover the viewport. Portrait: a full cover would crop to a sliver of the door,
    // so show more of the room, pin it to the bottom (the money) and leave the top for the copy.
    const portrait = vh > vw * 1.15;
    const bw = portrait ? Math.max(vw * 2.25, vw) : Math.max(vw, vh * DW / DH), bh = bw * DH / DW;
    k = bw / DW;
    // Keep the doorway as close to centre as the crop allows.
    const left = Math.min(0, Math.max(vw - bw, vw / 2 - hx * bw));
    const top = portrait ? vh - bh + 0.02 * bh : (vh - bh) / 2;
    Object.assign(scene.style, { width: `${bw}px`, height: `${bh}px`, left: `${left}px`, top: `${top}px` });

    const P = bw * 0.95;
    camera.style.perspective = `${P}px`;
    camera.style.perspectiveOrigin = `${left + hx * bw}px ${top + hy * bh}px`;

    // Push each layer to its depth, then scale it back so the composition matches H1 at rest.
    for (const d of depths) {
      const z = Number(d.dataset.z) * k;
      d.style.transformOrigin = `${hx * 100}% ${hy * 100}%`;
      d.style.transform = `translateZ(${z}px) scale(${(P - z) / P})`;
    }
  }
  layout();

  // Pose → transform relative to the element's H1 placement (origin is at the feet).
  const poseTo = (who, p) => ({
    x: () => (p.fx - pose[who].h1.fx) * k,
    y: () => (p.fy - pose[who].h1.fy) * k,
    scale: p.h / pose[who].h1.h,
  });

  gsap.set('#vault', { scale: 0.5, xPercent: (hx - 0.5) * 100, yPercent: (hy - 0.5) * 100 });
  gsap.set(crew.l, poseTo('l', pose.l.start));
  gsap.set(crew.r, poseTo('r', pose.r.start));

  const endShade = document.createElement('div');
  endShade.className = 'grade';
  endShade.style.cssText = 'background:rgba(8,12,11,.5);opacity:0';
  document.getElementById('scrim').after(endShade);

  const beats = [...document.querySelectorAll('.beat')];
  const crewImgs = [crew.l.querySelector('img'), crew.r.querySelector('img')];

  // Runs on the timeline (not the ScrollTrigger) so it keeps firing while scrub smoothing catches up.
  function onTimelineUpdate() {
    const p = tl.progress();
    beats.forEach(b => b.classList.toggle('is-live', parseFloat(getComputedStyle(b).opacity) > 0.5));
    // Footstep bob while the crew walk (0.05–0.62 of the scroll).
    const walking = p > 0.05 && p < 0.62;
    crewImgs.forEach((img, i) => { img.style.translate = walking ? `0 ${-Math.abs(Math.sin(p * 95 + i * 1.6)) * 1.4}%` : '0 0'; });
  }

  const tl = gsap.timeline({
    defaults: { ease: 'none' },
    onUpdate: onTimelineUpdate,
    scrollTrigger: { trigger: '.breakin', start: 'top top', end: 'bottom bottom', scrub: 1.1, invalidateOnRefresh: true },
  });

  const beatIn = (id, at) => tl.fromTo(id, { opacity: 0, y: 36 }, { opacity: 1, y: 0, duration: 0.05, ease: 'power2.out' }, at);
  const beatOut = (id, at) => tl.to(id, { opacity: 0, y: -36, duration: 0.04, ease: 'power1.in' }, at);

  // 0 → 0.1  Establishing shot
  tl.to('#cue', { opacity: 0, duration: 0.03 }, 0.01);
  beatOut('#b1', 0.07);

  // 0.1 → 0.32  The door swings open on its hinge, light spills out
  // Negative angle swings it inward, so the wall plane hides it as it turns (no clash with the crew).
  tl.to(door, { rotationY: -82, duration: 0.22, ease: 'power2.inOut' }, 0.1)
    .to('#doorShade', { opacity: 0.6, duration: 0.22, ease: 'power2.in' }, 0.1)
    .to('#glow', { opacity: 1, duration: 0.16 }, 0.14)
    .to('#spill', { opacity: 1, duration: 0.16 }, 0.16);
  beatIn('#b2', 0.12); beatOut('#b2', 0.3);

  // 0.05 → 0.62  Crew walk to the doorway and through it; the camera creeps forward
  for (const who of ['l', 'r']) {
    tl.to(crew[who], { ...poseTo(who, pose[who].h1), duration: 0.45, ease: 'sine.inOut' }, 0.05)
      .to(crew[who], { ...poseTo(who, pose[who].door), duration: 0.12, ease: 'sine.in' }, 0.5)
      .to(crew[who], { opacity: 0, duration: 0.04 }, 0.58);
  }
  tl.to('#gate', { scale: 1.1, duration: 0.55, ease: 'sine.inOut' }, 0)
    .to('#vault', { scale: 0.56, duration: 0.55, ease: 'sine.inOut' }, 0)
    .to(money, { scale: 1.1, duration: 0.55, ease: 'sine.inOut' }, 0);
  beatIn('#b3', 0.34); beatOut('#b3', 0.5);

  // 0.58 → 0.86  Fly through the doorway into the vault
  tl.to('#gate', { scale: 6.5, duration: 0.26, ease: 'power2.in' }, 0.58)
    .to(['#wall', door], { opacity: 0, duration: 0.06 }, 0.78)
    .to('#spill', { opacity: 0, duration: 0.08 }, 0.6)
    .to(money, { yPercent: 70, scale: 1.7, filter: 'blur(10px)', duration: 0.18, ease: 'power2.in' }, 0.55)
    .to(money, { opacity: 0, duration: 0.05 }, 0.68)
    .to('#vault', { scale: 1.04, xPercent: 0, yPercent: 0, duration: 0.3, ease: 'power2.inOut' }, 0.58)
    .to('#glow', { opacity: 0, duration: 0.12 }, 0.7);
  beatIn('#b4', 0.66); beatOut('#b4', 0.82);

  // 0.86 → 1  Settle inside, call to action
  tl.to(endShade, { opacity: 1, duration: 0.06 }, 0.84)
    .to('#vault', { scale: 1.1, duration: 0.14 }, 0.86);
  beatIn('#b5', 0.88);
  tl.to({}, { duration: 0.02 }, 0.98);   // hold the last frame

  // Mouse / idle camera tilt. Real 3D rotation, so near layers shift more than far ones.
  const tilt = { x: 0, y: 0, tx: 0, ty: 0 };
  addEventListener('pointermove', e => {
    tilt.ty = (e.clientX / innerWidth - 0.5) * 5;
    tilt.tx = -(e.clientY / innerHeight - 0.5) * 3.2;
  }, { passive: true });
  // Phones: tilt with the device where no permission prompt is needed (Android). iOS keeps the idle sway.
  let gyro = false;
  if (matchMedia('(hover: none)').matches && 'DeviceOrientationEvent' in window && typeof DeviceOrientationEvent.requestPermission !== 'function') {
    const clamp = (v, m) => Math.max(-m, Math.min(m, v));
    addEventListener('deviceorientation', e => {
      if (e.gamma == null || e.beta == null) return;
      gyro = true;
      tilt.ty = (clamp(e.gamma, 25) / 25) * 4;
      tilt.tx = -(clamp(e.beta - 55, 20) / 20) * 2.5;
    }, { passive: true });
  }
  (function loop(t) {
    const idle = matchMedia('(hover: none)').matches && !gyro;
    const ty = idle ? Math.sin(t / 2600) * 1.2 : tilt.ty;
    const tx = idle ? Math.cos(t / 3100) * 0.7 : tilt.tx;
    tilt.x += (tx - tilt.x) * 0.06;
    tilt.y += (ty - tilt.y) * 0.06;
    scene.style.transform = `rotateX(${tilt.x.toFixed(3)}deg) rotateY(${tilt.y.toFixed(3)}deg)`;
    requestAnimationFrame(loop);
  })(0);

  addEventListener('resize', () => { layout(); ScrollTrigger.refresh(); });

  // Reveal once the layers have loaded so nothing pops in misaligned, but never stay blank:
  // a slow or stalled image (or a background tab) must not hold the whole hero hostage.
  const loaded = [...scene.querySelectorAll('img')].map(img => img.complete ? Promise.resolve()
    : new Promise(res => { img.addEventListener('load', res, { once: true }); img.addEventListener('error', res, { once: true }); }));
  Promise.race([Promise.all(loaded), new Promise(res => setTimeout(res, 2500))]).then(() => scene.classList.add('is-ready'));
}

/* ==========================================================================
   SECTIONS
   ========================================================================== */
function initSections() {
  // Nav turns solid once the hero is behind us.
  const nav = document.getElementById('nav');
  const onScroll = () => nav.classList.toggle('is-solid', document.querySelector('main').getBoundingClientRect().top < 64);
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // Scroll reveals, staggered within each parent.
  const io = new IntersectionObserver(entries => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      const siblings = [...e.target.parentElement.querySelectorAll(':scope > .reveal')];
      e.target.style.transitionDelay = `${Math.max(0, siblings.indexOf(e.target)) * 80}ms`;
      e.target.classList.add('is-revealed');
      io.unobserve(e.target);
    }
  }, { rootMargin: '0px 0px -10% 0px' });
  document.querySelectorAll('.reveal').forEach(el => io.observe(el));

  // The Plan: expanding panels, auto-cycling until someone interacts.
  const panels = [...document.querySelectorAll('.panel')];
  let active = 0, timer;
  const activate = i => { active = i; panels.forEach((p, j) => p.classList.toggle('is-active', j === i)); };
  const stop = () => clearInterval(timer);
  panels.forEach((p, i) => {
    p.addEventListener('mouseenter', () => { stop(); activate(i); });
    p.addEventListener('focus', () => { stop(); activate(i); });
    p.addEventListener('click', () => { stop(); activate(i); });
  });
  if (!reduceMotion) timer = setInterval(() => activate((active + 1) % panels.length), 5000);

  // Props drift against the scroll for a little depth.
  if (hasGsap && !reduceMotion) {
    document.querySelectorAll('.loot__gold, .rules__phone, .briefing__mask').forEach(el => {
      gsap.fromTo(el, { yPercent: 18 }, { yPercent: -18, ease: 'none', scrollTrigger: { trigger: el.closest('section'), start: 'top bottom', end: 'bottom top', scrub: true } });
    });
  }
}

if (hasGsap) {
  gsap.registerPlugin(ScrollTrigger);
  if (!reduceMotion) initBreakIn();
}
initSections();
