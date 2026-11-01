import * as THREE from "three/webgpu";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { Inspector } from "three/addons/inspector/Inspector.js";
import {
  color,
  lightPosition,
  lightTargetPosition,
  mix,
  mrt,
  normalWorld,
  output,
  pass,
  renderOutput,
  shadow,
  step,
  uniform,
} from "three/tsl";
import { fxaa } from "three/addons/tsl/display/FXAANode.js";
import risoColors from "riso-colors";

function riso(name) {
  const swatch = risoColors.find((ink) => ink.name === name);
  if (!swatch) throw new Error(`Riso color not found: ${name}`);
  return swatch.hex;
}

const risoInkMap = Object.fromEntries(
  risoColors.map((ink) => [ink.name, ink.hex]),
);

function risoHex(value) {
  if (typeof value === "string" && !value.startsWith("#")) return riso(value);
  return value;
}

const palette = {
  blue: riso("Blue"),
  red: riso("Cranberry"),
  black: riso("Midnight"),
  burgundy: riso("Burgundy"),
};

const getRandomRisoColor = () =>
  risoColors[Math.floor(Math.random() * risoColors.length)];

const randomRange = (min, max) => Math.random() * (max - min) + min;

class Scene01 {
  constructor() {
    this.canvas = document.querySelector("canvas.threejs");
    this.scene = new THREE.Scene();

    this.setupViewport();
    this.setupCamera();
    this.setupRenderer();
    this.setupLights();
    // this.setupFloor();
    // this.setupPrismGrid();
    this.setupPrismalPiramid();
    this.setupPostProcessing();
    this.renderer.inspector.profiler.show(this.renderer.inspector.parameters);

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
    this.camera.position.set(18, -8, -12);
    this.scene.add(this.camera);

    this.controls = new OrbitControls(this.camera, this.canvas);
    this.controls.target.set(0.1, 0.4, -0.2);
    this.controls.enableDamping = true;
  }

  setupRenderer() {
    this.renderer = new THREE.WebGPURenderer({
      canvas: this.canvas,
      antialias: false,
    });

    this.toneMappingObject = {
      NoToneMapping: THREE.NoToneMapping,
      LinearToneMapping: THREE.LinearToneMapping,
      ReinhardToneMapping: THREE.ReinhardToneMapping,
      CineonToneMapping: THREE.CineonToneMapping,
      ACESFilmicToneMapping: THREE.ACESFilmicToneMapping,
      AgXToneMapping: THREE.AgXToneMapping,
      NeutralToneMapping: THREE.NeutralToneMapping,
      CustomToneMapping: THREE.CustomToneMapping,
    };

    this.renderer.toneMapping = THREE.NeutralToneMapping; // * Todo usar NeutralToneMapping despues;
    this.renderer.toneMappingExposure = 1;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.BasicShadowMap;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.inspector = new Inspector();

    const toneMapping =
      this.renderer.inspector.createParameters("Tone Mapping");
    toneMapping
      .add(this.renderer, "toneMapping", this.toneMappingObject)
      .name("toneMapping");
    toneMapping
      .add(this.renderer, "toneMappingExposure", 0, 4, 0.01)
      .name("exposure");
  }

  setupLights() {
    this.directional = new THREE.DirectionalLight(0xffffff, 1);
    this.directional.castShadow = true;
    this.directional.position.set(10, -5, 6);
    this.directional.shadow.mapSize.set(2048 * 2, 2048 * 2);
    this.directional.shadow.camera.near = 0.5;
    this.directional.shadow.camera.far = 40;
    this.directional.shadow.camera.left = -16;
    this.directional.shadow.camera.right = 16;
    this.directional.shadow.camera.top = 16;
    this.directional.shadow.camera.bottom = -16;
    // this.directional.shadow.bias = -0.0008;
    // this.directional.shadow.normalBias = 0.01;
    this.scene.add(this.directional);
    this.scene.add(this.directional.target);

    this.lightDirectionNode = lightPosition(this.directional)
      .sub(lightTargetPosition(this.directional))
      .normalize();
    this.shadowNode = shadow(this.directional);

    const folder = this.renderer.inspector.createParameters("Light");
    folder.add(this.directional.position, "x", -20, 20, 0.1).name("positionX");
    folder.add(this.directional.position, "y", -10, 20, 0.1).name("positionY");
    folder.add(this.directional.position, "z", -20, 20, 0.1).name("positionZ");
  }

