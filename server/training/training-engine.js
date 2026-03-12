/**
 * 训练引擎 - 服务端主训练控制器
 */
import { cpus } from 'os';
import { WorkerPool } from './worker-pool.js';
import { Population } from './population.js';
import { saveModel, getModel, addLeaderboardEntry } from '../database/db.js';

export class TrainingEngine {
    constructor() {
        this.population = null;
        this.workerPool = null;
        this.config = {
            gridSize: 40,
            populationSize: 100,
            targetGeneration: 1000,
            workerCount: cpus().length,
            inputSize: 28,
            hiddenSize: 16,
            outputSize: 4
        };

        // 状态
        this.running = false;
        this.paused = false;
        this.evaluatedCount = 0;
        this.startTime = null;
        this.totalGames = 0;
        this.generationBestScore = 0;
        this.generationBestAgentId = null;

        // 回调
        this.onStatusUpdate = null;
        this.onLog = null;
        this.onProgress = null;
        this.onGenerationComplete = null;
        this.onWorkerStatusChange = null;
        
        // 最佳演示数据（保存历史最高分的游戏记录）
        this.bestDemoData = null;
        this.bestDemoRecordedScore = 0;  // 记录已保存演示时的 population.bestScore
    }

    /**
     * 设置配置
     */
    setConfig(config) {
        this.config = { ...this.config, ...config };
    }

    /**
     * 获取当前状态
     */
    getStatus() {
        const elapsed = this.startTime ? Date.now() - this.startTime : 0;

        return {
            running: this.running,
            paused: this.paused,
            generation: this.population ? this.population.generation : 0,
            targetGeneration: this.config.targetGeneration,
            evaluatedCount: this.evaluatedCount,
            populationSize: this.config.populationSize,
            workerCount: this.config.workerCount,
            totalGames: this.totalGames,
            elapsed: elapsed,
            stats: this.population ? this.population.getStats() : null,
            bestScore: this.population ? this.population.bestScore : 0,
            bestFitness: this.population ? this.population.bestFitness : 0,
            history: this.population ? this.population.history.slice(-50) : [],
            generationBestScore: this.generationBestScore,
            generationBestAgentId: this.generationBestAgentId
        };
    }

    /**
     * 获取 Worker 状态
     */
    getWorkerStatuses() {
        return this.workerPool ? this.workerPool.getWorkerStatuses() : [];
    }

    /**
     * 初始化训练
     */
    async init() {
        // 初始化种群
        this.population = new Population({
            size: this.config.populationSize,
            inputSize: this.config.inputSize,
            hiddenSize: this.config.hiddenSize,
            outputSize: this.config.outputSize
        });
        this.population.initialize();

        // 初始化 Worker 池
        this.workerPool = new WorkerPool(this.config.workerCount);
        this.workerPool.onWorkerStatusChange = (workerId, status) => {
            if (this.onWorkerStatusChange) {
                this.onWorkerStatusChange(workerId, status);
            }
        };
        await this.workerPool.init();

        this.log('info', `训练引擎初始化完成，使用 ${this.config.workerCount} 个 Worker`);
    }

    /**
     * 开始训练
     */
    async start(config = {}) {
        if (this.running) return;

        // 更新配置
        if (Object.keys(config).length > 0) {
            this.setConfig(config);
        }

        // 检查是否需要重新初始化 WorkerPool（workerCount 变化时）
        const needReinitWorkers = !this.workerPool ||
            (config.workerCount && this.workerPool.workerCount !== config.workerCount);

        // 如果需要重新初始化 WorkerPool，先终止旧的
        if (needReinitWorkers && this.workerPool) {
            this.workerPool.terminate();
            this.workerPool = null;
        }

        // 如果没有初始化，先初始化
        if (!this.population) {
            this.population = new Population({
                size: this.config.populationSize,
                inputSize: this.config.inputSize,
                hiddenSize: this.config.hiddenSize,
                outputSize: this.config.outputSize
            });
            this.population.initialize();
        }

        // 初始化 Worker 池（如果需要）
        if (!this.workerPool) {
            this.workerPool = new WorkerPool(this.config.workerCount);
            this.workerPool.onWorkerStatusChange = (workerId, status) => {
                if (this.onWorkerStatusChange) {
                    this.onWorkerStatusChange(workerId, status);
                }
            };
            await this.workerPool.init();
            this.log('info', `Worker 池初始化完成，使用 ${this.config.workerCount} 个 Worker`);
        }

        this.running = true;
        this.paused = false;
        this.startTime = Date.now();
        this.totalGames = 0;

        this.log('info', `开始训练 - 目标: ${this.config.targetGeneration} 代`);
        this.updateStatus();

        // 开始训练循环
        await this.trainLoop();
    }

