// TanStack Start build preset — includes viteReact, tailwindcss, nitro, and path aliases.
// Do not duplicate those plugins here or the app will fail to build.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
});
