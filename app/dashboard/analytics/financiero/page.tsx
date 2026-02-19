"use client";

import { useEffect, useState } from "react";
import {
  Users,
  Settings,
  DollarSign,
  Coins,
  TrendingUp,
  AlertCircle,
} from "lucide-react";

interface KPIs {
  usuariosActivos: { valor: number; cambio: number };
  llamadasAPI: { valor: number; capacidad: number; porcentaje: string };
  ingresosLicencia: { valor: number; descripcion: string };
  ventaCreditos: { valor: string; descripcion: string };
}

interface Cliente {
  id: string;
  nombre: string;
  plan: string;
  creditosTotales: number;
  creditosConsumidos: number;
  creditosRestantes: number;
  generaciones: number;
  ultimaCompra: string;
  activo: boolean;
  porcentajeCreditos: number;
  ingresosMensuales: number;
}

interface FinancialData {
  kpis: KPIs;
  clientes: Cliente[];
  distribucionPlanes: {
    enterprise: number;
    professional: number;
    starter: number;
    free: number;
  };
  resumenCuota: {
    porcentajeAPI: string;
    creditosVendidos: number;
    costoPorToken: number;
  };
  alertasRecarga: number;
}

export default function DashboardFinanciero() {
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState("7d");
  const [data, setData] = useState<FinancialData | null>(null);

  useEffect(() => {
    fetchData();
  }, [timeRange]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/dashboard/financial?timeRange=${timeRange}`
      );
      const result = await response.json();
      if (result.success) {
        setData(result.data);
      }
    } catch (error) {
      console.error("Error fetching financial data:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white p-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500">Cargando dashboard financiero...</div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-white p-8">
        <div className="text-red-500">Error al cargar datos financieros</div>
      </div>
    );
  }

  const getPlanColor = (plan: string) => {
    const colors: Record<string, string> = {
      enterprise: "text-blue-600 bg-blue-50",
      professional: "text-green-600 bg-green-50",
      starter: "text-gray-600 bg-gray-50",
      free: "text-gray-400 bg-gray-50",
    };
    return colors[plan.toLowerCase()] || "text-gray-600 bg-gray-50";
  };

  const getEstadoCreditos = (cliente: Cliente) => {
    if (cliente.creditosTotales === 0) return { text: "Sin créditos", color: "text-gray-500" };
    const porcentaje = (cliente.creditosRestantes / cliente.creditosTotales) * 100;
    if (porcentaje < 10) return { text: "Crítico", color: "text-red-600 font-semibold" };
    if (porcentaje < 30) return { text: "Bajo", color: "text-yellow-600" };
    return { text: "Normal", color: "text-green-600" };
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Dashboard Financiero
            </h1>
            <p className="text-gray-600 mt-1">
              Control de ingresos, consumo de API y gestión de saldos de clientes
            </p>
          </div>
          <div>
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="7d">Últimos 7 días</option>
              <option value="30d">Últimos 30 días</option>
              <option value="90d">Últimos 90 días</option>
            </select>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {/* Usuarios Activos */}
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-blue-50 rounded-lg">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
            <span className="text-green-600 text-sm font-medium flex items-center">
              <TrendingUp className="w-4 h-4 mr-1" />
              +{data.kpis.usuariosActivos.cambio}%
            </span>
          </div>
          <h3 className="text-gray-600 text-sm font-medium mb-1">
            Usuarios Activos
          </h3>
          <div className="text-3xl font-bold text-gray-900">
            {data.kpis.usuariosActivos.valor.toLocaleString()}
          </div>
          <p className="text-xs text-gray-500 mt-2">vs mes anterior</p>
        </div>

        {/* Llamadas API */}
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-purple-50 rounded-lg">
              <Settings className="w-6 h-6 text-purple-600" />
            </div>
          </div>
          <h3 className="text-gray-600 text-sm font-medium mb-1">
            Llamadas API
          </h3>
          <div className="text-3xl font-bold text-gray-900">
            {(data.kpis.llamadasAPI.valor / 1000).toFixed(1)}k
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Capacidad: {(data.kpis.llamadasAPI.capacidad / 1000).toFixed(0)}k
          </p>
        </div>

        {/* Ingresos Licencia */}
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-green-50 rounded-lg">
              <DollarSign className="w-6 h-6 text-green-600" />
            </div>
          </div>
          <h3 className="text-gray-600 text-sm font-medium mb-1">
            Ingresos Licencia
          </h3>
          <div className="text-3xl font-bold text-gray-900">
            ${data.kpis.ingresosLicencia.valor.toLocaleString()}
          </div>
          <p className="text-xs text-gray-500 mt-2">
            {data.kpis.ingresosLicencia.descripcion}
          </p>
        </div>

        {/* Venta de Créditos */}
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-orange-50 rounded-lg">
              <Coins className="w-6 h-6 text-orange-600" />
            </div>
          </div>
          <h3 className="text-gray-600 text-sm font-medium mb-1">
            Venta de Créditos
          </h3>
          <div className="text-3xl font-bold text-gray-900">
            ${data.kpis.ventaCreditos.valor}
          </div>
          <p className="text-xs text-gray-500 mt-2">
            {data.kpis.ventaCreditos.descripcion}
          </p>
        </div>
      </div>

      {/* Contenido Principal */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Panel Izquierdo - Uso por Empresa */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <h2 className="text-xl font-bold text-gray-900 mb-6">
            Uso por Empresa
          </h2>
          <p className="text-sm text-gray-600 mb-4">
            Ranking de clientes por volumen de generación y saldos
          </p>

          <div className="space-y-4">
            {data.clientes.slice(0, 10).map((cliente, index) => {
              const porcentajeUso =
                cliente.creditosTotales > 0
                  ? (cliente.creditosConsumidos / cliente.creditosTotales) * 100
                  : 0;
              const isBajo = cliente.creditosRestantes < cliente.creditosTotales * 0.2;

              return (
                <div key={cliente.id} className="border-b border-gray-100 pb-4 last:border-0">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-3">
                      <span className="text-lg font-bold text-gray-400 w-6">
                        {index + 1}
                      </span>
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-semibold text-gray-900">
                            {cliente.nombre}
                          </span>
                          {isBajo && (
                            <AlertCircle className="w-4 h-4 text-red-500" />
                          )}
                        </div>
                        <span
                          className={`text-xs px-2 py-1 rounded ${getPlanColor(
                            cliente.plan
                          )}`}
                        >
                          {cliente.plan}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-gray-900">
                        {cliente.generaciones.toLocaleString()}{" "}
                        <span className="text-xs text-gray-500">generaciones</span>
                      </div>
                      <div className="text-sm text-gray-600">
                        {cliente.creditosRestantes.toLocaleString()}{" "}
                        <span className="text-xs">créd. restantes</span>
                      </div>
                    </div>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${
                        isBajo ? "bg-red-500" : "bg-blue-500"
                      }`}
                      style={{ width: `${Math.min(porcentajeUso, 100)}%` }}
                    ></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Panel Derecho */}
        <div className="space-y-6">
          {/* Métricas de Suscripción */}
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <h2 className="text-xl font-bold text-gray-900 mb-6">
              Métricas de Suscripción
            </h2>
            <div className="flex items-center justify-center mb-6">
              <DonutChart distribucion={data.distribucionPlanes} />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                  <span className="text-gray-700">Enterprise</span>
                </div>
                <span className="font-semibold text-gray-900">
                  {data.distribucionPlanes.enterprise.toFixed(0)}%
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  <span className="text-gray-700">Professional</span>
                </div>
                <span className="font-semibold text-gray-900">
                  {data.distribucionPlanes.professional.toFixed(0)}%
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-gray-400 rounded-full"></div>
                  <span className="text-gray-700">Starter</span>
                </div>
                <span className="font-semibold text-gray-900">
                  {data.distribucionPlanes.starter.toFixed(0)}%
                </span>
              </div>
            </div>
          </div>

          {/* Resumen de Cuota */}
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <h2 className="text-xl font-bold text-gray-900 mb-6">
              Resumen de Cuota
            </h2>
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-gray-600 uppercase tracking-wider">
                  Capacidad de API
                </span>
                <span className="text-sm font-bold text-purple-600">
                  {data.resumenCuota.porcentajeAPI}%
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className="h-3 rounded-full bg-gradient-to-r from-purple-400 to-purple-600"
                  style={{
                    width: `${Math.min(parseFloat(data.resumenCuota.porcentajeAPI), 100)}%`,
                  }}
                ></div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 mt-6">
              <div>
                <div className="text-xs text-gray-600 uppercase tracking-wider mb-1">
                  Créditos Vendidos
                </div>
                <div className="text-2xl font-bold text-gray-900">
                  {(data.resumenCuota.creditosVendidos / 1000000).toFixed(1)}M
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-600 uppercase tracking-wider mb-1">
                  Costo por Token
                </div>
                <div className="text-2xl font-bold text-gray-900">
                  ${data.resumenCuota.costoPorToken}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabla de Detalle */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {data.alertasRecarga > 0 && (
          <div className="bg-yellow-50 border-b border-yellow-200 px-6 py-3 flex items-center space-x-2">
            <AlertCircle className="w-5 h-5 text-yellow-600" />
            <span className="text-sm font-medium text-yellow-800">
              ⚠️ ALERTA DE RECARGA: {data.alertasRecarga} cliente(s) con créditos
              críticos
            </span>
          </div>
        )}

        <div className="p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            Detalle de Consumo de Créditos
          </h2>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Cliente
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Plan
                  </th>
                  <th className="text-right py-3 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Créditos Totales
                  </th>
                  <th className="text-right py-3 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Créditos Consumidos
                  </th>
                  <th className="text-center py-3 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Última Compra
                  </th>
                  <th className="text-center py-3 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Estado de Créditos
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.clientes.map((cliente) => {
                  const estado = getEstadoCreditos(cliente);
                  return (
                    <tr
                      key={cliente.id}
                      className="border-b border-gray-100 hover:bg-gray-50"
                    >
                      <td className="py-4 px-4">
                        <div className="font-medium text-gray-900">
                          {cliente.nombre}
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <span
                          className={`text-xs px-2 py-1 rounded ${getPlanColor(
                            cliente.plan
                          )}`}
                        >
                          {cliente.plan}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-right font-medium text-gray-900">
                        {cliente.creditosTotales.toLocaleString()}
                      </td>
                      <td className="py-4 px-4 text-right">
                        <div className="font-medium text-gray-900">
                          {cliente.creditosConsumidos.toLocaleString()}
                        </div>
                        <div className="text-xs text-gray-500">
                          ({cliente.porcentajeCreditos.toFixed(1)}%)
                        </div>
                      </td>
                      <td className="py-4 px-4 text-center text-sm text-gray-600">
                        {cliente.ultimaCompra}
                      </td>
                      <td className="py-4 px-4 text-center">
                        <span className={`font-medium ${estado.color}`}>
                          {estado.text}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

// Componente del gráfico Donut
function DonutChart({
  distribucion,
}: {
  distribucion: { enterprise: number; professional: number; starter: number; free: number };
}) {
  const total = 100;
  const enterprise = distribucion.enterprise;
  const professional = distribucion.professional;
  const starter = distribucion.starter;

  // Calcular los ángulos para el gráfico donut
  const enterpriseAngle = (enterprise / 100) * 360;
  const professionalAngle = (professional / 100) * 360;
  const starterAngle = (starter / 100) * 360;

  return (
    <div className="relative w-40 h-40">
      <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
        {/* Círculo de fondo */}
        <circle
          cx="50"
          cy="50"
          r="40"
          fill="none"
          stroke="#e5e7eb"
          strokeWidth="20"
        />

        {/* Enterprise - Azul */}
        <circle
          cx="50"
          cy="50"
          r="40"
          fill="none"
          stroke="#3b82f6"
          strokeWidth="20"
          strokeDasharray={`${(enterpriseAngle / 360) * 251.2} 251.2`}
          strokeDashoffset="0"
        />

        {/* Professional - Verde */}
        <circle
          cx="50"
          cy="50"
          r="40"
          fill="none"
          stroke="#10b981"
          strokeWidth="20"
          strokeDasharray={`${(professionalAngle / 360) * 251.2} 251.2`}
          strokeDashoffset={`-${(enterpriseAngle / 360) * 251.2}`}
        />

        {/* Starter - Gris */}
        <circle
          cx="50"
          cy="50"
          r="40"
          fill="none"
          stroke="#9ca3af"
          strokeWidth="20"
          strokeDasharray={`${(starterAngle / 360) * 251.2} 251.2`}
          strokeDashoffset={`-${((enterpriseAngle + professionalAngle) / 360) * 251.2}`}
        />
      </svg>

      {/* Porcentaje central */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-center">
          <div className="text-3xl font-bold text-blue-600">
            {enterprise.toFixed(0)}%
          </div>
          <div className="text-xs text-gray-600 uppercase tracking-wider">
            Enterprise
          </div>
        </div>
      </div>
    </div>
  );
}
