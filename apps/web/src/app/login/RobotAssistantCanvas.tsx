"use client";

import { useEffect, useRef } from "react";
import type { RobotEmotion } from "./robotEmotion";

type Props = {
  emotion: RobotEmotion;
};

const EMOTION_TEXTURES: Record<RobotEmotion, string> = {
  happy: "/robot-assistant/emotions/happy.png",
  thinking: "/robot-assistant/emotions/thinking.png",
  loading: "/robot-assistant/emotions/loading.png",
  surprised: "/robot-assistant/emotions/surprised.png",
  wink: "/robot-assistant/emotions/wink.png",
  sad: "/robot-assistant/emotions/sad.png"
};

export function RobotAssistantCanvas({ emotion }: Props) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const emotionRef = useRef<RobotEmotion>(emotion);
  const updateFaceRef = useRef<((nextEmotion: RobotEmotion) => void) | null>(null);

  emotionRef.current = emotion;

  useEffect(() => {
    let disposed = false;
    let cleanupResize = () => {};

    async function bootstrap() {
      if (!rootRef.current) return;

      const THREE = await import("three");
      const { OrbitControls } = await import("three/examples/jsm/controls/OrbitControls.js");
      const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader.js");

      if (disposed || !rootRef.current) return;

      const container = rootRef.current;
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(
        35,
        container.clientWidth / container.clientHeight,
        0.1,
        100
      );
      camera.position.set(0, 0.15, 4.2);

      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setSize(container.clientWidth, container.clientHeight);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      container.appendChild(renderer.domElement);

      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enablePan = false;
      controls.enableDamping = true;
      controls.minDistance = 2.8;
      controls.maxDistance = 6;
      controls.target.set(0, 0.05, 0);

      scene.add(new THREE.AmbientLight(0xffffff, 1.8));

      const keyLight = new THREE.DirectionalLight(0xffffff, 2.2);
      keyLight.position.set(2, 3, 4);
      scene.add(keyLight);

      const rim = new THREE.DirectionalLight(0x88bbff, 1.6);
      rim.position.set(-3, 2, -2);
      scene.add(rim);

      const textureLoader = new THREE.TextureLoader();
      const textureCache = new Map<RobotEmotion, THREE.Texture>();
      let robot: THREE.Object3D | null = null;
      let facePlane: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial> | null = null;

      const loadEmotionTexture = (name: RobotEmotion) => {
        const cached = textureCache.get(name);
        if (cached) return cached;

        const texture = textureLoader.load(EMOTION_TEXTURES[name]);
        texture.colorSpace = THREE.SRGBColorSpace;
        textureCache.set(name, texture);
        return texture;
      };

      const updateFace = (nextEmotion: RobotEmotion) => {
        if (!facePlane) return;
        facePlane.material.map = loadEmotionTexture(nextEmotion);
        facePlane.material.needsUpdate = true;
      };

      updateFaceRef.current = updateFace;

      const gltfLoader = new GLTFLoader();
      gltfLoader.load("/robot-assistant/enver_crm_robot_assistant.glb", (gltf) => {
        if (disposed) return;

        robot = gltf.scene;
        robot.rotation.y = 0.15;
        scene.add(robot);

        const geometry = new THREE.PlaneGeometry(1.06, 0.82);
        const material = new THREE.MeshBasicMaterial({
          map: loadEmotionTexture(emotionRef.current),
          transparent: true,
          depthWrite: false
        });

        facePlane = new THREE.Mesh(geometry, material);
        facePlane.position.set(0, 0.728, 0.122);
        scene.add(facePlane);
      });

      const onResize = () => {
        if (disposed || !rootRef.current) return;
        const width = rootRef.current.clientWidth;
        const height = rootRef.current.clientHeight;
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height);
      };

      window.addEventListener("resize", onResize);
      cleanupResize = () => window.removeEventListener("resize", onResize);

      const animate = () => {
        if (disposed) return;
        controls.update();
        if (robot) {
          robot.rotation.y += 0.002;
        }
        renderer.render(scene, camera);
        requestAnimationFrame(animate);
      };

      animate();

      return () => {
        controls.dispose();
        renderer.dispose();
        textureCache.forEach((tex) => tex.dispose());
        textureCache.clear();
      };
    }

    let cleanupScene: (() => void) | void;

    bootstrap().then((cleanup) => {
      cleanupScene = cleanup;
    });

    return () => {
      disposed = true;
      cleanupResize();
      cleanupScene?.();
      updateFaceRef.current = null;
      if (rootRef.current) {
        rootRef.current.innerHTML = "";
      }
    };
  }, []);

  useEffect(() => {
    updateFaceRef.current?.(emotion);
  }, [emotion]);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-800/80 bg-slate-950/60">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.22),transparent_60%)]" />
      <div ref={rootRef} className="h-[280px] w-full" />
    </div>
  );
}
