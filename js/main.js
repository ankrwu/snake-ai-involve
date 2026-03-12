/**
 * 主程序入口 - WebSocket 客户端，只负责监控和控制
 */
import { LogPanel } from './ui/log-panel.js';
import { WorkerStatusPanel } from './ui/worker-status.js';

class SnakeEvolutionMonitor {
    constructor() {
        // WebSocket
        this.ws = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;

        // 状态
        this.status = null;
        this.workerStatuses = [];
        this.config = {
            targetGeneration: 1000,
            populationSize: 100,
            workerCount: navigator.hardwareConcurrency || 4
        };

        // UI 组件
        this.logPanel = null;
        this.workerStatusPanel = null;

        // UI 元素
        this.startBtn = document.getElementById('startBtn');
        this.pauseBtn = document.getElementById('pauseBtn');
        this.resetBtn = document.getElementById('resetBtn');
        this.saveBtn = document.getElementById('saveBtn');
        this.loadBtn = document.getElementById('loadBtn');
        this.demoBtn = document.getElementById('demoBtn');
        this.statusIndicator = document.getElementById('statusIndicator');
        this.statusText = document.getElementById('statusText');
        this.loadModal = document.getElementById('loadModal');
        this.modelList = document.getElementById('modelList');
        this.historyChart = document.getElementById('historyChart');
        this.demoModal = document.getElementById('demoModal');
        this.demoCanvas = document.getElementById('demoCanvas');
        
        // 演示状态
        this.demoState = {
            frames: [],
            currentFrame: 0,
            playing: false,
            speed: 10,
            animationId: null
        };

        // 初始化
        this.init();
    }

    /**
     * 初始化
     */
    async init() {
        this.initUI();
        this.bindEvents();
        this.connectWebSocket();
        this.loadLeaderboard();

        console.log('AI 贪吃蛇进化监控器初始化完成');
    }

    /**
     * 初始化 UI
     */
    initUI() {
        // 日志面板
        const logContainer = document.getElementById('logPanel');
        if (logContainer) {
            this.logPanel = new LogPanel(logContainer, { maxLogs: 200 });
        }

        // Worker 状态面板
        const workerStatusContainer = document.getElementById('workerStatusPanel');
        if (workerStatusContainer) {
            this.workerStatusPanel = new WorkerStatusPanel(workerStatusContainer, this.config.workerCount);
        }

        // 配置显示
        document.getElementById('targetGeneration').textContent = this.config.targetGeneration;
        document.getElementById('workerCount').textContent = this.config.workerCount;
    }

    /**
     * 绑定事件
     */
    bindEvents() {
        this.startBtn.addEventListener('click', () => this.start());
        this.pauseBtn.addEventListener('click', () => this.togglePause());
        this.resetBtn.addEventListener('click', () => this.reset());
        this.saveBtn.addEventListener('click', () => this.saveModel());
        this.loadBtn.addEventListener('click', () => this.showLoadModal());
        this.demoBtn.addEventListener('click', () => this.showDemo());

        // Worker 数量滑块
        const workerSlider = document.getElementById('workerSlider');
        if (workerSlider) {
            workerSlider.value = this.config.workerCount;
            workerSlider.addEventListener('input', (e) => {
                this.config.workerCount = parseInt(e.target.value);
                document.getElementById('workerCountDisplay').textContent = this.config.workerCount;
            });
        }

        // 目标代数输入
        const targetGenInput = document.getElementById('targetGenInput');
        if (targetGenInput) {
            targetGenInput.value = this.config.targetGeneration;
            targetGenInput.addEventListener('change', (e) => {
                this.config.targetGeneration = parseInt(e.target.value) || 1000;
                document.getElementById('targetGeneration').textContent = this.config.targetGeneration;
            });
        }

        document.getElementById('closeModalBtn').addEventListener('click', () => {
            this.loadModal.classList.remove('active');
        });

        this.loadModal.addEventListener('click', (e) => {
            if (e.target === this.loadModal) {
                this.loadModal.classList.remove('active');
            }
        });

        // 演示模态框事件
        document.getElementById('closeDemoBtn').addEventListener('click', () => {
            this.closeDemo();
        });
        
        this.demoModal.addEventListener('click', (e) => {
            if (e.target === this.demoModal) {
                this.closeDemo();
            }
        });
        
        document.getElementById('demoPlayPauseBtn').addEventListener('click', () => {
            this.toggleDemoPlayPause();
        });
        
        document.getElementById('demoRestartBtn').addEventListener('click', () => {
            this.restartDemo();
        });
        
        document.getElementById('demoSpeedSlider').addEventListener('input', (e) => {
            this.demoState.speed = parseInt(e.target.value);
        });
    }

