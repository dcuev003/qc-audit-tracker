// This file is compiled to an IIFE and injected into the page
// It cannot use imports or Chrome APIs

(() => {
	interface InterceptorConfig {
		debug: boolean;
	}

	class OutlierApiInterceptor {
		private originalFetch: typeof window.fetch;
		private config: InterceptorConfig;
		// Note: DOM injection is handled by content script; interceptor only signals data

		constructor(config: InterceptorConfig = { debug: false }) {
			this.config = config;
			this.originalFetch = window.fetch.bind(window);
			this.install();
		}

		private log(level: string, message: string, data?: any): void {
			const timestamp = new Date().toISOString().substring(11, 23);
			// Always log errors and warnings, debug only when enabled
			if (level === "error" || level === "warn" || this.config.debug) {
				console.log(`[QC-Interceptor] ${timestamp} ${level}: ${message}`, data);
			}
		}

		private async install(): Promise<void> {
			window.fetch = async (...args) => {
				const [url, init] = args;
				const urlString = url.toString();

				// Call original fetch
				const response = await this.originalFetch(url, init);

				// Log ALL API calls to track completion/transition calls
				const isAuditRelated = this.isAuditRelatedEndpoint(urlString);
				const isComplete = urlString.includes("/complete/");
				const isTransition = urlString.includes("/transition");

				if (isAuditRelated || isComplete || isTransition) {
					this.log("info", `API Call: ${init?.method || "GET"} ${urlString}`, {
						status: response.status,
						ok: response.ok,
						isAuditRelated,
						isComplete,
						isTransition,
						urlMatches: {
							hasCorpApi: urlString.includes("/corp-api/"),
							hasChatBulkAudit: urlString.includes("/chatBulkAudit/"),
							hasQmOperations: urlString.includes("/qm/operations/"),
						},
					});
				}

				// Process audit-related endpoints
				if (isAuditRelated) {
					if (response.ok) {
						this.processResponse(urlString, response.clone());
					} else {
						this.log("warn", `API call failed: ${urlString}`, {
							status: response.status,
							statusText: response.statusText,
						});
					}
				}

				return response;
			};

			// Extract email from __NEXT_DATA__ if available
			this.extractEmailFromPage();

			this.log("info", "Interceptor installed successfully");

		}

		private isAuditRelatedEndpoint(url: string): boolean {
			// Intercept audit-related endpoints including completion endpoints
			const isAuditRelated =
				url.includes("/corp-api/chatBulkAudit/attemptAudit/") ||
				url.includes(
					"/corp-api/chatBulkAudit/relatedQaOperationForAuditBatch/"
				) ||
				url.includes("/corp-api/chatBulkAudit/complete/") ||
				url.includes("/corp-api/qm/operations/") ||
				url.includes("/corp-api/qm/assigned-operation-nodes");

			// Always log completion-related endpoints regardless of page
			if (
				url.includes("/complete/") ||
				(url.includes("/transition") && url.includes("/qm/operations/"))
			) {
				this.log("info", "Completion endpoint detected", {
					url,
					isComplete: url.includes("/complete/"),
					isTransition: url.includes("/transition"),
					currentPage: window.location.href,
				});
			}

			return isAuditRelated;
		}

		private async processResponse(
			url: string,
			response: Response
		): Promise<void> {
			try {
				// Clone response to read text first, then try to parse as JSON
				const responseClone = response.clone();
				const text = await responseClone.text();

				if (!text || text.trim() === "") {
					this.log("warn", "Empty response body", { url });
					return;
				}

				let data;
				try {
					data = JSON.parse(text);
				} catch (parseError) {
					this.log("error", "JSON parse error", {
						url,
						responseText:
							text.substring(0, 200) + (text.length > 200 ? "..." : ""),
						error: parseError,
					});
					return;
				}

				// Route to specific handlers based on URL pattern
				this.log("info", "Processing response for URL patterns", {
					url,
					patterns: {
						isAttemptAudit:
							url.includes("/attemptAudit/") && url.includes("pageLoadId"),
						isAttemptAuditResponse:
							url.includes("/attemptAudit/") && url.includes("/response?"),
						isRelatedQaOperation: url.includes(
							"/relatedQaOperationForAuditBatch/"
						),
						isComplete: url.includes("/complete/"),
						isTransition:
							url.includes("/transition") && url.includes("/qm/operations/"),
						isNodes: url.includes("/nodes") && url.includes("/qm/operations/"),
						isAssignedNodes: url.includes("/assigned-operation-nodes"),
					},
					dataSize: typeof data === 'object' ? JSON.stringify(data).length : 'not-object',
					hasData: !!data
				});

				if (url.includes("/attemptAudit/") && url.includes("pageLoadId")) {
					this.handleAttemptAudit(data);
				} else if (
					url.includes("/attemptAudit/") &&
					url.includes("/response?")
				) {
					this.handleAttemptAuditResponse(data);
				} else if (url.includes("/relatedQaOperationForAuditBatch/")) {
					this.handleRelatedQaOperation(data);
				} else if (url.includes("/complete/")) {
					this.log(
						"info",
						"COMPLETE endpoint detected - calling handleComplete"
					);
					this.handleComplete(data);
				} else if (
					url.includes("/transition") &&
					url.includes("/qm/operations/")
				) {
					this.log(
						"info",
						"TRANSITION endpoint detected - calling handleTransition"
					);
					this.handleTransition(data);
				} else if (url.includes("/nodes") && url.includes("/qm/operations/")) {
					this.handleNodes(data);
				} else if (url.includes("/assigned-operation-nodes")) {
					this.handleAssignedOperationNodes(data);
				} else {
					this.log("warn", "No handler matched for URL", { url });
				}
			} catch (error) {
				this.log("error", "Failed to process response", { url, error });
			}
		}

		private handleAssignedOperationNodes(data: any): void {
			// Expecting array or object with nodes array
			const nodes = Array.isArray(data) ? data : (Array.isArray(data?.nodes) ? data.nodes : []);
			this.log("info", "handleAssignedOperationNodes called", {
				isArray: Array.isArray(data),
				hasNodesProp: !!data?.nodes,
				nodesCount: Array.isArray(nodes) ? nodes.length : 0
			});
			if (!Array.isArray(nodes) || nodes.length === 0) {
				this.log("warn", "Assigned operation nodes missing or empty");
				return;
			}

			const map: Record<string, { qaId: string; batchId: string }> = {};
			let added = 0;
			for (const audit of nodes) {
				const qaId = audit?.qaOperation?._id || audit?.qaOperationId;
				const batchId = audit?.qaOperation?.relatedObjectId || audit?.relatedObjectId || audit?.qaOperationRelatedObjectId;
				const fullId = audit?._id || audit?.id || qaId;
				if (!qaId || !batchId || !fullId) {
					this.log("warn", "Skipping node; missing required ids", { hasQaId: !!qaId, hasBatchId: !!batchId, hasFullId: !!fullId });
					continue;
				}
				const str = String(fullId);
				map[str] = { qaId, batchId };
				map[str.substring(0,5)] = { qaId, batchId };
				map[str.slice(-5)] = { qaId, batchId };
				added++;
			}

			this.log("info", "Assigned nodes mapped for lookup links (sending to content)", {
				added,
				mapSize: Object.keys(map).length,
				sampleKey: Object.keys(map)[0]
			});

			this.sendMessage('ASSIGNED_NODES_MAP', { map });
		}


		private sendMessage(type: string, payload: any): void {
			const message = {
				source: "qc-tracker-interceptor",
				type,
				payload,
				timestamp: Date.now(),
			};

			this.log("info", `Sending message via window.postMessage`, {
				type,
				source: message.source,
				hasPayload: !!payload,
			});

			window.postMessage(message, "*");
		}

		private handleAttemptAudit(data: any): void {
			this.log("info", "Processing attemptAudit response", {
				isArray: Array.isArray(data),
				dataType: typeof data,
				hasData: !!data,
			});

			// Response can be either an object or array of single object
			const responseData = Array.isArray(data) ? data[0] : data;

			if (responseData?.auditedEntityContext) {
				const extractedInfo = {
					projectId: responseData.project,
					attemptId: responseData.auditedEntityContext.entityAttemptId,
					reviewLevel: responseData.auditedEntityContext.entityReviewLevel,
				};

				this.log("info", "Attempt audit data captured successfully", {
					extractedInfo,
					hasProject: !!responseData.project,
					hasAttemptId: !!responseData.auditedEntityContext.entityAttemptId,
					hasReviewLevel: !!responseData.auditedEntityContext.entityReviewLevel,
				});

				this.sendMessage("API_DATA_CAPTURED", {
					endpoint: "attemptAudit",
					data: responseData,
					extractedInfo,
				});
			} else {
				this.log("warn", "Attempt audit response missing expected data", {
					data: responseData,
					hasAuditedEntityContext: !!responseData?.auditedEntityContext,
					responseKeys: responseData ? Object.keys(responseData) : [],
				});
			}
		}

		private handleAttemptAuditResponse(data: any): void {
			this.log("info", "Processing attemptAuditResponse", {
				isArray: Array.isArray(data),
				hasData: !!data,
			});

			// Response can be either an object or array of single object
			const responseData = Array.isArray(data) ? data[0] : data;
			
			// Enhanced debugging for project name extraction
			this.log("info", "AttemptAuditResponse data structure", {
				hasResponseData: !!responseData,
				responseDataKeys: responseData ? Object.keys(responseData) : [],
				hasAuditedAttempt: !!responseData?.auditedAttempt,
				auditedAttemptKeys: responseData?.auditedAttempt ? Object.keys(responseData.auditedAttempt) : [],
				hasEstimatedPayoutMeta: !!responseData?.auditedAttempt?.estimatedPayoutMeta,
				estimatedPayoutMetaKeys: responseData?.auditedAttempt?.estimatedPayoutMeta ? Object.keys(responseData.auditedAttempt.estimatedPayoutMeta) : [],
				workerTeamNameValue: responseData?.auditedAttempt?.estimatedPayoutMeta?.workerTeamName
			});

			if (responseData?.auditedAttempt?.estimatedPayoutMeta?.workerTeamName) {
				const workerTeamName =
					responseData.auditedAttempt.estimatedPayoutMeta.workerTeamName;

				// Extract project name using regex pattern
				// Rule 1: Find a segment that is FOLLOWED BY a worker team or level (Attempter, Reviewer, L[number], etc.).
				// Rule 2: Find a segment that is followed by a [SCALE...] tag at the end of the string.
				const primaryRegex =
					/\/([^/]+)(?=\/(?:(?:Super)?Attempter|Reviewer|L\d+))|\/([^/[]+?)\s*\[[^\]]+\]$/;
				const match = workerTeamName.match(primaryRegex);
				let rawProjectName = null;
				let projectName = null;
				if (match) {
					// If a specific rule matched, the result is in group 1 or 2.
					rawProjectName = match[1] || match[2];
					projectName = rawProjectName.trim();
				} else {
					// Fallback for simple cases: if no special rules match, it's likely the last segment.
					// So split by '/' and filter out any empty strings from trailing slashes.
					const segments = workerTeamName.split("/").filter(Boolean);
					rawProjectName = segments[segments.length - 1];
					projectName = rawProjectName.trim();
				}

				// If match found a potential name - trim it.
				if (rawProjectName) {
					// This second regex handles the final cleanup: it removes a potential
					// leading [SCALE...] tag and trims whitespace from the result.
					const cleanupRegex = /(?:\[[^\]]+\]\s*)?(.*)/;
					const cleanupMatch = rawProjectName.match(cleanupRegex);

					// The final, clean name is in the first capturing group of the cleanup regex.
					projectName = cleanupMatch
						? cleanupMatch[1].trim()
						: rawProjectName.trim();
				}

				this.log("info", "Project name extracted successfully", {
					projectName,
					workerTeamName,
					regexMatch: match ? "success" : "failed",
				});

				this.sendMessage("API_DATA_CAPTURED", {
					endpoint: "attemptAuditResponse",
					data: responseData,
					extractedInfo: {
						projectName,
					},
				});
			} else {
				this.log("warn", "Project name extraction failed - missing data path", {
					responseData,
					hasAuditedAttempt: !!responseData?.auditedAttempt,
					hasEstimatedPayoutMeta:
						!!responseData?.auditedAttempt?.estimatedPayoutMeta,
					hasWorkerTeamName:
						!!responseData?.auditedAttempt?.estimatedPayoutMeta?.workerTeamName,
					actualPath: responseData?.auditedAttempt
						? Object.keys(responseData.auditedAttempt)
						: [],
				});
			}
		}

		private handleRelatedQaOperation(data: any): void {
			const extractedInfo: any = {
				maxTime: data?.maxTimeRequired,
				operationId: data?.stateMachine?.context?.operationId || data?.operationId,
			};

			this.log("info", "QA operation data captured", {
				extractedInfo,
				hasMaxTime: typeof data?.maxTimeRequired === 'number',
				maxTimeValue: data?.maxTimeRequired,
				maxTimeType: typeof data?.maxTimeRequired,
				hasStateMachine: !!data?.stateMachine,
			});

			this.sendMessage("API_DATA_CAPTURED", {
				endpoint: "relatedQaOperation",
				data,
				extractedInfo,
			});
		}

		private handleComplete(data: any): void {
			this.log("info", "Task completed (not final) - /complete/ endpoint hit", {
				hasData: !!data,
				dataKeys: data ? Object.keys(data) : [],
			});
			this.sendMessage("TASK_COMPLETED", { data });
		}

		private handleTransition(data: any): void {
			this.log("info", "Task transitioned (final) - /transition endpoint hit", {
				hasData: !!data,
				dataKeys: data ? Object.keys(data) : [],
			});
			this.sendMessage("TASK_TRANSITIONED", { data });
		}

		private handleNodes(data: any): void {
			this.log("info", "Processing nodes response", {
				hasData: !!data,
				dataType: typeof data,
				dataSize: typeof data === 'object' ? JSON.stringify(data).length : 'not-object',
				hasStateMachine: !!data?.stateMachine,
				currentState: data?.stateMachine?.currentState
			});

			// Robust cancellation detection (deep scan)
			const isCanceled = (() => {
				try {
					if (data?.stateMachine?.currentState === 'canceled') return true;
					if (typeof data?.currentState === 'string' && data.currentState === 'canceled') return true;
					const visit = (obj: any, depth = 0): boolean => {
						if (!obj || typeof obj !== 'object' || depth > 8) return false;
						if (obj?.stateMachine?.currentState === 'canceled') return true;
						if (typeof obj?.currentState === 'string' && obj.currentState === 'canceled') return true;
						for (const k in obj) {
							if (!Object.prototype.hasOwnProperty.call(obj, k)) continue;
							const v = obj[k];
							if (typeof v === 'object' && visit(v, depth + 1)) return true;
						}
						return false;
					};
					return visit(data);
				} catch { return false; }
			})();

			if (isCanceled) {
				this.log('info', 'Task canceled (detected in nodes response)', {});
				this.sendMessage('TASK_CANCELED', { data });
				return;
			}

			// Try to extract project name from the nodes response (only once to avoid repeated extraction)
			// This is a large JSON response, so we'll search for the specific path
			let projectName = null;
			
			try {
				// Search through the data structure for workerTeamName
				const findWorkerTeamName = (obj: any, depth = 0): string | null => {
					// Limit recursion depth to avoid performance issues with large JSON
					if (depth > 10 || !obj || typeof obj !== 'object') return null;
					
					// Check if current object has the path we need
					if (obj.auditedAttempt?.estimatedPayoutMeta?.workerTeamName) {
						return obj.auditedAttempt.estimatedPayoutMeta.workerTeamName;
					}
					
					// Search through object properties
					for (const key in obj) {
						if (obj.hasOwnProperty(key) && typeof obj[key] === 'object') {
							const result = findWorkerTeamName(obj[key], depth + 1);
							if (result) return result;
						}
					}
					
					return null;
				};

				const workerTeamName = findWorkerTeamName(data);
				
				if (workerTeamName) {
					// Apply the same extraction logic as in handleAttemptAuditResponse
					const primaryRegex =
						/\/([^/]+)(?=\/(?:(?:Super)?Attempter|Reviewer|L\d+))|\/([^/[]+?)\s*\[[^\]]+\]$/;
					const match = workerTeamName.match(primaryRegex);
					let rawProjectName = null;
					
					if (match) {
						rawProjectName = match[1] || match[2];
						projectName = rawProjectName.trim();
					} else {
						// Fallback for simple cases
						const segments = workerTeamName.split("/").filter(Boolean);
						rawProjectName = segments[segments.length - 1];
						projectName = rawProjectName.trim();
					}

					// Final cleanup
					if (rawProjectName) {
						const cleanupRegex = /(?:\[[^\]]+\]\s*)?(.*)/;
						const cleanupMatch = rawProjectName.match(cleanupRegex);
						projectName = cleanupMatch
							? cleanupMatch[1].trim()
							: rawProjectName.trim();
					}

					if (projectName) {
						this.log("info", "Project name extracted from nodes response", {
							projectName,
							workerTeamName,
							regexMatch: match ? "success" : "failed",
						});

						this.sendMessage("API_DATA_CAPTURED", {
							endpoint: "nodes",
							data: null, // Don't send the massive nodes data
							extractedInfo: {
								projectName,
							},
						});
					}
				}
			} catch (error) {
				this.log("warn", "Failed to extract project name from nodes response", { error });
			}
		}

		private extractEmailFromPage(): void {
			try {
				// Look for __NEXT_DATA__ script tag
				const nextDataScript = document.getElementById('__NEXT_DATA__');
				if (!nextDataScript) {
					this.log("info", "No __NEXT_DATA__ found on page");
					return;
				}

				const scriptData = JSON.parse(nextDataScript.textContent || '{}');
				const email = scriptData?.props?.pageInitialProps?.user?.email;

				if (email) {
					this.log("info", "Email extracted from page", { email });
					this.sendMessage("USER_EMAIL_EXTRACTED", { email });
				} else {
					this.log("info", "No email found in __NEXT_DATA__", {
						hasProps: !!scriptData?.props,
						hasPageInitialProps: !!scriptData?.props?.pageInitialProps,
						hasUser: !!scriptData?.props?.pageInitialProps?.user
					});
				}
			} catch (error) {
				this.log("warn", "Failed to extract email from page", { error });
			}
		}
	}

	// Initialize with config from DOM if available
	const configElement = document.getElementById("qc-tracker-config");
	const config = configElement
		? JSON.parse(configElement.textContent || "{}")
		: {};

	new OutlierApiInterceptor(config);
})();
