import { Inspector } from "three/addons/inspector/Inspector.js";

export function setupDebug(scene) {
  scene.renderer.inspector = new Inspector();
  scene.renderer.inspector.profiler.show(scene.renderer.inspector.parameters);

  setupDebugFolder(scene);
  setupGridFolder(scene);
  setupCubeFolder(scene);
  setupCubeGeometryFolder(scene);
  setupCubeMaterialFolder(scene);
  setupEnvironmentFolder(scene);
  setupBloomFolder(scene);
  setupFluidFolder(scene);

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
}

function setupGridFolder(scene) {
  const panel = folder(scene, "Grid");
  panel
    .add(scene.grid, "cellCss", 8, 64, 1)
    .name("cellSize")
    .onChange(() => scene.syncGridCellSize());
  panel.add(scene.grid.dyeClamp, "value", 0.2, 3, 0.01).name("dyeClamp");
  panel.add(scene.grid.stroke, "value", 0.03, 0.2, 0.001).name("stroke");
  panel
    .addColor(scene.grid.paper, "value")
    .name("paper")
    .onChange((hex) => scene.scene.background.set(hex));
  panel.addColor(scene.grid.ink, "value").name("ink");
}

function setupCubeFolder(scene) {
  const panel = folder(scene, "Cube");
  panel.add(scene.cubeParams, "damp", 1, 16, 0.1).name("lookDamp");
  panel.add(scene.cubeParams, "tilt", 0, 1.2, 0.01);
  panel
    .add(scene.cubeParams, "scale", 0.08, 0.55, 0.01)
    .name("size")
    .onChange(() => scene.layoutScene());
}

function setupCubeGeometryFolder(scene) {
  const panel = folder(scene, "Cube Geometry");
  const rebuild = () => scene.rebuildCubeGeometry();
  panel.add(scene.cubeGeo, "width", 0.4, 2, 0.01).onChange(rebuild);
  panel.add(scene.cubeGeo, "height", 0.4, 2, 0.01).onChange(rebuild);
  panel.add(scene.cubeGeo, "depth", 0.4, 2, 0.01).onChange(rebuild);
  panel.add(scene.cubeGeo, "radius", 0, 0.45, 0.01).onChange(rebuild);
  panel.add(scene.cubeGeo, "segments", 1, 12, 1).onChange(rebuild);
}

function setupCubeMaterialFolder(scene) {
  const panel = folder(scene, "Cube Material");
  const material = scene.cube.material;
  panel.addColor(scene.cubeMatU.color, "value").name("color");
  panel.addColor(material, "attenuationColor").name("attenuation");
  panel.addColor(scene.cubeFace.ink, "value").name("face");
  panel.add(material, "roughness", 0, 1, 0.01);
  panel.add(material, "metalness", 0, 1, 0.01);
  panel.add(scene.cubeMatU.transmission, "value", 0, 1, 0.01).name("transmission");
  panel.add(material, "thickness", 0, 4, 0.01);
  panel.add(material, "ior", 1, 2.4, 0.01);
  panel.add(material, "clearcoat", 0, 1, 0.01);
  panel.add(material, "clearcoatRoughness", 0, 1, 0.01);
  panel.add(material, "attenuationDistance", 0.1, 8, 0.01);
  panel.add(material, "dispersion", 0, 20, 0.01);
  panel.add(material, "iridescence", 0, 1, 0.01);
  panel.add(scene.cubeFace.emissive, "value", 0, 8, 0.01).name("faceEmissive");
  panel.add(scene.mood, "sleepEyeH", 0.05, 0.4, 0.01);
  panel.add(scene.mood, "awakeEyeH", 0.6, 2.4, 0.01);
  panel.add(scene.mood, "idleDelay", 0.4, 4, 0.05);
}

function setupEnvironmentFolder(scene) {
  const panel = folder(scene, "Environment");
  panel.add(scene.scene, "environmentIntensity", 0, 3, 0.01).name("intensity");
  panel.addColor(scene.envColors, "background").onChange(() => {
    scene.rebuildEnvironment();
  });
}

function setupBloomFolder(scene) {
  const panel = folder(scene, "Bloom");
  panel.add(scene.bloomPass.strength, "value", 0, 3, 0.01).name("strength");
  panel.add(scene.bloomPass.radius, "value", 0, 1, 0.01).name("radius");
  panel.add(scene.bloomPass.threshold, "value", 0, 1, 0.01).name("threshold");
}

function setupFluidFolder(scene) {
  const panel = folder(scene, "Fluid");
  const ink = scene.inkFluid.config;
  panel.add(ink, "splatRadius", 0.004, 0.08, 0.001);
  panel.add(ink, "splatForce", 1, 40, 0.1);
  panel.add(ink, "intensity", 0.1, 2.5, 0.01);
  panel.add(ink, "densityDissipation", 0.9, 0.999, 0.001).name("dyeFade");
  panel.add(ink, "velocityDissipation", 0.9, 0.999, 0.001).name("velFade");
  panel.add(ink, "curl", 0, 60, 0.1);
  panel
    .add({ clear: () => scene.inkFluid.clearSim() }, "clear")
    .name("clearFluid");
}
