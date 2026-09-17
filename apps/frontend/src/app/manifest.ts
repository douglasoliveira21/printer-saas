import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Printer SaaS",
    short_name: "Printer SaaS",
    description: "Gestão, monitoramento e operação para empresas de locação e manutenção de impressoras",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#3457d5",
    icons: [{ src: "/icon.jpg", sizes: "any", type: "image/jpeg" }],
  };
}
