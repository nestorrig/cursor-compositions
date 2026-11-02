import * as THREE from "three/webgpu";
import { Inspector } from "three/addons/inspector/Inspector.js";
import { risoInkMap } from "../../lib/posterMaterial.js";

export function setupDebug(scene) {
  scene.renderer.inspector = new Inspector();
  scene.renderer.inspector.profiler.show(scene.renderer.inspector.parameters);

  setupDebugFolder(scene);
  setupToneMappingFolder(scene);
  setupLightFolder(scene);
  setupMaterialFolder(scene, "Orbit Spheres", scene.sphereMaterial);
  setupMaterialFolder(scene, "Center Sphere", scene.centerSphereMaterial);
  setupPyramidFolder(scene);
  setupOrbitFolder(scene);
  setupSobelFolder(scene);
  setupRisographFolder(scene);
  setupCursorFolder(scene);

  syncInspectorVisibility(scene);
  window.addEventListener("hashchange", () => {
    scene.debug = /debug/i.test(location.hash);
    syncInspectorVisibility(scene);
  });
}

function syncInspectorVisibility(scene) {
  scene.renderer.inspector.domElement.style.display = scene.debug ? "" : "none";
}

function folder(scene, name) {
  return scene.renderer.inspector.createParameters(name).close();
}

function setupDebugFolder(scene) {
  const panel = folder(scene, "Debug");
  panel
    .add(scene, "debugOrbit")
    .name("orbitControls")
    .onChange((value) => {
      scene.controls.enabled = value;
      if (!value) {
        scene.camera.position.copy(scene.cameraHome);
        scene.controls.target.copy(scene.lookHome);
        scene.camera.lookAt(scene.lookHome);
      }
    });
  panel.add(scene.parallax, "x", 0, 10, 0.01).name("rigX");
  panel.add(scene.parallax, "y", 0, 10, 0.01).name("rigY");
  panel.add(scene.parallax, "damp", 0.05, 4, 0.01).name("rigDamp");
}

function setupToneMappingFolder(scene) {
  const panel = folder(scene, "Tone Mapping");
  panel
    .add(scene.renderer, "toneMapping", {
      NoToneMapping: THREE.NoToneMapping,
      LinearToneMapping: THREE.LinearToneMapping,
      ReinhardToneMapping: THREE.ReinhardToneMapping,
      CineonToneMapping: THREE.CineonToneMapping,
      ACESFilmicToneMapping: THREE.ACESFilmicToneMapping,
      AgXToneMapping: THREE.AgXToneMapping,
      NeutralToneMapping: THREE.NeutralToneMapping,
      CustomToneMapping: THREE.CustomToneMapping,
    })
    .name("toneMapping");
  panel.add(scene.renderer, "toneMappingExposure", 0, 4, 0.01).name("exposure");
}

function setupLightFolder(scene) {
  const panel = folder(scene, "Light");
  panel.add(scene.directional.position, "x", -20, 20, 0.1).name("positionX");
  panel.add(scene.directional.position, "y", -10, 20, 0.1).name("positionY");
  panel.add(scene.directional.position, "z", -20, 20, 0.1).name("positionZ");
}

function setupMaterialFolder(scene, name, material) {
  const inks = { color: "#000000" };
  folder(scene, name)
    .add(inks, "color", risoInkMap)
    .name("color")
    .onChange((hex) => material.color.set(hex));
}

function setupPyramidFolder(scene) {
  const panel = folder(scene, "Pyramid");
  const rebuild = () => scene.rebuildPyramid();

  panel.add(scene.pyramidParams, "steps", 1, 24, 1).onChange(rebuild);
  panel
    .add(scene.pyramidParams, "stepThickness", 0.05, 2, 0.01)
    .onChange(rebuild);
  panel
    .add(scene.pyramidParams, "stepSpacing", 0.2, 3, 0.01)
    .onChange(rebuild);
  panel.add(scene.pyramidParams, "stepScale", 0.2, 6, 0.01).onChange(rebuild);
  panel.add(scene.pyramidParams, "tipSize", 0.1, 4, 0.01).onChange(rebuild);
  panel.add(scene.pyramidParams, "tipOffset", -2, 2, 0.01).onChange(rebuild);
  panel.add(scene.pyramidParams, "groupY", -20, 10, 0.1).onChange(rebuild);
  panel
    .add(scene.pyramidParams, "groupScale", 0.1, 2, 0.01)
    .onChange(rebuild);
  panel.add(scene.pyramidParams, "sphereCount", 0, 8, 1).onChange(rebuild);
  panel.add(scene.pyramidParams, "sphereY", 0, 30, 0.1).onChange(rebuild);
  panel
    .add(scene.pyramidParams, "sphereBaseScale", 0.2, 12, 0.01)
    .onChange(rebuild);
  panel
    .add(scene.pyramidParams, "sphereSpread", 0, 20, 0.1)
    .onChange(rebuild);
}

