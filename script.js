(() => {
  const $ = (id) => document.getElementById(id);
  const scene = $('scene'), env = $('envelope'), letter = $('letter'), again = $('again');
  const heart = $('seal'), flap = $('flap'), shadow = $('shadow');
  const back = env.querySelector('.env-back'), front = env.querySelector('.env-front');
  const flapOut = flap.querySelector('.flap-out'), flapIn = flap.querySelector('.flap-in');
  const paper = letter.querySelector('.paper');

  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const OUT = 'cubic-bezier(0.23, 1, 0.32, 1)';
  const INOUT = 'cubic-bezier(0.77, 0, 0.175, 1)';
  const FALL = 'cubic-bezier(0.55, 0, 1, 0.45)';           // gravity: the only accelerating curve, for the falling heart

  const TILT = -4;                                          // degrees; keep in sync with `rotate` on .envelope in style.css
  const K0 = 0.38, KR = 360 / 520;                          // letter scale: inside the pocket / risen out of it
  const RISE_Y = -138;                                      // local px between those two poses
  const POSE = (x, y, deg, k) => `translate(${x}px, ${y}px) rotate(${deg}deg) scale(${k})`;
  const DROP = '0 55vh';
  const TOTAL = 2100;                                       // length of the whole opening, in ms

  // The opening is ONE timeline: every element gets a full-length track with its motion placed at the right
  // moments. Closing simply plays those same tracks backwards, so it is an exact mirror of the opening.
  const toKeyframes = (list) => {
    const f = list.map((k) => ({ ...k }));
    if (f[0].t > 0) f.unshift({ ...f[0], t: 0, easing: 'linear' });
    if (f[f.length - 1].t < TOTAL) f.push({ ...f[f.length - 1], t: TOTAL, easing: 'linear' });
    return f.map(({ t, easing, ...props }) => ({ ...props, offset: t / TOTAL, ...(easing ? { easing } : {}) }));
  };
  const track = (el, list) => el.animate(toKeyframes(list), { duration: reduce ? 1 : TOTAL, fill: 'both' });

  const all = [heart, flap, flapOut, flapIn, back, front, shadow, scene, letter, again];
  const clearAll = () => all.forEach((el) => el.getAnimations().forEach((a) => a.cancel()));
  const wait = (t) => new Promise((r) => setTimeout(r, reduce ? 0 : t));

  const fitValue = () => Math.min(1, (innerWidth - 48) / 400);
  const fit = () => scene.style.setProperty('--fit', fitValue());
  fit();

  // Where the letter should land, in the (tilted, scaled) envelope's local coordinates. Measured once per open.
  let lift = 0;
  const geometry = () => {
    const f = fitValue(), eh = 253.6, th = (TILT * Math.PI) / 180, c = Math.cos(th), s = Math.sin(th);
    const L = Math.round(109 * f);                          // push the scene down so the risen letter stays on screen
    const r = scene.getBoundingClientRect();
    const c0 = (128 - eh / 2) * f;                          // letter centre sits 128px below the envelope's top edge
    const cx = r.left + r.width / 2 - s * c0;
    const cy = r.top + r.height / 2 - lift + c * c0;
    const Dx = innerWidth / 2 - cx, Dy = innerHeight / 2 - cy - L;
    const k = Math.min((innerWidth * 0.94) / (520 * f), (innerHeight * 0.9) / (600 * f), 1);
    // undo the envelope's tilt so the landed letter is upright: local = Rot(-tilt) * screen / fit
    return { L, final: POSE((Dx * c + Dy * s) / f, (-Dx * s + Dy * c) / f, -TILT, k) };
  };

  const letterList = (final) => [
    { t: 600, transform: POSE(0, 0, 0, K0), easing: INOUT },                 // inside the pocket, aligned with the envelope
    { t: 1300, transform: POSE(0, RISE_Y, 0, KR) },                           // risen out along the envelope's own axis
    { t: 1400, transform: POSE(0, RISE_Y, 0, KR), easing: INOUT },            // a beat of rest
    { t: 2100, transform: final },                                            // glides to the centre and straightens up
  ];
  const sceneList = (L) => [
    { t: 120, translate: '0 0px', easing: OUT },
    { t: 920, translate: `0 ${L}px` },
  ];

  let state = 'closed', geo = null, tracks = null, letterTrack = null, sceneTrack = null;

  const open = async () => {
    if (state !== 'closed') return;
    state = 'opening';
    if (document.fonts && document.fonts.status !== 'loaded') await Promise.race([document.fonts.ready, wait(250)]);
    clearAll();
    geo = geometry(); lift = geo.L;
    scene.classList.add('opened'); env.classList.add('is-open');
    env.setAttribute('aria-label', 'Letter opened');

    tracks = [];
    const add = (a) => { tracks.push(a); return a; };

    // heart clip lets go: anticipation, pop, then it falls away (reversed on close: it flies back and clips on)
    add(track(heart, [
      { t: 0, transform: 'translate(-50%, -50%) scale(1) rotate(0deg)', opacity: 1, easing: OUT },
      { t: 144, transform: 'translate(-50%, -50%) scale(1.14) rotate(-8deg)', opacity: 1, easing: OUT },
      { t: 306, transform: 'translate(-50%, -78%) scale(1.08) rotate(7deg)', opacity: 1, easing: FALL },
      { t: 810, transform: 'translate(-50%, 240%) scale(.85) rotate(34deg)', opacity: 1 },
      { t: 900, transform: 'translate(-50%, 260%) scale(.8) rotate(38deg)', opacity: 0 },
    ]));

    // flap folds back on its hinge (scaleY: cheap and compositor-only), swapping to its inside face at the midpoint
    add(track(flap, [{ t: 200, transform: 'scaleY(1)', easing: INOUT }, { t: 850, transform: 'scaleY(-1)' }]));
    add(track(flap, [{ t: 200, zIndex: 6 }, { t: 499, zIndex: 6 }, { t: 505, zIndex: 1 }]));
    add(track(flapOut, [{ t: 200, opacity: 1 }, { t: 524, opacity: 1 }, { t: 526, opacity: 0 }]));
    add(track(flapIn, [{ t: 200, opacity: 0 }, { t: 524, opacity: 0 }, { t: 526, opacity: 1 }]));

    // scene settles lower so the risen letter has room above the envelope
    sceneTrack = add(track(scene, sceneList(geo.L)));

    // letter slides out and grows, rests a beat, then glides to the centre
    letterTrack = add(track(letter, letterList(geo.final)));

    // envelope slips away downward while the letter is gliding
    for (const el of [back, front, flap, shadow]) {
      add(track(el, [{ t: 1300, translate: '0 0', opacity: 1, easing: INOUT }, { t: 1820, translate: DROP, opacity: 0 }]));
    }

    await wait(TOTAL + 60);
    if (state !== 'opening') return;
    state = 'open';
    letter.classList.add('scroll');
    again.hidden = false;
    again.animate([{ opacity: 0 }, { opacity: 1 }], { duration: reduce ? 1 : 250, easing: OUT });
    again.focus({ preventScroll: true });
  };

  // Closing = the opening played backwards, track for track.
  const close = async () => {
    if (state !== 'open') return;
    state = 'closing';
    again.hidden = true;
    letter.classList.remove('scroll');
    paper.scrollTop = 0;
    tracks.forEach((a) => a.reverse());
    await wait(TOTAL + 60);
    clearAll();
    tracks = letterTrack = sceneTrack = null; lift = 0;
    scene.classList.remove('opened'); env.classList.remove('is-open');
    env.setAttribute('aria-label', 'Open the letter');
    state = 'closed';
  };

  env.addEventListener('click', open);
  env.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
  again.addEventListener('click', close);
  addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
  addEventListener('resize', () => {
    fit();
    if (state === 'open') {                                 // re-aim the landed letter without touching the rest of the timeline
      geo = geometry(); lift = geo.L;
      letterTrack.effect.setKeyframes(toKeyframes(letterList(geo.final)));
      sceneTrack.effect.setKeyframes(toKeyframes(sceneList(geo.L)));
    }
  });
})();
