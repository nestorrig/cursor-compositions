import * as THREE from "three/webgpu";
import {
  abs,
  clamp,
  dot,
  exp,
  float,
  Fn,
  length,
  max,
  mix,
  screenCoordinate,
  texture,
  uniform,
  vec2,
  vec3,
  vec4,
} from "three/tsl";

function passMaterial(colorNode) {
  const material = new THREE.NodeMaterial();
  material.fragmentNode = colorNode;
  material.depthTest = false;
  material.depthWrite = false;
  material.toneMapped = false;
  material.fog = false;
  material.transparent = false;
  return material;
}

export class InkFluid {
  constructor(pointer, renderer) {
    this.pointer = pointer;
    this.renderer = renderer;
    this.ready = false;
    this.config = {
      textureDownsample: 1,
      densityDissipation: 0.958,
      velocityDissipation: 0.991,
      pressureDissipation: 0.72,
      pressureIterations: 20,
      curl: 38,
      splatRadius: 0.003,
      splatForce: 9,
      intensity: 0.58,
      flow: 1.7,
      bleed: 0.42,
      viscosity: 0.2,
      wetScale: 3.1,
      wetAmount: 0.2,
      hardness: 0.7,
      maxVel: 70,
      minSpeed: 0.25,
      stepGap: 55,
      invertPointerY: false,
    };

    this.prev = { x: pointer.raw.x, y: pointer.raw.y };
    this.lastTime = performance.now();
    this.moved = false;
    this.size = new THREE.Vector2();
    this.clearColor = new THREE.Color();

    window.addEventListener("pointermove", () => {
      this.moved = true;
    });
    window.addEventListener(
      "touchmove",
      () => {
        this.moved = true;
      },
      { passive: true },
    );

    this.simW = Math.max(
      32,
      window.innerWidth >> this.config.textureDownsample,
    );
    this.simH = Math.max(
      32,
      window.innerHeight >> this.config.textureDownsample,
    );
    this.outputTarget = this.makeTarget(this.simW, this.simH, true);
    this.texture = this.outputTarget.texture;
    this.quad = new THREE.QuadMesh();
  }

  async init() {
    await this.renderer.init();
    this.createUniforms();
    this.createMaterials();
    this.resize(true);
    this.ready = true;
  }

  simUV() {
    return screenCoordinate.mul(this.texelSize);
  }

  makeTarget(width, height, linear) {
    const filter = linear ? THREE.LinearFilter : THREE.NearestFilter;
    const target = new THREE.RenderTarget(width, height, {
      depthBuffer: false,
      type: THREE.HalfFloatType,
      format: THREE.RGBAFormat,
      minFilter: filter,
      magFilter: filter,
      wrapS: THREE.ClampToEdgeWrapping,
      wrapT: THREE.ClampToEdgeWrapping,
      generateMipmaps: false,
    });
    target.texture.colorSpace = THREE.NoColorSpace;
    target.texture.generateMipmaps = false;
    return target;
  }

  makePingPong(width, height, linear) {
    return {
      read: this.makeTarget(width, height, linear),
      write: this.makeTarget(width, height, linear),
      swap() {
        const read = this.read;
        this.read = this.write;
        this.write = read;
      },
    };
  }

  createUniforms() {
    const seed = this.outputTarget.texture;
    this.uVelocity = texture(seed);
    this.uSource = texture(seed);
    this.uTarget = texture(seed);
    this.uCurl = texture(seed);
    this.uPressure = texture(seed);
    this.uDivergence = texture(seed);
    this.texelSize = uniform(new THREE.Vector2(1 / this.simW, 1 / this.simH));
    this.dt = uniform(0.016);
    this.dissipation = uniform(1);
    this.aspectRatio = uniform(1);
    this.splatPoint = uniform(new THREE.Vector2(0.5, 0.5));
    this.splatColor = uniform(new THREE.Vector3());
    this.splatRadius = uniform(this.config.splatRadius);
    this.curlAmount = uniform(this.config.curl);
    this.pressureFade = uniform(this.config.pressureDissipation);
    this.flow = uniform(this.config.flow);
    this.bleedAmount = uniform(this.config.bleed);
    this.viscousAmount = uniform(this.config.viscosity);
    this.splatHardness = uniform(this.config.hardness);
  }

