window.__siteTheme = 'dark';

/* =========================================================
   WATER RIPPLE — follows the cursor continuously, full page
   ========================================================= */
(function(){
  /* pas de simulation si l'utilisateur préfère réduire les animations */
  if(window.matchMedia('(prefers-reduced-motion: reduce)').matches){
    window.__waterDrop = function(){};
    window.__waterRing = function(){};
    return;
  }

  const canvas = document.getElementById('water');
  const ctx = canvas.getContext('2d', { alpha: true });
  const low = document.createElement('canvas');
  const lctx = low.getContext('2d');

  const CELL = 9;
  let W, H, cols, rows, bufA, bufB, img;

  function resize(){
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = W;
    canvas.height = H;
    ctx.imageSmoothingEnabled = true; /* réglé ici : le canvas le réinitialise à chaque changement de taille */
    cols = Math.ceil(W / CELL) + 2;
    rows = Math.ceil(H / CELL) + 2;
    bufA = new Float32Array(cols * rows);
    bufB = new Float32Array(cols * rows);
    low.width = cols;
    low.height = rows;
    img = lctx.createImageData(cols, rows); /* allouée une fois, réutilisée à chaque frame */
  }
  resize();
  let resizeTimer = 0;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resize, 150); /* debounce : pas de réallocation pendant le drag */
  }, { passive:true });

  function dropAt(x, y, strength){
    const cx = Math.floor(x / CELL);
    const cy = Math.floor(y / CELL);
    const r = 2;
    for(let dy=-r; dy<=r; dy++){
      for(let dx=-r; dx<=r; dx++){
        const xi = cx+dx, yi = cy+dy;
        if(xi<1||xi>=cols-1||yi<1||yi>=rows-1) continue;
        const dist = Math.sqrt(dx*dx+dy*dy);
        if(dist>r) continue;
        bufA[yi*cols+xi] += strength * (1 - dist/r);
      }
    }
    wake();
  }

  let lastX = -1000, lastY = -1000, hasMouse = false;
  window.addEventListener('mousemove', (e) => {
    const x = e.clientX, y = e.clientY;
    if(!hasMouse){ lastX = x; lastY = y; hasMouse = true; return; }
    const dx = x - lastX, dy = y - lastY;
    const dist = Math.sqrt(dx*dx + dy*dy);
    const steps = Math.min(Math.max(Math.floor(dist / 6), 1), 8);
    const speed = Math.min(dist, 90);
    lastInput = performance.now();
    for(let i = 0; i < steps; i++){
      const t = i / steps;
      dropAt(lastX + dx*t, lastY + dy*t, 0.55 + speed * 0.012);
    }
    lastX = x; lastY = y;
  }, { passive:true });

  /* sur mobile, un tap envoie une goutte — l'effet signature reste tactile */
  window.addEventListener('touchstart', (e) => {
    const t = e.touches[0];
    if(t){ dropAt(t.clientX, t.clientY, 1.6); }
  }, { passive:true });

  /* suivi de l'activité réelle de l'utilisateur (pour la veille profonde) */
  let lastInput = performance.now();
  const noteInput = () => { lastInput = performance.now(); };
  window.addEventListener('scroll', noteInput, { passive:true });
  window.addEventListener('touchstart', noteInput, { passive:true });
  window.addEventListener('keydown', noteInput, { passive:true });

  /* gouttes ambiantes uniquement avec un pointeur fin (souris/trackpad) :
     sur tactile il n'y a pas de curseur à animer, et cet intervalle est la
     seule chose qui relancerait la simulation plein écran en continu —
     on laisse donc l'eau se rendormir après un tap (économie de batterie) */
  if(window.matchMedia('(pointer: fine)').matches){
    setInterval(() => {
      if(document.hidden) return;                              /* onglet en arrière-plan */
      if(performance.now() - lastInput > 45000) return;        /* utilisateur parti : silence */
      if(Math.random() < 0.5){
        dropAt(Math.random()*W, Math.random()*H, 0.4);
      }
    }, 1400);
  }

  const damping = 0.985;

  function step(){
    for(let y = 1; y < rows-1; y++){
      const row = y * cols;
      for(let x = 1; x < cols-1; x++){
        const i = row + x;
        bufB[i] = (bufA[i-1] + bufA[i+1] + bufA[i-cols] + bufA[i+cols]) / 2 - bufB[i];
        bufB[i] *= damping;
      }
    }
    const tmp = bufA; bufA = bufB; bufB = tmp;
  }

  function render(){
    const isLight = window.__siteTheme === 'light';
    const data = img.data;
    const buf = bufA;
    for(let y = 1; y < rows-1; y++){
      const row = y * cols;
      for(let x = 1; x < cols-1; x++){
        const i = row + x;
        const dx = buf[i+1] - buf[i-1];
        const dy = buf[i+cols] - buf[i-cols];
        const sum = (dx < 0 ? -dx : dx) + (dy < 0 ? -dy : dy); /* |dx|+|dy| une seule fois */
        const p = i * 4;
        if(isLight){
          /* bleu océan profond (proche de l'accent #2f5a7d), bien plus contrasté sur fond clair */
          const inten = sum > 13 ? 1 : sum / 13;
          data[p]   = 255 - inten * 205;
          data[p+1] = 255 - inten * 160;
          data[p+2] = 255 - inten * 105;
          data[p+3] = sum * 17 > 255 ? 255 : sum * 17;
        } else {
          const light = Math.max(0, dx - dy) * 16;
          data[p]   = 20 + light * 0.25;
          data[p+1] = 50 + light * 0.45;
          data[p+2] = 120 + light * 0.85;
          data[p+3] = sum * 10 > 255 ? 255 : sum * 10;
        }
      }
    }
    lctx.putImageData(img, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(low, 0, 0, cols, rows, 0, 0, W, H);
  }

  let running = false;
  let lastDrop = performance.now();

  /* borne le calcul à ~60 fps : sur un écran 120 Hz l'eau tournait 2× trop
     vite pour rien (12 ms tolère la gigue d'un vrai 60 Hz, sans le brider) */
  const FRAME_MS = 12;
  let lastFrame = 0;

  function loop(now){
    /* eau calme depuis 6 s (amortissement à 0.985 → ondes invisibles) : on dort */
    if(now - lastDrop > 6000){
      running = false;
      bufA.fill(0); bufB.fill(0);
      ctx.clearRect(0, 0, W, H);
      return;
    }
    requestAnimationFrame(loop);
    if(now - lastFrame < FRAME_MS) return; /* frame trop rapprochée : on la saute */
    lastFrame = now;
    step();
    render();
  }

  function wake(){
    lastDrop = performance.now();
    if(!running){
      running = true;
      requestAnimationFrame(loop);
    }
  }
  wake();

  /* let the rest of the page send ripples into the water */
  window.__waterDrop = function(x, y, strength){
    dropAt(x, y, strength == null ? 1.4 : strength);
  };
  /* a ring of drops — used for the intro splash + theme change */
  window.__waterRing = function(x, y, strength){
    dropAt(x, y, strength);
    const n = 10, rad = 26;
    for(let i = 0; i < n; i++){
      const a = (i / n) * Math.PI * 2;
      dropAt(x + Math.cos(a) * rad, y + Math.sin(a) * rad, strength * 0.7);
    }
  };
})();

