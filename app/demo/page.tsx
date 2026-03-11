"use client";

import { useEffect, useState } from "react";

const WIDGET_SRC = "https://try-on-cursor.vercel.app/api/widget";
const WIDGET_KEY = "tryon_mmm8m0on_i4v68sel";

export default function DemoPage() {
  const [widgetLoaded, setWidgetLoaded] = useState(false);

  useEffect(() => {
    const script = document.createElement("script");
    script.src = WIDGET_SRC;
    script.type = "text/javascript";
    script.async = true;
    script.dataset.tryonKey = WIDGET_KEY;
    script.onload = () => setWidgetLoaded(true);
    script.onerror = (e) => console.error("Error cargando widget TryOn", e);
    document.body.appendChild(script);

    return () => {
      if (document.body.contains(script)) {
        document.body.removeChild(script);
      }
    };
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center space-x-4">
              <div className="text-3xl">✨</div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">TryOn</h1>
                <p className="text-sm text-gray-500">Virtual Try-On Widget</p>
              </div>
            </div>
            <a
              href="/dashboard"
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
            >
              Dashboard Admin
            </a>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">
            Prueba el Widget de Virtual Try-On
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto mb-8">
            Subí tu foto y probate prendas virtualmente con IA. Experimentá
            cómo se verían las prendas en vos antes de comprar.
          </p>
          <div className="inline-flex items-center px-6 py-3 bg-green-100 text-green-800 rounded-full text-sm font-medium">
            <span
              className={`w-2 h-2 rounded-full mr-2 ${
                widgetLoaded ? "bg-green-400 animate-pulse" : "bg-yellow-400"
              }`}
            ></span>
            {widgetLoaded
              ? 'Widget activo — Hacé clic en "✨ Try Look" abajo a la derecha'
              : "Cargando widget..."}
          </div>
        </div>

        {/* Instructions */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 mb-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Cómo usar:
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-3">
                <span className="text-blue-600 font-bold">1</span>
              </div>
              <h4 className="font-medium text-gray-900 mb-2">
                Hacé clic en &quot;✨ Try Look&quot;
              </h4>
              <p className="text-sm text-gray-600">
                El botón flotante en la esquina inferior derecha
              </p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mx-auto mb-3">
                <span className="text-purple-600 font-bold">2</span>
              </div>
              <h4 className="font-medium text-gray-900 mb-2">
                Subí tus fotos
              </h4>
              <p className="text-sm text-gray-600">
                Una foto tuya y hasta 3 prendas que quieras probarte
              </p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mx-auto mb-3">
                <span className="text-green-600 font-bold">3</span>
              </div>
              <h4 className="font-medium text-gray-900 mb-2">
                ¡Mirá el resultado!
              </h4>
              <p className="text-sm text-gray-600">
                La IA genera tu imagen con las prendas aplicadas
              </p>
            </div>
          </div>
        </div>

        {/* Demo Area - Simulated Store */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Tienda Demo
          </h3>
          <p className="text-gray-600 mb-6">
            Esta página simula un e-commerce con el widget embebido. Buscá el
            botón flotante ✨ en la esquina inferior derecha.
          </p>

          {/* Mock store content */}
          <div className="bg-gray-50 rounded-lg p-6 mb-6">
            <div className="flex items-center justify-center space-x-4 mb-4">
              <div className="w-16 h-16 bg-gradient-to-br from-purple-200 to-blue-200 rounded-full flex items-center justify-center text-2xl">
                👗
              </div>
              <div className="text-left">
                <h4 className="font-medium text-gray-900">
                  Tienda de Ropa Demo
                </h4>
                <p className="text-sm text-gray-600">
                  Productos de moda &bull; Envío gratis
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white p-4 rounded-lg border hover:shadow-md transition-shadow cursor-pointer">
                <div className="w-full h-32 bg-gradient-to-br from-blue-100 to-blue-200 rounded mb-2 flex items-center justify-center text-4xl">
                  👕
                </div>
                <p className="text-sm font-medium">Camisa Azul</p>
                <p className="text-sm text-gray-600">$29.99</p>
              </div>
              <div className="bg-white p-4 rounded-lg border hover:shadow-md transition-shadow cursor-pointer">
                <div className="w-full h-32 bg-gradient-to-br from-gray-100 to-gray-200 rounded mb-2 flex items-center justify-center text-4xl">
                  👖
                </div>
                <p className="text-sm font-medium">Pantalón Negro</p>
                <p className="text-sm text-gray-600">$49.99</p>
              </div>
              <div className="bg-white p-4 rounded-lg border hover:shadow-md transition-shadow cursor-pointer">
                <div className="w-full h-32 bg-gradient-to-br from-red-100 to-red-200 rounded mb-2 flex items-center justify-center text-4xl">
                  👗
                </div>
                <p className="text-sm font-medium">Vestido Rojo</p>
                <p className="text-sm text-gray-600">$39.99</p>
              </div>
            </div>
          </div>

          <div className="text-sm text-gray-500">
            En un sitio real, el widget aparece automáticamente en cualquier
            página donde esté embebido el script.
          </div>
        </div>

        {/* Integration Code */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 mt-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Código de Integración
          </h3>
          <p className="text-sm text-gray-600 mb-4">
            Para embeber el widget en cualquier sitio, pegá este código antes
            del cierre de &lt;/body&gt;:
          </p>
          <pre className="bg-gray-900 text-green-400 p-4 rounded-lg text-sm overflow-x-auto">
{`<script
  src="${WIDGET_SRC}"
  data-tryon-key="TU_API_KEY_AQUI"
></script>`}
          </pre>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center text-gray-500 text-sm">
            <p>&copy; 2024 TryOn. Tecnología de IA para comercio electrónico.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}