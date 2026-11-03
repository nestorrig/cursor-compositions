import * as THREE from "three/webgpu";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { bloom } from "three/addons/tsl/display/BloomNode.js";
import {
  abs,
  clamp,
  color,
  dot,
  emissive,
  float,
  floor,
  Fn,
  fract,
  length,
  max,
  min,
  mix,
  mrt,
  normalLocal,
  output,
  pass,
  renderOutput,
  screenCoordinate,
  step,
  texture,
  uniform,
  uv,
  vec2,
  vec3,
} from "three/tsl";
import gsap from "gsap";
import { Pointer } from "../../lib/pointer.js";
import { InkFluid } from "../../lib/inkFluid.js";
import { createLightformerEnvironment } from "../../lib/lightformers.js";
import { setupDebug } from "./debug.js";

class Scene {
  constructor() {
    this.canvas = document.querySelector("canvas.threejs");
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color("#004bff");
    this.debug = /debug/i.test(location.hash);
    this.debugOrbit = false;
    this.clock = new THREE.Clock();
    this.cubeLook = new THREE.Vector2();

    this.setupViewport();
    this.setupCamera();
    this.setupRenderer();

    this.pointer = new Pointer(0.16);
    this.inkFluid = new InkFluid(this.pointer, this.renderer);
    Object.assign(this.inkFluid.config, {
      textureDownsample: 1,
      densityDissipation: 0.962,
      velocityDissipation: 0.984,
      pressureDissipation: 0.7,
      pressureIterations: 12,
      curl: 24,
      splatRadius: 0.01,
      splatForce: 16,
      intensity: 1.05,
      flow: 1.45,
      bleed: 0.28,
      viscosity: 0.12,
      wetScale: 1.6,
      wetAmount: 0.12,
      hardness: 1.55,
      invertPointerY: true,
      maxVel: 90,
      minSpeed: 0.35,
      stepGap: 48,
    });

    // this.setupLights();
    this.setupGrid();
    this.setupCube();

    this.inkFluid.init().then(() => {
      this.setupEnvironment();
      this.setupPostProcessing();
      setupDebug(this);
      this.resize();
      this.renderer.setAnimationLoop(() => this.tick());
    });
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

  setupCamera() {
    this.camera = new THREE.PerspectiveCamera(35, this.aspect, 0.1, 100);
    this.cameraHome = new THREE.Vector3(0, 0, 7.2);
    this.lookHome = new THREE.Vector3(0, 0, 0);
    this.camera.position.copy(this.cameraHome);
    this.scene.add(this.camera);

    this.controls = new OrbitControls(this.camera, this.canvas);
    this.controls.target.copy(this.lookHome);
    this.controls.enableDamping = true;
    this.controls.enabled = false;
    this.camera.lookAt(this.lookHome);
  }

  setupRenderer() {
    this.renderer = new THREE.WebGPURenderer({
      canvas: this.canvas,
      antialias: false,
    });
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.renderer.toneMappingExposure = 1;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  }

  setupLights() {
    this.ambient = new THREE.AmbientLight(0xffffff, 0.35);
    this.scene.add(this.ambient);

    this.directional = new THREE.DirectionalLight(0xffffff, 1.6);
    this.directional.position.set(2.4, 3.6, 5.5);
    this.scene.add(this.directional);
  }

  setupEnvironment() {
    this.envColors = {
      background: "#004bff",
    };

    this.envStudio = createLightformerEnvironment(this.renderer, {
      background: this.envColors.background,
    });

    this.scene.environment = this.envStudio.texture;
    this.scene.environmentIntensity = 0;
  }

  rebuildEnvironment() {
    if (!this.envStudio) return;
    this.envStudio.scene.background.set(this.envColors.background);
    this.scene.environment = this.envStudio.bake();
  }

  setupPostProcessing() {
    this.pipeline = new THREE.RenderPipeline(this.renderer);
    this.pipeline.outputColorTransform = false;

    const scenePass = pass(this.scene, this.camera);
    scenePass.setMRT(
      mrt({
        output,
        emissive,
      }),
    );

    const sceneColor = scenePass.getTextureNode("output");
    const emissivePass = scenePass.getTextureNode("emissive");
    this.bloomPass = bloom(emissivePass, 0.2, 0.38, 0.08);

    this.pipeline.outputNode = renderOutput(sceneColor.add(this.bloomPass));
  }

  setupGrid() {
    this.grid = {
      cellCss: 40,
      cellSize: uniform(20),
      dyeClamp: uniform(1.15),
      stroke: uniform(0.03),
      resolution: uniform(new THREE.Vector2(1, 1)),
      paper: uniform(color("#000")),
      ink: uniform(color("#ffffff")),
    };

    this.dyeMap = texture(this.inkFluid.texture);

    const material = new THREE.MeshBasicNodeMaterial();
    material.colorNode = Fn(() => {
      const cellPx = max(this.grid.cellSize, float(4));
      const pix = screenCoordinate.xy;
      const cell = floor(pix.div(cellPx));
      const local = fract(pix.div(cellPx)).mul(2).sub(1);
      const res = this.grid.resolution;
      const sampleUV = vec2(
        cell.add(0.5).mul(cellPx).div(res.x).x,
        float(1).sub(cell.add(0.5).mul(cellPx).div(res.y).y),
      );

      const dye = this.dyeMap.sample(sampleUV);
      const intensity = max(max(dye.x, dye.y), dye.z);
      const t = clamp(intensity.div(this.grid.dyeClamp), 0, 0.999);
      const band = floor(t.mul(5));

      const stroke = this.grid.stroke;
      const circle = step(abs(length(local).sub(0.52)), stroke);

      const boxP = abs(local).sub(0.46);
      const box = length(max(boxP, float(0))).add(
        min(max(boxP.x, boxP.y), float(0)),
      );
      const square = step(abs(box), stroke);

      const sdSeg = (a, b) => {
        const pa = local.sub(a);
        const ba = b.sub(a);
        const h = clamp(dot(pa, ba).div(dot(ba, ba)), 0, 1);
        return length(pa.sub(ba.mul(h)));
      };

      const a = vec2(0, 0.62);
      const b = vec2(-0.7, -0.5);
      const c = vec2(0.7, -0.5);
      const triangle = step(
        min(min(sdSeg(a, b), sdSeg(b, c)), sdSeg(c, a)),
        stroke,
      );

      const cross = step(
        min(
          sdSeg(vec2(-0.52, -0.52), vec2(0.52, 0.52)),
          sdSeg(vec2(-0.52, 0.52), vec2(0.52, -0.52)),
        ),
        stroke,
      );

      const isCircle = step(0.5, band).mul(step(band, 1.5));
      const isTriangle = step(1.5, band).mul(step(band, 2.5));
      const isSquare = step(2.5, band).mul(step(band, 3.5));
      const isCross = step(3.5, band);

      const shape = isCircle
        .mul(circle)
        .add(isTriangle.mul(triangle))
        .add(isSquare.mul(square))
        .add(isCross.mul(cross));

      return mix(this.grid.paper, this.grid.ink, shape);
    })();

    this.gridMesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material);
    this.gridMesh.position.z = -0.2;
    this.scene.add(this.gridMesh);
  }

