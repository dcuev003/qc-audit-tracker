import {
	MessageType,
	BaseMessage,
	ApiDataPayload,
} from "../shared/types/messages";
import { createLogger } from "../shared/logger";
import { injectScript, injectConfig } from "./injector";
import { MessageBridge } from "./bridge";
import { AUDIT_PATH_PATTERN, INTERCEPTOR_SOURCE } from "../shared/constants";

const logger = createLogger("Content");

class ContentScript {
	private bridge: MessageBridge;
	private trackingEnabled: boolean = true;
	private currentTaskData: Partial<{
		projectId: string;
		projectName: string;
		attemptId: string;
		reviewLevel: number;
		maxTime: number;
		operationId: string;
	}> = {};
	private lookupMap: Record<string, { qaId: string; batchId: string }> = {};
	private hasInjectedInterceptor: boolean = false;

	constructor() {
		this.bridge = new MessageBridge();
		this.initialize();
	}

	private async initialize(): Promise<void> {
		logger.info("Initializing content script");

		// Load settings first
		await this.loadSettings();

		if (!this.trackingEnabled) {
			logger.info("Tracking disabled, skipping");
			return;
		}

		// Always set up message listeners and inject interceptor to catch completion calls
		this.setupListeners();
		await this.injectInterceptor();

		// Apply UI fixes for chat_bulk_audit page (hide modal, restore scroll)
		this.applyChatBulkAuditUiFixes();

		// Setup debug helpers for console access
		this.setupDebugHelpers();

		// Check if we're on an audit page for tracking
		if (!this.isAuditPage()) {
			logger.info(
				"Not on audit page, but interceptor active for completion detection"
			);
			return;
		}

		// Start tracking only on audit pages
		this.startTracking();

		// Monitor for DOM changes (for SPA navigation)
		this.setupNavigationMonitor();
	}

	private isAuditPage(): boolean {
		const url = window.location.href;
		// Must contain the audit pattern but NOT be a results page
		return url.includes(AUDIT_PATH_PATTERN) && !url.includes("/results");
	}

	private async loadSettings(): Promise<void> {
		try {
			const response = await chrome.runtime.sendMessage({
				type: MessageType.GET_STATE,
				payload: {},
				timestamp: Date.now(),
				source: "content" as const,
			});

			this.trackingEnabled = response?.trackingEnabled ?? true;
			logger.info("Settings loaded", { trackingEnabled: this.trackingEnabled });
		} catch (error) {
			logger.error("Failed to load settings", error);
		}
	}

	private async injectInterceptor(): Promise<void> {
		if (this.hasInjectedInterceptor) {
			logger.info("Interceptor already injected, skipping");
			return;
		}

		try {
			// Inject config
			const config = {
				debug: await this.isDebugMode(),
			};
			injectConfig(config);

			// Inject interceptor script
			await injectScript("interceptor.js");
			this.hasInjectedInterceptor = true;
			logger.info("Interceptor injected successfully");
		} catch (error) {
			logger.error("Failed to inject interceptor", error);
		}
	}

	private async isDebugMode(): Promise<boolean> {
		try {
			const response = await chrome.runtime.sendMessage({
				type: MessageType.GET_STATE,
				payload: {},
				timestamp: Date.now(),
				source: "content" as const,
			});
			return response?.qcDevLogging || false;
		} catch {
			return false;
		}
	}

