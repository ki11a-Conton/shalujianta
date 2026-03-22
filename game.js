/**
 * ============================================
 * 杀戮尖塔 - 卡牌游戏引擎
 * 阶段一：基建与主循环
 * 阶段二：纯数据逻辑构建 (无渲染)
 * 阶段三：静态画面渲染 (UI 绘制)
 * 阶段四：卡牌悬浮与交互 (AABB 碰撞检测)
 * 阶段五：回合状态机与战斗结算
 * 阶段六：状态效果系统 (Buffs/Debuffs)
 * 阶段八：卡牌平滑运动算法 (Lerp 动画)
 * ============================================
 * 技术栈: 原生 HTML5 Canvas + JavaScript (ES6+)
 */

// ============================================
// 1. 全局配置与常量
// ============================================
const CONFIG = {
    // 游戏帧率设置
    TARGET_FPS: 60,
    // 调试模式开关
    DEBUG: true,
    // 颜色配置
    COLORS: {
        FPS_TEXT: '#00ff00',
        DEBUG_BOUNDS: '#ff0000',
        DEBUG_TEXT: '#ffff00',
        BACKGROUND: '#1a1a2e'
    }
};

// ============================================
// 2. 游戏数据逻辑层 (阶段二：纯数据，无渲染)
// ============================================

/**
 * 卡牌类型枚举
 */
const CardType = {
    ATTACK: 'attack',   // 攻击牌
    SKILL: 'skill',     // 技能牌
    POWER: 'power'      // 能力牌
};

/**
 * 卡牌目标类型枚举
 */
const CardTarget = {
    ENEMY: 'enemy',         // 单个敌人
    ALL_ENEMIES: 'allEnemies',  // 所有敌人
    SELF: 'self',           // 自己
    NONE: 'none'            // 无目标
};

/**
 * 敌人意图类型枚举
 */
const IntentType = {
    ATTACK: 'attack',       // 攻击
    DEFEND: 'defend',       // 防御
    BUFF: 'buff',           // 增益
    DEBUFF: 'debuff',       // 减益
    UNKNOWN: 'unknown'      // 未知
};

/**
 * 阶段五：回合阶段枚举
 */
const TurnPhase = {
    PLAYER_TURN: 'player_turn',     // 玩家回合
    ENEMY_TURN: 'enemy_turn',       // 敌人回合
    GAME_OVER: 'game_over'          // 游戏结束
};

/**
 * 阶段六：状态效果类型枚举
 */
const StatusType = {
    STRENGTH: 'strength',           // 力量：增加伤害
    VULNERABLE: 'vulnerable',       // 脆弱：受到的伤害增加50%
    WEAK: 'weak',                   // 虚弱：造成的伤害减少25%
    DEXTERITY: 'dexterity',         // 敏捷：增加格挡
    FRAIL: 'frail',                 // 脆弱（格挡减少）
    RETAIN_BLOCK: 'retain_block'    // 保留格挡：回合开始时不清空格挡
};

/**
 * 阶段十：UI 状态枚举
 * 阶段十五：新增 GAME_WIN 通关状态
 * 阶段十九：新增 CAMPFIRE 篝火休息站
 * 阶段二十一：新增 MAP 地图选择界面
 */
const UIState = {
    BATTLE: 'battle',               // 战斗中
    REWARD: 'reward',               // 奖励界面
    CAMPFIRE: 'campfire',           // 篝火休息站
    MAP: 'map',                     // 地图路线选择
    GAME_WIN: 'game_win'            // 游戏通关
};

/**
 * 阶段二十一：地图节点类型枚举
 */
const NodeType = {
    BATTLE: 'battle',       // 普通战斗
    ELITE: 'elite',         // 精英战斗（掉落遗物）
    CAMPFIRE: 'campfire'    // 篝火休息
};

// ============================================
// 2.1 Entity 类 - 游戏实体基类
// ============================================
class Entity {
    /**
     * @param {string} id - 实体唯一标识
     * @param {string} name - 实体名称
     * @param {number} maxHp - 最大生命值
     * @param {number} x - 渲染位置 x (可选)
     * @param {number} y - 渲染位置 y (可选)
     * @param {number} width - 渲染宽度 (可选)
     * @param {number} height - 渲染高度 (可选)
     */
    constructor(id, name, maxHp, x = 0, y = 0, width = 100, height = 150) {
        this.id = id;
        this.name = name;

        // 生命值系统
        this.maxHp = maxHp;
        this.hp = maxHp;

        // 格挡值 (护盾)
        this.block = 0;

        // 渲染属性 (位置信息，供渲染层使用)
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;

        // 阶段二十二：动画相关属性
        this.originalX = x;          // 原始位置 X
        this.originalY = y;          // 原始位置 Y
        this.targetX = x;            // 目标位置 X
        this.targetY = y;            // 目标位置 Y
        this.lerpSpeed = 0.2;        // Lerp 插值速度
        this.isAnimating = false;    // 是否正在动画中

        // 阶段六：状态效果对象
        this.statusEffects = {
            [StatusType.STRENGTH]: 0,
            [StatusType.VULNERABLE]: 0,
            [StatusType.WEAK]: 0,
            [StatusType.DEXTERITY]: 0,
            [StatusType.FRAIL]: 0,
            [StatusType.RETAIN_BLOCK]: 0
        };

        // 阶段七：视觉反馈回调（由 GameEngine 设置）
        this.onFloatingText = null;  // 添加漂浮文字的回调
        this.onScreenShake = null;   // 触发屏幕震动的回调
    }

    /**
     * 阶段二十二：更新实体位置 (Lerp动画)
     * @param {number} deltaTime - 时间间隔
     */
    update(deltaTime) {
        // 线性插值：当前位置向目标位置平滑逼近
        const speed = this.lerpSpeed * (deltaTime / 16.67);
        this.x += (this.targetX - this.x) * speed;
        this.y += (this.targetY - this.y) * speed;
    }

    /**
     * 阶段二十二：播放攻击突进动画
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
            // 动画结束后标记为 false（可以添加更复杂的判断）
            setTimeout(() => {
                this.isAnimating = false;
            }, 150);
        }, 150);
    }

    /**
     * 阶段二十二：设置原始位置（用于位置同步后更新）
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
     * 阶段七：设置视觉反馈回调
     * @param {Function} floatingTextCallback - 添加漂浮文字的回调 (x, y, text, color)
     * @param {Function} screenShakeCallback - 触发屏幕震动的回调 (intensity)
     */
    setVisualFeedbackCallbacks(floatingTextCallback, screenShakeCallback) {
        this.onFloatingText = floatingTextCallback;
        this.onScreenShake = screenShakeCallback;
    }

    /**
     * 受到伤害 - 阶段七：添加视觉反馈
     * @param {number} damage - 伤害值
     * @returns {number} - 实际受到的伤害
     */
    takeDamage(damage) {
        if (damage <= 0) return 0;

        let actualDamage = damage;
        let blockedDamage = 0;

        // 先扣除格挡值
        if (this.block > 0) {
            blockedDamage = Math.min(this.block, damage);
            this.block -= blockedDamage;
            actualDamage = damage - blockedDamage;
        }

        // 剩余伤害扣除生命值
        if (actualDamage > 0) {
            this.hp = Math.max(0, this.hp - actualDamage);
        }

        // 阶段七：添加漂浮文字和屏幕震动
        const centerX = this.x + this.width / 2;
        const centerY = this.y + this.height / 2;

        // 显示格挡吸收的伤害（蓝色）
        if (blockedDamage > 0 && this.onFloatingText) {
            this.onFloatingText(centerX - 20, centerY, `-${blockedDamage}`, '#9b59b6');
        }

        // 显示实际受到的伤害（红色）
        if (actualDamage > 0 && this.onFloatingText) {
            const offsetX = blockedDamage > 0 ? 20 : 0;
            this.onFloatingText(centerX + offsetX, centerY, `-${actualDamage}`, '#e74c3c');
        }

        // 触发屏幕震动：玩家受到 >5 点伤害，或敌人受到 >10 点伤害
        if (this.onScreenShake) {
            const isPlayer = this.id === 'player';
            const totalDamage = actualDamage + blockedDamage;
            if ((isPlayer && totalDamage > 5) || (!isPlayer && totalDamage > 10)) {
                this.onScreenShake(15);
            }
        }

        return actualDamage;
    }

    /**
     * 恢复生命值
     * @param {number} amount - 恢复量
     */
    heal(amount) {
        if (amount <= 0) return;
        this.hp = Math.min(this.maxHp, this.hp + amount);

        // 阶段七：显示治疗漂浮文字
        if (this.onFloatingText) {
            const centerX = this.x + this.width / 2;
            const centerY = this.y + this.height / 2;
            this.onFloatingText(centerX, centerY, `+${amount}`, '#2ecc71');
        }
    }

    /**
     * 获得格挡 - 阶段七：添加视觉反馈
     * @param {number} amount - 格挡值
     */
    gainBlock(amount) {
        if (amount <= 0) return;
        this.block += amount;

        // 阶段七：添加漂浮文字（蓝色）
        if (this.onFloatingText) {
            const centerX = this.x + this.width / 2;
            const centerY = this.y + this.height / 2;
            this.onFloatingText(centerX, centerY, `+${amount}🛡️`, '#3498db');
        }
    }
    
    /**
     * 重置格挡 (回合结束时调用)
     */
    resetBlock() {
        this.block = 0;
    }
    
    /**
     * 检查是否死亡
     * @returns {boolean}
     */
    isDead() {
        return this.hp <= 0;
    }
    
    /**
     * 获取当前状态摘要
     * @returns {Object}
     */
    getStatus() {
        return {
            id: this.id,
            name: this.name,
            hp: this.hp,
            maxHp: this.maxHp,
            block: this.block,
            isDead: this.isDead(),
            statusEffects: { ...this.statusEffects }
        };
    }

    /**
     * 阶段六：应用状态效果
     * @param {string} type - 状态类型
     * @param {number} amount - 层数
     */
    applyStatus(type, amount) {
        if (this.statusEffects.hasOwnProperty(type)) {
            this.statusEffects[type] += amount;
            console.log(`${this.name} 获得 ${type}: ${amount} 层，当前: ${this.statusEffects[type]}`);
        }
    }

    /**
     * 阶段六：处理回合结束时的状态效果
     * 脆弱和虚弱层数 -1
     */
    processTurnEndStatuses() {
        // 脆弱和虚弱会在回合结束时减少
        const decayStatuses = [StatusType.VULNERABLE, StatusType.WEAK, StatusType.FRAIL];

        decayStatuses.forEach(type => {
            if (this.statusEffects[type] > 0) {
                this.statusEffects[type]--;
            }
        });
    }

    /**
     * 阶段六：获取状态效果层数
     * @param {string} type - 状态类型
     * @returns {number} 层数
     */
    getStatus(type) {
        return this.statusEffects[type] || 0;
    }
}

// ============================================
// 2.2 Player 类 - 玩家实体
// ============================================
class Player extends Entity {
    /**
     * @param {string} id - 玩家标识
     * @param {string} name - 玩家名称
     * @param {number} maxHp - 最大生命值
     * @param {number} maxEnergy - 最大能量值
     */
    constructor(id = 'player', name = '勇者', maxHp = 80, maxEnergy = 3) {
        super(id, name, maxHp, 0, 0, 120, 180);
        
        // 能量系统
        this.maxEnergy = maxEnergy;
        this.energy = maxEnergy;
        
        // 玩家特有属性
        this.gold = 0;          // 金币
        this.deck = [];         // 牌库 (拥有的所有卡牌)

        // 遗物系统：玩家拥有的遗物数组
        this.relics = [];
    }
    
    /**
     * 消耗能量
     * @param {number} amount - 消耗量
     * @returns {boolean} - 是否成功消耗
     */
    spendEnergy(amount) {
        if (this.energy >= amount) {
            this.energy -= amount;
            return true;
        }
        return false;
    }
    
    /**
     * 恢复能量 (回合开始时调用)
     */
    resetEnergy() {
        this.energy = this.maxEnergy;
    }
    
    /**
     * 获取玩家状态
     * @returns {Object}
     */
    getStatus() {
        return {
            ...super.getStatus(),
            energy: this.energy,
            maxEnergy: this.maxEnergy,
            gold: this.gold
        };
    }
}

// ============================================
// 2.3 Enemy 类 - 敌人实体
// ============================================
class Enemy extends Entity {
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

        // 阶段二十：回合计数器，用于固定行动模式
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
     * 阶段二十：基于敌人ID的固定行动模式AI
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
     * 阶段二十：邪教徒 AI 模式
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
     * 阶段二十：大地精 AI 模式
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
     * 阶段二十：小史莱姆 AI 模式
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
     * 阶段二十：执行意图（扩展支持 BUFF 和 DEBUFF）
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
     * 获取敌人状态
     * @returns {Object}
     */
    getStatus() {
        return {
            ...super.getStatus(),
            intentType: this.intentType,
            intentValue: this.intentValue,
            intentDescription: this.intentDescription
        };
    }
}

// ============================================
// 2.4 Card 类 - 卡牌
// ============================================
class Card {
    /**
     * @param {string} id - 卡牌唯一标识
     * @param {string} name - 卡牌名称
     * @param {number} cost - 能量消耗
     * @param {string} type - 卡牌类型 (attack/skill/power)
     * @param {string} target - 目标类型
     * @param {number} value - 效果数值 (伤害/格挡等)
     * @param {string} description - 卡牌描述
     * @param {Array} effects - 阶段九：额外效果数组 [{ type: 'draw', value: 1 }, { type: 'apply_status', status: StatusType.VULNERABLE, value: 2 }]
     * @param {Object} keywords - 阶段十八：卡牌关键字 { exhaust: false, innate: false, retain: false }
     */
    constructor(id, name, cost, type, target, value, description = '', effects = [], keywords = {}) {
        this.id = id;
        this.name = name;
        this.cost = cost;
        this.type = type;
        this.target = target;
        this.value = value;
        this.description = description || this.generateDescription();

        // 阶段九：复合效果数组
        this.effects = effects;

        // 阶段十八：卡牌关键字系统
        this.keywords = {
            exhaust: keywords.exhaust || false,   // 消耗：使用后进入消耗堆
            innate: keywords.innate || false,     // 固有：战斗开始时必定在手牌
            retain: keywords.retain || false      // 保留：回合结束时保留在手牌
        };

        // 渲染属性
        this.x = 0;
        this.y = 0;
        this.targetX = 0;  // 阶段八：目标X坐标
        this.targetY = 0;  // 阶段八：目标Y坐标
        this.width = 150;
        this.height = 200;
        this.isHovered = false;
        this.isSelected = false;

        // 阶段八：动画参数
        this.lerpSpeed = 0.15;  // Lerp插值速度 (0-1之间，越大越快)
    }

    /**
     * 阶段八：更新卡牌位置 (Lerp动画)
     * @param {number} deltaTime - 时间间隔
     */
    update(deltaTime) {
        // 线性插值：当前位置向目标位置平滑逼近
        // 公式：current += (target - current) * speed
        const speed = this.lerpSpeed * (deltaTime / 16.67); // 根据帧率调整速度

        this.x += (this.targetX - this.x) * speed;
        this.y += (this.targetY - this.y) * speed;
    }

    /**
     * 阶段八：设置目标位置
     * @param {number} x - 目标X
     * @param {number} y - 目标Y
     */
    setTargetPosition(x, y) {
        this.targetX = x;
        this.targetY = y;
    }

    /**
     * 阶段八：立即设置位置（无动画）
     * @param {number} x - X坐标
     * @param {number} y - Y坐标
     */
    setPosition(x, y) {
        this.x = x;
        this.y = y;
        this.targetX = x;
        this.targetY = y;
    }
    
    /**
     * 生成默认描述
     * @returns {string}
     */
    generateDescription() {
        switch (this.type) {
            case CardType.ATTACK:
                return `造成 ${this.value} 点伤害`;
            case CardType.SKILL:
                return `获得 ${this.value} 点格挡`;
            default:
                return '';
        }
    }
    
