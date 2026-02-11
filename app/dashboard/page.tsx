"use client";

import { useEffect, useState, useCallback } from "react";
import MetricCard from "@/components/dashboard/MetricCard";
import CompanyForm from "@/components/dashboard/CompanyForm";
import CompanyTable from "@/components/dashboard/CompanyTable";

/**
 * Dashboard principal — /dashboard
 *
 * Diseño según UI_UX_SPECIFICATION.md:
 * - 4 MetricCards: Total Empresas, Generaciones Totales, Promedio por Empresa, Cerca del Límite
 * - CompanyForm: Crear empresa + generar token
 * - CompanyTable: Tabla con búsqueda, filtros, barras de progreso
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

export default function DashboardPage() {
  const [clients, setClients] = useState<ClientData[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchClients = useCallback(async () => {
    try {
      const res = await fetch("/api/clients");
      const data = await res.json();
      if (data.success) {
        setClients(data.clients);
      }
    } catch (error) {
      console.error("Error cargando clientes:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  // Métricas calculadas
  const totalEmpresas = clients.length;
  const totalGeneraciones = clients.reduce((sum, c) => sum + c.usageCount, 0);
  const promedioPorEmpresa =
    totalEmpresas > 0 ? Math.round(totalGeneraciones / totalEmpresas) : 0;
  const cercaDelLimite = clients.filter((c) => {
    const remaining = c.limit - c.usageCount;
    return remaining < c.limit * 0.1 && c.usageCount > 0;
  }).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-text-muted">Cargando...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header con botón Ver Demo */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">Administrá tus empresas y generaciones</p>
        </div>
        <a
          href="/demo"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:opacity-90 transition-opacity font-medium text-sm shadow-md"
        >
          ✨ Ver Demo
        </a>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total Empresas"
          value={totalEmpresas}
          icon="🏢"
          color="blue"
        />
        <MetricCard
          title="Generaciones Totales"
          value={totalGeneraciones.toLocaleString()}
          icon="📈"
          color="green"
        />
        <MetricCard
          title="Promedio por Empresa"
          value={promedioPorEmpresa.toLocaleString()}
          icon="⚡"
          color="purple"
        />
        <MetricCard
          title="Cerca del Límite"
          value={cercaDelLimite}
          icon="⏰"
          color="orange"
        />
      </div>

      {/* Formulario de crear empresa */}
      <CompanyForm onSuccess={fetchClients} />

      {/* Tabla de empresas */}
      <CompanyTable clients={clients} onUpdate={fetchClients} />

      {/* Snippet de integración */}
      <div className="bg-white rounded-xl border border-border p-6 shadow-card">
        <h2 className="font-semibold text-text">Código de Integración</h2>
        <p className="text-sm text-text-muted mt-1">
          Copiá este snippet y reemplazá la API key por la del cliente. Ellos no
          necesitan crear cuenta; vos les pasás el código directo.
        </p>
        <pre className="mt-4 p-4 bg-gray-900 text-green-400 rounded-lg text-sm overflow-x-auto">
{`<script
  src="${typeof window !== "undefined" ? window.location.origin : ""}/api/widget"
  data-tryon-key="API_KEY_DEL_CLIENTE"
></script>`}
        </pre>
      </div>
    </div>
  );
}
