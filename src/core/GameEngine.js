/**
 * ============================================
 * GameEngine - 游戏引擎核心
 * 完整的渲染和交互逻辑
 * ============================================
 */

import { CONFIG, UIState, NodeType, CardType, CardTarget, TurnPhase, sleep } from '../config/constants.js';
import { InputManager } from './InputManager.js';
import { FloatingText } from './FloatingText.js';
import { GameState } from '../systems/GameState.js';
import { Player } from '../entities/Player.js';
import { Enemy } from '../entities/Enemy.js';
import { Card } from '../cards/Card.js';
import { DeckManager } from '../systems/DeckManager.js';
import { VajraRelic, AnchorRelic } from '../systems/Relic.js';

export class GameEngine {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');

        // 初始化输入管理器
        this.input = new InputManager(canvas);

        // 初始化游戏状态
        this.gameState = null;
        this.uiState = UIState.BATTLE;

        // 视觉反馈
        this.floatingTexts = [];
        this.screenShake = 0;
        this.energyShake = 0;

        // UI 状态
        this.rewardGold = 0;
        this.rewardCards = [];
        this.isCardRewardSelected = false;
        this.rewardCardHovered = [false, false, false];

        // 遗物悬停
        this.relicIcons = [];
        this.hoveredRelicIndex = -1;

        // 篝火状态
        this.campfireRestHovered = false;
        this.campfireSearchHovered = false;
        this.campfireContinueHovered = false;
        this.campfireActionTaken = false;

        // 地图状态
        this.mapNodes = [];
        this.mapNodeHovered = [false, false];

        // 结束回合按钮
        this.endTurnButtonHovered = false;
        this.endTurnButtonRect = { x: 0, y: 0, width: 120, height: 40 };

        // 重新开始按钮
        this.restartButtonHovered = false;

        // ========== 拖拽出牌状态机 ==========
        this.dragState = {
            isDragging: false,
            draggedCard: null,
            dragOffsetX: 0,
            dragOffsetY: 0
        };

        // 瞄准的敌人
        this.aimedEnemy = null;

        // 初始化
        this.resize();
        window.addEventListener('resize', () => this.resize());
        this.initGame();