  neighbors(uvn) {
    const texel = this.texelSize;
    return {
      uvn,
      L: uvn.sub(vec2(texel.x, 0)),
      R: uvn.add(vec2(texel.x, 0)),
      T: uvn.sub(vec2(0, texel.y)),
      B: uvn.add(vec2(0, texel.y)),
    };
  }

  createMaterials() {
    this.advectionMaterial = passMaterial(
      Fn(() => {
        const uvn = this.simUV();
        const vel = this.uVelocity.sample(uvn).xy;
        const coord = uvn.sub(
          this.dt.mul(vel).mul(this.texelSize).mul(this.flow),
        );
        return vec4(this.uSource.sample(coord).xyz.mul(this.dissipation), 1);
      })(),
    );

    this.splatMaterial = passMaterial(
      Fn(() => {
        const uvn = this.simUV();
        const offset = uvn.sub(this.splatPoint);
        const p = vec2(offset.x.mul(this.aspectRatio), offset.y);
        const radius = this.splatRadius.div(
          max(this.splatHardness, float(0.08)),
        );
        const falloff = exp(dot(p, p).mul(-1).div(radius));
        const splat = this.splatColor.mul(falloff);
        const base = this.uTarget.sample(uvn).xyz;
        return vec4(base.add(splat), 1);
      })(),
    );

    this.curlMaterial = passMaterial(
      Fn(() => {
        const { L, R, T, B } = this.neighbors(this.simUV());
        const vorticity = this.uVelocity
          .sample(R)
          .y.sub(this.uVelocity.sample(L).y)
          .sub(this.uVelocity.sample(T).x)
          .add(this.uVelocity.sample(B).x);
        return vec4(vorticity, 0, 0, 1);
      })(),
    );

    this.vorticityMaterial = passMaterial(
      Fn(() => {
        const { uvn, L, R, T, B } = this.neighbors(this.simUV());
        const l = this.uCurl.sample(L).x;
        const r = this.uCurl.sample(R).x;
        const t = this.uCurl.sample(T).x;
        const b = this.uCurl.sample(B).x;
        const c = this.uCurl.sample(uvn).x;
        const force = vec2(abs(t).sub(abs(b)), abs(r).sub(abs(l)));
        const mag = max(length(force), float(0.00001));
        const confined = force.div(mag).mul(this.curlAmount).mul(c);
        const vel = this.uVelocity.sample(uvn).xy.add(confined.mul(this.dt));
        return vec4(vel, 0, 1);
      })(),
    );

    this.divergenceMaterial = passMaterial(
      Fn(() => {
        const { L, R, T, B } = this.neighbors(this.simUV());
        const l = this.uVelocity.sample(clamp(L, 0, 1)).x;
        const r = this.uVelocity.sample(clamp(R, 0, 1)).x;
        const t = this.uVelocity.sample(clamp(T, 0, 1)).y;
        const b = this.uVelocity.sample(clamp(B, 0, 1)).y;
        const div = r.sub(l).add(t).sub(b).mul(0.5);
        return vec4(div, 0, 0, 1);
      })(),
    );

    this.clearMaterial = passMaterial(
      Fn(() => {
        return vec4(
          this.uSource.sample(this.simUV()).xyz.mul(this.pressureFade),
          1,
        );
      })(),
    );

    this.pressureMaterial = passMaterial(
      Fn(() => {
        const { uvn, L, R, T, B } = this.neighbors(this.simUV());
        const l = this.uPressure.sample(clamp(L, 0, 1)).x;
        const r = this.uPressure.sample(clamp(R, 0, 1)).x;
        const t = this.uPressure.sample(clamp(T, 0, 1)).x;
        const b = this.uPressure.sample(clamp(B, 0, 1)).x;
        const divergence = this.uDivergence.sample(uvn).x;
        const pressure = l.add(r).add(t).add(b).sub(divergence).mul(0.25);
        return vec4(pressure, 0, 0, 1);
      })(),
    );

    this.gradientMaterial = passMaterial(
      Fn(() => {
        const { uvn, L, R, T, B } = this.neighbors(this.simUV());
        const l = this.uPressure.sample(clamp(L, 0, 1)).x;
        const r = this.uPressure.sample(clamp(R, 0, 1)).x;
        const t = this.uPressure.sample(clamp(T, 0, 1)).x;
        const b = this.uPressure.sample(clamp(B, 0, 1)).x;
        const vel = this.uVelocity.sample(uvn).xy.sub(vec2(r.sub(l), t.sub(b)));
        return vec4(vel, 0, 1);
      })(),
    );

    this.diffuseMaterial = passMaterial(
      Fn(() => {
        const { uvn, L, R, T, B } = this.neighbors(this.simUV());
        const source = this.uSource;
        const center = source.sample(uvn);
        const blur = source
          .sample(L)
          .add(source.sample(R))
          .add(source.sample(T))
          .add(source.sample(B))
          .mul(0.25);
        return mix(center, blur, this.bleedAmount);
      })(),
    );

    this.copyMaterial = passMaterial(
      Fn(() => {
        const ink = this.uSource.sample(this.simUV()).xyz;
        const mask = max(max(ink.x, ink.y), ink.z);
        return vec4(vec3(mask), 1);
      })(),
    );
  }

