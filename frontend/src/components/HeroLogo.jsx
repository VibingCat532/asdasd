import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

const MODEL_URL = "/blood_stories_logo_3d.glb";
const POSTER_URL = "/logo-hero.webp";
const SWAY_PERIOD_SECONDS = 12;
const SWAY_CENTER = -0.2;
// About 24 degrees each way: enough to read as 3D, never enough to show the mirrored back.
const SWAY_AMPLITUDE = 0.42;

export default function HeroLogo({ className = "" }) {
  const mountRef = useRef(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return undefined;

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "high-performance" });
    } catch {
      return undefined; // No WebGL: the poster image stays.
    }
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    const environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = environment;

    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
    camera.position.set(0, 0.1, 6.6);

    // Neutral key light and little ambient keep the petrol deep and let the chrome read as chrome.
    const ambient = new THREE.AmbientLight(0xffffff, 0.45);
    const keyLight = new THREE.DirectionalLight(0xffffff, 2.4);
    keyLight.position.set(3, 4, 5);
    const fillLight = new THREE.DirectionalLight(0xffffff, 0.8);
    fillLight.position.set(-4, 1, 3);
    scene.add(ambient, keyLight, fillLight);

    const group = new THREE.Group();
    group.rotation.x = -0.08;
    group.rotation.y = SWAY_CENTER;
    scene.add(group);

    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    let frameId = null;
    let model = null;
    let disposed = false;
    let visible = true;
    let elapsed = 0;
    let lastTime = performance.now();

    const resize = () => {
      const width = mount.clientWidth || 1;
      const height = mount.clientHeight || 1;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };

    const renderFrame = () => renderer.render(scene, camera);

    const animate = (time) => {
      frameId = null;
      if (disposed || !visible) return;
      const delta = Math.min((time - lastTime) / 1000, 0.05);
      lastTime = time;
      elapsed += delta;
      const phase = (elapsed / SWAY_PERIOD_SECONDS) * Math.PI * 2;
      group.rotation.y = SWAY_CENTER + SWAY_AMPLITUDE * Math.sin(phase);
      group.position.y = 0.06 * Math.sin(phase * 2);
      renderFrame();
      frameId = window.requestAnimationFrame(animate);
    };

    const start = () => {
      if (reducedMotion || !model || frameId !== null || !visible) return;
      lastTime = performance.now();
      frameId = window.requestAnimationFrame(animate);
    };

    const stop = () => {
      if (frameId !== null) window.cancelAnimationFrame(frameId);
      frameId = null;
    };

    // Rendering stops while the hero is scrolled away or the tab is hidden.
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting && document.visibilityState === "visible";
      if (visible) start(); else stop();
    });
    observer.observe(mount);
    const onVisibility = () => {
      visible = document.visibilityState === "visible";
      if (visible) start(); else stop();
    };
    document.addEventListener("visibilitychange", onVisibility);

    new GLTFLoader().load(
      MODEL_URL,
      (gltf) => {
        if (disposed) return;
        model = gltf.scene;
        const box = new THREE.Box3().setFromObject(model);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        model.position.sub(center);
        model.scale.setScalar(3.5 / (Math.max(size.x, size.y, size.z) || 1));
        model.traverse((child) => {
          if (!child.isMesh || !child.material) return;
          const materials = Array.isArray(child.material) ? child.material : [child.material];
          materials.forEach((material) => { material.envMapIntensity = 0.6; });
        });
        group.add(model);
        resize();
        renderFrame();
        setReady(true);
        start();
      },
      undefined,
      () => {},
    );

    resize();
    window.addEventListener("resize", resize);

    return () => {
      disposed = true;
      stop();
      observer.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("resize", resize);
      scene.traverse((object) => {
        if (!object.isMesh) return;
        object.geometry?.dispose();
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.filter(Boolean).forEach((material) => material.dispose());
      });
      environment.dispose();
      pmrem.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return (
    <div ref={mountRef} className={`hs-hero-logo ${ready ? "hs-hero-logo--ready" : ""} ${className}`}>
      <img src={POSTER_URL} alt="Logo HoodStories" width="1078" height="827" decoding="async" />
    </div>
  );
}