        // 启动游戏循环
        this.lastTime = 0;
        this.gameLoop = this.gameLoop.bind(this);
        requestAnimationFrame(this.gameLoop);
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        if (this.gameState) {
            this.syncEntityPositions();
        }
    }

    initGame() {
        console.log('=== 初始化游戏 ===');

        // 创建玩家
        const player = new Player('player', '勇者', 80);

        // 添加测试遗物
        player.relics.push(new VajraRelic());
        player.relics.push(new AnchorRelic());

        // 创建初始牌组
        const deckManager = new DeckManager();
        this.initStarterDeck(deckManager);

        // 创建游戏状态
        this.gameState = new GameState(player, deckManager);
        this.gameState.currentFloor = 1;
        this.gameState.maxFloor = 5;

        // 设置回调
        this.setupVisualFeedbackCallbacks();
        this.setupVictoryCallback();

        // 初始化战斗
        this.gameState.initBattle();
        this.syncEntityPositions();

        this.uiState = UIState.BATTLE;
        console.log('游戏初始化完成！');
    }

    initStarterDeck(deckManager) {
        // 初始攻击牌
        for (let i = 0; i < 5; i++) {
            deckManager.addCard(new Card(
                `strike_${i}`, '打击', 1, CardType.ATTACK, 'enemy', 6,
                '造成 6 点伤害'
            ));
        }
        // 初始防御牌
        for (let i = 0; i < 5; i++) {
            deckManager.addCard(new Card(
                `defend_${i}`, '防御', 1, CardType.SKILL, 'self', 5,
                '获得 5 点格挡'
            ));
        }
        deckManager.shuffleDrawPile();
    }

    setupVisualFeedbackCallbacks() {
        const player = this.gameState.player;
        player.onFloatingText = (text, color) => {
            this.addFloatingText(player.x + player.width / 2, player.y, text, color);
        };
        player.onScreenShake = (intensity) => {
            this.screenShake = intensity;
        };

        this.gameState.enemies.forEach(enemy => {
            enemy.onFloatingText = (text, color) => {
                this.addFloatingText(enemy.x + enemy.width / 2, enemy.y, text, color);
            };
        });
    }

    setupVictoryCallback() {
        this.gameState.onVictory = () => {
            this.handleVictory();
        };
    }

    addFloatingText(x, y, text, color) {
        this.floatingTexts.push(new FloatingText(x, y, text, color));
    }

    syncEntityPositions() {
        const player = this.gameState.player;
        const playerX = this.canvas.width / 2 - player.width / 2;
        const playerY = this.canvas.height - player.height - 50;
        player.setOriginalPosition(playerX, playerY);

        this.gameState.enemies.forEach((enemy, index) => {
            const enemyX = 300 + index * 200;
            const enemyY = 100;
            enemy.setOriginalPosition(enemyX, enemyY);
        });

        this.updateHandPositions();
    }

    updateHandPositions() {
        const hand = this.gameState.deckManager.hand;
        const cardWidth = 150;
        const cardHeight = 200;
        const spacing = 20;
        const totalWidth = hand.length * cardWidth + (hand.length - 1) * spacing;
        const startX = (this.canvas.width - totalWidth) / 2;
        const baseY = this.canvas.height - cardHeight - 20;

        hand.forEach((card, index) => {
            card.width = cardWidth;
            card.height = cardHeight;

            // 如果卡牌正在被拖拽，不更新目标位置（完全跟随鼠标）
            if (this.dragState.isDragging && this.dragState.draggedCard === card) {
                return;
            }

            card.targetX = startX + index * (cardWidth + spacing);

            // 如果卡牌被悬停且未在拖拽，使其上浮
            if (card.isHovered && !this.dragState.isDragging) {
                card.targetY = baseY - 20;
            } else {
                card.targetY = baseY;
            }
        });
    }

    // ==================== 游戏主循环 ====================
    gameLoop(timestamp) {
        const deltaTime = timestamp - this.lastTime;
        this.lastTime = timestamp;

        this.update(deltaTime);
        this.draw(this.ctx);

        requestAnimationFrame(this.gameLoop);
    }

    update(deltaTime) {
        // 处理不同 UI 状态的输入
        if (this.uiState === UIState.REWARD) {
            this.handleRewardScreenInput();
        } else if (this.uiState === UIState.CAMPFIRE) {
            this.handleCampfireInput();
        } else if (this.uiState === UIState.MAP) {
            this.handleMapInput();
        } else if (this.uiState === UIState.GAME_WIN) {
            if (this.input.isClicked && this.restartButtonHovered) {
                this.restartGame();
            }
        } else {
            // 战斗状态
            if (this.gameState.currentPhase === TurnPhase.PLAYER_TURN) {
                this.handleCardInteraction();
                this.checkEndTurnButtonHover();
                if (this.input.isClicked && this.endTurnButtonHovered) {
                    this.endPlayerTurn();
                }
                this.checkRelicHover();
            }
        }

        // 更新动画
        this.updateCardAnimations(deltaTime);
        this.updateEntityAnimations(deltaTime);
        this.updateVisualFeedback();

        this.input.update();
    }

    // ==================== 更新方法 ====================
    updateCardAnimations(deltaTime) {
        this.gameState.deckManager.hand.forEach(card => card.update(deltaTime));
    }

    updateEntityAnimations(deltaTime) {
        if (this.gameState.player) {
            this.gameState.player.update(deltaTime);
        }
        this.gameState.enemies.forEach(enemy => enemy.update(deltaTime));
    }

    updateVisualFeedback() {
        for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
            this.floatingTexts[i].update();
            if (this.floatingTexts[i].isExpired()) {
                this.floatingTexts.splice(i, 1);
            }
        }

        if (this.screenShake > 0) {
            this.screenShake *= 0.9;
            if (this.screenShake < 0.5) this.screenShake = 0;
        }

        if (this.energyShake > 0) {
            this.energyShake *= 0.9;
            if (this.energyShake < 0.5) this.energyShake = 0;
        }
    }

    // ==================== 渲染方法 ====================
    draw(ctx) {
        ctx.fillStyle = CONFIG.COLORS.BACKGROUND;
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        ctx.save();
        if (this.screenShake > 0) {
            const shakeX = (Math.random() - 0.5) * this.screenShake;
            const shakeY = (Math.random() - 0.5) * this.screenShake;
            ctx.translate(shakeX, shakeY);
        }

        if (this.uiState === UIState.BATTLE) {
            this.drawGameWorld(ctx);
            this.drawGameInfo(ctx);
        }

        this.floatingTexts.forEach(text => text.draw(ctx));
        ctx.restore();

        // 绘制 UI 覆盖层
        if (this.uiState === UIState.REWARD) {
            this.drawRewardScreen(ctx);
        } else if (this.uiState === UIState.CAMPFIRE) {
            this.drawCampfireScreen(ctx);
        } else if (this.uiState === UIState.MAP) {
            this.drawMapScreen(ctx);
        } else if (this.uiState === UIState.GAME_WIN) {
            this.drawGameWinScreen(ctx);
        }
    }

    drawGameWorld(ctx) {
        this.drawPlayer(ctx);
        this.gameState.enemies.forEach(enemy => this.drawEnemy(ctx, enemy));

        // 绘制瞄准线（如果正在拖拽攻击牌）
        if (this.dragState.isDragging && this.dragState.draggedCard) {
            const card = this.dragState.draggedCard;
            if (card.target === CardTarget.ENEMY) {
                this.drawAimLine(ctx);
            }
        }

        // 绘制手牌（使用专门的drawHand方法，确保拖拽卡牌在最上层）
        this.drawHand(ctx);
    }

    /**
     * 绘制手牌 - 确保拖拽的卡牌最后绘制（在最上层）
     */
    drawHand(ctx) {
        const hand = this.gameState.deckManager.hand;
        const player = this.gameState.player;

        // 分离拖拽卡牌和非拖拽卡牌
        const draggedCard = this.dragState.draggedCard;
        const normalCards = hand.filter(card => card !== draggedCard);

        // 先绘制普通卡牌
        normalCards.forEach(card => {
            const canPlay = player.energy >= card.cost;
            this.drawSingleCard(ctx, card, canPlay);
        });

        // 最后绘制拖拽的卡牌（在最上层）
        if (draggedCard && this.dragState.isDragging) {
            const canPlay = player.energy >= draggedCard.cost;
            this.drawSingleCard(ctx, draggedCard, canPlay);
        }
    }

    /**
     * 绘制瞄准线 - 从玩家中心到鼠标的贝塞尔曲线
     */
    drawAimLine(ctx) {
        const player = this.gameState.player;
        const startX = player.x + player.width / 2;
        const startY = player.y + player.height / 2;
        const endX = this.input.mouseX;
        const endY = this.input.mouseY;

        // 高亮被瞄准的敌人
        if (this.aimedEnemy) {
            ctx.save();
            ctx.strokeStyle = '#f1c40f';
            ctx.lineWidth = 4;
            ctx.shadowColor = '#f1c40f';
            ctx.shadowBlur = 20;
            ctx.strokeRect(
                this.aimedEnemy.x - 5,
                this.aimedEnemy.y - 5,
                this.aimedEnemy.width + 10,
                this.aimedEnemy.height + 10
            );
            ctx.restore();
        }

        // 绘制贝塞尔曲线瞄准线
        ctx.save();

        // 发光效果
        ctx.shadowColor = '#e74c3c';
        ctx.shadowBlur = 15;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;

        // 渐变线条
        const gradient = ctx.createLinearGradient(startX, startY, endX, endY);
        gradient.addColorStop(0, 'rgba(231, 76, 60, 0.8)');
        gradient.addColorStop(0.5, 'rgba(241, 196, 15, 0.9)');
        gradient.addColorStop(1, 'rgba(231, 76, 60, 0.4)');

        ctx.strokeStyle = gradient;
        ctx.lineWidth = 3;
        ctx.setLineDash([10, 5]);

        ctx.beginPath();
        ctx.moveTo(startX, startY);

        // 贝塞尔曲线控制点
        const controlX = (startX + endX) / 2;
        const controlY = startY - 100;

        ctx.quadraticCurveTo(controlX, controlY, endX, endY);
        ctx.stroke();

        // 绘制箭头
        const angle = Math.atan2(endY - controlY, endX - controlX);
        const arrowLength = 15;

        ctx.setLineDash([]);
        ctx.fillStyle = '#f1c40f';
        ctx.beginPath();
        ctx.moveTo(endX, endY);
        ctx.lineTo(
            endX - arrowLength * Math.cos(angle - Math.PI / 6),
            endY - arrowLength * Math.sin(angle - Math.PI / 6)
        );
        ctx.lineTo(
            endX - arrowLength * Math.cos(angle + Math.PI / 6),
            endY - arrowLength * Math.sin(angle + Math.PI / 6)
        );
        ctx.closePath();
        ctx.fill();

        ctx.restore();
    }

    drawPlayer(ctx) {
        const player = this.gameState.player;
        const x = player.x;
        const y = player.y;
        const w = player.width;
        const h = player.height;

        // 绘制玩家矩形
        ctx.fillStyle = '#3498db';
        ctx.fillRect(x, y, w, h);

        // 绘制边框
        ctx.strokeStyle = '#2980b9';
        ctx.lineWidth = 3;
        ctx.strokeRect(x, y, w, h);

        // 绘制名称
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 16px Microsoft YaHei';
        ctx.textAlign = 'center';
        ctx.fillText(player.name, x + w / 2, y + 25);

        // 绘制 HP
        const hpPercent = player.hp / player.maxHp;
        const hpColor = hpPercent > 0.5 ? '#27ae60' : (hpPercent > 0.25 ? '#f39c12' : '#e74c3c');
        ctx.fillStyle = hpColor;
        ctx.font = '14px Microsoft YaHei';
        ctx.fillText(`${player.hp}/${player.maxHp} HP`, x + w / 2, y + 50);

        // 绘制格挡
        if (player.block > 0) {
            ctx.fillStyle = '#3498db';
            ctx.font = 'bold 14px Microsoft YaHei';
            ctx.fillText(`${player.block} 格挡`, x + w / 2, y + 70);
        }

        // 绘制状态效果
        let statusY = y + 95;
        for (const [status, value] of Object.entries(player.statusEffects)) {
            if (value > 0) {
                ctx.fillStyle = this.getStatusColor(status);
                ctx.font = '12px Microsoft YaHei';
                ctx.fillText(`${status}: ${value}`, x + w / 2, statusY);
                statusY += 18;
            }
        }
    }

    drawEnemy(ctx, enemy) {
        if (enemy.isDead()) return;

        const x = enemy.x;
        const y = enemy.y;
        const w = enemy.width;
        const h = enemy.height;

        // 绘制敌人矩形
        ctx.fillStyle = '#e74c3c';
        ctx.fillRect(x, y, w, h);

        // 绘制边框
        ctx.strokeStyle = '#c0392b';
        ctx.lineWidth = 3;
        ctx.strokeRect(x, y, w, h);

        // 绘制名称
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 16px Microsoft YaHei';
        ctx.textAlign = 'center';
        ctx.fillText(enemy.name, x + w / 2, y + 25);

        // 绘制 HP
        ctx.fillStyle = '#ecf0f1';
        ctx.font = '14px Microsoft YaHei';
        ctx.fillText(`${enemy.hp}/${enemy.maxHp} HP`, x + w / 2, y + 50);

        // 绘制格挡
        if (enemy.block > 0) {
            ctx.fillStyle = '#3498db';
            ctx.font = 'bold 14px Microsoft YaHei';
            ctx.fillText(`${enemy.block} 格挡`, x + w / 2, y + 70);
        }

        // 绘制意图
        ctx.fillStyle = '#f1c40f';
        ctx.font = 'bold 14px Microsoft YaHei';
        ctx.fillText(enemy.intentDescription, x + w / 2, y + h - 20);
    }

    drawSingleCard(ctx, card, canPlay) {
        const x = card.x;
        const y = card.y;
        const w = card.width;
        const h = card.height;

        // 卡牌背景
        const isAttack = card.type === CardType.ATTACK;
        const bgColor = isAttack ? '#e74c3c' : (card.type === CardType.SKILL ? '#3498db' : '#9b59b6');
        ctx.fillStyle = bgColor;
        this.drawRoundedRect(ctx, x, y, w, h, 8);
        ctx.fill();

        // 卡牌边框
        ctx.strokeStyle = card.isHovered ? '#f1c40f' : '#ecf0f1';
        ctx.lineWidth = card.isHovered ? 3 : 2;
        this.drawRoundedRect(ctx, x, y, w, h, 8);
        ctx.stroke();

        // 能量消耗
        ctx.fillStyle = '#f1c40f';
        ctx.beginPath();
        ctx.arc(x + 20, y + 20, 15, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#2c3e50';
        ctx.font = 'bold 16px Microsoft YaHei';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(card.cost, x + 20, y + 20);

        // 卡牌名称
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 14px Microsoft YaHei';
        ctx.textBaseline = 'alphabetic';
        ctx.fillText(card.name, x + w / 2, y + 35);

        // 分隔线
        ctx.strokeStyle = 'rgba(255,255,255,0.3)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x + 10, y + 55);
        ctx.lineTo(x + w - 10, y + 55);
        ctx.stroke();

        // 描述
        ctx.fillStyle = '#ecf0f1';
        ctx.font = '11px Microsoft YaHei';
        ctx.fillText(card.description, x + w / 2, y + 75);

        // 消耗标识
        if (card.keywords && card.keywords.exhaust) {
            ctx.fillStyle = '#e74c3c';
            ctx.font = 'bold 12px Microsoft YaHei';
            ctx.fillText('(消耗)', x + w / 2, y + h - 25);
        }

        // 能量不足遮罩
        if (!canPlay) {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
            this.drawRoundedRect(ctx, x, y, w, h, 8);
            ctx.fill();
        }
    }

    drawGameInfo(ctx) {
        const player = this.gameState.player;
        const topBarHeight = 40;

        // 顶部栏背景
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(0, 0, this.canvas.width, topBarHeight);

        // 底部边框
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, topBarHeight);
        ctx.lineTo(this.canvas.width, topBarHeight);
        ctx.stroke();

        // 左侧：玩家名称和HP
        ctx.fillStyle = '#ecf0f1';
        ctx.font = 'bold 16px Microsoft YaHei';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(player.name, 15, topBarHeight / 2);

        const hpPercent = player.hp / player.maxHp;
        const hpColor = hpPercent > 0.5 ? '#27ae60' : (hpPercent > 0.25 ? '#f39c12' : '#e74c3c');
        ctx.fillStyle = hpColor;
        ctx.font = '12px Microsoft YaHei';
        ctx.fillText(`HP: ${player.hp}/${player.maxHp}`, 80, topBarHeight / 2);

        // 中间：金币和层数
        const centerX = this.canvas.width / 2;
        ctx.fillStyle = '#f1c40f';
        ctx.font = 'bold 14px Microsoft YaHei';
        ctx.textAlign = 'center';
        ctx.fillText(`💰 ${player.gold}`, centerX - 60, topBarHeight / 2);

        ctx.fillStyle = '#9b59b6';
        ctx.font = 'bold 14px Microsoft YaHei';
        ctx.fillText(`🏰 ${this.gameState.currentFloor}/${this.gameState.maxFloor}`, centerX + 60, topBarHeight / 2);

        // 右侧：遗物
        this.drawRelics(ctx, topBarHeight);

        // 能量球
        this.drawEnergyOrb(ctx);

        // 结束回合按钮
        this.drawEndTurnButton(ctx);

        // 回合阶段提示
        this.drawPhaseIndicator(ctx);

        ctx.textBaseline = 'alphabetic';
    }

    drawRelics(ctx, topBarHeight) {
        const player = this.gameState.player;
        if (!player.relics || player.relics.length === 0) return;

        const relicConfig = {
            'vajra': { color: '#e74c3c', char: '金', bgColor: '#c0392b' },
            'anchor': { color: '#3498db', char: '船', bgColor: '#2980b9' }
        };

        const iconSize = 28;
        const spacing = 8;
        const startX = this.canvas.width - 20 - (player.relics.length * (iconSize + spacing)) + spacing;
        const startY = (topBarHeight - iconSize) / 2;

        this.relicIcons = [];

        player.relics.forEach((relic, index) => {
            const x = startX + index * (iconSize + spacing);
            const y = startY;

            this.relicIcons.push({ x, y, width: iconSize, height: iconSize, relic });

            const config = relicConfig[relic.id] || { color: '#95a5a6', char: relic.name.charAt(0), bgColor: '#7f8c8d' };

            ctx.fillStyle = config.bgColor;
            this.drawRoundedRect(ctx, x, y, iconSize, iconSize, 4);
            ctx.fill();

            ctx.strokeStyle = this.hoveredRelicIndex === index ? '#f1c40f' : config.color;
            ctx.lineWidth = this.hoveredRelicIndex === index ? 3 : 2;
            this.drawRoundedRect(ctx, x, y, iconSize, iconSize, 4);
            ctx.stroke();

            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 14px Microsoft YaHei';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(config.char, x + iconSize / 2, y + iconSize / 2);
        });

        if (this.hoveredRelicIndex >= 0 && this.hoveredRelicIndex < this.relicIcons.length) {
            this.drawRelicTooltip(ctx, this.relicIcons[this.hoveredRelicIndex]);
        }
    }

    drawRelicTooltip(ctx, relicIcon) {
        const relic = relicIcon.relic;
        const tooltipPadding = 10;
        const tooltipWidth = 180;
        const lineHeight = 18;

        ctx.font = 'bold 14px Microsoft YaHei';
        const nameHeight = 20;
        ctx.font = '12px Microsoft YaHei';
        const descLines = Math.ceil(ctx.measureText(relic.description).width / (tooltipWidth - 2 * tooltipPadding));
        const descHeight = Math.max(lineHeight, descLines * lineHeight);
        const tooltipHeight = nameHeight + descHeight + 3 * tooltipPadding;

        let tooltipX = relicIcon.x + relicIcon.width / 2 - tooltipWidth / 2;
        let tooltipY = relicIcon.y + relicIcon.height + 5;

        if (tooltipX < 10) tooltipX = 10;
        if (tooltipX + tooltipWidth > this.canvas.width - 10) {
            tooltipX = this.canvas.width - tooltipWidth - 10;
        }
        if (tooltipY + tooltipHeight > this.canvas.height) {
            tooltipY = relicIcon.y - tooltipHeight - 5;
        }

        ctx.save();
        ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
        ctx.shadowBlur = 10;
        ctx.shadowOffsetX = 3;
        ctx.shadowOffsetY = 3;

        ctx.fillStyle = 'rgba(30, 30, 40, 0.95)';
        this.drawRoundedRect(ctx, tooltipX, tooltipY, tooltipWidth, tooltipHeight, 8);
        ctx.fill();
        ctx.restore();

        ctx.strokeStyle = '#f1c40f';
        ctx.lineWidth = 2;
        this.drawRoundedRect(ctx, tooltipX, tooltipY, tooltipWidth, tooltipHeight, 8);
        ctx.stroke();

        ctx.fillStyle = '#f1c40f';
        ctx.font = 'bold 14px Microsoft YaHei';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(relic.name, tooltipX + tooltipPadding, tooltipY + tooltipPadding);

        ctx.fillStyle = '#ecf0f1';
        ctx.font = '12px Microsoft YaHei';
        this.drawWrappedText(ctx, relic.description, tooltipX + tooltipWidth / 2, tooltipY + tooltipPadding + nameHeight + 5, tooltipWidth - 2 * tooltipPadding, lineHeight);

        ctx.textBaseline = 'alphabetic';
    }

    drawEnergyOrb(ctx) {
        const orbX = 80;
        const orbY = this.canvas.height - 100;
        const orbRadius = 35;

        const shakeX = this.energyShake > 0 ? (Math.random() - 0.5) * this.energyShake : 0;
        const shakeY = this.energyShake > 0 ? (Math.random() - 0.5) * this.energyShake : 0;

        ctx.fillStyle = '#f1c40f';
        ctx.beginPath();
        ctx.arc(orbX + shakeX, orbY + shakeY, orbRadius, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#f39c12';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(orbX + shakeX, orbY + shakeY, orbRadius, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = '#2c3e50';
        ctx.font = 'bold 24px Microsoft YaHei';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.gameState.player.energy, orbX + shakeX, orbY + shakeY);

        ctx.fillStyle = '#ecf0f1';
        ctx.font = '12px Microsoft YaHei';
        ctx.fillText('/3', orbX + shakeX + 20, orbY + shakeY + 10);
    }

    drawEndTurnButton(ctx) {
        if (this.gameState.currentPhase !== TurnPhase.PLAYER_TURN) return;

        const buttonX = this.canvas.width - 140;
        const buttonY = this.canvas.height - 150;
        const buttonW = 120;
        const buttonH = 40;

        this.endTurnButtonRect = { x: buttonX, y: buttonY, width: buttonW, height: buttonH };

        ctx.fillStyle = this.endTurnButtonHovered ? '#27ae60' : '#2ecc71';
        this.drawRoundedRect(ctx, buttonX, buttonY, buttonW, buttonH, 8);
        ctx.fill();

        ctx.strokeStyle = this.endTurnButtonHovered ? '#f1c40f' : '#27ae60';
        ctx.lineWidth = this.endTurnButtonHovered ? 3 : 2;
        this.drawRoundedRect(ctx, buttonX, buttonY, buttonW, buttonH, 8);
        ctx.stroke();

        ctx.fillStyle = '#fff';
        ctx.font = 'bold 16px Microsoft YaHei';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('结束回合', buttonX + buttonW / 2, buttonY + buttonH / 2);
    }

    drawPhaseIndicator(ctx) {
        const phaseText = this.gameState.currentPhase === TurnPhase.PLAYER_TURN ? '玩家回合' : '敌人回合';
        const phaseColor = this.gameState.currentPhase === TurnPhase.PLAYER_TURN ? '#2ecc71' : '#e74c3c';

        ctx.fillStyle = phaseColor;
        ctx.font = 'bold 18px Microsoft YaHei';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'alphabetic';
        ctx.fillText(phaseText, this.canvas.width / 2, this.canvas.height - 250);
    }

    drawRewardScreen(ctx) {
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;

        ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        ctx.fillStyle = '#f1c40f';
        ctx.font = 'bold 48px Microsoft YaHei';
        ctx.textAlign = 'center';
        ctx.fillText('战斗胜利！', centerX, centerY - 150);

        ctx.fillStyle = '#ecf0f1';
        ctx.font = '24px Microsoft YaHei';
        ctx.fillText(`获得 ${this.rewardGold} 金币`, centerX, centerY - 100);

        if (!this.isCardRewardSelected) {
            ctx.fillStyle = '#fff';
            ctx.font = '20px Microsoft YaHei';
            ctx.fillText('选择一张卡牌加入牌组：', centerX, centerY - 50);

            this.rewardCards.forEach((card, index) => {
                const cardX = centerX + (index - 1) * 180;
                const cardY = centerY;
                this.drawRewardCard(ctx, card, cardX, cardY, this.rewardCardHovered[index]);
            });
        } else {
            ctx.fillStyle = '#2ecc71';
            ctx.font = 'bold 24px Microsoft YaHei';
            ctx.fillText('✓ 已选择卡牌奖励', centerX, centerY);

            this.drawContinueButton(ctx, centerX, centerY + 100);
        }
    }

    drawRewardCard(ctx, card, centerX, centerY, isHovered) {
        const scale = isHovered ? 1.1 : 1.0;
        const w = 150 * scale;
        const h = 200 * scale;
        const x = centerX - w / 2;
        const y = centerY - h / 2;

        const isAttack = card.type === CardType.ATTACK;
        const bgColor = isAttack ? '#e74c3c' : (card.type === CardType.SKILL ? '#3498db' : '#9b59b6');

        ctx.fillStyle = bgColor;
        this.drawRoundedRect(ctx, x, y, w, h, 8);
        ctx.fill();

        ctx.strokeStyle = isHovered ? '#f1c40f' : '#ecf0f1';
        ctx.lineWidth = isHovered ? 4 : 2;
        this.drawRoundedRect(ctx, x, y, w, h, 8);
        ctx.stroke();

        ctx.fillStyle = '#f1c40f';
        ctx.beginPath();
        ctx.arc(x + 20, y + 20, 15, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#2c3e50';
        ctx.font = 'bold 16px Microsoft YaHei';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(card.cost, x + 20, y + 20);

        ctx.fillStyle = '#fff';
        ctx.font = 'bold 14px Microsoft YaHei';
        ctx.textBaseline = 'alphabetic';
        ctx.fillText(card.name, centerX, y + 35);

        ctx.fillStyle = '#ecf0f1';
        ctx.font = '11px Microsoft YaHei';
        ctx.fillText(card.description, centerX, y + 75);
    }

    drawContinueButton(ctx, centerX, y) {
        const w = 160;
        const h = 50;
        const x = centerX - w / 2;

        ctx.fillStyle = '#3498db';
        this.drawRoundedRect(ctx, x, y, w, h, 10);
        ctx.fill();

        ctx.strokeStyle = '#2980b9';
        ctx.lineWidth = 2;
        this.drawRoundedRect(ctx, x, y, w, h, 10);
        ctx.stroke();

        ctx.fillStyle = '#fff';
        ctx.font = 'bold 18px Microsoft YaHei';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('继续前进', centerX, y + h / 2);
    }

    drawCampfireScreen(ctx) {
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;

        const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, Math.max(this.canvas.width, this.canvas.height));
        gradient.addColorStop(0, 'rgba(230, 126, 34, 0.3)');
        gradient.addColorStop(0.5, 'rgba(211, 84, 0, 0.5)');
        gradient.addColorStop(1, 'rgba(44, 62, 80, 0.9)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        ctx.font = 'bold 120px Microsoft YaHei';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🔥', centerX, centerY - 120);

        ctx.fillStyle = '#f39c12';
        ctx.font = 'bold 36px Microsoft YaHei';
        ctx.fillText('篝火休息站', centerX, centerY - 20);

        ctx.fillStyle = '#ecf0f1';
        ctx.font = '18px Microsoft YaHei';
        ctx.fillText(`第 ${this.gameState.currentFloor} 层`, centerX, centerY + 20);

        if (!this.campfireActionTaken) {
            this.drawCampfireButton(ctx, centerX - 120, centerY + 80, '休息', '恢复 30% HP', this.campfireRestHovered, '#27ae60');
            this.drawCampfireButton(ctx, centerX + 120, centerY + 80, '搜寻', '获得 1 个遗物', this.campfireSearchHovered, '#3498db');
        } else {
            ctx.fillStyle = '#2ecc71';
            ctx.font = 'bold 24px Microsoft YaHei';
            ctx.fillText('✓ 已完成休息', centerX, centerY + 100);
            this.drawCampfireContinueButton(ctx, centerX, centerY + 160);
        }

        ctx.textBaseline = 'alphabetic';
    }

    drawCampfireButton(ctx, centerX, y, title, desc, isHovered, color) {
        const w = 180;
        const h = 80;
        const x = centerX - w / 2;

        ctx.fillStyle = isHovered ? this.darkenColor(color, 20) : color;
        this.drawRoundedRect(ctx, x, y, w, h, 10);
        ctx.fill();

        ctx.strokeStyle = isHovered ? '#f1c40f' : '#ecf0f1';
        ctx.lineWidth = isHovered ? 4 : 2;
        this.drawRoundedRect(ctx, x, y, w, h, 10);
        ctx.stroke();

        ctx.fillStyle = '#fff';
        ctx.font = 'bold 22px Microsoft YaHei';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(title, centerX, y + 25);

        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.font = '12px Microsoft YaHei';
        ctx.fillText(desc, centerX, y + 55);
    }

    drawCampfireContinueButton(ctx, centerX, y) {
        const w = 160;
        const h = 50;
        const x = centerX - w / 2;

        ctx.fillStyle = this.campfireContinueHovered ? '#c0392b' : '#e74c3c';
        this.drawRoundedRect(ctx, x, y, w, h, 10);
        ctx.fill();

        ctx.strokeStyle = this.campfireContinueHovered ? '#f1c40f' : '#ecf0f1';
        ctx.lineWidth = this.campfireContinueHovered ? 3 : 2;
        this.drawRoundedRect(ctx, x, y, w, h, 10);
        ctx.stroke();

        ctx.fillStyle = '#fff';
        ctx.font = 'bold 18px Microsoft YaHei';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('继续前进', centerX, y + h / 2);
    }

    drawMapScreen(ctx) {
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;

        ctx.fillStyle = 'rgba(20, 20, 30, 0.95)';
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        ctx.fillStyle = '#f1c40f';
        ctx.font = 'bold 48px Microsoft YaHei';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('选择你的路线', centerX, centerY - 150);

        ctx.fillStyle = '#95a5a6';
        ctx.font = '20px Microsoft YaHei';
        ctx.fillText(`第 ${this.gameState.currentFloor} 层`, centerX, centerY - 100);

        const nodeSpacing = 300;
        const nodeY = centerY;

        this.mapNodes.forEach((nodeType, index) => {
            const nodeX = centerX + (index === 0 ? -1 : 1) * (nodeSpacing / 2);
            this.drawMapNode(ctx, nodeX, nodeY, nodeType, index);
        });

        ctx.fillStyle = '#7f8c8d';
        ctx.font = '16px Microsoft YaHei';
        ctx.fillText('点击选择一个节点继续前进', centerX, centerY + 180);

        ctx.textBaseline = 'alphabetic';
    }

    drawMapNode(ctx, x, y, nodeType, index) {
        const isHovered = this.mapNodeHovered[index];
        const nodeSize = isHovered ? 140 : 120;

        const nodeConfig = {
            [NodeType.BATTLE]: { icon: '⚔️', name: '普通战斗', color: '#e74c3c', desc: '标准敌人' },
            [NodeType.ELITE]: { icon: '👹', name: '精英战斗', color: '#9b59b6', desc: '强敌+遗物' },
            [NodeType.CAMPFIRE]: { icon: '🔥', name: '篝火', color: '#e67e22', desc: '休息恢复' }
        };

        const config = nodeConfig[nodeType];

        ctx.fillStyle = config.color;
        ctx.beginPath();
        ctx.arc(x, y, nodeSize / 2, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = isHovered ? '#f1c40f' : '#ecf0f1';
        ctx.lineWidth = isHovered ? 6 : 3;
        ctx.beginPath();
        ctx.arc(x, y, nodeSize / 2, 0, Math.PI * 2);
        ctx.stroke();

        ctx.font = 'bold 48px Microsoft YaHei';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(config.icon, x, y - 10);

        ctx.fillStyle = '#fff';
        ctx.font = 'bold 18px Microsoft YaHei';
        ctx.fillText(config.name, x, y + 35);

        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.font = '12px Microsoft YaHei';
        ctx.fillText(config.desc, x, y + 55);

        if (isHovered) {
            ctx.shadowColor = config.color;
            ctx.shadowBlur = 30;
            ctx.beginPath();
            ctx.arc(x, y, nodeSize / 2, 0, Math.PI * 2);
            ctx.stroke();
            ctx.shadowBlur = 0;
        }
    }

    drawGameWinScreen(ctx) {
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;

        ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        ctx.fillStyle = '#f1c40f';
        ctx.font = 'bold 64px Microsoft YaHei';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🎉 恭喜通关！', centerX, centerY - 100);

        ctx.fillStyle = '#ecf0f1';
        ctx.font = '24px Microsoft YaHei';
        ctx.fillText('你击败了所有敌人，完成了冒险！', centerX, centerY - 20);

        ctx.fillStyle = '#f1c40f';
        ctx.font = '20px Microsoft YaHei';
        ctx.fillText(`最终金币: ${this.gameState.player.gold}`, centerX, centerY + 30);
        ctx.fillText(`遗物数量: ${this.gameState.player.relics.length}`, centerX, centerY + 60);

        const buttonY = centerY + 120;
        const buttonW = 200;
        const buttonH = 50;
        const buttonX = centerX - buttonW / 2;

        this.restartButtonHovered = this.isMouseOver(this.input.mouseX, this.input.mouseY, {
            x: buttonX, y: buttonY, width: buttonW, height: buttonH
        });

        ctx.fillStyle = this.restartButtonHovered ? '#27ae60' : '#2ecc71';
        this.drawRoundedRect(ctx, buttonX, buttonY, buttonW, buttonH, 10);
        ctx.fill();

        ctx.strokeStyle = this.restartButtonHovered ? '#f1c40f' : '#27ae60';
        ctx.lineWidth = this.restartButtonHovered ? 3 : 2;
        this.drawRoundedRect(ctx, buttonX, buttonY, buttonW, buttonH, 10);
        ctx.stroke();

        ctx.fillStyle = '#fff';
        ctx.font = 'bold 20px Microsoft YaHei';
        ctx.fillText('重新开始', centerX, buttonY + buttonH / 2);
    }

    // ==================== 交互处理方法 ====================
    handleCardInteraction() {
        const hand = this.gameState.deckManager.hand;
        const player = this.gameState.player;

        // 如果正在拖拽卡牌
        if (this.dragState.isDragging) {
            const draggedCard = this.dragState.draggedCard;

            // 让拖拽的卡牌跟随鼠标（减去偏移量）
            draggedCard.x = this.input.mouseX - this.dragState.dragOffsetX;
            draggedCard.y = this.input.mouseY - this.dragState.dragOffsetY;
            draggedCard.targetX = draggedCard.x;
            draggedCard.targetY = draggedCard.y;

            // 检测瞄准的敌人（用于瞄准线和高亮）
            this.aimedEnemy = this.getEnemyUnderMouse();

            // 当鼠标释放时，处理出牌
            if (!this.input.isMouseDown) {
                this.releaseDraggedCard();
            }
            return;
        }

        // 未拖拽状态：检测悬停和开始拖拽
        // 重置所有卡牌的悬停状态
        hand.forEach(card => card.isHovered = false);

        // 从后往前遍历手牌（最上面的先检测）
        for (let i = hand.length - 1; i >= 0; i--) {
            const card = hand[i];
            const isHovered = this.isMouseOver(this.input.mouseX, this.input.mouseY, {
                x: card.x, y: card.y, width: card.width, height: card.height
            });

            if (isHovered) {
                card.isHovered = true;

                // 按下鼠标时开始拖拽
                if (this.input.isMouseDown && !this.dragState.isDragging) {
                    const canPlay = player.energy >= card.cost;
                    if (!canPlay) {
                        this.energyShake = 10;
                        break; // 能量不足时停止遍历，不穿透选中底下的卡牌
                    }

                    // 开始拖拽
                    this.dragState.isDragging = true;
                    this.dragState.draggedCard = card;
                    this.dragState.dragOffsetX = this.input.mouseX - card.x;
                    this.dragState.dragOffsetY = this.input.mouseY - card.y;
                    card.isSelected = true;
                }
                break; // 只悬停最上面的一张
            }
        }

        // 未拖拽时更新手牌位置，触发悬浮动画
        if (!this.dragState.isDragging) {
            this.updateHandPositions();
        }
    }

    /**
     * 获取鼠标当前悬停的敌人
     * @returns {Enemy|null}
     */
    getEnemyUnderMouse() {
        for (const enemy of this.gameState.enemies) {
            if (enemy.isDead()) continue;
            if (this.isMouseOver(this.input.mouseX, this.input.mouseY, {
                x: enemy.x, y: enemy.y, width: enemy.width, height: enemy.height
            })) {
                return enemy;
            }
        }
        return null;
    }

    /**
     * 释放拖拽的卡牌，处理出牌逻辑
     */
    releaseDraggedCard() {
        const card = this.dragState.draggedCard;
        const player = this.gameState.player;

        // 设定出牌判定线（鼠标Y坐标必须高于此线才能出牌）
        const playThresholdY = this.canvas.height - 250;

        // 检查是否拖到了出牌区域
        if (this.input.mouseY < playThresholdY) {
            let target = null;
            let canPlay = true;

            // 根据卡牌目标类型确定目标
            if (card.target === CardTarget.ENEMY) {
                // 指向性攻击：必须有明确的瞄准目标，否则出牌失败
                target = this.aimedEnemy;
                if (!target) {
                    canPlay = false; // 没有瞄准敌人，取消出牌
                }
            } else if (card.target === CardTarget.ALL_ENEMIES) {
                target = null; // 全体攻击不需要特定目标
            } else if (card.target === CardTarget.SELF) {
                target = player;
            }

            // 执行出牌
            if (canPlay && this.gameState.playCard(card, target)) {
                this.updateHandPositions();
            }
        }

        // 重置拖拽状态
        card.isSelected = false;
        this.dragState.isDragging = false;
        this.dragState.draggedCard = null;
        this.aimedEnemy = null;

        // 无论出牌成功与否，都让卡牌归位
        this.updateHandPositions();
    }

    handleRewardScreenInput() {
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;

        if (!this.isCardRewardSelected) {
            this.rewardCards.forEach((card, index) => {
                const cardX = centerX + (index - 1) * 180;
                const cardY = centerY;

                this.rewardCardHovered[index] = this.isMouseOver(this.input.mouseX, this.input.mouseY, {
                    x: cardX - 75, y: cardY - 100, width: 150, height: 200
                });

                if (this.input.isClicked && this.rewardCardHovered[index]) {
                    this.selectRewardCard(card, index);
                }
            });
        } else {
            const buttonY = centerY + 100;
            const buttonW = 160;
            const buttonH = 50;
            const buttonX = centerX - buttonW / 2;

            const continueHovered = this.isMouseOver(this.input.mouseX, this.input.mouseY, {
                x: buttonX, y: buttonY, width: buttonW, height: buttonH
            });

            if (this.input.isClicked && continueHovered) {
                this.continueToNextBattle();
            }
        }
    }

    handleCampfireInput() {
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;

        if (!this.campfireActionTaken) {
            const restButtonRect = { x: centerX - 120 - 90, y: centerY + 80, width: 180, height: 80 };
            this.campfireRestHovered = this.isMouseOver(this.input.mouseX, this.input.mouseY, restButtonRect);

            const searchButtonRect = { x: centerX + 120 - 90, y: centerY + 80, width: 180, height: 80 };
            this.campfireSearchHovered = this.isMouseOver(this.input.mouseX, this.input.mouseY, searchButtonRect);

            if (this.input.isClicked && this.campfireRestHovered) {
                this.doCampfireRest();
            }

            if (this.input.isClicked && this.campfireSearchHovered) {
                this.doCampfireSearch();
            }
        } else {
            const continueButtonRect = { x: centerX - 80, y: centerY + 160, width: 160, height: 50 };
            this.campfireContinueHovered = this.isMouseOver(this.input.mouseX, this.input.mouseY, continueButtonRect);

            if (this.input.isClicked && this.campfireContinueHovered) {
                this.continueToNextBattle();
            }
        }
    }

    handleMapInput() {
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;
        const nodeSpacing = 300;
        const nodeSize = 120;

        this.mapNodes.forEach((nodeType, index) => {
            const nodeX = centerX + (index === 0 ? -1 : 1) * (nodeSpacing / 2);

            const dx = this.input.mouseX - nodeX;
            const dy = this.input.mouseY - centerY;
            const distance = Math.sqrt(dx * dx + dy * dy);

            this.mapNodeHovered[index] = distance <= nodeSize / 2;

            if (this.input.isClicked && this.mapNodeHovered[index]) {
                this.selectMapNode(index);
            }
        });
    }

    checkEndTurnButtonHover() {
        this.endTurnButtonHovered = this.isMouseOver(
            this.input.mouseX,
            this.input.mouseY,
            this.endTurnButtonRect
        );
    }

    checkRelicHover() {
        this.hoveredRelicIndex = -1;
        for (let i = 0; i < this.relicIcons.length; i++) {
            const icon = this.relicIcons[i];
            if (this.isMouseOver(this.input.mouseX, this.input.mouseY, icon)) {
                this.hoveredRelicIndex = i;
                break;
            }
        }
    }

    // ==================== 游戏逻辑方法 ====================
    endPlayerTurn() {
        this.gameState.endPlayerTurn();
    }

    handleVictory() {
        console.log('=== 处理胜利 ===');
        this.rewardGold = 10 + Math.floor(Math.random() * 10);
        this.gameState.player.gainGold(this.rewardGold);
        this.generateRewardCards();
        this.uiState = UIState.REWARD;
    }

    generateRewardCards() {
        const cardTemplates = [
            { name: '重击', cost: 2, type: CardType.ATTACK, value: 14, desc: '造成 14 点伤害' },
            { name: '铁布衫', cost: 1, type: CardType.SKILL, value: 8, desc: '获得 8 点格挡' },
            { name: '剑气', cost: 1, type: CardType.ATTACK, value: 8, desc: '造成 8 点伤害，抽 1 张牌', effects: [{ type: 'draw', value: 1 }] },
            { name: '怒吼', cost: 0, type: CardType.SKILL, value: 0, desc: '获得 2 层力量', effects: [{ type: 'apply_status', status: 'strength', value: 2 }] },
            { name: '双重打击', cost: 1, type: CardType.ATTACK, value: 5, desc: '造成 5 点伤害 2 次' }
        ];

        this.rewardCards = [];
        for (let i = 0; i < 3; i++) {
            const template = cardTemplates[Math.floor(Math.random() * cardTemplates.length)];
            this.rewardCards.push(new Card(
                `reward_${i}`,
                template.name,
                template.cost,
                template.type,
                'enemy',
                template.value,
                template.desc,
                template.effects || []
            ));
        }

        this.isCardRewardSelected = false;
        this.rewardCardHovered = [false, false, false];
    }

    selectRewardCard(card, index) {
        console.log(`选择奖励卡牌: ${card.name}`);
        this.gameState.deckManager.addCard(card.clone());
        this.isCardRewardSelected = true;
    }

    continueToNextBattle() {
        console.log('准备进入下一房间');
        this.gameState.currentFloor++;

        if (this.gameState.currentFloor > this.gameState.maxFloor) {
            console.log('=== 恭喜通关！===');
            this.uiState = UIState.GAME_WIN;
            return;
        }

        this.uiState = UIState.MAP;
        this.generateMapNodes();
    }

    generateMapNodes() {
        const nodeTypes = [
            { type: NodeType.BATTLE, weight: 50 },
            { type: NodeType.ELITE, weight: 25 },
            { type: NodeType.CAMPFIRE, weight: 25 }
        ];

        this.mapNodes = [];
        for (let i = 0; i < 2; i++) {
            const random = Math.random() * 100;
            let cumulativeWeight = 0;
            let selectedType = NodeType.BATTLE;

            for (const node of nodeTypes) {
                cumulativeWeight += node.weight;
                if (random < cumulativeWeight) {
                    selectedType = node.type;
                    break;
                }
            }
            this.mapNodes.push(selectedType);
        }

        this.mapNodeHovered = [false, false];
    }

    selectMapNode(index) {
        const selectedNode = this.mapNodes[index];
        this.rewardGold = 0;
        this.rewardCards = [];
        this.isCardRewardSelected = false;
        this.rewardCardHovered = [false, false, false];
        this.floatingTexts = [];

        switch (selectedNode) {
            case NodeType.BATTLE:
            case NodeType.ELITE:
                this.uiState = UIState.BATTLE;
                this.gameState.initBattle();
                this.syncEntityPositions();
                this.setupVisualFeedbackCallbacks();
                this.setupVictoryCallback();
                break;
            case NodeType.CAMPFIRE:
                this.uiState = UIState.CAMPFIRE;
                this.campfireRestHovered = false;
                this.campfireSearchHovered = false;
                this.campfireContinueHovered = false;
                this.campfireActionTaken = false;
                break;
        }
    }

    doCampfireRest() {
        const player = this.gameState.player;
        const healAmount = Math.floor(player.maxHp * 0.3);
        player.heal(healAmount);
        this.campfireActionTaken = true;
    }

    doCampfireSearch() {
        const player = this.gameState.player;
        const relics = [new VajraRelic(), new AnchorRelic()];
        const randomRelic = relics[Math.floor(Math.random() * relics.length)];
        player.relics.push(randomRelic);
        this.campfireActionTaken = true;
    }

    restartGame() {
        console.log('=== 重新开始游戏 ===');
        this.gameState = null;
        this.uiState = UIState.BATTLE;
        this.rewardGold = 0;
        this.rewardCards = [];
        this.isCardRewardSelected = false;
        this.floatingTexts = [];
        this.initGame();
    }

    // ==================== 辅助方法 ====================
    isMouseOver(mx, my, rect) {
        return mx >= rect.x && mx <= rect.x + rect.width &&
               my >= rect.y && my <= rect.y + rect.height;
    }

    drawRoundedRect(ctx, x, y, width, height, radius) {
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + width - radius, y);
        ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
        ctx.lineTo(x + width, y + height - radius);
        ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
        ctx.lineTo(x + radius, y + height);
        ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.closePath();
    }

    drawWrappedText(ctx, text, x, y, maxWidth, lineHeight) {
        const words = text.split('');
        let line = '';
        let currentY = y;

        for (let i = 0; i < words.length; i++) {
            const testLine = line + words[i];
            const metrics = ctx.measureText(testLine);
            if (metrics.width > maxWidth && i > 0) {
                ctx.fillText(line, x, currentY);
                line = words[i];
                currentY += lineHeight;
            } else {
                line = testLine;
            }
        }
        ctx.fillText(line, x, currentY);
    }

    darkenColor(color, percent) {
        const num = parseInt(color.replace('#', ''), 16);
        const amt = Math.round(2.55 * percent);
        const R = Math.max((num >> 16) - amt, 0);
        const G = Math.max((num >> 8 & 0x00FF) - amt, 0);
        const B = Math.max((num & 0x0000FF) - amt, 0);
        return `#${(0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1)}`;
    }

    getStatusColor(status) {
        const colors = {
            strength: '#e74c3c',
            vulnerable: '#f39c12',
            weak: '#9b59b6',
            dexterity: '#3498db',
            frail: '#95a5a6',
            retain_block: '#1abc9c'
        };
        return colors[status] || '#ecf0f1';
    }
}