  blit(material, target) {
    this.quad.material = material;
    this.renderer.setRenderTarget(target);
    this.quad.render(this.renderer);
  }

  withTarget(fn) {
    const renderer = this.renderer;
    const previousTarget = renderer.getRenderTarget();
    const previousAutoClear = renderer.autoClear;
    renderer.autoClear = false;
    try {
      fn();
    } finally {
      renderer.autoClear = previousAutoClear;
      renderer.setRenderTarget(previousTarget);
    }
  }

  clearTarget(target) {
    const renderer = this.renderer;
    const previousTarget = renderer.getRenderTarget();
    const previousAlpha = renderer.getClearAlpha();
    renderer.getClearColor(this.clearColor);
    renderer.setClearColor(0x000000, 1);
    renderer.setRenderTarget(target);
    renderer.clear();
    renderer.setClearColor(this.clearColor, previousAlpha);
    renderer.setRenderTarget(previousTarget);
  }

  clearSim() {
    const targets = [
      this.velocity.read,
      this.velocity.write,
      this.density.read,
      this.density.write,
      this.pressure.read,
      this.pressure.write,
      this.divergence,
      this.curlTarget,
      this.outputTarget,
    ];
    for (const target of targets) this.clearTarget(target);
  }

  resize(force = false) {
    if (!this.renderer || !this.texelSize) return;

    const width = Math.max(
      32,
      window.innerWidth >> this.config.textureDownsample,
    );
    const height = Math.max(
      32,
      window.innerHeight >> this.config.textureDownsample,
    );

    if (
      !force &&
      this.simW === width &&
      this.simH === height &&
      this.velocity
    ) {
      return;
    }

    this.simW = width;
    this.simH = height;
    this.texelSize.value.set(1 / width, 1 / height);
    this.aspectRatio.value = width / Math.max(height, 1);

    this.velocity?.read.dispose();
    this.velocity?.write.dispose();
    this.density?.read.dispose();
    this.density?.write.dispose();
    this.pressure?.read.dispose();
    this.pressure?.write.dispose();
    this.divergence?.dispose();
    this.curlTarget?.dispose();

    this.velocity = this.makePingPong(width, height, true);
    this.density = this.makePingPong(width, height, true);
    this.pressure = this.makePingPong(width, height, false);
    this.divergence = this.makeTarget(width, height, false);
    this.curlTarget = this.makeTarget(width, height, false);
    this.outputTarget.setSize(width, height);
    this.texture = this.outputTarget.texture;
    this.clearSim();
  }

  splat(x, y, dx, dy, amount, radius = this.config.splatRadius) {
    const width = Math.max(window.innerWidth, 1);
    const height = Math.max(window.innerHeight, 1);
    const uvY = this.config.invertPointerY ? 1 - y / height : y / height;
    this.splatPoint.value.set(x / width, uvY);
    this.splatRadius.value = radius;
    this.splatHardness.value = this.config.hardness;
    this.aspectRatio.value = this.simW / Math.max(this.simH, 1);

    this.uTarget.value = this.velocity.read.texture;
    this.splatColor.value.set(dx, this.config.invertPointerY ? -dy : dy, 0);
    this.blit(this.splatMaterial, this.velocity.write);
    this.velocity.swap();

    this.uTarget.value = this.density.read.texture;
    this.splatColor.value.set(amount, amount, amount);
    this.blit(this.splatMaterial, this.density.write);
    this.density.swap();
  }

