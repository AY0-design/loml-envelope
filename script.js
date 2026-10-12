(() => {
  const $ = (id) => document.getElementById(id);
  const scene = $('scene'), env = $('envelope'), letter = $('letter'), again = $('again');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) document.body.classList.add('reduce');

  letter.querySelectorAll('.l').forEach((el, i) => el.style.setProperty('--i', i));

  const fit = () => {
    const w = Math.min(1, (innerWidth - 32) / 340);
    scene.style.setProperty('--fit', w);
  };
  fit(); addEventListener('resize', fit);

  // Move the letter to the middle of the screen and enlarge it.
  const center = () => {
    const prev = letter.style.transform;
    letter.style.transition = 'none'; letter.style.transform = 'none';
    const r = letter.getBoundingClientRect();
    letter.style.transform = prev; void letter.offsetWidth; letter.style.transition = '';
    const vw = innerWidth, vh = innerHeight;
    const s = Math.min((vw * 0.94) / r.width, (vh * 0.9) / r.height, 1.5);
    const dx = vw / 2 - (r.left + r.width / 2);
    const dy = vh / 2 - (r.top + r.height / 2);
    letter.style.transform = `translate(${dx}px, ${dy}px) scale(${s})`;
  };

  let state = 'closed';
  const timers = [];
  const later = (fn, ms) => timers.push(setTimeout(fn, reduce ? 0 : ms));

  const open = () => {
    if (state !== 'closed') return;
    state = 'opening';
    scene.classList.add('opened');
    env.setAttribute('aria-label', 'Letter opened');
    env.classList.add('open');                       // 1. flap flips back
    later(() => env.classList.add('out'), 650);      // 2. letter slides straight up
    later(() => {                                    // 3. letter glides to centre, envelope drops away
      env.classList.add('reading', 'dropped');
      letter.classList.add('reading');
      document.body.classList.add('reading');
      center();
      state = 'reading';
      again.hidden = false;
    }, 1800);
  };

  const close = () => {
    if (state !== 'reading') return;
    state = 'closing';
    again.hidden = true;
    letter.style.transform = '';
    letter.classList.remove('reading');
    document.body.classList.remove('reading');
    env.classList.remove('reading', 'out', 'dropped');
    later(() => { env.classList.remove('open'); scene.classList.remove('opened'); state = 'closed'; }, 900);
  };

  env.addEventListener('click', open);
  env.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
  again.addEventListener('click', close);
  addEventListener('resize', () => { if (state === 'reading') center(); });
})();