  setupCube() {
    this.cubeParams = {
      damp: 7.2,
      tilt: 0.7,
      restX: 0.18,
      restY: 0,
      scale: 0.3,
    };
    this.cubeGeo = {
      width: 1.25,
      height: 1.25,
      depth: 1.25,
      segments: 6,
      radius: 0.16,
    };
    this.mood = {
      awake: false,
      lastMove: 0,
      idleDelay: 1.35,
      prevX: this.pointer.raw.x,
      prevY: this.pointer.raw.y,
      sleepEyeH: 0.1,
      awakeEyeH: 1.6,
      sleepMouthW: 0.18,
      sleepMouthH: 0.01,
      awakeMouthW: 0.05,
      awakeMouthH: 0.05,
    };
    this.cubeFace = {
      ink: uniform(color("#ffffff")),
      emissive: uniform(3.2),
      eyeX: uniform(0.28),
      eyeY: uniform(0.2),
      eyeW: uniform(0.15),
      eyeH: uniform(this.mood.sleepEyeH),
      mouthY: uniform(-0.16),
      mouthW: uniform(this.mood.sleepMouthW),
      mouthH: uniform(this.mood.sleepMouthH),
    };
    this.cubeMatU = {
      transmission: uniform(1),
      color: uniform(color("#ffffff")),
    };
    this.blinkCall = null;
    this.blinkTl = null;

    const faceMask = Fn(() => {
      const front = step(0.62, normalLocal.z);
      const p = uv().mul(2).sub(1);
      const sdDash = (center, half) => {
        const d = abs(p.sub(center)).sub(half);
        return step(max(d.x, d.y), float(0));
      };
      const eye = vec2(this.cubeFace.eyeW, this.cubeFace.eyeH.mul(0.1));
      const left = sdDash(
        vec2(this.cubeFace.eyeX.mul(-1), this.cubeFace.eyeY),
        eye,
      );
      const right = sdDash(vec2(this.cubeFace.eyeX, this.cubeFace.eyeY), eye);
      const mouth = sdDash(
        vec2(0, this.cubeFace.mouthY),
        vec2(this.cubeFace.mouthW, this.cubeFace.mouthH),
      );
      return front.mul(max(max(left, right), mouth));
    })();

    const material = new THREE.MeshPhysicalNodeMaterial({
      color: "#004bff",
      metalness: 0,
      roughness: 0.045,
      transmission: 1,
      thickness: 0.8,
      ior: 1.68,
      dispersion: 25,
      iridescence: 0.42,
      iridescenceIOR: 1.32,
      iridescenceThicknessRange: [120, 420],
      specularIntensity: 1,
      clearcoat: 1,
      clearcoatRoughness: 0.03,
      attenuationColor: "#dcecff",
      attenuationDistance: 1.6,
    });
    material.colorNode = Fn(() => {
      return mix(this.cubeMatU.color, this.cubeFace.ink, faceMask);
    })();
    material.emissiveNode = Fn(() => {
      return this.cubeFace.ink.mul(faceMask).mul(this.cubeFace.emissive);
    })();
    material.transmissionNode = Fn(() => {
      return this.cubeMatU.transmission.mul(float(1).sub(faceMask));
    })();
    material.mrtNode = mrt({
      output,
      emissive: this.cubeFace.ink.mul(faceMask).mul(this.cubeFace.emissive),
    });

    this.cube = new THREE.Mesh(this.createCubeGeometry(), material);
    this.cube.position.set(0, 0, 0.85);
    this.cube.rotation.set(this.cubeParams.restX, this.cubeParams.restY, 0);
    this.scene.add(this.cube);
  }

