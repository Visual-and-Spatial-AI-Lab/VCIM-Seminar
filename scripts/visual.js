/* Original generative visual. No textures, fonts, images, or 3D libraries are fetched.
   Adjust RESOLUTION, surface(), palette, or the projection to change the artwork. */
(function () {
  'use strict';
  const canvas = document.getElementById('field-canvas');
  const card = document.getElementById('hero-art');
  const toggle = document.getElementById('motion-toggle');
  if (!canvas || !card) return;
  const ctx = canvas.getContext('2d', { alpha: true });
  if (!ctx) { if (toggle) toggle.hidden = true; return; }
  const RESOLUTION = { around: 72, tube: 28 };
  const tau = Math.PI * 2;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let paused = reducedMotion.matches, visible = true, frame = 0;
  let width = 0, height = 0, rotation = 0, last = 0;
  let mouseX = 0, mouseY = 0, targetX = 0, targetY = 0;

  function surface(u, v) {
    const radius = 1.62 + 0.14 * Math.cos(3 * u);
    const tube = 0.61 + 0.12 * Math.sin(3 * u + 0.4);
    const twist = v + 0.24 * Math.sin(2 * u);
    return [(radius + tube * Math.cos(twist)) * Math.cos(u),
      (radius + tube * Math.cos(twist)) * Math.sin(u),
      tube * Math.sin(twist) + 0.27 * Math.sin(3 * u)];
  }
  const mesh = [];
  for (let i = 0; i < RESOLUTION.around; i++) {
    const row = [];
    for (let j = 0; j < RESOLUTION.tube; j++) row.push(surface(i / RESOLUTION.around * tau, j / RESOLUTION.tube * tau));
    mesh.push(row);
  }
  function project(point, turn) {
    const [x, y, z] = point;
    const rx = 0.86 + mouseY * 0.11, ry = 0.43 + turn + mouseX * 0.15, rz = -0.43;
    const x1 = x, y1 = y * Math.cos(rx) - z * Math.sin(rx), z1 = y * Math.sin(rx) + z * Math.cos(rx);
    const x2 = x1 * Math.cos(ry) + z1 * Math.sin(ry), y2 = y1, z2 = -x1 * Math.sin(ry) + z1 * Math.cos(ry);
    const x3 = x2 * Math.cos(rz) - y2 * Math.sin(rz), y3 = x2 * Math.sin(rz) + y2 * Math.cos(rz);
    const perspective = 7.5 / (7.5 - z2);
    const scale = Math.min(width * 0.19, height * 0.235);
    return [width * 0.52 + x3 * scale * perspective, height * 0.49 + y3 * scale * perspective, z2];
  }
  function draw() {
    if (!width || !height) return;
    ctx.clearRect(0, 0, width, height);
    // Construction orbit and datum marks, kept intentionally quieter than the surface.
    ctx.strokeStyle = 'rgba(223,187,172,0.15)'; ctx.lineWidth = 0.7;
    ctx.setLineDash([2, 5]);
    ctx.beginPath(); ctx.ellipse(width * 0.52, height * 0.49, width * 0.40, Math.min(width, height) * 0.32, -0.43, 0, tau); ctx.stroke();
    ctx.setLineDash([]);
    const vertices = mesh.map(row => row.map(point => project(point, rotation)));
    const faces = [];
    for (let i = 0; i < RESOLUTION.around; i++) {
      for (let j = 0; j < RESOLUTION.tube; j++) {
        const points = [vertices[i][j], vertices[(i + 1) % RESOLUTION.around][j], vertices[(i + 1) % RESOLUTION.around][(j + 1) % RESOLUTION.tube], vertices[i][(j + 1) % RESOLUTION.tube]];
        faces.push({ points, depth: points.reduce((sum, point) => sum + point[2], 0) / 4, i, j });
      }
    }
    faces.sort((a, b) => a.depth - b.depth);
    faces.forEach(face => {
      const depth = Math.max(0, Math.min(1, (face.depth + 2.3) / 4.6));
      ctx.beginPath();
      face.points.forEach((p, index) => index ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.closePath();
      const light = Math.pow(depth, 1.5);
      ctx.fillStyle = `rgb(${Math.round(48 + light * 38)},${Math.round(14 + light * 17)},${Math.round(24 + light * 20)})`;
      ctx.fill();
      ctx.lineWidth = 0.55;
      ctx.strokeStyle = `rgba(235,198,165,${0.14 + light * 0.58})`; ctx.stroke();
      if (face.i % 9 === 0 && face.j % 7 === 0 && depth > 0.66) {
        ctx.beginPath(); ctx.arc(face.points[0][0], face.points[0][1], 1.5, 0, tau);
        ctx.fillStyle = 'rgba(218,231,171,0.95)'; ctx.fill();
      }
    });
    card.classList.add('canvas-ready');
  }
  function tick(time) {
    frame = 0;
    if (!last || time - last >= 1000 / 24) {
      const elapsed = last ? Math.min(time - last, 80) : 0;
      last = time;
      rotation += elapsed * 0.000035;
      mouseX += (targetX - mouseX) * 0.045; mouseY += (targetY - mouseY) * 0.045;
      draw();
    }
    if (!paused && visible && !document.hidden) frame = requestAnimationFrame(tick);
  }
  function updateLoop() {
    if (frame) cancelAnimationFrame(frame);
    frame = 0; last = 0;
    if (!paused && visible && !document.hidden) frame = requestAnimationFrame(tick);
    else draw();
  }
  function updateButton() {
    toggle.setAttribute('aria-pressed', String(paused));
    toggle.setAttribute('aria-label', paused ? 'Play geometric animation' : 'Pause geometric animation');
    toggle.title = paused ? 'Play motion' : 'Pause motion';
    document.getElementById('motion-label').textContent = paused ? 'Play' : 'Pause';
    toggle.querySelector('path').setAttribute('d', paused ? 'M5 3l7 5-7 5Z' : 'M5 3v10M11 3v10');
  }
  function resize() {
    const bounds = card.getBoundingClientRect();
    width = bounds.width; height = bounds.height;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0); draw();
  }
  toggle.addEventListener('click', () => { paused = !paused; updateButton(); updateLoop(); });
  card.addEventListener('pointermove', event => {
    if (paused || event.pointerType === 'touch') return;
    const bounds = card.getBoundingClientRect();
    targetX = (event.clientX - bounds.left) / width - 0.5; targetY = (event.clientY - bounds.top) / height - 0.5;
  });
  card.addEventListener('pointerleave', () => { targetX = 0; targetY = 0; });
  reducedMotion.addEventListener('change', event => { paused = event.matches; updateButton(); updateLoop(); });
  document.addEventListener('visibilitychange', updateLoop);
  if ('IntersectionObserver' in window) new IntersectionObserver(entries => { visible = entries[0].isIntersecting; updateLoop(); }, { rootMargin: '50px' }).observe(card);
  if ('ResizeObserver' in window) new ResizeObserver(resize).observe(card); else window.addEventListener('resize', resize);
  resize(); updateButton(); updateLoop();
})();
