/* ==========================================================================
   Globe 3D du réseau international (accueil) — WebGL, sans bibliothèque
   Continents en points (assets/js/globe-data.js), arcs de Casablanca vers les régions
   du réseau du cabinet, vague dorée sur l'Afrique (« compliance pour toute l'Afrique »).
   ChakouriGlobe.mount(el, { reduce, onStep(key), onDone() }) → { start, focus(key), release, redraw } ou null
   ========================================================================== */
(function () {
  'use strict';

  var D2R = Math.PI / 180;
  var CASA = [33.5731, -7.5898];
  // Ordre du parcours : chaque arc part de Casablanca (coordonnées représentatives de chaque région)
  var DEST = [
    { key: 'europe', at: [48.8566, 2.3522] },
    { key: 'maghreb', at: [36.8065, 10.1815] },
    { key: 'afrique', at: [5.36, -4.0083] },
    { key: 'amerique', at: [40.7128, -74.006] },
    { key: 'canada', at: [43.6532, -79.3832] },
    { key: 'inde', at: [19.076, 72.8777] },
    { key: 'chine', at: [31.2304, 121.4737] }
  ];
  var HOME = [22, 3];          // centre de la vue d’ensemble (latitude, longitude) : Toronto et New York bien devant le limbe
  var CAM = 3.4;                // distance de la caméra (rayon du globe = 1)
  var FOCAL = 0.86 * Math.sqrt(CAM * CAM - 1);   // le globe occupe 86 % de la demi-largeur

  /* ---------- Géométrie de la sphère ---------- */
  function vec(lat, lon) {
    lat *= D2R; lon *= D2R;
    return [Math.cos(lat) * Math.sin(lon), Math.sin(lat), Math.cos(lat) * Math.cos(lon)];
  }
  function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
  function slerp(a, b, t) {
    var d = Math.acos(Math.max(-1, Math.min(1, dot(a, b))));
    if (d < 1e-6) return a.slice();
    var s = Math.sin(d), k1 = Math.sin((1 - t) * d) / s, k2 = Math.sin(t * d) / s;
    return [a[0] * k1 + b[0] * k2, a[1] * k1 + b[1] * k2, a[2] * k1 + b[2] * k2];
  }
  function latlon(v) { return [Math.asin(Math.max(-1, Math.min(1, v[1]))) / D2R, Math.atan2(v[0], v[2]) / D2R]; }
  function wrap(d) { while (d > 180) d -= 360; while (d < -180) d += 360; return d; }
  function ease(t) { return t < 0 ? 0 : t > 1 ? 1 : t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function easeOut(t) { return t < 0 ? 0 : t > 1 ? 1 : 1 - Math.pow(1 - t, 3); }

  // Rotation qui amène le point (lat, lon) face à la caméra : R = Rx(lat) · Ry(-lon), en colonnes pour WebGL
  function rotation(lat, lon) {
    var a = -lon * D2R, b = lat * D2R;
    var ca = Math.cos(a), sa = Math.sin(a), cb = Math.cos(b), sb = Math.sin(b);
    // lignes : [ca, 0, sa], [sb*sa, cb, -sb*ca], [-cb*sa, sb, cb*ca]
    var r = [ca, 0, sa, sb * sa, cb, -sb * ca, -cb * sa, sb, cb * ca];
    return { rows: r, cols: new Float32Array([r[0], r[3], r[6], r[1], r[4], r[7], r[2], r[5], r[8]]) };
  }
  function apply(r, v) {
    return [r[0] * v[0] + r[1] * v[1] + r[2] * v[2], r[3] * v[0] + r[4] * v[1] + r[5] * v[2], r[6] * v[0] + r[7] * v[1] + r[8] * v[2]];
  }

  function decodeDots(b64) {
    var bin = atob(b64), n = bin.length / 4, pos = new Float32Array(n * 3), af = new Float32Array(n);
    for (var i = 0; i < n; i++) {
      var o = i * 4;
      var la = (bin.charCodeAt(o) | (bin.charCodeAt(o + 1) << 8)); if (la > 32767) la -= 65536;
      var lo = (bin.charCodeAt(o + 2) | (bin.charCodeAt(o + 3) << 8)); if (lo > 32767) lo -= 65536;
      af[i] = lo & 1;
      var v = vec(la / 100, lo / 100);
      pos[i * 3] = v[0]; pos[i * 3 + 1] = v[1]; pos[i * 3 + 2] = v[2];
    }
    return { pos: pos, af: af, n: n };
  }

  function arcs() {
    var A = vec(CASA[0], CASA[1]), out = [];
    DEST.forEach(function (d, i) {
      var B = vec(d.at[0], d.at[1]);
      var ang = Math.acos(Math.max(-1, Math.min(1, dot(A, B))));
      var lift = 0.05 + 0.2 * ang / Math.PI;
      var n = Math.round(70 + 170 * ang / Math.PI);
      for (var k = 0; k < n; k++) {
        var t = k / (n - 1), v = slerp(A, B, t), h = 1 + lift * Math.sin(Math.PI * t);
        out.push(v[0] * h, v[1] * h, v[2] * h, t, i);
      }
    });
    return new Float32Array(out);
  }

  /* ---------- Shaders ---------- */
  var PROJ = [
    'uniform vec2 u_scale; uniform float u_cam; uniform float u_focal;',
    'vec4 project(vec3 p){ float w = u_cam - p.z; return vec4(p.x * u_focal / w * u_scale.x, p.y * u_focal / w * u_scale.y, 0.0, 1.0); }'
  ].join('\n');

  var VS_DOTS = [
    'attribute vec3 a_pos; attribute float a_af;',
    'uniform mat3 u_rot; uniform float u_size; uniform float u_side; uniform float u_wave; uniform float u_wend; uniform float u_africa; uniform vec3 u_casa; uniform float u_time;',
    PROJ,
    'varying float v_a; varying vec3 v_col;',
    'void main(){',
    '  vec3 p = u_rot * a_pos;',
    '  float hz = 1.0 / u_cam;',   // en perspective, l'horizon visible est à z = 1/CAM, pas à z = 0
    '  float front = u_side > 0.0 ? smoothstep(hz, hz + 0.05, p.z) : step(p.z, hz);',
    '  gl_Position = project(p);',
    '  float z = max(p.z, 0.0);',
    '  vec3 ink = vec3(0.30, 0.34, 0.58);',
    '  vec3 gold = vec3(0.722, 0.592, 0.353);',
    '  float d = acos(clamp(dot(a_pos, u_casa), -1.0, 1.0));',
    '  float reach = a_af * smoothstep(u_wave + 0.02, u_wave - 0.10, d);',
    '  float crest = a_af * exp(-pow((d - u_wave) * 18.0, 2.0)) * step(0.01, u_wave) * step(u_wave, u_wend - 0.06);',
    '  float g = clamp(reach * u_africa + crest, 0.0, 1.0);',
    '  v_col = mix(ink, gold, g);',
    '  float shimmer = 0.5 + 0.5 * sin(u_time * 0.9 + a_pos.x * 23.0 + a_pos.y * 17.0);',
    '  v_a = u_side > 0.0 ? front * (0.28 + 0.62 * smoothstep(0.0, 0.55, z) + 0.12 * g + crest * 0.5) * (0.92 + 0.08 * shimmer)',
    '                     : front * 0.085;',
    '  gl_PointSize = u_side > 0.0 ? u_size * (0.62 + 0.48 * z) * (1.0 + 0.35 * crest) : u_size * 0.62;',
    '}'
  ].join('\n');
  var FS_DOT = [
    'precision mediump float; varying float v_a; varying vec3 v_col;',
    'void main(){ vec2 c = gl_PointCoord * 2.0 - 1.0; float r = dot(c, c); if (r > 1.0) discard;',
    '  float a = v_a * (1.0 - smoothstep(0.55, 1.0, r)); gl_FragColor = vec4(v_col * a, a); }'
  ].join('\n');

  var VS_DISC = 'attribute vec2 a_xy; varying vec2 v_xy; void main(){ v_xy = a_xy; gl_Position = vec4(a_xy, 0.0, 1.0); }';
  var FS_DISC = [
    'precision mediump float; varying vec2 v_xy; uniform vec2 u_scale; uniform float u_r; uniform vec2 u_px;',
    'void main(){',
    '  vec2 q = vec2(v_xy.x / u_scale.x, v_xy.y / u_scale.y) / u_r;',
    '  float r = length(q);',
    '  float edge = 1.0 - smoothstep(1.0 - u_px.x, 1.0, r);',
    '  if (edge <= 0.0) discard;',
    '  float light = clamp(0.62 - 0.38 * dot(q, vec2(-0.55, 0.6)), 0.0, 1.0);',
    '  vec3 base = mix(vec3(1.0), vec3(0.925, 0.93, 1.0), smoothstep(0.15, 1.0, r) * 0.9 + (1.0 - light) * 0.25);',
    '  float rim = smoothstep(0.86, 1.0, r) * 0.5;',
    '  vec3 col = mix(base, vec3(0.80, 0.80, 0.98), rim);',
    '  float a = 0.9 * edge;',
    '  gl_FragColor = vec4(col * a, a);',
    '}'
  ].join('\n');

  var VS_ARC = [
    'attribute vec3 a_pos; attribute float a_t; attribute float a_i;',
    'uniform mat3 u_rot; uniform float u_size; uniform float u_prog[7]; uniform float u_hi[7]; uniform float u_time; uniform float u_pulse;',
    PROJ,
    'varying float v_a; varying vec3 v_col;',
    'void main(){',
    '  vec3 p = u_rot * a_pos;',
    '  gl_Position = project(p);',
    '  int i = int(a_i + 0.5);',
    '  float pr = 0.0; float hi = 0.0;',
    '  for (int k = 0; k < 7; k++) { if (k == i) { pr = u_prog[k]; hi = u_hi[k]; } }',
    '  vec3 c = vec3(0.0, 0.0, u_cam); vec3 d = p - c;',   // le segment caméra → point coupe-t-il la sphère avant le point ?
    '  float qa = dot(d, d), qb = dot(c, d), disc = qb * qb - qa * (u_cam * u_cam - 1.0);',
    '  float t1 = (-qb - sqrt(max(disc, 0.0))) / qa;',
    '  float hidden = step(0.0, disc) * step(0.0, t1) * step(t1, 0.995);',
    '  float shown = step(a_t, pr);',
    '  float head = exp(-pow((pr - a_t) * 16.0, 2.0)) * step(pr, 0.999) * shown;',
    '  float ph = fract(u_time * 0.16 + a_i * 0.137);',
    '  float pulse = u_pulse * step(0.999, pr) * exp(-pow((ph - a_t) * 15.0, 2.0));',
    '  v_col = mix(vec3(0.33, 0.24, 0.99), vec3(0.722, 0.592, 0.353), smoothstep(0.1, 0.95, a_t));',
    '  v_a = (1.0 - hidden) * shown * (0.62 + 0.3 * hi + head * 0.4 + pulse * 0.6);',
    '  gl_PointSize = u_size * (1.0 + head * 1.4 + pulse * 1.1 + hi * 0.35);',
    '}'
  ].join('\n');

  function mount(el, opts) {
    opts = opts || {};
    var canvas = el.querySelector('canvas');
    var gl = canvas && (canvas.getContext('webgl', { antialias: true, alpha: true, premultipliedAlpha: true }) ||
                        canvas.getContext('experimental-webgl', { antialias: true, alpha: true }));
    if (!gl || !window.GLOBE_DOTS) return null;

    function sh(type, src) {
      var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      return s;
    }
    function prog(vs, fs) {
      var p = gl.createProgram(); gl.attachShader(p, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs));
      gl.linkProgram(p); if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
      return p;
    }
    function uniforms(p, names) { var u = {}; names.forEach(function (n) { u[n] = gl.getUniformLocation(p, n); }); return u; }

    var dots = decodeDots(window.GLOBE_DOTS);
    var pDots = prog(VS_DOTS, FS_DOT), pDisc = prog(VS_DISC, FS_DISC), pArc = prog(VS_ARC, FS_DOT);
    var uD = uniforms(pDots, ['u_rot', 'u_size', 'u_side', 'u_wave', 'u_wend', 'u_africa', 'u_casa', 'u_time', 'u_scale', 'u_cam', 'u_focal']);
    var uC = uniforms(pDisc, ['u_scale', 'u_r', 'u_px']);
    var uA = uniforms(pArc, ['u_rot', 'u_size', 'u_prog[0]', 'u_hi[0]', 'u_time', 'u_pulse', 'u_scale', 'u_cam', 'u_focal']);
    var bPos = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, bPos); gl.bufferData(gl.ARRAY_BUFFER, dots.pos, gl.STATIC_DRAW);
    var bAf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, bAf); gl.bufferData(gl.ARRAY_BUFFER, dots.af, gl.STATIC_DRAW);
    var arcData = arcs(), nArc = arcData.length / 5;
    var bArc = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, bArc); gl.bufferData(gl.ARRAY_BUFFER, arcData, gl.STATIC_DRAW);
    var bQuad = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, bQuad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1]), gl.STATIC_DRAW);
    var locD = { pos: gl.getAttribLocation(pDots, 'a_pos'), af: gl.getAttribLocation(pDots, 'a_af') };
    var locA = { pos: gl.getAttribLocation(pArc, 'a_pos'), t: gl.getAttribLocation(pArc, 'a_t'), i: gl.getAttribLocation(pArc, 'a_i') };
    var locC = gl.getAttribLocation(pDisc, 'a_xy');
    var casaVec = new Float32Array(vec(CASA[0], CASA[1]));
    // #3 — la vague dorée va jusqu'au point d'Afrique le plus éloigné de Casablanca (Madagascar, est de l'Afrique du Sud)
    var WAVE_END = 0;
    for (var q = 0; q < dots.n; q++) {
      if (!dots.af[q]) continue;
      var dd = Math.acos(Math.max(-1, Math.min(1, dots.pos[q * 3] * casaVec[0] + dots.pos[q * 3 + 1] * casaVec[1] + dots.pos[q * 3 + 2] * casaVec[2])));
      if (dd > WAVE_END) WAVE_END = dd;
    }
    WAVE_END = (WAVE_END || 1.2) + 0.13;

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.clearColor(0, 0, 0, 0);

    /* ---------- Repères et étiquettes (HTML, positionnés par projection) ---------- */
    var marks = {};
    Array.prototype.forEach.call(el.querySelectorAll('[data-mark]'), function (m) { marks[m.getAttribute('data-mark')] = m; });
    var markVec = { casa: vec(CASA[0], CASA[1]) };
    DEST.forEach(function (d) { markVec[d.key] = vec(d.at[0], d.at[1]); });

    /* ---------- État ---------- */
    var reduce = !!opts.reduce;
    var prog7 = new Float32Array(7), hi7 = new Float32Array(7);
    var wave = 0, africa = 0;
    var view = { lat: HOME[0], lon: HOME[1] }, from = null, to = null, moveT0 = 0, moveDur = 1;
    var drag = { on: false, x: 0, y: 0, lat: 0, lon: 0, vlat: 0, vlon: 0, last: 0 };
    var off = { lat: 0, lon: 0 };
    var phase = 'idle', step = -1, stepT0 = 0, calmT0 = 0, focusKey = null;
    var dpr = Math.min(window.devicePixelRatio || 1, 2), W = 0, H = 0, sx = 1, sy = 1;
    var raf = 0, visible = true, lost = false, t0 = performance.now(), now = t0;

    if (reduce) {
      for (var i = 0; i < 7; i++) prog7[i] = 1;
      wave = WAVE_END; africa = 1; phase = 'calm';
      Object.keys(marks).forEach(function (k) { marks[k].classList.add('is-on'); });
    }

    function centerFor(key) {
      var d = DEST.filter(function (x) { return x.key === key; })[0];
      var c = latlon(slerp(vec(CASA[0], CASA[1]), vec(d.at[0], d.at[1]), 0.5));
      return { lat: Math.max(-10, Math.min(42, c[0] - 4)), lon: c[1] };
    }
    function moveTo(target, dur) {
      from = { lat: view.lat, lon: view.lon };
      to = { lat: target.lat, lon: from.lon + wrap(target.lon - from.lon) };
      moveT0 = now; moveDur = dur;
    }

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      var w = Math.max(2, Math.round(canvas.clientWidth * dpr)), h = Math.max(2, Math.round(canvas.clientHeight * dpr));
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
      W = w; H = h;
      var m = Math.min(w, h); sx = m / w; sy = m / h;
      gl.viewport(0, 0, w, h);
    }

    function updateTour() {
      if (phase !== 'tour') return;
      var e = (now - stepT0) / 1000;
      var MOVE = 1.35, DRAW = 1.25, HOLD = 0.75;
      if (step >= DEST.length) {
        if (e > 1.7) { phase = 'calm'; calmT0 = now; if (opts.onDone) opts.onDone(); }
        return;
      }
      var key = DEST[step].key;
      if (e > MOVE - 0.35) {
        var p = easeOut((e - (MOVE - 0.35)) / DRAW);
        prog7[step] = p;
        if (key === 'afrique') { wave = WAVE_END * easeOut((e - (MOVE - 0.35)) / 2.4); africa = 1; }
        if (p >= 1 && marks[key] && !marks[key].classList.contains('is-on')) marks[key].classList.add('is-on');
      }
      if (e > MOVE + DRAW + HOLD - 0.35) {
        step++;
        stepT0 = now;
        if (step < DEST.length) {
          moveTo(centerFor(DEST[step].key), 1.35);
          if (opts.onStep) opts.onStep(DEST[step].key);
        } else {
          moveTo({ lat: HOME[0], lon: HOME[1] }, 1.7);
          if (opts.onStep) opts.onStep(null);
        }
      }
    }

    function autoCenter() {
      if (from && to) {
        var k = ease((now - moveT0) / (moveDur * 1000));
        view.lat = from.lat + (to.lat - from.lat) * k;
        view.lon = from.lon + (to.lon - from.lon) * k;
        if (k >= 1) { from = to = null; if (phase === 'calm') calmT0 = now; }
      } else if (phase === 'calm' && !focusKey && !reduce) {
        var t = (now - calmT0) / 1000;
        view.lon = HOME[1] + 30 * Math.sin(t * 2 * Math.PI / 28) * Math.min(1, t / 6);
        view.lat = HOME[0] + 3 * Math.sin(t * 2 * Math.PI / 41);
      }
    }

    function frame() {
      if (lost) return;
      now = performance.now();
      resize();
      updateTour();
      autoCenter();
      // inertie et retour progressif après un glisser
      if (!drag.on) {
        off.lon = wrap(off.lon + drag.vlon);
        off.lat = Math.max(-45 - view.lat, Math.min(60 - view.lat, off.lat + drag.vlat));
        drag.vlon *= 0.93; drag.vlat *= 0.93;
        if (now - drag.last > 2600) { off.lon *= 0.965; off.lat *= 0.965; }
      }
      var lat = Math.max(-45, Math.min(60, view.lat + off.lat)), lon = view.lon + off.lon;
      var R = rotation(lat, lon);
      var time = (now - t0) / 1000;
      var size = Math.max(1.6, Math.min(W, H) / 330) * 1.05;
      var rDisc = FOCAL / Math.sqrt(CAM * CAM - 1);

      gl.clear(gl.COLOR_BUFFER_BIT);
      // 1. points de la face cachée (très pâles), 2. corps du globe, 3. points de la face visible, 4. arcs
      gl.useProgram(pDots);
      gl.uniformMatrix3fv(uD.u_rot, false, R.cols);
      gl.uniform2f(uD.u_scale, sx, sy); gl.uniform1f(uD.u_cam, CAM); gl.uniform1f(uD.u_focal, FOCAL);
      gl.uniform1f(uD.u_size, size); gl.uniform1f(uD.u_wave, wave); gl.uniform1f(uD.u_wend, WAVE_END); gl.uniform1f(uD.u_africa, africa);
      gl.uniform3fv(uD.u_casa, casaVec); gl.uniform1f(uD.u_time, reduce ? 0 : time);
      gl.bindBuffer(gl.ARRAY_BUFFER, bPos); gl.enableVertexAttribArray(locD.pos); gl.vertexAttribPointer(locD.pos, 3, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, bAf); gl.enableVertexAttribArray(locD.af); gl.vertexAttribPointer(locD.af, 1, gl.FLOAT, false, 0, 0);
      gl.uniform1f(uD.u_side, -1); gl.drawArrays(gl.POINTS, 0, dots.n);

      gl.useProgram(pDisc);
      gl.disableVertexAttribArray(locD.af);
      gl.bindBuffer(gl.ARRAY_BUFFER, bQuad); gl.enableVertexAttribArray(locC); gl.vertexAttribPointer(locC, 2, gl.FLOAT, false, 0, 0);
      gl.uniform2f(uC.u_scale, sx, sy); gl.uniform1f(uC.u_r, rDisc); gl.uniform2f(uC.u_px, 2.0 / (Math.min(W, H) * rDisc) * 1.5, 0);
      gl.drawArrays(gl.TRIANGLES, 0, 6);

      gl.useProgram(pDots);
      gl.bindBuffer(gl.ARRAY_BUFFER, bPos); gl.vertexAttribPointer(locD.pos, 3, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, bAf); gl.enableVertexAttribArray(locD.af); gl.vertexAttribPointer(locD.af, 1, gl.FLOAT, false, 0, 0);
      gl.uniform1f(uD.u_side, 1); gl.drawArrays(gl.POINTS, 0, dots.n);
      gl.disableVertexAttribArray(locD.af);

      gl.useProgram(pArc);
      gl.uniformMatrix3fv(uA.u_rot, false, R.cols);
      gl.uniform2f(uA.u_scale, sx, sy); gl.uniform1f(uA.u_cam, CAM); gl.uniform1f(uA.u_focal, FOCAL);
      gl.uniform1f(uA.u_size, size * 1.15); gl.uniform1f(uA.u_time, time); gl.uniform1f(uA.u_pulse, reduce ? 0 : 1);
      gl.uniform1fv(uA['u_prog[0]'], prog7); gl.uniform1fv(uA['u_hi[0]'], hi7);
      gl.bindBuffer(gl.ARRAY_BUFFER, bArc);
      gl.enableVertexAttribArray(locA.pos); gl.vertexAttribPointer(locA.pos, 3, gl.FLOAT, false, 20, 0);
      gl.enableVertexAttribArray(locA.t); gl.vertexAttribPointer(locA.t, 1, gl.FLOAT, false, 20, 12);
      gl.enableVertexAttribArray(locA.i); gl.vertexAttribPointer(locA.i, 1, gl.FLOAT, false, 20, 16);
      gl.drawArrays(gl.POINTS, 0, nArc);
      gl.disableVertexAttribArray(locA.t); gl.disableVertexAttribArray(locA.i);

      // repères HTML
      placeMarks(R);
    }

    /* Étiquettes : chaque repère essaie sa position préférée, puis des positions de repli ; une étiquette qui
       sortirait du cadre ou recouvrirait une étiquette plus importante change de côté, ou s'efface en dernier recours.
       Ordre d'importance : région survolée, étape en cours du parcours, Casablanca, puis les autres. */
    var ALT = { r: ['r', 'tr', 'br', 'l', 't', 'b'], l: ['l', 'tl', 'bl', 'b', 't', 'r'], t: ['t', 'tr', 'tl', 'b', 'r', 'l'],
                b: ['b', 'br', 'bl', 't', 'r', 'l'], tl: ['tl', 'l', 't', 'bl', 'tr', 'r'], bl: ['bl', 'l', 'b', 'tl', 'br', 'r'],
                tr: ['tr', 'r', 't', 'br', 'tl', 'l'], br: ['br', 'r', 'b', 'tr', 'bl', 'l'] };
    var sizeKey = '';
    function box(at, x, y, w, h) {
      // mêmes décalages que les règles .gx-mark[data-at] p de style.css
      switch (at) {
        case 't': return [x - w / 2, y - 10 - h, x + w / 2, y - 10];
        case 'b': return [x - w / 2, y + 10, x + w / 2, y + 10 + h];
        case 'l': return [x - 12 - w, y - 11, x - 12, y - 11 + h];
        case 'tl': return [x - 12 - w, y - 6 - h, x - 12, y - 6];
        case 'bl': return [x - 12 - w, y + 6, x - 12, y + 6 + h];
        case 'tr': return [x + 12, y - 6 - h, x + 12 + w, y - 6];
        case 'br': return [x + 12, y + 6, x + 12 + w, y + 6 + h];
        default: return [x + 12, y - 11, x + 12 + w, y - 11 + h];
      }
    }
    function overlap(a, b) {
      var ox = Math.min(a[2], b[2]) - Math.max(a[0], b[0]), oy = Math.min(a[3], b[3]) - Math.max(a[1], b[1]);
      return ox > 0 && oy > 0 ? ox * oy : 0;
    }
    function placeMarks(R) {
      var cw = canvas.clientWidth, ch = canvas.clientHeight, m = Math.min(cw, ch), hz = 1 / CAM, pad = 4;
      if (sizeKey !== cw + 'x' + ch) {   // la taille du texte change avec la largeur (≤ 900 px) : on remesure
        sizeKey = cw + 'x' + ch;
        Object.keys(marks).forEach(function (k) { marks[k].__w = marks[k].__h = 0; });
      }
      var cur = phase === 'tour' && step >= 0 && step < DEST.length ? DEST[step].key : null;
      var list = Object.keys(marks).map(function (k) {
        var p = apply(R.rows, markVec[k]);
        var w = CAM - p[2];
        var el2 = marks[k];
        if (!el2.__w) {
          var lab = el2.querySelector('p') || el2;
          if (lab.offsetWidth > 0) { el2.__w = lab.offsetWidth; el2.__h = lab.offsetHeight; }
        }
        return {
          k: k, el: el2,
          x: cw / 2 + p[0] * FOCAL / w * m / 2, y: ch / 2 - p[1] * FOCAL / w * m / 2,
          vis: Math.max(0, Math.min(1, (p[2] - hz) / 0.05)),     // caché derrière le limbe en perspective (z < 1/CAM), fondu court comme les points
          rank: k === focusKey ? 0 : k === cur ? 1 : k === 'casa' ? 2 : 3,
          w: el2.__w || 90, h: el2.__h || 20,
          on: el2.classList.contains('is-on')
        };
      });
      list.sort(function (a, b) { return a.rank - b.rank; });
      var placed = [];
      var t = performance.now();
      list.forEach(function (o) {
        if (o.on && !o.el.__onAt) o.el.__onAt = t;
        if (o.el.__onAt && t - o.el.__onAt > 700) o.el.classList.add('is-settled');
        o.el.style.transform = 'translate(' + o.x.toFixed(1) + 'px,' + o.y.toFixed(1) + 'px)';
        o.el.style.setProperty('--vis', o.vis.toFixed(3));
        o.el.classList.toggle('is-hi', o.k === focusKey);
        if (!o.on || o.vis < 0.05) { o.el.classList.remove('no-label'); return; }   // invisible : ne gêne personne
        var pref = o.el.getAttribute('data-pos') || 'r';
        var now0 = o.el.getAttribute('data-at') || pref;
        var tries = [now0].concat(ALT[pref] || ALT.r);   // on garde la position actuelle tant qu'elle convient (pas de clignotement)
        var best = null, bestCost = Infinity;
        for (var i = 0; i < tries.length; i++) {
          var b = box(tries[i], o.x, o.y, o.w, o.h);
          var out = Math.max(0, pad - b[0]) + Math.max(0, b[2] - (cw - pad)) + Math.max(0, pad - b[1]) + Math.max(0, b[3] - (ch - pad));
          var hit = 0;
          for (var j = 0; j < placed.length; j++) hit += overlap(b, placed[j]);
          var cost = out * 1000 + hit;
          if (cost === 0) { best = { at: tries[i], b: b }; bestCost = 0; break; }
          if (cost < bestCost) { bestCost = cost; best = { at: tries[i], b: b }; }
        }
        if (o.el.getAttribute('data-at') !== best.at) o.el.setAttribute('data-at', best.at);
        var hide = bestCost > 0 && o.rank > 0;           // aucune place libre : l'étiquette la moins importante s'efface
        o.el.classList.toggle('no-label', hide);
        if (!hide) placed.push(best.b);
      });
    }

    function loop() {
      if (lost) { raf = 0; return; }
      frame();
      raf = (visible && !document.hidden && !reduce) ? requestAnimationFrame(loop) : 0;
    }
    function kick() { if (!lost && !raf && visible && !document.hidden) raf = requestAnimationFrame(reduce ? function () { raf = 0; frame(); } : loop); }

    /* ---------- Glisser pour tourner le globe ---------- */
    canvas.addEventListener('pointerdown', function (e) {
      drag.on = true; drag.x = e.clientX; drag.y = e.clientY; drag.vlat = drag.vlon = 0;
      canvas.setPointerCapture(e.pointerId);
      el.classList.add('is-dragging');
    });
    canvas.addEventListener('pointermove', function (e) {
      if (!drag.on) return;
      var k = 150 / Math.max(120, Math.min(canvas.clientWidth, canvas.clientHeight));
      var dx = (e.clientX - drag.x) * k, dy = (e.clientY - drag.y) * k;
      drag.x = e.clientX; drag.y = e.clientY;
      off.lon -= dx;
      off.lat = Math.max(-45 - view.lat, Math.min(60 - view.lat, off.lat + dy));
      drag.vlon = -dx * 0.6; drag.vlat = dy * 0.6;
      drag.last = performance.now();
      kick();
      if (reduce) frame();
    });
    function up() {
      if (performance.now() - drag.last > 60) drag.vlat = drag.vlon = 0;
      drag.on = false; drag.last = performance.now(); el.classList.remove('is-dragging');
    }
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);

    canvas.addEventListener('webglcontextlost', function (e) { e.preventDefault(); lost = true; cancelAnimationFrame(raf); raf = 0; if (opts.onLost) opts.onLost(); });
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (en) {
        visible = en[0].isIntersecting;
        if (visible) kick(); else { cancelAnimationFrame(raf); raf = 0; }
      }).observe(el);
    }
    document.addEventListener('visibilitychange', kick);
    (function watchDpr() {
      if (!window.matchMedia) return;
      var mq = window.matchMedia('(resolution: ' + (window.devicePixelRatio || 1) + 'dppx)');
      var on = function () {
        if (mq.removeEventListener) mq.removeEventListener('change', on);
        if (reduce) frame(); else kick();
        watchDpr();
      };
      if (mq.addEventListener) mq.addEventListener('change', on);
    })();
    window.addEventListener('resize', function () { if (reduce) frame(); });

    frame();
    return {
      start: function () {
        if (phase !== 'idle' || reduce) return;
        phase = 'tour'; step = 0; stepT0 = performance.now(); now = stepT0;
        moveTo(centerFor(DEST[0].key), 1.35);
        if (opts.onStep) opts.onStep(DEST[0].key);
        kick();
      },
      // Montrer une destination (survol d'un nom de région dans la légende)
      focus: function (key) {
        if (lost || key === focusKey) return;   // déjà ciblée (survol puis clic, Tab puis Entrée) : on ne relance pas le mouvement
        if (phase === 'tour' || phase === 'idle') {
          for (var i = 0; i < 7; i++) prog7[i] = 1;
          wave = WAVE_END; africa = 1; phase = 'calm';
          Object.keys(marks).forEach(function (k) { marks[k].classList.add('is-on'); });
          if (opts.onStep) opts.onStep(null);
          if (opts.onDone) opts.onDone();
        }
        focusKey = key;
        for (var j = 0; j < 7; j++) hi7[j] = DEST[j].key === key ? 1 : 0;
        // le décalage du glisser est intégré au point de départ : le mouvement part de ce qui est affiché, sans saut
        view.lat = Math.max(-45, Math.min(60, view.lat + off.lat)); view.lon += off.lon;
        off.lat = off.lon = drag.vlat = drag.vlon = 0;
        moveTo(centerFor(key), reduce ? 0.001 : 0.9);
        kick();
        if (reduce) { now = performance.now() + 2000; frame(); }
      },
      // renvoie true si une région était ciblée (sinon rien à relâcher : le parcours en cours continue)
      release: function (key) {
        if (lost || focusKey === null || (key && key !== focusKey)) return false;
        focusKey = null;
        for (var j = 0; j < 7; j++) hi7[j] = 0;
        if (!reduce) moveTo({ lat: HOME[0], lon: HOME[1] }, 1.4);
        kick();
        if (reduce) { view.lat = HOME[0]; view.lon = HOME[1]; frame(); }
        return true;
      },
      redraw: function () { frame(); }
    };
  }

  window.ChakouriGlobe = { mount: mount, DEST: DEST.map(function (d) { return d.key; }) };
})();
