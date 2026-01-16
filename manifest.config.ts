import { defineManifest } from "@crxjs/vite-plugin";
import pkg from "./package.json";

export default defineManifest({
	manifest_version: 3,
	name: "QC Audit Tracker",
	description:
		"QC Audit Tracker - Chrome extension for tracking your work during QC auditing on Outlier AI platform.",
	version: pkg.version,
  permissions: ["storage", "alarms", "tabs"],
  host_permissions: [
    "https://app.outlier.ai/*",
    "https://script.google.com/*",
    "https://script.googleusercontent.com/*"
  ],
	icons: {
		"16": "public/icon16.png",
		"48": "public/icon48.png",
		"128": "public/icon128.png",
	},
	action: {
		default_icon: {
			"16": "public/icon16.png",
			"48": "public/icon48.png",
			"128": "public/icon128.png",
		},
		default_popup: "src/ui/popup/index.html",
	},
	background: {
		service_worker: "src/background/index.ts",
	},
	content_scripts: [
		{
			js: ["src/content/index.ts"],
			matches: ["https://app.outlier.ai/*"],
			run_at: "document_start",
		},
	],
	web_accessible_resources: [
		{
			resources: ["assets/interceptor.js"],
			matches: ["https://app.outlier.ai/*"],
		},
	],
});
