import type { Metadata } from "next";
import "@fontsource-variable/inter";
import "@fontsource/noto-serif/latin-400.css";
import "@fontsource/noto-serif/latin-700.css";
import "@fontsource/noto-sans/latin-400.css";
import "@fontsource/noto-sans/latin-700.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "CV ATS Studio",
  description: "Crea y adapta tu currículum profesional.",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
