import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@electric-sql/pglite", "pg", "sharp", "draco3dgltf", "meshoptimizer", "@gltf-transform/core", "@gltf-transform/functions", "@gltf-transform/extensions", "onnxruntime-web", "onnxruntime-common"],
  // garante que os arquivos binários (wasm) e os pratos de demonstração vão junto nas funções da Vercel
  outputFileTracingIncludes: {
    "/api/painel/items/**": ["./node_modules/draco3dgltf/**/*", "./node_modules/meshoptimizer/**/*", "./public/demo/**/*"],
    // IA de reconhecimento de pratos: o modelo (em partes) e só os arquivos do onnxruntime que ela usa
    "/api/scan/*/reconhecer": [
      "./modelos/clip/**/*",
      "./node_modules/onnxruntime-web/package.json",
      "./node_modules/onnxruntime-web/dist/package.json",
      "./node_modules/onnxruntime-web/dist/ort.node.min.mjs",
      "./node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.mjs",
      "./node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.wasm",
      "./node_modules/onnxruntime-common/package.json",
      "./node_modules/onnxruntime-common/dist/esm/**/*",
    ],
  },
  // o resto do onnxruntime (outras versões do WebAssembly, mapas, WebGL/WebGPU) não vai para a função
  outputFileTracingExcludes: {
    "/api/scan/*/reconhecer": [
      "./node_modules/onnxruntime-web/dist/*.jsep.*",
      "./node_modules/onnxruntime-web/dist/*.jspi.*",
      "./node_modules/onnxruntime-web/dist/*.asyncify.*",
      "./node_modules/onnxruntime-web/dist/*.map",
      "./node_modules/onnxruntime-web/dist/ort.all*",
      "./node_modules/onnxruntime-web/dist/ort.webgl*",
      "./node_modules/onnxruntime-web/dist/ort.webgpu*",
      "./node_modules/onnxruntime-web/lib/**/*",
    ],
  },
  async headers() {
    return [
      {
        // O iPhone só abre o AR Quick Look se o .usdz vier com este tipo
        source: "/:path*.usdz",
        headers: [
          { key: "Content-Type", value: "model/vnd.usdz+zip" },
          { key: "Cache-Control", value: "public, max-age=86400" },
        ],
      },
      {
        source: "/:path*.glb",
        headers: [
          { key: "Content-Type", value: "model/gltf-binary" },
          { key: "Cache-Control", value: "public, max-age=86400" },
          { key: "Access-Control-Allow-Origin", value: "*" },
        ],
      },
    ];
  },
};

export default nextConfig;
