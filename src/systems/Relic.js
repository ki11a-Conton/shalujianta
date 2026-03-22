/**
 * ============================================
 * Relic - 遗物系统
 * 定义遗物基类和具体遗物实现
 * ============================================
 */

import { StatusType } from '../config/constants.js';

/**
 * 遗物基类
 */
export class Relic {
    /**
     * @param {string} id - 遗物唯一标识
     * @param {string} name - 遗物名称
     * @param {string} description - 遗物描述
     */
    constructor(id, name, description) {
        this.id = id;
        this.name = name;
        this.description = description;
    }

    /**
     * 战斗开始时触发
     * @param {GameState} gameState - 游戏状态
     */
    onBattleStart(gameState) {
        // 子类重写
    }

    /**
     * 回合开始时触发
     * @param {GameState} gameState - 游戏状态
     */
    onTurnStart(gameState) {
        // 子类重写
    }

    /**
     * 打出卡牌时触发
     * @param {GameState} gameState - 游戏状态
     * @param {Card} card - 打出的卡牌
     */
    onCardPlayed(gameState, card) {
        // 子类重写
    }
}

/**
 * 金刚杵 - 战斗开始时获得力量
 */
export class VajraRelic extends Relic {
    constructor() {
        super('vajra', '金刚杵', '战斗开始时获得 1 层力量');
    }

    onBattleStart(gameState) {
        gameState.player.applyStatus(StatusType.STRENGTH, 1);
        console.log(`[遗物] ${this.name} 触发：获得 1 层力量`);
    }
}

/**
 * 船锚 - 战斗开始时获得格挡
 */
export class AnchorRelic extends Relic {
    constructor() {
        super('anchor', '船锚', '战斗开始时获得 10 点格挡');
    }

    onBattleStart(gameState) {
        gameState.player.gainBlock(10);
        console.log(`[遗物] ${this.name} 触发：获得 10 点格挡`);
    }
}

/**
 * 红石 - 每回合开始时获得 1 点能量
 */
export class RedStoneRelic extends Relic {
    constructor() {
        super('red_stone', '红石', '每回合开始时获得 1 点能量');
    }

    onTurnStart(gameState) {
        gameState.player.energy += 1;
        console.log(`[遗物] ${this.name} 触发：获得 1 点能量`);
    }
}

/**
 * 羽毛 - 抽牌时多抽 1 张
 */
export class FeatherRelic extends Relic {
    constructor() {
        super('feather', '羽毛', '每回合抽牌时多抽 1 张');
    }

    onTurnStart(gameState) {
        // 这个效果需要在抽牌逻辑中特殊处理
        console.log(`[遗物] ${this.name} 生效：抽牌 +1`);
    }
}

/**
 * 金币袋 - 战斗胜利时额外获得金币
 */
export class CoinBagRelic extends Relic {
    constructor() {
        super('coin_bag', '金币袋', '战斗胜利时额外获得 20 金币');
        this.bonusGold = 20;
    }

    // 这个效果需要在胜利结算时调用
    onVictory(gameState) {
        gameState.player.gainGold(this.bonusGold);
        console.log(`[遗物] ${this.name} 触发：额外获得 ${this.bonusGold} 金币`);
    }
}
