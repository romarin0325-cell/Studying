(() => {
  function paint(canvas) {
    if (!canvas) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const width = Math.max(1, canvas.clientWidth);
    const height = Math.max(1, canvas.clientHeight);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const sky = ctx.createLinearGradient(0, 0, 0, height);
    sky.addColorStop(0, '#6fb7e6');
    sky.addColorStop(0.38, '#c8ebff');
    sky.addColorStop(0.62, '#f7fbff');
    sky.addColorStop(1, '#9fd0ea');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, width, height);
    const sun = ctx.createRadialGradient(width * 0.78, height * 0.16, 8, width * 0.78, height * 0.16, width * 0.42);
    sun.addColorStop(0, 'rgba(255,248,220,0.95)');
    sun.addColorStop(0.18, 'rgba(255,236,186,0.55)');
    sun.addColorStop(1, 'rgba(255,236,186,0)');
    ctx.fillStyle = sun;
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = 'rgba(255,255,255,0.72)';
    const clouds = [
      [0.14, 0.2, 90, 28], [0.28, 0.24, 70, 22], [0.08, 0.3, 54, 18],
      [0.72, 0.56, 110, 30], [0.86, 0.6, 64, 20]
    ];
    for (const [x, y, rx, ry] of clouds) {
      ctx.beginPath();
      ctx.ellipse(width * x, height * y, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  window.AzureSky = {
    start() {
      const canvas = document.getElementById('azure-sky');
      if (!canvas) return;
      const draw = () => paint(canvas);
      draw();
      window.addEventListener('resize', draw, { passive: true });
    }
  };
})();
