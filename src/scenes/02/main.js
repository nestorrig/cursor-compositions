import * as THREE from "three/webgpu";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { Inspector } from "three/addons/inspector/Inspector.js";
import {
  atan,
  color,
  float,
  fract,
  length,
  lightPosition,
  lightTargetPosition,
  log,
  mix,
  mrt,
  normalWorld,
  output,
  pass,
  step,
  time,
  uniform,
  uv,
} from "three/tsl";

const palette = {
  red: "#ff1a14",
  shade: "#07050c",
  sphere: "#f4f0ea",
  hole: "#05040a",
};

function map(value, inMin, inMax, outMin, outMax) {
  const t = (value - inMin) / (inMax - inMin);
  return outMin + t * (outMax - outMin);
}

class Pointer {
  constructor(cof = 0.08) {
    this.cof = cof;
    this.raw = {
      x: window.innerWidth * 0.5,
      y: window.innerHeight * 0.5,
    };
    this.smoothed = { ...this.raw };
    this.normalized = { x: 0, y: 0 };

    window.addEventListener("pointermove", (event) => {
      this.raw.x = event.clientX;
      this.raw.y = event.clientY;
    });

    const loop = () => {
      this.update();
      requestAnimationFrame(loop);
    };
    loop();
  }

  update() {
    this.smoothed.x += (this.raw.x - this.smoothed.x) * this.cof;
    this.smoothed.y += (this.raw.y - this.smoothed.y) * this.cof;
    this.normalized.x = (this.smoothed.x / window.innerWidth) * 2 - 1;
    this.normalized.y = -(this.smoothed.y / window.innerHeight) * 2 + 1;
  }
}

class VariableTitle {
  constructor(element, pointer, cursorAnim) {
    this.element = element;
    this.container = element.parentElement;
    this.pointer = pointer;
    this.cursorAnim = cursorAnim;
    this.text = element.textContent.trim();
    this.chars = [];
    this.wdth = 100;
    this.baseWdth = 100;
    this.baseWeight = 200;
    this.maxDist = 1;
    this.fitting = false;

    this.probe = document.createElement("span");
    this.probe.setAttribute("aria-hidden", "true");
    this.probe.style.cssText =
      "position:absolute;left:-9999px;top:0;white-space:nowrap;visibility:hidden;font-family:'Google Sans Flex',sans-serif;font-optical-sizing:auto;line-height:0.82;";
    document.body.appendChild(this.probe);

    element.textContent = "";
    for (const char of this.text) {
      const span = document.createElement("span");
      span.dataset.char = char;
      span.textContent = char;
      element.appendChild(span);
      this.chars.push({ span });
    }

    this.resizeObserver = new ResizeObserver(() => {
      clearTimeout(this.resizeTimeout);
      this.resizeTimeout = setTimeout(() => this.fit(), 80);
    });
    this.resizeObserver.observe(this.container);

    document.fonts.ready.then(() => this.fit());
    this.fit();
    this.animate();
  }

  measure(fontSize, wdth, wght) {
    this.probe.style.fontSize = `${fontSize}px`;
    this.probe.style.fontWeight = `${wght}`;
    this.probe.style.fontVariationSettings = `"wght" ${wght}, "wdth" ${wdth}, "slnt" 0, "ROND" 0`;
    this.probe.textContent = this.text;
    return this.probe.getBoundingClientRect().width;
  }

  applyAxes(wdth, wght) {
    const settings = `"wght" ${wght}, "wdth" ${wdth}, "slnt" 0, "ROND" 0`;
    this.element.style.fontWeight = `${wght}`;
    this.element.style.fontVariationSettings = settings;
    for (const char of this.chars) {
      char.span.style.fontWeight = `${wght}`;
      char.span.style.fontVariationSettings = settings;
    }
  }

  fit() {
    const width = Math.floor(this.element.clientWidth);
    const height = Math.floor(this.element.clientHeight);
    if (width <= 0 || height <= 0) return;

    this.fitting = true;
    const fontSize = Math.max(8, Math.round(height / 0.82));
    this.element.style.fontSize = `${fontSize}px`;

    let low = 25;
    let high = 151;
    let best = 100;
    const target = width * 0.985;

    for (let index = 0; index < 14; index++) {
      const mid = (low + high) / 2;
      const measured = this.measure(fontSize, mid, this.baseWeight);
      if (measured > target) high = mid;
      else low = mid;
      best = mid;
    }

    this.wdth = Math.round(best);
    this.applyAxes(this.wdth, this.baseWeight);

    void this.element.offsetWidth;
    let actual = 0;
    for (const char of this.chars) {
      actual += char.span.getBoundingClientRect().width;
    }

    let safety = 0;
    while (actual > target && this.wdth > 25 && safety < 8) {
      this.wdth -= 2;
      this.applyAxes(this.wdth, this.baseWeight);
      void this.element.offsetWidth;
      actual = 0;
      for (const char of this.chars) {
        actual += char.span.getBoundingClientRect().width;
      }
      safety += 1;
    }

    this.baseWdth = this.wdth;
    this.fitting = false;
  }

