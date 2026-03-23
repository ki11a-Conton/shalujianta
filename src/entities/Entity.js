/**
 * ============================================
 * Entity - 游戏实体基类
 * 包含坐标、Lerp动画、血量、格挡、状态判定等公共逻辑
 * ============================================
 */

import { StatusType } from '../config/constants.js';

export class Entity {
    /**
     * @param {string} id - 实体唯一标识
     * @param {string} name - 实体名称
     * @param {number} maxHp - 最大生命值
     * @param {number} x - 渲染位置 x
     * @param {number} y - 渲染位置 y
     * @param {number} width - 渲染宽度
     * @param {number} height - 渲染高度
     */
    constructor(id, name, maxHp, x = 0, y = 0, width = 100, height = 100) {
        this.id = id;
        this.name = name;
        this.maxHp = maxHp;
        this.hp = maxHp;
        
        // 格挡值 (护盾)
        this.block = 0;

        // 渲染属性 (位置信息，供渲染层使用)
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;

        // 动画相关属性
        this.originalX = x;          // 原始位置 X
        this.originalY = y;          // 原始位置 Y
        this.targetX = x;            // 目标位置 X
        this.targetY = y;            // 目标位置 Y
        this.lerpSpeed = 0.2;        // Lerp 插值速度
        this.isAnimating = false;    // 是否正在动画中

        // 状态效果对象
        this.statusEffects = {
            [StatusType.STRENGTH]: 0,
            [StatusType.VULNERABLE]: 0,
            [StatusType.WEAK]: 0,
            [StatusType.DEXTERITY]: 0,
            [StatusType.FRAIL]: 0,
            [StatusType.RETAIN_BLOCK]: 0,
            [StatusType.POISON]: 0
        };

        // 视觉反馈回调（由 GameEngine 设置）
        this.onFloatingText = null;  // 添加漂浮文字的回调
        this.onScreenShake = null;   // 触发屏幕震动的回调
    }

    /**
     * 更新实体位置 (Lerp动画)
     * @param {number} deltaTime - 时间间隔
     */
    update(deltaTime) {
        // 线性插值：当前位置向目标位置平滑逼近
        const speed = this.lerpSpeed * (deltaTime / 16.67);
        this.x += (this.targetX - this.x) * speed;
        this.y += (this.targetY - this.y) * speed;
    }

    /**
     * 播放攻击突进动画
     * 玩家向右突进，敌人向左突进，然后弹回
     */
    playAttackAnimation() {
        const isPlayer = this.id === 'player';
        const dashDistance = 50;  // 突进距离

        // 设置突进目标位置
        if (isPlayer) {
            this.targetX = this.originalX + dashDistance;
        } else {
            this.targetX = this.originalX - dashDistance;
        }
        this.isAnimating = true;

        // 150ms 后弹回原位
        setTimeout(() => {
            this.targetX = this.originalX;
            // 动画结束后标记为 false
            setTimeout(() => {
                this.isAnimating = false;
            }, 150);
        }, 150);
    }

    /**
     * 设置原始位置（用于位置同步后更新）
     * @param {number} x - X坐标
     * @param {number} y - Y坐标
     */
    setOriginalPosition(x, y) {
        this.originalX = x;
        this.originalY = y;
        // 如果不在动画中，同时更新目标位置
        if (!this.isAnimating) {
            this.targetX = x;
            this.targetY = y;
        }
    }

    /**
     * 获取当前状态效果值
     * @param {string} statusType - 状态类型
     * @returns {number} 状态层数
     */
    getStatus(statusType) {
        return this.statusEffects[statusType] || 0;
    }

    /**
     * 施加状态效果
     * @param {string} statusType - 状态类型
     * @param {number} value - 状态层数
     */
    applyStatus(statusType, value) {
        this.statusEffects[statusType] += value;
        console.log(`${this.name} 获得 ${value} 层 ${statusType}，当前 ${this.statusEffects[statusType]} 层`);
    }

