/**
 * ============================================
 * 游戏主入口 - ES6 模块化启动文件
 * ============================================
 */

import { GameEngine } from './core/GameEngine.js';

// 等待 DOM 加载完成
document.addEventListener('DOMContentLoaded', () => {
    console.log('=== 杀戮尖塔 - ES6 模块化版本 ===');
    console.log('正在初始化游戏引擎...');

    // 获取 Canvas 元素
    const canvas = document.getElementById('gameCanvas');
    if (!canvas) {
        console.error('错误：找不到 Canvas 元素 #gameCanvas');
        return;
    }

    // 创建游戏引擎实例
    const game = new GameEngine(canvas);

    // 将游戏实例挂载到 window，方便调试
    window.game = game;

    console.log('游戏引擎初始化完成！');
    console.log('提示：在控制台输入 window.game 可以访问游戏实例');
});

// 全局错误处理
window.addEventListener('error', (e) => {
    console.error('全局错误捕获:', e.error);
});

window.addEventListener('unhandledrejection', (e) => {
    console.error('未处理的 Promise 拒绝:', e.reason);
});
