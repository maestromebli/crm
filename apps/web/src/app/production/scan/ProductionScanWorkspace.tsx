"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { production3dApi, ProductionStage, ResolveScanPayload } from "../../../lib/production-3d-api";

type ViewMode = "WHOLE" | "MODULE" | "PART" | "TRANSPARENT_OTHERS" | "HIDE_OTHERS";

const STAGES: Array<{ value: ProductionStage; label: string }> = [
  { value: "CUTTING", label: "Порізка" },
  { value: "EDGEBANDING", label: "Крайкування" },
  { value: "DRILLING", label: "Присадка" },
  { value: "ASSEMBLY", label: "Збірка" }
];

const STATUS_LABELS: Record<string, string> = {
  OK: "Успішно",
  BARCODE_NOT_FOUND: "Штрихкод не знайдено",
  MODEL_MISSING: "3D модель відсутня",
  MODULE_LINK_MISSING: "Немає зв'язку з модулем",
  ERROR: "Системна помилка"
};

export function ProductionScanWorkspace() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [barcode, setBarcode] = useState("");
  const [station, setStation] = useState("line-a01");
  const [operatorName, setOperatorName] = useState("Оператор 1");
  const [stage, setStage] = useState<ProductionStage>("CUTTING");
  const [viewMode, setViewMode] = useState<ViewMode>("WHOLE");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<ResolveScanPayload | null>(null);
  const [events, setEvents] = useState<
    Array<{ id: string; scannedAt: string; barcode: string; stage: string; resultStatus: string }>
  >([]);

  const partsForView = useMemo(() => {
    if (!payload?.part) {
      return [];
    }

    if (viewMode === "PART") {
      return [payload.part];
    }

    if (viewMode === "MODULE" || viewMode === "TRANSPARENT_OTHERS" || viewMode === "HIDE_OTHERS") {
      return [payload.part, ...payload.neighbors];
    }

    const treeParts =
      payload.tree?.products.flatMap((product) =>
        product.modules.flatMap((module) => module.parts.map((part) => part.id))
      ) ?? [];

    const known = new Set(treeParts);
    const fromCurrent = [payload.part, ...payload.neighbors];
    return fromCurrent.filter((item) => known.has(item.id));
  }, [payload, viewMode]);

  useEffect(() => {
    void production3dApi
      .getScanEvents()
      .then((list) =>
        setEvents(
          list.slice(0, 8).map((item) => ({
            id: item.id,
            scannedAt: item.scannedAt,
            barcode: item.barcode,
            stage: item.stage,
            resultStatus: item.resultStatus
          }))
        )
      )
      .catch(() => setEvents([]));
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#e2e8f0");

    const camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 1000);
    camera.position.set(0, 4, 8);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(renderer.domElement);

    const ambient = new THREE.AmbientLight(0xffffff, 0.9);
    scene.add(ambient);

    const directional = new THREE.DirectionalLight(0xffffff, 0.8);
    directional.position.set(5, 8, 5);
    scene.add(directional);

    const grid = new THREE.GridHelper(14, 20, 0x94a3b8, 0xcbd5e1);
    scene.add(grid);

    const meshes: THREE.Mesh[] = [];
    const selectedPartId = payload?.part?.id ?? null;

    for (const part of partsForView) {
      const isSelected = selectedPartId === part.id;
      const geometry = new THREE.BoxGeometry(
        Math.max(part.dimensions.width / 500, 0.2),
        Math.max(part.dimensions.thickness / 40, 0.12),
        Math.max(part.dimensions.height / 500, 0.2)
      );
      const material = new THREE.MeshStandardMaterial({
        color: isSelected ? "#f43f5e" : "#1d4ed8",
        transparent: viewMode === "TRANSPARENT_OTHERS" && !isSelected,
        opacity: viewMode === "TRANSPARENT_OTHERS" && !isSelected ? 0.2 : 1
      });
      const mesh = new THREE.Mesh(geometry, material);

      mesh.position.set(...part.transform.position);
      mesh.rotation.set(...part.transform.rotation);
      scene.add(mesh);
      meshes.push(mesh);
    }

    if (viewMode === "HIDE_OTHERS" && selectedPartId) {
      meshes.forEach((mesh, index) => {
        const part = partsForView[index];
        if (part && part.id !== selectedPartId) {
          mesh.visible = false;
        }
      });
    }

    if (payload?.part) {
      const [x, y, z] = payload.part.transform.position;
      camera.position.set(x + 2.6, y + 2, z + 2.4);
      camera.lookAt(x, y, z);
    }

    const animation = () => {
      renderer.render(scene, camera);
      requestAnimationFrame(animation);
    };
    animation();

    const onResize = () => {
      if (!container) {
        return;
      }
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };

    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("resize", onResize);
      renderer.dispose();
      meshes.forEach((mesh) => {
        mesh.geometry.dispose();
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach((material: THREE.Material) => material.dispose());
        } else {
          mesh.material.dispose();
        }
      });
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [partsForView, payload, viewMode]);

  const onScan = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const response = await production3dApi.resolveScan({
        barcode,
        stage,
        station,
        operatorName
      });
      setPayload(response);
      const history = await production3dApi.getScanEvents();
      setEvents(
        history.slice(0, 8).map((item) => ({
          id: item.id,
          scannedAt: item.scannedAt,
          barcode: item.barcode,
          stage: item.stage,
          resultStatus: item.resultStatus
        }))
      );
    } catch (scanError) {
      setError(scanError instanceof Error ? scanError.message : "Помилка запиту");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="mx-auto grid min-h-screen max-w-[1600px] grid-cols-1 gap-4 p-4 lg:grid-cols-[420px_1fr_420px]">
      <section className="rounded-xl border bg-white p-4 shadow-sm">
        <h1 className="text-xl font-semibold">3D навігація по деталі</h1>
        <p className="mt-1 text-sm text-slate-600">Один скан = миттєвий контекст у виробі</p>

        <form className="mt-4 space-y-3" onSubmit={onScan}>
          <label className="block">
            <span className="text-sm font-medium">Штрихкод</span>
            <input
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              className="mt-1 w-full rounded-md border px-3 py-2 text-lg"
              placeholder="Скануйте код"
              required
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium">Ділянка</span>
            <select
              value={stage}
              onChange={(e) => setStage(e.target.value as ProductionStage)}
              className="mt-1 w-full rounded-md border px-3 py-2"
            >
              {STAGES.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-sm font-medium">Станція</span>
            <input value={station} onChange={(e) => setStation(e.target.value)} className="mt-1 w-full rounded-md border px-3 py-2" />
          </label>

          <label className="block">
            <span className="text-sm font-medium">Оператор</span>
            <input
              value={operatorName}
              onChange={(e) => setOperatorName(e.target.value)}
              className="mt-1 w-full rounded-md border px-3 py-2"
            />
          </label>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-slate-900 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
          >
            {loading ? "Пошук..." : "Сканувати"}
          </button>
        </form>

        {error ? <p className="mt-3 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}
        {payload ? (
          <p className="mt-3 rounded-md bg-sky-50 px-3 py-2 text-sm text-sky-700">
            Статус: {STATUS_LABELS[payload.resultStatus] ?? payload.resultStatus}
          </p>
        ) : null}
      </section>

      <section className="rounded-xl border bg-white p-3 shadow-sm">
        <div className="mb-3 flex flex-wrap gap-2">
          <button onClick={() => setViewMode("WHOLE")} className="rounded-md border px-3 py-2 text-sm">
            Показати цілком
          </button>
          <button onClick={() => setViewMode("MODULE")} className="rounded-md border px-3 py-2 text-sm">
            Тільки модуль
          </button>
          <button onClick={() => setViewMode("PART")} className="rounded-md border px-3 py-2 text-sm">
            Ізолювати деталь
          </button>
          <button onClick={() => setViewMode("TRANSPARENT_OTHERS")} className="rounded-md border px-3 py-2 text-sm">
            Інші прозорі
          </button>
          <button onClick={() => setViewMode("HIDE_OTHERS")} className="rounded-md border px-3 py-2 text-sm">
            Сховати інші
          </button>
        </div>
        <div ref={containerRef} className="h-[70vh] w-full rounded-lg border bg-slate-100" />
      </section>

      <section className="space-y-4">
        <article className="rounded-xl border bg-white p-4 shadow-sm">
          <h2 className="text-lg font-semibold">Картка деталі</h2>
          {payload?.part ? (
            <dl className="mt-3 grid grid-cols-1 gap-2 text-sm">
              <div className="rounded-md bg-slate-50 p-2">
                <dt className="font-medium">Замовлення</dt>
                <dd>{payload.order?.number}</dd>
              </div>
              <div className="rounded-md bg-slate-50 p-2">
                <dt className="font-medium">Клієнт / Проєкт</dt>
                <dd>
                  {payload.order?.customer} / {payload.order?.projectName}
                </dd>
              </div>
              <div className="rounded-md bg-slate-50 p-2">
                <dt className="font-medium">Виріб / Модуль</dt>
                <dd>
                  {payload.product?.name} / {payload.module?.name}
                </dd>
              </div>
              <div className="rounded-md bg-slate-50 p-2">
                <dt className="font-medium">Код / Назва</dt>
                <dd>
                  {payload.part.barcode} / {payload.part.partName}
                </dd>
              </div>
              <div className="rounded-md bg-slate-50 p-2">
                <dt className="font-medium">Розмір</dt>
                <dd>
                  {payload.part.dimensions.width} x {payload.part.dimensions.height} x {payload.part.dimensions.thickness} мм
                </dd>
              </div>
              <div className="rounded-md bg-slate-50 p-2">
                <dt className="font-medium">Матеріал / Кромка</dt>
                <dd>
                  {payload.part.material} / {payload.part.edgingInfo}
                </dd>
              </div>
              <div className="rounded-md bg-slate-50 p-2">
                <dt className="font-medium">Етап / Статус</dt>
                <dd>
                  {payload.part.currentStage} / {payload.part.status}
                </dd>
              </div>
            </dl>
          ) : (
            <p className="mt-3 text-sm text-slate-600">Після скану тут з’явиться картка деталі.</p>
          )}
        </article>

        <article className="rounded-xl border bg-white p-4 shadow-sm">
          <h2 className="text-lg font-semibold">Історія сканувань</h2>
          <div className="mt-3 space-y-2 text-sm">
            {events.length === 0 ? (
              <p className="text-slate-600">Подій поки немає.</p>
            ) : (
              events.map((eventItem) => (
                <div key={eventItem.id} className="rounded-md bg-slate-50 p-2">
                  <p className="font-medium">{eventItem.barcode}</p>
                  <p className="text-slate-600">
                    {new Date(eventItem.scannedAt).toLocaleString()} • {eventItem.stage} •{" "}
                    {STATUS_LABELS[eventItem.resultStatus] ?? eventItem.resultStatus}
                  </p>
                </div>
              ))
            )}
          </div>
        </article>
      </section>
    </main>
  );
}