  splatPointer() {
    const x = this.pointer.raw.x;
    const y = this.pointer.raw.y;
    const dx = (x - this.prev.x) * this.config.splatForce;
    const dy = (y - this.prev.y) * this.config.splatForce;
    const speed = Math.hypot(dx, dy);

    if (this.moved && speed >= this.config.minSpeed) {
      const steps = Math.max(
        1,
        Math.min(10, Math.ceil(speed / this.config.stepGap)),
      );
      const vScale =
        speed > this.config.maxVel ? this.config.maxVel / speed : 1;
      const vx = (dx * vScale) / steps;
      const vy = (dy * vScale) / steps;
      const amount = this.config.intensity / Math.sqrt(steps);
      for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        this.splat(
          this.prev.x + (x - this.prev.x) * t,
          this.prev.y + (y - this.prev.y) * t,
          vx,
          vy,
          amount,
        );
      }

      this.splat(
        x,
        y,
        vx * 0.28,
        vy * 0.28,
        this.config.wetAmount,
        this.config.splatRadius * this.config.wetScale,
      );
    }

    this.prev.x = x;
    this.prev.y = y;
    this.moved = false;
  }

  step() {
    if (!this.ready) return;

    const now = performance.now();
    const dt = Math.min((now - this.lastTime) * 0.001, 0.016);
    this.lastTime = now;
    this.dt.value = dt;
    this.texelSize.value.set(1 / this.simW, 1 / this.simH);
    this.curlAmount.value = this.config.curl;
    this.pressureFade.value = this.config.pressureDissipation;
    this.flow.value = this.config.flow;
    this.splatHardness.value = this.config.hardness;

    this.withTarget(() => {
      this.uVelocity.value = this.velocity.read.texture;
      this.uSource.value = this.velocity.read.texture;
      this.dissipation.value = this.config.velocityDissipation;
      this.blit(this.advectionMaterial, this.velocity.write);
      this.velocity.swap();

      if (this.config.viscosity > 0) {
        this.bleedAmount.value = this.config.viscosity;
        this.uSource.value = this.velocity.read.texture;
        this.blit(this.diffuseMaterial, this.velocity.write);
        this.velocity.swap();
      }

      this.uVelocity.value = this.velocity.read.texture;
      this.uSource.value = this.density.read.texture;
      this.dissipation.value = this.config.densityDissipation;
      this.blit(this.advectionMaterial, this.density.write);
      this.density.swap();

      this.splatPointer();

      if (this.config.bleed > 0) {
        this.bleedAmount.value = this.config.bleed;
        this.uSource.value = this.density.read.texture;
        this.blit(this.diffuseMaterial, this.density.write);
        this.density.swap();
      }

      this.uVelocity.value = this.velocity.read.texture;
      this.blit(this.curlMaterial, this.curlTarget);

      this.uVelocity.value = this.velocity.read.texture;
      this.uCurl.value = this.curlTarget.texture;
      this.blit(this.vorticityMaterial, this.velocity.write);
      this.velocity.swap();

      this.uVelocity.value = this.velocity.read.texture;
      this.blit(this.divergenceMaterial, this.divergence);

      this.uSource.value = this.pressure.read.texture;
      this.blit(this.clearMaterial, this.pressure.write);
      this.pressure.swap();

      this.uDivergence.value = this.divergence.texture;
      for (let i = 0; i < this.config.pressureIterations; i++) {
        this.uPressure.value = this.pressure.read.texture;
        this.blit(this.pressureMaterial, this.pressure.write);
        this.pressure.swap();
      }

      this.uPressure.value = this.pressure.read.texture;
      this.uVelocity.value = this.velocity.read.texture;
      this.blit(this.gradientMaterial, this.velocity.write);
      this.velocity.swap();

      this.uSource.value = this.density.read.texture;
      this.blit(this.copyMaterial, this.outputTarget);
    });
  }
}
