import { defineConfig } from "tsup";

export default defineConfig([
  // Main entry + client subpath
  {
    entry: {
      index: "src/index.ts",
      "client/index": "src/client/index.ts",
      "bin/ogpipe": "src/bin/ogpipe.ts",
    },
    format: ["esm", "cjs"],
    dts: true,
    sourcemap: true,
    clean: true,
    target: "node20",
    splitting: false,
  },
]);