    /**
     * 连接 WebSocket
     */
    connectWebSocket() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}`;

        this.logPanel?.info('正在连接服务器...');
        this.updateStatus('', '连接中...');

        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
            this.reconnectAttempts = 0;
            this.logPanel?.success('已连接到服务器');
            this.updateStatus('', '已连接');

            // 更新 Worker 面板数量
            if (this.workerStatusPanel && this.status) {
                this.workerStatusPanel = new WorkerStatusPanel(
                    document.getElementById('workerStatusPanel'),
                    this.status.workerCount
                );
            }
        };

        this.ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                this.handleMessage(data);
            } catch (error) {
                console.error('消息解析错误:', error);
            }
        };

        this.ws.onclose = () => {
            this.logPanel?.warning('与服务器断开连接');
            this.updateStatus('', '已断开');

            // 尝试重连
            if (this.reconnectAttempts < this.maxReconnectAttempts) {
                this.reconnectAttempts++;
                this.logPanel?.info(`尝试重连 (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
                setTimeout(() => this.connectWebSocket(), 2000);
            }
        };

        this.ws.onerror = (error) => {
            console.error('WebSocket 错误:', error);
            this.logPanel?.error('连接错误');
        };
    }

    /**
     * 发送消息
     */
    send(type, data = {}) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({ type, ...data }));
        } else {
            this.logPanel?.error('未连接到服务器');
        }
    }

    /**
     * 处理服务器消息
     */
    handleMessage(data) {
        const { type, ...params } = data;

        switch (type) {
            case 'status':
                this.updateStatusDisplay(params.data);
                break;

            case 'worker_status':
                this.updateWorkerStatus(params.data);
                break;

            case 'log':
                this.handleLog(params.data);
                break;

            case 'progress':
                this.updateProgress(params.data);
                break;

            case 'generation_complete':
                this.handleGenerationComplete(params.data);
                break;

            case 'load_model_result':
                if (params.data.success) {
                    this.logPanel?.success('模型加载成功');
                    this.loadModal.classList.remove('active');
                } else {
                    this.logPanel?.error('模型加载失败');
                }
                break;

            case 'save_model_result':
                if (params.data.success) {
                    this.logPanel?.success(`模型保存成功，ID: ${params.data.modelId}`);
                } else {
                    this.logPanel?.error('模型保存失败');
                }
                break;

            case 'config_updated':
                this.config = params.data;
                break;

            case 'error':
                this.logPanel?.error(params.message || '服务器错误');
                break;

            case 'demo_data':
                this.handleDemoData(params.data);
                break;
        }
    }

    /**
     * 更新状态显示
     */
    updateStatusDisplay(status) {
        this.status = status;

        // 更新按钮状态
        if (status.running && !status.paused) {
            this.startBtn.disabled = true;
            this.pauseBtn.disabled = false;
            this.pauseBtn.textContent = '暂停';
            this.updateStatus('running', `Gen-${status.generation} 训练中...`);
        } else if (status.paused) {
            this.pauseBtn.textContent = '继续';
            this.updateStatus('paused', '已暂停');
        } else {
            this.startBtn.disabled = false;
            this.pauseBtn.disabled = true;
            this.pauseBtn.textContent = '暂停';

            if (status.generation > status.targetGeneration) {
                this.updateStatus('completed', '训练完成!');
            } else {
                this.updateStatus('', '就绪');
            }
        }

        // 更新统计
        document.getElementById('generation').textContent = status.generation || 0;
        document.getElementById('targetGeneration').textContent = status.targetGeneration || this.config.targetGeneration;

        if (status.stats) {
            document.getElementById('avgScore').textContent = status.stats.avgScore.toFixed(1);
            document.getElementById('maxScore').textContent = status.bestScore || status.stats.maxScore;
            document.getElementById('avgFitness').textContent = status.stats.avgFitness.toFixed(0);
            document.getElementById('bestFitness').textContent = (status.bestFitness || status.stats.maxFitness).toFixed(0);
        }

        document.getElementById('evaluated').textContent = `${status.evaluatedCount || 0}/${status.populationSize || 100}`;
        document.getElementById('workerCount').textContent = status.workerCount || this.config.workerCount;

        // 更新 Worker 面板数量（如果变化）
        if (this.workerStatusPanel && status.workerCount &&
            this.workerStatusPanel.workerCount !== status.workerCount) {
            this.workerStatusPanel.updateWorkerCount(status.workerCount);
        }

        // 进度条
        const progress = status.generation && status.targetGeneration
            ? (status.generation / status.targetGeneration) * 100
            : 0;
        document.getElementById('progressBar').style.width = `${progress}%`;
        document.getElementById('progressText').textContent = `${Math.round(progress)}%`;

        // 性能指标
        if (status.elapsed) {
            document.getElementById('elapsedTime').textContent = this.formatTime(status.elapsed);

            const gamesPerSec = status.totalGames > 0
                ? (status.totalGames / (status.elapsed / 1000)).toFixed(1)
                : 0;
            document.getElementById('trainingSpeed').textContent = `${gamesPerSec} games/s`;
        }

        document.getElementById('totalGames').textContent = (status.totalGames || 0).toLocaleString();

        // 更新演示按钮状态
        if (this.demoBtn) {
            this.demoBtn.disabled = !status.bestScore || status.bestScore === 0;
        }

        // 绘制历史图表
        if (status.history && status.history.length > 0) {
            this.drawHistoryChart(status.history);
        }
    }

    /**
     * 更新 Worker 状态
     */
    updateWorkerStatus(statuses) {
        this.workerStatuses = statuses;
        if (this.workerStatusPanel) {
            this.workerStatusPanel.updateAll(statuses);
        }
    }

    /**
     * 处理日志
     */
    handleLog(log) {
        const { type, message } = log;
        switch (type) {
            case 'info':
                this.logPanel?.info(message);
                break;
            case 'success':
                this.logPanel?.success(message);
                break;
            case 'warning':
                this.logPanel?.warning(message);
                break;
            case 'error':
                this.logPanel?.error(message);
                break;
            case 'milestone':
                this.logPanel?.milestone(message);
                break;
            default:
                this.logPanel?.info(message);
        }
    }

    /**
     * 更新进度
     */
    updateProgress(progress) {
        document.getElementById('generationProgress').textContent = `${progress.evaluated}/${progress.total}`;
    }

    /**
     * 处理代数完成
     */
    handleGenerationComplete(result) {
        this.loadLeaderboard();
    }

    /**
     * 开始训练
     */
    start() {
        this.send('start', {
            config: {
                targetGeneration: this.config.targetGeneration,
                workerCount: this.config.workerCount
            }
        });
    }

    /**
     * 切换暂停
     */
    togglePause() {
        if (this.status && this.status.paused) {
            this.send('resume');
        } else {
            this.send('pause');
        }
    }

    /**
     * 重置
     */
    reset() {
        this.send('reset');
        if (this.logPanel) {
            this.logPanel.clear();
        }
    }

    /**
     * 保存模型
     */
    saveModel() {
        this.send('save_model');
    }

    /**
     * 显示加载模态框
     */
    async showLoadModal() {
        this.loadModal.classList.add('active');
        this.modelList.innerHTML = '<div class="loading"></div>';

        try {
            const response = await fetch('/api/models');
            const result = await response.json();

            if (result.success && result.models.length > 0) {
                this.modelList.innerHTML = result.models.map(model => `
                    <div class="model-item" data-id="${model.id}">
                        <div>
                            <strong>${model.name}</strong>
                            <div style="font-size: 0.8rem; color: #888;">
                                分数: ${model.score} | 适应度: ${model.fitness.toFixed(0)}
                            </div>
                        </div>
                        <div style="font-size: 0.8rem; color: #888;">
                            ${new Date(model.created_at).toLocaleDateString()}
                        </div>
                    </div>
                `).join('');

                this.modelList.querySelectorAll('.model-item').forEach(item => {
                    item.addEventListener('click', () => this.loadModel(item.dataset.id));
                });
            } else {
                this.modelList.innerHTML = '<p style="text-align: center; color: #888;">暂无保存的模型</p>';
            }
        } catch (error) {
            console.error('加载模型列表失败:', error);
            this.modelList.innerHTML = '<p style="text-align: center; color: #ff6b6b;">加载失败，请检查服务器</p>';
        }
    }

    /**
     * 加载模型
     */
    loadModel(modelId) {
        this.send('load_model', { modelId: parseInt(modelId) });
    }

    /**
     * 加载排行榜
     */
    async loadLeaderboard() {
        try {
            const response = await fetch('/api/leaderboard');
            const result = await response.json();
            const tbody = document.getElementById('leaderboardBody');

            if (result.success && result.leaderboard.length > 0) {
                tbody.innerHTML = result.leaderboard.map((entry, index) => `
                    <tr>
                        <td>${index + 1}</td>
                        <td>Gen-${entry.generation}</td>
                        <td>${entry.score}</td>
                        <td>${new Date(entry.created_at).toLocaleDateString()}</td>
                    </tr>
                `).join('');
            }
        } catch (error) {
            console.error('加载排行榜失败:', error);
        }
    }

    /**
     * 更新状态指示器
     */
    updateStatus(type, text) {
        this.statusIndicator.className = 'status-indicator ' + type;
        this.statusText.textContent = text;
    }

    /**
     * 格式化时间
     */
    formatTime(ms) {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);

        if (hours > 0) {
            return `${hours}:${String(minutes % 60).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
        } else if (minutes > 0) {
            return `${minutes}:${String(seconds % 60).padStart(2, '0')}`;
        } else {
            return `${seconds}s`;
        }
    }

    /**
     * 绘制历史图表
     */
    drawHistoryChart(history) {
        const canvas = this.historyChart;
        const ctx = canvas.getContext('2d');

        canvas.width = canvas.offsetWidth;
        canvas.height = 200;

        ctx.fillStyle = '#1a1a2e';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        if (history.length < 2) return;

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = 1;

        for (let i = 0; i <= 5; i++) {
            const y = (canvas.height / 5) * i;
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(canvas.width, y);
            ctx.stroke();
        }

        const maxScores = history.map(h => h.maxScore);
        const maxMaxScore = Math.max(...maxScores, 1);

        ctx.strokeStyle = '#ff6b6b';
        ctx.lineWidth = 2;
        ctx.beginPath();

        for (let i = 0; i < maxScores.length; i++) {
            const x = (i / (maxScores.length - 1)) * canvas.width;
            const y = canvas.height - (maxScores[i] / maxMaxScore) * (canvas.height - 20);

            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.stroke();

        const avgScores = history.map(h => h.avgScore);

        ctx.strokeStyle = '#00ff88';
        ctx.beginPath();

        for (let i = 0; i < avgScores.length; i++) {
            const x = (i / (avgScores.length - 1)) * canvas.width;
            const y = canvas.height - (avgScores[i] / maxMaxScore) * (canvas.height - 20);

            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.stroke();

        ctx.font = '12px sans-serif';
        ctx.fillStyle = '#ff6b6b';
        ctx.fillRect(10, 10, 20, 3);
        ctx.fillStyle = '#e0e0e0';
        ctx.fillText('最高分数', 35, 15);

        ctx.fillStyle = '#00ff88';
        ctx.fillRect(120, 10, 20, 3);
        ctx.fillStyle = '#e0e0e0';
        ctx.fillText('平均分数', 145, 15);
    }

    /**
     * 显示演示
     */
    showDemo() {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            this.logPanel?.error('未连接到服务器');
            return;
        }
        this.send('get_demo');
    }

    /**
     * 处理演示数据
     */
    handleDemoData(data) {
        if (!data) {
            this.logPanel?.error('没有可用的演示数据');
            return;
        }

        this.demoState.frames = data.frames;
        this.demoState.currentFrame = 0;
        this.demoState.playing = true;
        this.demoState.gridSize = data.gridSize;
        this.demoState.generation = data.generation;

        // 更新标题 - 显示历史最高分
        document.getElementById('demoScore').textContent = 
            `历史最高分 (Gen-${data.generation}, 最终分数: ${data.finalScore}, 步数: ${data.totalSteps})`;

        // 显示模态框
        this.demoModal.classList.add('active');
        document.getElementById('demoPlayPauseBtn').textContent = '暂停';

        // 开始播放
        this.playDemo();
    }

    /**
     * 播放演示
     */
    playDemo() {
        if (this.demoState.animationId) {
            cancelAnimationFrame(this.demoState.animationId);
        }

        const animate = () => {
            if (!this.demoState.playing) return;

            this.renderDemoFrame();
            this.demoState.currentFrame++;

            if (this.demoState.currentFrame >= this.demoState.frames.length) {
                this.demoState.playing = false;
                document.getElementById('demoPlayPauseBtn').textContent = '播放';
                return;
            }

            // 根据速度计算延迟
            const delay = Math.max(10, 200 - this.demoState.speed * 15);
            setTimeout(() => {
                this.demoState.animationId = requestAnimationFrame(animate);
            }, delay);
        };

        animate();
    }

    /**
     * 渲染演示帧
     */
    renderDemoFrame() {
        const frame = this.demoState.frames[this.demoState.currentFrame];
        if (!frame) return;

        const canvas = this.demoCanvas;
        const ctx = canvas.getContext('2d');
        const gridSize = this.demoState.gridSize;
        const cellSize = canvas.width / gridSize;

        // 清空画布
        ctx.fillStyle = '#0a0a1a';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // 绘制网格
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
        ctx.lineWidth = 1;
        for (let i = 0; i <= gridSize; i++) {
            ctx.beginPath();
            ctx.moveTo(i * cellSize, 0);
            ctx.lineTo(i * cellSize, canvas.height);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(0, i * cellSize);
            ctx.lineTo(canvas.width, i * cellSize);
            ctx.stroke();
        }

        // 绘制食物
        ctx.fillStyle = '#ff6b6b';
        ctx.beginPath();
        ctx.arc(
            (frame.food.x + 0.5) * cellSize,
            (frame.food.y + 0.5) * cellSize,
            cellSize * 0.4,
            0, Math.PI * 2
        );
        ctx.fill();

        // 绘制蛇
        frame.snake.forEach((segment, index) => {
            if (index === 0) {
                // 蛇头
                ctx.fillStyle = '#00ff88';
            } else {
                // 蛇身渐变
                const ratio = 1 - (index / frame.snake.length) * 0.5;
                ctx.fillStyle = `rgba(0, ${Math.floor(255 * ratio)}, ${Math.floor(136 * ratio)}, 1)`;
            }
            ctx.fillRect(
                segment.x * cellSize + 1,
                segment.y * cellSize + 1,
                cellSize - 2,
                cellSize - 2
            );
        });

        // 绘制分数
        ctx.font = 'bold 14px sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.fillText(`分数: ${frame.score}  步数: ${frame.steps}`, 10, 20);
    }

    /**
     * 切换演示播放/暂停
     */
    toggleDemoPlayPause() {
        const btn = document.getElementById('demoPlayPauseBtn');
        if (this.demoState.playing) {
            this.demoState.playing = false;
            btn.textContent = '播放';
        } else {
            if (this.demoState.currentFrame >= this.demoState.frames.length) {
                this.demoState.currentFrame = 0;
            }
            this.demoState.playing = true;
            btn.textContent = '暂停';
            this.playDemo();
        }
    }

    /**
     * 重新播放演示
     */
    restartDemo() {
        this.demoState.currentFrame = 0;
        this.demoState.playing = true;
        document.getElementById('demoPlayPauseBtn').textContent = '暂停';
        this.playDemo();
    }

    /**
     * 关闭演示
     */
    closeDemo() {
        this.demoState.playing = false;
        if (this.demoState.animationId) {
            cancelAnimationFrame(this.demoState.animationId);
        }
        this.demoModal.classList.remove('active');
    }
}

// 启动应用
document.addEventListener('DOMContentLoaded', () => {
    window.app = new SnakeEvolutionMonitor();
});
