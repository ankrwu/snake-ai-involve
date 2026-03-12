/**
 * Worker 状态组件
 * 显示每个 Worker 的运行状态
 */

export class WorkerStatusPanel {
    /**
     * 创建 Worker 状态面板
     * @param {HTMLElement} container - 容器元素
     * @param {number} workerCount - Worker 数量
     */
    constructor(container, workerCount) {
        this.container = container;
        this.workerCount = workerCount;
        this.workerElements = new Map();
        this.init();
    }

    /**
     * 初始化
     */
    init() {
        this.container.innerHTML = `
            <div class="worker-status-header">
                <span>Worker 状态</span>
                <span class="worker-count">(${this.workerCount} 核心)</span>
            </div>
            <div class="worker-status-list"></div>
        `;

        this.listEl = this.container.querySelector('.worker-status-list');

        // 创建每个 Worker 的状态元素
        for (let i = 0; i < this.workerCount; i++) {
            this.createWorkerElement(i);
        }
    }

    /**
     * 创建单个 Worker 状态元素
     */
    createWorkerElement(workerId) {
        const el = document.createElement('div');
        el.className = 'worker-item worker-idle';
        el.id = `worker-${workerId}`;

        el.innerHTML = `
            <div class="worker-bar">
                <div class="worker-progress" style="width: 0%"></div>
            </div>
            <div class="worker-info">
                <span class="worker-label">Worker ${workerId}</span>
                <span class="worker-status-text">空闲</span>
            </div>
        `;

        this.listEl.appendChild(el);
        this.workerElements.set(workerId, {
            element: el,
            progressBar: el.querySelector('.worker-progress'),
            statusText: el.querySelector('.worker-status-text')
        });
    }

    /**
     * 更新 Worker 状态
     * @param {number} workerId - Worker ID
     * @param {Object} status - 状态对象 { busy, taskId, agentId, progress }
     */
    updateStatus(workerId, status) {
        const workerEl = this.workerElements.get(workerId);
        if (!workerEl) return;

        const { element, progressBar, statusText } = workerEl;

        if (status.busy) {
            element.className = 'worker-item worker-busy';
            progressBar.style.width = `${status.progress || 0}%`;
            statusText.textContent = `Agent #${status.agentId} (${Math.round(status.progress || 0)}%)`;
        } else {
            element.className = 'worker-item worker-idle';
            progressBar.style.width = '0%';
            statusText.textContent = '空闲';
        }
    }

    /**
     * 更新所有 Worker 状态
     * @param {Array} statuses - 状态数组
     */
    updateAll(statuses) {
        for (const status of statuses) {
            this.updateStatus(status.id, status);
        }
    }

    /**
     * 重置所有状态
     */
    reset() {
        for (const [workerId] of this.workerElements) {
            this.updateStatus(workerId, { busy: false });
        }
    }

    /**
     * 更新 Worker 数量
     * @param {number} newCount - 新的 Worker 数量
     */
    updateWorkerCount(newCount) {
        if (newCount === this.workerCount) return;

        this.workerCount = newCount;
        this.workerElements.clear();
        this.init();
    }
}
