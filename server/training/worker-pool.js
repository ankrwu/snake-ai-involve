/**
 * Worker 池管理器 - Node.js Worker Threads 版本
 */
import { Worker } from 'worker_threads';
import { cpus } from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class WorkerPool {
    constructor(workerCount = null) {
        this.workerCount = workerCount || cpus().length;
        this.workers = [];
        this.taskQueue = [];
        this.pendingTasks = new Map();
        this.workerStatus = new Map();
        this.taskIdCounter = 0;
        this.active = false;
        this.onProgress = null;
        this.onWorkerStatusChange = null;
    }

    async init() {
        return new Promise((resolve, reject) => {
            let readyCount = 0;

            for (let i = 0; i < this.workerCount; i++) {
                try {
                    const workerPath = path.join(__dirname, 'training-worker.js');
                    const worker = new Worker(workerPath);

                    worker.on('message', (data) => {
                        if (data.type === 'ready') {
                            readyCount++;
                            this.workerStatus.set(i, { busy: false, taskId: null, agentId: null, progress: 0 });

                            if (readyCount === this.workerCount) {
                                this.active = true;
                                resolve();
                            }
                        } else if (data.type === 'progress') {
                            this.handleProgress(i, data);
                        } else if (data.type === 'complete') {
                            this.handleComplete(i, data);
                        } else if (data.type === 'error') {
                            this.handleError(i, data);
                        }
                    });

                    worker.on('error', (error) => {
                        console.error(`Worker ${i} error:`, error);
                        this.handleError(i, { taskId: null, error: error.message });
                    });

                    this.workers.push(worker);
                } catch (error) {
                    console.error(`Failed to create worker ${i}:`, error);
                    reject(error);
                }
            }
        });
    }

    getNextTaskId() {
        return `task-${++this.taskIdCounter}`;
    }

    evaluateAgent(agent, config) {
        return new Promise((resolve, reject) => {
            const taskId = this.getNextTaskId();

            this.pendingTasks.set(taskId, { resolve, reject, agentId: agent.id });
            this.taskQueue.push({ taskId, agent, config });
            this.dispatchTasks();
        });
    }

    async evaluateAll(agents, config, onProgress = null) {
        const results = new Array(agents.length);
        let completed = 0;

        const promises = agents.map(async (agent, index) => {
            const result = await this.evaluateAgent(agent, config);
            results[index] = { agentId: agent.id, ...result };

            completed++;
            if (onProgress) {
                onProgress(completed, agents.length);
            }

            return result;
        });

        await Promise.all(promises);
        return results;
    }

    dispatchTasks() {
        while (this.taskQueue.length > 0) {
            const idleWorkerIndex = this.findIdleWorker();
            if (idleWorkerIndex === -1) break;

            const task = this.taskQueue.shift();
            this.assignTask(idleWorkerIndex, task);
        }
    }

    findIdleWorker() {
        for (let i = 0; i < this.workers.length; i++) {
            const status = this.workerStatus.get(i);
            if (!status.busy) {
                return i;
            }
        }
        return -1;
    }

    assignTask(workerIndex, task) {
        const worker = this.workers[workerIndex];
        const { taskId, agent, config } = task;

        this.workerStatus.set(workerIndex, {
            busy: true,
            taskId,
            agentId: agent.id,
            progress: 0
        });

        if (this.onWorkerStatusChange) {
            this.onWorkerStatusChange(workerIndex, this.workerStatus.get(workerIndex));
        }

        worker.postMessage({
            type: 'evaluate',
            taskId,
            agent: {
                id: agent.id,
                weights: agent.weights
            },
            config
        });
    }

    handleProgress(workerIndex, data) {
        const { taskId, agentId, currentStep, currentScore, maxSteps } = data;

        const status = this.workerStatus.get(workerIndex);
        if (status) {
            status.progress = Math.min(100, (currentStep / maxSteps) * 100);
            status.currentStep = currentStep;
            status.currentScore = currentScore;

            if (this.onWorkerStatusChange) {
                this.onWorkerStatusChange(workerIndex, status);
            }
        }
    }

    handleComplete(workerIndex, data) {
        const { taskId, agentId, result } = data;

        const pending = this.pendingTasks.get(taskId);
        if (pending) {
            this.pendingTasks.delete(taskId);
            pending.resolve(result);
        }

        this.workerStatus.set(workerIndex, {
            busy: false,
            taskId: null,
            agentId: null,
            progress: 0
        });

        if (this.onWorkerStatusChange) {
            this.onWorkerStatusChange(workerIndex, this.workerStatus.get(workerIndex));
        }

        this.dispatchTasks();
    }

    handleError(workerIndex, data) {
        const { taskId, error } = data;

        const pending = this.pendingTasks.get(taskId);
        if (pending) {
            this.pendingTasks.delete(taskId);
            pending.reject(new Error(error));
        }

        this.workerStatus.set(workerIndex, {
            busy: false,
            taskId: null,
            agentId: null,
            progress: 0,
            error
        });

        if (this.onWorkerStatusChange) {
            this.onWorkerStatusChange(workerIndex, this.workerStatus.get(workerIndex));
        }

        this.dispatchTasks();
    }

    getWorkerStatuses() {
        const statuses = [];
        for (let i = 0; i < this.workerCount; i++) {
            statuses.push({
                id: i,
                ...this.workerStatus.get(i)
            });
        }
        return statuses;
    }

    getBusyWorkerCount() {
        let count = 0;
        for (const status of this.workerStatus.values()) {
            if (status.busy) count++;
        }
        return count;
    }

    terminate() {
        for (const worker of this.workers) {
            worker.terminate();
        }
        this.workers = [];
        this.workerStatus.clear();
        this.pendingTasks.clear();
        this.taskQueue = [];
        this.active = false;
    }
}
