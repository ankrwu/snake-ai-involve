/**
 * 游戏模拟 - 无渲染版本，纯逻辑
 */

/**
 * 蛇类
 */
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

export class GameSimulation {
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

        return {
            direction,
            foodDir,
            obstacles,
            bodyDistances
        };
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
