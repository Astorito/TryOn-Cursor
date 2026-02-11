"use client";

import { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  PieChart,
  Pie,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from "recharts";

interface DayMetric {
  date: string;
  count: number;
  success: number;
  error: number;
  avgDuration: number;
}

interface ClientMetric {
  clientId: string;
  clientName: string;
  count: number;
  avgDuration: number;
}

interface TypeMetric {
  type: string;
  _count: { id: number };
}

const COLORS = ["#667eea", "#764ba2", "#f093fb", "#4facfe"];

export default function AnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState("7d");
  const [dailyData, setDailyData] = useState<DayMetric[]>([]);
  const [clientData, setClientData] = useState<ClientMetric[]>([]);
  const [typeData, setTypeData] = useState<any[]>([]);
  const [summary, setSummary] = useState({
    total: 0,
    successRate: 0,
    avgDuration: 0,
  });

  useEffect(() => {
    fetchAnalytics();
  }, [timeRange]);

  async function fetchAnalytics() {
    try {
      setLoading(true);

      // Calcular fecha de inicio según el rango
      const now = new Date();
      const from = new Date(now);
      if (timeRange === "7d") from.setDate(now.getDate() - 7);
      else if (timeRange === "30d") from.setDate(now.getDate() - 30);
      else if (timeRange === "90d") from.setDate(now.getDate() - 90);

      const fromISO = from.toISOString();
      const toISO = now.toISOString();

      // Fetch métricas por día
      const dailyRes = await fetch(
        `/api/metrics?groupBy=day&from=${fromISO}&to=${toISO}`
      );
      const dailyJson = await dailyRes.json();

      // Fetch métricas por cliente
      const clientRes = await fetch(
        `/api/metrics?groupBy=client&from=${fromISO}&to=${toISO}`
      );
      const clientJson = await clientRes.json();

      // Fetch resumen general
      const summaryRes = await fetch(`/api/metrics?from=${fromISO}&to=${toISO}`);
      const summaryJson = await summaryRes.json();

      if (dailyJson.success) {
        setDailyData(dailyJson.data);
      }

      if (clientJson.success) {
        setClientData(clientJson.data);
      }

      if (summaryJson.success) {
        const { summary: sum, metrics } = summaryJson.data;
        const successCount = metrics.filter(
          (m: any) => m.status === "success"
        ).length;
        setSummary({
          total: sum.total,
          successRate:
            sum.total > 0 ? Math.round((successCount / sum.total) * 100) : 0,
          avgDuration: Math.round(sum.avgDuration),
        });

        // Preparar datos por tipo
        const typeDataFormatted = sum.byType.map((t: TypeMetric) => ({
          name: t.type,
          value: t._count.id,
        }));
        setTypeData(typeDataFormatted);
      }
    } catch (error) {
      console.error("Error fetching analytics:", error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-text-muted">Cargando analíticas...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header con filtros */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-text">Analíticas</h1>
          <p className="text-text-muted mt-1">
            Métricas de uso y rendimiento del sistema
          </p>
        </div>
        <select
          value={timeRange}
          onChange={(e) => setTimeRange(e.target.value)}
          className="px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="7d">Últimos 7 días</option>
          <option value="30d">Últimos 30 días</option>
          <option value="90d">Últimos 90 días</option>
        </select>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-border p-6 shadow-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-text-muted">Total Generaciones</p>
              <p className="text-3xl font-bold text-text mt-1">
                {summary.total.toLocaleString()}
              </p>
            </div>
            <div className="text-4xl">📊</div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-border p-6 shadow-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-text-muted">Tasa de Éxito</p>
              <p className="text-3xl font-bold text-text mt-1">
                {summary.successRate}%
              </p>
            </div>
            <div className="text-4xl">✅</div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-border p-6 shadow-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-text-muted">Duración Promedio</p>
              <p className="text-3xl font-bold text-text mt-1">
                {(summary.avgDuration / 1000).toFixed(1)}s
              </p>
            </div>
            <div className="text-4xl">⚡</div>
          </div>
        </div>
      </div>

      {/* Gráfico de línea temporal */}
      <div className="bg-white rounded-xl border border-border p-6 shadow-card">
        <h2 className="text-lg font-semibold text-text mb-4">
          Generaciones por Día
        </h2>
        {dailyData.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={dailyData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 12 }}
                tickFormatter={(value) => {
                  const date = new Date(value);
                  return `${date.getDate()}/${date.getMonth() + 1}`;
                }}
              />
              <YAxis />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#fff",
                  border: "1px solid #e5e7eb",
                  borderRadius: "8px",
                }}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="count"
                stroke="#667eea"
                strokeWidth={2}
                name="Total"
              />
              <Line
                type="monotone"
                dataKey="success"
                stroke="#10b981"
                strokeWidth={2}
                name="Exitosas"
              />
              <Line
                type="monotone"
                dataKey="error"
                stroke="#ef4444"
                strokeWidth={2}
                name="Errores"
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="text-center text-text-muted py-12">
            No hay datos para el período seleccionado
          </div>
        )}
      </div>

      {/* Grid de 2 columnas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pie Chart - Métricas por tipo */}
        <div className="bg-white rounded-xl border border-border p-6 shadow-card">
          <h2 className="text-lg font-semibold text-text mb-4">
            Métricas por Tipo
          </h2>
          {typeData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={typeData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={(entry) => `${entry.name}: ${entry.value}`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {typeData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={COLORS[index % COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-center text-text-muted py-12">
              No hay datos disponibles
            </div>
          )}
        </div>

        {/* Bar Chart - Uso por cliente */}
        <div className="bg-white rounded-xl border border-border p-6 shadow-card">
          <h2 className="text-lg font-semibold text-text mb-4">
            Top Clientes por Uso
          </h2>
          {clientData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={clientData.slice(0, 10)}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="clientName"
                  tick={{ fontSize: 10 }}
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
                <YAxis />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#fff",
                    border: "1px solid #e5e7eb",
                    borderRadius: "8px",
                  }}
                />
                <Bar dataKey="count" fill="#667eea" name="Generaciones" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-center text-text-muted py-12">
              No hay datos de clientes
            </div>
          )}
        </div>
      </div>

      {/* Tabla de detalles por cliente */}
      <div className="bg-white rounded-xl border border-border shadow-card overflow-hidden">
        <div className="p-6 border-b border-border">
          <h2 className="text-lg font-semibold text-text">
            Detalle por Cliente
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">
                  Cliente
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">
                  Generaciones
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">
                  Duración Prom.
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-border">
              {clientData.map((client) => (
                <tr key={client.clientId} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-text">
                      {client.clientName}
                    </div>
                    <div className="text-sm text-text-muted">
                      {client.clientId}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-text">
                    {client.count.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-text">
                    {(client.avgDuration / 1000).toFixed(2)}s
                  </td>
                </tr>
              ))}
              {clientData.length === 0 && (
                <tr>
                  <td
                    colSpan={3}
                    className="px-6 py-12 text-center text-text-muted"
                  >
                    No hay datos para mostrar
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}