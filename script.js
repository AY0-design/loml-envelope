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

  // Letter poses. The letter is authored at reading size; K0 shrinks it to fit inside the envelope.
  const K0 = 0.38, KR = 360 / 520;                         // inside the pocket / risen out of it
  const RISE_Y = -138;                                     // local px between those two poses
  const POSE = (x, y, k) => `translate(${x}px, ${y}px) scale(${k})`;
  const DROP = '0 55vh';

  const els = [heart, flap, flapOut, flapIn, back, front, shadow, scene, letter, again];
  const ms = (t) => (reduce ? 0 : t);
  const play = (el, keyframes, { duration, delay = 0, easing = 'linear' }) =>
    el.animate(keyframes, { duration: ms(duration), delay: ms(delay), easing, fill: 'both' });
  const wait = (t) => new Promise((r) => setTimeout(r, ms(t)));
  const clearAll = () => els.forEach((el) => el.getAnimations().forEach((a) => a.cancel()));

  const fitValue = () => Math.min(1, (innerWidth - 32) / 400);
  const fit = () => scene.style.setProperty('--fit', fitValue());
  fit();

  // Where the letter should end up, in the scene's local coordinates. Measured once, never mid-animation.
  let lift = 0;
  const geometry = () => {
    const f = fitValue(), eh = 253.6;
    const L = Math.round(109 * f);                         // push the scene down so the risen letter stays on screen
    const r = scene.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2 - lift + (128 - eh / 2) * f;   // letter's natural centre, unlifted
    const s = Math.min((innerWidth * 0.94) / (520 * f), (innerHeight * 0.9) / (600 * f), 1);
    return { L, final: POSE((innerWidth / 2 - cx) / f, (innerHeight / 2 - cy - L) / f, s) };
  };

  let state = 'closed', geo = null;

  const open = async () => {
    if (state !== 'closed') return;
    state = 'opening';
    if (document.fonts && document.fonts.status !== 'loaded') await Promise.race([document.fonts.ready, wait(250)]);
    clearAll();
    geo = geometry(); lift = geo.L;
    scene.classList.add('opened'); env.classList.add('is-open');
    env.setAttribute('aria-label', 'Letter opened');

    // 1. the heart clip lets go: a small anticipation, a pop, then it falls away
    play(heart, [
      { transform: 'translate(-50%, -50%) scale(1) rotate(0deg)', opacity: 1, offset: 0, easing: OUT },
      { transform: 'translate(-50%, -50%) scale(1.14) rotate(-8deg)', opacity: 1, offset: 0.16, easing: OUT },
      { transform: 'translate(-50%, -78%) scale(1.08) rotate(7deg)', opacity: 1, offset: 0.34, easing: FALL },
      { transform: 'translate(-50%, 240%) scale(.85) rotate(34deg)', opacity: 1, offset: 0.9 },
      { transform: 'translate(-50%, 260%) scale(.8) rotate(38deg)', opacity: 0, offset: 1 },
    ], { duration: 900 });

    // 2. flap folds back on its hinge (scaleY, not a 3D flip: cheap and compositor-only)
    play(flap, [{ transform: 'scaleY(1)' }, { transform: 'scaleY(-1)' }], { duration: 650, delay: 200, easing: INOUT });
    play(flap, [{ zIndex: 6, offset: 0 }, { zIndex: 6, offset: 0.46 }, { zIndex: 1, offset: 0.47 }, { zIndex: 1, offset: 1 }], { duration: 650, delay: 200 });
    play(flapOut, [{ opacity: 1, offset: 0 }, { opacity: 1, offset: 0.49 }, { opacity: 0, offset: 0.5 }, { opacity: 0, offset: 1 }], { duration: 650, delay: 200 });
    play(flapIn,  [{ opacity: 0, offset: 0 }, { opacity: 0, offset: 0.49 }, { opacity: 1, offset: 0.5 }, { opacity: 1, offset: 1 }], { duration: 650, delay: 200 });

    // 3. scene settles lower so the risen letter has room above the envelope
    play(scene, [{ translate: '0 0px' }, { translate: `0 ${geo.L}px` }], { duration: 800, delay: 120, easing: OUT });

    // 4. letter slides up and grows as it comes out (mirror of the way back), rests a beat, then glides to the centre
    const T = 700 + 100 + 700;
    play(letter, [
      { transform: POSE(0, 0, K0), offset: 0, easing: INOUT },
      { transform: POSE(0, RISE_Y, KR), offset: 700 / T },
      { transform: POSE(0, RISE_Y, KR), offset: 800 / T, easing: INOUT },
      { transform: geo.final, offset: 1 },
    ], { duration: T, delay: 600 });

    // 5. envelope slips away downward while the letter is gliding
    for (const el of [back, front, flap, shadow]) {
      play(el, [{ translate: '0 0', opacity: 1 }, { translate: DROP, opacity: 0 }], { duration: 520, delay: 1300, easing: INOUT });
    }


    await wait(600 + T + 150);
    if (state !== 'opening') return;
    state = 'open';
    letter.classList.add('scroll');
    again.hidden = false;
    play(again, [{ opacity: 0 }, { opacity: 1 }], { duration: 250, easing: OUT });
    again.focus({ preventScroll: true });
  };

  const close = async () => {
    if (state !== 'open') return;
    state = 'closing';
    again.hidden = true;
    letter.classList.remove('scroll');
    paper.scrollTop = 0;


    // letter lifts back above the pocket, envelope returns, letter slides home, flap closes, heart clips back on
    play(letter, [{ transform: geo.final }, { transform: POSE(0, RISE_Y, KR) }], { duration: 600, easing: INOUT });
    for (const el of [back, front, flap, shadow]) {
      play(el, [{ translate: DROP, opacity: 0 }, { translate: '0 0', opacity: 1 }], { duration: 520, delay: 450, easing: OUT });
    }
    play(letter, [{ transform: POSE(0, RISE_Y, KR) }, { transform: POSE(0, 0, K0) }], { duration: 600, delay: 1000, easing: INOUT });
    play(flap, [{ transform: 'scaleY(-1)' }, { transform: 'scaleY(1)' }], { duration: 600, delay: 1250, easing: INOUT });
    play(flap, [{ zIndex: 1, offset: 0 }, { zIndex: 1, offset: 0.46 }, { zIndex: 6, offset: 0.47 }, { zIndex: 6, offset: 1 }], { duration: 600, delay: 1250 });
    play(flapOut, [{ opacity: 0, offset: 0 }, { opacity: 0, offset: 0.49 }, { opacity: 1, offset: 0.5 }, { opacity: 1, offset: 1 }], { duration: 600, delay: 1250 });
    play(flapIn,  [{ opacity: 1, offset: 0 }, { opacity: 1, offset: 0.49 }, { opacity: 0, offset: 0.5 }, { opacity: 0, offset: 1 }], { duration: 600, delay: 1250 });
    play(scene, [{ translate: `0 ${geo.L}px` }, { translate: '0 0px' }], { duration: 700, delay: 1500, easing: INOUT });
    play(heart, [
      { transform: 'translate(-50%, -50%) scale(.5)', opacity: 0, offset: 0 },
      { transform: 'translate(-50%, -50%) scale(1.14)', opacity: 1, offset: 0.6 },
      { transform: 'translate(-50%, -50%) scale(1)', opacity: 1, offset: 1 },
    ], { duration: 380, delay: 1800, easing: OUT });

    await wait(2250);
    clearAll();
    letter.style.removeProperty('transform');
    lift = 0;
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
    if (state === 'open') {                                // re-centre the landed letter
      geo = geometry(); lift = geo.L;
      letter.getAnimations().forEach((a) => a.cancel());
      letter.style.transform = geo.final;
    }
  });
})();