/* =========================================================
   INTRO SEQUENCE
   ========================================================= */
const words = ["Concevoir,", "Développer,", "Livrer."];
const loaderText = document.getElementById('loader-text');
const dot = document.getElementById('dot');
const reveal = document.getElementById('reveal');
const hero = document.getElementById('hero');
const loader = document.getElementById('loader');
const themeToggle = document.getElementById('themeToggle');
const waterCanvas = document.getElementById('water');
const animSwitch = document.getElementById('animSwitch');

themeToggle.addEventListener('click', () => {
  const next = window.__siteTheme === 'dark' ? 'light' : 'dark';
  window.__siteTheme = next;
  document.documentElement.setAttribute('data-theme', next);
  themeToggle.setAttribute('aria-pressed', next === 'light' ? 'true' : 'false');
  themeToggle.setAttribute('aria-label', next === 'light' ? 'Passer en mode sombre' : 'Passer en mode clair');
  waterCanvas.style.mixBlendMode = next === 'light' ? 'multiply' : 'screen';
  /* the change ripples out from the toggle, through the water motif */
  const r = themeToggle.getBoundingClientRect();
  if(window.__waterRing){ window.__waterRing(r.left + r.width/2, r.top + r.height/2, 2.4); }
});

/* =========================================================
   ANIM PROFILE SWITCHER — Onde (water-forward) vs Souffle (calm)
   ========================================================= */
