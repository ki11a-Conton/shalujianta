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
            case IntentType.BUFF:
                // 给自己施加增益（如力量）
                this.applyStatus(StatusType.STRENGTH, this.intentValue);
                console.log(`${this.name} 获得 ${this.intentValue} 层力量`);
                break;
            case IntentType.DEBUFF:
                // 给玩家施加减益（如脆弱、虚弱）
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
