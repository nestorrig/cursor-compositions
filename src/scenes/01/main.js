import * as THREE from "three/webgpu";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import {
  color,
  Fn,
  mix,
  mrt,
  mx_noise_float,
  normalWorld,
  output,
  pass,
  renderOutput,
  screenCoordinate,
  screenUV,
  step,
  texture,
  uniform,
  vec3,
  vec4,
} from "three/tsl";
import { fxaa } from "three/addons/tsl/display/FXAANode.js";
import gsap from "gsap";
import { sobel } from "three/addons/tsl/display/SobelOperatorNode.js";
import { Pointer } from "../02/Pointer.js";
import { createBasicNodeMaterial } from "../../lib/posterMaterial.js";
import { InkFluid } from "./inkFluid.js";
import { setupDebug } from "./debug.js";

const randomRange = (min, max) => Math.random() * (max - min) + min;

class Scene01 {
  constructor() {
    this.canvas = document.querySelector("canvas.threejs");
    this.scene = new THREE.Scene();
    this.backgroundColor = new THREE.Color("#fff");
    this.scene.background = this.backgroundColor;
    this.debug = /debug/i.test(location.hash);
    this.debugOrbit = false;
    this.clock = new THREE.Clock();

    this.setupViewport();
    this.setupCamera();
    this.setupRenderer();

    this.pointer = new Pointer(0.18);
    this.inkFluid = new InkFluid(this.pointer, this.renderer);
    this.inkFluid.init();
    this.setupLights();
    this.setupPrismalPiramid();
    this.setupPostProcessing();
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

  setupCamera() {
    this.camera = new THREE.PerspectiveCamera(35, this.aspect, 0.1, 100);
    this.cameraHomes = {
      mobile: new THREE.Vector3(-26, -14, -26),
      tablet: new THREE.Vector3(-20, -11, -20),
      desktop: new THREE.Vector3(-15, -8, -15),
    };
    this.cameraHome = this.cameraHomes.mobile.clone();
    this.lookHome = new THREE.Vector3(0.1, 0.4, -0.2);
    this.cameraTarget = this.cameraHome.clone();
    this.parallax = { x: 5.2, y: 5.1, damp: 0.5 };
    this.updateCameraHome();
    this.camera.position.copy(this.cameraHome);
    this.scene.add(this.camera);

    this.controls = new OrbitControls(this.camera, this.canvas);
    this.controls.target.copy(this.lookHome);
    this.controls.enableDamping = true;
    this.controls.enabled = false;
    this.camera.lookAt(this.lookHome);
  }

  get cameraBreakpoint() {
    if (this.width >= 1024) return "desktop";
    if (this.width >= 720) return "tablet";
    return "mobile";
  }

  updateCameraHome() {
    this.cameraHome.copy(this.cameraHomes[this.cameraBreakpoint]);
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
    this.ambient = new THREE.AmbientLight(0xffffff, 1.5);
    this.scene.add(this.ambient);

    this.directional = new THREE.DirectionalLight(0xffffff, 1);
    this.directional.position.set(10, -5, 6);
    this.scene.add(this.directional);
    this.scene.add(this.directional.target);

    this.hemisphere = new THREE.HemisphereLight(0xffffff, 0x334455, 0.45);
    this.scene.add(this.hemisphere);
  }

  blackMaterial() {
    return createBasicNodeMaterial({
      color: "#000000",
    });
  }

  setupPrismalPiramid() {
    this.pyramidParams = {
      steps: 8,
      stepThickness: 0.7,
      stepSpacing: 1.1,
      stepScale: 2,
      tipSize: 1,
      tipOffset: -1.2,
      groupY: -5,
      groupScale: 0.5,
      sphereCount: 5,
      sphereY: 15,
      sphereBaseScale: 5,
      sphereSpread: 8,
    };

    this.prismalPiramid = new THREE.Group();
    this.scene.add(this.prismalPiramid);

    this.pyramidMaterial = new THREE.MeshStandardNodeMaterial({
      color: "black",
    });
    this.sphereMaterial = this.blackMaterial();
    this.centerSphereMaterial = this.blackMaterial();
    this.orbitParams = {
      duration: 18,
      floatAmp: 1.4,
      floatDuration: 2.6,
      tilt: 0.22,
    };
    this.prismSpinParams = {
      delayMin: 0.2,
      delayMax: 1.2,
      duration: 0.8,
    };

    this.rebuildPyramid();
  }

  clearPyramid() {
    const disposed = new Set();

    this.prismalPiramid.traverse((child) => {
      if (child.geometry && !disposed.has(child.geometry)) {
        disposed.add(child.geometry);
        child.geometry.dispose();
      }
    });

    this.prismalPiramid.clear();
  }

  rebuildPyramid() {
    this.stopSphereMotion();
    this.stopPrismSpin();

    const {
      steps,
      stepThickness,
      stepSpacing,
      stepScale,
      tipSize,
      tipOffset,
      groupY,
      groupScale,
    } = this.pyramidParams;

    this.clearPyramid();
    this.prismalPiramid.position.set(0, groupY, 0);
    this.prismalPiramid.scale.setScalar(groupScale);

    const slabGeometry = new THREE.BoxGeometry(1, 1, 1);
    this.pyramidSlabs = [];

    for (let index = 0; index < steps; index++) {
      const mesh = new THREE.Mesh(slabGeometry, this.pyramidMaterial);
      const size = (index + 1) * stepScale;
      mesh.position.set(0, index * stepSpacing, 0);
      mesh.scale.set(size, stepThickness, size);
      this.prismalPiramid.add(mesh);
      this.pyramidSlabs.push(mesh);
    }

    const tipGeometry = new THREE.ConeGeometry(1, 1, 4, 1, true).toNonIndexed();
    tipGeometry.computeVertexNormals();

    const tip = new THREE.Mesh(tipGeometry, this.pyramidMaterial);
    tip.position.set(0, tipOffset, 0);
    tip.scale.setScalar(tipSize);
    tip.rotation.set(Math.PI, Math.PI * 0.25, 0);
    this.prismalPiramid.add(tip);

    this.rebuildSpheres();
  }

  rebuildSpheres() {
    const { sphereCount, sphereY, sphereBaseScale, sphereSpread } =
      this.pyramidParams;

    const geometry = new THREE.SphereGeometry(1, 64, 64);

    this.centerSphere = null;
    this.orbitPivot = new THREE.Group();
    this.orbitPivot.position.set(0, sphereY, 0);
    this.orbitPivot.rotation.x = this.orbitParams.tilt;
    this.prismalPiramid.add(this.orbitPivot);

    if (sphereCount >= 1) {
      this.centerSphere = new THREE.Mesh(geometry, this.centerSphereMaterial);
      this.centerSphere.position.set(0, sphereY, 0);
      this.centerSphere.scale.setScalar(sphereBaseScale);
      this.prismalPiramid.add(this.centerSphere);
    }

    const orbiters = Math.max(0, sphereCount - 1);

    for (let index = 0; index < orbiters; index++) {
      const sphere = new THREE.Mesh(geometry, this.sphereMaterial);
      const angle = (index / orbiters) * Math.PI * 2;
      const scale = sphereBaseScale * (0.22 + (index % 3) * 0.06);

      sphere.position.set(
        Math.cos(angle) * sphereSpread,
        0,
        Math.sin(angle) * sphereSpread,
      );
      sphere.scale.setScalar(scale);
      this.orbitPivot.add(sphere);
    }

    this.startSphereMotion();
    this.startPrismSpin();
  }

  stopPrismSpin() {
    this.prismSpinCall?.kill();
    this.prismSpinCall = null;
    this.pyramidSlabs?.forEach((mesh) => gsap.killTweensOf(mesh.rotation));
  }

  startPrismSpin() {
    this.stopPrismSpin();

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reduceMotion || !this.pyramidSlabs?.length) return;

    this.queuePrismSpin();
  }

