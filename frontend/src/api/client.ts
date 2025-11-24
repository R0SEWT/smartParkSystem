export type RegistroData = {
  sensor_id: number;
  estacionamiento_id: string;
  estado: string;
  hora_libre: string | null;
  hora_ocupado: string | null;
  created_at: string | null;
};

export type StatusOverview = {
  last_events: any[];
  registro_data: RegistroData[];
};

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8080";

async function http<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${res.status}: ${body}`);
  }
  return res.json();
}

export const api = {
  statusOverview: () => http<StatusOverview>("/status_overview"),
  registroData: (params: { limit?: number; estacionamiento_id?: string; sensor_id?: number } = {}) => {
    const search = new URLSearchParams();
    if (params.limit) search.set("limit", String(params.limit));
    if (params.estacionamiento_id) search.set("estacionamiento_id", params.estacionamiento_id);
    if (params.sensor_id) search.set("sensor_id", String(params.sensor_id));
    const qs = search.toString();
    return http<{ ok: boolean; count: number; items: RegistroData[] }>(`/registro_data${qs ? `?${qs}` : ""}`);
  }
};
