import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TryOn - Virtual Try-On con IA",
  description:
    "Sistema de virtual try-on basado en inteligencia artificial para e-commerce",
  keywords: ["virtual try-on", "IA", "e-commerce", "probador virtual"],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className="min-h-screen bg-surface-alt">{children}</body>
    </html>
  );
}
