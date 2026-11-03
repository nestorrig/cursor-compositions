import * as THREE from "three/webgpu";

const FORMS = {
  rect: () => new THREE.PlaneGeometry(1, 1),
  circle: () => new THREE.CircleGeometry(0.5, 48),
  ring: () => new THREE.RingGeometry(0.22, 0.5, 48),
};

function toArray3(value, fallback = [1, 1, 1]) {
  if (Array.isArray(value)) {
    return [value[0], value[1] ?? value[0], value[2] ?? 1];
  }
  if (typeof value === "number") return [value, value, value];
  return fallback;
}

export function createLightformer({
  name = "lightformer",
  form = "rect",
  color = "#ffffff",
  intensity = 1,
  position = [0, 5, 0],
  rotation,
  scale = 1,
  lookAt = [0, 0, 0],
} = {}) {
  const geometry = (FORMS[form] ?? FORMS.rect)();
  const material = new THREE.MeshBasicMaterial({
    color: new THREE.Color(color).multiplyScalar(intensity),
    side: THREE.DoubleSide,
    toneMapped: false,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;
  mesh.position.fromArray(position);

  if (rotation) mesh.rotation.fromArray(rotation);
  else mesh.lookAt(lookAt[0], lookAt[1], lookAt[2]);

  mesh.scale.fromArray(toArray3(scale));
  mesh.userData.lightformer = { color, intensity, form };
  return mesh;
}

export function createLightformerEnvironment(
  renderer,
  { background = "#000000", formers = [] } = {},
) {
  const envScene = new THREE.Scene();
  envScene.background = new THREE.Color(background);

  const meshes = formers.map((spec) => {
    const mesh = createLightformer(spec);
    envScene.add(mesh);
    return mesh;
  });

  const pmrem = new THREE.PMREMGenerator(renderer);
  let texture = pmrem.fromScene(envScene, 0.04).texture;

  const bake = () => {
    texture = pmrem.fromScene(envScene, 0.04).texture;
    return texture;
  };

  const setFormer = (name, { color, intensity } = {}) => {
    const mesh = meshes.find((item) => item.name === name);
    if (!mesh) return texture;

    const nextColor = color ?? mesh.userData.lightformer.color;
    const nextIntensity = intensity ?? mesh.userData.lightformer.intensity;
    mesh.material.color.set(nextColor).multiplyScalar(nextIntensity);
    mesh.userData.lightformer.color = nextColor;
    mesh.userData.lightformer.intensity = nextIntensity;
    return bake();
  };

  const dispose = () => {
    for (const mesh of meshes) {
      mesh.geometry.dispose();
      mesh.material.dispose();
    }
    pmrem.dispose();
  };

  return {
    get texture() {
      return texture;
    },
    scene: envScene,
    meshes,
    bake,
    setFormer,
    dispose,
  };
}
