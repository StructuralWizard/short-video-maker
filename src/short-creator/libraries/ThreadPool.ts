import { Worker } from 'worker_threads';
import { logger } from '../../logger';
import path from 'path';

export type Task<T> = {
  id: string;
  fn: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (error: Error) => void;
};

export class ThreadPool {
  private workers: Worker[] = [];
  private taskQueue: Task<any>[] = [];
  private activeWorkers = 0;
  private maxWorkers: number;

  constructor(maxWorkers: number = 4) {
    this.maxWorkers = maxWorkers;
  }

  async execute<T>(task: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      const taskId = Math.random().toString(36).substring(7);
      this.taskQueue.push({ id: taskId, fn: task, resolve, reject });
      this.processNextTask();
    });
  }

  private async processNextTask() {
    if (this.taskQueue.length === 0 || this.activeWorkers >= this.maxWorkers) {
      return;
    }

    const task = this.taskQueue.shift();
    if (!task) return;

    this.activeWorkers++;
    try {
      const result = await task.fn();
      task.resolve(result);
    } catch (error) {
      task.reject(error as Error);
    } finally {
      this.activeWorkers--;
      this.processNextTask();
    }
  }

  async waitForAll(): Promise<void> {
    while (this.taskQueue.length > 0 || this.activeWorkers > 0) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  shutdown() {
    this.workers.forEach(worker => worker.terminate());
    this.workers = [];
    this.taskQueue = [];
    this.activeWorkers = 0;
  }
} 