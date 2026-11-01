import * as THREE from 'three';
import { OrbitControls } from './vendor/three/OrbitControls.js';
import { sceneModel } from './scene-model.mjs';

export function create3DView(container) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0xf6f8fc);
  renderer.domElement.tabIndex = 0;
  renderer.domElement.setAttribute('aria-label', '3D 파레트. 드래그 또는 방향키로 회전하고 확대 버튼으로 크기를 조절하세요.');
  container.prepend(renderer.domElement);
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xffffff, 0x64748b, 2.5));
  const light = new THREE.DirectionalLight(0xffffff, 3);
  light.position.set(-8, 18, 12);
  scene.add(light);
  const camera = new THREE.PerspectiveCamera(40, 1, 0.01, 2000);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.maxPolarAngle = Math.PI / 2 - 0.02;
  controls.minDistance = 1;
  controls.maxDistance = 1000;
  controls.enablePan = false;
  const group = new THREE.Group();
  scene.add(group);
  let radius = 5;
  const center = new THREE.Vector3();
  let visible = false;
  let contextLost = false;

  function draw() {
    if (visible && !contextLost) renderer.render(scene, camera);
  }
  controls.addEventListener('change', draw);
  function reset() {
    const angle = Math.min(THREE.MathUtils.degToRad(camera.fov) / 2,
      Math.atan(Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) * camera.aspect));
    const distance = radius / Math.sin(angle) * 1.15;
    controls.target.copy(center);
    camera.position.copy(center).add(new THREE.Vector3(1, 1.15, 1.3).normalize().multiplyScalar(distance));
    camera.near = Math.max(0.01, distance / 1000);
    camera.far = Math.max(2000, distance * 10);
    camera.updateProjectionMatrix();
    controls.update();
    draw();
  }
  function resize() {
    if (!visible || !container.clientWidth || !container.clientHeight) return;
    renderer.setSize(container.clientWidth, container.clientHeight);
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    reset();
  }
  new ResizeObserver(resize).observe(container);
  function label(text, color) {
    const canvas = document.createElement('canvas');
    canvas.width = 256; canvas.height = 128;
    const context = canvas.getContext('2d');
    context.fillStyle = 'rgba(255,255,255,.94)';
    context.fillRect(0, 0, 256, 128);
    context.fillStyle = color;
    context.font = 'bold 64px system-ui';
    context.textAlign = 'center'; context.textBaseline = 'middle';
    context.fillText(String(text), 128, 64, 240);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }
  function clear() {
    const resources = new Set();
    group.traverse(object => {
      if (object.geometry) resources.add(object.geometry);
      if (object.material) {
        resources.add(object.material);
        if (object.material.map) resources.add(object.material.map);
      }
    });
    resources.forEach(resource => resource.dispose());
    group.clear();
  }
  function setData(cells, placements) {
    clear();
    for (const item of sceneModel(cells, placements)) {
      const base = new THREE.Mesh(new THREE.BoxGeometry(2, 0.18, 2),
        new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.9 }));
      base.position.set(item.x, -0.09, item.z);
      group.add(base);
      const outline = new THREE.LineSegments(new THREE.EdgesGeometry(base.geometry),
        new THREE.LineBasicMaterial({ color: 0x475569 }));
      outline.position.copy(base.position);
      group.add(outline);
      if (item.pack) {
        const pack = item.pack;
        const geometry = pack.shape === 'square'
          ? new THREE.BoxGeometry(pack.width, pack.height, pack.width)
          : new THREE.CylinderGeometry(pack.width / 2, pack.width / 2, pack.height, 48);
        const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({
          color: pack.shape === 'square' ? 0xdc2626 : 0x2563eb, roughness: 0.45,
        }));
        mesh.position.set(item.x, pack.height / 2, item.z);
        group.add(mesh);
        const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
          map: label(pack.number ?? pack.size, pack.shape === 'square' ? '#b91c1c' : '#1d4ed8'),
          depthTest: true,
        }));
        sprite.scale.set(1.5, 0.75, 1);
        sprite.position.set(item.x, pack.height + 0.5, item.z);
        group.add(sprite);
      } else {
        const number = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.65),
          new THREE.MeshBasicMaterial({ map: label(item.cellNumber, '#475569') }));
        number.rotation.x = -Math.PI / 2;
        number.position.set(item.x, 0.01, item.z);
        group.add(number);
      }
    }
    const bounds = new THREE.Box3().setFromObject(group);
    if (!bounds.isEmpty()) {
      const sphere = bounds.getBoundingSphere(new THREE.Sphere());
      center.copy(sphere.center);
      radius = Math.max(2, sphere.radius);
    }
    resize();
  }
  function zoom(factor) {
    const offset = camera.position.clone().sub(controls.target).multiplyScalar(factor);
    offset.clampLength(controls.minDistance, controls.maxDistance);
    camera.position.copy(controls.target).add(offset);
    controls.update(); draw();
  }
  renderer.domElement.addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
    event.preventDefault();
    const spherical = new THREE.Spherical().setFromVector3(camera.position.clone().sub(controls.target));
    if (event.key === 'ArrowLeft') spherical.theta -= 0.12;
    if (event.key === 'ArrowRight') spherical.theta += 0.12;
    if (event.key === 'ArrowUp') spherical.phi -= 0.12;
    if (event.key === 'ArrowDown') spherical.phi += 0.12;
    spherical.phi = THREE.MathUtils.clamp(spherical.phi, 0.1, controls.maxPolarAngle);
    camera.position.copy(controls.target).add(new THREE.Vector3().setFromSpherical(spherical));
    controls.update(); draw();
  });
  renderer.domElement.addEventListener('webglcontextlost', event => {
    event.preventDefault(); contextLost = true;
    container.querySelector('.three-help').textContent = '3D 그래픽 연결이 끊겼습니다. 2D로 돌아가거나 화면을 새로고침해 주세요.';
  });
  renderer.domElement.addEventListener('webglcontextrestored', () => { contextLost = false; draw(); });
  return { setData, reset, zoom, setVisible(value) { visible = value; if (value) resize(); } };
}
