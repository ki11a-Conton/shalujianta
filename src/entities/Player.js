/**
 * ============================================
 * Player - 玩家类
 * 继承自 Entity，包含玩家特有的属性和方法
 * ============================================
 */

import { Entity } from './Entity.js';

export class Player extends Entity {
    /**
     * @param {string} id - 玩家标识
     * @param {string} name - 玩家名称
     * @param {number} maxHp - 最大生命值
     * @param {number} x - 渲染位置 x
     * @param {number} y - 渲染位置 y
     */
    constructor(id, name, maxHp, x = 0, y = 0) {
        super(id, name, maxHp, x, y, 120, 180);

        // 玩家特有属性
        this.maxEnergy = 3;          // 最大能量
        this.energy = 3;             // 当前能量
        this.gold = 0;               // 金币
        this.relics = [];            // 遗物数组
    }

    /**
     * 重置能量（回合开始时调用）
     */
    resetEnergy() {
        this.energy = this.maxEnergy;
    }

    /**
     * 消耗能量
     * @param {number} amount - 消耗量
     * @returns {boolean} 是否成功消耗
     */
    spendEnergy(amount) {
        if (this.energy >= amount) {
            this.energy -= amount;
            return true;
        }
        return false;
    }

    /**
     * 获得金币
     * @param {number} amount - 金币数量
     */
    gainGold(amount) {
        this.gold += amount;
        if (this.onFloatingText) {
            this.onFloatingText(`+${amount} 金币`, '#f1c40f');
        }
    }

    /**
     * 添加遗物
     * @param {Relic} relic - 遗物对象
     */
    addRelic(relic) {
        this.relics.push(relic);
        console.log(`获得遗物：${relic.name}`);
    }

    /**
     * 触发遗物效果 - 战斗开始时
     * @param {GameState} gameState - 游戏状态
     */
    triggerRelicsOnBattleStart(gameState) {
        this.relics.forEach(relic => {
            if (relic.onBattleStart) {
                relic.onBattleStart(gameState);
            }
        });
    }

    /**
     * 触发遗物效果 - 回合开始时
     * @param {GameState} gameState - 游戏状态
     */
    triggerRelicsOnTurnStart(gameState) {
        this.relics.forEach(relic => {
            if (relic.onTurnStart) {
                relic.onTurnStart(gameState);
            }
        });
    }

    /**
     * 触发遗物效果 - 打出卡牌时
     * @param {GameState} gameState - 游戏状态
     * @param {Card} card - 打出的卡牌
     */
    triggerRelicsOnCardPlayed(gameState, card) {
        this.relics.forEach(relic => {
            if (relic.onCardPlayed) {
                relic.onCardPlayed(gameState, card);
            }
        });
    }

    /**
     * 获取玩家状态（包含遗物信息）
     * @returns {Object}
     */
    getStatusInfo() {
        const baseInfo = super.getStatusInfo();
        return {
            ...baseInfo,
            energy: this.energy,
            maxEnergy: this.maxEnergy,
            gold: this.gold,
            relicCount: this.relics.length
        };
    }
}
