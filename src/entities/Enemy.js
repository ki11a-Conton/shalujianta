/**
 * ============================================
 * Enemy - 敌人类
 * 继承自 Entity，包含基于 turnCount 的回合 AI 意图系统
 * ============================================
 */

import { Entity } from './Entity.js';
import { IntentType, StatusType } from '../config/constants.js';

export class Enemy extends Entity {
    /**
     * @param {string} id - 敌人标识
     * @param {string} name - 敌人名称
     * @param {number} maxHp - 最大生命值
     * @param {number} x - 渲染位置 x
     * @param {number} y - 渲染位置 y
     */
    constructor(id, name, maxHp, x = 0, y = 0) {
        super(id, name, maxHp, x, y, 120, 180);

        // 意图系统 (敌人下一回合要做什么)
        this.intentType = IntentType.UNKNOWN;
        this.intentValue = 0;       // 意图数值 (如伤害值、格挡值)
        this.intentDescription = ''; // 意图描述

        // 回合计数器，用于固定行动模式
        this.turnCount = 0;

        // 精英怪标记
        this.isElite = false;

        // 下次攻击时获得的格挡（用于攻防兼备的意图）
        this.nextBlockGain = 0;
    }

    /**
     * 设置下一回合的意图
     * @param {string} type - 意图类型
     * @param {number} value - 意图数值
     * @param {string} description - 意图描述
     */
    setIntent(type, value, description) {
        this.intentType = type;
        this.intentValue = value;
        this.intentDescription = description;
    }

    /**
     * 基于敌人ID的固定行动模式AI
     */
    generateIntent() {
        // 回合计数器递增
        this.turnCount++;

        switch (this.id) {
            case 'cultist':
                this.generateCultistIntent();
                break;
            case 'goblin_large':
                this.generateGoblinLargeIntent();
                break;
            case 'gremlin_nob':
                this.generateGremlinNobIntent();
                break;
            case 'slime_small_1':
            case 'slime_small_2':
            case 'slime_small_3':
                this.generateSlimeSmallIntent();
                break;
            default:
                // 默认随机意图（备用）
                this.generateRandomIntent();
        }
    }

    /**
     * 邪教徒 AI 模式
     * 第1回合：BUFF（获得3层力量）
     * 之后所有回合：ATTACK（6点伤害）
     */
    generateCultistIntent() {
        if (this.turnCount === 1) {
            // 第1回合：给自己加力量
            this.setIntent(IntentType.BUFF, 3, '仪式：获得 3 层力量');
        } else {
            // 之后所有回合：攻击
            this.setIntent(IntentType.ATTACK, 6, '攻击 6');
        }
    }

    /**
     * 大地精 AI 模式
     * 3回合循环：DEBUFF -> ATTACK -> DEFEND
     */
    generateGoblinLargeIntent() {
        const cycle = (this.turnCount - 1) % 3; // 0, 1, 2 循环

        switch (cycle) {
            case 0:
                // 第1回合（以及每3回合）：施加脆弱
                this.setIntent(IntentType.DEBUFF, 2, '恐吓：施加 2 层脆弱');
                break;
            case 1:
                // 第2回合：重击
                this.setIntent(IntentType.ATTACK, 11, '重击 11');
                break;
            case 2:
                // 第3回合：防御
                this.setIntent(IntentType.DEFEND, 10, '防御 10');
                break;
        }
    }

    /**
     * 小史莱姆 AI 模式
     * 2回合交替：ATTACK -> DEBUFF
     */
    generateSlimeSmallIntent() {
        if (this.turnCount % 2 === 1) {
            // 奇数回合：攻击
            this.setIntent(IntentType.ATTACK, 5, '撞击 5');
        } else {
            // 偶数回合：施加虚弱
            this.setIntent(IntentType.DEBUFF, 1, '黏液：施加 1 层虚弱');
        }
    }

