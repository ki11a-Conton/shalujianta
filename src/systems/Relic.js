/**
 * ============================================
 * Relic - 遗物系统
 * 杀戮尖塔风格的遗物系统
 * ============================================
 */

import { StatusType } from '../config/constants.js';

export class Relic {
    constructor(id, name, description, rarity = 'common') {
        this.id = id;
        this.name = name;
        this.description = description;
        this.rarity = rarity;
        this.counter = 0;
    }

    onBattleStart(gameState) {}
    onTurnStart(gameState) {}
    onTurnEnd(gameState) {}
    onCardPlayed(gameState, card) {}
    onAttackPlayed(gameState, card) {}
    onVictory(gameState) {}
    onPlayerDamaged(gameState, damage) {}
    onEnemyKilled(gameState, enemy) {}
}

/**
 * 燃烧之血 - 战斗胜利后回复6点生命
 */
export class BurningBloodRelic extends Relic {
    constructor() {
        super('burning_blood', '燃烧之血', '战斗结束时回复 6 点生命值', 'starter');
    }

    onVictory(gameState) {
        gameState.player.heal(6);
        console.log(`[遗物] ${this.name} 触发：回复 6 点生命值`);
    }
}

/**
 * 金刚杵 - 战斗开始时获得1层力量
 */
export class VajraRelic extends Relic {
    constructor() {
        super('vajra', '金刚杵', '战斗开始时获得 1 层力量', 'common');
    }

    onBattleStart(gameState) {
        gameState.player.applyStatus(StatusType.STRENGTH, 1);
        console.log(`[遗物] ${this.name} 触发：获得 1 层力量`);
    }
}

/**
 * 船锚 - 战斗开始时获得10点格挡
 */
export class AnchorRelic extends Relic {
    constructor() {
        super('anchor', '船锚', '战斗开始时获得 10 点格挡', 'common');
    }

    onBattleStart(gameState) {
        gameState.player.gainBlock(10);
        console.log(`[遗物] ${this.name} 触发：获得 10 点格挡`);
    }
}

/**
 * 红石 - 每回合开始时获得1点能量
 */
export class RedStoneRelic extends Relic {
    constructor() {
        super('red_stone', '红石', '每回合开始时获得 1 点能量', 'boss');
    }

    onTurnStart(gameState) {
        gameState.player.energy += 1;
        console.log(`[遗物] ${this.name} 触发：获得 1 点能量`);
    }
}

/**
 * 钢笔尖 - 每打出第10张攻击牌，伤害翻倍
 */
export class PenNibRelic extends Relic {
    constructor() {
        super('pen_nib', '钢笔尖', '每打出第 10 张攻击牌，该牌伤害翻倍', 'uncommon');
        this.attackCount = 0;
        this.nextAttackDoubled = false;
    }

    onCardPlayed(gameState, card) {
        if (card.type === 'attack') {
            this.attackCount++;
            
            if (this.attackCount >= 10) {
                this.nextAttackDoubled = true;
                this.attackCount = 0;
                console.log(`[遗物] ${this.name} 充能完成！下一张攻击牌伤害翻倍`);
            } else {
                console.log(`[遗物] ${this.name} 充能进度: ${this.attackCount}/10`);
            }
        }
    }

    onBattleStart(gameState) {
        this.attackCount = 0;
        this.nextAttackDoubled = false;
    }

    shouldDoubleDamage() {
        if (this.nextAttackDoubled) {
            this.nextAttackDoubled = false;
            return true;
        }
        return false;
    }
}

/**
 * 痛苦之轮 - 每打出一张技能牌，获得1点格挡
 */
export class PainWheelRelic extends Relic {
    constructor() {
        super('pain_wheel', '痛苦之轮', '每打出一张技能牌，获得 1 点格挡', 'uncommon');
    }