  scaleFromDistance(dist) {
    const min = this.cursorAnim.letterScaleMin;
    const max = this.cursorAnim.letterScaleMax;
    const t = 1 - Math.min(dist / this.maxDist, 1);
    return min + t * t * (max - min);
  }

  animate() {
    this.render();
    requestAnimationFrame(() => this.animate());
  }

  render() {
    if (this.fitting) return;

    this.maxDist = this.element.clientWidth * this.cursorAnim.letterRadius;
    const pointerX = this.pointer.smoothed.x;
    let nearestScale = this.cursorAnim.letterScaleMin;

    for (const char of this.chars) {
      const box = char.span.getBoundingClientRect();
      const dist = Math.abs(pointerX - (box.x + box.width / 1.75));
      const scaleY = this.scaleFromDistance(dist);
      char.span.style.transform = `scaleY(${scaleY})`;
      nearestScale = Math.max(nearestScale, scaleY);
    }

    this.cursorAnim.letterScale = nearestScale;
  }
}

class Scene02 {
  constructor() {
    this.canvas = document.querySelector("canvas.threejs");
    this.scene = new THREE.Scene();
    this.scene.background = null;
    this.clock = new THREE.Clock();
    this.debugOrbit = false;
    this.pointer = new Pointer(0.12);
    this.baseCameraPosition = new THREE.Vector3();
    this.baseCameraTarget = new THREE.Vector3();
    this.cursorAnim = {
      pointerX: 0,
      pointerY: 0,
      lineWidth: 0.7,
      letterScale: 1,
      lineWidthMin: 0.9,
      lineWidthMax: 0.5,
      letterScaleMin: 0.7,
      letterScaleMax: 1.8,
      letterRadius: 1.4,
      cameraNudgeX: 1.8,
      cameraNudgeY: 1.2,
      lookNudgeX: 2.4,
      lookNudgeY: 1.6,
      vortexRotateZ: 0.25,
    };

    this.setupViewport();
    this.applyLetterScale();
    this.setupCamera();
    this.setupRenderer();
    this.setupLights();
    this.setupVortex();
    this.setupPostProcessing();
    this.renderer.inspector.profiler.show(this.renderer.inspector.parameters);

    this.title = new VariableTitle(
      document.querySelector("#title"),
      this.pointer,
      this.cursorAnim,
    );

    this.resize();
    this.renderer.setAnimationLoop(() => this.tick());
  }

  setupViewport() {
    this.width = window.innerWidth;
    this.height = window.innerHeight;

    window.addEventListener("resize", () => {
      this.width = window.innerWidth;
      this.height = window.innerHeight;
      this.resize();
    });
  }

  get aspect() {
    return this.width / this.height;
  }

  get isMobile() {
    return this.width < 768;
  }

  applyLetterScale() {
    const scale = this.isMobile
      ? { min: 0.95, max: 2 }
      : { min: 0.7, max: 1.8 };

    this.cursorAnim.letterScaleMin = scale.min;
    this.cursorAnim.letterScaleMax = scale.max;
  }

  applyCameraPose() {
    const pose = this.isMobile
      ? {
          position: [10.85, -32.76, 23.83],
          target: [1.07, 10.05, -6.13],
        }
      : {
          position: [-10.22, -32.2, 24.68],
          target: [1.33, 6.03, -3.71],
        };

    this.camera.position.set(...pose.position);
    this.controls.target.set(...pose.target);
    this.baseCameraPosition.copy(this.camera.position);
    this.baseCameraTarget.copy(this.controls.target);
    this.controls.update();
  }

  setupCamera() {
    this.camera = new THREE.PerspectiveCamera(42, this.aspect, 0.1, 200);
    this.scene.add(this.camera);

    this.controls = new OrbitControls(this.camera, this.canvas);
    this.controls.enableDamping = true;
    this.controls.enabled = this.debugOrbit;
    this.applyCameraPose();
    this.mobileCamera = this.isMobile;
    this.cameraLogAt = 0;
    this.controls.addEventListener("change", () => this.logCameraPose());
    this.controls.addEventListener("end", () => this.logCameraPose(true));
  }

  logCameraPose(force = false) {
    const now = performance.now();
    if (!force && now - this.cameraLogAt < 200) return;
    this.cameraLogAt = now;

    const p = this.camera.position;
    const t = this.controls.target;
    console.log(
      `camera.position.set(${p.x.toFixed(2)}, ${p.y.toFixed(2)}, ${p.z.toFixed(2)});\nthis.controls.target.set(${t.x.toFixed(2)}, ${t.y.toFixed(2)}, ${t.z.toFixed(2)});`,
    );
  }