function setupOrbitFolder(scene) {
  const panel = folder(scene, "Orbit");
  const restart = () => scene.startSphereMotion();
  const restartSpin = () => scene.startPrismSpin();

  panel
    .add(scene.orbitParams, "duration", 4, 40, 0.1)
    .name("orbitDuration")
    .onChange(restart);
  panel
    .add(scene.orbitParams, "floatAmp", 0, 4, 0.01)
    .name("floatAmp")
    .onChange(restart);
  panel
    .add(scene.orbitParams, "floatDuration", 0.4, 8, 0.01)
    .name("floatDuration")
    .onChange(restart);
  panel.add(scene.orbitParams, "tilt", 0, 1.2, 0.01).name("tilt").onChange((value) => {
    if (scene.orbitPivot) scene.orbitPivot.rotation.x = value;
  });
  panel
    .add(scene.prismSpinParams, "delayMin", 0.2, 8, 0.1)
    .name("prismDelayMin")
    .onChange(restartSpin);
  panel
    .add(scene.prismSpinParams, "delayMax", 0.4, 12, 0.1)
    .name("prismDelayMax")
    .onChange(restartSpin);
  panel
    .add(scene.prismSpinParams, "duration", 0.4, 6, 0.05)
    .name("prismSpin")
    .onChange(restartSpin);
}

function setupSobelFolder(scene) {
  const panel = folder(scene, "Sobel");
  panel.add(scene.sobel.low, "value", 0, 1, 0.001).name("low");
  panel.add(scene.sobel.high, "value", 0, 1, 0.001).name("high");
  panel.addColor(scene.sobel.inner, "value").name("inner");
  panel.add(scene.sobel.innerBoost, "value", 0, 10, 0.01).name("innerBoost");
  panel.addColor(scene.sobel.outer, "value").name("outer");
}

function setupRisographFolder(scene) {
  const panel = folder(scene, "Risograph");
  panel.add(scene.risograph.strength, "value", 0, 1, 0.01).name("strength");
  panel.add(scene.risograph.amount, "value", 0, 1.6, 0.001).name("amount");
  panel
    .add(scene.risograph.noiseScale, "value", 0.1, 8, 0.01)
    .name("noiseScale");
}

function setupCursorFolder(scene) {
  const panel = folder(scene, "Cursor");
  panel
    .add(scene.cursorReveal, "mode", {
      scene: "scene",
      invert: "invert",
    })
    .name("reveal")
    .onChange((value) => {
      scene.cursorReveal.invert.value = value === "invert" ? 1 : 0;
    });
  panel
    .add(scene.cursorReveal.maskLow, "value", 0, 1, 0.001)
    .name("threshold");
  panel
    .add(scene.cursorReveal.debugInk, "value", 0, 1, 0.01)
    .name("debugInk");

  const ink = scene.inkFluid.config;
  const fluid = folder(scene, "Ink Fluid");
  fluid
    .add(ink, "textureDownsample", 0, 2, 1)
    .name("downsample")
    .onChange(() => scene.inkFluid.resize(true));
  fluid.add(ink, "splatRadius", 0.001, 0.06, 0.0005).name("inkRadius");
  fluid.add(ink, "hardness", 0.15, 2.5, 0.01).name("hardness");
  fluid.add(ink, "splatForce", 1, 60, 0.1).name("inkForce");
  fluid.add(ink, "intensity", 0.05, 3, 0.01).name("inkAmount");
  fluid.add(ink, "wetScale", 1, 6, 0.05).name("wetScale");
  fluid.add(ink, "wetAmount", 0, 1.5, 0.01).name("wetAmount");
  fluid.add(ink, "bleed", 0, 1, 0.01).name("bleed");
  fluid.add(ink, "viscosity", 0, 1, 0.01).name("viscosity");
  fluid.add(ink, "flow", 0.2, 16, 0.1).name("flow");
  fluid.add(ink, "curl", 0, 80, 0.1).name("curl");
  fluid.add(ink, "velocityDissipation", 0.9, 1, 0.001).name("velFade");
  fluid.add(ink, "densityDissipation", 0.8, 1, 0.001).name("inkFade");
  fluid.add(ink, "pressureDissipation", 0.2, 1, 0.01).name("pressureFade");
  fluid.add(ink, "pressureIterations", 4, 40, 1).name("pressureIters");
  fluid.add(ink, "maxVel", 10, 200, 1).name("maxVel");
  fluid.add(ink, "minSpeed", 0, 4, 0.05).name("minSpeed");
  fluid.add(ink, "stepGap", 10, 120, 1).name("stepGap");
  fluid.add({ clear: () => scene.inkFluid.clearSim() }, "clear").name("clearInk");
}
