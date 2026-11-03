import { createInspector, folder } from "../../lib/inspector.js";

export function setupDebug(scene) {
  createInspector(scene);
  setupDebugFolder(scene);
  setupCursorFolder(scene);
  setupVortexFolder(scene);
  setupShapeFolder(scene);

  scene.controls.addEventListener("change", () => scene.logCameraPose());
  scene.controls.addEventListener("end", () => scene.logCameraPose(true));
}

function setupDebugFolder(scene) {
  const panel = folder(scene, "Debug");
  panel.add(scene, "layout").name("breakpoint").listen();
  panel
    .add(scene, "debugOrbit")
    .name("orbitControls")
    .onChange((value) => {
      scene.controls.enabled = value;
      if (!value) scene.applyCameraPose();
    });
}

function setupCursorFolder(scene) {
  const panel = folder(scene, "Cursor");
  panel.add(scene.cursorAnim, "pointerX", -1, 1, 0.01).name("pointerX").listen();
  panel.add(scene.cursorAnim, "pointerY", -1, 1, 0.01).name("pointerY").listen();
  panel
    .add(scene.cursorAnim, "lineWidth", 0.05, 0.95, 0.01)
    .name("lineWidth")
    .listen();
  panel
    .add(scene.cursorAnim, "letterScale", 1, 3, 0.01)
    .name("letterScale")
    .listen();
  panel.add(scene.cursorAnim, "lineWidthMin", 0.05, 0.95, 0.01).name("lineWidthMin");
  panel.add(scene.cursorAnim, "lineWidthMax", 0.05, 0.95, 0.01).name("lineWidthMax");
  panel
    .add(scene.cursorAnim, "letterScaleMin", 0.4, 2, 0.01)
    .name("letterScaleMin");
  panel
    .add(scene.cursorAnim, "letterScaleMax", 1, 3, 0.01)
    .name("letterScaleMax");
  panel.add(scene.cursorAnim, "letterRadius", 0.2, 3, 0.01).name("letterRadius");
  panel.add(scene.cursorAnim, "cameraNudgeX", 0, 8, 0.01).name("cameraNudgeX");
  panel.add(scene.cursorAnim, "cameraNudgeY", 0, 8, 0.01).name("cameraNudgeY");
  panel.add(scene.cursorAnim, "lookNudgeX", 0, 8, 0.01).name("lookNudgeX");
  panel.add(scene.cursorAnim, "lookNudgeY", 0, 8, 0.01).name("lookNudgeY");
  panel.add(scene.cursorAnim, "vortexRotateZ", 0, 2, 0.01).name("vortexRotateZ");
  panel.add(scene.cursorAnim, "offsetRotateZ", -1, 1, 0.01).name("offsetRotateZ");
}

function setupVortexFolder(scene) {
  const panel = folder(scene, "Vortex");
  const vortex = scene.vortex;
  panel.addColor(vortex.lit, "value").name("lit");
  panel.addColor(vortex.shade, "value").name("shadow");
  panel.add(vortex.speed, "value", 0, 4, 0.01).name("speed");
  panel.add(vortex.density, "value", 2, 40, 0.1).name("density");
  panel.add(vortex.turns, "value", 0, 8, 1).name("turns");
  panel.add(vortex.lineWidth, "value", 0.05, 0.95, 0.01).name("lineWidth");
  panel.add(vortex.spin, "value", 0, 2, 0.01).name("spin");
}

function setupShapeFolder(scene) {
  const panel = folder(scene, "Shape");
  const rebuild = () => scene.rebuildVortexGeometry();
  panel.add(scene.vortexShape, "inner", 0.05, 8, 0.01).onChange(rebuild);
  panel.add(scene.vortexShape, "outer", 4, 40, 0.1).onChange(rebuild);
  panel.add(scene.vortexShape, "depth", 1, 60, 0.1).onChange(rebuild);
  panel.add(scene.vortexShape, "power", 0.2, 8, 0.01).onChange(rebuild);
}
