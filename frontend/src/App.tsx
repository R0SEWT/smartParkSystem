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

function RegistroTable({ items, loading }: { items: RegistroData[]; loading: boolean }) {
  if (loading) return <p className="text-slate-500 text-sm">Cargando registros...</p>;
  if (!items.length) return <p className="text-slate-500 text-sm">Sin registros aún.</p>;

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
      <table className="min-w-full text-sm">
        <thead className="bg-slate-50 text-slate-600">
          <tr>
            <th className="px-4 py-2 text-left font-semibold">Sensor</th>
            <th className="px-4 py-2 text-left font-semibold">Estacionamiento</th>
            <th className="px-4 py-2 text-left font-semibold">Estado</th>
            <th className="px-4 py-2 text-left font-semibold">Ocupado</th>
            <th className="px-4 py-2 text-left font-semibold">Libre</th>
            <th className="px-4 py-2 text-left font-semibold">Creado</th>
          </tr>
        </thead>
        <tbody>
          {items.map((r) => (
            <tr key={`${r.sensor_id}-${r.created_at}`} className="border-t border-slate-100 hover:bg-slate-50/60">
              <td className="px-4 py-2 font-medium text-slate-900">{r.sensor_id}</td>
              <td className="px-4 py-2 text-slate-700">{r.estacionamiento_id}</td>
              <td className="px-4 py-2">
                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs border ${badges[r.estado as "ocupado" | "libre"] ?? "bg-slate-100 border-slate-200 text-slate-700"}`}>
                  {r.estado}
                </span>
              </td>
              <td className="px-4 py-2 text-slate-700">{r.hora_ocupado ? new Date(r.hora_ocupado).toLocaleString() : "—"}</td>
              <td className="px-4 py-2 text-slate-700">{r.hora_libre ? new Date(r.hora_libre).toLocaleString() : "—"}</td>
              <td className="px-4 py-2 text-slate-600">{r.created_at ? new Date(r.created_at).toLocaleTimeString() : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function LastEvents({ events, loading }: { events: LastEvent[]; loading: boolean }) {
  if (loading) return <p className="text-slate-500 text-sm">Cargando eventos crudos...</p>;
  if (!events.length) return <p className="text-slate-500 text-sm">Sin eventos.</p>;
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {events.map((e, idx) => (
        <div key={idx} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-900">Sensor {e.sensor_id}</p>
              {e.estacionamiento_id && <p className="text-xs text-slate-500">{e.estacionamiento_id}</p>}
            </div>
            {e.estado && <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs border ${badges[e.estado as "ocupado" | "libre"] ?? ""}`}>{e.estado}</span>}
            {typeof e.occupied === "boolean" && !e.estado && (
              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs border ${e.occupied ? badges.ocupado : badges.libre}`}>{e.occupied ? "ocupado" : "libre"}</span>
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
  const [estacionamientoId, setEstacionamientoId] = useState<string>("");
  const [limit, setLimit] = useState<number>(20);

  const status = useAsync(() => api.statusOverview(), []);
  const registros = useAsync(
    () => api.registroData({ limit, estacionamiento_id: estacionamientoId || undefined }),
    [estacionamientoId, limit]
  );

  const lastEvents = useMemo(() => (status.data?.last_events as LastEvent[]) || [], [status.data]);
  const regItems = registros.data?.items || [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 text-slate-900">
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">SmartPark</p>
            <h1 className="text-xl font-bold text-ink">Control de Parking</h1>
          </div>
          <div className="flex items-center gap-3 text-sm text-slate-600">
            <span className="inline-flex h-3 w-3 rounded-full bg-emerald-400"></span>
            API conectada
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 space-y-6">
        <section className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-slate-500">Sedes</p>
            <p className="mt-2 text-3xl font-bold text-ink">4</p>
            <p className="text-sm text-slate-500">Operando</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-slate-500">Últimos eventos</p>
            <p className="mt-2 text-3xl font-bold text-ink">{lastEvents.length}</p>
            <p className="text-sm text-slate-500">Mongo crudo</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-slate-500">Registros</p>
            <p className="mt-2 text-3xl font-bold text-ink">{registros.data?.count ?? 0}</p>
            <p className="text-sm text-slate-500">Postgres normalizado</p>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-3 lg:col-span-2">
            <div className="flex flex-wrap items-center gap-3">
              <div>
                <label className="text-xs text-slate-500">Estacionamiento</label>
                <input
                  value={estacionamientoId}
                  onChange={(e) => setEstacionamientoId(e.target.value)}
                  placeholder="EST-001"
                  className="mt-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <div>
                <label className="text-xs text-slate-500">Límite</label>
                <input
                  type="number"
                  min={1}
                  max={500}
                  value={limit}
                  onChange={(e) => setLimit(Number(e.target.value) || 1)}
                  className="mt-1 w-24 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              {registros.error && <p className="text-sm text-red-600">Error: {registros.error}</p>}
            </div>
            <RegistroTable items={regItems} loading={registros.loading} />
          </div>

          <div className="space-y-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-ink">Eventos crudos</h2>
                {status.loading && <span className="text-xs text-slate-500">Cargando...</span>}
              </div>
              <LastEvents events={lastEvents} loading={status.loading} />
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;