    /**
     * 阶段六：计算动态伤害
     * 伤害公式：基础伤害 + 使用者力量
     * - 如果使用者有虚弱，伤害 * 0.75
     * - 如果目标有脆弱，伤害 * 1.5
     * @param {Entity} user - 使用者
     * @param {Entity} target - 目标
     * @returns {number} 最终伤害值
     */
    calculateDamage(user, target) {
        // 基础伤害 + 力量
        let damage = this.value + (user.statusEffects[StatusType.STRENGTH] || 0);

        // 使用者虚弱：伤害减少25%
        if (user.statusEffects[StatusType.WEAK] > 0) {
            damage = Math.floor(damage * 0.75);
        }

        // 目标脆弱：受到伤害增加50%
        if (target && target.statusEffects[StatusType.VULNERABLE] > 0) {
            damage = Math.floor(damage * 1.5);
        }

        return Math.max(0, damage);
    }

    /**
     * 阶段六：计算动态格挡
     * 格挡公式：基础格挡 + 敏捷
     * - 如果使用者有脆弱（frail），格挡减少
     * @param {Entity} user - 使用者
     * @returns {number} 最终格挡值
     */
    calculateBlock(user) {
        let block = this.value;

        // 敏捷增加格挡
        block += (user.statusEffects[StatusType.DEXTERITY] || 0);

        // 脆弱减少格挡
        if (user.statusEffects[StatusType.FRAIL] > 0) {
            block = Math.floor(block * 0.75);
        }

        return Math.max(0, block);
    }

    /**
     * 使用卡牌 - 阶段九：支持复合效果
     * @param {Entity} user - 使用者
     * @param {Entity} target - 目标
     * @param {GameState} gameState - 游戏状态（用于执行抽牌等效果）
     */
    play(user, target, gameState = null) {
        // 检查能量是否足够
        if (user instanceof Player && !user.spendEnergy(this.cost)) {
            console.log('能量不足！');
            return false;
        }

        // 执行基础卡牌效果
        switch (this.type) {
            case CardType.ATTACK:
                if (target) {
                    // 阶段六：使用动态伤害计算
                    const damage = this.calculateDamage(user, target);
                    target.takeDamage(damage);
                    console.log(`${user.name} 使用 ${this.name} 对 ${target.name} 造成 ${damage} 点伤害`);
                }
                break;
            case CardType.SKILL:
                // 阶段六：使用动态格挡计算
                const block = this.calculateBlock(user);
                user.gainBlock(block);
                console.log(`${user.name} 使用 ${this.name} 获得 ${block} 点格挡`);
                break;
        }

        // 阶段九：执行额外复合效果
        if (this.effects && this.effects.length > 0 && gameState) {
            this.executeEffects(user, target, gameState);
        }

        return true;
    }

    /**
     * 阶段九：执行复合效果
     * @param {Entity} user - 使用者
     * @param {Entity} target - 目标
     * @param {GameState} gameState - 游戏状态
     */
    executeEffects(user, target, gameState) {
        this.effects.forEach(effect => {
            switch (effect.type) {
                case 'draw':
                    // 抽牌效果
                    if (gameState.deckManager) {
                        const drawnCards = gameState.deckManager.drawCard(effect.value);
                        console.log(`${user.name} 使用 ${this.name} 抽了 ${drawnCards.length} 张牌`);
                    }
                    break;

                case 'apply_status':
                    // 施加状态效果
                    if (target && effect.status) {
                        target.applyStatus(effect.status, effect.value);
                        console.log(`${user.name} 使用 ${this.name} 给 ${target.name} 施加 ${effect.value} 层 ${effect.status}`);
                    }
                    break;

                case 'heal':
                    // 治疗效果
                    if (user && effect.value) {
                        user.heal(effect.value);
                        console.log(`${user.name} 使用 ${this.name} 恢复了 ${effect.value} 点生命`);
                    }
                    break;

                case 'gain_energy':
                    // 获得能量效果
                    if (user instanceof Player && effect.value) {
                        user.energy += effect.value;
                        console.log(`${user.name} 使用 ${this.name} 获得 ${effect.value} 点能量`);
                    }
                    break;

                default:
                    console.log(`未知效果类型: ${effect.type}`);
            }
        });
    }
    
    /**
     * 创建卡牌副本 - 阶段十八：复制 effects 和 keywords
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
}

// ============================================
// 辅助函数：延时函数
// ============================================
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// ============================================
// 阶段七：漂浮文字类 - 战斗视觉反馈
// ============================================
class FloatingText {
    /**
     * @param {number} x - 初始X坐标
     * @param {number} y - 初始Y坐标
     * @param {string} text - 显示文字
     * @param {string} color - 文字颜色
     * @param {number} life - 存活帧数（默认60帧）
     */
    constructor(x, y, text, color, life = 60) {
        this.x = x;
        this.y = y;
        this.text = text;
        this.color = color;
        this.life = life;
        this.maxLife = life;
        this.velocityY = -1.5; // 向上移动速度
        this.fontSize = 24;
    }

    /**
     * 更新漂浮文字状态
     */
    update() {
        this.y += this.velocityY;
        this.life--;
    }

    /**
     * 绘制漂浮文字
     * @param {CanvasRenderingContext2D} ctx
     */
    draw(ctx) {
        // 计算透明度（随时间衰减）
        const alpha = this.life / this.maxLife;

        ctx.save();

        // 设置文字样式
        ctx.font = `bold ${this.fontSize}px Microsoft YaHei`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // 绘制文字阴影
        ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
        ctx.shadowBlur = 4;
        ctx.shadowOffsetX = 2;
        ctx.shadowOffsetY = 2;

        // 绘制文字（带透明度）
        ctx.fillStyle = this.color;
        ctx.globalAlpha = alpha;
        ctx.fillText(this.text, this.x, this.y);

        ctx.restore();
    }

    /**
     * 检查是否过期
     * @returns {boolean}
     */
    isExpired() {
        return this.life <= 0;
    }
}

// ============================================
// 2.5 DeckManager 类 - 牌组管理器
// ============================================
class DeckManager {
    constructor() {
        // 四个核心牌堆
        this.drawPile = [];      // 抽牌堆
        this.hand = [];          // 手牌
        this.discardPile = [];   // 弃牌堆
        this.exhaustPile = [];   // 消耗堆 (被消耗的牌)
        
        // 玩家拥有的所有卡牌 (牌库)
        this.masterDeck = [];
        
        // 配置
        this.maxHandSize = 10;   // 最大手牌数
    }
    
    /**
     * 初始化牌库 (战斗开始时调用)
     * @param {Array<Card>} cards - 初始卡牌列表
     */
    initialize(cards) {
        this.masterDeck = cards;
        this.drawPile = cards.map(card => card.clone());
        this.hand = [];
        this.discardPile = [];
        this.exhaustPile = [];
        
        // 洗牌
        this.shuffle();
    }
    
    /**
     * 洗牌算法 (Fisher-Yates 算法)
     */
    shuffle() {
        for (let i = this.drawPile.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.drawPile[i], this.drawPile[j]] = [this.drawPile[j], this.drawPile[i]];
        }
        console.log('抽牌堆已洗牌');
    }
    
    /**
     * 抽牌 - 阶段八：支持飞入动画
     * @param {number} amount - 抽牌数量
     * @param {number} drawPileX - 抽牌堆X坐标（用于动画起始位置）
     * @param {number} drawPileY - 抽牌堆Y坐标（用于动画起始位置）
     * @returns {Array<Card>} - 抽到的卡牌
     */
    drawCard(amount, drawPileX = 100, drawPileY = 500) {
        const drawnCards = [];

        for (let i = 0; i < amount; i++) {
            // 检查手牌上限
            if (this.hand.length >= this.maxHandSize) {
                console.log('手牌已满！');
                break;
            }

            // 抽牌堆为空时，将弃牌堆洗牌后放入抽牌堆
            if (this.drawPile.length === 0) {
                if (this.discardPile.length === 0) {
                    console.log('没有牌可抽了！');
                    break;
                }
                this.drawPile = this.discardPile;
                this.discardPile = [];
                this.shuffle();
                console.log('弃牌堆已洗入抽牌堆');
            }

            // 从抽牌堆顶部抽一张牌
            const card = this.drawPile.pop();

            // 阶段八：设置初始位置为抽牌堆位置（飞入动画起点）
            card.setPosition(drawPileX, drawPileY);

            this.hand.push(card);
            drawnCards.push(card);
        }

        console.log(`抽了 ${drawnCards.length} 张牌，当前手牌: ${this.hand.length}`);
        return drawnCards;
    }
    
    /**
     * 打出卡牌 - 阶段十八：使用 keywords.exhaust 判断
     * @param {Card} card - 要打出的卡牌
     */
    playCard(card) {
        const index = this.hand.indexOf(card);
        if (index === -1) {
            console.log('手牌中没有这张牌！');
            return false;
        }
        
        // 从手牌移除
        this.hand.splice(index, 1);
        
        // 阶段十八：根据 keywords.exhaust 判断放入哪个牌堆
        if (card.keywords && card.keywords.exhaust) {
            this.exhaustPile.push(card);
            console.log(`卡牌 ${card.name} 被消耗`);
        } else {
            this.discardPile.push(card);
        }
        
        return true;
    }
    
    /**
     * 弃掉一张手牌
     * @param {Card} card - 要弃掉的卡牌
     */
    discardCard(card) {
        const index = this.hand.indexOf(card);
        if (index !== -1) {
            this.hand.splice(index, 1);
            this.discardPile.push(card);
        }
    }
    
    /**
     * 回合结束时弃掉所有手牌 - 阶段十八：支持 retain 关键字
     */
    discardHand() {
        const retainedCards = [];
        
        while (this.hand.length > 0) {
            const card = this.hand.pop();
            // 阶段十八：如果卡牌有 retain 关键字，保留在手牌中
            if (card.keywords && card.keywords.retain) {
                retainedCards.push(card);
                console.log(`卡牌 ${card.name} 被保留（Retain）`);
            } else {
                this.discardPile.push(card);
            }
        }
        
        // 将保留的卡牌放回手牌
        this.hand = retainedCards;
        
        if (retainedCards.length > 0) {
            console.log(`回合结束，弃掉手牌，保留了 ${retainedCards.length} 张卡牌`);
        } else {
            console.log('回合结束，弃掉所有手牌');
        }
    }
    
    /**
     * 获取牌堆状态
     * @returns {Object}
     */
    getStatus() {
        return {
            drawPile: this.drawPile.length,
            hand: this.hand.length,
            discardPile: this.discardPile.length,
            exhaustPile: this.exhaustPile.length
        };
    }
}

// ============================================
// 遗物系统 (Relics) - 挂载在各个时机上的监听器
// ============================================

/**
 * Relic 基类 - 遗物基础类
 * 遗物本质上是挂载在各个时机上的监听器
 */
class Relic {
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
     * 卡牌被打出时触发
     * @param {GameState} gameState - 游戏状态
     * @param {Card} card - 被打出的卡牌
     */
    onCardPlayed(gameState, card) {
        // 子类重写
    }
}

/**
 * Vajra (金刚杵) - 战斗开始时给玩家增加1层力量
 */
class VajraRelic extends Relic {
    constructor() {
        super('vajra', '金刚杵', '战斗开始时获得 1 层力量');
    }

    onBattleStart(gameState) {
        gameState.player.applyStatus(StatusType.STRENGTH, 1);
        console.log(`[遗物] ${this.name} 触发：获得 1 层力量`);
    }
}

/**
 * Anchor (船锚) - 战斗开始时给玩家增加10点格挡
 */
class AnchorRelic extends Relic {
    constructor() {
        super('anchor', '船锚', '战斗开始时获得 10 点格挡');
    }

    onBattleStart(gameState) {
        gameState.player.gainBlock(10);
        console.log(`[遗物] ${this.name} 触发：获得 10 点格挡`);
    }
}

// ============================================
// 2.6 GameState 类 - 游戏状态管理
// ============================================
class GameState {
    constructor() {
        // 阶段五：游戏回合阶段
        this.currentPhase = TurnPhase.PLAYER_TURN;
        this.turnNumber = 1;

        // 阶段十五：层数系统
        this.currentFloor = 1;      // 当前层数
        this.maxFloor = 5;          // 最大层数（通关层数）

        // 游戏实体
        this.player = null;
        this.enemies = [];

        // 牌组管理器
        this.deckManager = new DeckManager();

        // 战斗日志
        this.battleLog = [];
    }
    
    /**
     * 阶段十二：初始化整局游戏（只调用一次）
     * 创建玩家和初始牌库
     * 遗物系统：给玩家添加测试遗物
     */
    initGame() {
        // 创建玩家（初始80血，0金币）
        this.player = new Player('player', '勇者', 80, 3);
        this.player.gold = 0;

        // 创建初始牌库并存入玩家的 masterDeck
        const initialDeck = this.createInitialDeck();
        this.player.masterDeck = initialDeck;

        // 遗物系统：给玩家添加测试遗物
        this.player.relics.push(new VajraRelic());
        this.player.relics.push(new AnchorRelic());
        console.log(`遗物系统：玩家获得 ${this.player.relics.length} 个遗物`);
        this.player.relics.forEach(relic => console.log(`  - ${relic.name}: ${relic.description}`));

        console.log('=== 游戏初始化完成 ===');
        console.log(`玩家: ${this.player.name}, 血量: ${this.player.hp}/${this.player.maxHp}, 金币: ${this.player.gold}`);
        console.log(`初始牌库: ${initialDeck.length} 张卡牌`);
    }

    /**
     * 阶段十二：初始化新战斗（可重复调用）
     * 保留玩家数据，随机生成敌人
     */
    initBattle() {
        // 不再重新创建 player，使用已有的 player
        if (!this.player) {
            console.error('错误：必须先调用 initGame() 创建玩家！');
            return;
        }

        // 重置玩家的能量和格挡（保留血量和金币）
        this.player.resetEnergy();
        this.player.block = 0;

        // 阶段十二：随机生成敌人
        this.enemies = this.generateRandomEnemies();

        // 为敌人生成初始意图
        this.enemies.forEach(enemy => enemy.generateIntent());

        // 使用玩家的 masterDeck 初始化牌组管理器
        this.deckManager.initialize(this.player.masterDeck);

        // 初始抽 5 张牌
        this.deckManager.drawCard(5);

        // 重置回合数
        this.turnNumber = 1;
        this.currentPhase = TurnPhase.PLAYER_TURN;

        // 遗物系统：触发战斗开始时的遗物效果
        if (this.player.relics && this.player.relics.length > 0) {
            console.log('=== 遗物效果触发（战斗开始）===');
            this.player.relics.forEach(relic => {
                if (relic.onBattleStart) {
                    relic.onBattleStart(this);
                }
            });
        }

        console.log('=== 战斗开始 ===');
        console.log(`玩家状态: ${this.player.hp}/${this.player.maxHp} HP, ${this.player.gold} 金币`);
        console.log(`遭遇敌人: ${this.enemies.map(e => e.name).join(', ')}`);
        this.logState();
    }

