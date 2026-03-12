/**
 * 训练 Worker - 在 Node.js Worker Thread 中运行
 * 使用 ES Module 语法
 */
import { parentPort } from 'worker_threads';

// ==================== 数学工具函数 ====================

function sigmoid(x) {
    return 1 / (1 + Math.exp(-Math.max(-500, Math.min(500, x))));
}

function tanh(x) {
    return Math.tanh(x);
}

function argMax(arr) {
    let max = -Infinity;
    let maxIndex = 0;
    for (let i = 0; i < arr.length; i++) {
        if (arr[i] > max) {
            max = arr[i];
            maxIndex = i;
        }
    }
    return maxIndex;
}

// ==================== 神经网络 ====================

class NeuralNetwork {
    constructor(layers) {
        this.layers = layers;
        this.weights = [];
        this.biases = [];
    }

    static fromWeights(layers, weights) {
        const nn = new NeuralNetwork(layers);
        nn.setWeights(weights);
        return nn;
    }

    setWeights(weights) {
        let index = 0;
        this.weights = [];
        this.biases = [];

        for (let i = 0; i < this.layers.length - 1; i++) {
            const layerWeights = [];
            for (let j = 0; j < this.layers[i]; j++) {
                const neuronWeights = [];
                for (let k = 0; k < this.layers[i + 1]; k++) {
                    neuronWeights.push(weights[index++]);
                }
                layerWeights.push(neuronWeights);
            }
            this.weights.push(layerWeights);

            const layerBiases = [];
            for (let k = 0; k < this.layers[i + 1]; k++) {
                layerBiases.push(weights[index++]);
            }
            this.biases.push(layerBiases);
        }
    }

    forward(input) {
        let activation = input;

        for (let i = 0; i < this.weights.length; i++) {
            const next = [];
            for (let j = 0; j < this.weights[i][0].length; j++) {
                let sum = this.biases[i][j];
                for (let k = 0; k < activation.length; k++) {
                    sum += activation[k] * this.weights[i][k][j];
                }
                if (i < this.weights.length - 1) {
                    next.push(tanh(sum));
                } else {
                    next.push(sigmoid(sum));
                }
            }
            activation = next;
        }
        return activation;
    }
}

// ==================== 蛇类 ====================

class Snake {
    constructor(gridSize = 40) {
        this.gridSize = gridSize;
        this.reset();
    }

    reset() {
        const centerX = Math.floor(this.gridSize / 2);
        const centerY = Math.floor(this.gridSize / 2);

        this.body = [
            { x: centerX, y: centerY },
            { x: centerX - 1, y: centerY },
            { x: centerX - 2, y: centerY }
        ];

        this.direction = { x: 1, y: 0 };
        this.nextDirection = { x: 1, y: 0 };
        this.alive = true;
        this.score = 0;
        this.steps = 0;
        this.stepsWithoutFood = 0;
        this.maxStepsWithoutFood = this.gridSize * this.gridSize;
    }

    getHead() {
        return this.body[0];
    }

    setDirection(action) {
        const directions = {
            'up': { x: 0, y: -1 },
            'down': { x: 0, y: 1 },
            'left': { x: -1, y: 0 },
            'right': { x: 1, y: 0 }
        };

        const newDir = directions[action];
        if (!newDir) return;

        if (this.direction.x + newDir.x !== 0 || this.direction.y + newDir.y !== 0) {
            this.nextDirection = newDir;
        }
    }

    move(food) {
        if (!this.alive) return { ate: false, died: true };

        this.direction = this.nextDirection;
        const head = this.getHead();
        const newHead = {
            x: head.x + this.direction.x,
            y: head.y + this.direction.y
        };

        this.steps++;
        this.stepsWithoutFood++;

        if (this.isOutOfBounds(newHead)) {
            this.alive = false;
            return { ate: false, died: true, cause: 'wall' };
        }

        if (this.isCollidingWithBody(newHead)) {
            this.alive = false;
            return { ate: false, died: true, cause: 'self' };
        }

        if (this.stepsWithoutFood > this.maxStepsWithoutFood) {
            this.alive = false;
            return { ate: false, died: true, cause: 'starvation' };
        }

        this.body.unshift(newHead);

        if (newHead.x === food.x && newHead.y === food.y) {
            this.score++;
            this.stepsWithoutFood = 0;
            return { ate: true, died: false };
        } else {
            this.body.pop();
            return { ate: false, died: false };
        }
    }

    isOutOfBounds(pos) {
        return pos.x < 0 || pos.x >= this.gridSize ||
               pos.y < 0 || pos.y >= this.gridSize;
    }

    isCollidingWithBody(pos) {
        for (let i = 0; i < this.body.length - 1; i++) {
            if (this.body[i].x === pos.x && this.body[i].y === pos.y) {
                return true;
            }
        }
        return false;
    }

    isBodyAt(pos) {
        return this.body.some(segment => segment.x === pos.x && segment.y === pos.y);
    }
}

// ==================== 游戏模拟器 ====================

class GameSimulation {
    constructor(gridSize = 40) {
        this.gridSize = gridSize;
        this.snake = null;
        this.food = null;
        this.gameOver = false;
        this.score = 0;
        this.steps = 0;
        this.deathCause = null;
        this.init();
    }

    init() {
        this.snake = new Snake(this.gridSize);
        this.spawnFood();
        this.gameOver = false;
        this.score = 0;
        this.steps = 0;
        this.deathCause = null;
    }