(function(){
  if(!animSwitch) return;
  const btns = animSwitch.querySelectorAll('button');
  btns.forEach(btn => {
    btn.addEventListener('click', () => {
      const profile = btn.getAttribute('data-anim-profile');
      document.documentElement.setAttribute('data-anim', profile);
      btns.forEach(b => b.setAttribute('aria-pressed', b === btn ? 'true' : 'false'));
      /* a small confirming ripple under the switch */
      const r = btn.getBoundingClientRect();
      if(window.__waterRing){ window.__waterRing(r.left + r.width/2, r.top + r.height/2, 1.6); }
    });
  });
})();

words.forEach(w => {
  const span = document.createElement('span');
  span.textContent = w;
  loaderText.appendChild(span);
});
const spans = loaderText.querySelectorAll('span');

const ring = document.getElementById('ring');

let t = 200;
spans.forEach((s) => {
  setTimeout(() => s.classList.add('show'), t);
  t += 420;
});

t += 440;
setTimeout(() => loaderText.classList.add('collapse'), t);

t += 320;
setTimeout(() => dot.classList.add('show', 'pulse'), t);

t += 620;
setTimeout(() => {
  dot.classList.remove('pulse');
  reveal.classList.add('grow');
  if(ring){ ring.classList.add('go'); }
  loader.style.display = 'none';
  /* le cercle plonge dans l'eau — double éclaboussure au centre */
  if(window.__waterRing){
    window.__waterRing(window.innerWidth/2, window.innerHeight/2, 3.0);
    setTimeout(() => window.__waterRing(window.innerWidth/2, window.innerHeight/2, 1.6), 240);
  }
}, t);

const curtain1 = document.getElementById('curtain1');
const curtain2 = document.getElementById('curtain2');

t += 1150;
setTimeout(() => {
  /* l'écran est couvert par l'aplat bleu : on remplace le cercle
     par les rideaux de marée, sans que ça se voie (même couleur) */
  curtain1.classList.add('on');
  curtain2.classList.add('on');
  reveal.style.display = 'none';
  dot.style.display = 'none';

  hero.classList.add('show');
  themeToggle.classList.add('show');
  if(animSwitch){ animSwitch.classList.add('show'); }

  /* la marée se retire : couche accent d'abord, couche claire ensuite */
  requestAnimationFrame(() => {
    setTimeout(() => curtain1.classList.add('up'), 120);
    setTimeout(() => curtain2.classList.add('up'), 480);
  });

  /* éclaboussures dans l'eau au passage du bord de vague */
  if(window.__waterRing){
    setTimeout(() => {
      [0.22, 0.5, 0.78].forEach((fx, i) => {
        setTimeout(() => window.__waterRing(window.innerWidth * fx, window.innerHeight * 0.35, 1.6), i * 130);
      });
    }, 950);
  }

  setTimeout(() => {
    curtain1.style.display = 'none';
    curtain2.style.display = 'none';
  }, 2400);
}, t);

/* =========================================================
   TOPBAR + SCROLL PROGRESS — nav verre après le hero,
   filet de progression en haut de page
   ========================================================= */
