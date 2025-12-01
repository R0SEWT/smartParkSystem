import { useEffect, useMemo, useState } from "react";
import { api, RegistroData } from "./api/client";

const STORAGE_KEY = "smartpark:selectedCampus";
const CAMPUS = [
  { code: "MON", name: "Monterrico", accent: "from-cyan-500 to-emerald-500" },
  { code: "SMG", name: "San Miguel", accent: "from-orange-500 to-amber-400" },
  { code: "SIZ", name: "San Isidro", accent: "from-blue-600 to-indigo-500" },
  { code: "VIL", name: "Villa", accent: "from-rose-500 to-pink-400" }
];

function useAsync<T>(fn: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    fn()
      .then((res) => {
        if (alive) setData(res);
      })
      .catch((err) => alive && setError(err.message))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, deps);

  return { data, loading, error };
}

function App() {
  const defaultCampus = CAMPUS[0].code;
  const [selectedCampus, setSelectedCampus] = useState<string>(() => {
    if (typeof window === "undefined") return defaultCampus;
    return localStorage.getItem(STORAGE_KEY) || defaultCampus;
  });
  const status = useAsync(() => api.statusOverview(), []);
  const registros = useAsync(() => api.registroData({ limit: 400 }), []);

  const regItems = registros.data?.items || [];

  const latestBySensor = useMemo(() => {
    const map = new Map<number, RegistroData>();
    for (const item of regItems) {
      const prev = map.get(item.sensor_id);
      const prevDate = prev?.created_at ? new Date(prev.created_at).getTime() : 0;
      const currDate = item.created_at ? new Date(item.created_at).getTime() : 0;
      if (!prev || currDate >= prevDate) {
        map.set(item.sensor_id, item);
      }
    }
    return map;
  }, [regItems]);

  const sensorsByCampus = useMemo(() => {
    const map = new Map<string, RegistroData[]>();
    for (const entry of latestBySensor.values()) {
      const campus = entry.estacionamiento_id?.split("-")[0];
      if (!campus) continue;
      const list = map.get(campus) ?? [];
      list.push(entry);
      map.set(campus, list);
    }
    return map;
  }, [latestBySensor]);

  const campusCards = useMemo(() => {
    return CAMPUS.map((c) => {
      const sensors = sensorsByCampus.get(c.code) ?? [];
      const total = sensors.length;
      const libres = sensors.filter((r) => r.estado === "libre").length;
      const ocupados = total - libres;
      const freeRatio = total ? Math.round((libres / total) * 100) : 0;
      const lastUpdated = sensors.reduce((acc, r) => {
        const t = r.created_at ? new Date(r.created_at).getTime() : 0;
        return t > acc ? t : acc;
      }, 0);
      return {
        ...c,
        total,
        ocupados,
        libres,
        freeRatio,
        lastUpdated
      };
    }).sort((a, b) => b.libres - a.libres);
  }, [sensorsByCampus]);

  useEffect(() => {
    if (typeof window !== "undefined" && selectedCampus) {
      localStorage.setItem(STORAGE_KEY, selectedCampus);
    }
  }, [selectedCampus]);

  const selectedCampusInfo = CAMPUS.find((c) => c.code === selectedCampus) || CAMPUS[0];
  const selectedCampusData =
    campusCards.find((c) => c.code === selectedCampus) ||
    campusCards.find((c) => c.code === defaultCampus) ||
    campusCards[0] ||
    null;

  const selectedSensors = useMemo(() => {
    return regItems
      .filter((r) => (selectedCampus ? r.estacionamiento_id?.startsWith(selectedCampus) : true))
      .sort((a, b) => {
        if (a.estado === b.estado) {
          return (a.estacionamiento_id || "").localeCompare(b.estacionamiento_id || "");
        }
        return a.estado === "libre" ? -1 : 1;
      });
  }, [regItems, selectedCampus]);

  const handleCampusSelect = (code: string) => {
    setSelectedCampus(code);
  };

  const totalLibres = campusCards.reduce((acc, c) => acc + c.libres, 0);
  const totalSensores = campusCards.reduce((acc, c) => acc + c.total, 0);
  const campusSectionId = "campus-availability";

  const lastUpdateLabel = (ts?: number) => {
    if (!ts) return "sin datos";
    return `actualizado ${new Date(ts).toLocaleTimeString()}`;
  };

  const minutesAgo = (ts?: number) => {
    if (!ts) return null;
    const diff = Math.max(0, Date.now() - ts);
    return Math.round(diff / 60000);
  };

  const minutesSinceSelectedUpdate = minutesAgo(selectedCampusData?.lastUpdated);
  const selectedCampusFloors = useMemo(() => {
    if (!selectedCampus) return [];
    const sensors = sensorsByCampus.get(selectedCampus) ?? [];
    const floorMap = new Map<
      string,
      { code: string; libres: number; ocupados: number; total: number; lastUpdated: number }
    >();
    for (const sensor of sensors) {
      const [, rawFloor] = (sensor.estacionamiento_id || "").split("-");
      const floorCode = rawFloor || "General";
      const entry =
        floorMap.get(floorCode) ||
        { code: floorCode, libres: 0, ocupados: 0, total: 0, lastUpdated: 0 };
      entry.total += 1;
      if (sensor.estado === "libre") entry.libres += 1;
      else entry.ocupados += 1;
      const created = sensor.created_at ? new Date(sensor.created_at).getTime() : 0;
      if (created > entry.lastUpdated) entry.lastUpdated = created;
      floorMap.set(floorCode, entry);
    }
    return Array.from(floorMap.values()).sort((a, b) => b.libres - a.libres);
  }, [selectedCampus, sensorsByCampus]);

  const preferredFloor = selectedCampusFloors[0] || null;
  const backupFloor = selectedCampusFloors[1] || null;
  const formatFloorLabel = (code?: string) => (code ? `Nivel ${code}` : "Nivel sin etiqueta");
  const preferredFloorMinutesAgo = minutesAgo(preferredFloor?.lastUpdated);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">SmartPark</p>
            <h1 className="text-2xl font-bold text-slate-900">Disponibilidad en vivo para tu llegada</h1>
            <p className="text-sm text-slate-500">Monterrico · San Miguel · San Isidro · Villa</p>
          </div>
          <div className="flex items-center gap-3 text-sm text-slate-600">
            <span className="inline-flex h-3 w-3 rounded-full bg-emerald-400 shadow-[0_0_0_6px_rgba(16,185,129,0.2)]"></span>
            {status.loading || registros.loading ? "Actualizando datos…" : "Datos sincronizados"}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 space-y-10">
        <section className="rounded-3xl bg-gradient-to-br from-slate-900 via-indigo-900 to-emerald-900 p-6 text-white shadow-xl sm:p-10">
          <div className="grid gap-8 md:grid-cols-2">
            <div className="space-y-5">
              <p className="text-xs uppercase tracking-[0.3em] text-white/80">Llegaste al campus</p>
              <h2 className="text-3xl font-semibold leading-tight sm:text-4xl">
                Revisa los lugares disponibles antes de estacionar
              </h2>
              <p className="text-base text-white/80">
                Consulta el estado de tu campus asignado y evita vueltas innecesarias dentro del mismo. Los datos se actualizan en tiempo real desde cada sensor.
              </p>
              <div className="flex flex-wrap gap-3">
                <a
                  href={`#${campusSectionId}`}
                  className="inline-flex items-center justify-center rounded-full bg-white px-5 py-2 text-sm font-semibold text-slate-900 shadow-sm"
                >
                  Ver disponibilidad
                </a>
                <span className="inline-flex items-center rounded-full border border-white/30 px-4 py-2 text-sm text-white/80">
                  {totalLibres} lugares libres · {totalSensores ? `${totalSensores} sensores` : "sin sensores activos"}
                </span>
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/10 p-5 backdrop-blur">
              <p className="text-xs uppercase tracking-wide text-white/70">Tu campus fijo</p>
              <p className="mt-2 text-4xl font-semibold">
                {selectedCampusData ? `${selectedCampusData.libres} libres` : "Sin datos"}
              </p>
              <p className="text-white/80">
                {selectedCampusData
                  ? `${selectedCampusData.name} es tu punto de llegada habitual.`
                  : "Selecciona una sede para ver su disponibilidad."}
              </p>
              <div className="mt-4">
                <label className="text-xs uppercase tracking-wide text-white/70">Selecciona la sede</label>
                <div className="mt-2 rounded-2xl bg-white/10 p-3 shadow-inner">
                  <select
                    value={selectedCampus}
                    onChange={(e) => handleCampusSelect(e.target.value)}
                    className="w-full rounded-xl border border-white/20 bg-white/90 px-3 py-2 text-sm font-semibold text-slate-900 focus:outline-none"
                  >
                    {CAMPUS.map((campus) => (
                      <option key={campus.code} value={campus.code}>
                        {campus.name}
                      </option>
                    ))}
                  </select>
                  <p className="mt-2 text-[11px] text-white/70">Guardamos tu elección para la próxima visita.</p>
                </div>
              </div>
              <div className="mt-6 grid gap-3 text-sm">
                <div className="flex items-center justify-between rounded-xl bg-white/10 px-4 py-3">
                  <span>Última actualización</span>
                  <span className="font-semibold">
                    {selectedCampusData?.lastUpdated ? lastUpdateLabel(selectedCampusData.lastUpdated) : "sin datos"}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-xl bg-white/10 px-4 py-3">
                  <span>Piso recomendado</span>
                  <span className="font-semibold">
                    {preferredFloor
                      ? `${formatFloorLabel(preferredFloor.code)} (${preferredFloor.libres} libres)`
                      : "En evaluación"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id={campusSectionId} className="space-y-6">
          <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Campus de destino</p>
                <h3 className="text-2xl font-semibold text-slate-900">
                  Tu estacionamiento en {selectedCampusData?.name ?? selectedCampusInfo.name}
                </h3>
              </div>
              <p className="text-sm text-slate-500">{lastUpdateLabel(selectedCampusData?.lastUpdated)}</p>
            </div>
            <p className="mt-1 text-sm text-slate-500">
              Aquí monitoreas los sensores que te importan hoy. Cambia de sede desde el selector superior si tu destino
              habitual varía.
            </p>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-center">
                <p className="text-xs uppercase tracking-wide text-slate-500">Libres</p>
                <p className="text-2xl font-semibold text-emerald-600">{selectedCampusData?.libres ?? 0}</p>
              </div>
              <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-center">
                <p className="text-xs uppercase tracking-wide text-slate-500">Ocupados</p>
                <p className="text-2xl font-semibold text-red-600">{selectedCampusData?.ocupados ?? 0}</p>
              </div>
              <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-center">
                <p className="text-xs uppercase tracking-wide text-slate-500">Capacidad</p>
                <p className="text-2xl font-semibold text-slate-900">{selectedCampusData?.total ?? 0}</p>
              </div>
            </div>
            <div className="mt-6 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-slate-900">Espacios en tiempo real</h4>
                {registros.loading && <p className="text-xs text-slate-500">Actualizando…</p>}
                {registros.error && <p className="text-xs text-red-600">Error: {registros.error}</p>}
              </div>
              {selectedSensors.length ? (
                <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
                  {selectedSensors.map((sensor) => (
                    <div
                      key={`${sensor.sensor_id}-${sensor.estacionamiento_id ?? "sede"}`}
                      className="flex items-center justify-between rounded-2xl border border-slate-100 px-3 py-2 text-sm"
                    >
                      <div>
                        <p className="font-semibold text-slate-900">{sensor.estacionamiento_id}</p>
                        <p className="text-xs text-slate-500">
                          Sensor {sensor.sensor_id} ·{" "}
                          {sensor.created_at ? new Date(sensor.created_at).toLocaleTimeString() : "sin hora"}
                        </p>
                      </div>
                      <span
                        className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
                          sensor.estado === "libre"
                            ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
                            : "border border-red-200 bg-red-50 text-red-700"
                        }`}
                      >
                        {sensor.estado}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-500">No hay lecturas recientes para esta sede.</p>
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Estado general</p>
                <h3 className="text-2xl font-semibold text-slate-900">Así van las sedes hoy</h3>
              </div>
              {status.error && <p className="text-sm text-red-600">Error al cargar estado: {status.error}</p>}
            </div>
            <p className="mt-1 text-sm text-slate-500">
              Usa este tablero solo para contexto. Aunque ya tengas campus asignado, aquí ves qué sedes están más libres.
            </p>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {campusCards.map((c) => (
                <div
                  key={c.code}
                  className={`relative overflow-hidden rounded-3xl border bg-white p-5 shadow-sm ${
                    selectedCampus === c.code ? "border-indigo-400 ring-2 ring-indigo-200" : "border-slate-100"
                  }`}
                >
                  <div className={`absolute inset-x-4 top-0 h-1 rounded-full bg-gradient-to-r ${c.accent} opacity-80`} />
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-slate-500">{c.code}</p>
                      <h4 className="text-lg font-semibold text-slate-900">{c.name}</h4>
                      <p className="text-sm text-slate-500">
                        {c.libres} libres · {c.ocupados} ocupados
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-3xl font-semibold text-slate-900">{c.libres}</p>
                      <p className="text-xs text-slate-500">lugares libres</p>
                    </div>
                  </div>
                  <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-cyan-400"
                      style={{ width: `${c.freeRatio}%` }}
                    />
                  </div>
                  <p className="mt-2 text-xs text-slate-500">{lastUpdateLabel(c.lastUpdated)}</p>
                </div>
              ))}
              {!campusCards.length && (
                <div className="rounded-3xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
                  Conecta con la API para ver los campus disponibles.
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Planifica tu llegada por piso</p>
              <h3 className="text-2xl font-semibold text-slate-900">
                Campus de destino: {selectedCampusData?.name ?? selectedCampusInfo.name}
              </h3>
            </div>
            {status.loading && <span className="text-xs text-slate-500">Actualizando lecturas…</span>}
          </div>
          <p className="mt-2 text-sm text-slate-500">
            Siempre estacionarás en este campus. Usa los sensores para decidir rápidamente a qué piso entrar y evita
            dar vueltas fuera de tu sede.
          </p>
          {selectedCampusFloors.length ? (
            <>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {selectedCampusFloors.slice(0, 4).map((floor) => (
                  <div
                    key={floor.code}
                    className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-700"
                  >
                    <div className="flex items-center justify-between">
                      <p className="font-semibold text-slate-900">{formatFloorLabel(floor.code)}</p>
                      <span className="text-xs text-slate-500">{floor.total} plazas</span>
                    </div>
                    <p className="mt-1 text-emerald-600">
                      {floor.libres} libres <span className="text-slate-400">/ {floor.ocupados} ocupados</span>
                    </p>
                    <p className="text-[11px] text-slate-500">
                      {floor.lastUpdated ? lastUpdateLabel(floor.lastUpdated) : "Sin lecturas recientes"}
                    </p>
                  </div>
                ))}
              </div>
              <ul className="mt-5 space-y-3 text-sm text-slate-600">
                <li className="rounded-2xl bg-slate-50 p-3">
                  1. Ingresa directo a {formatFloorLabel(preferredFloor?.code)}: en este momento hay{" "}
                  {preferredFloor?.libres ?? 0} plazas disponibles.
                </li>
                <li className="rounded-2xl bg-slate-50 p-3">
                  2. Si se llena, baja o sube al {backupFloor ? formatFloorLabel(backupFloor.code) : "nivel siguiente"},{" "}
                  {backupFloor ? `${backupFloor.libres} libres` : "verifica los sensores para decidir rápido"}.
                </li>
                <li className="rounded-2xl bg-slate-50 p-3">
                  3. Consulta esta pantalla antes de moverte:{" "}
                  {preferredFloorMinutesAgo !== null
                    ? `la última lectura de tu nivel llegó hace ${preferredFloorMinutesAgo} min.`
                    : "aún no tenemos lecturas en este nivel, actualiza en unos segundos."}
                </li>
              </ul>
            </>
          ) : (
            <p className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">
              Todavía no registramos espacios por piso para esta sede. Mantén abierta la pantalla para verlos en cuanto lleguen.
            </p>
          )}
        </section>
      </main>
    </div>
  );
}

export default App;