  createCubeGeometry() {
    return new RoundedBoxGeometry(
      this.cubeGeo.width,
      this.cubeGeo.height,
      this.cubeGeo.depth,
      this.cubeGeo.segments,
      this.cubeGeo.radius,
    );
  }

  rebuildCubeGeometry() {
    this.cube.geometry.dispose();
    this.cube.geometry = this.createCubeGeometry();
  }

  layoutScene() {
    const distance = this.camera.position.distanceTo(this.lookHome);
    const viewH =
      2 * Math.tan(THREE.MathUtils.degToRad(this.camera.fov) * 0.5) * distance;
    const viewW = viewH * this.aspect;
    this.viewSize = { w: viewW, h: viewH };
    this.gridMesh.scale.set(viewW * 1.04, viewH * 1.04, 1);

    const pixelRatio = Math.min(window.devicePixelRatio, 2);
    this.grid.resolution.value.set(
      this.width * pixelRatio,
      this.height * pixelRatio,
    );
    this.grid.cellSize.value =
      this.grid.cellCss * Math.min(window.devicePixelRatio, 2);

    const minSide = Math.min(viewW, viewH);
    this.cube.scale.setScalar(minSide * this.cubeParams.scale);
    this.cube.position.set(0, 0, 0.85);
  }

  syncGridCellSize() {
    this.grid.cellSize.value =
      this.grid.cellCss * Math.min(window.devicePixelRatio, 2);
  }

  prefersReducedMotion() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  stopBlinks() {
    this.blinkCall?.kill();
    this.blinkTl?.kill();
    this.blinkCall = null;
    this.blinkTl = null;
  }

  setFace(eyeH, mouthW, mouthH, duration, ease) {
    gsap.to(this.cubeFace.eyeH, {
      value: eyeH,
      duration,
      ease,
      overwrite: "auto",
    });
    gsap.to(this.cubeFace.mouthW, {
      value: mouthW,
      duration,
      ease,
      overwrite: "auto",
    });
    gsap.to(this.cubeFace.mouthH, {
      value: mouthH,
      duration,
      ease,
      overwrite: "auto",
    });
  }