    /**
     * 训练循环
     */
    async trainLoop() {
        while (this.running && !this.paused && this.population.generation <= this.config.targetGeneration) {
            this.evaluatedCount = 0;
            this.generationBestScore = 0;
            this.generationBestAgentId = null;
            this.generationBestFrames = null;
            this.generationBestFinalScore = 0;
            this.generationBestSteps = 0;
            this.generationBestDeathCause = null;

            this.log('info', `Gen-${this.population.generation} 开始评估`);
            this.updateStatus();

            // 准备评估任务
            const agents = this.population.agents.map(agent => ({
                id: agent.id,
                weights: agent.network.getWeights()
            }));

            const evalConfig = {
                gridSize: this.config.gridSize,
                maxStepsWithoutFood: this.config.gridSize * this.config.gridSize
            };

            // 并行评估
            const results = await this.workerPool.evaluateAll(agents, evalConfig, (completed, total) => {
                this.evaluatedCount = completed;
                this.updateProgress();
            });

            // 处理结果
            for (let i = 0; i < results.length; i++) {
                const result = results[i];
                const agent = this.population.agents[i];

                agent.score = result.score;
                agent.steps = result.steps;
                agent.fitness = result.fitness;
                
                // 保存帧数据用于演示
                if (result.frames) {
                    agent.frames = result.frames;
                }

                this.totalGames++;

                if (result.score > this.generationBestScore) {
                    this.generationBestScore = result.score;
                    this.generationBestAgentId = agent.id;
                    // 保存本代最佳的游戏帧
                    this.generationBestFrames = result.frames;
                    this.generationBestFinalScore = result.score;
                    this.generationBestSteps = result.steps;
                    this.generationBestDeathCause = result.cause;
                }
            }

            // 记录本代最佳
            if (this.generationBestAgentId !== null) {
                this.log('success', `Agent #${this.generationBestAgentId} 创本代最高分: ${this.generationBestScore}`);
            }

            // 进化
            const evolveResult = this.population.evolve();

            // 检查是否有新的历史最高分，保存该次游戏的演示数据
            if (this.population.bestScore > this.bestDemoRecordedScore) {
                // 使用训练时实际的游戏帧数据
                if (this.generationBestFrames && this.generationBestFinalScore === this.population.bestScore) {
                    this.bestDemoData = {
                        frames: this.generationBestFrames,
                        finalScore: this.generationBestFinalScore,
                        totalSteps: this.generationBestSteps,
                        deathCause: this.generationBestDeathCause,
                        gridSize: this.config.gridSize,
                        generation: this.population.generation
                    };
                    this.bestDemoRecordedScore = this.population.bestScore;
                    this.log('milestone', `新历史最高分: ${this.population.bestScore}，已保存真实游戏记录`);
                }
            }

            this.log('success', `Gen-${this.population.generation} 完成 - 最佳分数: ${evolveResult.bestScore}, 平均分数: ${evolveResult.stats.avgScore.toFixed(1)}`);

            // 自动保存
            if (this.population.generation % 10 === 0) {
                this.autoSave();
            }

            // 回调
            if (this.onGenerationComplete) {
                this.onGenerationComplete(evolveResult);
            }

            this.updateStatus();
        }

        // 训练完成
        if (this.population.generation > this.config.targetGeneration) {
            this.complete();
        }
    }

