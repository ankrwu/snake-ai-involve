# AI 贪吃蛇进化模拟器

使用神经进化算法训练 AI 玩贪吃蛇游戏的模拟器。通过多线程并行评估和遗传算法，让 AI 逐渐学会如何高效地玩贪吃蛇游戏。

## 功能特点

- **多线程训练**: 使用 Node.js Worker Threads 并行评估 Agent，充分利用多核 CPU
- **神经进化算法**: 通过遗传算法进化神经网络权重，无需反向传播
- **实时监控**: WebSocket 实时推送训练状态、日志和进度
- **可视化演示**: 观看历史最高分 AI 的游戏演示
- **模型持久化**: 保存/加载训练好的模型，支持排行榜功能
- **进化历史图表**: 直观展示训练过程中的进化趋势

## 技术栈

- **后端**: Node.js + Express + WebSocket
- **前端**: 原生 JavaScript + Canvas
- **数据库**: SQLite (better-sqlite3)
- **并发**: Worker Threads 多线程

## 快速开始

### 安装依赖

```bash
npm install
```

### 启动服务

```bash
npm start
```

访问 http://localhost:8888 即可看到训练界面。

## 配置说明

| 参数 | 默认值 | 说明 |
|------|--------|------|
| Worker 数量 | CPU 核心数 | 并行评估的线程数 (1-16) |
| 目标代数 | 1000 | 训练的目标进化代数 |
| 种群大小 | 100 | 每代的个体数量 |
| 网格大小 | 40x40 | 游戏场地尺寸 |
| 神经网络结构 | 28-16-4 | 输入层-隐藏层-输出层 |

## 项目结构

```
snake-evolution/
├── server/
│   ├── index.js                 # Express 服务入口
│   ├── websocket.js             # WebSocket 服务
│   ├── routes/                  # HTTP 路由
│   │   ├── models.js            # 模型 API
│   │   └── leaderboard.js       # 排行榜 API
│   ├── training/                # 训练核心模块
│   │   ├── training-engine.js   # 训练主控制器
│   │   ├── worker-pool.js       # Worker 池管理
│   │   ├── training-worker.js   # Worker 线程逻辑
│   │   ├── population.js        # 种群管理
│   │   ├── genetic-algorithm.js # 遗传算法
│   │   ├── fitness.js           # 适应度计算
│   │   ├── neural-network.js    # 神经网络
│   │   └── game-simulation.js   # 游戏模拟
│   └── database/
│       └── db.js                # SQLite 数据库
├── js/
│   ├── main.js                  # 客户端主程序
│   ├── ui/                      # UI 组件
│   │   ├── worker-status.js     # Worker 状态面板
│   │   └── log-panel.js         # 日志面板
│   └── utils/
│       └── math.js              # 数学工具
├── css/
│   └── style.css                # 样式文件
├── index.html                   # 主页面
└── package.json
```

## 神经网络输入

AI 通过以下 28 个输入感知游戏状态：

- **方向感知** (8): 8 个方向上到边界的距离
- **食物感知** (8): 8 个方向上到食物的距离
- **身体感知** (8): 8 个方向上到蛇身的最短距离
- **食物方向** (2): 食物相对于蛇头的方向 (x, y)
- **当前方向** (2): 蛇当前的移动方向

## 输出

神经网络输出 4 个值，对应 4 个移动方向：
- 上 (UP)
- 下 (DOWN)
- 左 (LEFT)
- 右 (RIGHT)

## 适应度计算

适应度由以下因素决定：

```
fitness = score * 1000 + steps * 0.1 + survival_bonus
```

- `score`: 吃到的食物数量
- `steps`: 存活步数
- `survival_bonus`: 存活奖励

## 遗传算法

- **选择**: 锦标赛选择
- **交叉**: 单点交叉
- **变异**: 高斯变异

## License

MIT
