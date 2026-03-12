/**
 * 种群管理 - 管理进化过程中的种群
 */
import { Agent } from './agent.js';
import { NeuralNetwork } from './neural-network.js';
import { GeneticAlgorithm } from './genetic-algorithm.js';
import { FitnessCalculator } from './fitness.js';

export class Population {
    constructor(options = {}) {
        this.size = options.size || 100;
        this.inputSize = options.inputSize || 28;
        this.hiddenSize = options.hiddenSize || 16;
        this.outputSize = options.outputSize || 4;

        this.generation = 0;
        this.agents = [];
        this.bestAgent = null;
        this.bestFitness = 0;
        this.bestScore = 0;
        this.history = [];

        this.ga = new GeneticAlgorithm({
            mutationRate: options.mutationRate || 0.1,
            mutationStrength: options.mutationStrength || 0.5,
            eliteCount: Math.max(1, Math.floor(this.size * 0.05)),
            crossoverRate: options.crossoverRate || 0.7
        });

        this.fitnessCalculator = new FitnessCalculator({
            foodWeight: options.foodWeight || 1000,
            stepWeight: options.stepWeight || 0.1,
            deathPenalty: options.deathPenalty || 50
        });

        this.idCounter = 0;
    }

    initialize() {
        this.agents = [];
        for (let i = 0; i < this.size; i++) {
            this.agents.push(Agent.createRandom(
                this.idCounter++,
                this.inputSize,
                this.hiddenSize,
                this.outputSize
            ));
        }
        this.generation = 1;
        return this.agents;
    }

    updateAgentResult(agentId, result) {
        const agent = this.agents.find(a => a.id === agentId);
        if (agent) {
            agent.score = result.score;
            agent.steps = result.steps;
            agent.fitness = this.fitnessCalculator.calculate(result.score, result.steps, result.died);
        }
    }

    evolve() {
        const stats = this.getStats();
        this.history.push({
            generation: this.generation,
            ...stats
        });

        const currentBest = this.agents.reduce((best, agent) =>
            agent.fitness > best.fitness ? agent : best
        );

        if (!this.bestAgent || currentBest.fitness > this.bestFitness) {
            this.bestAgent = currentBest.network.clone();
            this.bestFitness = currentBest.fitness;
            this.bestScore = currentBest.score;
        }

        this.agents = this.ga.evolve(this.agents, (weights) => {
            return Agent.fromWeights(
                this.idCounter++,
                weights,
                [this.inputSize, this.hiddenSize, this.outputSize]
            );
        });

        this.generation++;

        return {
            generation: this.generation,
            stats,
            bestFitness: this.bestFitness,
            bestScore: this.bestScore
        };
    }

    getStats() {
        const fitnesses = this.agents.map(a => a.fitness);
        const scores = this.agents.map(a => a.score);

        return {
            avgFitness: fitnesses.reduce((a, b) => a + b, 0) / fitnesses.length,
            maxFitness: Math.max(...fitnesses),
            minFitness: Math.min(...fitnesses),
            avgScore: scores.reduce((a, b) => a + b, 0) / scores.length,
            maxScore: Math.max(...scores),
            minScore: Math.min(...scores)
        };
    }

    serializeBest() {
        if (!this.bestAgent) return null;

        return {
            generation: this.generation,
            fitness: this.bestFitness,
            score: this.bestScore,
            network: this.bestAgent.toJSON(),
            history: this.history
        };
    }

    loadModel(modelData) {
        this.bestAgent = NeuralNetwork.fromJSON(modelData.network);
        this.bestFitness = modelData.fitness;
        this.bestScore = modelData.score;
        this.generation = modelData.generation;
        this.history = modelData.history || [];
    }

    getState() {
        return {
            generation: this.generation,
            bestFitness: this.bestFitness,
            bestScore: this.bestScore,
            stats: this.getStats(),
            history: this.history.slice(-100)
        };
    }
}