(function(){
  const topbar = document.getElementById('topbar');
  const progress = document.getElementById('scrollProgress');
  if(!topbar || !progress) return;
  let ticking = false;
  function update(){
    ticking = false;
    const sy = window.scrollY;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    progress.style.transform = 'scaleX(' + (max > 0 ? Math.min(1, sy / max) : 0) + ')';
    topbar.classList.toggle('show', sy > window.innerHeight * 0.85);
  }
  window.addEventListener('scroll', () => {
    if(!ticking){ ticking = true; requestAnimationFrame(update); }
  }, { passive:true });
  window.addEventListener('resize', update, { passive:true });
  update();
})();

/* =========================================================
   PROJECT LAPTOP — mini-render of the site on a MacBook,
   with a lid you can fold closed
   ========================================================= */
(function(){
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const icClose = '<svg class="ic-close" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="6" y1="6" x2="18" y2="18"></line><line x1="18" y1="6" x2="6" y2="18"></line></svg>';
  const icOpen  = '<svg class="ic-open" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="5" width="16" height="11" rx="1.4"></rect><line x1="2.4" y1="20" x2="21.6" y2="20"></line></svg>';

  document.querySelectorAll('.project-card').forEach(card => {
    const thumb = card.querySelector('.project-thumb');
    if(!thumb) return;
    const h3 = card.querySelector('.project-body h3');
    const title = h3 ? h3.textContent.trim() : 'Massyl Hamdi';

    /* écran : image du projet si fournie via data-thumb, sinon mini-rendu du site */
    const thumbSrc = card.dataset.thumb || '';
    const screen = thumbSrc
      ? '<img class="mini-img" src="' + thumbSrc + '" alt="Aperçu du projet — ' + title + '" loading="lazy" decoding="async">'
      : '<div class="mini">' +
          '<div class="mini-nav"><b>ME CONTACTER</b><span>GitHub · LinkedIn</span></div>' +
          '<div class="mini-title">' + title + '</div>' +
          '<div class="mini-foot"><span>Ingénieur Python, disponible immédiatement.</span><span>Vision &amp; embarqué.</span></div>' +
        '</div>';

    const laptop = document.createElement('div');
    laptop.className = 'laptop';
    laptop.dataset.open = 'true';
    laptop.innerHTML =
      '<div class="laptop-lid">' +
        '<div class="lid-face">' + screen + '</div>' +
        '<div class="lid-back"></div>' +
      '</div>' +
      '<div class="laptop-deck"></div>';
    thumb.insertBefore(laptop, thumb.firstChild);

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'lid-toggle';
    btn.setAttribute('aria-label', 'Fermer le portable');
    btn.setAttribute('aria-pressed', 'false');
    btn.innerHTML = icClose + icOpen;
    thumb.appendChild(btn);

    function toggleLid(sourceEl){
      const isOpen = laptop.dataset.open === 'true';
      laptop.dataset.open = isOpen ? 'false' : 'true';
      btn.classList.toggle('closed', isOpen);
      btn.setAttribute('aria-pressed', isOpen ? 'true' : 'false');
      btn.setAttribute('aria-label', isOpen ? 'Ouvrir le portable' : 'Fermer le portable');
      laptop.setAttribute('aria-label', isOpen ? 'Ouvrir le portable' : 'Fermer le portable');
      if(!reduce && window.__waterDrop){
        const r = (sourceEl || btn).getBoundingClientRect();
        window.__waterDrop(r.left + r.width/2, r.top + r.height/2, 1.3);
      }
    }

    btn.addEventListener('click', () => toggleLid(btn));

    /* clic direct sur l'ordinateur pour l'ouvrir / le fermer */
    laptop.setAttribute('role', 'button');
    laptop.setAttribute('tabindex', '0');
    laptop.setAttribute('aria-label', 'Fermer le portable');
    laptop.addEventListener('click', () => toggleLid(laptop));
    laptop.addEventListener('keydown', (e) => {
      if(e.key === 'Enter' || e.key === ' '){
        e.preventDefault();
        toggleLid(laptop);
      }
    });
  });
})();

