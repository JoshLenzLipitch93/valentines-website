import { defineConfig } from "vite";

// GitHub Pages project sites are served from "/<repo>/"
export default defineConfig({
  base: "/valentines-website/",
  // Ensure Vite treats QuickTime videos as importable static assets.
  assetsInclude: ["**/*.mov", "**/*.MOV"],
});

