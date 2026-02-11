import Link from "next/link";

/**
 * Login page — /login
 *
 * Sin autenticación requerida. El admin maneja el acceso
 * y les pasa el código de integración a los clientes.
 */
export default function LoginPage() {
  return (
    <main className="min-h-screen flex items-center justify-center p-8 bg-gradient-to-br from-slate-900 to-slate-800">
      <div className="bg-white rounded-xl shadow-modal p-8 max-w-md w-full text-center space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-text">TryOn</h1>
          <p className="text-text-muted text-sm mt-1">Panel de Administración</p>
        </div>

        <p className="text-sm text-text-muted">
          El acceso al dashboard es directo. Vos manejás quién recibe el código
          de integración del widget.
        </p>

        <Link
          href="/dashboard"
          className="block w-full gradient-primary text-white font-medium py-3 px-6 rounded-xl hover:opacity-90 transition-opacity"
        >
          Entrar al Dashboard
        </Link>

        <Link
          href="/"
          className="block text-sm text-text-muted hover:text-text transition-colors"
        >
          ← Volver al inicio
        </Link>
      </div>
    </main>
  );
}