    /**
     * 减少状态效果（回合结束时调用）
     * @param {string} statusType - 状态类型
     * @param {number} value - 减少的层数
     */
    reduceStatus(statusType, value) {
        this.statusEffects[statusType] = Math.max(0, this.statusEffects[statusType] - value);
    }

    /**
     * 处理回合结束时的状态效果衰减
     */
    processTurnEndStatuses() {
        // 脆弱和虚弱每回合减少1层
        this.reduceStatus(StatusType.VULNERABLE, 1);
        this.reduceStatus(StatusType.WEAK, 1);
        this.reduceStatus(StatusType.FRAIL, 1);

        // 中毒处理：受到等同于中毒层数的无视格挡伤害，然后中毒层数减1
        const poisonStacks = this.getStatus(StatusType.POISON);
        if (poisonStacks > 0) {
            this.takePoisonDamage(poisonStacks);
            this.reduceStatus(StatusType.POISON, 1);
            console.log(`${this.name} 中毒效果：受到 ${poisonStacks} 点伤害，中毒层数减1`);
        }
    }

    /**
     * 受到中毒伤害（无视格挡）
     * @param {number} damage - 伤害值
     */
    takePoisonDamage(damage) {
        if (damage <= 0) return;

        this.hp -= damage;
        
        if (this.onFloatingText) {
            this.onFloatingText(`-${damage} 毒`, '#2ecc71');
        }
        if (this.onScreenShake) {
            this.onScreenShake(5);
        }

        this.hp = Math.max(0, this.hp);
        console.log(`${this.name} 受到 ${damage} 点中毒伤害，剩余 HP: ${this.hp}/${this.maxHp}`);
    }

    /**
     * 获得格挡
     * @param {number} amount - 格挡值
     */
    gainBlock(amount) {
        this.block += amount;
        if (this.onFloatingText) {
            this.onFloatingText(`+${amount} 格挡`, '#3498db');
        }
    }

    /**
     * 重置格挡（回合开始时调用）
     */
    resetBlock() {
        // 如果有保留格挡状态，不清空
        if (this.getStatus(StatusType.RETAIN_BLOCK) > 0) {
            console.log(`${this.name} 保留格挡：${this.block}`);
            return;
        }
        this.block = 0;
    }

    /**
     * 受到伤害
     * @param {number} damage - 伤害值
     */
    takeDamage(damage) {
        // 应用脆弱效果：受到的伤害增加50%
        if (this.getStatus(StatusType.VULNERABLE) > 0) {
            damage = Math.floor(damage * 1.5);
        }

        // 格挡抵消伤害
        if (this.block > 0) {
            const blocked = Math.min(this.block, damage);
            this.block -= blocked;
            damage -= blocked;
            if (blocked > 0 && this.onFloatingText) {
                this.onFloatingText(`格挡 ${blocked}`, '#3498db');
            }
        }

        // 实际扣血
        if (damage > 0) {
            this.hp -= damage;
            if (this.onFloatingText) {
                this.onFloatingText(`-${damage}`, '#e74c3c');
            }
            if (this.onScreenShake) {
                this.onScreenShake(10);
            }
        }

        // 确保 HP 不低于 0
        this.hp = Math.max(0, this.hp);

        console.log(`${this.name} 受到 ${damage} 点伤害，剩余 HP: ${this.hp}/${this.maxHp}`);
    }

    /**
     * 恢复生命值
     * @param {number} amount - 恢复量
     */
    heal(amount) {
        const oldHp = this.hp;
        this.hp = Math.min(this.maxHp, this.hp + amount);
        const healed = this.hp - oldHp;
        if (healed > 0) {
            if (this.onFloatingText) {
                this.onFloatingText(`+${healed}`, '#2ecc71');
            }
            console.log(`${this.name} 恢复 ${healed} 点生命值`);
        }
    }

    /**
     * 是否死亡
     * @returns {boolean}
     */
    isDead() {
        return this.hp <= 0;
    }

    /**
     * 获取实体状态
     * @returns {Object}
     */
    getStatusInfo() {
        return {
            name: this.name,
            hp: this.hp,
            maxHp: this.maxHp,
            block: this.block,
            statusEffects: { ...this.statusEffects }
        };
    }
}
