/**
 * 适应度计算
 */
export class FitnessCalculator {
    constructor(options = {}) {
        this.foodWeight = options.foodWeight || 1000;
        this.stepWeight = options.stepWeight || 0.1;
        this.deathPenalty = options.deathPenalty || 50;
        this.survivalBonus = options.survivalBonus || 1;
    }

    calculate(score, steps, died) {
        let fitness = 0;
        fitness += Math.pow(score, 1.5) * this.foodWeight;
        fitness += steps * this.stepWeight;

        if (died) {
            if (score === 0) {
                fitness -= this.deathPenalty * 2;
            } else {
                fitness -= this.deathPenalty;
            }
        }

        fitness += steps * this.survivalBonus;
        return Math.max(0, fitness);
    }
}