  setupRenderer() {
    this.renderer = new THREE.WebGPURenderer({
      canvas: this.canvas,
      antialias: false,
      alpha: true,
    });

    this.renderer.toneMapping = THREE.NoToneMapping;
    this.renderer.toneMappingExposure = 1;
    this.renderer.shadowMap.enabled = false;
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.inspector = new Inspector();
    this.renderer.inspector.domElement.style.display = "none";
  }

  setupLights() {
    this.directional = new THREE.DirectionalLight(0xffffff, 1);
    this.directional.position.set(5, 7, 10);
    this.scene.add(this.directional);
    this.scene.add(this.directional.target);

    this.lightDirectionNode = lightPosition(this.directional)
      .sub(lightTargetPosition(this.directional))
      .normalize();

    const folder = this.renderer.inspector.createParameters("Light");
    folder.add(this.directional.position, "x", -20, 20, 0.1).name("positionX");
    folder.add(this.directional.position, "y", 0.1, 20, 0.1).name("positionY");
    folder.add(this.directional.position, "z", -20, 20, 0.1).name("positionZ");

    const debug = this.renderer.inspector.createParameters("Debug");
    debug
      .add(this, "debugOrbit")
      .name("orbitControls")
      .onChange((value) => {
        this.controls.enabled = value;
        if (!value) this.applyCameraPose();
      });

    const cursor = this.renderer.inspector.createParameters("Cursor");
    cursor
      .add(this.cursorAnim, "pointerX", -1, 1, 0.01)
      .name("pointerX")
      .listen();
    cursor
      .add(this.cursorAnim, "pointerY", -1, 1, 0.01)
      .name("pointerY")
      .listen();
    cursor
      .add(this.cursorAnim, "lineWidth", 0.05, 0.95, 0.01)
      .name("lineWidth")
      .listen();
    cursor
      .add(this.cursorAnim, "letterScale", 1, 3, 0.01)
      .name("letterScale")
      .listen();
    cursor
      .add(this.cursorAnim, "lineWidthMin", 0.05, 0.95, 0.01)
      .name("lineWidthMin");
    cursor
      .add(this.cursorAnim, "lineWidthMax", 0.05, 0.95, 0.01)
      .name("lineWidthMax");
    cursor
      .add(this.cursorAnim, "letterScaleMin", 0.4, 2, 0.01)
      .name("letterScaleMin");
    cursor
      .add(this.cursorAnim, "letterScaleMax", 1, 3, 0.01)
      .name("letterScaleMax");
    cursor
      .add(this.cursorAnim, "letterRadius", 0.2, 3, 0.01)
      .name("letterRadius");
    cursor
      .add(this.cursorAnim, "cameraNudgeX", 0, 8, 0.01)
      .name("cameraNudgeX");
    cursor
      .add(this.cursorAnim, "cameraNudgeY", 0, 8, 0.01)
      .name("cameraNudgeY");
    cursor.add(this.cursorAnim, "lookNudgeX", 0, 8, 0.01).name("lookNudgeX");
    cursor.add(this.cursorAnim, "lookNudgeY", 0, 8, 0.01).name("lookNudgeY");
    cursor
      .add(this.cursorAnim, "vortexRotateZ", 0, 2, 0.01)
      .name("vortexRotateZ");
  }

  createPosterMaterial({ name, lit, shade, threshold = 0 }) {
    const litColor = uniform(color(lit));
    const shadeColor = uniform(color(shade));
    const cutoff = uniform(threshold);

    const facingLight = step(cutoff, normalWorld.dot(this.lightDirectionNode));

    const material = new THREE.MeshBasicNodeMaterial();
    material.colorNode = mix(shadeColor, litColor, facingLight);
    material.mrtNode = mrt({
      output,
      normal: normalWorld,
    });

    const folder = this.renderer.inspector.createParameters(name);
    folder.addColor(litColor, "value").name("lit");
    folder.addColor(shadeColor, "value").name("shadow");
    folder.add(cutoff, "value", -1, 1, 0.01).name("threshold");

    return material;
  }

  createVortexGeometry() {
    const { inner, outer, depth, power } = this.vortexShape;
    const geometry = new THREE.RingGeometry(inner, outer, 128, 64);
    const position = geometry.attributes.position;

    for (let index = 0; index < position.count; index++) {
      const x = position.getX(index);
      const y = position.getY(index);
      const t = THREE.MathUtils.clamp(
        (Math.hypot(x, y) - inner) / (outer - inner),
        0,
        1,
      );
      position.setZ(index, -depth * Math.pow(1 - t, power));
    }

    position.needsUpdate = true;
    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();
    return geometry;
  }