    /**
     * 阶段十二：随机生成敌人组合
     * @returns {Array<Enemy>} 敌人数组
     */
    generateRandomEnemies() {
        // 定义敌人组合配置
        const enemyCombos = [
            {
                name: '组合A：大地精',
                enemies: [
                    { id: 'goblin_large', name: '大地精', hp: 60 }
                ]
            },
            {
                name: '组合B：小史莱姆群',
                enemies: [
                    { id: 'slime_small_1', name: '小史莱姆', hp: 20 },
                    { id: 'slime_small_2', name: '小史莱姆', hp: 20 },
                    { id: 'slime_small_3', name: '小史莱姆', hp: 20 }
                ]
            },
            {
                name: '组合C：邪教徒',
                enemies: [
                    { id: 'cultist', name: '邪教徒', hp: 45 }
                ]
            }
        ];

        // 随机选择一个组合
        const selectedCombo = enemyCombos[Math.floor(Math.random() * enemyCombos.length)];
        console.log(`随机遭遇: ${selectedCombo.name}`);

        // 创建敌人实例
        const enemies = [];
        const canvasWidth = 1000; // 假设的屏幕宽度，实际会在 syncEntityPositions 中调整
        const enemyCount = selectedCombo.enemies.length;

        selectedCombo.enemies.forEach((enemyData, index) => {
            // 动态计算 X 坐标，让敌人在屏幕上方均匀排列
            // 基础位置从 200 开始，每个敌人间隔 200
            const spacing = 200;
            const startX = (canvasWidth - (enemyCount - 1) * spacing) / 2;
            const x = startX + index * spacing;
            const y = 150; // 固定 Y 坐标

            const enemy = new Enemy(enemyData.id, enemyData.name, enemyData.hp, x, y);
            enemies.push(enemy);
        });

        return enemies;
    }
    
    /**
     * 创建初始牌库 - 阶段九：添加复合效果卡牌
     * @returns {Array<Card>}
     */
    createInitialDeck() {
        const deck = [];

        // 4张打击（减少为4张，给新卡牌留出空间）
        for (let i = 0; i < 4; i++) {
            deck.push(new Card(
                `strike_${i}`,
                '打击',
                1,
                CardType.ATTACK,
                CardTarget.ENEMY,
                6,
                '造成 6 点伤害'
            ));
        }

        // 4张防御（减少为4张，给新卡牌留出空间）
        for (let i = 0; i < 4; i++) {
            deck.push(new Card(
                `defend_${i}`,
                '防御',
                1,
                CardType.SKILL,
                CardTarget.SELF,
                5,
                '获得 5 点格挡'
            ));
        }

        // 阶段九：新增【痛击】(Bash) - 2费，攻击8，施加2层脆弱
        deck.push(new Card(
            'bash',
            '痛击',
            2,
            CardType.ATTACK,
            CardTarget.ENEMY,
            8,
            '造成 8 点伤害，施加 2 层脆弱',
            [{ type: 'apply_status', status: StatusType.VULNERABLE, value: 2 }]
        ));

        // 阶段九：新增【剑柄打击】(Pommel Strike) - 1费，攻击9，抽1张牌
        deck.push(new Card(
            'pommel_strike',
            '剑柄打击',
            1,
            CardType.ATTACK,
            CardTarget.ENEMY,
            9,
            '造成 9 点伤害，抽 1 张牌',
            [{ type: 'draw', value: 1 }]
        ));

        // 新机制：新增【残影】(Blur) - 1费，获得5点格挡，施加1层保留格挡
        deck.push(new Card(
            'blur',
            '残影',
            1,
            CardType.SKILL,
            CardTarget.SELF,
            5,
            '获得 5 点格挡，下回合保留格挡',
            [{ type: 'apply_status', status: StatusType.RETAIN_BLOCK, value: 1 }]
        ));

        return deck;
    }

    /**
     * 阶段十三：生成奖励卡牌（三选一）
     * 从所有可用卡牌模板中随机选择3张不同的卡牌
     * @returns {Array<Card>} 3张奖励卡牌
     */
    generateRewardCards() {
        // 定义所有可用卡牌模板
        const cardTemplates = [
            {
                id: 'reward_strike',
                name: '打击',
                cost: 1,
                type: CardType.ATTACK,
                target: CardTarget.ENEMY,
                value: 6,
                description: '造成 6 点伤害'
            },
            {
                id: 'reward_defend',
                name: '防御',
                cost: 1,
                type: CardType.SKILL,
                target: CardTarget.SELF,
                value: 5,
                description: '获得 5 点格挡'
            },
            {
                id: 'reward_bash',
                name: '痛击',
                cost: 2,
                type: CardType.ATTACK,
                target: CardTarget.ENEMY,
                value: 8,
                description: '造成 8 点伤害，施加 2 层脆弱',
                effects: [{ type: 'apply_status', status: StatusType.VULNERABLE, value: 2 }]
            },
            {
                id: 'reward_pommel_strike',
                name: '剑柄打击',
                cost: 1,
                type: CardType.ATTACK,
                target: CardTarget.ENEMY,
                value: 9,
                description: '造成 9 点伤害，抽 1 张牌',
                effects: [{ type: 'draw', value: 1 }]
            },
            {
                id: 'reward_blur',
                name: '残影',
                cost: 1,
                type: CardType.SKILL,
                target: CardTarget.SELF,
                value: 5,
                description: '获得 5 点格挡，下回合保留格挡',
                effects: [{ type: 'apply_status', status: StatusType.RETAIN_BLOCK, value: 1 }]
            }
        ];

        // 随机打乱模板数组
        const shuffled = [...cardTemplates].sort(() => Math.random() - 0.5);

        // 取前3张并实例化为 Card 对象
        const rewardCards = shuffled.slice(0, 3).map(template => {
            return new Card(
                template.id + '_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
                template.name,
                template.cost,
                template.type,
                template.target,
                template.value,
                template.description,
                template.effects || []
            );
        });

        console.log('生成奖励卡牌:', rewardCards.map(c => c.name).join(', '));
        return rewardCards;
    }

    /**
     * 玩家结束回合 - Bug修复：格挡在回合开始时重置
     */
    endPlayerTurn() {
        // 弃掉所有手牌
        this.deckManager.discardHand();

        // Bug修复：移除这里的格挡重置，改到回合开始时重置
        // this.player.resetBlock();

        // 阶段六：处理玩家回合结束时的状态效果
        this.player.processTurnEndStatuses();

        // 进入敌人回合
        this.currentPhase = TurnPhase.ENEMY_TURN;
        console.log('=== 玩家回合结束 ===');
        
        // 执行敌人回合
        this.executeEnemyTurn();
    }
    
    /**
     * 执行敌人回合 - Bug修复：使用 async/await 添加延时
     */
    async executeEnemyTurn() {
        console.log('=== 敌人回合 ===');

        // 使用 for...of 循环替代 forEach，支持 await
        for (const enemy of this.enemies) {
            if (!enemy.isDead()) {
                // Bug修复：敌人回合开始时重置格挡
                enemy.resetBlock();

                // 阶段二十二：如果是攻击意图，先播放攻击动画
                if (enemy.intentType === IntentType.ATTACK) {
                    enemy.playAttackAnimation();
                    // 等待动画播放一段时间再执行伤害
                    await sleep(100);
                }

                // 执行意图（带着Debuff攻击）
                enemy.executeIntent(this.player);

                // Bug修复：添加 0.5 秒延时，让玩家看清敌人攻击
                await sleep(500);

                // 阶段六：处理敌人回合结束时的状态效果（攻击后才衰减）
                enemy.processTurnEndStatuses();

                // 生成新意图
                enemy.generateIntent();
            }
        }

        // 检查玩家是否死亡
        if (this.player.isDead()) {
            this.currentPhase = TurnPhase.GAME_OVER;
            console.log('=== 游戏结束：玩家死亡 ===');
            return;
        }

        // 开始新回合
        this.startNewTurn();
    }
    
    /**
     * 开始新回合 - Bug修复：玩家格挡在回合开始时重置，支持保留格挡
     * 遗物系统：触发回合开始时的遗物效果
     */
    startNewTurn() {
        this.turnNumber++;
        this.currentPhase = TurnPhase.PLAYER_TURN;

        // 重置玩家能量
        this.player.resetEnergy();

        // Bug修复+新机制：玩家格挡在回合开始时重置，但如果有保留格挡状态则不清空
        if (this.player.statusEffects[StatusType.RETAIN_BLOCK] > 0) {
            // 有保留格挡状态，不清空格挡，但层数-1
            this.player.statusEffects[StatusType.RETAIN_BLOCK]--;
            console.log(`保留格挡生效！当前格挡 ${this.player.block} 保留，剩余层数: ${this.player.statusEffects[StatusType.RETAIN_BLOCK]}`);
        } else {
            // 没有保留格挡状态，正常清空格挡
            this.player.resetBlock();
        }

        // 抽 5 张牌
        this.deckManager.drawCard(5);

        // 为存活的敌人生成新意图
        this.enemies.forEach(enemy => {
            if (!enemy.isDead()) {
                enemy.generateIntent();
            }
        });

        // 遗物系统：触发回合开始时的遗物效果
        if (this.player.relics && this.player.relics.length > 0) {
            console.log('=== 遗物效果触发（回合开始）===');
            this.player.relics.forEach(relic => {
                if (relic.onTurnStart) {
                    relic.onTurnStart(this);
                }
            });
        }

        console.log(`=== 第 ${this.turnNumber} 回合开始 ===`);
        this.logState();
    }
    
    /**
     * 使用卡牌
     * @param {Card} card - 卡牌
     * @param {Entity} target - 目标
     */
    playCard(card, target) {
        // 阶段五：检查是否是玩家回合
        if (this.currentPhase !== TurnPhase.PLAYER_TURN) {
            console.log('不是玩家回合！');
            return false;
        }

        // 检查能量
        if (this.player.energy < card.cost) {
            console.log('能量不足！');
            return false;
        }

        // 检查目标
        if (card.target === CardTarget.ENEMY && !target) {
            console.log('需要选择目标！');
            return false;
        }

        // 阶段五：检查目标是否已死亡
        if (target && target.isDead()) {
            console.log('目标已死亡！');
            return false;
        }

        // 阶段二十二：如果是攻击牌，播放玩家攻击动画
        if (card.type === CardType.ATTACK) {
            this.player.playAttackAnimation();
        }

        // 打出卡牌 - 阶段九：传递 gameState 以支持复合效果
        if (card.play(this.player, target, this)) {
            this.deckManager.playCard(card);
            this.addLog(`${this.player.name} 使用了 ${card.name}`);

            // 阶段五：检查敌人是否全部死亡
            const aliveEnemies = this.enemies.filter(e => !e.isDead());
            if (aliveEnemies.length === 0) {
                this.currentPhase = TurnPhase.GAME_OVER;
                console.log('=== 胜利！所有敌人被击败 ===');

                // 阶段十：触发胜利回调
                if (this.onVictory) {
                    this.onVictory();
                }
            }

            return true;
        }

        return false;
    }
    
    /**
     * 添加战斗日志
     * @param {string} message
     */
    addLog(message) {
        this.battleLog.push(`[回合${this.turnNumber}] ${message}`);
        console.log(message);
    }
    
    /**
     * 记录当前状态
     */
    logState() {
        console.log('--- 当前状态 ---');
        console.log('玩家:', this.player.getStatus());
        console.log('敌人:', this.enemies.map(e => e.getStatus()));
        console.log('牌堆:', this.deckManager.getStatus());
        console.log('手牌:', this.deckManager.hand.map(c => c.name));
        console.log('----------------');
    }
    
    /**
     * 获取游戏状态摘要
     * @returns {Object}
     */
    getState() {
        return {
            phase: this.currentPhase,
            turn: this.turnNumber,
            player: this.player ? this.player.getStatus() : null,
            enemies: this.enemies.map(e => e.getStatus()),
            deck: this.deckManager.getStatus(),
            hand: this.deckManager.hand.map(card => ({
                id: card.id,
                name: card.name,
                cost: card.cost,
                type: card.type,
                description: card.description
            }))
        };
    }
}

// ============================================
// 3. InputManager - 输入管理器
// ============================================
class InputManager {
    constructor(canvas) {
        this.canvas = canvas;
        
        // 鼠标坐标 (相对于 Canvas 的坐标系)
        this.mouseX = 0;
        this.mouseY = 0;
        
        // 鼠标状态
        this.isMouseDown = false;   // 当前是否按下
        this.isClicked = false;     // 是否触发点击事件(一帧)
        
        // 绑定事件监听器
        this.bindEvents();
    }
    
    /**
     * 绑定所有输入相关的事件监听器
     */
    bindEvents() {
        // 鼠标移动事件 - 实时更新鼠标坐标
        this.canvas.addEventListener('mousemove', (e) => {
            this.updateMousePosition(e);
        });
        
        // 鼠标按下事件
        this.canvas.addEventListener('mousedown', (e) => {
            this.isMouseDown = true;
            this.updateMousePosition(e);
        });
        
        // 鼠标释放事件
        this.canvas.addEventListener('mouseup', (e) => {
            this.isMouseDown = false;
            this.isClicked = true;  // 标记点击事件
            this.updateMousePosition(e);
        });
        
        // 鼠标离开 Canvas 区域
        this.canvas.addEventListener('mouseleave', () => {
            this.isMouseDown = false;
        });
        
        // 触摸事件支持 (移动端)
        this.canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.isMouseDown = true;
            this.updateTouchPosition(e.touches[0]);
        });
        
        this.canvas.addEventListener('touchend', (e) => {
            e.preventDefault();
            this.isMouseDown = false;
            this.isClicked = true;
        });
        
        this.canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            this.updateTouchPosition(e.touches[0]);
        });
    }
    
    /**
     * 更新鼠标坐标
     * 使用 getBoundingClientRect() 确保缩放时坐标计算准确
     * @param {MouseEvent} e - 鼠标事件对象
     */
    updateMousePosition(e) {
        const rect = this.canvas.getBoundingClientRect();
        
        // 计算缩放比例 (处理 Canvas 被 CSS 缩放的情况)
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        
        // 转换为 Canvas 内部坐标
        this.mouseX = (e.clientX - rect.left) * scaleX;
        this.mouseY = (e.clientY - rect.top) * scaleY;
    }
    
    /**
     * 更新触摸坐标
     * @param {Touch} touch - 触摸点对象
     */
    updateTouchPosition(touch) {
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        
        this.mouseX = (touch.clientX - rect.left) * scaleX;
        this.mouseY = (touch.clientY - rect.top) * scaleY;
    }
    
    /**
     * 每帧调用，重置一次性状态
     */
    update() {
        // 重置点击状态 (点击事件只持续一帧)
        this.isClicked = false;
    }
}

// ============================================
// 4. GameEngine - 游戏引擎核心
// ============================================
class GameEngine {
    constructor() {
        // 获取 Canvas 元素和绘图上下文
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        
        // 初始化输入管理器
        this.input = new InputManager(this.canvas);
        
        // FPS 计算相关
        this.lastTime = 0;
        this.fps = 0;
        this.frameCount = 0;
        this.fpsUpdateTime = 0;
        
        // 游戏状态管理器 (阶段二新增)
        this.gameState = new GameState();
        
        // 阶段四：拖拽状态机
        this.dragState = {
            isDragging: false,      // 是否正在拖拽
            draggedCard: null,      // 被拖拽的卡牌
            dragStartX: 0,          // 拖拽起始X
            dragStartY: 0,          // 拖拽起始Y
            dragOffsetX: 0,         // 鼠标与卡牌中心的偏移X
            dragOffsetY: 0          // 鼠标与卡牌中心的偏移Y
        };

        // 阶段七：战斗视觉反馈
        this.floatingTexts = [];    // 漂浮文字数组
        this.screenShake = 0;       // 屏幕震动强度

        // 阶段十：UI 状态
        this.uiState = UIState.BATTLE;  // 默认战斗中
        this.rewardGold = 0;            // 奖励金币数
        this.continueButtonHovered = false; // 继续按钮悬停状态

        // 阶段十四：能量球震动效果
        this.energyShake = 0;           // 能量球震动强度

        // 阶段十三：卡牌奖励三选一
        this.rewardCards = [];          // 存储供选择的3张卡
        this.isCardRewardSelected = false;  // 是否已选择卡牌奖励
        this.rewardCardHovered = [false, false, false];  // 三张奖励卡的悬停状态

        // 阶段十七：遗物悬停提示相关属性
        this.relicIcons = [];           // 遗物图标位置数组
        this.hoveredRelicIndex = -1;    // 当前悬停的遗物索引

        // 阶段十九：篝火休息站相关属性
        this.campfireRestHovered = false;       // 休息按钮悬停
        this.campfireSearchHovered = false;     // 搜寻按钮悬停
        this.campfireContinueHovered = false;   // 继续前进按钮悬停
        this.campfireActionTaken = false;       // 是否已执行篝火动作

        // 阶段二十一：地图路线选择相关属性
        this.mapNodes = [];                     // 当前可选的地图节点
        this.mapNodeHovered = [false, false];   // 节点悬停状态

        // 初始化 Canvas 尺寸
        this.resize();
        
        // 绑定 resize 事件
        window.addEventListener('resize', () => this.resize());
        
        // 初始化游戏
        this.initGame();
    }
    
