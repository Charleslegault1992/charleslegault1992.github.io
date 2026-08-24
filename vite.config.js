import { readFileSync } from "node:fs";

import { defineConfig } from "vite";

const packageData = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8"));

export default defineConfig(() => {
  const appVersion = packageData.version;
  const buildId =
    process.env.GITHUB_SHA?.trim() ||
    process.env.APP_BUILD_ID?.trim() ||
    `${appVersion}-${Date.now().toString(36)}`;
  const versionPayload = JSON.stringify({ appVersion, buildId });

  return {
    define: {
      __APP_BUILD_ID__: JSON.stringify(buildId),
      __APP_VERSION__: JSON.stringify(appVersion),
    },
    plugins: [
      {
        name: "nonameyet-build-version",
        transformIndexHtml: (html) => html.replaceAll("__APP_VERSION__", appVersion),
        generateBundle() {
          this.emitFile({
            type: "asset",
            fileName: "version.json",
            source: versionPayload,
          });
        },
        configureServer(server) {
          server.middlewares.use((request, response, next) => {
            if (request.url?.split("?", 1)[0] !== "/version.json") {
              next();
              return;
            }
            response.writeHead(200, {
              "cache-control": "no-store, no-cache, must-revalidate",
              "content-type": "application/json; charset=utf-8",
            });
            response.end(versionPayload);
          });
        },
      },
    ],
  };
});
