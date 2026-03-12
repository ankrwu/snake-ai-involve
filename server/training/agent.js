/**
 * AI 代理 - 连接神经网络和游戏
 */
import { NeuralNetwork } from './neural-network.js';
import { argMax } from './math.js';

export class Agent {
    constructor(network, id = 0) {
        this.network = network;
        this.id = id;
        this.fitness = 0;
        this.score = 0;
        this.steps = 0;
    }

    getAction(state) {
        const input = this.buildInput(state);
        const output = this.network.forward(input);
        const actionIndex = argMax(output);
        const actions = ['up', 'down', 'left', 'right'];
        return actions[actionIndex];
    }

    buildInput(state) {
        const input = [];
        input.push(...state.direction);
        input.push(...state.foodDir);
        input.push(...state.obstacles);
        input.push(...state.bodyDistances);
        return input;
    }

    static createRandom(id, inputSize = 28, hiddenSize = 16, outputSize = 4) {
        const network = new NeuralNetwork([inputSize, hiddenSize, outputSize]);
        return new Agent(network, id);
    }

    static fromWeights(id, weights, layers = [28, 16, 4]) {
        const network = NeuralNetwork.fromWeights(layers, weights);
        return new Agent(network, id);
    }

    toJSON() {
        return {
            id: this.id,
            fitness: this.fitness,
            score: this.score,
            steps: this.steps,
            network: this.network.toJSON()
        };
    }

    static fromJSON(json) {
        const network = NeuralNetwork.fromJSON(json.network);
        const agent = new Agent(network, json.id);
        agent.fitness = json.fitness || 0;
        agent.score = json.score || 0;
        agent.steps = json.steps || 0;
        return agent;
    }
}