    /**
     * 暂停训练
     */
    pause() {
        if (!this.running || this.paused) return;

        this.paused = true;
        this.log('warning', '训练已暂停');
        this.updateStatus();
    }

    /**
     * 恢复训练
     */
    resume() {
        if (!this.running || !this.paused) return;

        this.paused = false;
        this.log('info', '继续训练');
        this.updateStatus();
        this.trainLoop();
    }

    /**
     * 停止训练
     */
    stop() {
        this.running = false;
        this.paused = false;
        this.log('warning', '训练已停止');
        this.updateStatus();
    }

    /**
     * 训练完成
     */
    complete() {
        this.running = false;
        this.log('milestone', `训练完成! 共 ${this.population.generation} 代, 最佳分数: ${this.population.bestScore}`);

        // 保存最终模型
        this.autoSave();

        this.updateStatus();
    }

    /**
     * 重置训练
     */
    async reset() {
        this.running = false;
        this.paused = false;
        this.startTime = null;
        this.totalGames = 0;
        this.evaluatedCount = 0;
        this.generationBestScore = 0;
        this.generationBestAgentId = null;
        
        // 重置演示数据
        this.bestDemoData = null;
        this.bestDemoRecordedScore = 0;

        if (this.workerPool) {
            this.workerPool.terminate();
            this.workerPool = null;
        }

        this.population = null;

        this.log('info', '训练已重置');
        this.updateStatus();
    }

    /**
     * 加载模型
     */
    async loadModel(modelId) {
        try {
            const model = getModel(modelId);
            if (!model) {
                this.log('error', `模型 ${modelId} 不存在`);
                return false;
            }

            // 如果正在训练，先停止
            if (this.running) {
                this.stop();
            }

            // 初始化（如果需要）
            if (!this.population) {
                await this.init();
            }

            // 加载模型
            this.population.loadModel(model);
            
            // 重置演示数据，下次请求时会重新生成
            this.bestDemoData = null;
            this.bestDemoRecordedScore = 0;
            
            this.log('success', `成功加载模型: ${model.name} (Gen-${model.generation}, 分数: ${model.score})`);
            this.updateStatus();
            return true;
        } catch (error) {
            this.log('error', `加载模型失败: ${error.message}`);
            return false;
        }
    }

    /**
     * 手动保存模型
     */
    saveModel() {
        if (!this.population || !this.population.bestAgent) {
            this.log('warning', '没有可保存的模型');
            return null;
        }

        const modelData = this.population.serializeBest();
        const id = saveModel({
            name: `Gen-${modelData.generation}`,
            generation: modelData.generation,
            score: modelData.score,
            fitness: modelData.fitness,
            network: modelData.network,
            history: modelData.history
        });

        this.log('success', `模型已保存，ID: ${id}`);
        return id;
    }

    /**
     * 自动保存
     */
    autoSave() {
        const id = this.saveModel();

        // 保存到排行榜
        if (this.population.bestScore > 0) {
            addLeaderboardEntry({
                generation: this.population.generation,
                score: this.population.bestScore,
                fitness: this.population.bestFitness
            });
        }

        return id;
    }

    /**
     * 发送日志
     */
    log(type, message) {
        if (this.onLog) {
            this.onLog({ type, message, timestamp: Date.now() });
        }
    }

    /**
     * 发送状态更新
     */
    updateStatus() {
        if (this.onStatusUpdate) {
            this.onStatusUpdate(this.getStatus());
        }
    }

    /**
     * 发送进度更新
     */
    updateProgress() {
        if (this.onProgress) {
            this.onProgress({
                evaluated: this.evaluatedCount,
                total: this.config.populationSize
            });
        }
    }

    /**
     * 终止引擎
     */
    terminate() {
        this.stop();
        if (this.workerPool) {
            this.workerPool.terminate();
        }
    }