    /**
     * 初始化游戏 - 阶段十二：分离游戏初始化和战斗初始化
     */
    initGame() {
        // 阶段十二：首先初始化整局游戏（只执行一次）
        this.gameState.initGame();

        // 然后初始化第一场战斗
        this.gameState.initBattle();

        // 同步实体位置到渲染层
        this.syncEntityPositions();

        // 阶段七：设置视觉反馈回调
        this.setupVisualFeedbackCallbacks();

        // 阶段十：设置胜利回调
        this.setupVictoryCallback();
    }

    /**
     * 阶段十：设置胜利回调
     */
    setupVictoryCallback() {
        this.gameState.onVictory = () => {
            this.handleVictory();
        };
    }

    /**
     * 阶段十：处理战斗胜利
     * 阶段十三：添加卡牌奖励
     */
    handleVictory() {
        // 发放金币奖励（25个随机金币）
        this.rewardGold = 25;
        this.gameState.player.gold += this.rewardGold;
        console.log(`获得 ${this.rewardGold} 金币！当前金币: ${this.gameState.player.gold}`);

        // 阶段十三：生成卡牌奖励
        this.rewardCards = this.gameState.generateRewardCards();
        this.isCardRewardSelected = false;
        this.rewardCardHovered = [false, false, false];

        // 切换到奖励界面
        this.uiState = UIState.REWARD;
    }

    /**
     * 阶段十：继续下一场战斗
     * 阶段十五：增加层数推进和通关判断
     * 阶段十九：偶数层进入篝火休息站
     * 阶段二十一：改为进入地图选择界面
     */
    continueToNextBattle() {
        console.log('准备进入下一房间');

        // 阶段十五：层数推进
        this.gameState.currentFloor++;
        console.log(`进入第 ${this.gameState.currentFloor} 层`);

        // 阶段十五：判断是否通关
        if (this.gameState.currentFloor > this.gameState.maxFloor) {
            console.log('=== 恭喜通关！===');
            this.uiState = UIState.GAME_WIN;
            return;
        }

        // 阶段二十一：进入地图路线选择界面
        console.log('=== 进入地图选择 ===');
        this.uiState = UIState.MAP;
        this.generateMapNodes();
        return;
    }

    /**
     * 阶段二十一：生成地图节点供玩家选择
     */
    generateMapNodes() {
        // 定义可用的节点类型及其权重
        const nodeTypes = [
            { type: NodeType.BATTLE, weight: 50 },
            { type: NodeType.ELITE, weight: 25 },
            { type: NodeType.CAMPFIRE, weight: 25 }
        ];

        // 生成2个随机节点
        this.mapNodes = [];
        for (let i = 0; i < 2; i++) {
            const random = Math.random() * 100;
            let cumulativeWeight = 0;
            let selectedType = NodeType.BATTLE;

            for (const node of nodeTypes) {
                cumulativeWeight += node.weight;
                if (random < cumulativeWeight) {
                    selectedType = node.type;
                    break;
                }
            }

            this.mapNodes.push(selectedType);
        }

        // 重置悬停状态
        this.mapNodeHovered = [false, false];

        console.log('生成地图节点:', this.mapNodes.map(n => n === NodeType.BATTLE ? '战斗' : (n === NodeType.ELITE ? '精英' : '篝火')).join(', '));
    }

    /**
     * 阶段二十一：选择地图节点并进入对应状态
     * @param {number} index - 选择的节点索引 (0 或 1)
     */
    selectMapNode(index) {
        const selectedNode = this.mapNodes[index];
        console.log(`选择节点: ${selectedNode === NodeType.BATTLE ? '战斗' : (selectedNode === NodeType.ELITE ? '精英' : '篝火')}`);

        // 重置 UI 状态
        this.rewardGold = 0;
        this.rewardCards = [];
        this.isCardRewardSelected = false;
        this.rewardCardHovered = [false, false, false];
        this.floatingTexts = [];

        switch (selectedNode) {
            case NodeType.BATTLE:
                // 进入普通战斗
                this.uiState = UIState.BATTLE;
                this.gameState.initBattle();
                this.syncEntityPositions();
                this.setupVisualFeedbackCallbacks();
                this.setupVictoryCallback();
                break;

            case NodeType.ELITE:
                // 进入精英战斗（可以设置更强的敌人或额外奖励）
                this.uiState = UIState.BATTLE;
                this.gameState.initBattle();
                // TODO: 可以在这里设置精英敌人标记，增加难度和奖励
                this.syncEntityPositions();
                this.setupVisualFeedbackCallbacks();
                this.setupVictoryCallback();
                console.log('=== 精英战斗！更强大的敌人，更好的奖励 ===');
                break;

            case NodeType.CAMPFIRE:
                // 进入篝火休息站
                this.uiState = UIState.CAMPFIRE;
                this.campfireRestHovered = false;
                this.campfireSearchHovered = false;
                this.campfireContinueHovered = false;
                this.campfireActionTaken = false;
                break;
        }
    }

    /**
     * 阶段七：为所有实体设置视觉反馈回调
     */
    setupVisualFeedbackCallbacks() {
        // 创建回调函数（绑定 this）
        const addFloatingText = (x, y, text, color) => {
            this.floatingTexts.push(new FloatingText(x, y, text, color));
        };

        const triggerScreenShake = (intensity) => {
            this.screenShake = Math.max(this.screenShake, intensity);
        };

        // 为玩家设置回调
        if (this.gameState.player) {
            this.gameState.player.setVisualFeedbackCallbacks(addFloatingText, triggerScreenShake);
        }

        // 为所有敌人设置回调
        this.gameState.enemies.forEach(enemy => {
            enemy.setVisualFeedbackCallbacks(addFloatingText, triggerScreenShake);
        });
    }
    
    /**
     * 同步游戏实体位置到渲染层
     */
    syncEntityPositions() {
        // 设置玩家位置 (屏幕下方中央)
        const player = this.gameState.player;
        const playerX = this.canvas.width / 2 - player.width / 2;
        const playerY = this.canvas.height - player.height - 50;
        // 阶段二十二：使用 setOriginalPosition 来同步位置
        player.setOriginalPosition(playerX, playerY);

        // 设置敌人位置 (屏幕上方)
        this.gameState.enemies.forEach((enemy, index) => {
            const enemyX = 300 + index * 200;
            const enemyY = 100;
            // 阶段二十二：使用 setOriginalPosition 来同步位置
            enemy.setOriginalPosition(enemyX, enemyY);
        });

        // 设置手牌位置
        this.updateHandPositions();
    }
    
    /**
     * 更新手牌位置 - 阶段八：设置目标位置而非直接设置位置
     */
    updateHandPositions() {
        const hand = this.gameState.deckManager.hand;
        const cardWidth = 150;
        const cardSpacing = 30;
        const totalWidth = hand.length * cardWidth + (hand.length - 1) * cardSpacing;
        const startX = (this.canvas.width - totalWidth) / 2;
        const cardY = this.canvas.height - 280;

        hand.forEach((card, index) => {
            // 跳过正在拖拽的卡牌
            if (this.dragState.isDragging && this.dragState.draggedCard === card) {
                return;
            }

            // 阶段八：计算目标Y坐标（悬停时上浮）
            let targetY = cardY;
            if (card.isHovered && !this.dragState.isDragging) {
                targetY -= 20; // 悬停时上浮20px
            }

            // 阶段八：设置目标位置，让Lerp动画平滑移动
            card.setTargetPosition(
                startX + index * (cardWidth + cardSpacing),
                targetY
            );
            card.width = cardWidth;
            card.height = 200;
        });
    }
    
    /**
     * 调整 Canvas 尺寸为全屏
     * 在窗口大小改变时自动调用
     */
    resize() {
        // 设置 Canvas 的像素尺寸为窗口尺寸
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        
        // 重新同步实体位置
        if (this.gameState && this.gameState.player) {
            this.syncEntityPositions();
        }
        
        console.log(`Canvas 尺寸调整为: ${this.canvas.width}x${this.canvas.height}`);
    }
    
    /**
     * 游戏更新逻辑
     * @param {number} deltaTime - 距离上一帧的时间间隔 (毫秒)
     */
    update(deltaTime) {
        // 计算 FPS
        this.calculateFPS(deltaTime);

        // 阶段十 & 十五：根据 UI 状态处理不同的逻辑
        if (this.uiState === UIState.REWARD) {
            // 奖励界面：处理继续按钮和卡牌选择
            this.handleRewardScreenInput();
        } else if (this.uiState === UIState.CAMPFIRE) {
            // 阶段十九：篝火休息站界面
            this.handleCampfireInput();
        } else if (this.uiState === UIState.MAP) {
            // 阶段二十一：地图路线选择界面
            this.handleMapInput();
        } else if (this.uiState === UIState.GAME_WIN) {
            // 阶段十五：通关界面：检测重新开始按钮点击
            if (this.input.isClicked && this.restartButtonHovered) {
                this.restartGame();
            }
        } else {
            // 战斗界面：正常处理卡牌交互
            // 阶段四：处理卡牌交互（悬停、拖拽、释放）
            this.handleCardInteraction();

            // 检测敌人悬停（用于瞄准）
            this.checkEnemyHover();

            // 阶段五：检测结束回合按钮悬停
            this.checkEndTurnButtonHover();

            // 阶段五：检测结束回合按钮点击
            if (this.input.isClicked && this.endTurnButtonHovered) {
                this.endPlayerTurn();
            }

            // 阶段十七：检测遗物悬停
            this.checkRelicHover();
        }

        // 阶段八：更新所有卡牌的位置动画
        this.updateCardAnimations(deltaTime);

        // 阶段二十二：更新实体（玩家和敌人）的动画
        this.updateEntityAnimations(deltaTime);

        // 阶段七：更新漂浮文字和屏幕震动
        this.updateVisualFeedback();

        // Bug修复：将输入更新放在最后，确保点击状态在本帧内可用
        this.input.update();
    }

    /**
     * 阶段十 & 十三：处理奖励界面输入（包含卡牌三选一）
     */
    handleRewardScreenInput() {
        // 阶段十三：如果还未选择卡牌，检测卡牌悬停和点击
        if (!this.isCardRewardSelected) {
            this.rewardCards.forEach((card, index) => {
                // 检测悬停
                const cardRect = {
                    x: card.rewardX,
                    y: card.rewardY,
                    width: card.rewardWidth,
                    height: card.rewardHeight
                };
                this.rewardCardHovered[index] = this.isMouseOver(
                    this.input.mouseX,
                    this.input.mouseY,
                    cardRect
                );

                // 检测点击
                if (this.input.isClicked && this.rewardCardHovered[index]) {
                    this.selectRewardCard(card, index);
                }
            });
        }

        // 检测继续按钮悬停
        const button = this.getContinueButtonRect();
        this.continueButtonHovered = this.isMouseOver(
            this.input.mouseX,
            this.input.mouseY,
            button
        );

        // 检测继续按钮点击
        if (this.input.isClicked && this.continueButtonHovered) {
            this.continueToNextBattle();
        }
    }

    /**
     * 阶段十九：处理篝火休息站输入
     */
    handleCampfireInput() {
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;

        if (!this.campfireActionTaken) {
            // 检测休息按钮悬停
            const restButtonRect = {
                x: centerX - 120 - 90,
                y: centerY + 80,
                width: 180,
                height: 80
            };
            this.campfireRestHovered = this.isMouseOver(
                this.input.mouseX,
                this.input.mouseY,
                restButtonRect
            );

            // 检测搜寻按钮悬停
            const searchButtonRect = {
                x: centerX + 120 - 90,
                y: centerY + 80,
                width: 180,
                height: 80
            };
            this.campfireSearchHovered = this.isMouseOver(
                this.input.mouseX,
                this.input.mouseY,
                searchButtonRect
            );

            // 检测休息按钮点击
            if (this.input.isClicked && this.campfireRestHovered) {
                this.doCampfireRest();
            }

            // 检测搜寻按钮点击
            if (this.input.isClicked && this.campfireSearchHovered) {
                this.doCampfireSearch();
            }
        } else {
            // 检测继续前进按钮悬停
            const continueButtonRect = {
                x: centerX - 80,
                y: centerY + 160,
                width: 160,
                height: 50
            };
            this.campfireContinueHovered = this.isMouseOver(
                this.input.mouseX,
                this.input.mouseY,
                continueButtonRect
            );

            // 检测继续前进按钮点击
            if (this.input.isClicked && this.campfireContinueHovered) {
                this.continueToNextBattle();
            }
        }
    }

    /**
     * 阶段十三：选择奖励卡牌
     * @param {Card} card - 选中的卡牌
     * @param {number} index - 卡牌索引
     */
    selectRewardCard(card, index) {
        // 克隆卡牌并加入玩家主牌库
        const newCard = card.clone();
        this.gameState.player.masterDeck.push(newCard);

        console.log(`选择了奖励卡牌: ${card.name}，已加入主牌库`);
        console.log(`当前主牌库数量: ${this.gameState.player.masterDeck.length} 张`);

        // 标记已选择
        this.isCardRewardSelected = true;

        // 重置悬停状态
        this.rewardCardHovered = [false, false, false];
    }

    /**
     * 阶段八：更新卡牌动画
     * @param {number} deltaTime - 时间间隔
     */
    updateCardAnimations(deltaTime) {
        // 更新手牌动画
        this.gameState.deckManager.hand.forEach(card => {
            card.update(deltaTime);
        });

        // 更新弃牌堆动画（如果有动画中的卡牌）
        this.gameState.deckManager.discardPile.forEach(card => {
            card.update(deltaTime);
        });
    }

    /**
     * 阶段二十二：更新实体动画（玩家和敌人）
     * @param {number} deltaTime - 时间间隔
     */
    updateEntityAnimations(deltaTime) {
        // 更新玩家动画
        if (this.gameState.player) {
            this.gameState.player.update(deltaTime);
        }

        // 更新敌人动画
        this.gameState.enemies.forEach(enemy => {
            enemy.update(deltaTime);
        });
    }

    /**
     * 阶段七：更新视觉反馈（漂浮文字和屏幕震动）
     * 阶段十四：添加能量球震动衰减
     */
    updateVisualFeedback() {
        // 更新漂浮文字
        for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
            const text = this.floatingTexts[i];
            text.update();
            if (text.isExpired()) {
                this.floatingTexts.splice(i, 1);
            }
        }

        // 递减屏幕震动强度
        if (this.screenShake > 0) {
            this.screenShake--;
        }

