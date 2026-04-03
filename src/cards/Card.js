/**
 * ============================================
 * Card - 卡牌类
 * 杀戮尖塔风格的卡牌系统，包含升级机制
 * ============================================
 */

import { CardType, CardTarget, StatusType } from '../config/constants.js';
import { Player } from '../entities/Player.js';

export class Card {
    /**
     * @param {string} id - 卡牌唯一标识
     * @param {string} name - 卡牌名称
     * @param {number} cost - 能量消耗
     * @param {string} type - 卡牌类型 (attack/skill/power)
     * @param {string} target - 目标类型
     * @param {number} value - 效果数值 (伤害/格挡等)
     * @param {string} description - 卡牌描述
     * @param {Array} effects - 额外效果数组
     * @param {Object} keywords - 卡牌关键字
     * @param {Object} upgradeData - 升级数据
     */
    constructor(id, name, cost, type, target, value, description = '', effects = [], keywords = {}, upgradeData = null) {
        this.id = id;
        this.name = name;
        this.baseCost = cost;
        this.cost = cost;
        this.type = type;
        this.target = target;
        this.baseValue = value;
        this.value = value;
        this.description = description || this.generateDescription();
        this.effects = effects;
        
        this.keywords = {
            exhaust: keywords.exhaust || false,
            innate: keywords.innate || false,
            retain: keywords.retain || false,
            ethereal: keywords.ethereal || false,
            unplayable: keywords.unplayable || false,
            multiHit: keywords.multiHit || 1
        };
        
        this.upgradeData = upgradeData;
        this.isUpgraded = false;
        this.upgradedName = name + '+';
        
        this.x = 0;
        this.y = 0;
        this.targetX = 0;
        this.targetY = 0;
        this.width = 150;
        this.height = 200;
        this.isHovered = false;
        this.isSelected = false;
        this.lerpSpeed = 0.15;
        
        this.damageDealt = 0;
        this.blockGained = 0;
    }

    update(deltaTime) {
        const speed = this.lerpSpeed * (deltaTime / 16.67);
        this.x += (this.targetX - this.x) * speed;
        this.y += (this.targetY - this.y) * speed;
    }

    /**
     * 升级卡牌
     */
    upgrade() {
        if (this.isUpgraded || !this.upgradeData) return false;
        
        this.isUpgraded = true;
        this.name = this.upgradedName;
        
        if (this.upgradeData.cost !== undefined) {
            this.cost = this.upgradeData.cost;
            this.baseCost = this.upgradeData.cost;
        }
        if (this.upgradeData.value !== undefined) {
            this.value = this.upgradeData.value;
            this.baseValue = this.upgradeData.value;
        }
        if (this.upgradeData.description) {
            this.description = this.upgradeData.description;
        }
        if (this.upgradeData.effects) {
            this.effects = this.upgradeData.effects;
        }
        if (this.upgradeData.keywords) {
            this.keywords = { ...this.keywords, ...this.upgradeData.keywords };
        }
        
        console.log(`卡牌升级: ${this.name}`);
        return true;
    }

    /**
     * 计算最终伤害值
     */
    calculateDamage(caster, baseDamage = null) {
        const damage = baseDamage !== null ? baseDamage : this.value;
        const strength = caster.getStatus(StatusType.STRENGTH);
        const weak = caster.getStatus(StatusType.WEAK);
        
        let finalDamage = damage + strength;
        
        if (weak > 0) {
            finalDamage = Math.floor(finalDamage * 0.75);
        }
        
        return Math.max(0, finalDamage);
    }

    /**
     * 计算最终格挡值
     */
    calculateBlock(caster, baseBlock = null) {
        const block = baseBlock !== null ? baseBlock : this.value;
        const dexterity = caster.getStatus(StatusType.DEXTERITY);
        const frail = caster.getStatus(StatusType.FRAIL);
        
        let finalBlock = block + dexterity;
        
        if (frail > 0) {
            finalBlock = Math.floor(finalBlock * 0.75);
        }
        
        return Math.max(0, finalBlock);
    }

