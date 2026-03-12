/**
 * 模型相关 API 路由
 */
import express from 'express';
import { saveModel, getModels, getModel, deleteModel, getBestModel } from '../database/db.js';

const router = express.Router();

/**
 * GET /api/models - 获取模型列表
 */
router.get('/', (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 20;
        const models = getModels(limit);
        res.json({ success: true, models });
    } catch (error) {
        console.error('获取模型列表失败:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /api/models/best - 获取最佳模型
 */
router.get('/best', (req, res) => {
    try {
        const model = getBestModel();
        if (model) {
            res.json({ success: true, model });
        } else {
            res.json({ success: false, message: '暂无保存的模型' });
        }
    } catch (error) {
        console.error('获取最佳模型失败:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /api/models/:id - 获取单个模型
 */
router.get('/:id', (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const model = getModel(id);

        if (model) {
            res.json({ success: true, model });
        } else {
            res.status(404).json({ success: false, message: '模型不存在' });
        }
    } catch (error) {
        console.error('获取模型失败:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * POST /api/models - 保存模型
 */
router.post('/', (req, res) => {
    try {
        const { generation, score, fitness, network, history, name } = req.body;

        if (!network) {
            return res.status(400).json({ success: false, message: '缺少网络参数' });
        }

        const id = saveModel({
            name: name || `Gen-${generation}`,
            generation: generation || 0,
            score: score || 0,
            fitness: fitness || 0,
            network,
            history: history || []
        });

        res.json({ success: true, id, message: '模型保存成功' });
    } catch (error) {
        console.error('保存模型失败:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * DELETE /api/models/:id - 删除模型
 */
router.delete('/:id', (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const deleted = deleteModel(id);

        if (deleted) {
            res.json({ success: true, message: '模型删除成功' });
        } else {
            res.status(404).json({ success: false, message: '模型不存在' });
        }
    } catch (error) {
        console.error('删除模型失败:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

export default router;
