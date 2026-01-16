import { TimerUpdatePayload } from "../shared/types";
import { createLogger } from "../shared/logger";
import { buildLookupUrl } from "@/shared/lookupUtils";

const logger = createLogger("Bridge");

export class MessageBridge {
	private timerElement: HTMLElement | null = null;
	private timerInterval: number | null = null;
	private currentTimerData: TimerUpdatePayload | null = null;
	private lookupMap: Record<string, { qaId: string; batchId: string }> = {};
	private gridObserver: MutationObserver | null = null;
	private canceledModal: HTMLElement | null = null;

	constructor() {
		this.initializeUI();
	}

	private initializeUI(): void {
		// Create timer container
		const container = document.createElement("div");
		container.id = "qc-tracker-timer";
		container.style.cssText = `
      		position: fixed;
      		top: 35px;
      		left: 25px;
      		background: rgba(0, 0, 0, 0.8);
      		color: white;
      		padding: 8px 15px;
      		border-radius: 8px;
      		font-family: monospace;
      		font-size: 13px;
      		z-index: 999999;
      		display: none;
      		width: 130px;
      		box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
    `;
		document.body.appendChild(container);
		this.timerElement = container;
	}

	// =============== Lookup injection ===============
	updateLookupMap(
		map: Record<string, { qaId: string; batchId: string }>
	): void {
		this.lookupMap = map || {};
		logger.info("Lookup map updated", {
			size: Object.keys(this.lookupMap).length,
		});
		this.ensureGridObserver();
	}

	injectLookupIcons(): void {
		try {
			const cells = document.querySelectorAll<HTMLElement>(
				'div.MuiDataGrid-cell[data-field="_id"]'
			);
			let processed = 0;
			cells.forEach((cell) => {
				this.ensureLookupIcon(cell);
				processed++;
			});
			logger.info("injectLookupIcons (content) scanned cells", {
				count: cells.length,
				processed,
			});
		} catch (error: any) {
			logger.warn("Failed to inject lookup icons (content)", {
				error: error?.message || String(error),
			});
		}
	}

	private ensureGridObserver(): void {
		if (this.gridObserver) return;
		try {
			this.gridObserver = new MutationObserver(() => this.injectLookupIcons());
			this.gridObserver.observe(document.body, {
				childList: true,
				subtree: true,
			});
			logger.info("Grid observer (content) started");
			this.injectLookupIcons();
		} catch (error: any) {
			logger.warn("Failed to start grid observer (content)", {
				error: error?.message || String(error),
			});
		}
	}

	private ensureLookupIcon(cell: HTMLElement): void {
		if (!cell) return;
		if (cell.querySelector('[data-qc-lookup-link="1"]')) return;

		// Extract first text node inside the cell (before buttons)
		let firstText = "";
		try {
			const walker = document.createTreeWalker(cell, NodeFilter.SHOW_TEXT);
			let n: Node | null;
			while ((n = walker.nextNode())) {
				const v = (n.nodeValue || "").trim();
				if (v) {
					firstText = v;
					break;
				}
			}
		} catch {}
		const text = firstText || (cell.textContent || "").trim();
		const snippet = text.slice(-5); // DataGrid shows last 5 chars
		if (!snippet) return;

		const info =
			this.lookupMap[text] ||
			this.lookupMap[snippet] ||
			this.lookupMap[text.substring(0, 5)];
		if (!info) return;

		const href = buildLookupUrl(info.batchId);
		const btn = document.createElement("a");
		btn.setAttribute("data-qc-lookup-link", "1");
		btn.href = href;
		btn.target = "_blank";
		btn.rel = "noopener noreferrer";
		btn.className =
			"MuiButtonBase-root MuiIconButton-root MuiIconButton-sizeSmall";
		btn.style.marginLeft = "6px";
		btn.style.marginRight = "4px";
		btn.title = "Lookup QA audit in new tab";
		btn.innerHTML = `
      <span class="MuiIconButton-label" aria-hidden="true">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
      </span>`;

		// Place next to existing copy button if present
		const copyBtn = cell.querySelector(".MuiIconButton-root");
		if (copyBtn && copyBtn.parentElement === cell) {
			copyBtn.after(btn);
		} else {
			cell.appendChild(btn);
		}

		logger.info("Lookup icon appended (content)", { href, snippet });
	}

