"use client";

/**
 * MetricCard — Tarjeta de métrica con gradiente de color y emoji.
 *
 * Colores: blue, green, purple, orange (según spec UI_UX_SPECIFICATION.md)
 */

const GRADIENTS: Record<string, string> = {
  blue: "from-blue-500 to-blue-600",
  green: "from-emerald-500 to-emerald-600",
  purple: "from-purple-500 to-purple-600",
  orange: "from-orange-400 to-orange-500",
};

interface MetricCardProps {
  title: string;
  value: string | number;
  icon: string;
  color: "blue" | "green" | "purple" | "orange";
}

export default function MetricCard({ title, value, icon, color }: MetricCardProps) {
  const gradient = GRADIENTS[color] || GRADIENTS.blue;

  return (
    <div
      className={`bg-gradient-to-br ${gradient} rounded-xl p-5 text-white shadow-card relative overflow-hidden`}
    >
      {/* Decoración de fondo */}
      <div className="absolute -top-4 -right-4 text-6xl opacity-20 select-none">
        {icon}
      </div>

      <p className="text-sm font-medium text-white/80">{title}</p>
      <p className="mt-1 text-3xl font-bold">{value}</p>
    </div>
  );
}
