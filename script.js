(() => {
  const $ = (id) => document.getElementById(id);
  const scene = $('scene'), env = $('envelope'), letter = $('letter'), again = $('again');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) document.body.classList.add('reduce');

  letter.querySelectorAll('.l').forEach((el, i) => el.style.setProperty('--i', i));

  const fit = () => {
    const w = Math.min(1, (innerWidth - 32) / 400);
    scene.style.setProperty('--fit', w);
  };
  fit(); addEventListener('resize', fit);

  // Move the letter to the middle of the screen and enlarge it.
  const center = () => {
    const prev = letter.style.transform;
    letter.style.transition = 'none'; letter.style.transform = 'none';
    const r = letter.getBoundingClientRect();
    letter.style.transform = prev; void letter.offsetWidth; letter.style.transition = '';
    letter.style.removeProperty('transform');
    const vw = innerWidth, vh = innerHeight;
    const s = Math.min((vw * 0.94) / r.width, (vh * 0.9) / r.height, 1.5);
    const dx = vw / 2 - (r.left + r.width / 2);
    const dy = vh / 2 - (r.top + r.height / 2);
    letter.style.transform = `translate(${dx}px, ${dy}px) scale(${s})`;
  };

  let state = 'closed';
  const timers = [];
  const later = (fn, ms) => timers.push(setTimeout(fn, reduce ? 0 : ms));

  const clip = $('clip');
  const open = () => {
    if (state !== 'closed') return;
    state = 'opening';
    scene.classList.add('opened');
    env.setAttribute('aria-label', 'Letter opened');
    env.classList.add('open');                                  // 1. heart clip drops, flap swings open
    later(() => letter.classList.add('rise'), 650);             // 2. letter slides straight up out of the pocket
    later(() => env.classList.add('dropped'), 2000);            // 3. envelope slides away, letter hangs behind it
    later(() => {                                               // 4. letter glides forward to the centre of the screen
      clip.classList.add('free');
      letter.classList.remove('rise');
      letter.classList.add('glide', 'reading');
      document.body.classList.add('reading');
      center();
      state = 'reading';
      again.hidden = false;
    }, 2300);
  };

  const close = () => {
    if (state !== 'reading') return;
    state = 'closing';
    again.hidden = true;
    document.body.classList.remove('reading');
    env.classList.remove('dropped');                            // envelope returns
    letter.classList.add('rise');                               // letter glides back above the pocket
    letter.style.transform = '';
    later(() => {
      clip.classList.remove('free', 'front');
      letter.classList.remove('glide', 'reading');
      letter.classList.remove('rise');                          // slides back down inside
      later(() => { env.classList.remove('open'); scene.classList.remove('opened'); state = 'closed'; }, 700);
    }, 1200);
  };

  env.addEventListener('click', open);
  env.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
  again.addEventListener('click', close);
  addEventListener('resize', () => { if (state === 'reading') center(); });
})();
