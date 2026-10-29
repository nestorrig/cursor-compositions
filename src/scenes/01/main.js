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

const palette = {
  light: "#F2EBF2",
  ambient: "##ACB0F2",
  blue1: "#056CF2",
  blue2: "#0583F2",
  orange1: "#F28705",
};

class Scene01 {
  constructor() {
    this.canvas = document.querySelector("canvas.threejs");
    this.scene = new THREE.Scene();

    this.setupViewport();
    this.setupCamera();
    this.setupRenderer();
    this.setupLights();
    this.setupFloor();
    this.setupPrismGrid();
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
    this.camera.position.set(8, 7, 10);
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

    this.renderer.toneMapping = THREE.NoToneMapping;
    this.renderer.toneMappingExposure = 1;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.BasicShadowMap;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.inspector = new Inspector();
  }

  setupLights() {
    this.directional = new THREE.DirectionalLight(0xffffff, 1);
    this.directional.castShadow = true;
    this.directional.position.set(6, 3.5, -4);
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
    folder.add(this.directional.position, "y", 0.1, 20, 0.1).name("positionY");
    folder.add(this.directional.position, "z", -20, 20, 0.1).name("positionZ");
  }

  createPosterMaterial({
    name,
    lit,
    shade,
    threshold = 0,
    receiveCast = false,
  }) {
    const litColor = uniform(color(lit));
    const shadeColor = uniform(color(shade));
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
    folder.addColor(litColor, "value").name("lit");
    folder.addColor(shadeColor, "value").name("shadow");
    folder.add(cutoff, "value", -1, 1, 0.01).name("threshold");

    return material;
  }

  setupFloor() {
    this.backgroundColor = new THREE.Color("#2ea8ff");
    this.scene.background = this.backgroundColor;

    const material = this.createPosterMaterial({
      name: "Floor",
      lit: "#2ea8ff",
      shade: "#111111",
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

  setupPrismGrid() {
    const columns = 5;
    const rows = 5;
    const spacing = 2;
    const height = 1.5;
    const size = 0.8;
    const geometry = new THREE.BoxGeometry(size, height, size);
    const material = this.createPosterMaterial({
      name: "Prisms",
      lit: "#ff1110",
      shade: "#1a1028",
    });

    const group = new THREE.Group();
    const offsetX = ((columns - 1) * spacing) / 2;
    const offsetZ = ((rows - 1) * spacing) / 2;

    for (let column = 0; column < columns; column++) {
      for (let row = 0; row < rows; row++) {
        const mesh = new THREE.Mesh(geometry, material);
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