    /**
     * 执行卡牌效果
     */
    play(caster, target, gameState, damageMultiplier = 1) {
        console.log(`使用卡牌: ${this.name}`);

        if (caster instanceof Player && !caster.spendEnergy(this.cost)) {
            console.log('能量不足！');
            return false;
        }

        this.executeBaseEffect(caster, target, gameState, damageMultiplier);
        this.executeEffects(caster, target, gameState);

        if (this.keywords.exhaust) {
            console.log(`卡牌 ${this.name} 被消耗`);
        }

        return true;
    }

    /**
     * 执行卡牌基础效果
     */
    executeBaseEffect(caster, target, gameState, damageMultiplier = 1) {
        switch (this.type) {
            case CardType.ATTACK:
                if (target) {
                    const hitCount = this.keywords.multiHit || 1;
                    let totalDamage = 0;
                    for (let i = 0; i < hitCount; i++) {
                        const finalDamage = Math.floor(this.calculateDamage(caster) * damageMultiplier);
                        target.takeDamage(finalDamage);
                        totalDamage += finalDamage;
                        console.log(`第 ${i + 1} 次攻击造成 ${finalDamage} 点伤害`);
                    }
                    this.damageDealt = totalDamage;
                }
                break;

            case CardType.SKILL:
                if (this.target === CardTarget.SELF || this.target === CardTarget.NONE) {
                    const finalBlock = this.calculateBlock(caster);
                    if (this.value > 0) {
                        caster.gainBlock(finalBlock);
                        this.blockGained = finalBlock;
                    }
                }
                break;

            case CardType.POWER:
                this.executePowerEffect(caster, gameState);
                break;
        }
    }

    /**
     * 执行能力牌效果
     */
    executePowerEffect(caster, gameState) {
        this.effects.forEach(effect => {
            switch (effect.type) {
                case 'gain_strength':
                    caster.applyStatus(StatusType.STRENGTH, effect.value);
                    break;
                case 'gain_dexterity':
                    caster.applyStatus(StatusType.DEXTERITY, effect.value);
                    break;
                case 'retain_block':
                    caster.applyStatus(StatusType.RETAIN_BLOCK, 1);
                    break;
            }
        });
    }

    /**
     * 执行复合效果
     */
    executeEffects(caster, target, gameState) {
        if (!this.effects || this.effects.length === 0) return;

        this.effects.forEach(effect => {
            switch (effect.type) {
                case 'draw':
                    gameState.deckManager.drawCards(effect.value);
                    console.log(`抽 ${effect.value} 张牌`);
                    break;

                case 'apply_status':
                    const statusTarget = effect.target === 'self' ? caster : target;
                    if (statusTarget && effect.status) {
                        statusTarget.applyStatus(effect.status, effect.value);
                    }
                    break;

                case 'gain_energy':
                    if (caster instanceof Player) {
                        caster.energy += effect.value;
                        console.log(`获得 ${effect.value} 点能量`);
                    }
                    break;

                case 'heal':
                    caster.heal(effect.value);
                    break;

                case 'damage_all':
                    gameState.enemies.forEach(enemy => {
                        if (!enemy.isDead()) {
                            const dmg = this.calculateDamage(caster, effect.value);
                            enemy.takeDamage(dmg);
                        }
                    });
                    break;

                case 'double_poison':
                    if (target) {
                        const currentPoison = target.getStatus(StatusType.POISON);
                        if (currentPoison > 0) {
                            target.applyStatus(StatusType.POISON, currentPoison);
                        }
                    }
                    break;

                case 'random_debuff':
                    if (target) {
                        const debuffs = [StatusType.WEAK, StatusType.VULNERABLE];
                        const randomDebuff = debuffs[Math.floor(Math.random() * debuffs.length)];
                        target.applyStatus(randomDebuff, effect.value);
                    }
                    break;

                case 'gain_block_per_enemy':
                    const aliveEnemies = gameState.enemies.filter(e => !e.isDead());
                    const totalBlock = aliveEnemies.length * effect.value;
                    caster.gainBlock(totalBlock);
                    break;

                case 'damage_per_block':
                    if (target && caster.block > 0) {
                        const dmg = Math.min(caster.block, effect.value);
                        target.takeDamage(dmg);
                    }
                    break;

                case 'lose_hp':
                    caster.hp = Math.max(1, caster.hp - effect.value);
                    console.log(`失去 ${effect.value} 点生命值`);
                    break;

                case 'discard':
                    const hand = gameState.deckManager.hand;
                    const discardCount = Math.min(effect.value, hand.length);
                    for (let i = 0; i < discardCount; i++) {
                        if (hand.length > 0) {
                            const randomIndex = Math.floor(Math.random() * hand.length);
                            const card = hand.splice(randomIndex, 1)[0];
                            gameState.deckManager.discardPile.push(card);
                        }
                    }
                    break;
            }
        });
    }