        // 阶段十四：递减能量球震动强度
        if (this.energyShake > 0) {
            this.energyShake--;
        }
    }

    /**
     * 阶段五：结束玩家回合
     */
    endPlayerTurn() {
        if (this.gameState.currentPhase !== TurnPhase.PLAYER_TURN) {
            return;
        }

        // 结束玩家回合
        this.gameState.endPlayerTurn();

        // 重置拖拽状态
        if (this.dragState.isDragging) {
            this.dragState.isDragging = false;
            this.dragState.draggedCard = null;
        }

        // 更新手牌位置
        this.updateHandPositions();
    }

    /**
     * 阶段五：检测结束回合按钮悬停
     */
    checkEndTurnButtonHover() {
        const button = this.getEndTurnButtonRect();
        this.endTurnButtonHovered = this.isMouseOver(
            this.input.mouseX,
            this.input.mouseY,
            button
        );
    }

    /**
     * 阶段五：获取结束回合按钮矩形
     * @returns {Object} 按钮矩形 {x, y, width, height}
     */
    getEndTurnButtonRect() {
        return {
            x: this.canvas.width - 180,
            y: this.canvas.height - 100,
            width: 140,
            height: 50
        };
    }
    
    /**
     * 计算并更新 FPS
     * @param {number} deltaTime - 时间间隔
     */
    calculateFPS(deltaTime) {
        this.frameCount++;
        this.fpsUpdateTime += deltaTime;
        
        // 每秒更新一次 FPS 显示
        if (this.fpsUpdateTime >= 1000) {
            this.fps = this.frameCount;
            this.frameCount = 0;
            this.fpsUpdateTime = 0;
        }
    }
    
    /**
     * 阶段四：处理卡牌交互（悬停、拖拽、释放）
     */
    handleCardInteraction() {
        // Bug修复：敌人回合锁定玩家操作
        if (this.gameState.currentPhase !== TurnPhase.PLAYER_TURN) return;

        const hand = this.gameState.deckManager.hand;

        // 如果正在拖拽
        if (this.dragState.isDragging) {
            // 更新被拖拽卡牌的位置（跟随鼠标）
            if (this.dragState.draggedCard) {
                this.dragState.draggedCard.x = this.input.mouseX - this.dragState.dragOffsetX;
                this.dragState.draggedCard.y = this.input.mouseY - this.dragState.dragOffsetY;
            }

            // 检测是否释放鼠标
            if (!this.input.isMouseDown) {
                // 鼠标释放，尝试使用卡牌
                this.releaseDraggedCard();
            }
            return;
        }

        // 重置所有卡牌的悬停状态
        hand.forEach(card => card.isHovered = false);

        // 从后往前遍历手牌（z-index，最上层的牌优先判定）
        for (let i = hand.length - 1; i >= 0; i--) {
            const card = hand[i];

            // AABB 碰撞检测
            if (this.isMouseOver(this.input.mouseX, this.input.mouseY, card)) {
                card.isHovered = true;

                // 检测是否按下鼠标开始拖拽
                if (this.input.isMouseDown && !this.dragState.isDragging) {
                    this.startDragging(card);
                }
                break; // 只处理最上层的卡牌
            }
        }
    }
    
    /**
     * AABB 矩形碰撞检测
     * @param {number} mouseX - 鼠标 X 坐标
     * @param {number} mouseY - 鼠标 Y 坐标
     * @param {Object} rect - 矩形对象 {x, y, width, height}
     * @returns {boolean} - 鼠标是否在矩形内
     */
    isMouseOver(mouseX, mouseY, rect) {
        return mouseX >= rect.x && 
               mouseX <= rect.x + rect.width && 
               mouseY >= rect.y && 
               mouseY <= rect.y + rect.height;
    }
    
    /**
     * 开始拖拽卡牌 - 阶段十四：能量不足时触发震动反馈
     * @param {Card} card - 要拖拽的卡牌
     */
    startDragging(card) {
        // 检查能量是否足够
        if (this.gameState.player.energy < card.cost) {
            console.log('能量不足，无法使用');
            // 阶段十四：触发能量球震动效果
            this.energyShake = 20;
            return;
        }

        this.dragState.isDragging = true;
        this.dragState.draggedCard = card;
        this.dragState.dragStartX = card.x;
        this.dragState.dragStartY = card.y;
        this.dragState.dragOffsetX = this.input.mouseX - card.x;
        this.dragState.dragOffsetY = this.input.mouseY - card.y;

        card.isSelected = true;
        console.log(`开始拖拽卡牌: ${card.name}`);
    }
    
    /**
     * 释放拖拽的卡牌 - 体验优化：增加出牌区高度判定，支持AOE卡牌
     */
    releaseDraggedCard() {
        const card = this.dragState.draggedCard;
        if (!card) return;

        // 体验优化：设定出牌线，防止手牌区误触走火
        const playAreaY = this.canvas.height - 250;
        if (this.input.mouseY > playAreaY) {
            // 玩家没有把牌拖上去，只是在手牌区松开
            this.returnCardToHand(card);
            // 重置拖拽状态
            card.isSelected = false;
            this.dragState.isDragging = false;
            this.dragState.draggedCard = null;
            this.updateHandPositions();
            return;
        }

        // 检查是否悬停在敌人上（如果是攻击牌）
        if (card.target === CardTarget.ENEMY) {
            const targetEnemy = this.gameState.enemies.find(e => e.isHovered && !e.isDead());
            if (targetEnemy) {
                // 使用卡牌攻击敌人
                if (this.gameState.playCard(card, targetEnemy)) {
                    console.log(`使用 ${card.name} 攻击 ${targetEnemy.name}`);
                }
            } else {
                // 没有目标，卡牌返回原位
                this.returnCardToHand(card);
            }
        } else if (card.target === CardTarget.SELF) {
            // 对自己使用的牌（如防御）
            if (this.gameState.playCard(card, this.gameState.player)) {
                console.log(`使用 ${card.name}`);
            }
        } else if (card.target === CardTarget.ALL_ENEMIES || card.target === CardTarget.NONE) {
            // AOE卡牌或无目标卡牌：不需要指定敌人
            if (this.gameState.playCard(card, null)) {
                console.log(`使用 ${card.name}`);
            }
        }

        // 重置拖拽状态
        card.isSelected = false;
        this.dragState.isDragging = false;
        this.dragState.draggedCard = null;

        // 更新手牌位置
        this.updateHandPositions();
    }
    
    /**
     * 将卡牌返回手牌位置
     * @param {Card} card - 要返回的卡牌
     */
    returnCardToHand(card) {
        console.log(`卡牌 ${card.name} 返回手牌`);
        // 位置会在 updateHandPositions 中重置
    }
    
    /**
     * 绘制贝塞尔曲线瞄准线（从玩家到鼠标位置）
     * @param {CanvasRenderingContext2D} ctx
     */
    drawAimLine(ctx) {
        if (!this.dragState.isDragging || !this.dragState.draggedCard) return;
        
        const card = this.dragState.draggedCard;
        
        // 只有攻击牌才显示瞄准线
        if (card.target !== CardTarget.ENEMY) return;
        
        const player = this.gameState.player;
        const startX = player.x + player.width / 2;
        const startY = player.y;
        const endX = this.input.mouseX;
        const endY = this.input.mouseY;
        
        // 计算控制点（创建曲线效果）
        const controlX = (startX + endX) / 2;
        const controlY = startY - 100;
        
        // 绘制发光效果
        ctx.save();
        ctx.shadowColor = '#e74c3c';
        ctx.shadowBlur = 20;
        ctx.strokeStyle = '#e74c3c';
        ctx.lineWidth = 4;
        ctx.setLineDash([10, 5]);
        
        // 绘制贝塞尔曲线
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.quadraticCurveTo(controlX, controlY, endX, endY);
        ctx.stroke();
        
        // 恢复
        ctx.restore();
        
        // 绘制目标点
        ctx.fillStyle = '#e74c3c';
        ctx.beginPath();
        ctx.arc(endX, endY, 8, 0, Math.PI * 2);
        ctx.fill();
        
        // 如果悬停在敌人上，显示高亮圆圈
        const targetEnemy = this.gameState.enemies.find(e => e.isHovered && !e.isDead());
        if (targetEnemy) {
            ctx.strokeStyle = '#f1c40f';
            ctx.lineWidth = 3;
            ctx.setLineDash([]);
            ctx.beginPath();
            ctx.arc(
                targetEnemy.x + targetEnemy.width / 2,
                targetEnemy.y + targetEnemy.height / 2,
                Math.max(targetEnemy.width, targetEnemy.height) / 2 + 10,
                0,
                Math.PI * 2
            );
            ctx.stroke();
        }
    }
    
    /**
     * 检测敌人悬停
     */
    checkEnemyHover() {
        this.gameState.enemies.forEach(enemy => {
            enemy.isHovered = this.isMouseOver(
                this.input.mouseX,
                this.input.mouseY,
                enemy
            );
        });
    }
    
    /**
     * 游戏渲染逻辑
     * @param {CanvasRenderingContext2D} ctx - Canvas 绘图上下文
     */
    draw(ctx) {
        // 阶段七：屏幕震动效果
        ctx.save();
        if (this.screenShake > 0) {
            const shakeX = (Math.random() - 0.5) * this.screenShake * 2;
            const shakeY = (Math.random() - 0.5) * this.screenShake * 2;
            ctx.translate(shakeX, shakeY);
        }

        // 清空画布
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // 绘制游戏世界
        this.drawGameWorld(ctx);
        
        // 阶段四：绘制瞄准线（在卡牌上方）
        this.drawAimLine(ctx);
        
        // 绘制 FPS
        this.drawFPS(ctx);
        
        // 绘制鼠标坐标
        this.drawMouseInfo(ctx);
        
        // 调试模式：绘制碰撞框
        if (CONFIG.DEBUG) {
            this.drawDebugBounds(ctx);
        }

        // 阶段七：恢复画布状态（结束屏幕震动）
        ctx.restore();

        // 阶段七：绘制漂浮文字（在屏幕震动效果之上）
        this.drawFloatingTexts(ctx);

        // 阶段十：绘制奖励界面（在最上层）
        if (this.uiState === UIState.REWARD) {
            this.drawRewardScreen(ctx);
        }

        // 阶段十九：绘制篝火休息站界面
        if (this.uiState === UIState.CAMPFIRE) {
            this.drawCampfireScreen(ctx);
        }

        // 阶段二十一：绘制地图路线选择界面
        if (this.uiState === UIState.MAP) {
            this.drawMapScreen(ctx);
        }

        // 阶段十五：绘制通关界面
        if (this.uiState === UIState.GAME_WIN) {
            this.drawGameWinScreen(ctx);
        }
    }

    /**
     * 阶段七：绘制漂浮文字
     * @param {CanvasRenderingContext2D} ctx
     */
    drawFloatingTexts(ctx) {
        this.floatingTexts.forEach(text => {
            text.draw(ctx);
        });
    }

    /**
     * 阶段十：绘制奖励界面
     * @param {CanvasRenderingContext2D} ctx
     */
    /**
     * 阶段十 & 十三：绘制奖励界面（包含卡牌三选一）
     * @param {CanvasRenderingContext2D} ctx
     */
    drawRewardScreen(ctx) {
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;

        // 绘制半透明黑色遮罩
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // 阶段十三：根据是否选择卡牌调整面板高度
        const panelWidth = 600;
        const panelHeight = this.isCardRewardSelected ? 350 : 500;
        const panelX = centerX - panelWidth / 2;
        const panelY = centerY - panelHeight / 2;

        // 面板背景
        ctx.fillStyle = '#2c3e50';
        this.drawRoundedRect(ctx, panelX, panelY, panelWidth, panelHeight, 15);
        ctx.fill();

        // 面板边框
        ctx.strokeStyle = '#f1c40f';
        ctx.lineWidth = 4;
        this.drawRoundedRect(ctx, panelX, panelY, panelWidth, panelHeight, 15);
        ctx.stroke();

        // 绘制标题 "战斗胜利！"
        ctx.fillStyle = '#f1c40f';
        ctx.font = 'bold 36px Microsoft YaHei';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('战斗胜利！', centerX, panelY + 50);

        // 绘制金币图标和文字
        ctx.fillStyle = '#ecf0f1';
        ctx.font = '24px Microsoft YaHei';
        ctx.fillText(`💰 获得金币: ${this.rewardGold}`, centerX, panelY + 100);

        // 绘制当前总金币
        ctx.fillStyle = '#95a5a6';
        ctx.font = '16px Microsoft YaHei';
        ctx.fillText(`当前金币: ${this.gameState.player.gold}`, centerX, panelY + 125);

        // 阶段十三：绘制卡牌奖励区域
        if (!this.isCardRewardSelected) {
            // 绘制提示文字
            ctx.fillStyle = '#ecf0f1';
            ctx.font = '20px Microsoft YaHei';
            ctx.fillText('选择一张卡牌加入牌库:', centerX, panelY + 170);

            // 绘制三张奖励卡牌
            this.drawRewardCards(ctx, centerX, panelY + 220);

            // 绘制继续按钮（在卡牌下方）
            this.drawContinueButton(ctx, centerX, panelY + 420);
        } else {
            // 已选择卡牌，显示提示
            ctx.fillStyle = '#2ecc71';
            ctx.font = 'bold 24px Microsoft YaHei';
            ctx.fillText('✓ 已选择卡牌', centerX, panelY + 200);

            // 绘制继续按钮
            this.drawContinueButton(ctx, centerX, panelY + 280);
        }

        // 恢复文本基线
        ctx.textBaseline = 'alphabetic';
    }

    /**
     * 阶段十三：绘制三张奖励卡牌
     * @param {CanvasRenderingContext2D} ctx
     * @param {number} centerX - 中心X坐标
     * @param {number} startY - 起始Y坐标
     */
    drawRewardCards(ctx, centerX, startY) {
        const cardWidth = 120;
        const cardHeight = 160;
        const cardSpacing = 30;
        const totalWidth = 3 * cardWidth + 2 * cardSpacing;
        const startX = centerX - totalWidth / 2;

        this.rewardCards.forEach((card, index) => {
            const x = startX + index * (cardWidth + cardSpacing);
            const y = startY;

            // 设置卡牌悬停状态
            card.isHovered = this.rewardCardHovered[index];

            // 绘制卡牌（复用 drawSingleCard，缩小尺寸）
            this.drawSingleCard(ctx, card, x, y, cardWidth, cardHeight, 0, false);

            // 阶段十三：保存卡牌位置用于碰撞检测
            card.rewardX = x;
            card.rewardY = y;
            card.rewardWidth = cardWidth;
            card.rewardHeight = cardHeight;
        });
    }

    /**
     * 阶段十：绘制继续按钮
     * @param {CanvasRenderingContext2D} ctx
     * @param {number} centerX - 中心X坐标
     * @param {number} y - 按钮Y坐标
     */
    drawContinueButton(ctx, centerX, y) {
        const buttonWidth = 160;
        const buttonHeight = 50;
        const buttonX = centerX - buttonWidth / 2;

        // 按钮背景
        ctx.fillStyle = this.continueButtonHovered ? '#27ae60' : '#2ecc71';
        this.drawRoundedRect(ctx, buttonX, y, buttonWidth, buttonHeight, 10);
        ctx.fill();

        // 按钮边框
        ctx.strokeStyle = this.continueButtonHovered ? '#f1c40f' : '#27ae60';
        ctx.lineWidth = 3;
        this.drawRoundedRect(ctx, buttonX, y, buttonWidth, buttonHeight, 10);
        ctx.stroke();

        // 按钮文字
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 20px Microsoft YaHei';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('继续', centerX, y + buttonHeight / 2);
    }

    /**
     * 阶段十：获取继续按钮的矩形区域
     * @returns {Object} 按钮矩形 {x, y, width, height}
     */
    getContinueButtonRect() {
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;
        const panelY = centerY - 150; // panelHeight/2 = 150
        const buttonY = panelY + 230;

        return {
            x: centerX - 80,  // buttonWidth/2 = 80
            y: buttonY,
            width: 160,
            height: 50
        };
    }

    /**
     * 阶段十五：绘制通关界面
     * @param {CanvasRenderingContext2D} ctx
     */
    drawGameWinScreen(ctx) {
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;

        // 绘制全屏黑色遮罩
        ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // 绘制通关标题
        ctx.fillStyle = '#f1c40f';
        ctx.font = 'bold 72px Microsoft YaHei';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🎉 通关！', centerX, centerY - 100);

        // 绘制通关信息
        ctx.fillStyle = '#ecf0f1';
        ctx.font = '24px Microsoft YaHei';
        ctx.fillText(`你成功征服了 ${this.gameState.maxFloor} 层塔！`, centerX, centerY);

        // 绘制最终统计
        ctx.fillStyle = '#95a5a6';
        ctx.font = '18px Microsoft YaHei';
        ctx.fillText(`最终金币: ${this.gameState.player.gold} 💰`, centerX, centerY + 50);
        ctx.fillText(`牌库数量: ${this.gameState.player.masterDeck.length} 张`, centerX, centerY + 80);

        // 绘制重新开始按钮
        this.drawRestartButton(ctx, centerX, centerY + 150);
    }

    /**
     * 阶段十五：绘制重新开始按钮
     * @param {CanvasRenderingContext2D} ctx
     * @param {number} centerX - 中心X坐标
     * @param {number} y - 按钮Y坐标
     */
    drawRestartButton(ctx, centerX, y) {
        const buttonWidth = 200;
        const buttonHeight = 60;
        const buttonX = centerX - buttonWidth / 2;

        // 检测按钮悬停（使用 restartButtonHovered 属性）
        const buttonRect = { x: buttonX, y: y, width: buttonWidth, height: buttonHeight };
        this.restartButtonHovered = this.isMouseOver(this.input.mouseX, this.input.mouseY, buttonRect);

        // 按钮背景
        ctx.fillStyle = this.restartButtonHovered ? '#27ae60' : '#2ecc71';
        this.drawRoundedRect(ctx, buttonX, y, buttonWidth, buttonHeight, 12);
        ctx.fill();

        // 按钮边框
        ctx.strokeStyle = this.restartButtonHovered ? '#f1c40f' : '#27ae60';
        ctx.lineWidth = 4;
        this.drawRoundedRect(ctx, buttonX, y, buttonWidth, buttonHeight, 12);
        ctx.stroke();

        // 按钮文字
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 24px Microsoft YaHei';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('重新开始游戏', centerX, y + buttonHeight / 2);

        // 恢复文本基线
        ctx.textBaseline = 'alphabetic';
    }

    /**
     * 阶段十九：绘制篝火休息站界面
     * @param {CanvasRenderingContext2D} ctx
     */
    drawCampfireScreen(ctx) {
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;

        // 绘制温馨的橙色渐变背景
        const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, Math.max(this.canvas.width, this.canvas.height));
        gradient.addColorStop(0, 'rgba(230, 126, 34, 0.3)');
        gradient.addColorStop(0.5, 'rgba(211, 84, 0, 0.5)');
        gradient.addColorStop(1, 'rgba(44, 62, 80, 0.9)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // 绘制大篝火图标
        ctx.font = 'bold 120px Microsoft YaHei';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🔥', centerX, centerY - 120);

        // 绘制标题
        ctx.fillStyle = '#f39c12';
        ctx.font = 'bold 36px Microsoft YaHei';
        ctx.fillText('篝火休息站', centerX, centerY - 20);

        // 绘制层数信息
        ctx.fillStyle = '#ecf0f1';
        ctx.font = '18px Microsoft YaHei';
        ctx.fillText(`第 ${this.gameState.currentFloor} 层`, centerX, centerY + 20);

        // 如果还未执行动作，显示两个选择按钮
        if (!this.campfireActionTaken) {
            // 绘制休息按钮
            this.drawCampfireButton(ctx, centerX - 120, centerY + 80, '休息', '恢复 30% HP', this.campfireRestHovered, '#27ae60');
            // 绘制搜寻按钮
            this.drawCampfireButton(ctx, centerX + 120, centerY + 80, '搜寻', '获得 1 个遗物', this.campfireSearchHovered, '#3498db');
        } else {
            // 已执行动作，显示提示和继续前进按钮
            ctx.fillStyle = '#2ecc71';
            ctx.font = 'bold 24px Microsoft YaHei';
            ctx.fillText('✓ 已完成休息', centerX, centerY + 100);

            // 绘制继续前进按钮
            this.drawCampfireContinueButton(ctx, centerX, centerY + 160);
        }

        // 恢复文本基线
        ctx.textBaseline = 'alphabetic';
    }

    /**
     * 阶段十九：绘制篝火选择按钮
     * @param {CanvasRenderingContext2D} ctx
     * @param {number} centerX - 按钮中心X坐标
     * @param {number} y - 按钮Y坐标
     * @param {string} title - 按钮标题
     * @param {string} desc - 按钮描述
     * @param {boolean} isHovered - 是否悬停
     * @param {string} color - 按钮颜色
     */
    drawCampfireButton(ctx, centerX, y, title, desc, isHovered, color) {
        const buttonWidth = 180;
        const buttonHeight = 80;
        const buttonX = centerX - buttonWidth / 2;

        // 按钮背景
        ctx.fillStyle = isHovered ? this.darkenColor(color, 20) : color;
        this.drawRoundedRect(ctx, buttonX, y, buttonWidth, buttonHeight, 10);
        ctx.fill();

        // 按钮边框
        ctx.strokeStyle = isHovered ? '#f1c40f' : '#ecf0f1';
        ctx.lineWidth = isHovered ? 4 : 2;
        this.drawRoundedRect(ctx, buttonX, y, buttonWidth, buttonHeight, 10);
        ctx.stroke();

        // 按钮标题
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 22px Microsoft YaHei';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(title, centerX, y + 25);

        // 按钮描述
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.font = '12px Microsoft YaHei';
        ctx.fillText(desc, centerX, y + 55);
    }

    /**
     * 阶段十九：绘制继续前进按钮
     * @param {CanvasRenderingContext2D} ctx
     * @param {number} centerX - 中心X坐标
     * @param {number} y - 按钮Y坐标
     */
    drawCampfireContinueButton(ctx, centerX, y) {
        const buttonWidth = 160;
        const buttonHeight = 50;
        const buttonX = centerX - buttonWidth / 2;

        // 按钮背景
        ctx.fillStyle = this.campfireContinueHovered ? '#c0392b' : '#e74c3c';
        this.drawRoundedRect(ctx, buttonX, y, buttonWidth, buttonHeight, 10);
        ctx.fill();

        // 按钮边框
        ctx.strokeStyle = this.campfireContinueHovered ? '#f1c40f' : '#ecf0f1';
        ctx.lineWidth = this.campfireContinueHovered ? 3 : 2;
        this.drawRoundedRect(ctx, buttonX, y, buttonWidth, buttonHeight, 10);
        ctx.stroke();

        // 按钮文字
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 18px Microsoft YaHei';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('继续前进', centerX, y + buttonHeight / 2);
    }

    /**
     * 阶段十九：颜色加深辅助函数
     * @param {string} color - 十六进制颜色
     * @param {number} percent - 加深百分比
     * @returns {string} 加深后的颜色
     */
    darkenColor(color, percent) {
        const num = parseInt(color.replace('#', ''), 16);
        const amt = Math.round(2.55 * percent);
        const R = Math.max((num >> 16) - amt, 0);
        const G = Math.max((num >> 8 & 0x00FF) - amt, 0);
        const B = Math.max((num & 0x0000FF) - amt, 0);
        return `#${(0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1)}`;
    }

    /**
     * 阶段十九：执行篝火休息
     */
    doCampfireRest() {
        const player = this.gameState.player;
        const healAmount = Math.floor(player.maxHp * 0.3);
        player.heal(healAmount);
        console.log(`[篝火] 休息恢复 ${healAmount} 点生命值`);
        this.campfireActionTaken = true;
    }

    /**
     * 阶段十九：执行篝火搜寻
     */
    doCampfireSearch() {
        const player = this.gameState.player;
        // 随机获得一个遗物（金刚杵或船锚）
        const relics = [new VajraRelic(), new AnchorRelic()];
        const randomRelic = relics[Math.floor(Math.random() * relics.length)];
        player.relics.push(randomRelic);
        console.log(`[篝火] 搜寻获得遗物：${randomRelic.name}`);
        this.campfireActionTaken = true;
    }

    /**
     * 阶段十五：重新开始游戏
     */
    restartGame() {
        console.log('=== 重新开始游戏 ===');

        // 重置游戏状态
        this.gameState = new GameState();

        // 重置 UI 状态
        this.uiState = UIState.BATTLE;
        this.rewardGold = 0;
        this.rewardCards = [];
        this.isCardRewardSelected = false;
        this.rewardCardHovered = [false, false, false];

        // 清空视觉反馈
        this.floatingTexts = [];
        this.screenShake = 0;
        this.energyShake = 0;

        // 重置拖拽状态
        this.dragState = {
            isDragging: false,
            draggedCard: null,
            dragStartX: 0,
            dragStartY: 0,
            dragOffsetX: 0,
            dragOffsetY: 0
        };

        // 重新初始化游戏
        this.initGame();
    }

    /**
     * 阶段二十一：绘制地图路线选择界面
     * @param {CanvasRenderingContext2D} ctx
     */
    drawMapScreen(ctx) {
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;

        // 绘制深色背景
        ctx.fillStyle = 'rgba(20, 20, 30, 0.95)';
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // 绘制标题
        ctx.fillStyle = '#f1c40f';
        ctx.font = 'bold 48px Microsoft YaHei';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('选择你的路线', centerX, centerY - 150);

        // 绘制层数信息
        ctx.fillStyle = '#95a5a6';
        ctx.font = '20px Microsoft YaHei';
        ctx.fillText(`第 ${this.gameState.currentFloor} 层`, centerX, centerY - 100);

        // 绘制两条路线
        const nodeSpacing = 300;
        const nodeY = centerY;

        this.mapNodes.forEach((nodeType, index) => {
            const nodeX = centerX + (index === 0 ? -1 : 1) * (nodeSpacing / 2);
            this.drawMapNode(ctx, nodeX, nodeY, nodeType, index);
        });

        // 绘制提示文字
        ctx.fillStyle = '#7f8c8d';
        ctx.font = '16px Microsoft YaHei';
        ctx.fillText('点击选择一个节点继续前进', centerX, centerY + 180);

        // 恢复文本基线
        ctx.textBaseline = 'alphabetic';
    }

    /**
     * 阶段二十一：绘制单个地图节点
     * @param {CanvasRenderingContext2D} ctx
     * @param {number} x - 节点中心X坐标
     * @param {number} y - 节点中心Y坐标
     * @param {string} nodeType - 节点类型
     * @param {number} index - 节点索引
     */
    drawMapNode(ctx, x, y, nodeType, index) {
        const isHovered = this.mapNodeHovered[index];
        const nodeSize = isHovered ? 140 : 120;

        // 节点配置
        const nodeConfig = {
            [NodeType.BATTLE]: { icon: '⚔️', name: '普通战斗', color: '#e74c3c', desc: '标准敌人' },
            [NodeType.ELITE]: { icon: '👹', name: '精英战斗', color: '#9b59b6', desc: '强敌+遗物' },
            [NodeType.CAMPFIRE]: { icon: '🔥', name: '篝火', color: '#e67e22', desc: '休息恢复' }
        };

        const config = nodeConfig[nodeType];

        // 绘制节点背景（圆形）
        ctx.fillStyle = config.color;
        ctx.beginPath();
        ctx.arc(x, y, nodeSize / 2, 0, Math.PI * 2);
        ctx.fill();

        // 绘制节点边框
        ctx.strokeStyle = isHovered ? '#f1c40f' : '#ecf0f1';
        ctx.lineWidth = isHovered ? 6 : 3;
        ctx.beginPath();
        ctx.arc(x, y, nodeSize / 2, 0, Math.PI * 2);
        ctx.stroke();

        // 绘制节点图标
        ctx.font = 'bold 48px Microsoft YaHei';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(config.icon, x, y - 10);

        // 绘制节点名称
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 18px Microsoft YaHei';
        ctx.fillText(config.name, x, y + 35);

        // 绘制节点描述
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.font = '12px Microsoft YaHei';
        ctx.fillText(config.desc, x, y + 55);

        // 如果是悬停状态，绘制发光效果
        if (isHovered) {
            ctx.shadowColor = config.color;
            ctx.shadowBlur = 30;
            ctx.beginPath();
            ctx.arc(x, y, nodeSize / 2, 0, Math.PI * 2);
            ctx.stroke();
            ctx.shadowBlur = 0;
        }
    }

    /**
     * 阶段二十一：处理地图界面输入
     */
    handleMapInput() {
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;
        const nodeSpacing = 300;
        const nodeSize = 120;

        this.mapNodes.forEach((nodeType, index) => {
            const nodeX = centerX + (index === 0 ? -1 : 1) * (nodeSpacing / 2);

            // 检测鼠标是否在节点圆形区域内
            const dx = this.input.mouseX - nodeX;
            const dy = this.input.mouseY - centerY;
            const distance = Math.sqrt(dx * dx + dy * dy);

            this.mapNodeHovered[index] = distance <= nodeSize / 2;

            // 检测点击
            if (this.input.isClicked && this.mapNodeHovered[index]) {
                this.selectMapNode(index);
            }
        });
    }

    /**
     * 绘制游戏世界
     * @param {CanvasRenderingContext2D} ctx
     */
    drawGameWorld(ctx) {
        // 绘制玩家
        this.drawPlayer(ctx);
        
        // 绘制敌人
        this.drawEnemies(ctx);
        
        // 绘制手牌
        this.drawHand(ctx);
        
        // 绘制游戏状态信息
        this.drawGameInfo(ctx);
    }
    
    /**
     * 绘制玩家
     * @param {CanvasRenderingContext2D} ctx
     */
    drawPlayer(ctx) {
        const player = this.gameState.player;
        if (!player) return;
        
        // 绘制玩家区域背景
        ctx.fillStyle = 'rgba(52, 152, 219, 0.2)';
        ctx.fillRect(player.x - 10, player.y - 10, player.width + 20, player.height + 20);
        
        // 绘制玩家卡牌
        ctx.fillStyle = '#3498db';
        ctx.fillRect(player.x, player.y, player.width, player.height);
        
        // 绘制边框
        ctx.strokeStyle = '#ecf0f1';
        ctx.lineWidth = 3;
        ctx.strokeRect(player.x, player.y, player.width, player.height);
        
        // 绘制玩家名称
        ctx.fillStyle = '#ecf0f1';
        ctx.font = 'bold 18px Microsoft YaHei';
        ctx.textAlign = 'center';
        ctx.fillText(player.name, player.x + player.width / 2, player.y + 30);
        
        // 绘制血条背景
        const barWidth = player.width - 20;
        const barHeight = 12;
        const barX = player.x + 10;
        const barY = player.y + 50;
        
        ctx.fillStyle = '#2c3e50';
        ctx.fillRect(barX, barY, barWidth, barHeight);
        
        // 绘制血条
        const hpPercent = player.hp / player.maxHp;
        const hpColor = hpPercent > 0.5 ? '#27ae60' : (hpPercent > 0.25 ? '#f39c12' : '#e74c3c');
        ctx.fillStyle = hpColor;
        ctx.fillRect(barX, barY, barWidth * hpPercent, barHeight);
        
        // 绘制血条边框
        ctx.strokeStyle = '#ecf0f1';
        ctx.lineWidth = 1;
        ctx.strokeRect(barX, barY, barWidth, barHeight);
        
        // 绘制血量文字
        ctx.fillStyle = '#ecf0f1';
        ctx.font = 'bold 12px Microsoft YaHei';
        ctx.textAlign = 'center';
        ctx.fillText(`${player.hp}/${player.maxHp}`, player.x + player.width / 2, barY + 9);
        
        // 绘制格挡
        if (player.block > 0) {
            ctx.fillStyle = '#9b59b6';
            ctx.font = 'bold 16px Microsoft YaHei';
            ctx.fillText(`🛡️ ${player.block}`, player.x + player.width / 2, player.y + 85);
        }

        // 阶段六：绘制状态效果
        this.drawStatusEffects(ctx, player, player.x, player.y + 105);
    }

    /**
     * 阶段六：绘制状态效果图标
     * @param {CanvasRenderingContext2D} ctx
     * @param {Entity} entity - 实体对象
     * @param {number} startX - 起始X坐标
     * @param {number} startY - 起始Y坐标
     */
    drawStatusEffects(ctx, entity, startX, startY) {
        const statusConfig = {
            [StatusType.STRENGTH]: { icon: '💪', color: '#e74c3c', name: '力量' },
            [StatusType.VULNERABLE]: { icon: '💔', color: '#f39c12', name: '脆弱' },
            [StatusType.WEAK]: { icon: '💫', color: '#9b59b6', name: '虚弱' },
            [StatusType.DEXTERITY]: { icon: '🛡️', color: '#3498db', name: '敏捷' },
            [StatusType.FRAIL]: { icon: '⚠️', color: '#e67e22', name: '易碎' },
            [StatusType.RETAIN_BLOCK]: { icon: '🛡️', color: '#1abc9c', name: '保留' }
        };

        let offsetX = 0;
        const iconSize = 25;
        const spacing = 5;

        for (const [type, count] of Object.entries(entity.statusEffects)) {
            if (count > 0) {
                const config = statusConfig[type];
                if (!config) continue;

                // 绘制状态图标背景
                ctx.fillStyle = config.color;
                ctx.beginPath();
                ctx.arc(startX + offsetX + iconSize / 2, startY + iconSize / 2, iconSize / 2, 0, Math.PI * 2);
                ctx.fill();

                // 绘制状态图标
                ctx.font = '14px Microsoft YaHei';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(config.icon, startX + offsetX + iconSize / 2, startY + iconSize / 2 + 2);

                // 绘制层数
                ctx.fillStyle = '#ffffff';
                ctx.font = 'bold 10px Microsoft YaHei';
                ctx.fillText(count.toString(), startX + offsetX + iconSize - 3, startY + iconSize - 3);

                offsetX += iconSize + spacing;
            }
        }

        // 恢复文本基线
        ctx.textBaseline = 'alphabetic';
    }

    /**
     * 绘制敌人
     * @param {CanvasRenderingContext2D} ctx
     */
    drawEnemies(ctx) {
        this.gameState.enemies.forEach(enemy => {
            if (enemy.isDead()) return;
            
            // 绘制意图（在敌人头顶）
            const intentY = enemy.y - 50;
            ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            ctx.fillRect(enemy.x + enemy.width/2 - 40, intentY - 20, 80, 30);
            
            ctx.fillStyle = '#f39c12';
            ctx.font = 'bold 14px Microsoft YaHei';
            ctx.textAlign = 'center';
            ctx.fillText(enemy.intentDescription, enemy.x + enemy.width / 2, intentY);
            
            // 绘制意图图标背景
            ctx.fillStyle = '#2c3e50';
            ctx.beginPath();
            ctx.arc(enemy.x + enemy.width/2, intentY - 45, 20, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#f39c12';
            ctx.lineWidth = 2;
            ctx.stroke();
            
            // 绘制意图图标
            ctx.fillStyle = '#f39c12';
            ctx.font = 'bold 16px Microsoft YaHei';
            const intentIcon = enemy.intentType === IntentType.ATTACK ? '⚔️' : (enemy.intentType === IntentType.DEFEND ? '🛡️' : '❓');
            ctx.fillText(intentIcon, enemy.x + enemy.width / 2, intentY - 40);
            
            // 悬停效果
            if (enemy.isHovered) {
                ctx.fillStyle = 'rgba(231, 76, 60, 0.3)';
                ctx.fillRect(enemy.x - 10, enemy.y - 10, enemy.width + 20, enemy.height + 20);
            }
            
            // 绘制敌人卡牌
            ctx.fillStyle = '#e74c3c';
            ctx.fillRect(enemy.x, enemy.y, enemy.width, enemy.height);
            
            // 绘制边框
            ctx.strokeStyle = enemy.isHovered ? '#f39c12' : '#ecf0f1';
            ctx.lineWidth = enemy.isHovered ? 4 : 2;
            ctx.strokeRect(enemy.x, enemy.y, enemy.width, enemy.height);
            
            // 绘制敌人名称
            ctx.fillStyle = '#ecf0f1';
            ctx.font = 'bold 16px Microsoft YaHei';
            ctx.textAlign = 'center';
            ctx.fillText(enemy.name, enemy.x + enemy.width / 2, enemy.y + 20);
            
            // 绘制血条背景
            const barWidth = enemy.width - 20;
            const barHeight = 10;
            const barX = enemy.x + 10;
            const barY = enemy.y + 35;
            
            ctx.fillStyle = '#2c3e50';
            ctx.fillRect(barX, barY, barWidth, barHeight);
            
            // 绘制血条
            const hpPercent = enemy.hp / enemy.maxHp;
            const hpColor = hpPercent > 0.5 ? '#27ae60' : (hpPercent > 0.25 ? '#f39c12' : '#e74c3c');
            ctx.fillStyle = hpColor;
            ctx.fillRect(barX, barY, barWidth * hpPercent, barHeight);
            
            // 绘制血条边框
            ctx.strokeStyle = '#ecf0f1';
            ctx.lineWidth = 1;
            ctx.strokeRect(barX, barY, barWidth, barHeight);
            
            // 绘制血量文字
            ctx.fillStyle = '#ecf0f1';
            ctx.font = 'bold 10px Microsoft YaHei';
            ctx.textAlign = 'center';
            ctx.fillText(`${enemy.hp}/${enemy.maxHp}`, enemy.x + enemy.width / 2, barY + 8);
            
            // 绘制格挡
            if (enemy.block > 0) {
                ctx.fillStyle = '#9b59b6';
                ctx.font = 'bold 14px Microsoft YaHei';
                ctx.fillText(`🛡️ ${enemy.block}`, enemy.x + enemy.width / 2, enemy.y + 65);
            }

            // 阶段六：绘制状态效果
            this.drawStatusEffects(ctx, enemy, enemy.x, enemy.y + 75);
        });
    }
    
    /**
     * 绘制手牌 - 扇形布局
     * @param {CanvasRenderingContext2D} ctx
     */
    drawHand(ctx) {
        const hand = this.gameState.deckManager.hand;
        const cardCount = hand.length;
        if (cardCount === 0) return;
        
        // 阶段四：被拖拽的卡牌最后绘制（显示在最上层）
        const draggedCard = this.dragState.draggedCard;
        
        // 扇形布局参数
        const cardWidth = 100;
        const cardHeight = 150;
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height + 100; // 圆心在屏幕下方
        const radius = 500; // 扇形半径
        
        // 计算扇形角度范围
        const maxAngle = Math.PI / 3; // 60度扇形
        const angleStep = cardCount > 1 ? maxAngle / (cardCount - 1) : 0;
        const startAngle = -Math.PI / 2 - maxAngle / 2; // 从左侧开始
        
        hand.forEach((card, index) => {
            // 阶段四：跳过正在拖拽的卡牌（稍后单独绘制）
            if (card === draggedCard) return;
            
            // 计算当前卡牌的角度
            const angle = cardCount > 1 ? startAngle + angleStep * index : -Math.PI / 2;
            
            // 计算卡牌位置（扇形布局）
            const cardX = centerX + Math.cos(angle) * radius - cardWidth / 2;
            const cardY = centerY + Math.sin(angle) * radius - cardHeight / 2;
            
            // 保存计算后的坐标到 Card 实例（用于碰撞检测）
            card.x = cardX;
            card.y = cardY;
            card.width = cardWidth;
            card.height = cardHeight;
            
            // 计算卡牌旋转角度（朝向圆心）
            const rotation = angle + Math.PI / 2;
            
            // 悬停时的偏移（阶段四：只有悬停效果，选中由拖拽处理）
            let offsetY = 0;
            if (card.isHovered && !this.dragState.isDragging) {
                offsetY = -20;
            }
            
            // 绘制单张卡牌
            this.drawSingleCard(ctx, card, cardX, cardY + offsetY, cardWidth, cardHeight, rotation);
        });
        
        // 阶段四：最后绘制被拖拽的卡牌（确保在最上层）
        if (draggedCard && this.dragState.isDragging) {
            // 被拖拽的卡牌不旋转，直接绘制在鼠标位置
            this.drawSingleCard(ctx, draggedCard, draggedCard.x, draggedCard.y, cardWidth, cardHeight, 0, true);
        }
    }
    
    /**
     * 绘制单张卡牌
     * @param {CanvasRenderingContext2D} ctx
     * @param {Card} card - 卡牌对象
     * @param {number} x - X坐标
     * @param {number} y - Y坐标
     * @param {number} width - 宽度
     * @param {number} height - 高度
     * @param {number} rotation - 旋转角度（弧度）
     * @param {boolean} isDragging - 是否正在拖拽
     */
    drawSingleCard(ctx, card, x, y, width, height, rotation, isDragging = false) {
        ctx.save();

        // 阶段十四：判断能量是否足够
        const canPlay = this.gameState.player.energy >= card.cost;

        // 移动到卡牌位置并旋转
        ctx.translate(x + width / 2, y + height / 2);
        if (rotation !== 0) {
            ctx.rotate(rotation);
        }
        ctx.translate(-width / 2, -height / 2);

        // 阶段四：拖拽时添加阴影效果
        if (isDragging) {
            ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
            ctx.shadowBlur = 20;
            ctx.shadowOffsetX = 10;
            ctx.shadowOffsetY = 10;
        }

        // 绘制选中/悬停效果背景
        if (card.isSelected || card.isHovered) {
            ctx.fillStyle = card.isSelected ? 'rgba(241, 196, 15, 0.4)' : 'rgba(255, 255, 255, 0.2)';
            ctx.fillRect(-5, -5, width + 10, height + 10);
        }

        // 绘制卡牌背景（带圆角）
        ctx.fillStyle = card.type === CardType.ATTACK ? '#e74c3c' : '#27ae60';
        this.drawRoundedRect(ctx, 0, 0, width, height, 8);
        ctx.fill();

        // 绘制边框
        ctx.strokeStyle = card.isSelected ? '#f1c40f' : (card.isHovered ? '#ecf0f1' : '#bdc3c7');
        ctx.lineWidth = card.isSelected ? 4 : 2;
        this.drawRoundedRect(ctx, 0, 0, width, height, 8);
        ctx.stroke();

        // 重置阴影
        ctx.shadowColor = 'transparent';

        // 绘制能量消耗圆圈
        ctx.fillStyle = '#f1c40f';
        ctx.beginPath();
        ctx.arc(18, 18, 12, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#2c3e50';
        ctx.lineWidth = 2;
        ctx.stroke();

        // 阶段十四：能量不足时能量数值显示为红色
        ctx.fillStyle = canPlay ? '#2c3e50' : '#e74c3c';
        ctx.font = 'bold 14px Microsoft YaHei';
        ctx.textAlign = 'center';
        ctx.fillText(card.cost, 18, 23);

        // 绘制卡牌名称
        ctx.fillStyle = '#ecf0f1';
        ctx.font = 'bold 13px Microsoft YaHei';
        ctx.fillText(card.name, width / 2, 45);

        // 绘制分隔线
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(10, 55);
        ctx.lineTo(width - 10, 55);
        ctx.stroke();

        // 绘制描述（自动换行）
        ctx.fillStyle = '#ecf0f1';
        ctx.font = '11px Microsoft YaHei';
        this.drawWrappedText(ctx, card.description, width / 2, 75, width - 16, 14);

        // 阶段十八：如果卡牌有 exhaust 属性，在描述末尾显示“(消耗)”
        if (card.keywords && card.keywords.exhaust) {
            ctx.fillStyle = '#e74c3c';
            ctx.font = 'bold 12px Microsoft YaHei';
            ctx.fillText('(消耗)', width / 2, height - 25);
        }

        // 阶段十四：能量不足时绘制黑色半透明遮罩
        if (!canPlay) {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
            this.drawRoundedRect(ctx, 0, 0, width, height, 8);
            ctx.fill();
        }

        // 恢复上下文状态
        ctx.restore();
    }
    
    /**
     * 绘制圆角矩形路径
     * @param {CanvasRenderingContext2D} ctx
     * @param {number} x
     * @param {number} y
     * @param {number} width
     * @param {number} height
     * @param {number} radius
     */
    drawRoundedRect(ctx, x, y, width, height, radius) {
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + width - radius, y);
        ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
        ctx.lineTo(x + width, y + height - radius);
        ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
        ctx.lineTo(x + radius, y + height);
        ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.closePath();
    }
    
    /**
     * 绘制自动换行文本
     * @param {CanvasRenderingContext2D} ctx
     * @param {string} text
     * @param {number} x
     * @param {number} y
     * @param {number} maxWidth
     * @param {number} lineHeight
     */
    drawWrappedText(ctx, text, x, y, maxWidth, lineHeight) {
        const words = text.split('');
        let line = '';
        let currentY = y;
        
        for (let i = 0; i < words.length; i++) {
            const testLine = line + words[i];
            const metrics = ctx.measureText(testLine);
            
            if (metrics.width > maxWidth && i > 0) {
                ctx.fillText(line, x, currentY);
                line = words[i];
                currentY += lineHeight;
            } else {
                line = testLine;
            }
        }
        ctx.fillText(line, x, currentY);
    }
    
    /**
     * 绘制游戏信息 - 阶段十七：重构为顶部信息栏
     * @param {CanvasRenderingContext2D} ctx
     */
    drawGameInfo(ctx) {
        const deckStatus = this.gameState.deckManager.getStatus();
        const player = this.gameState.player;

        // 阶段十七：绘制顶部信息栏
        this.drawTopBar(ctx);

        // 绘制能量球（左下角）
        this.drawEnergyOrb(ctx);

        // 阶段十七：移除右上角牌堆信息面板，改为在顶部栏显示层数
        // 绘制牌堆信息（左侧，能量球上方）
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(20, this.canvas.height - 220, 120, 100);

        ctx.fillStyle = '#ecf0f1';
        ctx.font = '14px Microsoft YaHei';
        ctx.textAlign = 'left';
        ctx.fillText(`回合: ${this.gameState.turnNumber}`, 30, this.canvas.height - 195);
        ctx.fillText(`抽牌堆: ${deckStatus.drawPile}`, 30, this.canvas.height - 170);
        ctx.fillText(`弃牌堆: ${deckStatus.discardPile}`, 30, this.canvas.height - 145);
        ctx.fillText(`手牌: ${deckStatus.hand}`, 30, this.canvas.height - 120);

        // 阶段五：绘制结束回合按钮
        this.drawEndTurnButton(ctx);

        // 阶段五：绘制回合阶段提示
        this.drawPhaseIndicator(ctx);
    }

    /**
     * 阶段十七：绘制顶部信息栏
     * @param {CanvasRenderingContext2D} ctx
     */
    drawTopBar(ctx) {
        const player = this.gameState.player;
        const topBarHeight = 40;

        // 1. 绘制半透明黑色背景栏
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(0, 0, this.canvas.width, topBarHeight);

        // 绘制底部边框线
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, topBarHeight);
        ctx.lineTo(this.canvas.width, topBarHeight);
        ctx.stroke();

        // 2. 左侧：玩家名称和HP
        ctx.fillStyle = '#ecf0f1';
        ctx.font = 'bold 16px Microsoft YaHei';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(player.name, 15, topBarHeight / 2);

        // HP（小字号）
        const hpPercent = player.hp / player.maxHp;
        const hpColor = hpPercent > 0.5 ? '#27ae60' : (hpPercent > 0.25 ? '#f39c12' : '#e74c3c');
        ctx.fillStyle = hpColor;
        ctx.font = '12px Microsoft YaHei';
        ctx.fillText(`HP: ${player.hp}/${player.maxHp}`, 80, topBarHeight / 2);

        // 3. 中间：金币数和层数
        const centerX = this.canvas.width / 2;

        // 金币
        ctx.fillStyle = '#f1c40f';
        ctx.font = 'bold 14px Microsoft YaHei';
        ctx.textAlign = 'center';
        ctx.fillText(`💰 ${player.gold}`, centerX - 60, topBarHeight / 2);

        // 层数
        ctx.fillStyle = '#9b59b6';
        ctx.font = 'bold 14px Microsoft YaHei';
        ctx.fillText(`🏰 ${this.gameState.currentFloor}/${this.gameState.maxFloor}`, centerX + 60, topBarHeight / 2);

        // 4. 右侧：遗物可视化
        this.drawRelics(ctx, topBarHeight);

        // 恢复文本基线
        ctx.textBaseline = 'alphabetic';
    }

    /**
     * 阶段十七：绘制遗物图标
     * @param {CanvasRenderingContext2D} ctx
     * @param {number} topBarHeight - 顶部栏高度
     */
    drawRelics(ctx, topBarHeight) {
        const player = this.gameState.player;
        if (!player.relics || player.relics.length === 0) return;

        // 遗物配置：不同遗物对应不同颜色和首字
        const relicConfig = {
            'vajra': { color: '#e74c3c', char: '金', bgColor: '#c0392b' },
            'anchor': { color: '#3498db', char: '船', bgColor: '#2980b9' }
        };

        const iconSize = 28;
        const spacing = 8;
        const startX = this.canvas.width - 20 - (player.relics.length * (iconSize + spacing)) + spacing;
        const startY = (topBarHeight - iconSize) / 2;

        // 清空遗物图标位置数组
        this.relicIcons = [];

        player.relics.forEach((relic, index) => {
            const x = startX + index * (iconSize + spacing);
            const y = startY;

            // 保存遗物图标位置用于悬停检测
            this.relicIcons.push({
                x: x,
                y: y,
                width: iconSize,
                height: iconSize,
                relic: relic
            });

            // 获取遗物配置
            const config = relicConfig[relic.id] || { color: '#95a5a6', char: relic.name.charAt(0), bgColor: '#7f8c8d' };

            // 绘制遗物背景（带圆角）
            ctx.fillStyle = config.bgColor;
            this.drawRoundedRect(ctx, x, y, iconSize, iconSize, 4);
            ctx.fill();

            // 绘制遗物边框
            ctx.strokeStyle = this.hoveredRelicIndex === index ? '#f1c40f' : config.color;
            ctx.lineWidth = this.hoveredRelicIndex === index ? 3 : 2;
            this.drawRoundedRect(ctx, x, y, iconSize, iconSize, 4);
            ctx.stroke();

            // 绘制遗物首字
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 14px Microsoft YaHei';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(config.char, x + iconSize / 2, y + iconSize / 2);
        });

        // 5. 绘制遗物悬停提示
        if (this.hoveredRelicIndex >= 0 && this.hoveredRelicIndex < this.relicIcons.length) {
            this.drawRelicTooltip(ctx, this.relicIcons[this.hoveredRelicIndex]);
        }
    }

    /**
     * 阶段十七：绘制遗物悬停提示框
     * @param {CanvasRenderingContext2D} ctx
     * @param {Object} relicIcon - 遗物图标位置信息
     */
    drawRelicTooltip(ctx, relicIcon) {
        const relic = relicIcon.relic;
        const tooltipPadding = 10;
        const tooltipWidth = 180;
        const lineHeight = 18;

        // 计算提示框高度（根据文字内容）
        ctx.font = 'bold 14px Microsoft YaHei';
        const nameHeight = 20;
        ctx.font = '12px Microsoft YaHei';
        const descLines = Math.ceil(ctx.measureText(relic.description).width / (tooltipWidth - 2 * tooltipPadding));
        const descHeight = Math.max(lineHeight, descLines * lineHeight);
        const tooltipHeight = nameHeight + descHeight + 3 * tooltipPadding;

        // 提示框位置（在遗物图标下方）
        let tooltipX = relicIcon.x + relicIcon.width / 2 - tooltipWidth / 2;
        let tooltipY = relicIcon.y + relicIcon.height + 5;

        // 边界检查：确保提示框不超出屏幕
        if (tooltipX < 10) tooltipX = 10;
        if (tooltipX + tooltipWidth > this.canvas.width - 10) {
            tooltipX = this.canvas.width - tooltipWidth - 10;
        }
        if (tooltipY + tooltipHeight > this.canvas.height) {
            // 如果下方空间不足，显示在图标上方
            tooltipY = relicIcon.y - tooltipHeight - 5;
        }

        // 绘制提示框背景（带阴影）
        ctx.save();
        ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
        ctx.shadowBlur = 10;
        ctx.shadowOffsetX = 3;
        ctx.shadowOffsetY = 3;

        ctx.fillStyle = 'rgba(30, 30, 40, 0.95)';
        this.drawRoundedRect(ctx, tooltipX, tooltipY, tooltipWidth, tooltipHeight, 8);
        ctx.fill();

        ctx.restore();

        // 绘制提示框边框
        ctx.strokeStyle = '#f1c40f';
        ctx.lineWidth = 2;
        this.drawRoundedRect(ctx, tooltipX, tooltipY, tooltipWidth, tooltipHeight, 8);
        ctx.stroke();

        // 绘制遗物名称
        ctx.fillStyle = '#f1c40f';
        ctx.font = 'bold 14px Microsoft YaHei';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(relic.name, tooltipX + tooltipPadding, tooltipY + tooltipPadding);

        // 绘制遗物描述
        ctx.fillStyle = '#ecf0f1';
        ctx.font = '12px Microsoft YaHei';
        this.drawWrappedText(ctx, relic.description, tooltipX + tooltipWidth / 2, tooltipY + tooltipPadding + nameHeight + 5, tooltipWidth - 2 * tooltipPadding, lineHeight);

        // 恢复文本基线
        ctx.textBaseline = 'alphabetic';
    }

    /**
     * 阶段十七：检测遗物悬停
     */
    checkRelicHover() {
        this.hoveredRelicIndex = -1;

        for (let i = 0; i < this.relicIcons.length; i++) {
            const icon = this.relicIcons[i];
            if (this.isMouseOver(this.input.mouseX, this.input.mouseY, icon)) {
                this.hoveredRelicIndex = i;
                break;
            }
        }
    }

    /**
     * 阶段五：绘制结束回合按钮
     * @param {CanvasRenderingContext2D} ctx
     */
    drawEndTurnButton(ctx) {
        // 只有在玩家回合才显示按钮
        if (this.gameState.currentPhase !== TurnPhase.PLAYER_TURN) {
            return;
        }

        const button = this.getEndTurnButtonRect();

        // 绘制按钮背景
        ctx.fillStyle = this.endTurnButtonHovered ? '#c0392b' : '#e74c3c';
        this.drawRoundedRect(ctx, button.x, button.y, button.width, button.height, 8);
        ctx.fill();

        // 绘制按钮边框
        ctx.strokeStyle = this.endTurnButtonHovered ? '#f1c40f' : '#ecf0f1';
        ctx.lineWidth = this.endTurnButtonHovered ? 3 : 2;
        this.drawRoundedRect(ctx, button.x, button.y, button.width, button.height, 8);
        ctx.stroke();

        // 绘制按钮文字
        ctx.fillStyle = '#ecf0f1';
        ctx.font = 'bold 16px Microsoft YaHei';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(
            '结束回合',
            button.x + button.width / 2,
            button.y + button.height / 2
        );

        // 恢复文本基线
        ctx.textBaseline = 'alphabetic';
    }

    /**
     * 阶段五：绘制回合阶段指示器
     * @param {CanvasRenderingContext2D} ctx
     */
    drawPhaseIndicator(ctx) {
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;

        // 根据回合阶段显示不同提示
        let phaseText = '';
        let phaseColor = '';

        switch (this.gameState.currentPhase) {
            case TurnPhase.PLAYER_TURN:
                // 玩家回合不显示大提示，只显示在牌堆信息中
                return;
            case TurnPhase.ENEMY_TURN:
                phaseText = '敌人回合';
                phaseColor = '#e74c3c';
                break;
            case TurnPhase.GAME_OVER:
                // 检查胜负
                if (this.gameState.player.isDead()) {
                    phaseText = '游戏结束 - 失败';
                    phaseColor = '#e74c3c';
                } else {
                    phaseText = '游戏结束 - 胜利！';
                    phaseColor = '#27ae60';
                }
                break;
        }

        // 绘制半透明背景
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(centerX - 150, centerY - 40, 300, 80);

        // 绘制文字
        ctx.fillStyle = phaseColor;
        ctx.font = 'bold 32px Microsoft YaHei';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(phaseText, centerX, centerY);

        // 恢复文本基线
        ctx.textBaseline = 'alphabetic';
    }
    
    /**
     * 绘制能量球 - 阶段十四：添加震动效果
     * @param {CanvasRenderingContext2D} ctx
     */
    drawEnergyOrb(ctx) {
        const player = this.gameState.player;
        if (!player) return;

        let orbX = 80;
        const orbY = this.canvas.height - 100;
        const orbRadius = 50;

        // 阶段十四：应用震动效果
        ctx.save();
        if (this.energyShake > 0) {
            const shakeX = (Math.random() - 0.5) * this.energyShake * 2;
            const shakeY = (Math.random() - 0.5) * this.energyShake * 2;
            ctx.translate(shakeX, shakeY);
        }

        // 绘制外圈发光效果
        const gradient = ctx.createRadialGradient(orbX, orbY, 10, orbX, orbY, orbRadius + 10);
        gradient.addColorStop(0, 'rgba(241, 196, 15, 0.8)');
        gradient.addColorStop(0.5, 'rgba(241, 196, 15, 0.3)');
        gradient.addColorStop(1, 'rgba(241, 196, 15, 0)');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(orbX, orbY, orbRadius + 10, 0, Math.PI * 2);
        ctx.fill();

        // 绘制能量球主体
        const orbGradient = ctx.createRadialGradient(orbX - 15, orbY - 15, 5, orbX, orbY, orbRadius);
        orbGradient.addColorStop(0, '#f9e79f');
        orbGradient.addColorStop(0.3, '#f1c40f');
        orbGradient.addColorStop(1, '#b7950b');

        ctx.fillStyle = orbGradient;
        ctx.beginPath();
        ctx.arc(orbX, orbY, orbRadius, 0, Math.PI * 2);
        ctx.fill();

        // 绘制边框
        ctx.strokeStyle = '#f39c12';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(orbX, orbY, orbRadius, 0, Math.PI * 2);
        ctx.stroke();

        // 绘制能量数值
        ctx.fillStyle = '#2c3e50';
        ctx.font = 'bold 36px Microsoft YaHei';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${player.energy}`, orbX, orbY);

        // 绘制分隔线
        ctx.strokeStyle = 'rgba(44, 62, 80, 0.3)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(orbX - 25, orbY + 5);
        ctx.lineTo(orbX + 25, orbY + 5);
        ctx.stroke();

        // 绘制最大能量
        ctx.fillStyle = '#2c3e50';
        ctx.font = 'bold 16px Microsoft YaHei';
        ctx.fillText(`${player.maxEnergy}`, orbX, orbY + 22);

        // 恢复文本基线
        ctx.textBaseline = 'alphabetic';

        // 绘制"ENERGY"标签
        ctx.fillStyle = '#f1c40f';
        ctx.font = 'bold 12px Microsoft YaHei';
        ctx.fillText('ENERGY', orbX, orbY + orbRadius + 20);

        // 阶段十四：恢复画布状态
        ctx.restore();
    }
    
    /**
     * 绘制 FPS 显示
     * @param {CanvasRenderingContext2D} ctx
     */
    drawFPS(ctx) {
        ctx.fillStyle = CONFIG.COLORS.FPS_TEXT;
        ctx.font = 'bold 20px Microsoft YaHei';
        ctx.textAlign = 'left';
        ctx.fillText(`FPS: ${this.fps}`, 20, 30);
    }
    
    /**
     * 绘制鼠标信息
     * @param {CanvasRenderingContext2D} ctx
     */
    drawMouseInfo(ctx) {
        ctx.fillStyle = '#ffffff';
        ctx.font = '14px Microsoft YaHei';
        ctx.textAlign = 'left';
        
        // 显示鼠标坐标
        ctx.fillText(`鼠标: (${Math.round(this.input.mouseX)}, ${Math.round(this.input.mouseY)})`, 20, 55);
        
        // 显示鼠标状态
        const mouseState = this.input.isMouseDown ? '按下' : '释放';
        ctx.fillText(`状态: ${mouseState}`, 20, 75);
    }
    
    /**
     * 绘制调试边界框 (Debug 神器)
     * 用红色矩形显示所有实体的碰撞框，帮助调试鼠标点击
     * @param {CanvasRenderingContext2D} ctx
     */
    drawDebugBounds(ctx) {
        ctx.strokeStyle = CONFIG.COLORS.DEBUG_BOUNDS;
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);  // 虚线样式
        
        // 绘制玩家碰撞框
        if (this.gameState.player) {
            const p = this.gameState.player;
            ctx.strokeRect(p.x, p.y, p.width, p.height);
            ctx.fillStyle = CONFIG.COLORS.DEBUG_TEXT;
            ctx.font = '12px monospace';
            ctx.textAlign = 'left';
            ctx.fillText(`Player: ${p.x},${p.y}`, p.x, p.y - 5);
        }
        
        // 绘制敌人碰撞框
        this.gameState.enemies.forEach((enemy, index) => {
            if (enemy.isDead()) return;
            ctx.strokeRect(enemy.x, enemy.y, enemy.width, enemy.height);
            ctx.fillStyle = CONFIG.COLORS.DEBUG_TEXT;
            ctx.font = '12px monospace';
            ctx.textAlign = 'left';
            ctx.fillText(`Enemy${index}: ${enemy.x},${enemy.y}`, enemy.x, enemy.y - 5);
        });
        
        // 绘制手牌碰撞框
        this.gameState.deckManager.hand.forEach((card, index) => {
            ctx.strokeRect(card.x, card.y, card.width, card.height);
            ctx.fillStyle = CONFIG.COLORS.DEBUG_TEXT;
            ctx.font = '10px monospace';
            ctx.textAlign = 'left';
            ctx.fillText(`Card${index}: ${card.x.toFixed(0)},${card.y.toFixed(0)}`, card.x, card.y - 3);
        });
        
        // 绘制鼠标位置十字准星
        ctx.strokeStyle = '#00ff00';
        ctx.lineWidth = 1;
        ctx.setLineDash([]);
        
        const crossSize = 10;
        ctx.beginPath();
        // 横线
        ctx.moveTo(this.input.mouseX - crossSize, this.input.mouseY);
        ctx.lineTo(this.input.mouseX + crossSize, this.input.mouseY);
        // 竖线
        ctx.moveTo(this.input.mouseX, this.input.mouseY - crossSize);
        ctx.lineTo(this.input.mouseX, this.input.mouseY + crossSize);
        ctx.stroke();
        
        // 恢复默认样式
        ctx.setLineDash([]);
    }
    
    /**
     * 游戏主循环
     * 使用 requestAnimationFrame 实现平滑动画
     * @param {number} currentTime - 当前时间戳
     */
    loop(currentTime) {
        // 计算时间差 (毫秒)
        const deltaTime = currentTime - this.lastTime;
        this.lastTime = currentTime;
        
        // 更新游戏逻辑
        this.update(deltaTime);
        
        // 渲染画面
        this.draw(this.ctx);
        
        // 请求下一帧
        requestAnimationFrame((time) => this.loop(time));
    }
    
    /**
     * 启动游戏引擎
     */
    start() {
        console.log('游戏引擎启动!');
        console.log('调试模式:', CONFIG.DEBUG ? '开启' : '关闭');
        console.log('操作提示: 移动鼠标查看悬停效果，点击方块查看点击效果');
        
        // 启动主循环
        requestAnimationFrame((time) => this.loop(time));
    }
}

// ============================================
// 5. 游戏启动
// ============================================

// 等待 DOM 加载完成
document.addEventListener('DOMContentLoaded', () => {
    // 创建游戏引擎实例
    const game = new GameEngine();
    
    // 启动游戏
    game.start();
});