  createPosterMaterial({
    name,
    lit,
    shade,
    threshold = 0,
    receiveCast = false,
  }) {
    const inks = {
      lit: risoHex(lit),
      shade: risoHex(shade),
    };
    const litColor = uniform(color(inks.lit));
    const shadeColor = uniform(color(inks.shade));
    const cutoff = uniform(threshold);

    const facingLight = step(cutoff, normalWorld.dot(this.lightDirectionNode));
    const litMask = receiveCast
      ? facingLight.mul(step(0.5, this.shadowNode))
      : facingLight;

    const material = new THREE.MeshBasicNodeMaterial();
    material.colorNode = mix(shadeColor, litColor, litMask);
    material.mrtNode = mrt({
      output,
      normal: normalWorld,
    });

    const folder = this.renderer.inspector.createParameters(name);
    folder
      .add(inks, "lit", risoInkMap)
      .name("lit")
      .onChange((hex) => litColor.value.set(hex));
    folder
      .add(inks, "shade", risoInkMap)
      .name("shadow")
      .onChange((hex) => shadeColor.value.set(hex));
    folder.add(cutoff, "value", -1, 1, 0.01).name("threshold");

    return material;
  }

  setupFloor() {
    this.backgroundColor = new THREE.Color(palette.black);
    this.scene.background = this.backgroundColor;

    const material = this.createPosterMaterial({
      name: "Floor",
      lit: palette.burgundy,
      shade: palette.black,
      receiveCast: true,
    });

    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), material);
    mesh.rotation.x = -Math.PI * 0.5;
    mesh.receiveShadow = true;
    this.scene.add(mesh);

    const folder = this.renderer.inspector.createParameters("Background");
    folder
      .addColor({ value: this.backgroundColor }, "value")
      .name("color")
      .onChange((value) => {
        this.backgroundColor.set(value);
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
      sphereCount: 3,
      sphereY: 15,
      sphereBaseScale: 5,
      sphereSpread: 8,
    };

    this.prismalPiramid = new THREE.Group();
    this.scene.add(this.prismalPiramid);

    this.pyramidMaterial = this.createPosterMaterial({
      name: "Prismal Piramid",
      lit: getRandomRisoColor().hex,
      shade: getRandomRisoColor().hex,
    });
    this.sphereMaterial = this.createPosterMaterial({
      name: "Top Sphere",
      lit: getRandomRisoColor().hex,
      shade: getRandomRisoColor().hex,
      receiveCast: true,
    });

    this.rebuildPyramid();
    this.setupPyramidInspector();
  }

  clearPyramid() {
    const disposed = new Set();

    while (this.prismalPiramid.children.length > 0) {
      const child = this.prismalPiramid.children[0];
      this.prismalPiramid.remove(child);

      if (child.geometry && !disposed.has(child.geometry)) {
        disposed.add(child.geometry);
        child.geometry.dispose();
      }
    }
  }

  rebuildPyramid() {
    const {
      steps,
      stepThickness,
      stepSpacing,
      stepScale,
      tipSize,
      tipOffset,
      groupY,
      groupScale,
      sphereCount,
      sphereY,
      sphereBaseScale,
      sphereSpread,
    } = this.pyramidParams;

    this.clearPyramid();
    this.prismalPiramid.position.set(0, groupY, 0);
    this.prismalPiramid.scale.setScalar(groupScale);

    const slabGeometry = new THREE.BoxGeometry(1, 1, 1);

    for (let index = 0; index < steps; index++) {
      const mesh = new THREE.Mesh(slabGeometry, this.pyramidMaterial);
      const size = (index + 1) * stepScale;
      mesh.position.set(0, index * stepSpacing, 0);
      mesh.scale.set(size, stepThickness, size);
      this.prismalPiramid.add(mesh);
    }

    const tipGeometry = new THREE.ConeGeometry(1, 1, 4, 1, true).toNonIndexed();
    tipGeometry.computeVertexNormals();

    const tip = new THREE.Mesh(tipGeometry, this.pyramidMaterial);
    tip.position.set(0, tipOffset, 0);
    tip.scale.setScalar(tipSize);
    tip.rotation.set(Math.PI, Math.PI * 0.25, 0);
    this.prismalPiramid.add(tip);

    const sphereGeometry = new THREE.SphereGeometry(1, 32, 32);

    for (let index = 0; index < sphereCount; index++) {
      const sphere = new THREE.Mesh(sphereGeometry, this.sphereMaterial);
      const angle = index * 2.1;
      const radius = index === 0 ? 0 : sphereSpread * (0.35 + index * 0.2);
      const scale = sphereBaseScale * Math.pow(0.32, index);

      sphere.position.set(
        Math.cos(angle) * radius,
        sphereY,
        Math.sin(angle) * radius,
      );
      sphere.scale.setScalar(scale);
      this.prismalPiramid.add(sphere);
    }
  }

  setupPyramidInspector() {
    const folder = this.renderer.inspector.createParameters("Pyramid");
    const rebuild = () => this.rebuildPyramid();

    folder.add(this.pyramidParams, "steps", 1, 24, 1).onChange(rebuild);
    folder
      .add(this.pyramidParams, "stepThickness", 0.05, 2, 0.01)
      .onChange(rebuild);
    folder
      .add(this.pyramidParams, "stepSpacing", 0.2, 3, 0.01)
      .onChange(rebuild);
    folder.add(this.pyramidParams, "stepScale", 0.2, 6, 0.01).onChange(rebuild);
    folder.add(this.pyramidParams, "tipSize", 0.1, 4, 0.01).onChange(rebuild);
    folder.add(this.pyramidParams, "tipOffset", -2, 2, 0.01).onChange(rebuild);
    folder.add(this.pyramidParams, "groupY", -20, 10, 0.1).onChange(rebuild);
    folder
      .add(this.pyramidParams, "groupScale", 0.1, 2, 0.01)
      .onChange(rebuild);
    folder.add(this.pyramidParams, "sphereCount", 0, 8, 1).onChange(rebuild);
    folder.add(this.pyramidParams, "sphereY", 0, 30, 0.1).onChange(rebuild);
    folder
      .add(this.pyramidParams, "sphereBaseScale", 0.2, 12, 0.01)
      .onChange(rebuild);
    folder
      .add(this.pyramidParams, "sphereSpread", 0, 20, 0.1)
      .onChange(rebuild);
  }

  setupPrismGrid() {
    const columns = 5;
    const rows = 5;
    const spacing = 2;
    const size = 0.8;
    const geometry = new THREE.BoxGeometry(size, 1, size);
    const material = this.createPosterMaterial({
      name: "Prisms",
      lit: palette.red,
      shade: palette.burgundy,
    });

    const group = new THREE.Group();
    const offsetX = ((columns - 1) * spacing) / 2;
    const offsetZ = ((rows - 1) * spacing) / 2;

    for (let column = 0; column < columns; column++) {
      for (let row = 0; row < rows; row++) {
        const height = randomRange(5, 7);
        const mesh = new THREE.Mesh(geometry, material);
        mesh.scale.y = height;
        mesh.position.set(
          column * spacing - offsetX,
          height * 0.5,
          row * spacing - offsetZ,
        );
        mesh.castShadow = true;
        group.add(mesh);
      }
    }

    this.scene.add(group);
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

    this.pipeline.outputNode = fxaa(
      renderOutput(scenePass.getTextureNode("output")),
    );
  }

  resize() {
    this.camera.aspect = this.aspect;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(this.width, this.height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  }

  tick() {
    this.controls.update();
    this.pipeline.render();
  }
}

new Scene01();