    generateDescription() {
        switch (this.type) {
            case CardType.ATTACK:
                return `造成 ${this.value} 点伤害`;
            case CardType.SKILL:
                return this.target === CardTarget.SELF ? `获得 ${this.value} 点格挡` : '技能效果';
            case CardType.POWER:
                return '能力效果';
            default:
                return '';
        }
    }

    clone() {
        const cloned = new Card(
            this.id,
            this.isUpgraded ? this.name.replace('+', '') : this.name,
            this.baseCost,
            this.type,
            this.target,
            this.baseValue,
            this.description,
            this.effects ? JSON.parse(JSON.stringify(this.effects)) : [],
            this.keywords ? { ...this.keywords } : {},
            this.upgradeData ? JSON.parse(JSON.stringify(this.upgradeData)) : null
        );
        
        if (this.isUpgraded) {
            cloned.upgrade();
        }
        
        return cloned;
    }

    getInfo() {
        return {
            id: this.id,
            name: this.name,
            cost: this.cost,
            type: this.type,
            target: this.target,
            value: this.value,
            description: this.description,
            keywords: { ...this.keywords },
            isUpgraded: this.isUpgraded
        };
    }
}

/**
 * 卡牌工厂 - 创建所有杀戮尖塔风格的卡牌
 */
export class CardFactory {
    static createStrike() {
        return new Card(
            'strike', '打击', 1, CardType.ATTACK, CardTarget.ENEMY, 6,
            '造成 6 点伤害',
            [],
            {},
            { value: 9, description: '造成 9 点伤害' }
        );
    }

    static createDefend() {
        return new Card(
            'defend', '防御', 1, CardType.SKILL, CardTarget.SELF, 5,
            '获得 5 点格挡',
            [],
            {},
            { value: 8, description: '获得 8 点格挡' }
        );
    }

    static createBash() {
        return new Card(
            'bash', '痛击', 2, CardType.ATTACK, CardTarget.ENEMY, 8,
            '造成 8 点伤害，给予 2 层脆弱',
            [{ type: 'apply_status', status: StatusType.VULNERABLE, value: 2 }],
            {},
            { value: 10, description: '造成 10 点伤害，给予 3 层脆弱', effects: [{ type: 'apply_status', status: StatusType.VULNERABLE, value: 3 }] }
        );
    }

    static createCleave() {
        return new Card(
            'cleave', '顺劈', 1, CardType.ATTACK, CardTarget.ALL_ENEMIES, 8,
            '对所有敌人造成 8 点伤害',
            [{ type: 'damage_all', value: 8 }],
            {},
            { value: 11, description: '对所有敌人造成 11 点伤害', effects: [{ type: 'damage_all', value: 11 }] }
        );
    }

