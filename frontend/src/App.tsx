import { useEffect, useMemo, useState } from "react";
import { api, RegistroData } from "./api/client";

type LastEvent = {
  sensor_id: number;
  estacionamiento_id?: string;
  estado?: string;
  ts?: string;
  occupied?: boolean;
  payload?: Record<string, unknown>;
};

const badges = {
  ocupado: "bg-red-100 text-red-700 border-red-300",
  libre: "bg-emerald-100 text-emerald-700 border-emerald-300"
};

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

function LastEvents({ events, loading }: { events: LastEvent[]; loading: boolean }) {
  if (loading) return <p className="text-slate-500 text-sm">Actualizando lecturas...</p>;
  if (!events.length) return <p className="text-slate-500 text-sm">Aún no hay eventos para mostrar.</p>;
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {events.map((e, idx) => (
        <div key={idx} className="rounded-2xl border border-slate-100 bg-white/70 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-900">Sensor {e.sensor_id}</p>
              {e.estacionamiento_id && <p className="text-xs text-slate-500">{e.estacionamiento_id}</p>}
            </div>
            {e.estado && (
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs border ${badges[e.estado as "ocupado" | "libre"] ?? ""}`}
              >
                {e.estado}
              </span>
            )}
            {typeof e.occupied === "boolean" && !e.estado && (
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs border ${
                  e.occupied ? badges.ocupado : badges.libre
                }`}
              >
                {e.occupied ? "ocupado" : "libre"}
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-slate-500">{e.ts ? new Date(e.ts).toLocaleString() : "—"}</p>
          {e.payload && Object.keys(e.payload).length > 0 && (
            <pre className="mt-2 rounded bg-slate-50 p-2 text-[11px] text-slate-700">{JSON.stringify(e.payload, null, 2)}</pre>
          )}
        </div>
      ))}
    </div>
  );
}

function App() {
  const [selectedCampus, setSelectedCampus] = useState<string>(CAMPUS[0].code);
  const [hasManualSelection, setHasManualSelection] = useState(false);
  const status = useAsync(() => api.statusOverview(), []);
  const registros = useAsync(() => api.registroData({ limit: 400 }), []);

  const lastEvents = useMemo(() => (status.data?.last_events as LastEvent[]) || [], [status.data]);
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

  const bestCampus = useMemo(() => {
    if (!campusCards.length) return null;
    return campusCards.reduce((best, campus) => {
      if (!best) return campus;
      return campus.libres > best.libres ? campus : best;
    }, campusCards[0] ?? null);
  }, [campusCards]);

  useEffect(() => {
    if (!hasManualSelection && bestCampus?.code) {
      setSelectedCampus(bestCampus.code);
    }
  }, [bestCampus, hasManualSelection]);

  const selectedCampusData =
    campusCards.find((c) => c.code === selectedCampus) || bestCampus || campusCards[0] || null;

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

  const alternativeCampus = useMemo(() => {
    return (
      campusCards
        .filter((c) => c.code !== selectedCampus)
        .sort((a, b) => b.libres - a.libres)[0] || null
    );
  }, [campusCards, selectedCampus]);

  const handleCampusSelect = (code: string) => {
    setSelectedCampus(code);
    setHasManualSelection(true);
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
                Consulta en qué sede hay más espacios libres y evita vueltas innecesarias. Los datos se actualizan en tiempo real desde cada sensor.
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
              <p className="text-xs uppercase tracking-wide text-white/70">Campus recomendado</p>
              <p className="mt-2 text-4xl font-semibold">
                {bestCampus ? `${bestCampus.libres} libres` : "Sin datos"}
              </p>
              <p className="text-white/80">
                {bestCampus ? `${bestCampus.name} es la mejor opción en este momento.` : "Conecta para ver lecturas recientes."}
              </p>
              <div className="mt-4 text-sm text-white/70">
                {bestCampus?.lastUpdated ? lastUpdateLabel(bestCampus.lastUpdated) : "Esperando la primera lectura."}
              </div>
              <div className="mt-6 grid gap-3 text-sm">
                <div className="flex items-center justify-between rounded-xl bg-white/10 px-4 py-3">
                  <span>Porcentaje libre</span>
                  <span className="font-semibold">{bestCampus ? `${bestCampus.freeRatio}%` : "—"}</span>
                </div>
                <div className="flex items-center justify-between rounded-xl bg-white/10 px-4 py-3">
                  <span>Plan alterno</span>
                  <span className="font-semibold">
                    {alternativeCampus ? `${alternativeCampus.name} (${alternativeCampus.libres})` : "En evaluación"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id={campusSectionId} className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Selecciona una sede</p>
                <h3 className="text-2xl font-semibold text-slate-900">Elige dónde vas a estacionar</h3>
              </div>
              {status.error && <p className="text-sm text-red-600">Error al cargar estado: {status.error}</p>}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {campusCards.map((c) => (
                <button
                  key={c.code}
                  onClick={() => handleCampusSelect(c.code)}
                  className={`group relative overflow-hidden rounded-3xl border bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg ${
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
                </button>
              ))}
              {!campusCards.length && (
                <div className="rounded-3xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
                  Conecta con la API para ver los campus disponibles.
                </div>
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">Tu selección</p>
                <h3 className="text-xl font-semibold text-slate-900">{selectedCampusData?.name ?? "Sin datos"}</h3>
                <p className="text-sm text-slate-500">{lastUpdateLabel(selectedCampusData?.lastUpdated)}</p>
              </div>
              <div className="text-right">
                <p className="text-4xl font-semibold text-slate-900">{selectedCampusData?.libres ?? "—"}</p>
                <p className="text-xs text-slate-500">lugares libres</p>
              </div>
            </div>
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
        </section>

        <section className="grid gap-6 md:grid-cols-2">
          <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-900">Pulso del estacionamiento</h3>
              {status.loading && <span className="text-xs text-slate-500">Actualizando…</span>}
            </div>
            <LastEvents events={lastEvents} loading={status.loading} />
          </div>
          <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
            <h3 className="text-base font-semibold text-slate-900">Planifica tu llegada por piso</h3>
            <p className="mt-1 text-sm text-slate-500">
              Prioriza los niveles con más lugares dentro de {selectedCampusData?.name ?? "tu campus"}. Así evitas
              saltar entre sedes lejanas.
            </p>
            {selectedCampusFloors.length ? (
              <>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
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
                <ul className="mt-4 space-y-3 text-sm text-slate-600">
                  <li className="rounded-2xl bg-slate-50 p-3">
                    1. Entra directo a {formatFloorLabel(preferredFloor?.code)}: hay{" "}
                    {preferredFloor?.libres ?? 0} espacios libres listos.
                  </li>
                  <li className="rounded-2xl bg-slate-50 p-3">
                    2. ¿Se llenó? Cambia al {backupFloor ? formatFloorLabel(backupFloor.code) : "siguiente nivel disponible"},{" "}
                    {backupFloor ? `${backupFloor.libres} libres` : "monitorea los sensores para elegir rápido"}.
                  </li>
                  <li className="rounded-2xl bg-slate-50 p-3">
                    3. Revisa esta pantalla antes de subir o bajar:{" "}
                    {preferredFloorMinutesAgo !== null
                      ? `la última lectura de tu nivel llegó hace ${preferredFloorMinutesAgo} min.`
                      : "aún no tenemos lecturas en este nivel, refresca en unos segundos."}
                  </li>
                </ul>
              </>
            ) : (
              <p className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">
                Todavía no registramos espacios por piso para esta sede. Mantén abierta la pantalla para verlos en cuanto lleguen.
              </p>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;
