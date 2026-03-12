/**
 * Express 服务器入口 - 集成训练引擎和 WebSocket
 */
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer } from 'http';

import modelsRouter from './routes/models.js';
import leaderboardRouter from './routes/leaderboard.js';
import { WebSocketServer } from './websocket.js';
import { TrainingEngine } from './training/training-engine.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8888;

// 创建 HTTP 服务器
const server = createServer(app);

// 中间件
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// 静态文件服务
app.use(express.static(path.join(__dirname, '../')));

// API 路由
app.use('/api/models', modelsRouter);
app.use('/api/leaderboard', leaderboardRouter);

// 健康检查
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 获取训练配置
app.get('/api/training/config', (req, res) => {
    if (trainingEngine) {
        res.json({ success: true, config: trainingEngine.config });
    } else {
        res.json({ success: false, message: '训练引擎未初始化' });
    }
});

// 设置训练配置
app.post('/api/training/config', (req, res) => {
    if (trainingEngine) {
        trainingEngine.setConfig(req.body);
        res.json({ success: true, config: trainingEngine.config });
    } else {
        res.json({ success: false, message: '训练引擎未初始化' });
    }
});

// 获取训练状态
app.get('/api/training/status', (req, res) => {
    if (trainingEngine) {
        res.json({ success: true, status: trainingEngine.getStatus() });
    } else {
        res.json({ success: false, message: '训练引擎未初始化' });
    }
});

// 开始训练
app.post('/api/training/start', async (req, res) => {
    if (trainingEngine) {
        try {
            await trainingEngine.start(req.body || {});
            res.json({ success: true, message: '训练已启动' });
        } catch (error) {
            res.json({ success: false, message: error.message });
        }
    } else {
        res.json({ success: false, message: '训练引擎未初始化' });
    }
});

// 暂停训练
app.post('/api/training/pause', (req, res) => {
    if (trainingEngine) {
        trainingEngine.pause();
        res.json({ success: true, message: '训练已暂停' });
    } else {
        res.json({ success: false, message: '训练引擎未初始化' });
    }
});

// 恢复训练
app.post('/api/training/resume', (req, res) => {
    if (trainingEngine) {
        trainingEngine.resume();
        res.json({ success: true, message: '训练已恢复' });
    } else {
        res.json({ success: false, message: '训练引擎未初始化' });
    }
});

// 停止训练
app.post('/api/training/stop', (req, res) => {
    if (trainingEngine) {
        trainingEngine.stop();
        res.json({ success: true, message: '训练已停止' });
    } else {
        res.json({ success: false, message: '训练引擎未初始化' });
    }
});

// 初始化 WebSocket 服务器
const wsServer = new WebSocketServer(server);

// 初始化训练引擎
const trainingEngine = new TrainingEngine();
wsServer.setTrainingEngine(trainingEngine);

// 启动服务器
server.listen(PORT, () => {
    console.log(`🐍 AI 贪吃蛇进化服务器运行在 http://localhost:${PORT}`);
    console.log(`📡 WebSocket 服务已启用`);
    console.log(`📊 API 端点:`);
    console.log(`   - GET  /api/models           - 获取模型列表`);
    console.log(`   - POST /api/models           - 保存模型`);
    console.log(`   - GET  /api/models/:id       - 获取单个模型`);
    console.log(`   - GET  /api/models/best      - 获取最佳模型`);
    console.log(`   - GET  /api/leaderboard      - 获取排行榜`);
    console.log(`   - POST /api/leaderboard      - 添加排行榜记录`);
    console.log(`   - GET  /api/training/config  - 获取训练配置`);
    console.log(`   - POST /api/training/config  - 设置训练配置`);
});

// 优雅关闭
process.on('SIGTERM', () => {
    console.log('收到 SIGTERM 信号，正在关闭...');
    trainingEngine.terminate();
    wsServer.close();
    server.close();
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('收到 SIGINT 信号，正在关闭...');
    trainingEngine.terminate();
    wsServer.close();
    server.close();
    process.exit(0);
});
