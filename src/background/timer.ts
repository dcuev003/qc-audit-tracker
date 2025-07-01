import { TimerState } from '../shared/types/storage';
import { createLogger } from '../shared/logger';
import { ALARM_NAMES } from '../shared/constants';

const logger = createLogger('Timer');

interface TimerConfig {
  maxTime: number; // seconds
  taskId?: string;
}

export class TimerManager {
  private state: TimerState | null = null;
  private updateCallback: ((data: any) => void) | null = null;

  constructor() {
    this.setupAlarmListener();
  }

  private setupAlarmListener(): void {
    chrome.alarms.onAlarm.addListener((alarm) => {
      if (alarm.name === ALARM_NAMES.TIMER_UPDATE) {
        this.handleTimerTick();
      }
    });
  }

  start(config: TimerConfig): void {
    logger.timer('Starting timer', config);
    
    this.state = {
      isRunning: true,
      startTime: Date.now(),
      elapsed: 0,
      lastUpdate: Date.now(),
      maxTime: config.maxTime,
      taskId: config.taskId
    };

    // Create recurring alarm for timer updates
    chrome.alarms.create(ALARM_NAMES.TIMER_UPDATE, {
      periodInMinutes: 1 / 60 // Every second
    });

    this.notifyUpdate();
  }

  stop(): number {
    if (!this.state) {
      logger.warn('Attempted to stop timer when not running');
      return 0;
    }

    logger.timer('Stopping timer');
    
    const finalElapsed = Date.now() - this.state.startTime;
    this.state.isRunning = false;
    this.state.elapsed = finalElapsed;
    
    // Clear the alarm
    chrome.alarms.clear(ALARM_NAMES.TIMER_UPDATE);
    
    this.notifyUpdate();
    
    return finalElapsed;
  }

  resume(state: TimerState): void {
    logger.timer('Resuming timer from saved state', state);
    
    this.state = state;
    
    if (state.isRunning) {
      // Recalculate elapsed time
      const timeSinceLastUpdate = Date.now() - state.lastUpdate;
      this.state.elapsed += timeSinceLastUpdate;
      this.state.lastUpdate = Date.now();
      
      // Restart alarm
      chrome.alarms.create(ALARM_NAMES.TIMER_UPDATE, {
        periodInMinutes: 1 / 60
      });
      
      this.notifyUpdate();
    }
  }

  updateMaxTime(maxTime: number): void {
    if (!this.state) return;
    
    logger.timer('Updating max time', { oldMaxTime: this.state.maxTime, newMaxTime: maxTime });
    this.state.maxTime = maxTime;
    this.notifyUpdate();
  }

  getState(): TimerState | null {
    return this.state ? { ...this.state } : null;
  }

  onUpdate(callback: (data: any) => void): void {
    this.updateCallback = callback;
  }

  private handleTimerTick(): void {
    if (!this.state || !this.state.isRunning) return;
    
    const now = Date.now();
    this.state.elapsed = now - this.state.startTime;
    this.state.lastUpdate = now;
    
    this.notifyUpdate();
  }

  private notifyUpdate(): void {
    if (!this.state || !this.updateCallback) return;
    
    const data = {
      isRunning: this.state.isRunning,
      elapsed: this.state.elapsed,
      maxTime: this.state.maxTime,
      currentTaskId: this.state.taskId,
      formattedTime: this.formatTime(this.state.elapsed)
    };
    
    this.updateCallback(data);
  }

  private formatTime(ms: number): string {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }

  destroy(): void {
    chrome.alarms.clear(ALARM_NAMES.TIMER_UPDATE);
    this.state = null;
    this.updateCallback = null;
  }
}