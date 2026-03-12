/**
 * WebSocket 服务器 - 实时通信
 */
import { WebSocketServer as WS } from 'ws';

export class WebSocketServer {
    constructor(server) {
        this.wss = new WS({ server });
        this.clients = new Set();
        this.trainingEngine = null;

        this.wss.on('connection', (ws) => {
            this.clients.add(ws);
            console.log(`WebSocket 客户端连接，当前连接数: ${this.clients.size}`);

            // 发送当前状态
            if (this.trainingEngine) {
                this.sendToClient(ws, {
                    type: 'status',
                    data: this.trainingEngine.getStatus()
                });

                this.sendToClient(ws, {
                    type: 'worker_status',
                    data: this.trainingEngine.getWorkerStatuses()
                });
            }

            ws.on('message', (message) => {
                try {
                    const data = JSON.parse(message);
                    this.handleMessage(ws, data);
                } catch (error) {
                    console.error('WebSocket 消息解析错误:', error);
                }
            });

            ws.on('close', () => {
                this.clients.delete(ws);
                console.log(`WebSocket 客户端断开，当前连接数: ${this.clients.size}`);
            });

            ws.on('error', (error) => {
                console.error('WebSocket 错误:', error);
                this.clients.delete(ws);
            });
        });
    }

    /**
     * 设置训练引擎
     */
    setTrainingEngine(engine) {
        this.trainingEngine = engine;

        // 设置回调
        engine.onStatusUpdate = (status) => {
            this.broadcast({ type: 'status', data: status });
        };

        engine.onLog = (log) => {
            this.broadcast({ type: 'log', data: log });
        };

        engine.onProgress = (progress) => {
            this.broadcast({ type: 'progress', data: progress });
        };

        engine.onGenerationComplete = (result) => {
            this.broadcast({ type: 'generation_complete', data: result });
        };

        engine.onWorkerStatusChange = (workerId, status) => {
            this.broadcast({
                type: 'worker_status',
                data: engine.getWorkerStatuses()
            });
        };
    }

    /**
     * 处理客户端消息
     */
    async handleMessage(ws, data) {
        const { type, ...params } = data;

        if (!this.trainingEngine) {
            this.sendToClient(ws, { type: 'error', message: '训练引擎未初始化' });
            return;
        }

        switch (type) {
            case 'start':
                await this.trainingEngine.start(params.config || {});
                break;

            case 'pause':
                this.trainingEngine.pause();
                break;

            case 'resume':
                this.trainingEngine.resume();
                break;

            case 'stop':
                this.trainingEngine.stop();
                break;

            case 'reset':
                await this.trainingEngine.reset();
                break;

            case 'load_model':
                const success = await this.trainingEngine.loadModel(params.modelId);
                this.sendToClient(ws, {
                    type: 'load_model_result',
                    data: { success, modelId: params.modelId }
                });
                break;

            case 'save_model':
                const modelId = this.trainingEngine.saveModel();
                this.sendToClient(ws, {
                    type: 'save_model_result',
                    data: { success: !!modelId, modelId }
                });
                break;

            case 'get_status':
                this.sendToClient(ws, {
                    type: 'status',
                    data: this.trainingEngine.getStatus()
                });
                break;

            case 'get_worker_status':
                this.sendToClient(ws, {
                    type: 'worker_status',
                    data: this.trainingEngine.getWorkerStatuses()
                });
                break;

            case 'set_config':
                this.trainingEngine.setConfig(params.config);
                this.sendToClient(ws, {
                    type: 'config_updated',
                    data: this.trainingEngine.config
                });
                break;

            case 'get_demo':
                const demoData = this.trainingEngine.getDemoData();
                this.sendToClient(ws, {
                    type: 'demo_data',
                    data: demoData
                });
                break;

            default:
                console.log('未知消息类型:', type);
        }
    }

    /**
     * 发送消息给单个客户端
     */
    sendToClient(ws, data) {
        if (ws.readyState === 1) { // WebSocket.OPEN
            ws.send(JSON.stringify(data));
        }
    }

    /**
     * 广播消息给所有客户端
     */
    broadcast(data) {
        const message = JSON.stringify(data);
        for (const client of this.clients) {
            if (client.readyState === 1) { // WebSocket.OPEN
                client.send(message);
            }
        }
    }

    /**
     * 关闭服务器
     */
    close() {
        this.wss.close();
    }
}