    /**
     * 获取最佳 Agent 的演示数据
     * 返回保存的历史最高分演示数据（真实游戏记录）
     */
    getDemoData() {
        // 如果有保存的真实游戏记录，直接返回
        if (this.bestDemoData) {
            return this.bestDemoData;
        }
        
        // 否则运行演示游戏
        return this.runBestDemoGame(5);
    }

    /**
     * 运行多次演示游戏，返回最佳结果
     */
    runBestDemoGame(runs = 5) {
        if (!this.population || !this.population.bestAgent) {
            return null;
        }

        let bestResult = null;
        let bestScore = -1;

        for (let i = 0; i < runs; i++) {
            const result = this.runDemoGame();
            if (result && result.finalScore > bestScore) {
                bestScore = result.finalScore;
                bestResult = result;
            }
        }

        return bestResult;
    }

    /**
     * 运行一次演示游戏并记录所有步骤
     */
    runDemoGame() {
        if (!this.population || !this.population.bestAgent) {
            return null;
        }

        const gridSize = this.config.gridSize;
        const maxStepsWithoutFood = gridSize * gridSize;
        
        // 初始化游戏状态
        const centerX = Math.floor(gridSize / 2);
        const centerY = Math.floor(gridSize / 2);
        
        let snake = {
            body: [
                { x: centerX, y: centerY },
                { x: centerX - 1, y: centerY },
                { x: centerX - 2, y: centerY }
            ],
            direction: { x: 1, y: 0 },
            nextDirection: { x: 1, y: 0 },
            alive: true
        };

        let food = this.spawnFood(snake.body, gridSize);
        let score = 0;
        let steps = 0;
        let stepsWithoutFood = 0;
        let gameOver = false;
        let deathCause = null;

        // 记录所有步骤
        const frames = [];

        // 记录初始状态
        frames.push({
            snake: JSON.parse(JSON.stringify(snake.body)),
            food: { ...food },
            score: 0,
            steps: 0
        });

        const directions = [
            { x: 0, y: -1 },  // up
            { x: 0, y: 1 },   // down
            { x: -1, y: 0 },  // left
            { x: 1, y: 0 }    // right
        ];
        const actionNames = ['up', 'down', 'left', 'right'];

        // 运行游戏
        while (!gameOver && steps < maxStepsWithoutFood * 2) {
            // 获取游戏状态
            const state = this.getGameState(snake, food, gridSize);
            
            // 神经网络决策
            const output = this.population.bestAgent.forward(state);
            const actionIndex = output.indexOf(Math.max(...output));
            const action = actionNames[actionIndex];

            // 更新方向
            const newDir = directions[actionIndex];
            if (snake.direction.x + newDir.x !== 0 || snake.direction.y + newDir.y !== 0) {
                snake.nextDirection = newDir;
            }

            // 移动
            snake.direction = snake.nextDirection;
            const head = snake.body[0];
            const newHead = {
                x: head.x + snake.direction.x,
                y: head.y + snake.direction.y
            };

            steps++;
            stepsWithoutFood++;

            // 检查碰撞
            if (newHead.x < 0 || newHead.x >= gridSize ||
                newHead.y < 0 || newHead.y >= gridSize) {
                gameOver = true;
                deathCause = 'wall';
                break;
            }

            // 检查自身碰撞
            let selfCollision = false;
            for (let i = 0; i < snake.body.length - 1; i++) {
                if (snake.body[i].x === newHead.x && snake.body[i].y === newHead.y) {
                    selfCollision = true;
                    break;
                }
            }
            if (selfCollision) {
                gameOver = true;
                deathCause = 'self';
                break;
            }

            // 检查饥饿
            if (stepsWithoutFood > maxStepsWithoutFood) {
                gameOver = true;
                deathCause = 'starvation';
                break;
            }

            // 移动蛇
            snake.body.unshift(newHead);

            // 检查是否吃到食物
            if (newHead.x === food.x && newHead.y === food.y) {
                score++;
                stepsWithoutFood = 0;
                food = this.spawnFood(snake.body, gridSize);
            } else {
                snake.body.pop();
            }

            // 记录这一帧
            frames.push({
                snake: JSON.parse(JSON.stringify(snake.body)),
                food: { ...food },
                score: score,
                steps: steps
            });
        }

        return {
            frames,
            finalScore: score,
            totalSteps: steps,
            deathCause,
            gridSize,
            generation: this.population.generation,
            bestFitness: this.population.bestFitness
        };
    }

