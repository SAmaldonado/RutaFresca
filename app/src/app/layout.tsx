import type { Metadata, Viewport } from "next";
import "./globals.css";
import { PwaRegistrar } from "@/components/PwaRegistrar";

export const metadata: Metadata = {
  title: "Ruta Fresca — Se cosecha lo que usted ya pidió",
  description:
    "Marketplace B2B de cosecha programada contra pedido, rutas compartidas y trazabilidad campesina (Cundinamarca y Boyacá -> Bogotá).",
  manifest: "/manifest.json",
  icons: { icon: "/icon.svg" },
};

export const viewport: Viewport = {
  themeColor: "#3A9D4A",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es-CO">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Poppins:wght@500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-rf-bg font-sans text-rf-graphite antialiased">
        <PwaRegistrar />
        {children}
      </body>
    </html>
  );
}
