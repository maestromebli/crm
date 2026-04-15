"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import Image from "next/image";
import type {
  Mesh,
  MeshBasicMaterial,
  Object3D,
  PlaneGeometry,
  Texture,
} from "three";
import { useAssistantChat } from "../../features/ai-assistant/hooks/useAssistantChat";

type RobotEmotion =
  | "happy"
  | "thinking"
  | "loading"
  | "surprised"
  | "wink"
  | "sad";

const EMOTION_TEXTURES: Record<RobotEmotion, string> = {
  happy: "/robot-assistant/emotions/happy.png",
  thinking: "/robot-assistant/emotions/thinking.png",
  loading: "/robot-assistant/emotions/loading.png",
  surprised: "/robot-assistant/emotions/surprised.png",
  wink: "/robot-assistant/emotions/wink.png",
  sad: "/robot-assistant/emotions/sad.png",
};

type ChatMessage = {
  id: string;
  role: "assistant" | "user";
  text: string;
};

function RobotCanvas({ emotion }: { emotion: RobotEmotion }) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const emotionRef = useRef<RobotEmotion>(emotion);
  const updateFaceRef = useRef<((nextEmotion: RobotEmotion) => void) | null>(
    null,
  );

  emotionRef.current = emotion;

  useEffect(() => {
    const mountNode = rootRef.current;
    let disposed = false;
    let cleanupResize = () => {};
    let cleanupScene: (() => void) | null = null;

    async function bootstrap() {
      if (!mountNode) return;

      const THREE = await import("three");
      const { OrbitControls } = await import(
        "three/examples/jsm/controls/OrbitControls.js"
      );
      const { GLTFLoader } = await import(
        "three/examples/jsm/loaders/GLTFLoader.js"
      );

      if (disposed) return;

      const container = mountNode;
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(
        35,
        container.clientWidth / container.clientHeight,
        0.1,
        100,
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
      const textureCache = new Map<RobotEmotion, Texture>();
      let robot: Object3D | null = null;
      let facePlane: Mesh<PlaneGeometry, MeshBasicMaterial> | null = null;

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
          depthWrite: false,
        });
        facePlane = new THREE.Mesh(geometry, material);
        facePlane.position.set(0, 0.728, 0.122);
        scene.add(facePlane);
      });

      const onResize = () => {
        if (disposed) return;
        const width = mountNode.clientWidth;
        const height = mountNode.clientHeight;
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height);
      };

      window.addEventListener("resize", onResize);
      cleanupResize = () => window.removeEventListener("resize", onResize);

      const animate = () => {
        if (disposed) return;
        controls.update();
        if (robot) robot.rotation.y += 0.002;
        renderer.render(scene, camera);
        requestAnimationFrame(animate);
      };

      animate();

      return () => {
        controls.dispose();
        renderer.dispose();
        textureCache.forEach((texture) => texture.dispose());
        textureCache.clear();
      };
    }

    bootstrap().then((cleanup) => {
      cleanupScene = cleanup ?? null;
    });

    return () => {
      disposed = true;
      cleanupResize();
      if (cleanupScene) cleanupScene();
      updateFaceRef.current = null;
      if (mountNode) mountNode.innerHTML = "";
    };
  }, []);

  useEffect(() => {
    updateFaceRef.current?.(emotion);
  }, [emotion]);

  return <div ref={rootRef} className="h-full w-full" />;
}