    static createIronWave() {
        return new Card(
            'iron_wave', '铁壁波', 1, CardType.ATTACK, CardTarget.ENEMY, 5,
            '获得 5 点格挡，造成 5 点伤害',
            [],
            {},
            { value: 7, description: '获得 5 点格挡，造成 7 点伤害' }
        );
    }

    static createPommelStrike() {
        return new Card(
            'pommel_strike', '柄击', 1, CardType.ATTACK, CardTarget.ENEMY, 9,
            '造成 9 点伤害，抽 1 张牌',
            [{ type: 'draw', value: 1 }],
            {},
            { value: 10, effects: [{ type: 'draw', value: 2 }], description: '造成 10 点伤害，抽 2 张牌' }
        );
    }

    static createTwinStrike() {
        return new Card(
            'twin_strike', '双击', 1, CardType.ATTACK, CardTarget.ENEMY, 5,
            '造成 5 点伤害 2 次',
            [],
            { multiHit: 2 },
            { value: 7, description: '造成 7 点伤害 2 次' }
        );
    }

    static createAnger() {
        return new Card(
            'anger', '愤怒', 0, CardType.ATTACK, CardTarget.ENEMY, 3,
            '造成 3 点伤害，将一张愤怒放入弃牌堆',
            [],
            {},
            { value: 6, description: '造成 6 点伤害，将一张愤怒放入弃牌堆' }
        );
    }

    static createClothesline() {
        return new Card(
            'clothesline', '晾衣绳', 2, CardType.ATTACK, CardTarget.ENEMY, 12,
            '造成 12 点伤害，给予 2 层虚弱',
            [{ type: 'apply_status', status: StatusType.WEAK, value: 2 }],
            {},
            { value: 14, effects: [{ type: 'apply_status', status: StatusType.WEAK, value: 3 }], description: '造成 14 点伤害，给予 3 层虚弱' }
        );
    }

    static createShrugItOff() {
        return new Card(
            'shrug_it_off', '耸肩', 1, CardType.SKILL, CardTarget.SELF, 8,
            '获得 8 点格挡，抽 1 张牌',
            [{ type: 'draw', value: 1 }],
            {},
            { value: 11, description: '获得 11 点格挡，抽 1 张牌' }
        );
    }

    static createArmaments() {
        return new Card(
            'armaments', '武装', 1, CardType.SKILL, CardTarget.SELF, 5,
            '获得 5 点格挡，本回合手牌中所有攻击牌伤害+5',
            [{ type: 'armaments', value: 5 }],
            {},
            { description: '获得 5 点格挡，升级手牌中所有攻击牌' }
        );
    }

    static createFlex() {
        return new Card(
            'flex', '充血', 0, CardType.SKILL, CardTarget.SELF, 0,
            '获得 2 层力量，回合结束时失去 2 层力量',
            [{ type: 'apply_status', status: StatusType.STRENGTH, value: 2, temporary: true }],
            {},
            { effects: [{ type: 'apply_status', status: StatusType.STRENGTH, value: 4, temporary: true }], description: '获得 4 层力量，回合结束时失去 4 层力量' }
        );
    }

    static createBattleTrance() {
        return new Card(
            'battle_trance', '战斗恍惚', 0, CardType.SKILL, CardTarget.SELF, 0,
            '抽 3 张牌，本回合不能再抽牌',
            [{ type: 'draw', value: 3 }, { type: 'no_draw' }],
            {},
            { effects: [{ type: 'draw', value: 4 }, { type: 'no_draw' }], description: '抽 4 张牌，本回合不能再抽牌' }
        );
    }

    static createTrueGrit() {
        return new Card(
            'true_grit', '真勇', 1, CardType.SKILL, CardTarget.SELF, 7,
            '获得 7 点格挡，随机消耗一张手牌',
            [{ type: 'exhaust_random', value: 1 }],
            {},
            { value: 9, description: '获得 9 点格挡，随机消耗一张手牌' }
        );
    }

