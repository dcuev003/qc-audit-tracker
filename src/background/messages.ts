import { BaseMessage, MessageType } from '../shared/types/messages';
import { Task, OffPlatformTimeEntry, ProjectOverride } from '../shared/types/storage';
import { createLogger } from '../shared/logger';

const logger = createLogger('Messages');

export interface MessageHandlers {
  onStartTracking: (payload: any, sender: chrome.runtime.MessageSender) => Promise<any>;
  onStopTracking: (payload: any) => Promise<any>;
  onUpdateTaskData: (payload: any) => Promise<any>;
  onGetState: () => Promise<any>;
  onUpdateSettings: (payload: any) => Promise<any>;
  onAddOffPlatformTime: (payload: OffPlatformTimeEntry) => Promise<any>;
  onGetCompletedTasks: () => Promise<Task[]>;
  onGetOffPlatformTime: () => Promise<OffPlatformTimeEntry[]>;
  onUpdateProjectOverride: (payload: ProjectOverride) => Promise<any>;
  onToggleTracking: () => Promise<any>;
  onStartOffPlatformTimer: (payload: any) => Promise<any>;
  onStopOffPlatformTimer: (payload: any) => Promise<any>;
}

export class MessageHandler {
  private handlers: MessageHandlers;

  constructor(handlers: MessageHandlers) {
    this.handlers = handlers;
    this.setupListener();
  }

  private setupListener(): void {
    chrome.runtime.onMessage.addListener((message: BaseMessage, sender, sendResponse) => {
      this.handleMessage(message, sender)
        .then(response => sendResponse(response))
        .catch(error => {
          logger.error('Message handler error', { type: message.type, error });
          sendResponse({ error: error.message });
        });
      
      return true; // Keep channel open for async response
    });
  }

  private async handleMessage(message: BaseMessage, sender: chrome.runtime.MessageSender): Promise<any> {
    logger.message('Message received in background', { 
      type: message.type, 
      source: message.source,
      isStopTracking: message.type === 'STOP_TRACKING',
      payload: message.payload
    });

    switch (message.type) {
      case MessageType.START_TRACKING:
        return this.handlers.onStartTracking(message.payload, sender);
      
      case MessageType.STOP_TRACKING:
        return this.handlers.onStopTracking(message.payload);
      
      case MessageType.UPDATE_TASK_DATA:
        return this.handlers.onUpdateTaskData(message.payload);
      
      case MessageType.GET_STATE:
        return this.handlers.onGetState();
      
      case MessageType.UPDATE_SETTINGS:
        return this.handlers.onUpdateSettings(message.payload);
      
      case MessageType.ADD_OFF_PLATFORM_TIME:
        return this.handlers.onAddOffPlatformTime(message.payload);
      
      case MessageType.GET_COMPLETED_TASKS:
        return this.handlers.onGetCompletedTasks();
      
      case MessageType.GET_OFF_PLATFORM_TIME:
        return this.handlers.onGetOffPlatformTime();
      
      case MessageType.UPDATE_PROJECT_OVERRIDE:
        return this.handlers.onUpdateProjectOverride(message.payload);
      
      case MessageType.TOGGLE_TRACKING:
        return this.handlers.onToggleTracking();
      
      case MessageType.START_OFF_PLATFORM_TIMER:
        return this.handlers.onStartOffPlatformTimer(message.payload);
      
      case MessageType.STOP_OFF_PLATFORM_TIMER:
        return this.handlers.onStopOffPlatformTimer(message.payload);
      
      default:
        throw new Error(`Unknown message type: ${message.type}`);
    }
  }

  async broadcastToTabs(message: BaseMessage, urlPattern: string = 'https://app.outlier.ai/*'): Promise<void> {
    try {
      const tabs = await chrome.tabs.query({ url: urlPattern });
      
      const promises = tabs.map(tab => {
        if (tab.id) {
          return chrome.tabs.sendMessage(tab.id, message).catch(() => {
            // Ignore errors for tabs without content script
          });
        }
      });
      
      await Promise.all(promises);
    } catch (error) {
      logger.error('Failed to broadcast message', error);
    }
  }

  async sendToTab(tabId: number, message: BaseMessage): Promise<any> {
    try {
      return await chrome.tabs.sendMessage(tabId, message);
    } catch (error) {
      logger.error('Failed to send message to tab', { tabId, error });
      throw error;
    }
  }
}