import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ParkFlow Mobile",
    short_name: "ParkFlow",
    description: "Gestão de estacionamento mobile-first com OCR, ticket e dashboard.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#101722",
    theme_color: "#121a26",
    orientation: "portrait",
    icons: [
      {
        src: "/icon",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/apple-icon",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  };
}