    /**
     * 地精大块头 AI 模式 (精英怪)
     * 被动技能【激怒】：玩家打出技能牌时获得 2 层力量
     * 第1回合：恐吓（施加脆弱）
     * 后续回合：随机使用重击或头槌
     */
    generateGremlinNobIntent() {
        if (this.turnCount === 1) {
            // 第1回合：恐吓
            this.setIntent(IntentType.DEBUFF, 2, '恐吓：施加 2 层脆弱');
        } else {
            // 后续回合：随机攻击
            const random = Math.random();
            if (random < 0.5) {
                // 50% 概率：重击（大额伤害）
                const baseDamage = 14;
                const strength = this.getStatus(StatusType.STRENGTH) || 0;
                const finalDamage = baseDamage + strength;
                this.setIntent(IntentType.ATTACK, finalDamage, `重击 ${finalDamage}`);
            } else {
                // 50% 概率：头槌（中等伤害 + 格挡）
                const baseDamage = 6;
                const strength = this.getStatus(StatusType.STRENGTH) || 0;
                const finalDamage = baseDamage + strength;
                this.setIntent(IntentType.ATTACK_DEFEND, finalDamage, `头槌 ${finalDamage} + 格挡 6`);
                this.nextBlockGain = 6;
            }
        }
    }

    /**
     * 当玩家打出卡牌时触发（用于激怒等被动技能）
     * @param {Card} card - 玩家打出的卡牌
     */
    onPlayerCardPlayed(card) {
        // 地精大块头的激怒被动
        if (this.id === 'gremlin_nob' && card.type === 'skill') {
            this.applyStatus(StatusType.STRENGTH, 2);
            console.log(`[精英被动] ${this.name} 激怒触发：获得 2 层力量`);
        }
    }

    /**
     * 备用：生成随机意图
     */
    generateRandomIntent() {
        const intents = [
            { type: IntentType.ATTACK, value: 10, desc: '攻击 10' },
            { type: IntentType.DEFEND, value: 8, desc: '防御 8' },
            { type: IntentType.ATTACK, value: 15, desc: '攻击 15' }
        ];

        const intent = intents[Math.floor(Math.random() * intents.length)];
        this.setIntent(intent.type, intent.value, intent.desc);
    }

    /**
     * 执行意图（扩展支持 BUFF 和 DEBUFF）
     * @param {Player} player - 玩家对象
     */
    executeIntent(player) {
        switch (this.intentType) {
            case IntentType.ATTACK:
                player.takeDamage(this.intentValue);
                console.log(`${this.name} 对玩家造成 ${this.intentValue} 点伤害`);
                break;
            case IntentType.DEFEND:
                this.gainBlock(this.intentValue);
                console.log(`${this.name} 获得 ${this.intentValue} 点格挡`);
                break;
            case IntentType.ATTACK_DEFEND:
                player.takeDamage(this.intentValue);
                console.log(`${this.name} 对玩家造成 ${this.intentValue} 点伤害`);
                if (this.nextBlockGain > 0) {
                    this.gainBlock(this.nextBlockGain);
                    console.log(`${this.name} 获得 ${this.nextBlockGain} 点格挡`);
                    this.nextBlockGain = 0;
                }
                break;
            case IntentType.BUFF:
                this.applyStatus(StatusType.STRENGTH, this.intentValue);
                console.log(`${this.name} 获得 ${this.intentValue} 层力量`);
                break;
            case IntentType.DEBUFF:
                if (this.intentDescription.includes('脆弱')) {
                    player.applyStatus(StatusType.VULNERABLE, this.intentValue);
                    console.log(`${this.name} 给玩家施加 ${this.intentValue} 层脆弱`);
                } else if (this.intentDescription.includes('虚弱')) {
                    player.applyStatus(StatusType.WEAK, this.intentValue);
                    console.log(`${this.name} 给玩家施加 ${this.intentValue} 层虚弱`);
                }
                break;
        }
    }

    /**
     * 获取敌人状态（包含意图信息）
     * @returns {Object}
     */
    getStatusInfo() {
        const baseInfo = super.getStatusInfo();
        return {
            ...baseInfo,
            intentType: this.intentType,
            intentValue: this.intentValue,
            intentDescription: this.intentDescription,
            turnCount: this.turnCount
        };
    }
}
