/* ==========================================================================
   Cabinet Chakouri Lawyers Firm — interactions et animations
   ========================================================================== */
(function () {
  'use strict';

  var doc = document.documentElement;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  /* Textes produits par le script, dans la langue de la page */
  var LANG = (document.documentElement.lang || 'fr').slice(0, 2);
  var STR = {
    en: { 'Fermer le menu': 'Close menu', 'Ouvrir le menu': 'Open menu', 'Vidéo': 'Video',
          'Domaines précédents': 'Previous areas of practice', 'Domaines suivants': 'Next areas of practice' },
    es: { 'Fermer le menu': 'Cerrar el menú', 'Ouvrir le menu': 'Abrir el menú', 'Vidéo': 'Vídeo',
          'Domaines précédents': 'Áreas anteriores', 'Domaines suivants': 'Áreas siguientes' },
    ar: { 'Fermer le menu': 'إغلاق القائمة', 'Ouvrir le menu': 'فتح القائمة', 'Vidéo': 'فيديو',
          'Domaines précédents': 'المجالات السابقة', 'Domaines suivants': 'المجالات التالية' }
  };
  function t(s) { return (STR[LANG] && STR[LANG][s]) || s; }
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function safe(fn) { try { return fn(); } catch (err) { if (window.console) console.warn(err); } }

  /* ------------------------------------------------------------------------
     Découpage des titres en mots (animation mot par mot)
     ------------------------------------------------------------------------ */
  function splitWords(el) {
    if (el.dataset.splitDone) return;
    var i = 0;
    (function walk(node) {
      Array.prototype.slice.call(node.childNodes).forEach(function (child) {
        if (child.nodeType === 3) {
          var parts = child.textContent.split(/([ \t\n\r]+)/);
          var frag = document.createDocumentFragment();
          parts.forEach(function (part) {
            if (!part) return;
            if (/^[ \t\n\r]+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
            var w = document.createElement('span');
            var inner = document.createElement('span');
            w.className = 'w';
            inner.textContent = part;
            inner.style.setProperty('--i', i++);
            w.appendChild(inner);
            frag.appendChild(w);
          });
          node.replaceChild(frag, child);
        } else if (child.nodeType === 1 && child.tagName !== 'BR') {
          walk(child);
        }
      });
    })(el);
    el.dataset.splitDone = '1';
  }

  /* ------------------------------------------------------------------------
     Apparitions au défilement
     ------------------------------------------------------------------------ */
  function countUp(el) {
    var target = parseInt(el.getAttribute('data-count'), 10);
    if (!target || reduce) return;
    var duration = 2000;
    var start = performance.now();
    el.textContent = '0';
    (function tick(now) {
      var t = Math.min(1, (now - start) / duration);
      var eased = t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
      el.textContent = String(Math.round(target * eased));
      if (t < 1) requestAnimationFrame(tick);
    })(start);
  }

  function initReveal() {
    var targets = $$('[data-reveal], [data-split=""], [data-rule], [data-count]');
    if (reduce || !('IntersectionObserver' in window)) {
      targets.forEach(function (el) { el.classList.add('is-in'); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      var n = 0;
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var el = entry.target;
        if (el.hasAttribute('data-delay')) {
          el.style.setProperty('--d', el.getAttribute('data-delay') + 'ms');
        } else if (!el.style.getPropertyValue('--d')) {
          el.style.setProperty('--d', Math.min(n, 7) * 90 + 'ms');
          n++;
        }
        el.classList.add('is-in');
        if (el.hasAttribute('data-count')) countUp(el);
        io.unobserve(el);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0 });
    targets.forEach(function (el) { io.observe(el); });
  }

  /* ------------------------------------------------------------------------
     En-tête, progression, parallaxe, remplissage de texte (une seule boucle)
     ------------------------------------------------------------------------ */
  var header = $('[data-header]');
  var progressBar = $('.progress span');
  var toTop = $('.to-top');
  var parallaxEls = reduce ? [] : $$('[data-parallax]');
  var fills = $$('[data-split="fill"]');
  var ticking = false;
  var menuOpen = false;
  var headerHidden = false;
  var anchorY = window.scrollY;

  function setHeaderHidden(hidden) {
    if (!header || hidden === headerHidden) return;
    headerHidden = hidden;
    header.classList.toggle('is-hidden', hidden);
    doc.classList.toggle('header-hidden', hidden);
  }

  function headerLogic(y) {
    if (!header) return;
    header.classList.toggle('is-scrolled', y > 8);
    if (menuOpen || header.contains(document.activeElement)) { setHeaderHidden(false); anchorY = y; return; }
    if (y < 320) { setHeaderHidden(false); anchorY = y; return; }
    if (!headerHidden) {
      if (y < anchorY) anchorY = y;
      else if (y - anchorY > 48) { setHeaderHidden(true); anchorY = y; }
    } else {
      if (y > anchorY) anchorY = y;
      else if (anchorY - y > 24) { setHeaderHidden(false); anchorY = y; }
    }
  }

  function update() {
    ticking = false;
    var y = window.scrollY;
    var vh = window.innerHeight;
    var max = Math.max(1, doc.scrollHeight - vh);
    var p = Math.min(1, Math.max(0, y / max)).toFixed(4);

    if (progressBar) progressBar.style.setProperty('--p', p);
    if (toTop) {
      toTop.style.setProperty('--p', p);
      toTop.classList.toggle('is-visible', y > vh * 0.8);
    }
    headerLogic(y);

    parallaxEls.forEach(function (el) {
      var box = el.parentElement.getBoundingClientRect();
      if (box.bottom < -80 || box.top > vh + 80) return;
      var speed = parseFloat(el.getAttribute('data-parallax')) || 0.08;
      var offset = (box.top + box.height / 2 - vh / 2) * -speed;
      var limit = box.height * 0.07;
      offset = Math.max(-limit, Math.min(limit, offset));
      el.style.transform = 'translate3d(0,' + offset.toFixed(1) + 'px,0)';
    });

    fills.forEach(function (el) {
      var r = el.getBoundingClientRect();
      var top = r.top + y;
      var start = top - vh * 0.9;
      var end = Math.min(top + r.height - vh * 0.5, max);
      var progress = end > start ? Math.min(1, Math.max(0, (y - start) / (end - start))) : 1;
      var words = el._words || (el._words = $$('.w', el));
      var count = Math.round(progress * words.length);
      if (count === el._count) return;
      el._count = count;
      words.forEach(function (w, i) { w.classList.toggle('on', i < count); });
    });
  }

  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(update);
  }

  /* ------------------------------------------------------------------------
     Navigation : pastille de survol, menu mobile
     ------------------------------------------------------------------------ */
  function initNavPill() {
    var nav = $('.nav');
    var pill = $('.nav-pill');
    if (!nav || !pill) return;
    function moveTo(a) {
      var instant = !pill.classList.contains('is-on');
      var nr = nav.getBoundingClientRect();
      var ar = a.getBoundingClientRect();
      if (instant) pill.style.transition = 'none';
      pill.style.setProperty('--x', (ar.left - nr.left) + 'px');
      pill.style.setProperty('--w', ar.width + 'px');
      if (instant) { void pill.offsetWidth; pill.style.transition = ''; }
      pill.classList.add('is-on');
    }
    $$('.nav-list a', nav).forEach(function (a) {
      a.addEventListener('mouseenter', function () { moveTo(a); });
      a.addEventListener('focus', function () { moveTo(a); });
    });
    nav.addEventListener('mouseleave', function () { pill.classList.remove('is-on'); });
    nav.addEventListener('focusout', function (e) { if (!nav.contains(e.relatedTarget)) pill.classList.remove('is-on'); });
  }

  function initMenu() {
    var burger = $('.burger');
    var menu = $('#menu-mobile');
    if (!burger || !menu) return;
    $$('a', menu).forEach(function (a, i) { a.style.setProperty('--i', i); });
    function set(open) {
      menuOpen = open;
      burger.setAttribute('aria-expanded', String(open));
      burger.setAttribute('aria-label', open ? t('Fermer le menu') : t('Ouvrir le menu'));
      menu.classList.toggle('is-open', open);
      menu.setAttribute('aria-hidden', String(!open));
      if (open) menu.removeAttribute('inert'); else menu.setAttribute('inert', '');
      doc.classList.toggle('menu-open', open);
      if (open) setHeaderHidden(false);
    }
    burger.addEventListener('click', function () { set(!menuOpen); });
    menu.addEventListener('click', function (e) { if (e.target.closest('a')) set(false); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && menuOpen) { set(false); burger.focus(); }
    });
    window.addEventListener('resize', function () { if (menuOpen && window.innerWidth > 1140) set(false); });
  }

  /* ------------------------------------------------------------------------
     Effets au survol : projecteur, inclinaison 3D, boutons magnétiques
     ------------------------------------------------------------------------ */
  function initPointerFx() {
    if (!finePointer) return;
    $$('[data-spot]').forEach(function (el) {
      el.addEventListener('pointermove', function (e) {
        var r = el.getBoundingClientRect();
        el.style.setProperty('--mx', (e.clientX - r.left) + 'px');
        el.style.setProperty('--my', (e.clientY - r.top) + 'px');
      });
    });
    if (reduce) return;
    $$('[data-tilt]').forEach(function (el) {
      var raf = 0;
      el.addEventListener('pointermove', function (e) {
        var r = el.getBoundingClientRect();
        var px = (e.clientX - r.left) / r.width;
        var py = (e.clientY - r.top) / r.height;
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(function () {
          el.style.transform = 'rotateX(' + ((0.5 - py) * 9).toFixed(2) + 'deg) rotateY(' + ((px - 0.5) * 11).toFixed(2) + 'deg)';
          el.style.setProperty('--gx', (px * 100).toFixed(1) + '%');
          el.style.setProperty('--gy', (py * 100).toFixed(1) + '%');
        });
      });
      el.addEventListener('pointerleave', function () { cancelAnimationFrame(raf); el.style.transform = ''; });
    });
    $$('[data-magnetic]').forEach(function (el) {
      el.addEventListener('pointermove', function (e) {
        var r = el.getBoundingClientRect();
        var x = e.clientX - (r.left + r.width / 2);
        var y = e.clientY - (r.top + r.height / 2);
        el.style.transform = 'translate(' + (x * 0.18).toFixed(1) + 'px,' + (y * 0.32).toFixed(1) + 'px)';
      });
      el.addEventListener('pointerleave', function () { el.style.transform = ''; });
    });
  }

  /* ------------------------------------------------------------------------
     Diaporama d'accueil
     ------------------------------------------------------------------------ */
  function initSlider() {
    var slider = $('[data-slider]');
    if (!slider) return;
    var hero = slider.closest('[data-hero]') || slider;
    var slides = $$('[data-slide]', slider);
    var buttons = $$('[data-goto]', hero);
    var counter = $('[data-slide-count]', hero);
    var panel = $('.hero-panel', hero);
    var current = 0;

    slides.forEach(function (s) { $$('[data-split="manual"]', s).forEach(splitWords); });

    function go(index) {
      index = (index + slides.length) % slides.length;
      if (index === current) return;
      var prev = slides[current];
      slider.classList.add('has-changed');
      prev.classList.remove('is-active');
      prev.classList.add('is-leaving');
      clearTimeout(prev._t);
      prev._t = setTimeout(function () { prev.classList.remove('is-leaving'); }, 950);
      current = index;
      var next = slides[current];
      clearTimeout(next._t);
      next.classList.remove('is-leaving');
      next.classList.add('is-active');
      slides.forEach(function (s, i) { s.setAttribute('aria-hidden', String(i !== current)); });
      buttons.forEach(function (b, i) { b.setAttribute('aria-current', String(i === current)); });
      if (counter) counter.textContent = (current + 1 < 10 ? '0' : '') + (current + 1);
    }

    buttons.forEach(function (b, i) {
      b.addEventListener('click', function () { go(i); });
      var bar = $('.bar i', b);
      if (bar && !reduce) bar.addEventListener('animationend', function () { if (i === current) go(current + 1); });
    });

    if (panel) {
      panel.addEventListener('mouseenter', function () { hero.classList.add('is-paused'); });
      panel.addEventListener('mouseleave', function () { hero.classList.remove('is-paused'); });
    }
    hero.addEventListener('focusin', function () { hero.classList.add('is-paused'); });
    hero.addEventListener('focusout', function (e) { if (!hero.contains(e.relatedTarget)) hero.classList.remove('is-paused'); });

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        hero.classList.toggle('is-offscreen', !entries[0].isIntersecting);
      }).observe(hero);
    }
  }

  /* ------------------------------------------------------------------------
     Dégradé animé (WebGL) — bruit simplex, palette indigo
     ------------------------------------------------------------------------ */
  var FRAG = [
    '#ifdef GL_FRAGMENT_PRECISION_HIGH',
    'precision highp float;',
    '#else',
    'precision mediump float;',
    '#endif',
    'uniform vec2 u_res;',
    'uniform float u_time;',
    'uniform vec2 u_mouse;',
    'vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}',
    'vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}',
    'vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}',
    'vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}',
    'float snoise(vec3 v){',
    '  const vec2 C=vec2(1.0/6.0,1.0/3.0);',
    '  const vec4 D=vec4(0.0,0.5,1.0,2.0);',
    '  vec3 i=floor(v+dot(v,C.yyy));',
    '  vec3 x0=v-i+dot(i,C.xxx);',
    '  vec3 g=step(x0.yzx,x0.xyz);',
    '  vec3 l=1.0-g;',
    '  vec3 i1=min(g.xyz,l.zxy);',
    '  vec3 i2=max(g.xyz,l.zxy);',
    '  vec3 x1=x0-i1+C.xxx;',
    '  vec3 x2=x0-i2+C.yyy;',
    '  vec3 x3=x0-D.yyy;',
    '  i=mod289(i);',
    '  vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));',
    '  float n_=0.142857142857;',
    '  vec3 ns=n_*D.wyz-D.xzx;',
    '  vec4 j=p-49.0*floor(p*ns.z*ns.z);',
    '  vec4 x_=floor(j*ns.z);',
    '  vec4 y_=floor(j-7.0*x_);',
    '  vec4 x=x_*ns.x+ns.yyyy;',
    '  vec4 y=y_*ns.x+ns.yyyy;',
    '  vec4 h=1.0-abs(x)-abs(y);',
    '  vec4 b0=vec4(x.xy,y.xy);',
    '  vec4 b1=vec4(x.zw,y.zw);',
    '  vec4 s0=floor(b0)*2.0+1.0;',
    '  vec4 s1=floor(b1)*2.0+1.0;',
    '  vec4 sh=-step(h,vec4(0.0));',
    '  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;',
    '  vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;',
    '  vec3 p0=vec3(a0.xy,h.x);',
    '  vec3 p1=vec3(a0.zw,h.y);',
    '  vec3 p2=vec3(a1.xy,h.z);',
    '  vec3 p3=vec3(a1.zw,h.w);',
    '  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));',
    '  p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;',
    '  vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0);',
    '  m=m*m;',
    '  return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));',
    '}',
    'void main(){',
    '  vec2 uv=gl_FragCoord.xy/u_res;',
    '  vec2 p=vec2(uv.x*u_res.x/u_res.y,uv.y);',
    '  float t=u_time*0.05;',
    '  vec2 warp=vec2(snoise(vec3(p*0.9,t)),snoise(vec3(p*0.9+vec2(7.3,2.1),t)));',
    '  vec2 q=p+0.18*warp+(u_mouse-0.5)*0.12;',
    '  float a=snoise(vec3(q*vec2(0.8,1.4),t*1.15));',
    '  float b=snoise(vec3(q*vec2(1.5,0.75)+3.1,t*0.85));',
    '  float c=snoise(vec3(q*2.1-5.2,t*1.4));',
    '  vec3 wash=vec3(0.910,0.914,1.000);',
    '  vec3 lav=vec3(0.725,0.725,0.976);',
    '  vec3 hov=vec3(0.451,0.537,1.000);',
    '  vec3 ink=vec3(0.325,0.227,0.992);',
    '  vec3 deep=vec3(0.094,0.149,0.349);',
    '  vec3 col=mix(wash,lav,smoothstep(-0.75,0.45,a));',
    '  col=mix(col,hov,smoothstep(-0.15,0.75,b)*0.9);',
    '  col=mix(col,ink,smoothstep(0.1,0.9,a*0.55+c*0.5));',
    '  col=mix(col,deep,smoothstep(0.5,1.05,b*0.65+c*0.45)*0.6);',
    '  float grain=fract(sin(dot(gl_FragCoord.xy,vec2(12.9898,78.233)))*43758.5453);',
    '  col+=(grain-0.5)*0.03;',
    '  gl_FragColor=vec4(col,1.0);',
    '}'
  ].join('\n');

  function gradient(canvas) {
    var gl = canvas.getContext('webgl', { antialias: false, alpha: false, depth: false, stencil: false, powerPreference: 'low-power' });
    if (!gl) return;

    function compile(type, src) {
      var s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      return s;
    }
    var prog = gl.createProgram();
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, 'attribute vec2 a;void main(){gl_Position=vec4(a,0.0,1.0);}'));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
    gl.useProgram(prog);

    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    var loc = gl.getAttribLocation(prog, 'a');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    var uRes = gl.getUniformLocation(prog, 'u_res');
    var uTime = gl.getUniformLocation(prog, 'u_time');
    var uMouse = gl.getUniformLocation(prog, 'u_mouse');
    var seed = parseFloat(canvas.getAttribute('data-seed')) || Math.random() * 40;
    var scale = Math.min(window.devicePixelRatio || 1, 2) * 0.5;
    var t0 = performance.now();
    var visible = false, raf = 0, lost = false;
    var mx = 0.5, my = 0.5, tx = 0.5, ty = 0.5;

    function resize() {
      var w = Math.max(2, Math.round(canvas.clientWidth * scale));
      var h = Math.max(2, Math.round(canvas.clientHeight * scale));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w; canvas.height = h;
        gl.viewport(0, 0, w, h);
      }
    }
    function draw(now) {
      if (lost) return;
      resize();
      mx += (tx - mx) * 0.03;
      my += (ty - my) * 0.03;
      gl.uniform2f(uRes, canvas.width, canvas.height);
      gl.uniform1f(uTime, (seed + (now - t0) / 1000) % 1800);
      gl.uniform2f(uMouse, mx, my);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    function loop(now) {
      draw(now);
      if (visible && !reduce) raf = requestAnimationFrame(loop);
    }

    canvas.addEventListener('webglcontextlost', function (e) {
      e.preventDefault(); lost = true; cancelAnimationFrame(raf); canvas.classList.remove('is-ready');
    });

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        visible = entries[0].isIntersecting;
        cancelAnimationFrame(raf);
        if (visible) raf = requestAnimationFrame(loop);
      }).observe(canvas);
    } else {
      visible = true;
      raf = requestAnimationFrame(loop);
    }

    if (finePointer && !reduce) {
      window.addEventListener('pointermove', function (e) {
        tx = e.clientX / window.innerWidth;
        ty = 1 - e.clientY / window.innerHeight;
      }, { passive: true });
    }
    if (reduce) window.addEventListener('resize', function () { requestAnimationFrame(draw); });

    draw(performance.now());
    canvas.classList.add('is-ready');
  }

  function initGradients() {
    $$('canvas[data-gradient]').forEach(function (canvas) { safe(function () { gradient(canvas); }); });
  }

  /* ------------------------------------------------------------------------
     Onglets (charte des honoraires)
     ------------------------------------------------------------------------ */
  function initTabs() {
    $$('[data-tabs]').forEach(function (root) {
      var tabs = $$('[role="tab"]', root);
      var panels = tabs.map(function (t) { return document.getElementById(t.getAttribute('aria-controls')); });
      var ink = $('.tab-ink', root);
      function selected() { return tabs.filter(function (t) { return t.getAttribute('aria-selected') === 'true'; })[0]; }
      function moveInk(tab) {
        if (!ink || !tab) return;
        ink.style.setProperty('--x', tab.offsetLeft + 'px');
        ink.style.setProperty('--w', tab.offsetWidth + 'px');
      }
      function select(index, focus) {
        tabs.forEach(function (tab, i) {
          var on = i === index;
          tab.setAttribute('aria-selected', String(on));
          tab.tabIndex = on ? 0 : -1;
          if (panels[i]) panels[i].hidden = !on;
        });
        if (focus) tabs[index].focus();
        moveInk(tabs[index]);
        var row = tabs[index].parentElement;
        if (row.scrollWidth > row.clientWidth + 1) {
          row.scrollTo({ left: tabs[index].offsetLeft - 24, behavior: reduce ? 'auto' : 'smooth' });
        }
      }
      tabs.forEach(function (tab, i) {
        tab.addEventListener('click', function () { select(i); });
        tab.addEventListener('keydown', function (e) {
          var rtl = getComputedStyle(root).direction === 'rtl';
          var map = { ArrowRight: rtl ? i - 1 : i + 1, ArrowLeft: rtl ? i + 1 : i - 1, Home: 0, End: tabs.length - 1 };
          if (!(e.key in map)) return;
          e.preventDefault();
          select((map[e.key] + tabs.length) % tabs.length, true);
        });
      });
      // Si les onglets ne tiennent pas sur une ligne, ils passent à la ligne (aucun onglet caché hors de l'écran)
      var list = tabs.length ? tabs[0].parentElement : null;
      function fit() {
        if (!list) return;
        list.classList.remove('is-wrap');
        if (list.scrollWidth > list.clientWidth + 1) list.classList.add('is-wrap');
        moveInk(selected());
      }
      window.addEventListener('resize', fit);
      if (list && 'ResizeObserver' in window) new ResizeObserver(function () { fit(); }).observe(list);
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit);
      select(0);
      fit();
    });
  }

  /* ------------------------------------------------------------------------
     Sommaire actif (prestations)
     ------------------------------------------------------------------------ */
  /* Veille Juridique : filtres par domaine (la grille ne garde que les analyses du domaine choisi) */
  function initVeilleFilters() {
    var buttons = $$('[data-vj-filter]');
    var cards = $$('[data-vj-grid] .vj-card');
    if (!buttons.length || !cards.length) return;
    buttons.forEach(function (b) {
      b.addEventListener('click', function () {
        var key = b.getAttribute('data-vj-filter');
        buttons.forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
        cards.forEach(function (c, i) {
          var show = key === 'all' || c.getAttribute('data-category') === key;
          c.hidden = !show;
          c.classList.remove('is-showing');
          if (show && !reduce) {
            c.style.animationDelay = (i % 3) * 70 + 'ms';
            void c.offsetWidth;
            c.classList.add('is-showing', 'is-in');
          }
        });
      });
    });
  }

  function initDomainBar() {
    var nav = $('.domains-index');
    var ol = nav && $('ol', nav);
    if (!ol) return;
    var sc = document.createElement('div');
    sc.className = 'di-scroll';
    nav.insertBefore(sc, ol);
    sc.appendChild(ol);
    function arrow(dir) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'di-arrow di-' + dir;
      b.setAttribute('aria-label', t(dir === 'prev' ? 'Domaines précédents' : 'Domaines suivants'));
      b.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false"><path d="' +
        (dir === 'prev' ? 'M15 5l-7 7 7 7' : 'M9 5l7 7-7 7') + '" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
      b.addEventListener('click', function () {
        if (b.getAttribute('aria-disabled') === 'true') return;
        var rtl = getComputedStyle(nav).direction === 'rtl';
        sc.scrollBy({ left: sc.clientWidth * 0.7 * (dir === 'next' ? 1 : -1) * (rtl ? -1 : 1), behavior: reduce ? 'auto' : 'smooth' });
      });
      return b;
    }
    var prev = arrow('prev'), next = arrow('next');
    nav.insertBefore(prev, sc);
    nav.appendChild(next);
    function update() {
      var max = sc.scrollWidth - sc.clientWidth, x = Math.abs(sc.scrollLeft);
      nav.classList.toggle('has-overflow', max > 2);
      nav.classList.toggle('at-start', x <= 2);
      nav.classList.toggle('at-end', x >= max - 2);
      prev.setAttribute('aria-disabled', String(x <= 2));
      next.setAttribute('aria-disabled', String(x >= max - 2));
    }
    // #12 — le domaine qui reçoit le focus clavier défile au centre (jamais caché sous le dégradé ou une flèche)
    sc.addEventListener('focusin', function (e) {
      var a = e.target.closest && e.target.closest('a');
      if (!a) return;
      try { if (!a.matches(':focus-visible')) return; } catch (err) {}
      var ar = a.getBoundingClientRect(), sr = sc.getBoundingClientRect();
      if (ar.left < sr.left + 64 || ar.right > sr.right - 64) {
        sc.scrollBy({ left: (ar.left + ar.width / 2) - (sr.left + sr.width / 2), behavior: reduce ? 'auto' : 'smooth' });
      }
    });
    sc.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    if ('ResizeObserver' in window) new ResizeObserver(function () { update(); }).observe(sc);
    update();
  }

  function initSpy() {
    var index = $('[data-spy]');
    if (!index || !('IntersectionObserver' in window)) return;
    var links = $$('a[href^="#"]', index);
    var byId = {};
    links.forEach(function (a) { byId[decodeURIComponent(a.hash.slice(1))] = a; });
    var active = null;
    function activate(a) {
      if (!a || a === active) return;
      if (active) active.classList.remove('is-active');
      a.classList.add('is-active');
      active = a;
      var sc = $('.di-scroll', index) || index;
      if (sc.scrollWidth > sc.clientWidth + 4) {
        var ar = a.getBoundingClientRect(), sr = sc.getBoundingClientRect();
        sc.scrollBy({ left: (ar.left + ar.width / 2) - (sr.left + sr.width / 2), behavior: reduce ? 'auto' : 'smooth' });
      } else if (index.scrollHeight > index.clientHeight + 4) {
        index.scrollTo({ top: a.offsetTop - index.clientHeight / 2, behavior: reduce ? 'auto' : 'smooth' });
      }
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) activate(byId[e.target.id]); });
    }, { rootMargin: '-40% 0px -55% 0px', threshold: 0 });
    Object.keys(byId).forEach(function (id) {
      var el = document.getElementById(id);
      if (el) io.observe(el);
    });
  }

  /* ------------------------------------------------------------------------
     Vidéo YouTube chargée au clic
     ------------------------------------------------------------------------ */
  function initVideo() {
    $$('[data-yt]').forEach(function (el) {
      el.addEventListener('click', function (e) {
        e.preventDefault();
        var iframe = document.createElement('iframe');
        iframe.src = 'https://www.youtube-nocookie.com/embed/' + el.getAttribute('data-yt') + '?autoplay=1&rel=0';
        iframe.title = el.getAttribute('aria-label') || t('Vidéo');
        iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
        iframe.allowFullscreen = true;
        var box = document.createElement('div');
        box.className = el.className + ' is-playing';
        box.appendChild(iframe);
        el.parentNode.replaceChild(box, el);
      });
    });
  }

  /* ------------------------------------------------------------------------
     Formulaires : ouverture de la messagerie avec le message pré-rempli
     ------------------------------------------------------------------------ */
  function initForms() {
    $$('form[data-form]').forEach(function (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        if (!form.reportValidity()) return;
        var lines = [];
        var subject = '';
        $$('.field', form).forEach(function (field) {
          var input = $('input, textarea', field);
          var label = $('label', field);
          if (!input || !input.value.trim()) return;
          if (input.name === 'objet') { subject = input.value.trim(); return; }
          var name = label ? label.textContent.replace(/\s*\(.*?\)\s*/g, '').trim() : input.name;
          lines.push(name + ' : ' + input.value.trim());
        });
        window.location.href = 'mailto:' + form.getAttribute('data-to') +
          '?subject=' + encodeURIComponent(subject) +
          '&body=' + encodeURIComponent(lines.join('\n\n'));
      });
    });
  }

  /* ------------------------------------------------------------------------
     Ouverture de l'accueil : entrée en scène et relief qui suit la souris
     ------------------------------------------------------------------------ */
  /* Signature « Chakouri & Ammas » (accueil) : le stylo avance avec l'encre, sur toute la largeur du tracé */
  function initSign() {
    var sign = $('[data-sign]');
    var hand = sign && $('.sign-hand', sign);
    if (!hand) return;
    function measure() { sign.style.setProperty('--sig-w', hand.getBoundingClientRect().width.toFixed(1) + 'px'); }
    measure();
    window.addEventListener('resize', measure, { passive: true });
  }

  /* Sélecteur de langue : se ferme au clic à côté et avec Échap */
  function initLang() {
    var menus = $$('details.lang');
    if (!menus.length) return;
    document.addEventListener('click', function (e) {
      menus.forEach(function (d) { if (d.open && !d.contains(e.target)) d.removeAttribute('open'); });
    });
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      menus.forEach(function (d) {
        if (!d.open) return;
        d.removeAttribute('open');
        var s = $('summary', d);
        if (s) s.focus();
      });
    });
  }

  /* Globe du réseau (assets/js/globe.js) : parcours des arcs, légende synchronisée, image fixe en secours */
  var globe = null;
  function globePoster(wrap) {
    if (!wrap) return;
    wrap.classList.remove('gx-live');
    wrap.classList.add('gx-static');
    if (!wrap.querySelector('.gx-poster')) {
      var img = new Image();
      img.className = 'gx-poster';
      img.alt = '';
      img.src = wrap.getAttribute('data-poster');
      wrap.appendChild(img);
    }
    // sans globe, les noms de régions ne sont plus des boutons (aucun arrêt de tabulation inutile)
    $$('.gx-region').forEach(function (r) { r.removeAttribute('tabindex'); r.removeAttribute('role'); });
  }
  function initGlobe() {
    var wrap = $('[data-globe]');
    if (!wrap) return;
    var regions = $$('.gx-region');
    function mark(key) { regions.forEach(function (r) { r.classList.toggle('is-on', r.getAttribute('data-region') === key); }); }
    try {
      globe = window.ChakouriGlobe ? window.ChakouriGlobe.mount(wrap, {
        reduce: reduce,
        onStep: mark,
        onDone: function () { mark(null); },
        onLost: function () { globe = null; mark(null); globePoster(wrap); }
      }) : null;
    } catch (err) {
      globe = null;
      if (window.console) console.warn(err);
    }
    if (!globe) { globePoster(wrap); return; }
    wrap.classList.add('gx-live');
    function show(key) { if (globe) { globe.focus(key); mark(key); } }
    function hide(key) { if (globe && globe.release(key)) mark(null); }   // ne relâche que la région quittée ; sinon le parcours continue
    regions.forEach(function (r) {
      var key = r.getAttribute('data-region');
      r.setAttribute('role', 'button');
      r.tabIndex = 0;
      r.addEventListener('mouseenter', function () { show(key); });
      r.addEventListener('focus', function () { show(key); });
      r.addEventListener('mouseleave', function () { hide(key); });
      r.addEventListener('blur', function () { hide(key); });
      r.addEventListener('click', function () { show(key); });
      r.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); show(key); } });
    });
  }
  function startGlobe() {
    if (!globe) return;
    var wrap = $('[data-globe]');
    if (!('IntersectionObserver' in window)) { globe.start(); return; }
    var io = new IntersectionObserver(function (en) {
      if (en[0].intersectionRatio >= 0.35) { io.disconnect(); setTimeout(function () { if (globe) globe.start(); }, 500); }
    }, { threshold: [0, 0.35, 0.7] });
    io.observe(wrap);
  }

  function loadScripts(list, done) {
    list = list.filter(Boolean);
    if (!list.length) { done(); return; }
    var sc = document.createElement('script');
    sc.src = list[0];
    sc.onload = function () { loadScripts(list.slice(1), done); };
    sc.onerror = function () { done(); };
    document.head.appendChild(sc);
  }

  /* Dossier Maroc Horizon 2030 : le sommaire suit la section en cours de lecture */
  function initMhToc() {
    var toc = $('.mh-toc');
    if (!toc || !('IntersectionObserver' in window)) return;
    var links = $$('a[href^="#"]', toc), byId = {};
    links.forEach(function (a) { byId[decodeURIComponent(a.hash.slice(1))] = a; });
    var seen = {};
    var io = new IntersectionObserver(function (en) {
      en.forEach(function (e) { seen[e.target.id] = e.isIntersecting; });
      var cur = null;
      $$('.mh-sec').some(function (sec) { if (seen[sec.id]) { cur = sec.id; return true; } return false; });
      if (!cur) return;
      links.forEach(function (a) { a.classList.toggle('is-active', a === byId[cur]); });
    }, { rootMargin: '-30% 0px -60% 0px' });
    $$('.mh-sec').forEach(function (sec) { io.observe(sec); });
  }

  function initLogos() {
    var sec = $('.clients');
    var imgs = sec ? $$('img[loading="lazy"]', sec) : [];
    if (!imgs.length) return;
    var load = function () { imgs.forEach(function (im) { im.loading = 'eager'; }); };
    if (!('IntersectionObserver' in window)) { load(); return; }
    var io = new IntersectionObserver(function (en) { if (en[0].isIntersecting) { io.disconnect(); load(); } }, { rootMargin: '900px 0px' });
    io.observe(sec);
  }

  /* Phrases d'accroche qui alternent sous le titre de l'accueil */
  function initRotator() {
    var box = $('[data-rotator]');
    var items = box ? $$('.gx-phrase', box) : [];
    if (items.length < 2 || reduce) return;
    var i = 0, hover = false, focused = false, touched = 0;
    box.addEventListener('mouseenter', function () { hover = true; });
    box.addEventListener('mouseleave', function () { hover = false; });
    var hero = box.closest('.hero') || box;
    hero.addEventListener('focusin', function () { focused = true; });
    hero.addEventListener('focusout', function (e) { focused = !!(e.relatedTarget && hero.contains(e.relatedTarget)); });
    box.addEventListener('touchstart', function () { touched = Date.now(); }, { passive: true });
    setInterval(function () {
      if (hover || focused || document.hidden || Date.now() - touched < 12000) return;
      items[i].classList.remove('is-active');
      i = (i + 1) % items.length;
      items[i].classList.add('is-active');
    }, 5600);
  }

  function heroReady() {
    var hero = $('.hero--edito, .hero--globe');
    if (hero) hero.classList.add('is-ready');
    startGlobe();
    var sign = $('[data-sign]');
    if (sign) sign.classList.add(reduce ? 'is-signed' : 'is-signing');
  }

  function initHeroDepth() {
    var hero = $('.hero--edito');
    var stage = $('.hv-stage');
    if (!hero || !stage || reduce || !finePointer) return;
    var raf = 0;
    hero.addEventListener('pointermove', function (e) {
      var r = hero.getBoundingClientRect();
      var x = (e.clientX - r.left) / r.width - 0.5;
      var y = (e.clientY - r.top) / r.height - 0.5;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(function () {
        stage.style.setProperty('--ry', (x * 12).toFixed(2) + 'deg');
        stage.style.setProperty('--rx', (-y * 9).toFixed(2) + 'deg');
      });
    });
    hero.addEventListener('pointerleave', function () {
      cancelAnimationFrame(raf);
      stage.style.setProperty('--ry', '0deg');
      stage.style.setProperty('--rx', '0deg');
    });
  }

  /* ------------------------------------------------------------------------
     Animation 3D d'entrée « Chakouri & Ammas Lawyers Firm » (accueil, une fois par session)
     ------------------------------------------------------------------------ */
  function runIntro() {
    return new Promise(function (resolve) {
      var intro = document.getElementById('intro');
      if (!intro || !doc.classList.contains('intro')) {
        doc.classList.remove('intro');
        if (intro && intro.parentNode) intro.parentNode.removeChild(intro);
        resolve();
        return;
      }
      var obj = $('.intro3d-obj', intro);
      var skip = $('.intro-skip', intro);
      var finished = false;
      var timer;

      function cleanup() {
        doc.classList.remove('intro');
        if (intro.parentNode) intro.parentNode.removeChild(intro);
        document.removeEventListener('keydown', onKey);
        resolve();
      }
      function finish(fast) {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        if (!intro.animate) { cleanup(); return; }
        if (!fast && obj) {
          obj.animate([{ transform: 'translateZ(0px) scale(.96)' }],
            { duration: 800, easing: 'cubic-bezier(.65, 0, .35, 1)', fill: 'forwards' });
        }
        intro.animate([{ opacity: 1 }, { opacity: 0 }],
          { duration: fast ? 380 : 620, delay: fast ? 0 : 80, easing: 'cubic-bezier(.16, 1, .3, 1)', fill: 'forwards' })
          .finished.then(cleanup, cleanup);
      }
      function onKey(e) { if (e.key === 'Escape') finish(true); }
      function play() {
        if (finished) return;
        intro.classList.add('is-playing');
        timer = setTimeout(function () { finish(false); }, 2300);
      }

      document.addEventListener('keydown', onKey);
      if (skip) skip.addEventListener('click', function () { finish(true); });
      // On attend la police (au plus 0,35 s) pour que les lettres 3D ne changent pas en cours de route.
      var fontReady = (document.fonts && document.fonts.load) ? document.fonts.load('400 120px "Inter Tight"') : Promise.resolve();
      Promise.race([fontReady, new Promise(function (r) { setTimeout(r, 350); })]).then(play, play);
    });
  }

  /* ------------------------------------------------------------------------
     Démarrage
     ------------------------------------------------------------------------ */
  /* ------------------------------------------------------------------------
     « Lire plus » (présentation de Maître Ammas)
     ------------------------------------------------------------------------ */
  function initReadMore() {
    Array.prototype.forEach.call(document.querySelectorAll('[data-readmore]'), function (btn) {
      var target = document.getElementById(btn.getAttribute('aria-controls'));
      if (!target) return;
      btn.addEventListener('click', function () {
        var open = btn.getAttribute('aria-expanded') === 'true';
        btn.setAttribute('aria-expanded', open ? 'false' : 'true');
        target.hidden = open;
        Array.prototype.forEach.call(btn.querySelectorAll('[data-when]'), function (sp) {
          sp.hidden = (sp.getAttribute('data-when') === 'open') === open;
        });
      });
    });
  }

  /* Logos clients : en couleur uniquement quand on appuie dessus (clic, toucher ou Entrée) ; un second appui ou un clic ailleurs rend le gris */
  function initLogoColor() {
    var tiles = $$('.logo-tile');
    if (!tiles.length) return;
    function clear() {
      tiles.forEach(function (t) { t.classList.remove('is-color'); t.setAttribute('aria-pressed', 'false'); });
      $$('.marquee.is-paused').forEach(function (m) { m.classList.remove('is-paused'); });
    }
    function toggle(t) {
      var on = !t.classList.contains('is-color');
      clear();
      if (on) {
        t.classList.add('is-color'); t.setAttribute('aria-pressed', 'true');
        var m = t.closest('.marquee'); if (m) m.classList.add('is-paused');
      }
    }
    tiles.forEach(function (t) {
      t.setAttribute('role', 'button'); t.setAttribute('aria-pressed', 'false');
      if (!t.closest('[aria-hidden="true"]')) t.setAttribute('tabindex', '0');
      t.addEventListener('click', function (e) { e.preventDefault(); toggle(t); });
      t.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(t); } });
    });
    document.addEventListener('click', function (e) { if (!e.target.closest('.logo-tile')) clear(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') clear(); });
  }

  function init() {
    initReadMore();
    initLogoColor();
    safe(function () {
      $$('[data-split]').forEach(function (el) { if (el.getAttribute('data-split') !== 'manual') splitWords(el); });
    });
    safe(initSlider);
    safe(initNavPill);
    safe(initMenu);
    safe(initPointerFx);
    safe(initTabs);
    safe(initVeilleFilters);
    safe(initDomainBar);
    safe(initSpy);
    safe(initVideo);
    safe(initForms);
    safe(initGradients);
    safe(initSign);
    safe(initRotator);
    safe(initMhToc);
    safe(initLogos);
    // Le globe (moteur + données, ~70 Ko) se charge après l'affichage de la page : le titre n'attend pas
    var gw = $('[data-globe]');
    if (gw) {
      var boot = function () {
        loadScripts(window.GLOBE_DOTS ? [] : [gw.getAttribute('data-src-data')], function () {
          loadScripts(window.ChakouriGlobe ? [] : [gw.getAttribute('data-src-engine')], function () {
            safe(initGlobe);
            if ($('.hero--globe.is-ready')) safe(startGlobe);
          });
        });
      };
      if (document.readyState === 'complete') setTimeout(boot, 50);
      else window.addEventListener('load', function () { setTimeout(boot, 50); });
    }
    safe(initLang);
    safe(initHeroDepth);
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    safe(update);
    window.__animReady = true;
    var started = safe(runIntro) || Promise.resolve();
    started.then(function () { safe(heroReady); safe(initReveal); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
