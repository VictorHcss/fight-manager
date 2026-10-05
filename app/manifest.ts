import type { MetadataRoute } from "next";

/** Instalar no celular ("Adicionar à tela de início"): abre como app, sem a barra do navegador. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Fight Manager",
    short_name: "Fight Manager",
    description: "Gestão de academias de luta: alunos, mensalidades, pagamentos e financeiro.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#17191f",
    theme_color: "#17191f",
    lang: "pt-BR",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Registrar pagamento", url: "/pagamentos/novo" },
      { name: "Minha área (aluno)", url: "/aluno" },
    ],
  };
}
