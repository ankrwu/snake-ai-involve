/**
 * 神经网络 - 简单的前馈神经网络
 */
import { sigmoid, randomGaussian, tanh } from './math.js';

export class NeuralNetwork {
    constructor(layers) {
        this.layers = layers;
        this.weights = [];
        this.biases = [];

        for (let i = 0; i < layers.length - 1; i++) {
            const scale = Math.sqrt(2 / (layers[i] + layers[i + 1]));
            this.weights.push(
                Array(layers[i]).fill(0).map(() =>
                    Array(layers[i + 1]).fill(0).map(() => randomGaussian(0, scale))
                )
            );
            this.biases.push(
                Array(layers[i + 1]).fill(0).map(() => randomGaussian(0, 0.1))
            );
        }
    }

    static fromWeights(layers, weights) {
        const nn = new NeuralNetwork(layers);
        nn.setWeights(weights);
        return nn;
    }

    setWeights(weights) {
        let index = 0;
        for (let i = 0; i < this.weights.length; i++) {
            for (let j = 0; j < this.weights[i].length; j++) {
                for (let k = 0; k < this.weights[i][j].length; k++) {
                    this.weights[i][j][k] = weights[index++];
                }
            }
        }
        for (let i = 0; i < this.biases.length; i++) {
            for (let j = 0; j < this.biases[i].length; j++) {
                this.biases[i][j] = weights[index++];
            }
        }
    }

    getWeights() {
        const weights = [];
        for (const layer of this.weights) {
            for (const neuron of layer) {
                weights.push(...neuron);
            }
        }
        for (const bias of this.biases) {
            weights.push(...bias);
        }
        return weights;
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

    clone() {
        const nn = new NeuralNetwork(this.layers);
        nn.setWeights(this.getWeights());
        return nn;
    }

    toJSON() {
        return {
            layers: this.layers,
            weights: this.weights,
            biases: this.biases
        };
    }

    static fromJSON(json) {
        const nn = new NeuralNetwork(json.layers);
        nn.weights = json.weights;
        nn.biases = json.biases;
        return nn;
    }
}
