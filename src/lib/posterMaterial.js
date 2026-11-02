import * as THREE from "three/webgpu";
import {
  color,
  mix,
  mrt,
  normalWorld,
  output,
  step,
  uniform,
} from "three/tsl";
import risoColors from "riso-colors";

export const risoInkMap = Object.fromEntries(
  risoColors.map((ink) => [ink.name, ink.hex]),
);

export function riso(name) {
  const swatch = risoColors.find((ink) => ink.name === name);
  if (!swatch) throw new Error(`Riso color not found: ${name}`);
  return swatch.hex;
}

export function risoHex(value) {
  if (typeof value === "string" && !value.startsWith("#")) return riso(value);
  return value;
}

export function createPosterMaterial({
  name,
  lit,
  shade,
  threshold = 0,
  receiveCast = false,
  lightDirectionNode,
  shadowNode,
  inspector,
}) {
  const inks = {
    lit: risoHex(lit),
    shade: risoHex(shade),
  };
  const litColor = uniform(color(inks.lit));
  const shadeColor = uniform(color(inks.shade));
  const cutoff = uniform(threshold);

  const facingLight = step(cutoff, normalWorld.dot(lightDirectionNode));
  const litMask =
    receiveCast && shadowNode
      ? facingLight.mul(step(0.5, shadowNode))
      : facingLight;

  const material = new THREE.MeshBasicNodeMaterial();
  material.colorNode = mix(shadeColor, litColor, litMask);
  material.mrtNode = mrt({
    output,
    normal: normalWorld,
  });

  if (inspector && name) {
    const folder = inspector.createParameters(name).close();
    folder
      .add(inks, "lit", risoInkMap)
      .name("lit")
      .onChange((hex) => litColor.value.set(hex));
    folder
      .add(inks, "shade", risoInkMap)
      .name("shadow")
      .onChange((hex) => shadeColor.value.set(hex));
    folder.add(cutoff, "value", -1, 1, 0.01).name("threshold");
  }

  return material;
}

export function createBasicNodeMaterial({
  name,
  color: ink,
  inspector,
}) {
  const inks = { color: risoHex(ink) };
  const material = new THREE.MeshBasicNodeMaterial({
    color: new THREE.Color(inks.color),
  });
  material.mrtNode = mrt({
    output,
    normal: normalWorld,
  });

  if (inspector && name) {
    const folder = inspector.createParameters(name).close();
    folder
      .add(inks, "color", risoInkMap)
      .name("color")
      .onChange((hex) => material.color.set(hex));
  }

  return material;
}