  queuePrismSpin() {
    const min = Math.min(
      this.prismSpinParams.delayMin,
      this.prismSpinParams.delayMax,
    );
    const max = Math.max(
      this.prismSpinParams.delayMin,
      this.prismSpinParams.delayMax,
    );
    this.prismSpinCall = gsap.delayedCall(randomRange(min, max), () =>
      this.spinRandomPrism(),
    );
  }

  spinRandomPrism() {
    const idle = this.pyramidSlabs.filter(
      (mesh) => !gsap.isTweening(mesh.rotation),
    );
    const mesh = idle[Math.floor(Math.random() * idle.length)];

    if (!mesh) {
      this.queuePrismSpin();
      return;
    }

    const turn = Math.random() < 0.5 ? Math.PI / 2 : -Math.PI / 2;
    gsap.to(mesh.rotation, {
      y: `+=${turn}`,
      duration: this.prismSpinParams.duration,
      ease: "expo.inOut",
      overwrite: true,
      onComplete: () => this.queuePrismSpin(),
    });
  }

  stopSphereMotion() {
    this.sphereMotion?.kill();
    this.sphereMotion = null;
  }

  startSphereMotion() {
    this.stopSphereMotion();

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reduceMotion) return;

    this.sphereMotion = gsap.timeline();

    if (this.orbitPivot) {
      this.sphereMotion.to(
        this.orbitPivot.rotation,
        {
          y: `+=${Math.PI * 2}`,
          duration: this.orbitParams.duration,
          repeat: -1,
          ease: "none",
        },
        0,
      );
    }