  rebuildVortexGeometry() {
    const previous = this.vortexMesh.geometry;
    this.vortexMesh.geometry = this.createVortexGeometry();
    previous.dispose();
  }

  setupVortex() {
    const litColor = uniform(color(palette.red));
    const shadeColor = uniform(color(palette.shade));
    const speed = uniform(1.6);
    const density = uniform(11.9);
    const turns = uniform(0);
    const lineWidth = uniform(0.7);
    const spin = uniform(0.82);
    this.vortexSpeed = speed;
    this.vortexLineWidth = lineWidth;

    const centered = uv().mul(2).sub(1);
    const radius = length(centered).max(0.0008);
    const angle = atan(centered.y, centered.x).add(time.mul(spin));
    const spiral = angle
      .div(float(Math.PI * 2))
      .mul(turns)
      .add(log(radius).mul(density))
      .add(time.mul(speed));
    const line = step(lineWidth, fract(spiral));

    const material = new THREE.MeshBasicNodeMaterial();
    material.colorNode = mix(shadeColor, litColor, line);
    material.side = THREE.DoubleSide;

    this.vortexShape = {
      inner: 0.05,
      outer: 40,
      depth: 31.9,
      power: 3.77,
    };

    this.vortexMesh = new THREE.Mesh(this.createVortexGeometry(), material);
    this.vortexMesh.rotation.x = -0.48;
    this.scene.add(this.vortexMesh);

    const folder = this.renderer.inspector.createParameters("Vortex");
    folder.addColor(litColor, "value").name("lit");
    folder.addColor(shadeColor, "value").name("shadow");
    folder.add(speed, "value", 0, 4, 0.01).name("speed");
    folder.add(density, "value", 2, 40, 0.1).name("density");
    folder.add(turns, "value", 0, 8, 1).name("turns");
    folder.add(lineWidth, "value", 0.05, 0.95, 0.01).name("lineWidth");
    folder.add(spin, "value", 0, 2, 0.01).name("spin");

    const shape = this.renderer.inspector.createParameters("Shape");
    shape
      .add(this.vortexShape, "inner", 0.05, 8, 0.01)
      .onChange(() => this.rebuildVortexGeometry());
    shape
      .add(this.vortexShape, "outer", 4, 40, 0.1)
      .onChange(() => this.rebuildVortexGeometry());
    shape
      .add(this.vortexShape, "depth", 1, 60, 0.1)
      .onChange(() => this.rebuildVortexGeometry());
    shape
      .add(this.vortexShape, "power", 0.2, 8, 0.01)
      .onChange(() => this.rebuildVortexGeometry());
  }

  setupPostProcessing() {
    this.pipeline = new THREE.RenderPipeline(this.renderer);
    this.pipeline.outputColorTransform = false;

    const scenePass = pass(this.scene, this.camera);
    scenePass.transparent = true;
    scenePass.setMRT(
      mrt({
        output,
        normal: normalWorld,
      }),
    );

    this.pipeline.outputNode = scenePass.getTextureNode("output");
  }

  resize() {
    this.camera.aspect = this.aspect;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(this.width, this.height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    if (this.mobileCamera !== this.isMobile) {
      this.mobileCamera = this.isMobile;
      this.applyCameraPose();
      this.applyLetterScale();
    }
  }

  updateCameraFromPointer() {
    const { x, y } = this.pointer.normalized;
    const { cameraNudgeX, cameraNudgeY, lookNudgeX, lookNudgeY } =
      this.cursorAnim;
    this.camera.position.copy(this.baseCameraPosition);
    this.camera.position.x += x * cameraNudgeX;
    this.camera.position.y += y * cameraNudgeY;
    this.controls.target.copy(this.baseCameraTarget);
    this.controls.target.x += x * lookNudgeX;
    this.controls.target.y += y * lookNudgeY;
    this.camera.lookAt(this.controls.target);
  }

  updateVortexFromPointer() {
    const { x } = this.pointer.normalized;
    const { lineWidthMin, lineWidthMax, vortexRotateZ } = this.cursorAnim;
    this.vortexLineWidth.value = map(x, -1, 1, lineWidthMin, lineWidthMax);
    this.cursorAnim.lineWidth = this.vortexLineWidth.value;
    this.vortexMesh.rotation.y = 0.1 + x * vortexRotateZ;
  }

  tick() {
    this.cursorAnim.pointerX = this.pointer.normalized.x;
    this.cursorAnim.pointerY = this.pointer.normalized.y;

    if (this.debugOrbit) {
      this.controls.update();
      this.cursorAnim.lineWidth = this.vortexLineWidth.value;
    } else {
      this.updateCameraFromPointer();
      this.updateVortexFromPointer();
    }

    this.renderer.render(this.scene, this.camera);
  }
}

new Scene02();
