/**
 * 日志面板组件
 * 显示实时训练日志和事件流
 */

export class LogPanel {
    /**
     * 创建日志面板
     * @param {HTMLElement} container - 容器元素
     * @param {Object} options - 配置选项
     */
    constructor(container, options = {}) {
        this.container = container;
        this.maxLogs = options.maxLogs || 100;
        this.logs = [];
        this.autoScroll = true;
        this.init();
    }

    /**
     * 初始化
     */
    init() {
        this.container.innerHTML = `
            <div class="log-header">
                <span>训练日志</span>
                <button class="clear-btn" title="清空日志">清空</button>
            </div>
            <div class="log-content"></div>
        `;

        this.contentEl = this.container.querySelector('.log-content');
        this.clearBtn = this.container.querySelector('.clear-btn');

        this.clearBtn.addEventListener('click', () => this.clear());
        this.contentEl.addEventListener('scroll', () => {
            this.autoScroll = this.contentEl.scrollTop + this.contentEl.clientHeight >= this.contentEl.scrollHeight - 10;
        });
    }

    /**
     * 添加日志条目
     * @param {string} message - 日志消息
     * @param {string} type - 日志类型: 'info', 'success', 'warning', 'error', 'milestone'
     */
    log(message, type = 'info') {
        const entry = {
            timestamp: new Date(),
            message,
            type
        };

        this.logs.push(entry);

        // 限制日志数量
        if (this.logs.length > this.maxLogs) {
            this.logs.shift();
            if (this.contentEl.firstChild) {
                this.contentEl.removeChild(this.contentEl.firstChild);
            }
        }

        this.renderEntry(entry);
    }

    /**
     * 渲染单个日志条目
     */
    renderEntry(entry) {
        const el = document.createElement('div');
        el.className = `log-entry log-${entry.type}`;

        const time = entry.timestamp.toLocaleTimeString('zh-CN', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });

        const icon = this.getIcon(entry.type);

        el.innerHTML = `
            <span class="log-time">[${time}]</span>
            <span class="log-icon">${icon}</span>
            <span class="log-message">${entry.message}</span>
        `;

        this.contentEl.appendChild(el);

        // 自动滚动到底部
        if (this.autoScroll) {
            this.contentEl.scrollTop = this.contentEl.scrollHeight;
        }
    }

    /**
     * 获取日志图标
     */
    getIcon(type) {
        const icons = {
            'info': '',
            'success': '✓',
            'warning': '⚠',
            'error': '✗',
            'milestone': '🏆'
        };
        return icons[type] || '';
    }

    /**
     * 记录信息日志
     */
    info(message) {
        this.log(message, 'info');
    }

    /**
     * 记录成功日志
     */
    success(message) {
        this.log(message, 'success');
    }

    /**
     * 记录警告日志
     */
    warning(message) {
        this.log(message, 'warning');
    }

    /**
     * 记录错误日志
     */
    error(message) {
        this.log(message, 'error');
    }

    /**
     * 记录里程碑事件
     */
    milestone(message) {
        this.log(message, 'milestone');
    }

    /**
     * 记录代数开始
     */
    logGenerationStart(generation) {
        this.info(`Gen-${generation} 开始评估`);
    }

    /**
     * 记录代数完成
     */
    logGenerationComplete(generation, stats) {
        this.success(`Gen-${generation} 完成 - 最佳分数: ${stats.bestScore}, 平均分数: ${stats.avgScore.toFixed(1)}`);
    }

    /**
     * 记录新的历史最高分
     */
    logNewHighScore(generation, score) {
        this.milestone(`新历史最高分: ${score} (Gen-${generation})`);
    }

    /**
     * 记录 Agent 完成
     */
    logAgentComplete(agentId, score, steps) {
        this.info(`Agent #${agentId} 完成: 分数 ${score}, 步数 ${steps}`);
    }

    /**
     * 记录本代最佳
     */
    logGenerationBest(agentId, score) {
        this.success(`🎉 Agent #${agentId} 创本代最高分: ${score}!`);
    }

    /**
     * 清空日志
     */
    clear() {
        this.logs = [];
        this.contentEl.innerHTML = '';
    }

    /**
     * 获取日志历史
     */
    getHistory() {
        return [...this.logs];
    }
}