    static createShockwave() {
        return new Card(
            'shockwave', '冲击波', 2, CardType.SKILL, CardTarget.ALL_ENEMIES, 0,
            '给予所有敌人 3 层虚弱和 3 层脆弱',
            [{ type: 'apply_status', status: StatusType.WEAK, value: 3, target: 'all_enemies' }, { type: 'apply_status', status: StatusType.VULNERABLE, value: 3, target: 'all_enemies' }],
            { exhaust: true },
            { effects: [{ type: 'apply_status', status: StatusType.WEAK, value: 5, target: 'all_enemies' }, { type: 'apply_status', status: StatusType.VULNERABLE, value: 5, target: 'all_enemies' }], description: '给予所有敌人 5 层虚弱和 5 层脆弱' }
        );
    }

    static createBurningPact() {
        return new Card(
            'burning_pact', '燃烧契约', 1, CardType.SKILL, CardTarget.SELF, 0,
            '消耗 1 张牌，抽 2 张牌',
            [{ type: 'exhaust_random', value: 1 }, { type: 'draw', value: 2 }],
            {},
            { effects: [{ type: 'exhaust_random', value: 1 }, { type: 'draw', value: 3 }], description: '消耗 1 张牌，抽 3 张牌' }
        );
    }

    static createInflame() {
        return new Card(
            'inflame', '点燃', 1, CardType.POWER, CardTarget.SELF, 0,
            '获得 2 层力量',
            [{ type: 'gain_strength', value: 2 }],
            {},
            { effects: [{ type: 'gain_strength', value: 3 }], description: '获得 3 层力量' }
        );
    }

    static createBarricade() {
        return new Card(
            'barricade', '壁垒', 3, CardType.POWER, CardTarget.SELF, 0,
            '格挡不再在回合开始时消失',
            [{ type: 'retain_block', value: 1 }],
            {},
            { cost: 2, description: '格挡不再在回合开始时消失' }
        );
    }

    static createBodySlam() {
        return new Card(
            'body_slam', '身体撞击', 1, CardType.ATTACK, CardTarget.ENEMY, 0,
            '造成等同于当前格挡值的伤害',
            [{ type: 'damage_per_block', value: 999 }],
            {},
            { cost: 0, description: '造成等同于当前格挡值的伤害' }
        );
    }

    static createHeavyBlade() {
        return new Card(
            'heavy_blade', '重刃', 2, CardType.ATTACK, CardTarget.ENEMY, 14,
            '造成 14 点伤害，力量效果翻倍',
            [{ type: 'strength_multiplier', value: 2 }],
            {},
            { value: 14, effects: [{ type: 'strength_multiplier', value: 3 }], description: '造成 14 点伤害，力量效果翻三倍' }
        );
    }

    static createPerfectedStrike() {
        return new Card(
            'perfected_strike', '完美打击', 2, CardType.ATTACK, CardTarget.ENEMY, 6,
            '造成 6 点伤害，手牌中每有一张"打击"，伤害+2',
            [{ type: 'perfected_strike', value: 2 }],
            {},
            { effects: [{ type: 'perfected_strike', value: 3 }], description: '造成 6 点伤害，手牌中每有一张"打击"，伤害+3' }
        );
    }

    static createPommelStrike() {
        return new Card(
            'pommel_strike', '柄击', 1, CardType.ATTACK, CardTarget.ENEMY, 9,
            '造成 9 点伤害，抽 1 张牌',
            [{ type: 'draw', value: 1 }],
            {},
            { value: 10, effects: [{ type: 'draw', value: 2 }], description: '造成 10 点伤害，抽 2 张牌' }
        );
    }