	// =============== Canceled task modal ===============
	showCanceledModal(): void {
		try {
			if (this.canceledModal) {
				this.canceledModal.style.display = "flex";
				return;
			}

			const overlay = document.createElement("div");
			overlay.id = "qc-tracker-canceled-overlay";
			overlay.style.cssText = [
				"position: fixed",
				"inset: 0",
				"z-index: 1000000",
				"display: flex",
				"align-items: center",
				"justify-content: center",
				"background: rgba(0,0,0,0.5)",
			].join(";");

			const modal = document.createElement("div");
			modal.style.cssText = [
				"background: white",
				"color: #111827",
				"border-radius: 10px",
				"padding: 16px",
				"max-width: 420px",
				"width: calc(100% - 32px)",
				"box-shadow: 0 10px 30px rgba(0,0,0,0.2)",
				"font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial",
			].join(";");

			const title = document.createElement("div");
			title.textContent = "Audit Canceled";
			title.style.cssText =
				"font-weight: 700; font-size: 16px; margin-bottom: 6px; color: #111827;";

			const msg = document.createElement("div");
			msg.textContent =
				"This audit has been canceled and the timer was stopped. It is safe to close the task. Contact your QC Lead for further details if needed.";
			msg.style.cssText =
				"font-size: 14px; color: #4B5563; margin-bottom: 14px; line-height: 1.4;";

			const actions = document.createElement("div");
			actions.style.cssText =
				"display: flex; justify-content: flex-end; gap: 8px;";

			const okBtn = document.createElement("button");
			okBtn.textContent = "OK";
			okBtn.style.cssText = [
				"padding: 8px 14px",
				"background: #4F46E5",
				"color: white",
				"border: none",
				"border-radius: 8px",
				"cursor: pointer",
				"font-weight: 600",
			].join(";");
			okBtn.addEventListener("click", () => this.hideCanceledModal());

			actions.appendChild(okBtn);
			modal.appendChild(title);
			modal.appendChild(msg);
			modal.appendChild(actions);
			overlay.appendChild(modal);
			document.body.appendChild(overlay);
			this.canceledModal = overlay;
			logger.info("Canceled modal shown");
		} catch (error: any) {
			logger.warn("Failed to show canceled modal", {
				error: error?.message || String(error),
			});
		}
	}

	hideCanceledModal(): void {
		if (this.canceledModal) {
			this.canceledModal.style.display = "none";
		}
	}

	updateTimerUI(timerData: TimerUpdatePayload): void {
		this.currentTimerData = timerData;

		if (!this.timerElement) {
			this.initializeUI();
		}

		if (!timerData.isRunning) {
			this.hideTimer();
			return;
		}

		this.showTimer();
		this.updateTimerDisplay();

		// Start local timer for smooth updates
		if (!this.timerInterval) {
			this.timerInterval = window.setInterval(() => {
				this.updateTimerDisplay();
			}, 1000);
		}
	}

	private updateTimerDisplay(): void {
		if (!this.timerElement || !this.currentTimerData) return;

		const elapsed = this.currentTimerData.elapsed;
		const maxTime = this.currentTimerData.maxTime * 1000; // Convert to ms

		// Convert time to readable hh:mm:ss format
		const maxTimeStr = this.formatTime(maxTime);
		const elapsedStr = this.formatTime(elapsed);

		const isOverTime = elapsed > maxTime;

		let html = `<div style="font-weight: bold; margin-bottom: 5px;">
			QC Audit Timer
			</div>
			<div ${isOverTime ? `style="color: #f0e246;"` : ""}>
				${elapsedStr}/${maxTimeStr}
			</div>`;

		this.timerElement.innerHTML = html;
	}

	private formatTime(ms: number): string {
		const totalSeconds = Math.floor(ms / 1000);
		const hours = Math.floor(totalSeconds / 3600);
		const minutes = Math.floor((totalSeconds % 3600) / 60);
		const seconds = totalSeconds % 60;

		return `${hours.toString().padStart(2, "0")}:${minutes
			.toString()
			.padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
	}

	private showTimer(): void {
		if (this.timerElement) {
			this.timerElement.style.display = "block";
		}
	}

	private hideTimer(): void {
		if (this.timerElement) {
			this.timerElement.style.display = "none";
		}
		if (this.timerInterval) {
			window.clearInterval(this.timerInterval);
			this.timerInterval = null;
		}
	}

	destroy(): void {
		this.hideTimer();
		if (this.timerElement) {
			this.timerElement.remove();
			this.timerElement = null;
		}
	}

	// Method to check if timer DOM needs to be re-injected
	checkAndReinjectTimer(): void {
		if (
			!document.getElementById("qc-tracker-timer") &&
			this.currentTimerData?.isRunning
		) {
			logger.info("Timer element missing, re-injecting");
			this.initializeUI();
			this.updateTimerUI(this.currentTimerData);
		}
	}
}
