"use client";

import { useState } from "react";

/**
 * CompanyTable — Tabla de empresas con búsqueda, filtros y barras de progreso.
 *
 * Filtros: Todas, Activas (usage > 0), Cerca del Límite (<10% restante)
 * Barra de progreso: verde (<70%), naranja (70-90%), rojo (>90%)
 */

interface ClientData {
  id: string;
  name: string;
  email: string | null;
  apiKey: string;
  active: boolean;
  limit: number;
  usageCount: number;
  createdAt: string;
}

interface CompanyTableProps {
  clients: ClientData[];
  onUpdate: () => void;
}

type Filter = "all" | "active" | "near_limit";

function getProgressColor(percentage: number): string {
  if (percentage > 90) return "bg-red-500";
  if (percentage > 70) return "bg-orange-400";
  return "bg-emerald-500";
}

export default function CompanyTable({ clients, onUpdate }: CompanyTableProps) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [deleting, setDeleting] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);

  // Filtrado
  const filtered = clients.filter((c) => {
    // Búsqueda
    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      c.name.toLowerCase().includes(q) ||
      (c.email && c.email.toLowerCase().includes(q)) ||
      c.apiKey.toLowerCase().includes(q);

    // Filtro de estado
    let matchesFilter = true;
    if (filter === "active") matchesFilter = c.usageCount > 0;
    if (filter === "near_limit") {
      const remaining = c.limit - c.usageCount;
      matchesFilter = remaining < c.limit * 0.1;
    }

    return matchesSearch && matchesFilter;
  });

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Eliminar "${name}"? Esta acción no se puede deshacer.`)) return;
    setDeleting(id);
    try {
      const res = await fetch(`/api/clients?id=${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) onUpdate();
    } catch {
      alert("Error al eliminar");
    } finally {
      setDeleting(null);
    }
  };

  const handleCopyKey = async (apiKey: string) => {
    try {
      await navigator.clipboard.writeText(apiKey);
      setCopiedKey(apiKey);
      setTimeout(() => setCopiedKey(null), 2000);
    } catch {
      /* noop */
    }
  };

  const handleToggleActive = async (id: string, currentActive: boolean) => {
    setToggling(id);
    try {
      const res = await fetch(`/api/clients?id=${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !currentActive }),
      });
      const data = await res.json();
      if (data.success) onUpdate();
    } catch {
      alert("Error al cambiar estado");
    } finally {
      setToggling(null);
    }
  };

  const FILTERS: { key: Filter; label: string }[] = [
    { key: "all", label: "Todas" },
    { key: "active", label: "Activas" },
    { key: "near_limit", label: "Cerca del Límite" },
  ];

  return (
    <div className="bg-white rounded-xl border border-border shadow-card overflow-hidden">
      {/* Barra de búsqueda y filtros */}
      <div className="p-4 border-b border-border flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[200px]">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre, email o API key..."
            className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
          />
        </div>
        <div className="flex gap-1">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                filter === f.key
                  ? "bg-primary text-white"
                  : "bg-gray-100 text-text-muted hover:bg-gray-200"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tabla */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-left text-text-muted">
              <th className="px-4 py-3 font-medium">Empresa</th>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium text-center">Estado</th>
              <th className="px-4 py-3 font-medium text-center">Generaciones</th>
              <th className="px-4 py-3 font-medium text-center">Limite</th>
              <th className="px-4 py-3 font-medium min-w-[180px]">Disponibles</th>
              <th className="px-4 py-3 font-medium text-center">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-text-muted">
                  {clients.length === 0
                    ? "No hay empresas. Creá una arriba."
                    : "No se encontraron resultados."}
                </td>
              </tr>
            ) : (
              filtered.map((c) => {
                const remaining = Math.max(0, c.limit - c.usageCount);
                const percentage = c.limit > 0 ? (c.usageCount / c.limit) * 100 : 0;

                return (
                  <tr key={c.id} className="hover:bg-gray-50/50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-text">{c.name}</div>
                      <button
                        onClick={() => handleCopyKey(c.apiKey)}
                        className="text-xs text-text-light font-mono hover:text-primary transition-colors"
                        title="Click para copiar API key"
                      >
                        {copiedKey === c.apiKey ? "Copiada!" : c.apiKey}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-text-muted">
                      {c.email || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleToggleActive(c.id, c.active)}
                        disabled={toggling === c.id}
                        className="relative inline-flex items-center h-6 w-11 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50"
                        style={{
                          backgroundColor: c.active ? "#10b981" : "#d1d5db",
                        }}
                        title={c.active ? "Activa - Click para desactivar" : "Inactiva - Click para activar"}
                      >
                        <span
                          className="inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform"
                          style={{
                            transform: c.active ? "translateX(1.5rem)" : "translateX(0.25rem)",
                          }}
                        />
                      </button>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <span className="font-medium text-text">
                          {c.usageCount.toLocaleString()}
                        </span>
                        {c.usageCount > 0 && (
                          <span className="text-green-500 text-xs" title="Con actividad">
                            📈
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center text-text-muted">
                      {c.limit.toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${getProgressColor(percentage)}`}
                            style={{ width: `${Math.min(percentage, 100)}%` }}
                          />
                        </div>
                        <span className="text-xs text-text-muted w-12 text-right">
                          {remaining.toLocaleString()}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => handleDelete(c.id, c.name)}
                        disabled={deleting === c.id}
                        className="text-red-400 hover:text-red-600 transition-colors disabled:opacity-50 text-lg"
                        title="Eliminar empresa"
                      >
                        {deleting === c.id ? "..." : "×"}
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
