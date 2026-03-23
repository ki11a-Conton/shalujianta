/**
 * ============================================
 * GameState - 游戏状态核心
 * 整个数据逻辑的"大脑"，组装 Entity、Card、DeckManager 和 Relic
 * ============================================
 */

import { TurnPhase, sleep } from '../config/constants.js';
import { Enemy } from '../entities/Enemy.js';

export class GameState {
    /**
     * @param {Player} player - 玩家对象
     * @param {DeckManager} deckManager - 牌组管理器
     */
    constructor(player, deckManager) {
        this.player = player;
        this.deckManager = deckManager;
        this.enemies = [];

        // 回合管理
        this.currentPhase = TurnPhase.PLAYER_TURN;
        this.turnNumber = 1;

        // 层数进度
        this.currentFloor = 1;
        this.maxFloor = 5;

        // 战斗日志
        this.battleLog = [];

        // 回调函数（由 GameEngine 设置）
        this.onVictory = null;
        this.onDefeat = null;
    }

    /**
     * 初始化战斗
     */
    initBattle() {
        console.log('=== 初始化战斗 ===');

        // 重置玩家状态
        this.player.resetEnergy();
        this.player.resetBlock();
        this.player.processTurnEndStatuses(); // 清除旧状态

        // 生成敌人
        this.generateEnemies();

        // 初始化牌组
        this.deckManager.initBattle(5);

        // 重置回合
        this.currentPhase = TurnPhase.PLAYER_TURN;
        this.turnNumber = 1;
        this.battleLog = [];

        // 触发遗物效果 - 战斗开始
        this.player.triggerRelicsOnBattleStart(this);

        // 敌人生成意图
        this.enemies.forEach(enemy => {
            if (!enemy.isDead()) {
                enemy.generateIntent();
            }
        });

        this.addLog('战斗开始！');
    }

    /**
     * 生成敌人
     */
    generateEnemies() {
        this.enemies = [];

        // 根据层数生成不同敌人
        switch (this.currentFloor) {
            case 1:
                // 第1层：1个邪教徒
                this.enemies.push(new Enemy('cultist', '邪教徒', 50));
                break;
            case 2:
                // 第2层：2个小史莱姆
                this.enemies.push(new Enemy('slime_small_1', '小史莱姆 A', 25));
                this.enemies.push(new Enemy('slime_small_2', '小史莱姆 B', 25));
                break;
            case 3:
                // 第3层：精英怪 - 地精大块头
                const gremlinNob = new Enemy('gremlin_nob', '地精大块头', 90);
                gremlinNob.isElite = true;
                this.enemies.push(gremlinNob);
                break;
            case 4:
                // 第4层：大地精
                this.enemies.push(new Enemy('goblin_large', '大地精', 70));
                break;
            case 5:
                // 第5层：BOSS战 - 邪教徒 + 大地精
                this.enemies.push(new Enemy('cultist', '邪教徒', 60));
                this.enemies.push(new Enemy('goblin_large', '大地精护卫', 80));
                break;
            default:
                // 默认生成2个小史莱姆
                this.enemies.push(new Enemy('slime_small_1', '小史莱姆 A', 25));
                this.enemies.push(new Enemy('slime_small_2', '小史莱姆 B', 25));
        }

        console.log(`生成了 ${this.enemies.length} 个敌人`);
    }

    /**
     * 开始新回合
     */
    startNewTurn() {
        this.turnNumber++;
        console.log(`=== 第 ${this.turnNumber} 回合 ===`);

        // 重置能量
        this.player.resetEnergy();

        // 保留格挡（如果有保留格挡状态）
        this.player.resetBlock();

        // 抽牌
        this.deckManager.drawCards(5);

        // 触发遗物效果 - 回合开始
        this.player.triggerRelicsOnTurnStart(this);

        // 敌人生成意图
        this.enemies.forEach(enemy => {
            if (!enemy.isDead()) {
                enemy.generateIntent();
            }
        });

        this.addLog(`第 ${this.turnNumber} 回合开始`);
    }