  sleep() {
    this.mood.awake = false;
    this.stopBlinks();
    this.setFace(
      this.mood.sleepEyeH,
      this.mood.sleepMouthW,
      this.mood.sleepMouthH,
      this.prefersReducedMotion() ? 0 : 0.48,
      "power2.inOut",
    );
  }

  wake() {
    this.mood.awake = true;
    this.setFace(
      this.mood.awakeEyeH,
      this.mood.awakeMouthW,
      this.mood.awakeMouthH,
      this.prefersReducedMotion() ? 0 : 0.28,
      "back.out(1.5)",
    );
    if (!this.prefersReducedMotion()) this.playActivationBlinks();
  }

  playActivationBlinks() {
    this.stopBlinks();
    const open = this.mood.awakeEyeH;
    const shut = this.mood.sleepEyeH;
    this.blinkTl = gsap.timeline({
      onComplete: () => this.queueIdleBlink(),
    });
    this.blinkTl
      .to(
        this.cubeFace.eyeH,
        {
          value: shut,
          duration: 0.055,
          ease: "power2.in",
          overwrite: "auto",
        },
        0.18,
      )
      .to(this.cubeFace.eyeH, {
        value: open,
        duration: 0.08,
        ease: "power2.out",
      })
      .to(
        this.cubeFace.eyeH,
        {
          value: shut,
          duration: 0.05,
          ease: "power2.in",
        },
        "+=0.22",
      )
      .to(this.cubeFace.eyeH, {
        value: open,
        duration: 0.09,
        ease: "power2.out",
      })
      .to(
        this.cubeFace.eyeH,
        {
          value: shut,
          duration: 0.05,
          ease: "power2.in",
        },
        "+=0.55",
      )
      .to(this.cubeFace.eyeH, {
        value: open,
        duration: 0.08,
        ease: "power2.out",
      });
  }

  queueIdleBlink() {
    this.blinkCall?.kill();
    if (!this.mood.awake || this.prefersReducedMotion()) return;
    this.blinkCall = gsap.delayedCall(2.1 + Math.random() * 2.6, () => {
      if (!this.mood.awake) return;
      const open = this.mood.awakeEyeH;
      this.blinkTl = gsap.timeline({
        onComplete: () => this.queueIdleBlink(),
      });
      this.blinkTl
        .to(this.cubeFace.eyeH, {
          value: this.mood.sleepEyeH,
          duration: 0.05,
          ease: "power2.in",
          overwrite: "auto",
        })
        .to(this.cubeFace.eyeH, {
          value: open,
          duration: 0.08,
          ease: "power2.out",
        });
    });
  }

  updateMood() {
    const dx = this.pointer.raw.x - this.mood.prevX;
    const dy = this.pointer.raw.y - this.mood.prevY;
    this.mood.prevX = this.pointer.raw.x;
    this.mood.prevY = this.pointer.raw.y;

    if (Math.hypot(dx, dy) > 0.6) {
      this.mood.lastMove = performance.now();
      if (!this.mood.awake) this.wake();
      return;
    }

    if (
      this.mood.awake &&
      performance.now() - this.mood.lastMove > this.mood.idleDelay * 1000
    ) {
      this.sleep();
    }
  }

  updateCube(delta) {
    this.updateMood();
    const lookAmt = this.mood.awake ? 1 : 0.12;
    this.cubeLook.set(
      this.pointer.normalized.x * this.cubeParams.tilt * lookAmt,
      -this.pointer.normalized.y * this.cubeParams.tilt * lookAmt,
    );
    this.cube.rotation.y = THREE.MathUtils.damp(
      this.cube.rotation.y,
      this.cubeParams.restY + this.cubeLook.x,
      this.cubeParams.damp,
      delta,
    );
    this.cube.rotation.x = THREE.MathUtils.damp(
      this.cube.rotation.x,
      this.cubeParams.restX + this.cubeLook.y,
      this.cubeParams.damp,
      delta,
    );
  }

  resize() {
    this.camera.aspect = this.aspect;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(this.width, this.height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    if (!this.debugOrbit) {
      this.camera.position.copy(this.cameraHome);
      this.camera.lookAt(this.lookHome);
    }
    this.inkFluid.resize();
    this.layoutScene();
  }

  tick() {
    const delta = this.clock.getDelta();
    this.inkFluid.step();
    this.updateCube(delta);
    if (this.debugOrbit) this.controls.update();
    if (this.pipeline) this.pipeline.render();
    else this.renderer.render(this.scene, this.camera);
  }
}

new Scene();
