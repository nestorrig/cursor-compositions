import { Inspector } from "three/addons/inspector/Inspector.js";

export function createInspector(scene) {
  scene.renderer.inspector = new Inspector();
  scene.renderer.inspector.profiler.show(scene.renderer.inspector.parameters);
  syncInspectorVisibility(scene);
  window.addEventListener("hashchange", () => {
    scene.debug = /debug/i.test(location.hash);
    syncInspectorVisibility(scene);
  });
}

export function folder(scene, name) {
  return scene.renderer.inspector.createParameters(name).close();
}

function syncInspectorVisibility(scene) {
  scene.renderer.inspector.domElement.style.display = scene.debug ? "" : "none";
}
