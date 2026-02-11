"use client";

import { useState } from "react";

/**
 * CompanyForm — Formulario para crear empresa.
 *
 * Campos: Alias + Email + Website (opcional)
 * Al crear: genera API key automática, muestra el código embed personalizado.
 */

interface CompanyFormProps {
  onSuccess: () => void;
}

export default function CompanyForm({ onSuccess }: CompanyFormProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    apiKey: string;
    name: string;
    id: string;
  } | null>(null);
  const [error, setError] = useState("");
  const [showCode, setShowCode] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    setError("");
    setResult(null);

    const payload = {
      name: name.trim(),
      email: email.trim() || null,
      website: website.trim() || null,
    };

    try {
      const res = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!data.success) {
        setError(data.error || "Error al crear cliente");
        return;
      }

      // Copiar API key al clipboard
      try {
        await navigator.clipboard.writeText(data.client.apiKey);
      } catch {
        // Clipboard puede fallar en algunos contextos
      }

      setResult({
        apiKey: data.client.apiKey,
        name: data.client.name,
        id: data.client.id,
      });
      setShowCode(true);
      setName("");
      setEmail("");
      setWebsite("");
      onSuccess();
    } catch {
      setError("Error de conexión");
    } finally {
      setLoading(false);
    }
  };

  const embedCode = result
    ? `<script
  src="${typeof window !== "undefined" ? window.location.origin : "http://localhost:3000"}/api/widget"
  data-tryon-key="${result.apiKey}"
></script>`
    : "";

  const copyEmbedCode = async () => {
    try {
      await navigator.clipboard.writeText(embedCode);
      alert("Código copiado al portapapeles");
    } catch {
      alert("Error al copiar");
    }
  };

  return (
    <div className="bg-white rounded-xl border border-border p-6 shadow-card">
      <h2 className="font-semibold text-text text-lg mb-4">
        Crear Nueva Empresa
      </h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-text-muted mb-1">
              Nombre empresa <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Mi Tienda"
              className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-muted mb-1">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="contacto@empresa.com"
              className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-muted mb-1">
              Website
            </label>
            <input
              type="url"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://mitienda.com"
              className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading || !name.trim()}
          className="w-full gradient-primary text-white font-medium text-sm px-5 py-3 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "Creando..." : "✨ Crear Empresa y Generar Token"}
        </button>
      </form>

      {/* Error */}
      {error && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          ⚠️ {error}
        </div>
      )}

      {/* Resultado: API key generada + código embed */}
      {result && (
        <div className="mt-6 space-y-4">
          {/* Success banner */}
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-green-800 font-medium flex items-center gap-2">
              <span className="text-xl">✅</span>
              Cliente &quot;{result.name}&quot; creado exitosamente
            </p>
          </div>

          {/* API Key */}
          <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
            <label className="block text-sm font-medium text-text mb-2">
              API Key
            </label>
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-gray-900 text-green-400 px-3 py-2 rounded text-xs font-mono break-all">
                {result.apiKey}
              </code>
              <button
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(result.apiKey);
                  } catch {
                    /* noop */
                  }
                }}
                className="shrink-0 px-3 py-2 bg-white border border-border rounded-lg text-sm hover:bg-gray-100 transition-colors"
                title="Copiar API Key"
              >
                📋
              </button>
            </div>
          </div>

          {/* Código Embed */}
          <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-text">
                Código de Integración
              </label>
              <button
                onClick={() => setShowCode(!showCode)}
                className="text-xs text-purple-600 hover:underline"
              >
                {showCode ? "Ocultar" : "Mostrar"} código
              </button>
            </div>

            <p className="text-xs text-text-muted mb-3">
              Pegá este código en tu página web, justo antes del cierre de{" "}
              <code className="bg-white px-1 py-0.5 rounded">&lt;/body&gt;</code>
            </p>

            {showCode && (
              <>
                <pre className="bg-gray-900 text-green-400 p-4 rounded-lg text-xs overflow-x-auto mb-3 font-mono">
                  {embedCode}
                </pre>

                <div className="flex gap-2">
                  <button
                    onClick={copyEmbedCode}
                    className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700 transition-colors font-medium"
                  >
                    📋 Copiar Código Completo
                  </button>
                  <a
                    href={`/demo`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 px-4 py-2 bg-white border border-purple-300 text-purple-600 rounded-lg text-sm hover:bg-purple-50 transition-colors font-medium text-center"
                  >
                    👀 Ver Demo
                  </a>
                </div>
              </>
            )}
          </div>

          {/* Instrucciones adicionales */}
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h3 className="text-sm font-medium text-blue-900 mb-2">
              📚 Próximos pasos:
            </h3>
            <ol className="text-xs text-blue-800 space-y-1 list-decimal list-inside">
              <li>Copiá el código de integración de arriba</li>
              <li>Pegalo en tu HTML antes del cierre de &lt;/body&gt;</li>
              <li>
                El botón flotante &quot;✨ Try Look&quot; aparecerá
                automáticamente
              </li>
              <li>Los clientes podrán probarse prendas directamente en tu sitio</li>
            </ol>
          </div>

          <button
            onClick={() => setResult(null)}
            className="w-full px-4 py-2 text-sm text-text-muted hover:text-text hover:bg-gray-50 border border-border rounded-lg transition-colors"
          >
            Crear otra empresa
          </button>
        </div>
      )}
    </div>
  );
}