    if (this.centerSphere) {
      gsap.set(this.centerSphere.position, { y: this.pyramidParams.sphereY });
      this.sphereMotion.to(
        this.centerSphere.position,
        {
          y: this.pyramidParams.sphereY + this.orbitParams.floatAmp,
          duration: this.orbitParams.floatDuration,
          yoyo: true,
          repeat: -1,
          ease: "sine.inOut",
        },
        0,
      );
    }
  }

  createRisographNode(inputNode) {
    return Fn(() => {
      const sceneColor = inputNode.rgb;
      const grainUv = screenCoordinate.xy.div(this.risograph.noiseScale);
      const grain = mx_noise_float(grainUv);
      const printed = sceneColor.add(grain.mul(this.risograph.amount));

      return vec4(mix(sceneColor, printed, this.risograph.strength), 1);
    })();
  }

  setupPostProcessing() {
    this.pipeline = new THREE.RenderPipeline(this.renderer);
    this.pipeline.outputColorTransform = false;

    const scenePass = pass(this.scene, this.camera);
    scenePass.setMRT(
      mrt({
        output,
        normal: normalWorld,
      }),
    );

    this.risograph = {
      strength: uniform(1),
      amount: uniform(0.25),
      noiseScale: uniform(2),
    };
    this.sobel = {
      low: uniform(0),
      high: uniform(0.0),
      inner: uniform(color("#004bff")),
      innerBoost: uniform(1),
      outer: uniform(color("#fff")),
    };

    const sceneColor = scenePass.getTextureNode("output");
    const sobelValue = sobel(sceneColor);
    const sobelPoster = sobelValue.remapClamp(
      this.sobel.low,
      this.sobel.high,
      this.sobel.inner.mul(this.sobel.innerBoost),
      this.sobel.outer,
    );
    const sobelSwapped = sobelValue.remapClamp(
      this.sobel.low,
      this.sobel.high,
      this.sobel.outer,
      this.sobel.inner.mul(this.sobel.innerBoost),
    );
    const revealed = this.createCursorRevealNode({
      poster: sobelPoster,
      swapped: sobelSwapped,
      sceneColor,
    });
    const printed = this.createRisographNode(revealed);

    this.pipeline.outputNode = fxaa(renderOutput(printed));
  }

  createCursorRevealNode({ poster, swapped, sceneColor }) {
    this.cursorReveal = {
      mode: "invert",
      invert: uniform(1),
      maskLow: uniform(0.2),
      debugInk: uniform(0),
    };
    this.inkMap = texture(this.inkFluid.texture);

    return Fn(() => {
      const ink = this.inkMap.sample(screenUV).r;
      const mask = step(this.cursorReveal.maskLow, ink);
      const underInk = mix(
        sceneColor.rgb,
        swapped.rgb,
        this.cursorReveal.invert,
      );
      const revealed = mix(poster.rgb, underInk, mask);
      const debugInk = mix(revealed, vec3(ink), this.cursorReveal.debugInk);

      return vec4(debugInk, 1);
    })();
  }

  resize() {
    this.camera.aspect = this.aspect;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(this.width, this.height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.inkFluid.resize();
    this.updateCameraHome();
    if (!this.debugOrbit) {
      this.camera.position.copy(this.cameraHome);
      this.camera.lookAt(this.lookHome);
    }
  }

  updateCameraRig(delta) {
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const x = reduceMotion ? 0 : this.pointer.normalized.x;
    const y = reduceMotion ? 0 : this.pointer.normalized.y;
    const lambda = this.parallax.damp;

    this.cameraTarget.set(
      this.cameraHome.x + x * this.parallax.x,
      this.cameraHome.y + y * this.parallax.y,
      this.cameraHome.z,
    );

    this.camera.position.x = THREE.MathUtils.damp(
      this.camera.position.x,
      this.cameraTarget.x,
      lambda,
      delta,
    );
    this.camera.position.y = THREE.MathUtils.damp(
      this.camera.position.y,
      this.cameraTarget.y,
      lambda,
      delta,
    );
    this.camera.position.z = THREE.MathUtils.damp(
      this.camera.position.z,
      this.cameraTarget.z,
      lambda,
      delta,
    );
    this.camera.lookAt(this.lookHome);
  }

  tick() {
    const delta = this.clock.getDelta();
    this.cursorReveal.invert.value =
      this.cursorReveal.mode === "invert" ? 1 : 0;
    this.inkFluid.step();
    if (this.inkMap) this.inkMap.value = this.inkFluid.texture;
    if (this.debugOrbit) this.controls.update();
    else this.updateCameraRig(delta);
    this.pipeline.render();
  }
}

new Scene01();
