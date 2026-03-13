/**
 * SQLite 数据库操作
 */
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 数据库文件路径
const dbPath = path.join(__dirname, '../../data/snake_evolution.db');

// 确保数据目录存在
import fs from 'fs';
const dataDir = path.join(__dirname, '../../data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(dbPath);

// 创建表
db.exec(`
    -- 模型表
    CREATE TABLE IF NOT EXISTS models (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        generation INTEGER NOT NULL,
        score INTEGER NOT NULL,
        fitness REAL NOT NULL,
        network TEXT NOT NULL,
        history TEXT,
        seed INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 排行榜表
    CREATE TABLE IF NOT EXISTS leaderboard (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        generation INTEGER NOT NULL,
        score INTEGER NOT NULL,
        fitness REAL NOT NULL,
        steps INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 创建索引
    CREATE INDEX IF NOT EXISTS idx_models_created ON models(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_leaderboard_score ON leaderboard(score DESC);
    CREATE INDEX IF NOT EXISTS idx_models_score ON models(score DESC);
`);

// 迁移：为旧表添加 seed 字段（如果不存在）
try {
    db.exec(`ALTER TABLE models ADD COLUMN seed INTEGER`);
} catch (e) {
    // 字段已存在，忽略错误
}

/**
 * 保存模型
 */
export function saveModel(model) {
    const stmt = db.prepare(`
        INSERT INTO models (name, generation, score, fitness, network, history, seed)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
        `Gen-${model.generation}`,
        model.generation,
        model.score,
        model.fitness,
        JSON.stringify(model.network),
        JSON.stringify(model.history),
        model.seed || null
    );

    return result.lastInsertRowid;
}

/**
 * 获取所有模型
 */
export function getModels(limit = 20) {
    const stmt = db.prepare(`
        SELECT id, name, generation, score, fitness, created_at
        FROM models
        ORDER BY created_at DESC
        LIMIT ?
    `);

    return stmt.all(limit);
}

/**
 * 获取单个模型
 */
export function getModel(id) {
    const stmt = db.prepare(`
        SELECT * FROM models WHERE id = ?
    `);

    const model = stmt.get(id);
    if (model) {
        model.network = JSON.parse(model.network);
        model.history = model.history ? JSON.parse(model.history) : [];
    }

    return model;
}

/**
 * 删除模型
 */
export function deleteModel(id) {
    const stmt = db.prepare('DELETE FROM models WHERE id = ?');
    return stmt.run(id).changes > 0;
}

/**
 * 添加排行榜记录
 */
export function addLeaderboardEntry(entry) {
    const stmt = db.prepare(`
        INSERT INTO leaderboard (generation, score, fitness, steps)
        VALUES (?, ?, ?, ?)
    `);

    const result = stmt.run(
        entry.generation,
        entry.score,
        entry.fitness,
        entry.steps
    );

    return result.lastInsertRowid;
}

/**
 * 获取排行榜
 */
export function getLeaderboard(limit = 10) {
    const stmt = db.prepare(`
        SELECT * FROM leaderboard
        ORDER BY score DESC, fitness DESC
        LIMIT ?
    `);

    return stmt.all(limit);
}

/**
 * 获取最佳模型
 */
export function getBestModel() {
    const stmt = db.prepare(`
        SELECT * FROM models
        ORDER BY score DESC, fitness DESC
        LIMIT 1
    `);

    const model = stmt.get();
    if (model) {
        model.network = JSON.parse(model.network);
        model.history = model.history ? JSON.parse(model.history) : [];
    }

    return model;
}

export default db;