	private setupListeners(): void {
		// Listen for messages from interceptor
		window.addEventListener("message", (event) => {
			// Log all window messages to debug interceptor communication
			if (event.source === window && event.data.source) {
				logger.message("Window message received", {
					source: event.data.source,
					type: event.data.type,
					isFromInterceptor: event.data.source === INTERCEPTOR_SOURCE,
					expectedSource: INTERCEPTOR_SOURCE,
				});
			}

			if (event.source !== window || event.data.source !== INTERCEPTOR_SOURCE) {
				return;
			}

			this.handleInterceptorMessage(event.data);
		});

		// Listen for messages from background
		chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
			this.handleBackgroundMessage(message, sendResponse);
			return true; // Keep channel open for async response
		});

		logger.info("Message listeners set up");
	}

	private handleInterceptorMessage(message: any): void {
		logger.message("Interceptor message received", {
			type: message.type,
			endpoint: message.payload?.endpoint,
			hasExtractedInfo: !!message.payload?.extractedInfo,
		});

		switch (message.type) {
			case "API_DATA_CAPTURED":
				this.handleApiData(message.payload);
				break;

			case "TASK_COMPLETED":
				this.handleTaskCompleted();
				break;

			case "TASK_TRANSITIONED":
				this.handleTaskTransitioned();
				break;

			case "TASK_CANCELED":
				this.handleTaskCanceled();
				break;

			case "USER_EMAIL_EXTRACTED":
				this.handleUserEmailExtracted(message.payload);
				break;

			case "ASSIGNED_NODES_MAP":
				this.handleAssignedNodesMap(message.payload?.map || {});
				break;

			default:
				logger.warn("Unknown interceptor message type", { type: message.type });
		}
	}

	private handleAssignedNodesMap(
		map: Record<string, { qaId: string; batchId: string }>
	): void {
		logger.info("Assigned nodes map received", {
			keys: Object.keys(map).length,
		});
		this.lookupMap = map || {};
		try {
			this.bridge.updateLookupMap(this.lookupMap);
			this.bridge.injectLookupIcons();
		} catch (e) {
			logger.warn("Failed to inject lookup icons from content", {
				error: (e as Error).message,
			});
		}
	}

	private handleApiData(payload: ApiDataPayload): void {
		logger.api("API data captured", {
			endpoint: payload.endpoint,
			extractedInfo: payload.extractedInfo,
			hasData: !!payload.data,
		});

		// Enhanced logging for project name debugging
		if (payload.extractedInfo?.projectName) {
			logger.info("Project name extracted!", {
				endpoint: payload.endpoint,
				projectName: payload.extractedInfo.projectName,
				allExtractedInfo: payload.extractedInfo,
			});
		}

		// Merge extracted data
		if (payload.extractedInfo) {
			Object.assign(this.currentTaskData, payload.extractedInfo);

			logger.info("Task data updated", {
				endpoint: payload.endpoint,
				updates: payload.extractedInfo,
				currentData: this.currentTaskData,
			});

			// Send update to background
			chrome.runtime
				.sendMessage({
					type: MessageType.UPDATE_TASK_DATA,
					payload: this.currentTaskData,
					timestamp: Date.now(),
					source: "content" as const,
				})
				.then((response) => {
					logger.info("Task data update sent successfully", { response });
				})
				.catch((error) => {
					logger.error("Failed to send task data update", {
						error: error.message,
						data: this.currentTaskData,
					});
				});
		} else {
			logger.warn("API data captured but no extractedInfo found", {
				endpoint: payload.endpoint,
			});
		}
	}

	private startTracking(): void {
		// Extract qaOperationId - prioritize query parameter over URL path
		const url = new URL(window.location.href);
		// Only start timer on official audits (closeOnComplete=1 present)
		const isOfficialAudit = url.searchParams.get("closeOnComplete") === "1";
		if (!isOfficialAudit) {
			logger.info("Not starting timer (lookup/no closeOnComplete=1)");
			return;
		}
		let qaOperationId = null;

		// First try query parameter (this is the actual operation ID)
		qaOperationId = url.searchParams.get("qaOperationId");

		// Only fallback to path if query param is missing
		if (!qaOperationId) {
			const pathParts = url.pathname
				.split("/")
				.filter((part) => part.length > 0);
			const auditIndex = pathParts.indexOf("chat_bulk_audit");

			if (auditIndex !== -1 && auditIndex < pathParts.length - 1) {
				const nextPart = pathParts[auditIndex + 1];
				// Ensure it's not 'results' or other non-ID parts and matches MongoDB ObjectId format
				if (
					nextPart &&
					nextPart !== "results" &&
					nextPart.match(/^[a-f0-9]{24}$/)
				) {
					qaOperationId = nextPart;
				}
			}
		}

		if (!qaOperationId) {
			logger.warn("No valid qaOperationId found in URL", { url: url.href });
			return;
		}

		logger.info("Starting tracking", { qaOperationId });

		chrome.runtime
			.sendMessage({
				type: MessageType.START_TRACKING,
				payload: {
					qaOperationId,
					url: window.location.href,
					startTime: Date.now(),
				},
				timestamp: Date.now(),
				source: "content" as const,
			})
			.then((response) => {
				if (response?.resumed) {
					logger.info("Resumed existing task tracking", {
						qaOperationId,
						response,
					});
				} else {
					logger.info("Started new task tracking", { qaOperationId, response });
				}
			})
			.catch((error) => {
				logger.error("Failed to start tracking", {
					error: error.message,
					qaOperationId,
					url: window.location.href,
				});
			});
	}

	private handleTaskCompleted(): void {
		logger.info("Task completed (pre-final stage)", {
			currentTaskData: this.currentTaskData,
			message:
				"Saving completion time but timer continues - waiting for transition or new task",
		});

		// Send completion time to background but keep timer running
		chrome.runtime
			.sendMessage({
				type: MessageType.UPDATE_TASK_DATA,
				payload: {
					completionTime: Date.now(),
					status: "pending-transition",
				},
				timestamp: Date.now(),
				source: "content" as const,
			})
			.then((response) => {
				logger.info("Completion time saved", { response });
			})
			.catch((error) => {
				logger.error("Failed to save completion time", error);
			});
	}

	private handleTaskTransitioned(): void {
		logger.info("Task transitioned (final submission)", {
			currentTaskData: this.currentTaskData,
		});

		// Update transition time and stop tracking
		chrome.runtime
			.sendMessage({
				type: MessageType.UPDATE_TASK_DATA,
				payload: {
					transitionTime: Date.now(),
					status: "completed",
				},
				timestamp: Date.now(),
				source: "content" as const,
			})
			.then(() => {
				// Now stop tracking
				return chrome.runtime.sendMessage({
					type: MessageType.STOP_TRACKING,
					payload: { reason: "completed" as const },
					timestamp: Date.now(),
					source: "content" as const,
				});
			})
			.then((response) => {
				logger.info("Tracking stopped successfully after transition", {
					response,
				});
			})
			.catch((error) => {
				logger.error("Failed to handle transition", {
					error: error.message,
					currentTaskData: this.currentTaskData,
				});
			});
	}

	private handleTaskCanceled(): void {
		logger.info("Task canceled", {
			currentTaskData: this.currentTaskData,
		});

		// Show on-page notice to the user
		try {
			this.bridge.showCanceledModal();
		} catch (e) {
			logger.warn("Failed to show canceled modal from content", {
				error: (e as Error).message,
			});
		}

		chrome.runtime
			.sendMessage({
				type: MessageType.STOP_TRACKING,
				payload: { reason: "canceled" as const },
				timestamp: Date.now(),
				source: "content" as const,
			})
			.then((response) => {
				logger.info("Tracking stopped successfully (canceled)", { response });
			})
			.catch((error) => {
				logger.error("Failed to stop tracking (canceled)", {
					error: error.message,
					currentTaskData: this.currentTaskData,
				});
			});
	}

	private handleUserEmailExtracted(payload: { email: string }): void {
		logger.info("User email extracted", { email: payload.email });

		// Send email to background to update settings
		chrome.runtime
			.sendMessage({
				type: MessageType.UPDATE_SETTINGS,
				payload: { email: payload.email },
				timestamp: Date.now(),
				source: "content" as const,
			})
			.then((response) => {
				logger.info("Email sent to background successfully", { response });
			})
			.catch((error) => {
				logger.error("Failed to send email to background", {
					error: error.message,
					email: payload.email,
				});
			});
	}

	private handleBackgroundMessage(
		message: BaseMessage,
		sendResponse: Function
	): void {
		logger.message("Background message received", { type: message.type });

		switch (message.type) {
			case MessageType.TIMER_UPDATE:
				this.updateTimerDisplay(message.payload);
				sendResponse({ success: true });
				break;

			case MessageType.TRACKING_STATE_CHANGED:
				this.trackingEnabled = message.payload.enabled;
				logger.info("Tracking state changed", {
					enabled: this.trackingEnabled,
				});
				sendResponse({ success: true });
				break;

			default:
				sendResponse({ success: false, error: "Unknown message type" });
		}
	}

	private updateTimerDisplay(timerData: any): void {
		this.bridge.updateTimerUI(timerData);
	}

	private setupNavigationMonitor(): void {
		// Monitor for URL changes (SPA navigation)
		let lastUrl = window.location.href;

		const checkUrlChange = () => {
			const currentUrl = window.location.href;
			if (currentUrl !== lastUrl) {
				lastUrl = currentUrl;
				logger.info("URL changed", { newUrl: currentUrl });

				// Check if we've navigated to a results page
				if (currentUrl.includes("/results")) {
					logger.info("Navigated to results page, not starting new tracking");
					return;
				}

				if (this.isAuditPage()) {
					// Re-inject interceptor if needed
					this.hasInjectedInterceptor = false;
					this.initialize();
				}

				// Ensure UI fixes are applied on navigation, regardless of audit start state
				this.applyChatBulkAuditUiFixes();
			}
		};

		// Check periodically for URL changes
		setInterval(checkUrlChange, 1000);

		// Also monitor DOM for timer element removal
		const observer = new MutationObserver(() => {
			this.bridge.checkAndReinjectTimer();
		});

		observer.observe(document.body, {
			childList: true,
			subtree: true,
		});
	}

	// Debug helper - expose debug info to window for console access
	private setupDebugHelpers(): void {
		(window as any).qcAuditDebug = {
			getInterceptorStatus: () => {
				return {
					hasInjectedInterceptor: this.hasInjectedInterceptor,
					isAuditPage: this.isAuditPage(),
					trackingEnabled: this.trackingEnabled,
					currentTaskData: this.currentTaskData,
					url: window.location.href,
					isDebugMode: this.isDebugMode(),
				};
			},
			getCurrentTaskData: () => this.currentTaskData,
			forceReinjection: () => {
				this.hasInjectedInterceptor = false;
				this.injectInterceptor();
			},
			checkForInterceptorScript: () => {
				const scripts = document.querySelectorAll("script");
				let found = false;
				scripts.forEach((script) => {
					if (
						script.textContent &&
						script.textContent.includes("[QC-Interceptor]")
					) {
						found = true;
					}
				});
				return found;
			},
			testInterceptorMessage: (type: string, payload: any) => {
				window.postMessage(
					{
						source: "qc-audit-interceptor",
						type: type,
						payload: payload,
					},
					"*"
				);
			},
		};
	}

	private applyChatBulkAuditUiFixes(): void {
		const isChatBulkAudit = window.location.pathname.includes(
			"/en/expert/outlieradmin/tools/chat_bulk_audit"
		);
		if (!isChatBulkAudit) return;

		const tryApply = () => {
			try {
				// Hide modal container if present
				const modal = document.querySelector<HTMLElement>(
					".MuiDialog-container.MuiDialog-scrollPaper"
				);
				if (modal && modal.style.display !== "none") {
					modal.style.setProperty("display", "none", "important");
				}

				// Restore scroll and positioning on dialog root
				const root = document.querySelector<HTMLElement>(".MuiDialog-root");
				if (root) {
					root.style.setProperty("overflow", "auto", "important");
					root.style.setProperty("position", "static", "important");
				}
			} catch (e) {
				logger.warn("Failed to apply chat_bulk_audit UI fixes", {
					error: (e as Error).message,
				});
			}
		};

		// Run immediately and observe DOM for late-mounted dialogs
		tryApply();
		const observer = new MutationObserver(() => tryApply());
		observer.observe(document.body, { childList: true, subtree: true });
	}
}

// Initialize content script when DOM is ready
if (document.readyState === "loading") {
	document.addEventListener("DOMContentLoaded", () => {
		new ContentScript();
	});
} else {
	new ContentScript();
}