    /**
     * 结束玩家回合
     */
    async endPlayerTurn() {
        if (this.currentPhase !== TurnPhase.PLAYER_TURN) {
            return;
        }

        console.log('=== 结束玩家回合 ===');
        this.currentPhase = TurnPhase.ENEMY_TURN;

        // 弃掉手牌
        this.deckManager.discardHand();

        // 处理玩家回合结束时的状态效果
        this.player.processTurnEndStatuses();

        // 执行敌人回合
        await this.executeEnemyTurn();

        // 检查游戏是否结束
        if (this.player.isDead()) {
            this.currentPhase = TurnPhase.GAME_OVER;
            console.log('=== 游戏结束 - 玩家死亡 ===');
            if (this.onDefeat) {
                this.onDefeat();
            }
            return;
        }

        // 切换回玩家回合
        this.currentPhase = TurnPhase.PLAYER_TURN;
        this.startNewTurn();
    }

    /**
     * 执行敌人回合
     */
    async executeEnemyTurn() {
        console.log('=== 敌人回合 ===');

        for (const enemy of this.enemies) {
            if (!enemy.isDead()) {
                // 敌人回合开始时重置格挡
                enemy.resetBlock();

                // 如果是攻击意图，先播放攻击动画
                if (enemy.intentType === 'attack') {
                    enemy.playAttackAnimation();
                    await sleep(100);
                }

                // 执行意图
                enemy.executeIntent(this.player);

                // 延时让玩家看清敌人攻击
                await sleep(500);

                // 处理敌人回合结束时的状态效果
                enemy.processTurnEndStatuses();

                // 生成新意图
                enemy.generateIntent();
            }
        }
    }

    /**
     * 打出卡牌
     * @param {Card} card - 要打出的卡牌
     * @param {Entity} target - 目标
     * @returns {boolean} 是否成功
     */
    playCard(card, target) {
        if (this.currentPhase !== TurnPhase.PLAYER_TURN) {
            console.log('不是玩家回合！');
            return false;
        }

        // 检查能量
        if (this.player.energy < card.cost) {
            console.log('能量不足！');
            return false;
        }

        // 检查钢笔尖遗物是否应该翻倍伤害
        let damageMultiplier = 1;
        for (const relic of this.player.relics) {
            if (relic.shouldDoubleDamage && relic.shouldDoubleDamage()) {
                damageMultiplier = 2;
                console.log(`[遗物] ${relic.name} 效果：伤害翻倍！`);
            }
        }

        // 如果是攻击牌，播放攻击动画
        if (card.type === 'attack') {
            this.player.playAttackAnimation();
        }

        // 执行卡牌效果
        if (card.play(this.player, target, this, damageMultiplier)) {
            // 将卡牌从手牌移到弃牌堆/消耗堆
            this.deckManager.playCard(card);

            // 触发遗物效果 - 打出卡牌
            this.player.triggerRelicsOnCardPlayed(this, card);

            // 触发敌人被动技能 - 玩家打出卡牌
            this.enemies.forEach(enemy => {
                if (!enemy.isDead() && enemy.onPlayerCardPlayed) {
                    enemy.onPlayerCardPlayed(card);
                }
            });

            this.addLog(`${this.player.name} 使用了 ${card.name}`);

            // 检查胜利条件
            const aliveEnemies = this.enemies.filter(e => !e.isDead());
            if (aliveEnemies.length === 0) {
                this.currentPhase = TurnPhase.GAME_OVER;
                console.log('=== 胜利！所有敌人被击败 ===');
                if (this.onVictory) {
                    this.onVictory();
                }
            }

            return true;
        }

        return false;
    }

    /**
     * 获取活着的敌人
     * @returns {Array}
     */
    getAliveEnemies() {
        return this.enemies.filter(e => !e.isDead());
    }

    /**
     * 获取指定ID的敌人
     * @param {string} id - 敌人ID
     * @returns {Enemy|null}
     */
    getEnemyById(id) {
        return this.enemies.find(e => e.id === id && !e.isDead()) || null;
    }

    /**
     * 添加战斗日志
     * @param {string} message - 日志消息
     */
    addLog(message) {
        this.battleLog.push({
            turn: this.turnNumber,
            message: message,
            timestamp: Date.now()
        });
        console.log(`[回合${this.turnNumber}] ${message}`);
    }

    /**
     * 获取游戏状态摘要
     * @returns {Object}
     */
    getSummary() {
        return {
            player: this.player.getStatusInfo(),
            enemies: this.enemies.map(e => e.getStatusInfo()),
            deck: this.deckManager.getStatus(),
            phase: this.currentPhase,
            turn: this.turnNumber,
            floor: `${this.currentFloor}/${this.maxFloor}`
        };
    }
}
