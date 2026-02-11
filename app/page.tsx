import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center p-8">
      <div className="max-w-md w-full text-center space-y-8">
        {/* Logo / Title */}
        <div className="space-y-2">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-primary-dark bg-clip-text text-transparent">
            TryOn
          </h1>
          <p className="text-text-muted text-lg">
            Virtual Try-On con Inteligencia Artificial
          </p>
        </div>

        {/* Status card */}
        <div className="bg-white rounded-2xl shadow-card p-6 space-y-4">
          <div className="flex items-center justify-center gap-2 text-sm text-green-600 font-medium">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            Sistema activo
          </div>
          <p className="text-text-muted text-sm">
            Plataforma de prueba virtual de prendas para e-commerce. Integrá
            nuestro widget con una sola línea de código.
          </p>
        </div>

        {/* Navigation */}
        <div className="space-y-3">
          <Link
            href="/login"
            className="block w-full gradient-primary text-white font-medium py-3 px-6 rounded-xl hover:opacity-90 transition-opacity"
          >
            Acceder al Dashboard
          </Link>
          <Link
            href="/api/health"
            className="block w-full bg-white text-text-muted font-medium py-3 px-6 rounded-xl border border-border hover:bg-gray-50 transition-colors"
          >
            Health Check
          </Link>
        </div>

        {/* Footer */}
        <p className="text-xs text-text-light">
          Mosaico Analítica &middot; TryOn v1.0
        </p>
      </div>
    </main>
  );
}