export function NewAssistantWidget() {
  const { data: session } = useSession();
  const [isOpen, setIsOpen] = useState(false);
  const [reactionEmotion, setReactionEmotion] = useState<RobotEmotion>("wink");
  const [input, setInput] = useState("");
  const { messages, loading, error, send, clearMessages } = useAssistantChat({
    persistUserId: session?.user?.id ?? null,
    endpoint: "/api/ai/chat",
    storagePrefix: "enver_new_assistant_chat_v1",
  });
  const emotionTimeoutRef = useRef<number | null>(null);

  const triggerEmotion = useCallback((
    next: RobotEmotion,
    durationMs = 1200,
    fallback: RobotEmotion = "happy",
  ) => {
    if (emotionTimeoutRef.current) {
      window.clearTimeout(emotionTimeoutRef.current);
      emotionTimeoutRef.current = null;
    }
    setReactionEmotion(next);
    if (durationMs > 0) {
      emotionTimeoutRef.current = window.setTimeout(() => {
        setReactionEmotion(fallback);
        emotionTimeoutRef.current = null;
      }, durationMs);
    }
  }, []);

  useEffect(() => {
    const onEmotion = (event: Event) => {
      const customEvent = event as CustomEvent<{
        emotion?: RobotEmotion;
        important?: boolean;
      }>;
      const nextEmotion = customEvent.detail?.emotion;
      if (!nextEmotion || !(nextEmotion in EMOTION_TEXTURES)) return;
      if (nextEmotion === "surprised" && !customEvent.detail?.important) return;
      triggerEmotion(nextEmotion, 1400, "happy");
    };

    const onImportantUpdate = () => {
      triggerEmotion("surprised", 1800, "happy");
    };

    window.addEventListener("enver-assistant-emotion", onEmotion as EventListener);
    window.addEventListener(
      "enver-crm-important-update",
      onImportantUpdate as EventListener,
    );
    return () => {
      if (emotionTimeoutRef.current) {
        window.clearTimeout(emotionTimeoutRef.current);
        emotionTimeoutRef.current = null;
      }
      window.removeEventListener(
        "enver-assistant-emotion",
        onEmotion as EventListener,
      );
      window.removeEventListener(
        "enver-crm-important-update",
        onImportantUpdate as EventListener,
      );
    };
  }, [triggerEmotion]);

  useEffect(() => {
    if (!loading) return;

    const longThinkingTimer = window.setTimeout(() => {
      triggerEmotion("thinking", 0);
    }, 3200);

    const extendedWaitTimer = window.setTimeout(() => {
      triggerEmotion("surprised", 1400, "loading");
    }, 9000);

    return () => {
      window.clearTimeout(longThinkingTimer);
      window.clearTimeout(extendedWaitTimer);
    };
  }, [loading, triggerEmotion]);

  useEffect(() => {
    const idleTimer = window.setInterval(() => {
      if (loading || error || input.trim().length > 0) return;
      triggerEmotion("wink", 900, "happy");
    }, 22000);
    return () => {
      window.clearInterval(idleTimer);
    };
  }, [error, input, loading, triggerEmotion]);

  const sendMessage = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    setInput("");
    triggerEmotion("thinking", 700, "loading");

    void send(trimmed, () => {
      triggerEmotion("happy", 1600, "wink");
    });
  };

  const emotion: RobotEmotion = loading
    ? "loading"
    : error
      ? "sad"
      : reactionEmotion;

  const chatMessages: ChatMessage[] =
    messages.length > 0
      ? messages.map((message) => ({
          id: message.id,
          role: message.role,
          text: message.content,
        }))
      : [
          {
            id: "default-greeting",
            role: "assistant",
            text: "Привіт! Я динамічний ENVER Assistant. Поставте запитання щодо лідів, угод або задач.",
          },
        ];

  const isReplying = loading;

  const quickActionPrompt = (prompt: string) => {
    sendMessage(prompt);
  };

  return (
    <div className="pointer-events-none fixed bottom-0 right-0 z-[180] p-4">
      <div className="pointer-events-auto flex flex-col items-end gap-2">
        {isOpen ? (
          <div className="w-[min(95vw,430px)] overflow-hidden rounded-3xl border border-slate-300 bg-slate-50 shadow-2xl shadow-slate-400/40">
            <div className="flex items-center justify-between border-b border-slate-700 bg-slate-900 px-4 py-2.5 text-slate-100">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-100">
                  ENVER Assistant PRO
                </p>
                <p className="text-[11px] text-slate-300">
                  Динамічний 3D-помічник CRM
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                  онлайн
                </span>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="rounded-lg border border-slate-500 px-2 py-0.5 text-xs text-slate-100 transition hover:bg-slate-800"
                  aria-label="Згорнути асистента"
                >
                  ×
                </button>
              </div>
            </div>

            <div className="border-b border-slate-300 bg-slate-100 p-2.5">
              <div className="relative h-[265px] overflow-hidden rounded-2xl border border-slate-300 bg-[radial-gradient(circle_at_top,#d8e8ff_0%,#edf4ff_35%,#f8fbff_70%)]">
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.18),transparent_58%)]" />
                <RobotCanvas emotion={emotion} />
                <div className="pointer-events-none absolute bottom-2 right-2 rounded-lg border border-slate-300 bg-white/95 px-2 py-1 text-[10px] text-slate-700">
                  Емоція: {emotion}
                </div>
              </div>
              <div className="mt-2 rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-[10px] text-slate-700">
                Емоції перемикаються автоматично залежно від подій у діалозі.
              </div>
            </div>

            <div className="space-y-2 bg-slate-100 p-2.5">
              <div className="max-h-[180px] space-y-2 overflow-y-auto rounded-2xl border border-slate-300 bg-white p-2">
                {chatMessages.map((message) => (
                  <div
                    key={message.id}
                    className={`max-w-[90%] rounded-2xl px-3 py-1.5 text-xs ${
                      message.role === "assistant"
                        ? "bg-white text-slate-700 shadow-sm"
                        : "ml-auto bg-sky-600 text-white"
                    }`}
                  >
                    {message.text}
                  </div>
                ))}
                {isReplying ? (
                  <div className="max-w-[90%] rounded-2xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-600">
                    Думаю над відповіддю...
                  </div>
                ) : null}
                {error ? (
                  <div className="max-w-[95%] rounded-2xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs text-rose-700">
                    {error}
                  </div>
                ) : null}
              </div>

              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    triggerEmotion("wink", 1200, "thinking");
                    quickActionPrompt("Покажи нові ліди за сьогодні");
                  }}
                  className="rounded-full border border-slate-300 bg-white px-2 py-1 text-[10px] text-slate-700 hover:bg-slate-50"
                >
                  Нові ліди
                </button>
                <button
                  type="button"
                  onClick={() => {
                    triggerEmotion("thinking", 1000, "loading");
                    quickActionPrompt("Які угоди зараз без next step?");
                  }}
                  className="rounded-full border border-slate-300 bg-white px-2 py-1 text-[10px] text-slate-700 hover:bg-slate-50"
                >
                  Угоди без кроку
                </button>
                <button
                  type="button"
                  onClick={() => {
                    triggerEmotion("thinking", 1200, "loading");
                    quickActionPrompt("Розбери помилку в CRM і запропонуй кроки");
                  }}
                  className="rounded-full border border-slate-300 bg-white px-2 py-1 text-[10px] text-slate-700 hover:bg-slate-50"
                >
                  Розбір помилки
                </button>
                <button
                  type="button"
                  onClick={() => {
                    clearMessages();
                    triggerEmotion("wink", 1300, "happy");
                  }}
                  className="rounded-full border border-slate-300 bg-white px-2 py-1 text-[10px] text-slate-700 hover:bg-slate-50"
                >
                  Очистити чат
                </button>
              </div>

              <form
                className="flex items-center gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  sendMessage(input);
                }}
              >
                <input
                  value={input}
                  onFocus={() => triggerEmotion("thinking", 1200, "happy")}
                  onChange={(event) => {
                    setInput(event.target.value);
                    triggerEmotion("thinking", 800, "happy");
                  }}
                  placeholder="Напишіть запит асистенту..."
                  className="h-9 flex-1 rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-800 outline-none placeholder:text-slate-500 focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                />
                <button
                  type="submit"
                  disabled={!input.trim() || isReplying}
                  className="h-9 rounded-xl bg-slate-900 px-3 text-xs font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Надіслати
                </button>
              </form>
            </div>
          </div>
        ) : null}

        <button
          type="button"
          onClick={() => setIsOpen((value) => !value)}
          className="relative flex h-14 w-14 items-center justify-center overflow-hidden rounded-full border border-slate-300 bg-white shadow-lg shadow-slate-300/40 transition hover:border-sky-400/70"
          aria-label={isOpen ? "Згорнути асистента" : "Відкрити асистента"}
        >
          <span className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.22),transparent_60%)]" />
          <Image
            src={EMOTION_TEXTURES[emotion]}
            alt="assistant face"
            width={40}
            height={40}
            className="relative h-10 w-10 rounded-full object-cover"
          />
          {isReplying ? (
            <span className="absolute -right-0.5 -top-0.5 h-3.5 w-3.5 rounded-full border border-white bg-sky-500" />
          ) : null}
        </button>
      </div>
    </div>
  );
}