/* =========================================================
   CARD RIPPLE — spawns a water ripple where the cursor
   enters/moves over a card, echoing the page-wide effect
   ========================================================= */
(function(){
  function spawnRipple(card, x, y){
    const rect = card.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height) * 0.9;
    const span = document.createElement('span');
    span.className = 'ripple';
    span.style.width = size + 'px';
    span.style.height = size + 'px';
    span.style.left = x + 'px';
    span.style.top = y + 'px';
    card.appendChild(span);
    span.addEventListener('animationend', () => span.remove());
  }

  const cards = document.querySelectorAll('.testi-card, .stack-group');
  cards.forEach(card => {
    let last = 0;
    card.addEventListener('mouseenter', (e) => {
      const rect = card.getBoundingClientRect();
      spawnRipple(card, e.clientX - rect.left, e.clientY - rect.top);
      last = performance.now();
    });
    card.addEventListener('mousemove', (e) => {
      const now = performance.now();
      if(now - last < 340) return;
      last = now;
      const rect = card.getBoundingClientRect();
      spawnRipple(card, e.clientX - rect.left, e.clientY - rect.top);
    });
  });
})();

/* =========================================================
   SCROLL REVEAL
   ========================================================= */
(function(){
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const items = document.querySelectorAll('.reveal');
  /* stagger items that share a section row, reset the counter per section */
  let group = null, gi = 0;
  items.forEach((el) => {
    const sec = el.closest('section, footer, .work-stack') || document.body;
    if(sec !== group){ group = sec; gi = 0; }
    el.style.setProperty('--reveal-i', gi % 5);
    gi++;
  });
  const io = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if(entry.isIntersecting){
        entry.target.classList.add('in-view');
        /* each block surfacing nudges the water, tying scroll to the motif */
        if(!reduce && window.__waterDrop){
          const r = entry.target.getBoundingClientRect();
          window.__waterDrop(r.left + Math.min(r.width, 120), r.top + 20, 1.1);
        }
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15, rootMargin: '0px 0px -8% 0px' });
  items.forEach(el => io.observe(el));
})();

/* =========================================================
   PROJECT STACK DEPTH — cards settle back as the next overlaps
   ========================================================= */
(function(){
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(reduce) return;
  const cards = Array.from(document.querySelectorAll('.project-card'));
  if(!cards.length) return;
  const STICK = 90;          /* matches CSS top:90px */
  let ticking = false;

  function update(){
    ticking = false;
    /* phase 1 : toutes les lectures (un seul layout), phase 2 : toutes les écritures */
    const rects = cards.map(c => c.getBoundingClientRect());
    for(let i = 0; i < cards.length; i++){
      const card = cards[i];
      let depth = 0;
      if(i + 1 < cards.length){
        const overlap = rects[i].bottom - rects[i + 1].top;
        depth = Math.max(0, Math.min(1, overlap / (rects[i].height * 0.9)));
      }
      const scale = 1 - depth * 0.05;
      const dim   = 1 - depth * 0.45;
      const blur  = depth * 2.5;
      card.style.transform = 'scale(' + scale.toFixed(4) + ')';
      card.style.opacity = (0.55 + dim * 0.45).toFixed(3);
      card.style.filter = blur > 0.05 ? 'blur(' + blur.toFixed(2) + 'px)' : 'none';
    }
  }
  window.addEventListener('scroll', () => {
    if(!ticking){ ticking = true; requestAnimationFrame(update); }
  }, { passive:true });
  window.addEventListener('resize', update, { passive:true });
  update();
})();

/* =========================================================
   SHARED-ELEMENT PHOTO MORPH — the hero avatar detaches and
   flies / reshapes into the About portrait as you scroll
   ========================================================= */