    static createRage() {
        return new Card(
            'rage', '狂怒', 0, CardType.SKILL, CardTarget.SELF, 0,
            '每打出一张攻击牌，获得 3 点格挡（本回合）',
            [{ type: 'rage', value: 3 }],
            {},
            { effects: [{ type: 'rage', value: 5 }], description: '每打出一张攻击牌，获得 5 点格挡（本回合）' }
        );
    }

    static createEntrench() {
        return new Card(
            'entrench', '巩固', 2, CardType.SKILL, CardTarget.SELF, 0,
            '将当前格挡翻倍',
            [{ type: 'double_block' }],
            {},
            { cost: 1, description: '将当前格挡翻倍' }
        );
    }

    static createImpervious() {
        return new Card(
            'impervious', '坚不可摧', 2, CardType.SKILL, CardTarget.SELF, 30,
            '获得 30 点格挡',
            [],
            { exhaust: true },
            { value: 40, description: '获得 40 点格挡' }
        );
    }

    static createRecklessCharge() {
        return new Card(
            'reckless_charge', '鲁莽冲锋', 0, CardType.ATTACK, CardTarget.ENEMY, 7,
            '造成 7 点伤害，将一张"眩晕"放入弃牌堆',
            [{ type: 'add_dazed', value: 1 }],
            {},
            { value: 10, description: '造成 10 点伤害，将一张"眩晕"放入弃牌堆' }
        );
    }

    static createHemokinesis() {
        return new Card(
            'hemokinesis', '血刃', 1, CardType.ATTACK, CardTarget.ENEMY, 14,
            '失去 3 点生命，造成 14 点伤害',
            [{ type: 'lose_hp', value: 3 }],
            {},
            { value: 18, effects: [{ type: 'lose_hp', value: 3 }], description: '失去 3 点生命，造成 18 点伤害' }
        );
    }

    static createDisarm() {
        return new Card(
            'disarm', '缴械', 1, CardType.SKILL, CardTarget.ENEMY, 0,
            '移除敌人 2 层力量',
            [{ type: 'remove_strength', value: 2 }],
            { exhaust: true },
            { effects: [{ type: 'remove_strength', value: 3 }], description: '移除敌人 3 层力量' }
        );
    }

    static createOffering() {
        return new Card(
            'offering', '献祭', 0, CardType.SKILL, CardTarget.SELF, 0,
            '失去 6 点生命，获得 2 点能量，抽 3 张牌',
            [{ type: 'lose_hp', value: 6 }, { type: 'gain_energy', value: 2 }, { type: 'draw', value: 3 }],
            { exhaust: true },
            { effects: [{ type: 'lose_hp', value: 6 }, { type: 'gain_energy', value: 2 }, { type: 'draw', value: 4 }], description: '失去 6 点生命，获得 2 点能量，抽 4 张牌' }
        );
    }

    static createSeverSoul() {
        return new Card(
            'sever_soul', '断魂', 2, CardType.ATTACK, CardTarget.ENEMY, 16,
            '消耗手牌中所有非攻击牌，造成 16 点伤害',
            [{ type: 'exhaust_non_attacks' }],
            {},
            { value: 22, description: '消耗手牌中所有非攻击牌，造成 22 点伤害' }
        );
    }

    static getRandomRewardCard() {
        const cardCreators = [
            CardFactory.createCleave,
            CardFactory.createIronWave,
            CardFactory.createPommelStrike,
            CardFactory.createTwinStrike,
            CardFactory.createAnger,
            CardFactory.createClothesline,
            CardFactory.createShrugItOff,
            CardFactory.createFlex,
            CardFactory.createBattleTrance,
            CardFactory.createInflame,
            CardFactory.createBodySlam,
            CardFactory.createHeavyBlade,
            CardFactory.createHemokinesis,
            CardFactory.createSeverSoul,
            CardFactory.createShockwave,
            CardFactory.createBurningPact,
            CardFactory.createEntrench,
            CardFactory.createRage,
        ];
        
        const creator = cardCreators[Math.floor(Math.random() * cardCreators.length)];
        return creator();
    }
}
