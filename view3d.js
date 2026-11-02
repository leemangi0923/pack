import * as THREE from 'three';
import { OrbitControls } from './vendor/three/OrbitControls.js';
import { sceneModel, stackScene } from './scene-model.mjs';

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
  const movingPacks = new Map();
  let positions = new Map();
  let initialized = false;

  function draw() {
    if (visible && !contextLost) renderer.render(scene, camera);
  }
  controls.addEventListener('change', draw);
  function reset() {
    const angle = Math.min(THREE.MathUtils.degToRad(camera.fov) / 2,
      Math.atan(Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) * camera.aspect));
    const distance = radius / Math.sin(angle) * 1.15;
    controls.target.copy(center);
    camera.position.copy(center).add(new THREE.Vector3(0, distance, 0));
    camera.near = Math.max(0.01, distance / 1000);
    camera.far = Math.max(2000, distance * 10);
    camera.updateProjectionMatrix();
    controls.update();
    // OrbitControls avoids the pole internally; use an exact overhead pose for reset.
    camera.position.copy(center).add(new THREE.Vector3(0, distance, 0));
    camera.up.set(0, 0, -1);
    camera.lookAt(center);
    camera.up.set(0, 1, 0);
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
  function label(text, color, transparent = false, square = false) {
    const canvas = document.createElement('canvas');
    canvas.width = 512; canvas.height = square ? 512 : 256;
    const context = canvas.getContext('2d');
    if (!transparent) {
      context.fillStyle = 'rgba(255,255,255,.94)';
      context.fillRect(0, 0, canvas.width, canvas.height);
    }
    context.fillStyle = color;
    context.font = `bold ${square ? 440 : 180}px system-ui`;
    context.textAlign = 'center'; context.textBaseline = 'middle';
    context.fillText(String(text), 256, canvas.height / 2, 480);
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
  function setData(cells, placements, { preserveView = false, layers = [{ cells, placements, level: 0, active: true }] } = {}) {
    clear();
    movingPacks.clear();
    const alignment = layers.flatMap(layer => layer.cells);
    const model = layers.flatMap(layer => sceneModel(layer.cells, layer.placements, alignment, layer.offset ?? 0).map(item => ({
      ...item, key: `${item.key},${layer.level}`, level: layer.level, elevation: 0,
    })));
    positions = new Map(model.map(item => [item.key, item]));
    stackScene(model);
    for (const item of model) {
      const baseGeometry = item.level > 0 ? new THREE.PlaneGeometry(4, 4) : new THREE.BoxGeometry(4, 0.18, 4);
      const base = new THREE.Mesh(baseGeometry,
        new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.9,
          transparent: item.level > 0, opacity: item.level > 0 ? .08 : 1,
          depthWrite: item.level === 0, side: THREE.DoubleSide }));
      base.position.set(item.x, item.level > 0 ? item.elevation : -.09, item.z);
      if (item.level > 0) base.rotation.x = -Math.PI / 2;
      group.add(base);
      const outline = new THREE.LineSegments(new THREE.EdgesGeometry(base.geometry),
        new THREE.LineBasicMaterial({ color: 0x475569 }));
      outline.position.copy(base.position);
      outline.rotation.copy(base.rotation);
      group.add(outline);
      if (['fixed', 'fixed-circle'].includes(item.kind)) {
        const fixed = new THREE.Mesh(item.kind === 'fixed-circle' ? new THREE.CylinderGeometry(1, 1, 6, 48) : new THREE.BoxGeometry(2, 6, 2), new THREE.MeshStandardMaterial({ color: item.kind === 'fixed-circle' ? 0x2563eb : 0xdc2626 }));
        fixed.position.set(item.x, item.elevation + 3, item.z); group.add(fixed);
        const mark = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.8), new THREE.MeshBasicMaterial({ map: label('X', '#000000', true, true), transparent: true }));
        mark.rotation.x = -Math.PI / 2; mark.position.set(item.x, item.elevation + 6.01, item.z); group.add(mark);
      }
      if (item.pack) {
        const pack = item.pack;
        const geometry = pack.shape === 'square'
          ? new THREE.BoxGeometry(pack.width, pack.height, pack.width)
          : new THREE.CylinderGeometry(pack.width / 2, pack.width / 2, pack.height, 48);
        const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({
          color: pack.shape === 'square' ? 0xdc2626 : 0x2563eb, roughness: 0.45,
        }));
        mesh.position.set(item.x, item.elevation + pack.height / 2, item.z);
        group.add(mesh);
        const inscription = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.9),
          new THREE.MeshBasicMaterial({
            map: label(pack.number ?? pack.size, '#ffffff', true),
            transparent: true, depthWrite: false, polygonOffset: true,
            polygonOffsetFactor: -1, polygonOffsetUnits: -1,
          }));
        inscription.rotation.x = -Math.PI / 2;
        inscription.position.set(item.x, item.elevation + pack.height + 0.005, item.z);
        group.add(inscription);
        movingPacks.set(item.key, { mesh, inscription });
      }
      // Keep floor numbers under occupied packs so moving away reveals the source.
      const number = new THREE.Mesh(new THREE.PlaneGeometry(2.8, item.kind === 'hole' ? 2.8 : 1.4),
        new THREE.MeshBasicMaterial({ map: label(item.kind === 'hole' ? 'H' : item.cellNumber, item.kind === 'hole' ? '#2563eb' : '#475569', item.kind === 'hole' || item.level > 0, item.kind === 'hole'), transparent: item.kind === 'hole' || item.level > 0, depthWrite: false }));
      number.rotation.x = -Math.PI / 2;
      number.position.set(item.x, item.elevation + 0.01, item.z);

      group.add(number);
    }
    const bounds = new THREE.Box3().setFromObject(group);
    if (!bounds.isEmpty()) {
      const sphere = bounds.getBoundingSphere(new THREE.Sphere());
      center.copy(sphere.center);
      radius = Math.max(2, sphere.radius);
    }
    if (preserveView && initialized) draw();
    else resize();
    initialized = true;
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
  function movePack(from, to, progress) {
    const moving = movingPacks.get(from);
    const start = positions.get(from), end = positions.get(to);
    if (!moving || !start || !end) return;
    const endElevation = end.elevation - (start.x === end.x && start.z === end.z && end.level > start.level ? moving.mesh.geometry.parameters.height : 0);
    for (const object of [moving.mesh, moving.inscription]) {
      object.position.x = THREE.MathUtils.lerp(start.x, end.x, progress);
      object.position.z = THREE.MathUtils.lerp(start.z, end.z, progress);
      object.position.y = THREE.MathUtils.lerp(start.elevation, endElevation, progress) + (object === moving.mesh ? moving.mesh.geometry.parameters.height / 2 : moving.mesh.geometry.parameters.height + 0.005);
    }
    draw();
  }
  return { setData, reset, zoom, movePack, setVisible(value) { if (visible === value) return; visible = value; if (value) resize(); } };
}
