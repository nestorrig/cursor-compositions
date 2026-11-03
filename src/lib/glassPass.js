import * as THREE from "three/webgpu";
import {
  Fn,
  length,
  mix,
  mrt,
  normalWorld,
  output,
  pass,
  screenUV,
  step,
  uniform,
  vec3,
  vec4,
} from "three/tsl";

export const GLASS_LAYER = 1;

export function markGlass(object) {
  object.layers.set(GLASS_LAYER);
}

export function createRefractionNode({
  sceneColor,
  sceneDepth,
  glassColor,
  glassNormal,
  glassDepth,
  strength,
  tint,
}) {
  return Fn(() => {
    const surface = glassNormal.rgb;
    const hasGlass = step(0.2, length(surface));
    const glassInFront = hasGlass.mul(step(glassDepth, sceneDepth));
    const offset = surface.xy.mul(strength);
    const uvn = screenUV;
    const warped = vec3(
      sceneColor.sample(uvn.add(offset.mul(1.12))).r,
      sceneColor.sample(uvn.add(offset)).g,
      sceneColor.sample(uvn.add(offset.mul(0.86))).b,
    );
    const glazed = mix(warped, glassColor.rgb, tint);

    return vec4(mix(sceneColor.rgb, glazed, glassInFront), sceneColor.a);
  })();
}

export function createGlassPass(scene, camera) {
  const opaqueLayers = new THREE.Layers();
  opaqueLayers.enable(0);

  const glassLayers = new THREE.Layers();
  glassLayers.enable(GLASS_LAYER);

  const scenePass = pass(scene, camera);
  scenePass.setLayers(opaqueLayers);
  scenePass.setMRT(
    mrt({
      output,
      normal: normalWorld,
    }),
  );

  const glassPass = pass(scene, camera);
  glassPass.setLayers(glassLayers);
  glassPass.setMRT(
    mrt({
      output,
      normal: normalWorld,
    }),
  );

  const refraction = {
    strength: uniform(0.14),
    tint: uniform(0.18),
  };

  const refracted = createRefractionNode({
    sceneColor: scenePass.getTextureNode("output"),
    sceneDepth: scenePass.getTextureNode("depth"),
    glassColor: glassPass.getTextureNode("output"),
    glassNormal: glassPass.getTextureNode("normal"),
    glassDepth: glassPass.getTextureNode("depth"),
    strength: refraction.strength,
    tint: refraction.tint,
  });

  return { scenePass, glassPass, refraction, refracted };
}

export function setupRefractionInspector(inspector, refraction) {
  const folder = inspector.createParameters("Refraction");
  folder.add(refraction.strength, "value", 0, 0.45, 0.001).name("strength");
  folder.add(refraction.tint, "value", 0, 1, 0.01).name("glassTint");
  return folder;
}

/*
  Para reactivarlo en main.js:

  import {
    createGlassPass,
    markGlass,
    setupRefractionInspector,
  } from "../../lib/glassPass.js";

  // en rebuildSpheres, sobre la esfera de vidrio:
  markGlass(this.centerSphere);

  // en setupPostProcessing:
  const { refracted, refraction } = createGlassPass(this.scene, this.camera);
  this.refraction = refraction;
  const printed = this.createRisographNode(refracted);
  this.pipeline.outputNode = fxaa(renderOutput(printed));
  setupRefractionInspector(this.renderer.inspector, this.refraction);
*/
