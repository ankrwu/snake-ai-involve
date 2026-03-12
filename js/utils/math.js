/**
 * 数学工具函数
 */

/**
 * Sigmoid 激活函数
 */
export function sigmoid(x) {
    return 1 / (1 + Math.exp(-Math.max(-500, Math.min(500, x))));
}

/**
 * ReLU 激活函数
 */
export function relu(x) {
    return Math.max(0, x);
}

/**
 * Tanh 激活函数
 */
export function tanh(x) {
    return Math.tanh(x);
}

/**
 * 生成随机数（范围）
 */
export function random(min = 0, max = 1) {
    return Math.random() * (max - min) + min;
}

/**
 * 生成随机整数
 */
export function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * 生成高斯分布随机数
 */
export function randomGaussian(mean = 0, std = 1) {
    let u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    const n = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
    return n * std + mean;
}

/**
 * 数组随机打乱
 */
export function shuffle(array) {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

/**
 * Softmax 函数
 */
export function softmax(arr) {
    const max = Math.max(...arr);
    const exps = arr.map(x => Math.exp(x - max));
    const sum = exps.reduce((a, b) => a + b, 0);
    return exps.map(x => x / sum);
}

/**
 * 获取数组中最大值的索引
 */
export function argMax(arr) {
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