    onCardPlayed(gameState, card) {
        if (card.type === 'skill') {
            gameState.player.gainBlock(1);
            console.log(`[遗物] ${this.name} 触发：获得 1 点格挡`);
        }
    }
}

/**
 * 琥珀 - 战斗开始时抽2张牌
 */
export class AmberRelic extends Relic {
    constructor() {
        super('amber', '琥珀', '战斗开始时额外抽 2 张牌', 'uncommon');
    }

    onBattleStart(gameState) {
        gameState.deckManager.drawCards(2);
        console.log(`[遗物] ${this.name} 触发：额外抽 2 张牌`);
    }
}

/**
 * 碎裂王冠 - 金币奖励增加50%
 */
export class BrokenCrownRelic extends Relic {
    constructor() {
        super('broken_crown', '碎裂王冠', '金币奖励增加 50%', 'rare');
    }

    getBonusGold(baseGold) {
        return Math.floor(baseGold * 0.5);
    }
}

/**
 * 金币袋 - 战斗胜利时额外获得金币
 */
export class CoinBagRelic extends Relic {
    constructor() {
        super('coin_bag', '金币袋', '战斗胜利时额外获得 20 金币', 'common');
        this.bonusGold = 20;
    }

    onVictory(gameState) {
        gameState.player.gainGold(this.bonusGold);
        console.log(`[遗物] ${this.name} 触发：额外获得 ${this.bonusGold} 金币`);
    }
}

/**
 * 冰淇淋 - 战斗第一回合额外获得2点能量
 */
export class IceCreamRelic extends Relic {
    constructor() {
        super('ice_cream', '冰淇淋', '战斗第一回合额外获得 2 点能量', 'uncommon');
        this.firstTurn = true;
    }

    onBattleStart(gameState) {
        this.firstTurn = true;
    }

    onTurnStart(gameState) {
        if (this.firstTurn) {
            gameState.player.energy += 2;
            console.log(`[遗物] ${this.name} 触发：第一回合额外获得 2 点能量`);
            this.firstTurn = false;
        }
    }
}

/**
 * 灯笼 - 战斗第一回合获得额外能量
 */
export class LanternRelic extends Relic {
    constructor() {
        super('lantern', '灯笼', '战斗第一回合获得 1 点额外能量', 'common');
        this.firstTurn = true;
    }

    onBattleStart(gameState) {
        this.firstTurn = true;
    }

    onTurnStart(gameState) {
        if (this.firstTurn) {
            gameState.player.energy += 1;
            console.log(`[遗物] ${this.name} 触发：第一回合获得 1 点额外能量`);
            this.firstTurn = false;
        }
    }
}

/**
 * 蛇油 - 每打出一张能力牌，获得1点能量
 */
export class SnakeOilRelic extends Relic {
    constructor() {
        super('snake_oil', '蛇油', '每打出一张能力牌，获得 1 点能量', 'uncommon');
    }

    onCardPlayed(gameState, card) {
        if (card.type === 'power') {
            gameState.player.energy += 1;
            console.log(`[遗物] ${this.name} 触发：获得 1 点能量`);
        }
    }
}

/**
 * 铁扇 - 战斗开始时获得1层敏捷
 */
export class IronFanRelic extends Relic {
    constructor() {
        super('iron_fan', '铁扇', '战斗开始时获得 1 层敏捷', 'uncommon');
    }

    onBattleStart(gameState) {
        gameState.player.applyStatus(StatusType.DEXTERITY, 1);
        console.log(`[遗物] ${this.name} 触发：获得 1 层敏捷`);
    }
}

/**
 * 铃铛 - 每打出一张攻击牌，获得1点格挡
 */
export class OrnamentalFanRelic extends Relic {
    constructor() {
        super('ornamental_fan', '装饰扇', '每回合打出 3 张攻击牌后，获得 4 点格挡', 'uncommon');
        this.attacksThisTurn = 0;
    }

    onTurnStart(gameState) {
        this.attacksThisTurn = 0;
    }

