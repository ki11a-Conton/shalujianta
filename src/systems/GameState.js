/**
 * ============================================
 * GameState - 游戏状态核心
 * 杀戮尖塔风格的战斗逻辑
 * ============================================
 */

import { TurnPhase, sleep, CardType, StatusType } from '../config/constants.js';
import { Enemy, EnemyFactory } from '../entities/Enemy.js';
import { CardFactory } from '../cards/Card.js';

export class GameState {
    constructor(player, deckManager) {
        this.player = player;
        this.deckManager = deckManager;
        this.enemies = [];

        this.currentPhase = TurnPhase.PLAYER_TURN;
        this.turnNumber = 1;

        this.currentFloor = 1;
        this.maxFloor = 5;

        this.battleLog = [];

        this.onVictory = null;
        this.onDefeat = null;
        
        this.cardsPlayedThisTurn = 0;
        this.attacksPlayedThisTurn = 0;
        this.skillsPlayedThisTurn = 0;
        this.damageDealtThisTurn = 0;
        
        this.rageBlockBonus = 0;
        this.noDrawThisTurn = false;
    }

    initBattle() {
        console.log('=== 初始化战斗 ===');

        this.player.resetEnergy();
        this.player.resetBlock();
        this.player.processTurnEndStatuses();

        this.generateEnemies();

        this.deckManager.initBattle(5);

        this.currentPhase = TurnPhase.PLAYER_TURN;
        this.turnNumber = 1;
        this.battleLog = [];
        
        this.cardsPlayedThisTurn = 0;
        this.attacksPlayedThisTurn = 0;
        this.skillsPlayedThisTurn = 0;
        this.damageDealtThisTurn = 0;
        this.rageBlockBonus = 0;
        this.noDrawThisTurn = false;

        this.player.triggerRelicsOnBattleStart(this);

        this.enemies.forEach(enemy => {
            if (!enemy.isDead()) {
                enemy.generateIntent();
            }
        });

        this.addLog('战斗开始！');
    }

    generateEnemies() {
        this.enemies = [];

        switch (this.currentFloor) {
            case 1:
                this.enemies = EnemyFactory.generateEncounter(1, false, false);
                break;
            case 2:
                this.enemies = EnemyFactory.generateEncounter(2, false, false);
                break;
            case 3:
                this.enemies = EnemyFactory.generateEncounter(3, true, false);
                break;
            case 4:
                this.enemies = EnemyFactory.generateEncounter(4, false, false);
                break;
            case 5:
                this.enemies = EnemyFactory.generateEncounter(5, false, true);
                break;
            default:
                this.enemies = EnemyFactory.generateEncounter(this.currentFloor, false, false);
        }

        console.log(`生成了 ${this.enemies.length} 个敌人: ${this.enemies.map(e => e.name).join(', ')}`);
    }

    startNewTurn() {
        this.turnNumber++;
        console.log(`=== 第 ${this.turnNumber} 回合 ===`);

        this.player.resetEnergy();
        this.player.resetBlock();

        if (!this.noDrawThisTurn) {
            this.deckManager.drawCards(5);
        }
        this.noDrawThisTurn = false;

        this.player.triggerRelicsOnTurnStart(this);

        this.enemies.forEach(enemy => {
            if (!enemy.isDead()) {
                enemy.generateIntent();
            }
        });
        
        this.cardsPlayedThisTurn = 0;
        this.attacksPlayedThisTurn = 0;
        this.skillsPlayedThisTurn = 0;
        this.damageDealtThisTurn = 0;
        this.rageBlockBonus = 0;

        this.addLog(`第 ${this.turnNumber} 回合开始`);
    }

    async endPlayerTurn() {
        if (this.currentPhase !== TurnPhase.PLAYER_TURN) {
            return;
        }

        console.log('=== 结束玩家回合 ===');
        this.currentPhase = TurnPhase.ENEMY_TURN;

        this.deckManager.discardHand();

        this.player.processTurnEndStatuses();

        await this.executeEnemyTurn();

        if (this.player.isDead()) {
            this.currentPhase = TurnPhase.GAME_OVER;
            console.log('=== 游戏结束 - 玩家死亡 ===');
            if (this.onDefeat) {
                this.onDefeat();
            }
            return;
        }

        this.currentPhase = TurnPhase.PLAYER_TURN;
        this.startNewTurn();
    }

    async executeEnemyTurn() {
        console.log('=== 敌人回合 ===');

        for (const enemy of this.enemies) {
            if (!enemy.isDead()) {
                enemy.resetBlock();

                if (enemy.intentType === 'attack' || enemy.intentType === 'attack_defend') {
                    enemy.playAttackAnimation();
                    await sleep(100);
                }

                enemy.executeIntent(this.player);

                await sleep(500);

                enemy.processTurnEndStatuses();
            }
        }
    }

    playCard(card, target) {
        if (this.currentPhase !== TurnPhase.PLAYER_TURN) {
            console.log('不是玩家回合！');
            return false;
        }

        if (this.player.energy < card.cost) {
            console.log('能量不足！');
            return false;
        }

        let damageMultiplier = 1;
        for (const relic of this.player.relics) {
            if (relic.shouldDoubleDamage && relic.shouldDoubleDamage()) {
                damageMultiplier = 2;
                console.log(`[遗物] ${relic.name} 效果：伤害翻倍！`);
            }
        }

        if (card.type === CardType.ATTACK) {
            this.player.playAttackAnimation();
            this.attacksPlayedThisTurn++;
            
            if (this.rageBlockBonus > 0) {
                this.player.gainBlock(this.rageBlockBonus);
                console.log(`[狂怒] 获得 ${this.rageBlockBonus} 点格挡`);
            }
        }
        
        if (card.type === CardType.SKILL) {
            this.skillsPlayedThisTurn++;
        }

        if (card.play(this.player, target, this, damageMultiplier)) {
            this.deckManager.playCard(card);
            
            this.cardsPlayedThisTurn++;
            if (card.damageDealt > 0) {
                this.damageDealtThisTurn += card.damageDealt;
            }

            this.player.triggerRelicsOnCardPlayed(this, card);

            this.enemies.forEach(enemy => {
                if (!enemy.isDead() && enemy.onPlayerCardPlayed) {
                    enemy.onPlayerCardPlayed(card);
                }
            });

            this.addLog(`${this.player.name} 使用了 ${card.name}`);

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

    getAliveEnemies() {
        return this.enemies.filter(e => !e.isDead());
    }

    getEnemyById(id) {
        return this.enemies.find(e => e.id === id && !e.isDead()) || null;
    }

    addLog(message) {
        this.battleLog.push({
            turn: this.turnNumber,
            message: message,
            timestamp: Date.now()
        });
        console.log(`[回合${this.turnNumber}] ${message}`);
    }

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
