/**
 * ============================================
 * Card - 卡牌类
 * 包含卡牌属性、效果执行和 Lerp 动画
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
     * @param {Object} keywords - 卡牌关键字 { exhaust, innate, retain }
     */
    constructor(id, name, cost, type, target, value, description = '', effects = [], keywords = {}) {
        this.id = id;
        this.name = name;
        this.cost = cost;
        this.type = type;
        this.target = target;
        this.value = value;
        this.description = description || this.generateDescription();

        // 复合效果数组
        this.effects = effects;

        // 卡牌关键字系统
        this.keywords = {
            exhaust: keywords.exhaust || false,
            innate: keywords.innate || false,
            retain: keywords.retain || false
        };

        // 渲染属性
        this.x = 0;
        this.y = 0;
        this.targetX = 0;
        this.targetY = 0;
        this.width = 150;
        this.height = 200;
        this.isHovered = false;
        this.isSelected = false;

        // 动画参数
        this.lerpSpeed = 0.15;
    }

    /**
     * 更新卡牌位置 (Lerp动画)
     * @param {number} deltaTime - 时间间隔
     */
    update(deltaTime) {
        const speed = this.lerpSpeed * (deltaTime / 16.67);
        this.x += (this.targetX - this.x) * speed;
        this.y += (this.targetY - this.y) * speed;
    }

    /**
     * 执行卡牌效果
     * @param {Player} caster - 施法者
     * @param {Entity} target - 目标
     * @param {GameState} gameState - 游戏状态
     * @returns {boolean} 是否成功执行
     */
    play(caster, target, gameState) {
        console.log(`使用卡牌: ${this.name}`);

        // 检查能量是否足够
        if (caster instanceof Player && !caster.spendEnergy(this.cost)) {
            console.log('能量不足！');
            return false;
        }

        // 执行基础效果
        this.executeBaseEffect(caster, target, gameState);

        // 执行复合效果
        this.executeEffects(caster, target, gameState);

        return true;
    }

    /**
     * 执行卡牌基础效果
     * @param {Player} caster - 施法者
     * @param {Entity} target - 目标
     * @param {GameState} gameState - 游戏状态
     */
    executeBaseEffect(caster, target, gameState) {
        switch (this.type) {
            case CardType.ATTACK:
                // 攻击牌：造成伤害
                if (target) {
                    // 应用力量加成
                    const strength = caster.getStatus(StatusType.STRENGTH);
                    const weak = caster.getStatus(StatusType.WEAK);

                    let damage = this.value + strength;

                    // 虚弱效果：伤害减少25%
                    if (weak > 0) {
                        damage = Math.floor(damage * 0.75);
                    }

                    target.takeDamage(damage);
                }
                break;

            case CardType.SKILL:
                // 技能牌：获得格挡
                if (this.target === CardTarget.SELF) {
                    // 应用敏捷加成
                    const dexterity = caster.getStatus(StatusType.DEXTERITY);
                    const frail = caster.getStatus(StatusType.FRAIL);

                    let block = this.value + dexterity;

                    // 脆弱效果：格挡减少25%
                    if (frail > 0) {
                        block = Math.floor(block * 0.75);
                    }

                    caster.gainBlock(block);
                }
                break;

            case CardType.POWER:
                // 能力牌：持续效果
                console.log(`使用能力牌: ${this.name}`);
                break;
        }
    }

    /**
     * 执行复合效果
     * @param {Player} caster - 施法者
     * @param {Entity} target - 目标
     * @param {GameState} gameState - 游戏状态
     */
    executeEffects(caster, target, gameState) {
        if (!this.effects || this.effects.length === 0) return;

        this.effects.forEach(effect => {
            switch (effect.type) {
                case 'draw':
                    // 抽牌效果
                    gameState.deckManager.drawCards(effect.value);
                    console.log(`抽 ${effect.value} 张牌`);
                    break;

                case 'apply_status':
                    // 施加状态效果
                    if (target && effect.status) {
                        target.applyStatus(effect.status, effect.value);
                    }
                    break;

                case 'gain_energy':
                    // 获得能量
                    if (caster instanceof Player) {
                        caster.energy += effect.value;
                        console.log(`获得 ${effect.value} 点能量`);
                    }
                    break;

                case 'heal':
                    // 治疗
                    caster.heal(effect.value);
                    break;

                case 'damage_all':
                    // 对所有敌人造成伤害
                    gameState.enemies.forEach(enemy => {
                        if (!enemy.isDead()) {
                            const strength = caster.getStatus(StatusType.STRENGTH);
                            enemy.takeDamage(this.value + strength);
                        }
                    });
                    break;

                default:
                    console.log(`未知效果类型: ${effect.type}`);
            }
        });
    }

    /**
     * 自动生成描述
     * @returns {string}
     */
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

    /**
     * 创建卡牌副本
     * @returns {Card}
     */
    clone() {
        return new Card(
            this.id,
            this.name,
            this.cost,
            this.type,
            this.target,
            this.value,
            this.description,
            this.effects ? [...this.effects] : [],
            this.keywords ? { ...this.keywords } : {}
        );
    }

    /**
     * 获取卡牌信息
     * @returns {Object}
     */
    getInfo() {
        return {
            id: this.id,
            name: this.name,
            cost: this.cost,
            type: this.type,
            target: this.target,
            value: this.value,
            description: this.description,
            keywords: { ...this.keywords }
        };
    }
}