    onCardPlayed(gameState, card) {
        if (card.type === 'attack') {
            this.attacksThisTurn++;
            if (this.attacksThisTurn >= 3) {
                gameState.player.gainBlock(4);
                this.attacksThisTurn = 0;
                console.log(`[遗物] ${this.name} 触发：获得 4 点格挡`);
            }
        }
    }
}

/**
 * 幸运硬币 - 战斗胜利时额外获得金币
 */
export class LuckyCoinRelic extends Relic {
    constructor() {
        super('lucky_coin', '幸运硬币', '战斗胜利时有 50% 概率获得双倍金币', 'uncommon');
    }

    onVictory(gameState) {
        if (Math.random() < 0.5) {
            const bonus = 10 + Math.floor(Math.random() * 10);
            gameState.player.gainGold(bonus);
            console.log(`[遗物] ${this.name} 触发：获得额外 ${bonus} 金币`);
        }
    }
}

/**
 * 血瓶 - 战斗结束时若生命值低于50%，回复生命
 */
export class BloodBottleRelic extends Relic {
    constructor() {
        super('blood_bottle', '血瓶', '战斗结束时若生命值低于 50%，回复 5 点生命', 'common');
    }

    onVictory(gameState) {
        const player = gameState.player;
        if (player.hp < player.maxHp * 0.5) {
            player.heal(5);
            console.log(`[遗物] ${this.name} 触发：回复 5 点生命`);
        }
    }
}

/**
 * 骨头 - 每回合抽牌数+1
 */
export class BagOfPreparationRelic extends Relic {
    constructor() {
        super('bag_of_preparation', '准备袋', '每回合开始时额外抽 1 张牌', 'uncommon');
    }

    onTurnStart(gameState) {
        gameState.deckManager.drawCards(1);
        console.log(`[遗物] ${this.name} 触发：额外抽 1 张牌`);
    }
}

/**
 * 遗物工厂
 */
export class RelicFactory {
    static createRelic(id) {
        const relicMap = {
            'burning_blood': BurningBloodRelic,
            'vajra': VajraRelic,
            'anchor': AnchorRelic,
            'red_stone': RedStoneRelic,
            'pen_nib': PenNibRelic,
            'pain_wheel': PainWheelRelic,
            'amber': AmberRelic,
            'broken_crown': BrokenCrownRelic,
            'coin_bag': CoinBagRelic,
            'ice_cream': IceCreamRelic,
            'lantern': LanternRelic,
            'snake_oil': SnakeOilRelic,
            'iron_fan': IronFanRelic,
            'ornamental_fan': OrnamentalFanRelic,
            'lucky_coin': LuckyCoinRelic,
            'blood_bottle': BloodBottleRelic,
            'bag_of_preparation': BagOfPreparationRelic,
        };
        
        const RelicClass = relicMap[id];
        return RelicClass ? new RelicClass() : null;
    }
    
    static getRandomRelic(rarity = null) {
        const commonRelics = [
            'vajra', 'anchor', 'coin_bag', 'lantern', 'blood_bottle'
        ];
        
        const uncommonRelics = [
            'pen_nib', 'pain_wheel', 'amber', 'ice_cream', 'snake_oil',
            'iron_fan', 'ornamental_fan', 'lucky_coin', 'bag_of_preparation'
        ];
        
        const rareRelics = [
            'broken_crown'
        ];
        
        let pool;
        if (rarity === 'common') {
            pool = commonRelics;
        } else if (rarity === 'uncommon') {
            pool = uncommonRelics;
        } else if (rarity === 'rare') {
            pool = rareRelics;
        } else {
            pool = [...commonRelics, ...uncommonRelics, ...rareRelics];
        }
        
        const randomId = pool[Math.floor(Math.random() * pool.length)];
        return RelicFactory.createRelic(randomId);
    }
    
    static getStarterRelics() {
        return [new BurningBloodRelic()];
    }
}
