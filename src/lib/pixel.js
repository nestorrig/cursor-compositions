function startPixelFluid() {
  if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
  initPixelFluidCursor();
}

if (document.readyState === "complete") startPixelFluid();
else window.addEventListener("load", startPixelFluid);

function initPixelFluidCursor() {
  const accent = parseHex(
    getComputedStyle(document.documentElement)
      .getPropertyValue("--fluid-color")
      .trim() || "#004bff",
  );

  const config = {
    SIM_RESOLUTION: 150,
    PIXEL_SIZE: 16,
    VELOCITY_DISSIPATION: 0.77,
    DENSITY_DISSIPATION: 0.95,
    PRESSURE_ITERATIONS: 10,
    SPLAT_FORCE: 18,
    SPLAT_RADIUS: 2.1,
    SPEED_RADIUS_GAIN: 0.16,
    SPEED_FORCE_GAIN: 1.1,
    FRICTION: 0.22,
    COLOR_BASE_INTENSITY: 0.6,
    COLOR_SPEED_INTENSITY: 0.006,
    DYE_CLAMP: 5.6,
    RENDER_ALPHA: 1.85,
  };

  const canvas = document.createElement("canvas");
  canvas.id = "fluid";
  canvas.setAttribute("aria-hidden", "true");
  document.body.appendChild(canvas);

  const ctx = canvas.getContext("2d", { alpha: true });

  let width = 0;
  let height = 0;
  let simW = 0;
  let simH = 0;
  let cellCount = 0;
  let lastTime = 0;
  let dpr = 1;
  let viewportWidthCss = window.innerWidth;
  let viewportHeightCss = window.innerHeight;

  let vx;
  let vy;
  let vx0;
  let vy0;
  let pressure;
  let pressure0;
  let divergence;
  let dyeR;
  let dyeG;
  let dyeB;
  let dyeR0;
  let dyeG0;
  let dyeB0;

  const pointer = {
    targetX: viewportWidthCss * 0.5,
    targetY: viewportHeightCss * 0.5,
    smoothX: viewportWidthCss * 0.5,
    smoothY: viewportHeightCss * 0.5,
    prevX: viewportWidthCss * 0.5,
    prevY: viewportHeightCss * 0.5,
    speed: 0,
    ready: false,
    lastInputAt: 0,
  };
  const POINTER_IDLE_MS = 80;
  const POINTER_SPLAT_SPEED = 0.04;

  const GRID_SVG_SIZE = 51;
  const GRID_V_LINE_X = 4.18933;
  const GRID_V_LINE_LENGTH = 8.124;
  const GRID_H_LINE_Y = 3.93469;
  const GRID_H_LINE_LENGTH = 8.1989;
  const tile = config.PIXEL_SIZE;

  const idx = (x, y) => x + y * simW;
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

  function parseHex(hex) {
    const clean = (hex.startsWith("#") ? hex.slice(1) : hex).toLowerCase();
    const full =
      clean.length === 3 ? clean.split("").map((ch) => ch + ch).join("") : clean;
    if (full.length !== 6) return { r: 0, g: 75 / 255, b: 1 };
    const int = Number.parseInt(full, 16);
    if (Number.isNaN(int)) return { r: 0, g: 75 / 255, b: 1 };
    return {
      r: ((int >> 16) & 255) / 255,
      g: ((int >> 8) & 255) / 255,
      b: (int & 255) / 255,
    };
  }

  function createFieldArrays() {
    cellCount = simW * simH;
    vx = new Float32Array(cellCount);
    vy = new Float32Array(cellCount);
    vx0 = new Float32Array(cellCount);
    vy0 = new Float32Array(cellCount);
    pressure = new Float32Array(cellCount);
    pressure0 = new Float32Array(cellCount);
    divergence = new Float32Array(cellCount);
    dyeR = new Float32Array(cellCount);
    dyeG = new Float32Array(cellCount);
    dyeB = new Float32Array(cellCount);
    dyeR0 = new Float32Array(cellCount);
    dyeG0 = new Float32Array(cellCount);
    dyeB0 = new Float32Array(cellCount);
  }

  function resize() {
    const viewport = window.visualViewport;
    viewportWidthCss = viewport ? viewport.width : window.innerWidth;
    viewportHeightCss = viewport ? viewport.height : window.innerHeight;

    dpr = window.devicePixelRatio || 1;
    width = Math.max(1, Math.floor(viewportWidthCss * dpr));
    height = Math.max(1, Math.floor(viewportHeightCss * dpr));

    canvas.width = width;
    canvas.height = height;
    canvas.style.width = `${viewportWidthCss}px`;
    canvas.style.height = `${viewportHeightCss}px`;

    const aspect = width / height;
    simH = Math.max(48, Math.floor(config.SIM_RESOLUTION));
    simW = Math.max(48, Math.floor(simH * aspect));
    createFieldArrays();
  }

  function sample(field, x, y) {
    return field[idx(clamp(x, 0, simW - 1), clamp(y, 0, simH - 1))];
  }

  function bilerp(field, x, y) {
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const tx = x - x0;
    const ty = y - y0;
    return (
      (sample(field, x0, y0) * (1 - tx) + sample(field, x0 + 1, y0) * tx) *
        (1 - ty) +
      (sample(field, x0, y0 + 1) * (1 - tx) + sample(field, x0 + 1, y0 + 1) * tx) *
        ty
    );
  }

  function addSplat(normX, normY, forceX, forceY, radiusCells, color) {
    const cx = Math.floor(normX * (simW - 1));
    const cy = Math.floor(normY * (simH - 1));
    const rad = Math.max(1.2, radiusCells);
    const minX = clamp(Math.floor(cx - rad * 2), 0, simW - 1);
    const maxX = clamp(Math.floor(cx + rad * 2), 0, simW - 1);
    const minY = clamp(Math.floor(cy - rad * 2), 0, simH - 1);
    const maxY = clamp(Math.floor(cy + rad * 2), 0, simH - 1);

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const dx = x - cx;
        const dy = y - cy;
        const falloff = Math.exp(-(dx * dx + dy * dy) / (rad * rad));
        const i = idx(x, y);
        vx[i] += forceX * falloff;
        vy[i] += forceY * falloff;
        dyeR[i] += color.r * falloff;
        dyeG[i] += color.g * falloff;
        dyeB[i] += color.b * falloff;
      }
    }
  }

  function advectScalar(src, dst, dt, dissipation) {
    const dt0x = dt * (simW - 2);
    const dt0y = dt * (simH - 2);

    for (let y = 0; y < simH; y++) {
      for (let x = 0; x < simW; x++) {
        const i = idx(x, y);
        dst[i] =
          bilerp(src, x - vx[i] * dt0x, y - vy[i] * dt0y) * dissipation;
      }
    }
  }

  function advectVelocity(dt) {
    const dt0x = dt * (simW - 2);
    const dt0y = dt * (simH - 2);

    for (let y = 0; y < simH; y++) {
      for (let x = 0; x < simW; x++) {
        const i = idx(x, y);
        const backX = x - vx[i] * dt0x;
        const backY = y - vy[i] * dt0y;
        vx0[i] = bilerp(vx, backX, backY) * config.VELOCITY_DISSIPATION;
        vy0[i] = bilerp(vy, backX, backY) * config.VELOCITY_DISSIPATION;
      }
    }
    [vx, vx0] = [vx0, vx];
    [vy, vy0] = [vy0, vy];
  }

  function solvePressure() {
    for (let y = 1; y < simH - 1; y++) {
      for (let x = 1; x < simW - 1; x++) {
        const i = idx(x, y);
        divergence[i] =
          (vx[idx(x + 1, y)] -
            vx[idx(x - 1, y)] +
            vy[idx(x, y + 1)] -
            vy[idx(x, y - 1)]) *
          0.5;
        pressure[i] = 0;
      }
    }

    for (let k = 0; k < config.PRESSURE_ITERATIONS; k++) {
      for (let y = 1; y < simH - 1; y++) {
        for (let x = 1; x < simW - 1; x++) {
          const i = idx(x, y);
          pressure0[i] =
            (pressure[idx(x - 1, y)] +
              pressure[idx(x + 1, y)] +
              pressure[idx(x, y - 1)] +
              pressure[idx(x, y + 1)] -
              divergence[i]) *
            0.25;
        }
      }
      [pressure, pressure0] = [pressure0, pressure];
    }

    for (let y = 1; y < simH - 1; y++) {
      for (let x = 1; x < simW - 1; x++) {
        const i = idx(x, y);
        vx[i] -= (pressure[idx(x + 1, y)] - pressure[idx(x - 1, y)]) * 0.5;
        vy[i] -= (pressure[idx(x, y + 1)] - pressure[idx(x, y - 1)]) * 0.5;
      }
    }
  }

  function updatePointerFluid(dt) {
    pointer.smoothX += (pointer.targetX - pointer.smoothX) * config.FRICTION;
    pointer.smoothY += (pointer.targetY - pointer.smoothY) * config.FRICTION;

    const dx = pointer.smoothX - pointer.prevX;
    const dy = pointer.smoothY - pointer.prevY;
    pointer.speed = Math.hypot(dx, dy);

    const speedBoost = clamp(pointer.speed * 1.6, 0, 60);
    const intensity =
      config.COLOR_BASE_INTENSITY + speedBoost * config.COLOR_SPEED_INTENSITY;
    const hasInput = performance.now() - pointer.lastInputAt < POINTER_IDLE_MS;

    if (hasInput && pointer.speed > POINTER_SPLAT_SPEED) {
      const force = config.SPLAT_FORCE + speedBoost * config.SPEED_FORCE_GAIN;
      addSplat(
        clamp(pointer.smoothX / viewportWidthCss, 0, 1),
        clamp(pointer.smoothY / viewportHeightCss, 0, 1),
        dx * force * dt,
        dy * force * dt,
        config.SPLAT_RADIUS + speedBoost * config.SPEED_RADIUS_GAIN,
        {
          r: accent.r * intensity,
          g: accent.g * intensity,
          b: accent.b * intensity,
        },
      );
    }

    pointer.prevX = pointer.smoothX;
    pointer.prevY = pointer.smoothY;
  }

  function sampleCellColor(i) {
    const intensity = Math.max(0, dyeR[i], dyeG[i], dyeB[i]);
    const inv = intensity > 1e-6 ? 1 / intensity : 0;
    return {
      r: Math.max(0, dyeR[i]) * inv,
      g: Math.max(0, dyeG[i]) * inv,
      b: Math.max(0, dyeB[i]) * inv,
      alpha: clamp(
        clamp(intensity, 0, config.DYE_CLAMP) * config.RENDER_ALPHA,
        0,
        1,
      ),
    };
  }

  function renderSvgDye() {
    const unit = tile / GRID_SVG_SIZE;
    const vLineX = GRID_V_LINE_X * unit;
    const vLineLength = GRID_V_LINE_LENGTH * unit;
    const hLineY = GRID_H_LINE_Y * unit;
    const hLineLength = GRID_H_LINE_LENGTH * unit;
    const offsetY = -window.scrollY;
    const startY = offsetY - Math.ceil(offsetY / tile) * tile;

    ctx.clearRect(0, 0, width, height);
    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineCap = "butt";
    ctx.lineWidth = 1;

    for (let y = startY; y < viewportHeightCss; y += tile) {
      for (let x = 0; x < viewportWidthCss; x += tile) {
        const sx = clamp(
          Math.floor(((x + vLineX) / viewportWidthCss) * (simW - 1)),
          0,
          simW - 1,
        );
        const sy = clamp(
          Math.floor(((y + hLineY) / viewportHeightCss) * (simH - 1)),
          0,
          simH - 1,
        );
        const { r, g, b, alpha } = sampleCellColor(idx(sx, sy));
        if (alpha < 0.04) continue;

        ctx.strokeStyle = `rgba(${Math.floor(r * 255)},${Math.floor(g * 255)},${Math.floor(b * 255)},${alpha})`;
        ctx.beginPath();
        ctx.moveTo(x + vLineX, y);
        ctx.lineTo(x + vLineX, y + vLineLength);
        ctx.moveTo(x, y + hLineY);
        ctx.lineTo(x + hLineLength, y + hLineY);
        ctx.stroke();
      }
    }

    ctx.restore();
  }

  function frame(now) {
    if (lastTime === 0) lastTime = now;
    const dt = clamp((now - lastTime) * 0.001, 0.001, 0.018);
    lastTime = now;

    if (pointer.ready) updatePointerFluid(dt);

    advectVelocity(dt);
    solvePressure();
    advectScalar(dyeR, dyeR0, dt, config.DENSITY_DISSIPATION);
    advectScalar(dyeG, dyeG0, dt, config.DENSITY_DISSIPATION);
    advectScalar(dyeB, dyeB0, dt, config.DENSITY_DISSIPATION);
    [dyeR, dyeR0] = [dyeR0, dyeR];
    [dyeG, dyeG0] = [dyeG0, dyeG];
    [dyeB, dyeB0] = [dyeB0, dyeB];
    renderSvgDye();

    requestAnimationFrame(frame);
  }

  window.addEventListener("pointermove", (event) => {
    if (event.pointerType === "touch") return;
    pointer.targetX = event.clientX;
    pointer.targetY = event.clientY;
    pointer.ready = true;
    pointer.lastInputAt = performance.now();
  });

  window.addEventListener("resize", resize);
  window.visualViewport?.addEventListener("resize", resize);

  document.body.style.backgroundSize = `${tile}px ${tile}px`;
  document.body.style.backgroundPosition = "0 0";
  resize();
  requestAnimationFrame(frame);
}
