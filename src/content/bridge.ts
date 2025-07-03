import { TimerUpdatePayload } from "../shared/types";
import { createLogger } from "../shared/logger";

const logger = createLogger("Bridge");

export class MessageBridge {
	private timerElement: HTMLElement | null = null;
	private timerInterval: number | null = null;
	private currentTimerData: TimerUpdatePayload | null = null;

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
