/**
 * 排行榜相关 API 路由
 */
import express from 'express';
import { addLeaderboardEntry, getLeaderboard } from '../database/db.js';

const router = express.Router();

/**
 * GET /api/leaderboard - 获取排行榜
 */
router.get('/', (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 10;
        const entries = getLeaderboard(limit);
        res.json({ success: true, leaderboard: entries });
    } catch (error) {
        console.error('获取排行榜失败:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * POST /api/leaderboard - 添加排行榜记录
 */
router.post('/', (req, res) => {
    try {
        const { generation, score, fitness, steps } = req.body;

        if (score === undefined) {
            return res.status(400).json({ success: false, message: '缺少分数参数' });
        }

        const id = addLeaderboardEntry({
            generation: generation || 0,
            score: score || 0,
            fitness: fitness || 0,
            steps: steps || 0
        });

        res.json({ success: true, id, message: '记录添加成功' });
    } catch (error) {
        console.error('添加排行榜记录失败:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

export default router;