    spawnFood() {
        let pos;
        let attempts = 0;
        do {
            pos = {
                x: Math.floor(Math.random() * this.gridSize),
                y: Math.floor(Math.random() * this.gridSize)
            };
            attempts++;
        } while (this.snake && this.snake.isBodyAt(pos) && attempts < 1000);
        this.food = pos;
    }

    step(action) {
        if (this.gameOver) {
            return { gameOver: true, score: this.score, steps: this.steps };
        }

        this.snake.setDirection(action);
        const result = this.snake.move(this.food);
        this.steps++;

        if (result.ate) {
            this.score = this.snake.score;
            this.spawnFood();
        }

        if (result.died) {
            this.gameOver = true;
            this.deathCause = result.cause;
        }

        return {
            gameOver: this.gameOver,
            score: this.score,
            steps: this.steps,
            cause: result.cause
        };
    }

    getState() {
        if (!this.snake || !this.food) return null;

        const head = this.snake.getHead();
        const body = this.snake.body;

        const direction = [0, 0, 0, 0];
        if (this.snake.direction.y === -1) direction[0] = 1;
        else if (this.snake.direction.y === 1) direction[1] = 1;
        else if (this.snake.direction.x === -1) direction[2] = 1;
        else if (this.snake.direction.x === 1) direction[3] = 1;

        const foodDir = [
            head.y > this.food.y ? 1 : 0,
            head.y < this.food.y ? 1 : 0,
            head.x > this.food.x ? 1 : 0,
            head.x < this.food.x ? 1 : 0,
            (head.y > this.food.y && head.x < this.food.x) ? 1 : 0,
            (head.y > this.food.y && head.x > this.food.x) ? 1 : 0,
            (head.y < this.food.y && head.x > this.food.x) ? 1 : 0,
            (head.y < this.food.y && head.x < this.food.x) ? 1 : 0,
        ];

        const obstacles = this.getDistancesInDirections(head, body);
        const bodyDistances = this.getBodyDistances(head, body);

        return { direction, foodDir, obstacles, bodyDistances };
    }

    getDistancesInDirections(head, body) {
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

            while (distance < this.gridSize) {
                if (pos.x < 0 || pos.x >= this.gridSize ||
                    pos.y < 0 || pos.y >= this.gridSize) break;
                if (body.some(s => s.x === pos.x && s.y === pos.y)) break;
                distance++;
                pos.x += dir.x;
                pos.y += dir.y;
            }
            distances.push(distance / this.gridSize);
        }
        return distances;
    }

    getBodyDistances(head, body) {
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

            while (x >= 0 && x < this.gridSize && y >= 0 && y < this.gridSize && distance < this.gridSize) {
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
            distances.push(distance / this.gridSize);
        }
        return distances;
    }
}

// ==================== Agent ====================

class Agent {
    constructor(network, id) {
        this.network = network;
        this.id = id;
    }

    getAction(state) {
        const input = [
            ...state.direction,
            ...state.foodDir,
            ...state.obstacles,
            ...state.bodyDistances
        ];
        const output = this.network.forward(input);
        const actionIndex = argMax(output);
        const actions = ['up', 'down', 'left', 'right'];
        return actions[actionIndex];
    }

    static fromWeights(id, weights, layers = [28, 16, 4]) {
        const network = NeuralNetwork.fromWeights(layers, weights);
        return new Agent(network, id);
    }
}

// ==================== 适应度计算 ====================

function calculateFitness(score, steps, died) {
    const foodWeight = 1000;
    const stepWeight = 0.1;
    const deathPenalty = 50;
    const survivalBonus = 1;

    let fitness = 0;
    fitness += Math.pow(score, 1.5) * foodWeight;
    fitness += steps * stepWeight;

    if (died) {
        fitness -= score === 0 ? deathPenalty * 2 : deathPenalty;
    }

    fitness += steps * survivalBonus;
    return Math.max(0, fitness);
}

// ==================== Worker 消息处理 ====================

parentPort.on('message', (data) => {
    const { type, taskId, agent, config } = data;

    if (type === 'evaluate') {
        evaluateAgent(taskId, agent, config);
    }
});

function evaluateAgent(taskId, agentData, config) {
    const { id, weights } = agentData;
    const { gridSize = 40, maxStepsWithoutFood = 1600 } = config;

    const agent = Agent.fromWeights(id, weights, [28, 16, 4]);
    const game = new GameSimulation(gridSize);
    game.snake.maxStepsWithoutFood = maxStepsWithoutFood;

    // 记录游戏帧（用于高分演示）
    const frames = [];

    // 记录初始状态
    frames.push({
        snake: JSON.parse(JSON.stringify(game.snake.body)),
        food: { ...game.food },
        score: 0,
        steps: 0
    });

    while (!game.gameOver) {
        const state = game.getState();
        if (!state) break;

        const action = agent.getAction(state);
        game.step(action);

        // 记录每一帧
        frames.push({
            snake: JSON.parse(JSON.stringify(game.snake.body)),
            food: { ...game.food },
            score: game.score,
            steps: game.steps
        });
    }

    const fitness = calculateFitness(game.score, game.steps, game.deathCause !== null);

    parentPort.postMessage({
        type: 'complete',
        taskId,
        agentId: id,
        result: {
            score: game.score,
            steps: game.steps,
            fitness: fitness,
            died: game.deathCause !== null,
            cause: game.deathCause,
            frames: frames  // 返回游戏帧数据
        }
    });
}

// Worker 就绪
parentPort.postMessage({ type: 'ready' });
