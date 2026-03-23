/**
 * ============================================
 * GameEngine - 游戏引擎核心
 * 修复了实体与手牌重叠、血条显示不清晰的 Bug
 * ============================================
 */

import { CONFIG, UIState, NodeType, CardType, CardTarget, TurnPhase, sleep } from '../config/constants.js';
import { InputManager } from './InputManager.js';
import { FloatingText } from './FloatingText.js';
import { GameState } from '../systems/GameState.js';
import { Player } from '../entities/Player.js';
import { Card } from '../cards/Card.js';
import { DeckManager } from '../systems/DeckManager.js';
import { VajraRelic, AnchorRelic } from '../systems/Relic.js';
import { assetManager } from '../utils/AssetManager.js';
import { SaveManager } from '../systems/SaveManager.js';

export class GameEngine {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');

        this.input = new InputManager(canvas);

        this.gameState = null;
        this.uiState = UIState.MAIN_MENU;

        this.floatingTexts = [];
        this.screenShake = 0;
        this.energyShake = 0;

        this.rewardGold = 0;
        this.rewardCards = [];
        this.isCardRewardSelected = false;
        this.rewardCardHovered = [false, false, false];

        this.relicIcons = [];
        this.hoveredRelicIndex = -1;

        this.campfireRestHovered = false;
        this.campfireSearchHovered = false;
        this.campfireContinueHovered = false;
        this.campfireActionTaken = false;

        this.mapLayers = [];
        this.currentMapNode = null;
        this.mapNodePositions = [];

        this.endTurnButtonHovered = false;
        this.endTurnButtonRect = { x: 0, y: 0, width: 120, height: 40 };
        this.restartButtonHovered = false;

        this.dragState = {
            isDragging: false,
            draggedCard: null,
            dragOffsetX: 0,
            dragOffsetY: 0
        };

        this.aimedEnemy = null;

        this.shopItems = [];
        this.shopItemHovered = [];
        this.shopLeaveHovered = false;
        this.shopCardRemovalPrice = 75;

        this.removalDeckCards = [];
        this.removalCardHovered = [];
        this.removalBackHovered = false;

        this.mainMenuContinueHovered = false;
        this.mainMenuNewGameHovered = false;
        this.hasSaveData = SaveManager.hasSave();

        this.resize();
        window.addEventListener('resize', () => this.resize());

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
        const player = new Player('player', '勇者', 80);

        player.relics.push(new VajraRelic());
        player.relics.push(new AnchorRelic());

        const deckManager = new DeckManager();
        this.initStarterDeck(deckManager);

        this.gameState = new GameState(player, deckManager);
        this.gameState.currentFloor = 1;
        this.gameState.maxFloor = 5;

        this.setupVisualFeedbackCallbacks();
        this.setupVictoryCallback();

