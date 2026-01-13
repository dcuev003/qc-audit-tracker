import path from "node:path";
import { crx } from "@crxjs/vite-plugin";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import zip from "vite-plugin-zip-pack";
import tailwindcss from "@tailwindcss/vite";
import manifest from "./manifest.config.js";
import { name, version } from "./package.json";

export default defineConfig({
	resolve: {
		alias: {
			"@": `${path.resolve(__dirname, "./src")}`,
		},
	},
	build: {
		rollupOptions: {
			input: {
				popup: path.resolve(__dirname, "./src/ui/popup/index.html"),
				dashboard: path.resolve(__dirname, "./src/ui/dashboard/index.html"),
				privacy: path.resolve(__dirname, "./public/privacy.html"),
			},
		},
	},
	base: "./",
	plugins: [
		react(),
		crx({ manifest }),
		zip({ outDir: "release", outFileName: `${name}-${version}.zip` }),

		tailwindcss(),
	],
	server: {
		cors: {
			origin: [/chrome-extension:\/\//],
		},
	},
});