(function(){
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const avatar      = document.querySelector('.avatar');
  const avatarImg   = avatar && avatar.querySelector('img');
  const status      = avatar && avatar.querySelector('.avatar-status');
  const portrait    = document.querySelector('.about-portrait');
  const frame       = portrait && portrait.querySelector('.frame');
  const portraitImg = frame && frame.querySelector('img');
  const cap         = frame && frame.querySelector('figcaption');
  const about       = document.getElementById('about');
  if(reduce || !avatar || !frame || !about) return;

  const STICK = 96; // must match .about-portrait top

  // flying clone
  const morph = document.createElement('div');
  morph.setAttribute('aria-hidden', 'true');
  morph.style.cssText =
    'position:fixed; z-index:60; pointer-events:none; display:none;' +
    'background-image:url("assets/portrait.jpg"); background-size:cover;' +
    'border:1px solid rgba(236,231,221,0.16);' +
    'box-shadow:0 30px 70px rgba(0,0,0,0.42); overflow:hidden; will-change:top,left,width,height;';
  document.body.appendChild(morph);

  const lerp = (a,b,t) => a + (b - a) * t;
  const ease = t => t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t+2,3)/2; // easeInOutCubic

  let geom = null, S1 = 1, ticking = false;
  function measure(){
    const sy = window.scrollY;
    const a = avatar.getBoundingClientRect();
    const f = frame.getBoundingClientRect();
    const aTop = a.top + sy;            // avatar's on-screen top when at page top
    const fDocTop = f.top + sy;         // portrait's document top (layout-stable)
    // scroll at which the portrait reaches its resting (sticky) position
    S1 = Math.max(1, fDocTop - STICK);
    geom = {
      start: { top:aTop, left:a.left, w:a.width, h:a.height, r:22 },
      // horizontal + size of the destination are layout-stable; vertical is read live
      endX:  { left:f.left, w:f.width, h:f.height, r:20 },
      fDocTop: fDocTop
    };
  }

  let active = null; // 'avatar' | 'portrait' | null(flying)
  function setEndpoint(state){
    if(active === state) return;
    active = state;
    morph.style.display = 'none';
    if(state === 'avatar'){
      avatarImg.style.visibility = '';
      if(status) status.style.opacity = '';
      portraitImg.style.visibility = '';
      if(cap) cap.style.opacity = '';
    } else { // portrait
      avatarImg.style.visibility = 'hidden';
      if(status) status.style.opacity = '0';
      portraitImg.style.visibility = '';
      if(cap) cap.style.opacity = '';
    }
  }

  function update(){
    ticking = false;
    if(!geom) measure(); /* géométrie stable : mesurée une fois, invalidée au resize */
    const sy = window.scrollY;
    const p = Math.min(1, Math.max(0, sy / S1));

    if(p <= 0.001){ setEndpoint('avatar'); return; }
    if(p >= 0.999){ setEndpoint('portrait'); return; }

    // in flight — only the clone is visible
    active = null;
    avatarImg.style.visibility = 'hidden';
    if(status) status.style.opacity = String(Math.max(0, 1 - p * 4));
    portraitImg.style.visibility = 'hidden';
    if(cap) cap.style.opacity = String(Math.max(0, (p - 0.72) / 0.28));

    const e = ease(p);
    const s = geom.start, ex = geom.endX;
    const endTop = geom.fDocTop - sy;          // portrait's LIVE viewport top (rising from below)
    morph.style.display = 'block';
    morph.style.top    = lerp(s.top, endTop, e) + 'px';
    morph.style.left   = lerp(s.left, ex.left, e) + 'px';
    morph.style.width  = lerp(s.w, ex.w, e) + 'px';
    morph.style.height = lerp(s.h, ex.h, e) + 'px';
    morph.style.borderRadius = lerp(s.r, ex.r, e) + 'px';
    morph.style.backgroundPosition = 'center ' + lerp(30, 50, e) + '%';
  }

  function remeasure(){ geom = null; update(); }
  window.addEventListener('scroll', () => {
    if(!ticking){ ticking = true; requestAnimationFrame(update); }
  }, { passive:true });
  window.addEventListener('resize', remeasure, { passive:true });
  if(portraitImg && !portraitImg.complete){ portraitImg.addEventListener('load', remeasure); }
  // measure once the intro has settled the hero into place
  setTimeout(remeasure, 2600);
})();
