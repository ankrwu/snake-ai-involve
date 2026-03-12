/**
 * 遗传算法 - 选择、交叉、变异
 */
import { randomGaussian } from './math.js';

export class GeneticAlgorithm {
    constructor(options = {}) {
        this.mutationRate = options.mutationRate || 0.1;
        this.mutationStrength = options.mutationStrength || 0.5;
        this.eliteCount = options.eliteCount || 5;
        this.crossoverRate = options.crossoverRate || 0.7;
    }

    select(population) {
        const totalFitness = population.reduce((sum, ind) => sum + Math.max(0, ind.fitness), 0);

        if (totalFitness === 0) {
            return population[Math.floor(Math.random() * population.length)];
        }

        let random_value = Math.random() * totalFitness;
        let accumulated = 0;

        for (const individual of population) {
            accumulated += Math.max(0, individual.fitness);
            if (accumulated >= random_value) {
                return individual;
            }
        }

        return population[population.length - 1];
    }

    crossover(parent1Weights, parent2Weights) {
        if (Math.random() > this.crossoverRate) {
            return Math.random() < 0.5 ? [...parent1Weights] : [...parent2Weights];
        }

        const childWeights = [];
        const crossoverPoint = Math.floor(Math.random() * parent1Weights.length);

        for (let i = 0; i < parent1Weights.length; i++) {
            if (i < crossoverPoint) {
                childWeights.push(parent1Weights[i]);
            } else {
                childWeights.push(parent2Weights[i]);
            }
        }

        return childWeights;
    }

    mutate(weights) {
        return weights.map(w => {
            if (Math.random() < this.mutationRate) {
                return w + randomGaussian(0, this.mutationStrength);
            }
            return w;
        });
    }

    evolve(population, createIndividual) {
        const sorted = [...population].sort((a, b) => b.fitness - a.fitness);

        const newPopulation = [];

        // 精英保留
        for (let i = 0; i < this.eliteCount && i < sorted.length; i++) {
            const elite = createIndividual(sorted[i].network.getWeights());
            elite.fitness = 0;
            elite.isElite = true;
            newPopulation.push(elite);
        }

        // 生成剩余个体
        while (newPopulation.length < population.length) {
            const parent1 = this.select(sorted);
            const parent2 = this.select(sorted);

            const childWeights = this.crossover(
                parent1.network.getWeights(),
                parent2.network.getWeights()
            );

            const mutatedWeights = this.mutate(childWeights);

            const child = createIndividual(mutatedWeights);
            child.fitness = 0;
            child.parents = [parent1.id, parent2.id];
            newPopulation.push(child);
        }

        return newPopulation;
    }
}
