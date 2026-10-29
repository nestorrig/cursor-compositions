import * as THREE from 'three'

const canvas = document.querySelector('#canvas')
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))

const scene = new THREE.Scene()
scene.background = new THREE.Color(0x0e1216)

const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100)
camera.position.z = 3

const mesh = new THREE.Mesh(
  new THREE.SphereGeometry(0.9, 64, 64),
  new THREE.MeshStandardMaterial({ color: 0x4f8cff, roughness: 0.2, metalness: 0.15 }),
)
scene.add(mesh)

const key = new THREE.DirectionalLight(0xeaf2ff, 3)
key.position.set(-2, 3, 4)
scene.add(key)
scene.add(new THREE.AmbientLight(0xffffff, 0.3))

function resize() {
  const width = window.innerWidth
  const height = window.innerHeight
  camera.aspect = width / height
  camera.updateProjectionMatrix()
  renderer.setSize(width, height)
}

window.addEventListener('resize', resize)
resize()

renderer.setAnimationLoop(() => {
  mesh.rotation.y += 0.008
  renderer.render(scene, camera)
})