    /**
     * 获取游戏状态（神经网络输入）
     */
    getGameState(snake, food, gridSize) {
        const head = snake.body[0];
        const body = snake.body;

        // 方向 one-hot
        const direction = [0, 0, 0, 0];
        if (snake.direction.y === -1) direction[0] = 1;
        else if (snake.direction.y === 1) direction[1] = 1;
        else if (snake.direction.x === -1) direction[2] = 1;
        else if (snake.direction.x === 1) direction[3] = 1;

        // 食物方向
        const foodDir = [
            head.y > food.y ? 1 : 0,
            head.y < food.y ? 1 : 0,
            head.x > food.x ? 1 : 0,
            head.x < food.x ? 1 : 0,
            (head.y > food.y && head.x < food.x) ? 1 : 0,
            (head.y > food.y && head.x > food.x) ? 1 : 0,
            (head.y < food.y && head.x > food.x) ? 1 : 0,
            (head.y < food.y && head.x < food.x) ? 1 : 0,
        ];

        // 障碍物距离
        const obstacles = this.getDistancesInDirections(head, body, gridSize);
        const bodyDistances = this.getBodyDistances(head, body, gridSize);

        return [...direction, ...foodDir, ...obstacles, ...bodyDistances];
    }

    /**
     * 获取各方向的障碍物距离
     */
    getDistancesInDirections(head, body, gridSize) {
        const directions = [
            { x: 0, y: -1 }, { x: 0, y: 1 },
            { x: -1, y: 0 }, { x: 1, y: 0 },
            { x: 1, y: -1 }, { x: -1, y: -1 },
            { x: -1, y: 1 }, { x: 1, y: 1 },
        ];

        const distances = [];
        for (const dir of directions) {
            let distance = 0;
            let pos = { x: head.x + dir.x, y: head.y + dir.y };

            while (distance < gridSize) {
                if (pos.x < 0 || pos.x >= gridSize ||
                    pos.y < 0 || pos.y >= gridSize) break;
                if (body.some(s => s.x === pos.x && s.y === pos.y)) break;
                distance++;
                pos.x += dir.x;
                pos.y += dir.y;
            }
            distances.push(distance / gridSize);
        }
        return distances;
    }

    /**
     * 获取各方向到自身身体的距离
     */
    getBodyDistances(head, body, gridSize) {
        const directions = [
            { x: 0, y: -1 }, { x: 0, y: 1 },
            { x: -1, y: 0 }, { x: 1, y: 0 },
            { x: 1, y: -1 }, { x: -1, y: -1 },
            { x: -1, y: 1 }, { x: 1, y: 1 },
        ];

        const distances = [];
        for (const d of directions) {
            let distance = 0;
            let x = head.x + d.x;
            let y = head.y + d.y;

            while (x >= 0 && x < gridSize && y >= 0 && y < gridSize && distance < gridSize) {
                let hitBody = false;
                for (let i = 1; i < body.length; i++) {
                    if (body[i].x === x && body[i].y === y) {
                        hitBody = true;
                        break;
                    }
                }
                if (hitBody) break;
                distance++;
                x += d.x;
                y += d.y;
            }
            distances.push(distance / gridSize);
        }
        return distances;
    }

    /**
     * 生成食物位置
     */
    spawnFood(snakeBody, gridSize) {
        let pos;
        let attempts = 0;
        do {
            pos = {
                x: Math.floor(Math.random() * gridSize),
                y: Math.floor(Math.random() * gridSize)
            };
            attempts++;
        } while (snakeBody.some(s => s.x === pos.x && s.y === pos.y) && attempts < 1000);
        return pos;
    }
}
