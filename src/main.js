/**
 * ============================================
 * 游戏主入口 - ES6 模块化启动文件
 * ============================================
 */

import { GameEngine } from './core/GameEngine.js';
import { assetManager } from './utils/AssetManager.js';

function showLoadingScreen(canvas, progress, currentAsset) {
    const ctx = canvas.getContext('2d');
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;

    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#f1c40f';
    ctx.font = 'bold 36px Microsoft YaHei';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('杀戮尖塔', centerX, centerY - 80);

    ctx.fillStyle = '#ecf0f1';
    ctx.font = '18px Microsoft YaHei';
    ctx.fillText('正在加载资源...', centerX, centerY - 30);

    const barWidth = 400;
    const barHeight = 20;
    const barX = centerX - barWidth / 2;
    const barY = centerY + 10;

    ctx.fillStyle = '#2c3e50';
    ctx.fillRect(barX, barY, barWidth, barHeight);

    ctx.fillStyle = '#3498db';
    ctx.fillRect(barX, barY, barWidth * progress, barHeight);

    ctx.strokeStyle = '#ecf0f1';
    ctx.lineWidth = 2;
    ctx.strokeRect(barX, barY, barWidth, barHeight);

    ctx.fillStyle = '#95a5a6';
    ctx.font = '14px Microsoft YaHei';
    ctx.fillText(`${Math.round(progress * 100)}%`, centerX, centerY + 50);

    if (currentAsset) {
        ctx.fillStyle = '#7f8c8d';
        ctx.font = '12px Microsoft YaHei';
        ctx.fillText(`加载中: ${currentAsset}`, centerX, centerY + 80);
    }
}

function showErrorScreen(canvas, message) {
    const ctx = canvas.getContext('2d');
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;

    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#e74c3c';
    ctx.font = 'bold 24px Microsoft YaHei';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('资源加载失败', centerX, centerY - 20);

    ctx.fillStyle = '#ecf0f1';
    ctx.font = '14px Microsoft YaHei';
    ctx.fillText(message, centerX, centerY + 20);
}

async function initGame() {
    console.log('=== 杀戮尖塔 - ES6 模块化版本 ===');
    console.log('正在初始化游戏引擎...');

    const canvas = document.getElementById('gameCanvas');
    if (!canvas) {
        console.error('错误：找不到 Canvas 元素 #gameCanvas');
        return;
    }

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    showLoadingScreen(canvas, 0, '准备加载...');

    try {
        await assetManager.loadAll((progress, currentAsset) => {
            showLoadingScreen(canvas, progress, currentAsset);
            console.log(`加载进度: ${Math.round(progress * 100)}% - ${currentAsset}`);
        });

        showLoadingScreen(canvas, 1, '加载完成！');

        await new Promise(resolve => setTimeout(resolve, 500));

        const game = new GameEngine(canvas);
        window.game = game;

        console.log('游戏引擎初始化完成！');
        console.log('提示：在控制台输入 window.game 可以访问游戏实例');
    } catch (error) {
        console.error('游戏初始化失败:', error);
        showErrorScreen(canvas, error.message);
    }
}

document.addEventListener('DOMContentLoaded', initGame);

window.addEventListener('error', (e) => {
    console.error('全局错误捕获:', e.error);
});

window.addEventListener('unhandledrejection', (e) => {
    console.error('未处理的 Promise 拒绝:', e.reason);
});
