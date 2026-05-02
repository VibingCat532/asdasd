import { useEffect, useRef } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

const MODEL_URL = "/blood_stories_logo_3d.glb";

export default function ThreeLogoBackground() {
  const mountRef = useRef(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return undefined;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
    camera.position.set(0, 0.1, 6);

    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: "high-performance",
    });
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    mount.appendChild(renderer.domElement);

    const ambient = new THREE.AmbientLight(0xffffff, 1.25);
    const keyLight = new THREE.DirectionalLight(0x9ff7ff, 2.4);
    keyLight.position.set(3, 4, 5);
    const fillLight = new THREE.DirectionalLight(0xffffff, 1.2);
    fillLight.position.set(-4, 1, 3);
    scene.add(ambient, keyLight, fillLight);

    const modelGroup = new THREE.Group();
    modelGroup.rotation.x = -0.08;
    modelGroup.rotation.y = -0.35;
    scene.add(modelGroup);

    let frameId = null;
    let model = null;
    let isDisposed = false;
    let lastTime = performance.now();
    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;

    const resize = () => {
      const width = mount.clientWidth || window.innerWidth;
      const height = mount.clientHeight || window.innerHeight;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.position.z = width < 720 ? 7.2 : 5.8;
      camera.updateProjectionMatrix();
    };

    const loader = new GLTFLoader();
    loader.load(
      MODEL_URL,
      (gltf) => {
        if (isDisposed) return;

        model = gltf.scene;
        const box = new THREE.Box3().setFromObject(model);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        const maxAxis = Math.max(size.x, size.y, size.z) || 1;
        const scale = 3.5 / maxAxis;

        model.position.sub(center);
        model.scale.setScalar(scale);
        model.traverse((child) => {
          if (child.isMesh) {
            child.castShadow = false;
            child.receiveShadow = false;
            if (child.material) {
              child.material.depthWrite = false;
              child.material.transparent = true;
              child.material.opacity = 0.82;
            }
          }
        });

        modelGroup.add(model);
      },
      undefined,
      () => {
        mount.classList.add("hs-3d-logo-bg--hidden");
      },
    );

    const animate = (time) => {
      const delta = Math.min((time - lastTime) / 1000, 0.05);
      lastTime = time;

      if (model && !reducedMotion) {
        modelGroup.rotation.y += delta * 0.075;
        modelGroup.rotation.z = Math.sin(time * 0.00018) * 0.025;
      }

      renderer.render(scene, camera);
      frameId = window.requestAnimationFrame(animate);
    };

    resize();
    window.addEventListener("resize", resize);
    frameId = window.requestAnimationFrame(animate);

    return () => {
      isDisposed = true;
      window.removeEventListener("resize", resize);
      if (frameId) window.cancelAnimationFrame(frameId);

      scene.traverse((object) => {
        if (!object.isMesh) return;
        object.geometry?.dispose();
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.filter(Boolean).forEach((material) => material.dispose());
      });

      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return <div ref={mountRef} className="hs-3d-logo-bg" aria-hidden="true" />;
}
