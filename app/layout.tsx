import type { Metadata, Viewport } from "next";
import "@fontsource-variable/manrope"; // fontes auto-hospedadas: não dependem de internet no build
import "@fontsource/barlow-condensed/600.css"; // títulos e números (placar)
import "@fontsource/barlow-condensed/700.css";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Fight Manager", template: "%s | Fight Manager" },
  description: "Gestão administrativa para academias de luta: alunos, mensalidades, pagamentos e financeiro.",
  robots: { index: false, follow: false }, // sistema interno: não aparece em buscadores
  appleWebApp: { capable: true, title: "Fight Manager", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#17191f" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
