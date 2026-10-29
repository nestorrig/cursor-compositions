import * as THREE from 'three'

const canvas = document.querySelector('#canvas')
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))

const scene = new THREE.Scene()
scene.background = new THREE.Color(0x101410)

const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100)
camera.position.z = 4

const mesh = new THREE.Mesh(
  new THREE.TorusGeometry(1, 0.35, 32, 80),
  new THREE.MeshStandardMaterial({ color: 0x7dce6a, roughness: 0.4 }),
)
scene.add(mesh)

const key = new THREE.DirectionalLight(0xf4ffe8, 3)
key.position.set(3, 2, 4)
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
  mesh.rotation.x += 0.008
  mesh.rotation.y += 0.012
  renderer.render(scene, camera)
})