        this.generateMapNodes();
        this.currentMapNode = null;
        this.uiState = UIState.MAP;
    }

    initStarterDeck(deckManager) {
        for (let i = 0; i < 5; i++) {
            deckManager.addCard(new Card(
                `strike_${i}`, '打击', 1, CardType.ATTACK, CardTarget.ENEMY, 6,
                '造成 6 点伤害'
            ));
        }
        for (let i = 0; i < 5; i++) {
            deckManager.addCard(new Card(
                `defend_${i}`, '防御', 1, CardType.SKILL, CardTarget.SELF, 5,
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
        
        // 修复1：将玩家固定在屏幕左侧中间偏上，彻底避开下方的卡牌区域
        const playerX = 150;
        const playerY = this.canvas.height / 2 - player.height / 2 - 50;
        player.setOriginalPosition(playerX, playerY);

        // 修复1：将敌人排布在屏幕右侧
        const startX = this.canvas.width / 2 + 100;
        this.gameState.enemies.forEach((enemy, index) => {
            const enemyX = startX + index * 180;
            const enemyY = this.canvas.height / 2 - enemy.height / 2 - 50;
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

            if (this.dragState.isDragging && this.dragState.draggedCard === card) {
                return;
            }

            card.targetX = startX + index * (cardWidth + spacing);

            if (card.isHovered && !this.dragState.isDragging) {
                card.targetY = baseY - 20;
            } else {
                card.targetY = baseY;
            }
        });
    }

    gameLoop(timestamp) {
        const deltaTime = timestamp - this.lastTime;
        this.lastTime = timestamp;

        this.update(deltaTime);
        this.draw(this.ctx);

        requestAnimationFrame(this.gameLoop);
    }

    update(deltaTime) {
        if (this.uiState === UIState.MAIN_MENU) {
            this.handleMainMenuInput();
        } else if (this.uiState === UIState.REWARD) {
            this.handleRewardScreenInput();
        } else if (this.uiState === UIState.CAMPFIRE) {
            this.handleCampfireInput();
        } else if (this.uiState === UIState.MAP) {
            this.handleMapInput();
        } else if (this.uiState === UIState.SHOP) {
            this.handleShopInput();
        } else if (this.uiState === UIState.CARD_REMOVAL) {
            this.handleCardRemovalInput();
        } else if (this.uiState === UIState.GAME_WIN) {
            if (this.input.isClicked && this.restartButtonHovered) {
                this.restartGame();
            }
        } else if (this.uiState === UIState.BATTLE) {
            if (this.gameState && this.gameState.currentPhase === TurnPhase.PLAYER_TURN) {
                this.handleCardInteraction();
                this.checkEndTurnButtonHover();
                if (this.input.isClicked && this.endTurnButtonHovered) {
                    this.endPlayerTurn();
                }
                this.checkRelicHover();
            }
        }

        if (this.gameState) {
            this.updateCardAnimations(deltaTime);
            this.updateEntityAnimations(deltaTime);
        }
        this.updateVisualFeedback();

        this.input.update();
    }

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

    draw(ctx) {
        const bgImage = assetManager.getImage('bg');
        if (bgImage) {
            ctx.drawImage(bgImage, 0, 0, this.canvas.width, this.canvas.height);
        } else {
            ctx.fillStyle = CONFIG.COLORS.BACKGROUND;
            ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        }

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

        if (this.uiState === UIState.MAIN_MENU) {
            this.drawMainMenu(ctx);
        } else if (this.uiState === UIState.REWARD) {
            this.drawRewardScreen(ctx);
        } else if (this.uiState === UIState.CAMPFIRE) {
            this.drawCampfireScreen(ctx);
        } else if (this.uiState === UIState.MAP) {
            this.drawMapScreen(ctx);
        } else if (this.uiState === UIState.SHOP) {
            this.drawShopScreen(ctx);
        } else if (this.uiState === UIState.CARD_REMOVAL) {
            this.drawCardRemovalScreen(ctx);
        } else if (this.uiState === UIState.GAME_WIN) {
            this.drawGameWinScreen(ctx);
        }
    }

    drawGameWorld(ctx) {
        this.drawPlayer(ctx);
        this.gameState.enemies.forEach(enemy => this.drawEnemy(ctx, enemy));

        if (this.dragState.isDragging && this.dragState.draggedCard) {
            const card = this.dragState.draggedCard;
            if (card.target === CardTarget.ENEMY) {
                this.drawAimLine(ctx);
            }
        }

        this.drawHand(ctx);
    }

    drawHand(ctx) {
        const hand = this.gameState.deckManager.hand;
        const player = this.gameState.player;

        const draggedCard = this.dragState.draggedCard;
        const normalCards = hand.filter(card => card !== draggedCard);

        normalCards.forEach(card => {
            const canPlay = player.energy >= card.cost;
            this.drawSingleCard(ctx, card, canPlay);
        });

        if (draggedCard && this.dragState.isDragging) {
            const canPlay = player.energy >= draggedCard.cost;
            this.drawSingleCard(ctx, draggedCard, canPlay);
        }
    }

    drawAimLine(ctx) {
        const player = this.gameState.player;
        const startX = player.x + player.width / 2;
        const startY = player.y + player.height / 2;
        const endX = this.input.mouseX;
        const endY = this.input.mouseY;

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

        ctx.save();
        ctx.shadowColor = '#e74c3c';
        ctx.shadowBlur = 15;

        const gradient = ctx.createLinearGradient(startX, startY, endX, endY);
        gradient.addColorStop(0, 'rgba(231, 76, 60, 0.8)');
        gradient.addColorStop(0.5, 'rgba(241, 196, 15, 0.9)');
        gradient.addColorStop(1, 'rgba(231, 76, 60, 0.4)');

        ctx.strokeStyle = gradient;
        ctx.lineWidth = 3;
        ctx.setLineDash([10, 5]);

        ctx.beginPath();
        ctx.moveTo(startX, startY);
        
        const controlX = (startX + endX) / 2;
        const controlY = startY - 100;
        ctx.quadraticCurveTo(controlX, controlY, endX, endY);
        ctx.stroke();

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

        const playerImage = assetManager.getImage('player');
        if (playerImage) {
            ctx.drawImage(playerImage, x, y, w, h);
        } else {
            ctx.fillStyle = '#3498db';
            ctx.fillRect(x, y, w, h);

            ctx.strokeStyle = '#2980b9';
            ctx.lineWidth = 3;
            ctx.strokeRect(x, y, w, h);
        }

        ctx.fillStyle = '#fff';
        ctx.font = 'bold 16px Microsoft YaHei';
        ctx.textAlign = 'center';
        ctx.fillText(player.name, x + w / 2, y + 25);

        const barWidth = w - 20;
        const barHeight = 16;
        const barX = x + 10;
        const barY = y + 40;

        ctx.fillStyle = '#2c3e50';
        ctx.fillRect(barX, barY, barWidth, barHeight);

        const hpPercent = player.hp / player.maxHp;
        const hpColor = hpPercent > 0.5 ? '#27ae60' : (hpPercent > 0.25 ? '#f39c12' : '#e74c3c');
        ctx.fillStyle = hpColor;
        ctx.fillRect(barX, barY, barWidth * hpPercent, barHeight);

        ctx.strokeStyle = '#ecf0f1';
        ctx.lineWidth = 1;
        ctx.strokeRect(barX, barY, barWidth, barHeight);

        ctx.save();
        ctx.shadowColor = '#000';
        ctx.shadowBlur = 4;
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 12px Microsoft YaHei';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${player.hp}/${player.maxHp}`, x + w / 2, barY + barHeight / 2);
        ctx.restore();

        if (player.block > 0) {
            ctx.fillStyle = '#3498db';
            ctx.font = 'bold 14px Microsoft YaHei';
            ctx.fillText(`🛡️ ${player.block}`, x + w / 2, y + 80);
        }

        let statusY = y + 100;
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

        const enemyImageKey = this.getEnemyImageKey(enemy.id);
        const enemyImage = assetManager.getImage(enemyImageKey);
        
        if (enemyImage) {
            ctx.drawImage(enemyImage, x, y, w, h);
        } else {
            ctx.fillStyle = '#e74c3c';
            ctx.fillRect(x, y, w, h);

            ctx.strokeStyle = '#c0392b';
            ctx.lineWidth = 3;
            ctx.strokeRect(x, y, w, h);
        }

        ctx.fillStyle = '#fff';
        ctx.font = 'bold 16px Microsoft YaHei';
        ctx.textAlign = 'center';
        ctx.fillText(enemy.name, x + w / 2, y + 25);

        const barWidth = w - 20;
        const barHeight = 16;
        const barX = x + 10;
        const barY = y + 40;

        ctx.fillStyle = '#2c3e50';
        ctx.fillRect(barX, barY, barWidth, barHeight);

        const hpPercent = enemy.hp / enemy.maxHp;
        const hpColor = hpPercent > 0.5 ? '#27ae60' : (hpPercent > 0.25 ? '#f39c12' : '#e74c3c');
        ctx.fillStyle = hpColor;
        ctx.fillRect(barX, barY, barWidth * hpPercent, barHeight);

        ctx.strokeStyle = '#ecf0f1';
        ctx.lineWidth = 1;
        ctx.strokeRect(barX, barY, barWidth, barHeight);

        ctx.save();
        ctx.shadowColor = '#000';
        ctx.shadowBlur = 4;
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 12px Microsoft YaHei';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${enemy.hp}/${enemy.maxHp}`, x + w / 2, barY + barHeight / 2);
        ctx.restore();

        if (enemy.block > 0) {
            ctx.fillStyle = '#3498db';
            ctx.font = 'bold 14px Microsoft YaHei';
            ctx.fillText(`🛡️ ${enemy.block}`, x + w / 2, y + 80);
        }

        let statusY = y + 100;
        for (const [status, value] of Object.entries(enemy.statusEffects)) {
            if (value > 0) {
                ctx.fillStyle = this.getStatusColor(status);
                ctx.font = '12px Microsoft YaHei';
                ctx.fillText(`${status}: ${value}`, x + w / 2, statusY);
                statusY += 18;
            }
        }

        ctx.fillStyle = '#f1c40f';
        ctx.font = 'bold 14px Microsoft YaHei';
        ctx.fillText(enemy.intentDescription, x + w / 2, y + h - 20);
    }

    getEnemyImageKey(enemyId) {
        const enemyImageMap = {
            'cultist': 'enemy_cultist',
            'goblin_large': 'enemy_jaw_worm',
            'slime_small_1': 'enemy_slime',
            'slime_small_2': 'enemy_slime',
            'slime_small_3': 'enemy_slime'
        };
        return enemyImageMap[enemyId] || 'enemy_cultist';
    }

    drawSingleCard(ctx, card, canPlay) {
        const x = card.x;
        const y = card.y;
        const w = card.width;
        const h = card.height;

        const isAttack = card.type === CardType.ATTACK;
        const cardImageKey = isAttack ? 'card_attack' : (card.type === CardType.SKILL ? 'card_skill' : 'card_power');
        const cardImage = assetManager.getImage(cardImageKey);
        const bgColor = isAttack ? '#e74c3c' : (card.type === CardType.SKILL ? '#3498db' : '#9b59b6');

        if (cardImage) {
            ctx.drawImage(cardImage, x, y, w, h);
        } else {
            ctx.fillStyle = bgColor;
            this.drawRoundedRect(ctx, x, y, w, h, 8);
            ctx.fill();
        }

        ctx.strokeStyle = card.isHovered ? '#f1c40f' : '#ecf0f1';
        ctx.lineWidth = card.isHovered ? 3 : 2;
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
        ctx.fillText(card.name, x + w / 2, y + 35);

        ctx.strokeStyle = 'rgba(255,255,255,0.3)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x + 10, y + 55);
        ctx.lineTo(x + w - 10, y + 55);
        ctx.stroke();

        ctx.fillStyle = '#ecf0f1';
        ctx.font = '11px Microsoft YaHei';
        ctx.fillText(card.description, x + w / 2, y + 75);

        if (card.keywords && card.keywords.exhaust) {
            ctx.fillStyle = '#e74c3c';
            ctx.font = 'bold 12px Microsoft YaHei';
            ctx.fillText('(消耗)', x + w / 2, y + h - 25);
        }

        if (!canPlay) {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
            this.drawRoundedRect(ctx, x, y, w, h, 8);
            ctx.fill();
        }
    }

    drawGameInfo(ctx) {
        const player = this.gameState.player;
        const topBarHeight = 40;

        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(0, 0, this.canvas.width, topBarHeight);

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, topBarHeight);
        ctx.lineTo(this.canvas.width, topBarHeight);
        ctx.stroke();

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

        const centerX = this.canvas.width / 2;
        ctx.fillStyle = '#f1c40f';
        ctx.font = 'bold 14px Microsoft YaHei';
        ctx.textAlign = 'center';
        ctx.fillText(`💰 ${player.gold}`, centerX - 60, topBarHeight / 2);

        ctx.fillStyle = '#9b59b6';
        ctx.font = 'bold 14px Microsoft YaHei';
        ctx.fillText(`🏰 ${this.gameState.currentFloor}/${this.gameState.maxFloor}`, centerX + 60, topBarHeight / 2);

        this.drawRelics(ctx, topBarHeight);
        this.drawEnergyOrb(ctx);
        this.drawEndTurnButton(ctx);
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

    drawShopScreen(ctx) {
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;

        const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, Math.max(this.canvas.width, this.canvas.height));
        gradient.addColorStop(0, 'rgba(41, 128, 185, 0.3)');
        gradient.addColorStop(0.5, 'rgba(52, 73, 94, 0.5)');
        gradient.addColorStop(1, 'rgba(44, 62, 80, 0.9)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        ctx.font = 'bold 120px Microsoft YaHei';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🏪', centerX, centerY - 180);

        ctx.fillStyle = '#3498db';
        ctx.font = 'bold 42px Microsoft YaHei';
        ctx.fillText('商店', centerX, centerY - 80);

        ctx.fillStyle = '#f1c40f';
        ctx.font = 'bold 24px Microsoft YaHei';
        ctx.fillText(`💰 ${this.gameState.player.gold}`, centerX, centerY - 40);

        const itemSpacing = 180;
        const startX = centerX - (this.shopItems.length - 1) * itemSpacing / 2;
        const itemY = centerY + 40;

        this.shopItems.forEach((shopItem, index) => {
            const itemX = startX + index * itemSpacing;
            this.drawShopItem(ctx, itemX, itemY, shopItem, index);
        });

        const leaveButtonY = centerY + 200;
        this.drawShopLeaveButton(ctx, centerX, leaveButtonY);

        ctx.textBaseline = 'alphabetic';
    }

    drawShopItem(ctx, x, y, shopItem, index) {
        const isHovered = this.shopItemHovered[index];
        const canAfford = this.gameState.player.gold >= shopItem.price && !shopItem.sold;
        const w = 150;
        const h = 200;

        ctx.save();

        if (shopItem.sold) {
            ctx.globalAlpha = 0.5;
        }

        if (shopItem.type === 'card') {
            const card = shopItem.item;
            const isAttack = card.type === CardType.ATTACK;
            const bgColor = isAttack ? '#e74c3c' : (card.type === CardType.SKILL ? '#3498db' : '#9b59b6');
            ctx.fillStyle = bgColor;
            this.drawRoundedRect(ctx, x - w / 2, y - h / 2, w, h, 8);
            ctx.fill();

            ctx.strokeStyle = isHovered ? '#f1c40f' : '#ecf0f1';
            ctx.lineWidth = isHovered ? 4 : 2;
            this.drawRoundedRect(ctx, x - w / 2, y - h / 2, w, h, 8);
            ctx.stroke();

            ctx.fillStyle = '#f1c40f';
            ctx.beginPath();
            ctx.arc(x - w / 2 + 20, y - h / 2 + 20, 15, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#2c3e50';
            ctx.font = 'bold 16px Microsoft YaHei';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(card.cost, x - w / 2 + 20, y - h / 2 + 20);

            ctx.fillStyle = '#fff';
            ctx.font = 'bold 14px Microsoft YaHei';
            ctx.textBaseline = 'alphabetic';
            ctx.fillText(card.name, x, y - h / 2 + 55);

            ctx.fillStyle = '#ecf0f1';
            ctx.font = '11px Microsoft YaHei';
            ctx.fillText(card.description, x, y - h / 2 + 95);

        } else if (shopItem.type === 'relic') {
            const relic = shopItem.item;
            ctx.fillStyle = '#9b59b6';
            this.drawRoundedRect(ctx, x - w / 2, y - h / 2, w, h, 8);
            ctx.fill();

            ctx.strokeStyle = isHovered ? '#f1c40f' : '#ecf0f1';
            ctx.lineWidth = isHovered ? 4 : 2;
            this.drawRoundedRect(ctx, x - w / 2, y - h / 2, w, h, 8);
            ctx.stroke();

            ctx.font = 'bold 48px Microsoft YaHei';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('💎', x, y - 30);

            ctx.fillStyle = '#fff';
            ctx.font = 'bold 16px Microsoft YaHei';
            ctx.fillText(relic.name, x, y + 20);

            ctx.fillStyle = '#ecf0f1';
            ctx.font = '11px Microsoft YaHei';
            ctx.fillText(relic.description, x, y + 45);

        } else if (shopItem.type === 'cardRemoval') {
            ctx.fillStyle = '#e74c3c';
            this.drawRoundedRect(ctx, x - w / 2, y - h / 2, w, h, 8);
            ctx.fill();

            ctx.strokeStyle = isHovered ? '#f1c40f' : '#ecf0f1';
            ctx.lineWidth = isHovered ? 4 : 2;
            this.drawRoundedRect(ctx, x - w / 2, y - h / 2, w, h, 8);
            ctx.stroke();

            ctx.font = 'bold 48px Microsoft YaHei';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('🗑️', x, y - 30);

            ctx.fillStyle = '#fff';
            ctx.font = 'bold 16px Microsoft YaHei';
            ctx.fillText('移除卡牌', x, y + 20);

            ctx.fillStyle = '#ecf0f1';
            ctx.font = '11px Microsoft YaHei';
            ctx.fillText('删除一张牌', x, y + 45);
        }

        if (!canAfford && !shopItem.sold) {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
            this.drawRoundedRect(ctx, x - w / 2, y - h / 2, w, h, 8);
            ctx.fill();
        }

        ctx.restore();

        const priceY = y + h / 2 + 25;
        ctx.fillStyle = shopItem.sold ? '#27ae60' : (canAfford ? '#f1c40f' : '#e74c3c');
        ctx.font = 'bold 18px Microsoft YaHei';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(shopItem.sold ? '已售出' : `💰 ${shopItem.price}`, x, priceY);
    }

    drawShopLeaveButton(ctx, centerX, y) {
        const w = 160;
        const h = 50;
        const x = centerX - w / 2;

        ctx.fillStyle = this.shopLeaveHovered ? '#c0392b' : '#e74c3c';
        this.drawRoundedRect(ctx, x, y, w, h, 10);
        ctx.fill();

        ctx.strokeStyle = this.shopLeaveHovered ? '#f1c40f' : '#ecf0f1';
        ctx.lineWidth = this.shopLeaveHovered ? 3 : 2;
        this.drawRoundedRect(ctx, x, y, w, h, 10);
        ctx.stroke();

        ctx.fillStyle = '#fff';
        ctx.font = 'bold 18px Microsoft YaHei';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('离开商店', centerX, y + h / 2);
    }

    drawCardRemovalScreen(ctx) {
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;

        ctx.fillStyle = 'rgba(20, 20, 30, 0.95)';
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        ctx.fillStyle = '#e74c3c';
        ctx.font = 'bold 42px Microsoft YaHei';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🗑️ 选择要移除的卡牌', centerX, centerY - 180);

        ctx.fillStyle = '#ecf0f1';
        ctx.font = '18px Microsoft YaHei';
        ctx.fillText('点击一张卡牌将其从牌组中永久删除', centerX, centerY - 130);

        const cardWidth = 120;
        const cardHeight = 160;
        const spacing = 20;
        const totalWidth = this.removalDeckCards.length * cardWidth + (this.removalDeckCards.length - 1) * spacing;
        const startX = centerX - totalWidth / 2;
        const cardY = centerY;

        this.removalDeckCards.forEach((card, index) => {
            const cardX = startX + index * (cardWidth + spacing);
            this.drawRemovalCard(ctx, card, cardX, cardY, this.removalCardHovered[index], cardWidth, cardHeight);
        });

        const backButtonY = centerY + 150;
        this.drawRemovalBackButton(ctx, centerX, backButtonY);

        ctx.textBaseline = 'alphabetic';
    }

    drawRemovalCard(ctx, card, x, y, isHovered, w, h) {
        const isAttack = card.type === CardType.ATTACK;
        const bgColor = isAttack ? '#e74c3c' : (card.type === CardType.SKILL ? '#3498db' : '#9b59b6');

        ctx.fillStyle = bgColor;
        this.drawRoundedRect(ctx, x, y - h / 2, w, h, 8);
        ctx.fill();

        ctx.strokeStyle = isHovered ? '#f1c40f' : '#ecf0f1';
        ctx.lineWidth = isHovered ? 4 : 2;
        this.drawRoundedRect(ctx, x, y - h / 2, w, h, 8);
        ctx.stroke();

        if (isHovered) {
            ctx.fillStyle = 'rgba(231, 76, 60, 0.3)';
            this.drawRoundedRect(ctx, x, y - h / 2, w, h, 8);
            ctx.fill();
        }

        ctx.fillStyle = '#f1c40f';
        ctx.beginPath();
        ctx.arc(x + 20, y - h / 2 + 20, 12, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#2c3e50';
        ctx.font = 'bold 12px Microsoft YaHei';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(card.cost, x + 20, y - h / 2 + 20);

        ctx.fillStyle = '#fff';
        ctx.font = 'bold 12px Microsoft YaHei';
        ctx.textBaseline = 'alphabetic';
        ctx.fillText(card.name, x + w / 2, y - h / 2 + 50);

        ctx.fillStyle = '#ecf0f1';
        ctx.font = '10px Microsoft YaHei';
        ctx.fillText(card.description, x + w / 2, y - h / 2 + 80);
    }

    drawRemovalBackButton(ctx, centerX, y) {
        const w = 160;
        const h = 50;
        const x = centerX - w / 2;

        ctx.fillStyle = this.removalBackHovered ? '#2980b9' : '#3498db';
        this.drawRoundedRect(ctx, x, y, w, h, 10);
        ctx.fill();

        ctx.strokeStyle = this.removalBackHovered ? '#f1c40f' : '#ecf0f1';
        ctx.lineWidth = this.removalBackHovered ? 3 : 2;
        this.drawRoundedRect(ctx, x, y, w, h, 10);
        ctx.stroke();

        ctx.fillStyle = '#fff';
        ctx.font = 'bold 18px Microsoft YaHei';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('返回商店', centerX, y + h / 2);
    }

    drawMapScreen(ctx) {
        ctx.fillStyle = 'rgba(20, 20, 30, 0.95)';
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        ctx.fillStyle = '#f1c40f';
        ctx.font = 'bold 36px Microsoft YaHei';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('选择你的路线', this.canvas.width / 2, 60);

        ctx.fillStyle = '#95a5a6';
        ctx.font = '18px Microsoft YaHei';
        const floorText = this.currentMapNode ? `第 ${this.currentMapNode.layer + 1} 层` : '选择起始节点';
        ctx.fillText(floorText, this.canvas.width / 2, 100);

        this.drawMapConnections(ctx);

        this.mapLayers.forEach((layer, layerIndex) => {
            layer.forEach((node, nodeIndex) => {
                this.drawMapNode(ctx, node, layerIndex, nodeIndex);
            });
        });

        ctx.fillStyle = '#7f8c8d';
        ctx.font = '14px Microsoft YaHei';
        ctx.fillText('点击高亮节点继续前进', this.canvas.width / 2, this.canvas.height - 40);
        ctx.textBaseline = 'alphabetic';
    }

    drawMapConnections(ctx) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 2;

        for (let layerIndex = 0; layerIndex < this.mapLayers.length - 1; layerIndex++) {
            const currentLayer = this.mapLayers[layerIndex];
            const nextLayer = this.mapLayers[layerIndex + 1];

            currentLayer.forEach((node, nodeIndex) => {
                node.nextNodes.forEach(nextIndex => {
                    const nextNode = nextLayer[nextIndex];
                    if (nextNode) {
                        ctx.beginPath();
                        ctx.moveTo(node.x, node.y);
                        ctx.lineTo(nextNode.x, nextNode.y);
                        ctx.stroke();
                    }
                });
            });
        }
    }

    drawMapNode(ctx, node, layerIndex, nodeIndex) {
        const x = node.x;
        const y = node.y;
        const radius = 45;

        const nodeConfig = {
            [NodeType.BATTLE]: { icon: '⚔️', name: '战斗', color: '#e74c3c' },
            [NodeType.ELITE]: { icon: '👹', name: '精英', color: '#9b59b6' },
            [NodeType.CAMPFIRE]: { icon: '🔥', name: '篝火', color: '#e67e22' },
            [NodeType.SHOP]: { icon: '🏪', name: '商店', color: '#3498db' }
        };

        const config = nodeConfig[node.type];
        const isClickable = this.isNodeClickable(node);
        const isHovered = this.isNodeHovered(node);
        const isCurrent = this.currentMapNode === node;
        const isVisited = node.visited;

        ctx.save();

        if (!isClickable && !isVisited) {
            ctx.globalAlpha = 0.4;
        }

        ctx.fillStyle = config.color;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();

        let borderColor = '#ecf0f1';
        let borderWidth = 2;

        if (isCurrent) {
            borderColor = '#f1c40f';
            borderWidth = 4;
        } else if (isHovered && isClickable) {
            borderColor = '#f1c40f';
            borderWidth = 3;
        } else if (isVisited) {
            borderColor = '#27ae60';
            borderWidth = 3;
        }

        ctx.strokeStyle = borderColor;
        ctx.lineWidth = borderWidth;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.stroke();

        if (isHovered && isClickable) {
            ctx.shadowColor = config.color;
            ctx.shadowBlur = 20;
            ctx.beginPath();
            ctx.arc(x, y, radius, 0, Math.PI * 2);
            ctx.stroke();
            ctx.shadowBlur = 0;
        }

        ctx.font = 'bold 28px Microsoft YaHei';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(config.icon, x, y - 5);

        ctx.fillStyle = '#fff';
        ctx.font = 'bold 12px Microsoft YaHei';
        ctx.fillText(config.name, x, y + 25);

        if (isVisited) {
            ctx.fillStyle = '#27ae60';
            ctx.font = 'bold 10px Microsoft YaHei';
            ctx.fillText('✓', x + radius - 10, y - radius + 10);
        }

        ctx.restore();
    }

    isNodeClickable(node) {
        if (node.visited) return false;

        if (this.currentMapNode === null) {
            return node.layer === 0;
        }

        const currentLayer = this.currentMapNode.layer;
        if (node.layer !== currentLayer + 1) return false;

        return this.currentMapNode.nextNodes.includes(node.index);
    }

    isNodeHovered(node) {
        const dx = this.input.mouseX - node.x;
        const dy = this.input.mouseY - node.y;
        return Math.sqrt(dx * dx + dy * dy) <= 45;
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

    handleCardInteraction() {
        const hand = this.gameState.deckManager.hand;
        const player = this.gameState.player;

        if (this.dragState.isDragging) {
            const draggedCard = this.dragState.draggedCard;

            draggedCard.x = this.input.mouseX - this.dragState.dragOffsetX;
            draggedCard.y = this.input.mouseY - this.dragState.dragOffsetY;
            draggedCard.targetX = draggedCard.x;
            draggedCard.targetY = draggedCard.y;

            this.aimedEnemy = this.getEnemyUnderMouse();

            if (!this.input.isMouseDown) {
                this.releaseDraggedCard();
            }
            return;
        }

        hand.forEach(card => card.isHovered = false);

        for (let i = hand.length - 1; i >= 0; i--) {
            const card = hand[i];
            const isHovered = this.isMouseOver(this.input.mouseX, this.input.mouseY, {
                x: card.x, y: card.y, width: card.width, height: card.height
            });

            if (isHovered) {
                card.isHovered = true;

                if (this.input.isMouseDown && !this.dragState.isDragging) {
                    const canPlay = player.energy >= card.cost;
                    if (!canPlay) {
                        this.energyShake = 10;
                        break;
                    }

                    this.dragState.isDragging = true;
                    this.dragState.draggedCard = card;
                    this.dragState.dragOffsetX = this.input.mouseX - card.x;
                    this.dragState.dragOffsetY = this.input.mouseY - card.y;
                    card.isSelected = true;
                }
                break;
            }
        }

        if (!this.dragState.isDragging) {
            this.updateHandPositions();
        }
    }

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

    releaseDraggedCard() {
        const card = this.dragState.draggedCard;
        const player = this.gameState.player;

        const playThresholdY = this.canvas.height - 250;

        if (this.input.mouseY < playThresholdY) {
            let target = null;
            let isValidPlay = true;

            if (card.target === CardTarget.ENEMY) {
                target = this.aimedEnemy;
                if (!target) {
                    isValidPlay = false;
                }
            } else if (card.target === CardTarget.ALL_ENEMIES) {
                target = null;
            } else if (card.target === CardTarget.SELF) {
                target = player;
            }

            if (isValidPlay && this.gameState.playCard(card, target)) {
                // Play successful
            }
        }

        card.isSelected = false;
        this.dragState.isDragging = false;
        this.dragState.draggedCard = null;
        this.aimedEnemy = null;

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
        if (!this.mapLayers || this.mapLayers.length === 0) return;

        this.mapLayers.forEach((layer, layerIndex) => {
            layer.forEach((node, nodeIndex) => {
                if (this.isNodeClickable(node) && this.isNodeHovered(node)) {
                    if (this.input.isClicked) {
                        this.selectMapNode(node);
                    }
                }
            });
        });
    }

    handleShopInput() {
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;
        const itemSpacing = 180;
        const startX = centerX - (this.shopItems.length - 1) * itemSpacing / 2;
        const itemY = centerY + 40;
        const itemW = 150;
        const itemH = 200;

        this.shopItemHovered = this.shopItems.map((_, index) => false);

        this.shopItems.forEach((shopItem, index) => {
            const itemX = startX + index * itemSpacing;
            const rect = { x: itemX - itemW / 2, y: itemY - itemH / 2, width: itemW, height: itemH };
            this.shopItemHovered[index] = this.isMouseOver(this.input.mouseX, this.input.mouseY, rect);

            if (this.input.isClicked && this.shopItemHovered[index]) {
                this.purchaseShopItem(index);
            }
        });

        const leaveButtonY = centerY + 200;
        const leaveButtonRect = { x: centerX - 80, y: leaveButtonY, width: 160, height: 50 };
        this.shopLeaveHovered = this.isMouseOver(this.input.mouseX, this.input.mouseY, leaveButtonRect);

        if (this.input.isClicked && this.shopLeaveHovered) {
            this.leaveShop();
        }
    }

    purchaseShopItem(index) {
        const shopItem = this.shopItems[index];
        if (!shopItem || shopItem.sold) return;

        const player = this.gameState.player;
        if (player.gold < shopItem.price) return;

        player.gold -= shopItem.price;

        if (shopItem.type === 'card') {
            this.gameState.deckManager.addCard(shopItem.item.clone());
            console.log(`购买了卡牌: ${shopItem.item.name}`);
        } else if (shopItem.type === 'relic') {
            player.relics.push(shopItem.item);
            console.log(`购买了遗物: ${shopItem.item.name}`);
        } else if (shopItem.type === 'cardRemoval') {
            this.enterCardRemoval();
            return;
        }

        shopItem.sold = true;
        this.saveGame();
    }

    enterCardRemoval() {
        this.uiState = UIState.CARD_REMOVAL;
        this.removalDeckCards = this.gameState.deckManager.getAllCards().filter(card => 
            card.id.startsWith('strike_') || card.id.startsWith('defend_')
        );
        this.removalCardHovered = this.removalDeckCards.map(() => false);
        this.removalBackHovered = false;
    }

    handleCardRemovalInput() {
        const centerX = this.canvas.width / 2;
        const cardWidth = 120;
        const cardHeight = 160;
        const spacing = 20;
        const totalWidth = this.removalDeckCards.length * cardWidth + (this.removalDeckCards.length - 1) * spacing;
        const startX = centerX - totalWidth / 2;
        const cardY = this.canvas.height / 2;

        this.removalCardHovered = this.removalDeckCards.map(() => false);

        this.removalDeckCards.forEach((card, index) => {
            const cardX = startX + index * (cardWidth + spacing);
            const rect = { x: cardX, y: cardY - cardHeight / 2, width: cardWidth, height: cardHeight };
            this.removalCardHovered[index] = this.isMouseOver(this.input.mouseX, this.input.mouseY, rect);

            if (this.input.isClicked && this.removalCardHovered[index]) {
                this.removeCardFromDeck(card);
                return;
            }
        });

        const backButtonY = this.canvas.height / 2 + 150;
        const backButtonRect = { x: centerX - 80, y: backButtonY, width: 160, height: 50 };
        this.removalBackHovered = this.isMouseOver(this.input.mouseX, this.input.mouseY, backButtonRect);

        if (this.input.isClicked && this.removalBackHovered) {
            this.uiState = UIState.SHOP;
        }
    }

    removeCardFromDeck(card) {
        const deckManager = this.gameState.deckManager;
        
        let removed = false;
        for (let i = 0; i < deckManager.drawPile.length; i++) {
            if (deckManager.drawPile[i] === card) {
                deckManager.drawPile.splice(i, 1);
                removed = true;
                break;
            }
        }
        
        if (!removed) {
            for (let i = 0; i < deckManager.hand.length; i++) {
                if (deckManager.hand[i] === card) {
                    deckManager.hand.splice(i, 1);
                    removed = true;
                    break;
                }
            }
        }
        
        if (!removed) {
            for (let i = 0; i < deckManager.discardPile.length; i++) {
                if (deckManager.discardPile[i] === card) {
                    deckManager.discardPile.splice(i, 1);
                    removed = true;
                    break;
                }
            }
        }

        if (removed) {
            console.log(`移除了卡牌: ${card.name}`);
            this.shopItems.find(item => item.type === 'cardRemoval').sold = true;
            this.uiState = UIState.SHOP;
            this.saveGame();
        }
    }

    leaveShop() {
        this.continueToNextBattle();
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

    endPlayerTurn() {
        this.gameState.endPlayerTurn();
    }

    handleVictory() {
        console.log('=== 处理胜利 ===');
        this.rewardGold = 10 + Math.floor(Math.random() * 10);
        this.gameState.player.gainGold(this.rewardGold);
        this.generateRewardCards();
        this.uiState = UIState.REWARD;
        this.saveGame();
    }

    generateRewardCards() {
        const cardTemplates = [
            { name: '重击', cost: 2, type: CardType.ATTACK, target: CardTarget.ENEMY, value: 14, desc: '造成 14 点伤害' },
            { name: '铁布衫', cost: 1, type: CardType.SKILL, target: CardTarget.SELF, value: 8, desc: '获得 8 点格挡' },
            { name: '剑气', cost: 1, type: CardType.ATTACK, target: CardTarget.ENEMY, value: 8, desc: '造成 8 点伤害，抽 1 张牌', effects: [{ type: 'draw', value: 1 }] },
            { name: '怒吼', cost: 0, type: CardType.SKILL, target: CardTarget.SELF, value: 0, desc: '获得 2 层力量', effects: [{ type: 'apply_status', status: 'strength', value: 2 }] },
            { name: '双重打击', cost: 1, type: CardType.ATTACK, target: CardTarget.ENEMY, value: 5, desc: '造成 5 点伤害 2 次' },
            { name: '致命毒药', cost: 1, type: CardType.SKILL, target: CardTarget.ENEMY, value: 5, desc: '给予目标 5 层中毒', effects: [{ type: 'apply_status', status: 'poison', value: 5 }] },
            { name: '催化剂', cost: 1, type: CardType.SKILL, target: CardTarget.ENEMY, value: 0, desc: '使目标中毒层数翻倍', effects: [{ type: 'double_poison', value: 1 }] },
            { name: '毒刺', cost: 1, type: CardType.ATTACK, target: CardTarget.ENEMY, value: 6, desc: '造成 6 点伤害，若目标中毒额外造成 6 点', effects: [{ type: 'poison_bonus', value: 6 }] }
        ];

        this.rewardCards = [];
        for (let i = 0; i < 3; i++) {
            const template = cardTemplates[Math.floor(Math.random() * cardTemplates.length)];
            this.rewardCards.push(new Card(
                `reward_${i}`,
                template.name,
                template.cost,
                template.type,
                template.target,
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

        const currentLayer = this.currentMapNode ? this.currentMapNode.layer : -1;
        if (currentLayer >= this.mapLayers.length - 1) {
            console.log('=== 恭喜通关！===');
            this.uiState = UIState.GAME_WIN;
            return;
        }

        this.uiState = UIState.MAP;
    }

    generateMapNodes() {
        const nodeTypes = [
            { type: NodeType.BATTLE, weight: 40 },
            { type: NodeType.ELITE, weight: 20 },
            { type: NodeType.CAMPFIRE, weight: 20 },
            { type: NodeType.SHOP, weight: 20 }
        ];

        const getRandomNodeType = () => {
            const random = Math.random() * 100;
            let cumulativeWeight = 0;
            for (const node of nodeTypes) {
                cumulativeWeight += node.weight;
                if (random < cumulativeWeight) {
                    return node.type;
                }
            }
            return NodeType.BATTLE;
        };

        this.mapLayers = [];
        const totalLayers = 5;

        for (let layer = 0; layer < totalLayers; layer++) {
            const nodeCount = layer === 0 ? 2 : (Math.random() < 0.5 ? 2 : 3);
            const layerNodes = [];

            for (let i = 0; i < nodeCount; i++) {
                const node = {
                    id: `node_${layer}_${i}`,
                    layer: layer,
                    index: i,
                    type: getRandomNodeType(),
                    nextNodes: [],
                    prevNodes: [],
                    visited: false,
                    x: 0,
                    y: 0
                };
                layerNodes.push(node);
            }
            this.mapLayers.push(layerNodes);
        }

        for (let layer = 0; layer < totalLayers - 1; layer++) {
            const currentLayer = this.mapLayers[layer];
            const nextLayer = this.mapLayers[layer + 1];

            currentLayer.forEach((node, index) => {
                const minConnections = 1;
                const maxConnections = Math.min(2, nextLayer.length);
                const connectionCount = Math.floor(Math.random() * (maxConnections - minConnections + 1)) + minConnections;

                const availableIndices = [...Array(nextLayer.length).keys()];
                const shuffled = availableIndices.sort(() => Math.random() - 0.5);
                const selectedIndices = shuffled.slice(0, connectionCount);

                selectedIndices.forEach(nextIndex => {
                    node.nextNodes.push(nextIndex);
                    nextLayer[nextIndex].prevNodes.push(index);
                });
            });

            nextLayer.forEach((node, index) => {
                if (node.prevNodes.length === 0) {
                    const randomPrevIndex = Math.floor(Math.random() * currentLayer.length);
                    currentLayer[randomPrevIndex].nextNodes.push(index);
                    node.prevNodes.push(randomPrevIndex);
                }
            });
        }

        this.currentMapNode = null;
        this.calculateMapNodePositions();
    }

    calculateMapNodePositions() {
        const centerX = this.canvas.width / 2;
        const startY = this.canvas.height - 150;
        const endY = 150;
        const layerHeight = (startY - endY) / (this.mapLayers.length - 1);

        this.mapNodePositions = [];

        this.mapLayers.forEach((layer, layerIndex) => {
            const y = startY - layerIndex * layerHeight;
            const nodeWidth = 100;
            const totalWidth = layer.length * nodeWidth + (layer.length - 1) * 50;
            const startX = centerX - totalWidth / 2;

            layer.forEach((node, nodeIndex) => {
                node.x = startX + nodeIndex * (nodeWidth + 50) + nodeWidth / 2;
                node.y = y;
                this.mapNodePositions.push({
                    node: node,
                    x: node.x,
                    y: node.y,
                    radius: 45
                });
            });
        });
    }

    selectMapNode(node) {
        if (!node || node.visited) return;

        if (this.currentMapNode !== null) {
            const currentNode = this.currentMapNode;
            const currentLayerIndex = currentNode.layer;
            const targetLayerIndex = node.layer;

            if (targetLayerIndex !== currentLayerIndex + 1) return;

            if (!currentNode.nextNodes.includes(node.index)) return;
        } else {
            if (node.layer !== 0) return;
        }

        node.visited = true;
        this.currentMapNode = node;
        this.gameState.currentFloor = node.layer + 1;

        this.rewardGold = 0;
        this.rewardCards = [];
        this.isCardRewardSelected = false;
        this.rewardCardHovered = [false, false, false];
        this.floatingTexts = [];

        switch (node.type) {
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
            case NodeType.SHOP:
                this.uiState = UIState.SHOP;
                this.generateShopItems();
                this.shopItemHovered = [false, false, false, false, false];
                this.shopLeaveHovered = false;
                break;
        }
    }

    generateShopItems() {
        this.shopItems = [];

        const cardTemplates = [
            { name: '重击', cost: 2, type: CardType.ATTACK, target: CardTarget.ENEMY, value: 14, desc: '造成 14 点伤害' },
            { name: '铁布衫', cost: 1, type: CardType.SKILL, target: CardTarget.SELF, value: 8, desc: '获得 8 点格挡' },
            { name: '剑气', cost: 1, type: CardType.ATTACK, target: CardTarget.ENEMY, value: 8, desc: '造成 8 点伤害，抽 1 张牌', effects: [{ type: 'draw', value: 1 }] },
            { name: '怒吼', cost: 0, type: CardType.SKILL, target: CardTarget.SELF, value: 0, desc: '获得 2 层力量', effects: [{ type: 'apply_status', status: 'strength', value: 2 }] },
            { name: '双重打击', cost: 1, type: CardType.ATTACK, target: CardTarget.ENEMY, value: 5, desc: '造成 5 点伤害 2 次' },
            { name: '火焰斩', cost: 2, type: CardType.ATTACK, target: CardTarget.ENEMY, value: 12, desc: '造成 12 点伤害，获得 2 层力量', effects: [{ type: 'apply_status', status: 'strength', value: 2 }] },
            { name: '铁壁', cost: 2, type: CardType.SKILL, target: CardTarget.SELF, value: 12, desc: '获得 12 点格挡' },
            { name: '致命毒药', cost: 1, type: CardType.SKILL, target: CardTarget.ENEMY, value: 5, desc: '给予目标 5 层中毒', effects: [{ type: 'apply_status', status: 'poison', value: 5 }] },
            { name: '催化剂', cost: 1, type: CardType.SKILL, target: CardTarget.ENEMY, value: 0, desc: '使目标中毒层数翻倍', effects: [{ type: 'double_poison', value: 1 }] },
            { name: '毒刺', cost: 1, type: CardType.ATTACK, target: CardTarget.ENEMY, value: 6, desc: '造成 6 点伤害，若目标中毒额外造成 6 点', effects: [{ type: 'poison_bonus', value: 6 }] }
        ];

        for (let i = 0; i < 3; i++) {
            const template = cardTemplates[Math.floor(Math.random() * cardTemplates.length)];
            const card = new Card(
                `shop_card_${i}`,
                template.name,
                template.cost,
                template.type,
                template.target,
                template.value,
                template.desc,
                template.effects || []
            );
            this.shopItems.push({
                type: 'card',
                item: card,
                price: 50,
                sold: false
            });
        }

        const relicClasses = [VajraRelic, AnchorRelic];
        const randomRelicClass = relicClasses[Math.floor(Math.random() * relicClasses.length)];
        this.shopItems.push({
            type: 'relic',
            item: new randomRelicClass(),
            price: 150,
            sold: false
        });

        this.shopItems.push({
            type: 'cardRemoval',
            item: null,
            price: this.shopCardRemovalPrice,
            sold: false
        });
    }

    doCampfireRest() {
        const player = this.gameState.player;
        const healAmount = Math.floor(player.maxHp * 0.3);
        player.heal(healAmount);
        this.campfireActionTaken = true;
        this.saveGame();
    }

    doCampfireSearch() {
        const player = this.gameState.player;
        const relics = [new VajraRelic(), new AnchorRelic()];
        const randomRelic = relics[Math.floor(Math.random() * relics.length)];
        player.relics.push(randomRelic);
        this.campfireActionTaken = true;
        this.saveGame();
    }

    restartGame() {
        console.log('=== 重新开始游戏 ===');
        this.gameState = null;
        this.mapLayers = [];
        this.currentMapNode = null;
        this.mapNodePositions = [];
        this.rewardGold = 0;
        this.rewardCards = [];
        this.isCardRewardSelected = false;
        this.floatingTexts = [];
        SaveManager.deleteSave();
        this.hasSaveData = false;
        this.initGame();
    }

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
            retain_block: '#1abc9c',
            poison: '#2ecc71'
        };
        return colors[status] || '#ecf0f1';
    }

    drawMainMenu(ctx) {
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;

        ctx.fillStyle = '#1a1a2e';
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        ctx.fillStyle = '#f1c40f';
        ctx.font = 'bold 64px Microsoft YaHei';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('杀戮尖塔', centerX, centerY - 150);

        ctx.fillStyle = '#ecf0f1';
        ctx.font = '18px Microsoft YaHei';
        ctx.fillText('ES6 模块化版本', centerX, centerY - 90);

        if (this.hasSaveData) {
            const continueY = centerY;
            const newGameY = centerY + 80;

            const continueRect = { x: centerX - 100, y: continueY - 25, width: 200, height: 50 };
            this.mainMenuContinueHovered = this.isMouseOver(this.input.mouseX, this.input.mouseY, continueRect);

            ctx.fillStyle = this.mainMenuContinueHovered ? '#27ae60' : '#2ecc71';
            this.drawRoundedRect(ctx, continueRect.x, continueRect.y, continueRect.width, continueRect.height, 10);
            ctx.fill();
            ctx.strokeStyle = this.mainMenuContinueHovered ? '#f1c40f' : '#27ae60';
            ctx.lineWidth = this.mainMenuContinueHovered ? 3 : 2;
            this.drawRoundedRect(ctx, continueRect.x, continueRect.y, continueRect.width, continueRect.height, 10);
            ctx.stroke();
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 20px Microsoft YaHei';
            ctx.fillText('继续冒险', centerX, continueY);

            const newGameRect = { x: centerX - 100, y: newGameY - 25, width: 200, height: 50 };
            this.mainMenuNewGameHovered = this.isMouseOver(this.input.mouseX, this.input.mouseY, newGameRect);

            ctx.fillStyle = this.mainMenuNewGameHovered ? '#c0392b' : '#e74c3c';
            this.drawRoundedRect(ctx, newGameRect.x, newGameRect.y, newGameRect.width, newGameRect.height, 10);
            ctx.fill();
            ctx.strokeStyle = this.mainMenuNewGameHovered ? '#f1c40f' : '#c0392b';
            ctx.lineWidth = this.mainMenuNewGameHovered ? 3 : 2;
            this.drawRoundedRect(ctx, newGameRect.x, newGameRect.y, newGameRect.width, newGameRect.height, 10);
            ctx.stroke();
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 20px Microsoft YaHei';
            ctx.fillText('重新开始', centerX, newGameY);
        } else {
            const startY = centerY;

            const startRect = { x: centerX - 100, y: startY - 25, width: 200, height: 50 };
            this.mainMenuNewGameHovered = this.isMouseOver(this.input.mouseX, this.input.mouseY, startRect);

            ctx.fillStyle = this.mainMenuNewGameHovered ? '#27ae60' : '#2ecc71';
            this.drawRoundedRect(ctx, startRect.x, startRect.y, startRect.width, startRect.height, 10);
            ctx.fill();
            ctx.strokeStyle = this.mainMenuNewGameHovered ? '#f1c40f' : '#27ae60';
            ctx.lineWidth = this.mainMenuNewGameHovered ? 3 : 2;
            this.drawRoundedRect(ctx, startRect.x, startRect.y, startRect.width, startRect.height, 10);
            ctx.stroke();
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 20px Microsoft YaHei';
            ctx.fillText('开始游戏', centerX, startY);
        }

        ctx.fillStyle = '#7f8c8d';
        ctx.font = '14px Microsoft YaHei';
        ctx.fillText('点击按钮开始', centerX, centerY + 180);
    }

    handleMainMenuInput() {
        if (this.hasSaveData) {
            const centerX = this.canvas.width / 2;
            const centerY = this.canvas.height / 2;

            const continueRect = { x: centerX - 100, y: centerY - 25, width: 200, height: 50 };
            this.mainMenuContinueHovered = this.isMouseOver(this.input.mouseX, this.input.mouseY, continueRect);

            const newGameRect = { x: centerX - 100, y: centerY + 55, width: 200, height: 50 };
            this.mainMenuNewGameHovered = this.isMouseOver(this.input.mouseX, this.input.mouseY, newGameRect);

            if (this.input.isClicked && this.mainMenuContinueHovered) {
                this.loadSavedGame();
            }

            if (this.input.isClicked && this.mainMenuNewGameHovered) {
                this.startNewGame();
            }
        } else {
            const centerX = this.canvas.width / 2;
            const centerY = this.canvas.height / 2;

            const startRect = { x: centerX - 100, y: centerY - 25, width: 200, height: 50 };
            this.mainMenuNewGameHovered = this.isMouseOver(this.input.mouseX, this.input.mouseY, startRect);

            if (this.input.isClicked && this.mainMenuNewGameHovered) {
                this.startNewGame();
            }
        }
    }

    startNewGame() {
        console.log('=== 开始新游戏 ===');
        SaveManager.deleteSave();
        this.hasSaveData = false;
        this.initGame();
    }

    loadSavedGame() {
        console.log('=== 读取存档 ===');
        const saveData = SaveManager.loadGame();
        if (saveData) {
            this.restoreFromSave(saveData);
        } else {
            console.log('存档读取失败，开始新游戏');
            this.startNewGame();
        }
    }

    restoreFromSave(saveData) {
        console.log('正在恢复存档...');

        const player = new Player(
            saveData.player.id,
            saveData.player.name,
            saveData.player.maxHp
        );
        player.hp = saveData.player.hp;
        player.gold = saveData.player.gold;

        const relicClasses = {
            'vajra': VajraRelic,
            'anchor': AnchorRelic
        };
        saveData.player.relicIds.forEach(relicId => {
            const RelicClass = relicClasses[relicId];
            if (RelicClass) {
                player.relics.push(new RelicClass());
            }
        });

        const deckManager = new DeckManager();
        saveData.deck.cards.forEach(cardData => {
            const card = SaveManager.createCardFromSave(cardData);
            deckManager.addCard(card);
        });

        this.gameState = new GameState(player, deckManager);
        this.gameState.currentFloor = saveData.currentFloor;
        this.gameState.maxFloor = saveData.maxFloor;

        this.setupVisualFeedbackCallbacks();
        this.setupVictoryCallback();

        this.generateMapNodes();
        this.currentMapNode = null;
        this.uiState = UIState.MAP;

        console.log('存档恢复完成！');
    }

    saveGame() {
        if (this.gameState) {
            SaveManager.saveGame(this.gameState);
            this.hasSaveData = true;
        }
    }
}