import * as THREE from "three/webgpu";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { Pointer } from "../../lib/pointer.js";
import { VariableTitle } from "./VariableTitle.js";
import { setupDebug } from "./debug.js";
import {
  atan,
  color,
  float,
  fract,
  length,
  log,
  mix,
  step,
  time,
  uniform,
  uv,
} from "three/tsl";

const palette = {
  red: "#ff1a14",
  shade: "#07050c",
};

function map(value, inMin, inMax, outMin, outMax) {
  const t = (value - inMin) / (inMax - inMin);
  return outMin + t * (outMax - outMin);
}

const LAYOUT = {
  tablet: 720,
  desktop: 1200,
};

const CAMERA_POSES = {
  mobile: {
    position: [10.85, -32.76, 23.83],
    target: [1.07, 10.05, -6.13],
  },
  tablet: {
    position: [-10.22, -36.2, 24.68],
    target: [1.33, 6.03, -3.71],
  },
  desktop: {
    position: [-2.54, -33.94, 22.39],
    target: [3.16, 8.35, -2.29],
  },
};

const CURSOR_PRESETS = {
  mobile: {
    lineWidthMin: 0.9,
    lineWidthMax: 0.5,
    letterScaleMin: 1.2,
    letterScaleMax: 2.1,
    letterRadius: 1.4,
    cameraNudgeX: 1,
    cameraNudgeY: 0.7,
    lookNudgeX: 1.4,
    lookNudgeY: 1,
    vortexRotateZ: 0.3,
    offsetRotateZ: 0.3,
  },
  tablet: {
    lineWidthMin: 0.9,
    lineWidthMax: 0.5,
    letterScaleMin: 0.75,
    letterScaleMax: 1.9,
    letterRadius: 1.4,
    cameraNudgeX: 1.4,
    cameraNudgeY: 1,
    lookNudgeX: 1.9,
    lookNudgeY: 3,
    vortexRotateZ: 0.3,
    offsetRotateZ: -0.25,
  },
  desktop: {
    lineWidthMin: 0.9,
    lineWidthMax: 0.5,
    letterScaleMin: 0.2,
    letterScaleMax: 2.0,
    letterRadius: 1.9,
    cameraNudgeX: 1.8,
    cameraNudgeY: 0.2,
    lookNudgeX: 2.4,
    lookNudgeY: 1.6,
    vortexRotateZ: 0.35,
    offsetRotateZ: -0.15,
  },
};

function layoutFromWidth(width) {
  if (width >= LAYOUT.desktop) return "desktop";
  if (width >= LAYOUT.tablet) return "tablet";
  return "mobile";
}

class Scene {
  constructor() {
    this.canvas = document.querySelector("canvas.threejs");
    this.scene = new THREE.Scene();
    this.debug = /debug/i.test(location.hash);
    this.debugOrbit = false;
    this.pointer = new Pointer(0.12);
    this.baseCameraPosition = new THREE.Vector3();
    this.baseCameraTarget = new THREE.Vector3();
    this.cursorAnim = {
      pointerX: 0,
      pointerY: 0,
      lineWidth: 0.7,
      letterScale: 1,
      ...CURSOR_PRESETS.mobile,
    };

    this.setupViewport();
    this.applyCursorPreset();
    this.setupCamera();
    this.setupRenderer();
    this.setupVortex();

    this.title = new VariableTitle(
      document.querySelector("#title"),
      this.pointer,
      this.cursorAnim,
    );

    setupDebug(this);
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

  get breakpoint() {
    return layoutFromWidth(this.width);
  }

  applyCursorPreset() {
    Object.assign(this.cursorAnim, CURSOR_PRESETS[this.breakpoint]);
  }

  applyCameraPose() {
    const pose = CAMERA_POSES[this.breakpoint];
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
    this.layout = this.breakpoint;
    this.cameraLogAt = 0;
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
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
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
    geometry.computeBoundingSphere();
    return geometry;
  }

  rebuildVortexGeometry() {
    const previous = this.vortexMesh.geometry;
    this.vortexMesh.geometry = this.createVortexGeometry();
    previous.dispose();
  }

  setupVortex() {
    this.vortex = {
      lit: uniform(color(palette.red)),
      shade: uniform(color(palette.shade)),
      speed: uniform(1.6),
      density: uniform(11.9),
      turns: uniform(0),
      lineWidth: uniform(0.7),
      spin: uniform(0.82),
    };
    this.vortexLineWidth = this.vortex.lineWidth;

    const centered = uv().mul(2).sub(1);
    const radius = length(centered).max(0.0008);
    const angle = atan(centered.y, centered.x).add(time.mul(this.vortex.spin));
    const spiral = angle
      .div(float(Math.PI * 2))
      .mul(this.vortex.turns)
      .add(log(radius).mul(this.vortex.density))
      .add(time.mul(this.vortex.speed));
    const line = step(this.vortex.lineWidth, fract(spiral));

    const material = new THREE.MeshBasicNodeMaterial();
    material.colorNode = mix(this.vortex.shade, this.vortex.lit, line);
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
  }

  resize() {
    this.camera.aspect = this.aspect;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(this.width, this.height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    if (this.layout !== this.breakpoint) {
      this.layout = this.breakpoint;
      this.applyCursorPreset();
      this.applyCameraPose();
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
    this.vortexMesh.rotation.y =
      this.cursorAnim.offsetRotateZ + x * vortexRotateZ;
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

new Scene();
