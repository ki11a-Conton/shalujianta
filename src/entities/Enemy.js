/**
 * ============================================
 * Enemy - 敌人类
 * 杀戮尖塔风格的敌人AI系统
 * ============================================
 */

import { Entity } from './Entity.js';
import { IntentType, StatusType } from '../config/constants.js';

export class Enemy extends Entity {
    constructor(id, name, maxHp, x = 0, y = 0) {
        super(id, name, maxHp, x, y, 120, 180);

        this.intentType = IntentType.UNKNOWN;
        this.intentValue = 0;
        this.intentDescription = '';
        this.intentIcon = '';

        this.turnCount = 0;
        this.isElite = false;
        this.isBoss = false;
        this.nextBlockGain = 0;
        
        this.lastIntent = null;
        this.moveHistory = [];
    }

    setIntent(type, value, description, icon = '') {
        this.intentType = type;
        this.intentValue = value;
        this.intentDescription = description;
        this.intentIcon = icon || this.getIntentIcon(type);
        this.lastIntent = { type, value, description };
    }

    getIntentIcon(type) {
        const icons = {
            [IntentType.ATTACK]: '⚔️',
            [IntentType.DEFEND]: '🛡️',
            [IntentType.BUFF]: '💪',
            [IntentType.DEBUFF]: '💀',
            [IntentType.ATTACK_DEFEND]: '⚔️🛡️',
            [IntentType.UNKNOWN]: '❓'
        };
        return icons[type] || '❓';
    }

    generateIntent() {
        this.turnCount++;
        this.moveHistory.push(this.lastIntent);

        switch (this.id) {
            case 'cultist':
                this.generateCultistIntent();
                break;
            case 'jaw_worm':
                this.generateJawWormIntent();
                break;
            case 'gremlin_nob':
                this.generateGremlinNobIntent();
                break;
            case 'slime_small':
            case 'slime_small_1':
            case 'slime_small_2':
            case 'slime_small_3':
                this.generateSlimeSmallIntent();
                break;
            case 'slime_large':
                this.generateLargeSlimeIntent();
                break;
            case 'looter':
                this.generateLooterIntent();
                break;
            case 'fungi_beast':
                this.generateFungiBeastIntent();
                break;
            case 'exordium_thug':
                this.generateExordiumThugIntent();
                break;
            case 'hexaghost':
                this.generateHexaghostIntent();
                break;
            case 'slaver_blue':
                this.generateSlaverBlueIntent();
                break;
            case 'skeleton_warrior':
                this.generateSkeletonWarriorIntent();
                break;
            case 'wraith':
                this.generateWraithIntent();
                break;
            case 'spider':
                this.generateSpiderIntent();
                break;
            case 'gargoyle':
                this.generateGargoyleIntent();
                break;
            case 'the_collector':
                this.generateCollectorIntent();
                break;
            default:
                this.generateRandomIntent();
        }
    }

    /**
     * 邪教徒 - 简单敌人
     * 第1回合：仪式(获得3层力量)
     * 之后：攻击6点
     */
    generateCultistIntent() {
        if (this.turnCount === 1) {
            this.setIntent(IntentType.BUFF, 3, '仪式：获得 3 层力量');
        } else {
            const strength = this.getStatus(StatusType.STRENGTH) || 0;
            const damage = 6 + strength;
            this.setIntent(IntentType.ATTACK, damage, `攻击 ${damage}`);
        }
    }

    /**
     * 颚虫 - 灵活敌人
     * 随机使用：啃咬(11伤害)、呻吟(获得4格挡)、咆哮(获得3力量)
     */
    generateJawWormIntent() {
        const strength = this.getStatus(StatusType.STRENGTH) || 0;
        const random = Math.random();
        
        if (this.turnCount === 1) {
            this.setIntent(IntentType.ATTACK, 11 + strength, `啃咬 ${11 + strength}`);
        } else {
            if (random < 0.45) {
                this.setIntent(IntentType.ATTACK, 11 + strength, `啃咬 ${11 + strength}`);
            } else if (random < 0.75) {
                this.setIntent(IntentType.DEFEND, 6, '呻吟：获得 6 格挡');
            } else {
                this.setIntent(IntentType.BUFF, 3, '咆哮：获得 3 层力量');
            }
        }
    }

    /**
     * 地精大块头 - 精英敌人
     * 被动：玩家打出技能牌时获得2层力量
     * 第1回合：咆哮(获得2力量)
     * 之后：重击(14伤害) 或 头槌(6伤害+获得6格挡)
     */
    generateGremlinNobIntent() {
        const strength = this.getStatus(StatusType.STRENGTH) || 0;
        
        if (this.turnCount === 1) {
            this.setIntent(IntentType.BUFF, 2, '咆哮：获得 2 层力量');
        } else {
            const random = Math.random();
            if (random < 0.67) {
                const damage = 14 + strength;
                this.setIntent(IntentType.ATTACK, damage, `重击 ${damage}`);
            } else {
                const damage = 6 + strength;
                this.setIntent(IntentType.ATTACK_DEFEND, damage, `头槌 ${damage} + 格挡 9`);
                this.nextBlockGain = 9;
            }
        }
    }

    /**
     * 小史莱姆 - 基础敌人
     * 2回合循环：攻击 -> 舔舐(施加虚弱)
     */
    generateSlimeSmallIntent() {
        const cycle = this.turnCount % 2;
        
        if (cycle === 1) {
            this.setIntent(IntentType.ATTACK, 5, '撞击 5');
        } else {
            this.setIntent(IntentType.DEBUFF, 1, '舔舐：施加 1 层虚弱');
        }
    }

    /**
     * 大史莱姆 - 精英敌人
     * 分裂机制：死亡时分裂成两个小史莱姆
     */
    generateLargeSlimeIntent() {
        const strength = this.getStatus(StatusType.STRENGTH) || 0;
        const cycle = this.turnCount % 3;
        
        if (cycle === 1) {
            this.setIntent(IntentType.ATTACK, 16 + strength, `猛击 ${16 + strength}`);
        } else if (cycle === 2) {
            this.setIntent(IntentType.DEBUFF, 2, '舔舐：施加 2 层虚弱');
        } else {
            this.setIntent(IntentType.DEFEND, 9, '凝聚：获得 9 格挡');
        }
    }

    /**
     * 掠夺者 - 灵活敌人
     * 会偷取金币，逃跑时带走金币
     */
    generateLooterIntent() {
        const cycle = (this.turnCount - 1) % 4;
        
        switch (cycle) {
            case 0:
                this.setIntent(IntentType.ATTACK, 10, '偷袭 10');
                break;
            case 1:
                this.setIntent(IntentType.DEFEND, 6, '闪避：获得 6 格挡');
                break;
            case 2:
                this.setIntent(IntentType.ATTACK, 10, '偷袭 10');
                break;
            case 3:
                this.setIntent(IntentType.UNKNOWN, 0, '逃跑！');
                break;
        }
    }

    /**
     * 真菌兽 - 野兽敌人
     * 会成长增加力量
     */
    generateFungiBeastIntent() {
        const strength = this.getStatus(StatusType.STRENGTH) || 0;
        const random = Math.random();
        
        if (random < 0.6) {
            this.setIntent(IntentType.ATTACK, 6 + strength, `撕咬 ${6 + strength}`);
        } else {
            this.setIntent(IntentType.BUFF, 2, '成长：获得 2 层力量');
        }
    }

    /**
     * 底层暴徒 - 中等敌人
     */
    generateExordiumThugIntent() {
        const strength = this.getStatus(StatusType.STRENGTH) || 0;
        const cycle = (this.turnCount - 1) % 3;
        
        switch (cycle) {
            case 0:
                this.setIntent(IntentType.ATTACK, 12 + strength, `重拳 ${12 + strength}`);
                break;
            case 1:
                this.setIntent(IntentType.DEBUFF, 1, '嘲讽：施加 1 层脆弱');
                break;
            case 2:
                this.setIntent(IntentType.DEFEND, 8, '防御：获得 8 格挡');
                break;
        }
    }

    /**
     * 六面鬼 - BOSS
     * 复杂的循环攻击模式
     */
    generateHexaghostIntent() {
        const cycle = (this.turnCount - 1) % 6;
        const strength = this.getStatus(StatusType.STRENGTH) || 0;
        
        switch (cycle) {
            case 0:
                this.setIntent(IntentType.ATTACK, 2, '充能');
                break;
            case 1:
                this.setIntent(IntentType.ATTACK, 5 + strength, `小火焰 ${5 + strength} x2`);
                break;
            case 2:
                this.setIntent(IntentType.ATTACK_DEFEND, 6 + strength, `分割 ${6 + strength} + 格挡 12`);
                this.nextBlockGain = 12;
                break;
            case 3:
                this.setIntent(IntentType.ATTACK, 8 + strength, `中火焰 ${8 + strength}`);
                break;
            case 4:
                this.setIntent(IntentType.DEBUFF, 1, '灼烧：施加 1 层虚弱');
                break;
            case 5:
                this.setIntent(IntentType.ATTACK, 20 + strength, `大火焰 ${20 + strength}`);
                break;
        }
    }

    /**
     * 蓝色奴隶贩子 - 中等敌人
     */
    generateSlaverBlueIntent() {
        const strength = this.getStatus(StatusType.STRENGTH) || 0;
        const random = Math.random();
        
        if (this.turnCount === 1) {
            this.setIntent(IntentType.DEBUFF, 1, '鞭打：施加 1 层脆弱');
        } else if (random < 0.5) {
            this.setIntent(IntentType.ATTACK, 9 + strength, `挥砍 ${9 + strength}`);
        } else {
            this.setIntent(IntentType.DEBUFF, 1, '鞭打：施加 1 层脆弱');
        }
    }

    /**
     * 骷髅战士 - 坚韧敌人
     * 3回合循环：攻击 -> 防御 -> 蓄力
     */
    generateSkeletonWarriorIntent() {
        const cycle = this.turnCount % 3;
        
        if (cycle === 1) {
            this.setIntent(IntentType.ATTACK, 10, '挥剑 10');
        } else if (cycle === 2) {
            this.setIntent(IntentType.DEFEND, 12, '盾牌：获得 12 格挡');
        } else {
            this.setIntent(IntentType.BUFF, 2, '蓄力：获得 2 层力量');
        }
    }

    /**
     * 幽灵 - 灵活敌人
     * 会施加脆弱效果
     */
    generateWraithIntent() {
        const random = Math.random();
        
        if (random < 0.4) {
            this.setIntent(IntentType.ATTACK, 8, '灵击 8');
        } else if (random < 0.7) {
            this.setIntent(IntentType.DEBUFF, 2, '诅咒：施加 2 层脆弱');
        } else {
            this.setIntent(IntentType.ATTACK, 12, '猛击 12');
        }
    }

    /**
     * 毒蜘蛛 - 小型敌人
     * 会施加中毒效果
     */
    generateSpiderIntent() {
        const cycle = this.turnCount % 2;
        
        if (cycle === 1) {
            this.setIntent(IntentType.ATTACK, 6, '叮咬 6');
        } else {
            this.setIntent(IntentType.DEBUFF, 3, '下毒：施加 3 层中毒');
        }
    }

    /**
     * 石像鬼 - 精英敌人
     * 高格挡，会蓄力攻击
     */
    generateGargoyleIntent() {
        const cycle = this.turnCount % 3;
        
        if (cycle === 1) {
            this.setIntent(IntentType.DEFEND, 15, '石化：获得 15 格挡');
        } else if (cycle === 2) {
            this.setIntent(IntentType.BUFF, 3, '蓄力：获得 3 层力量');
        } else {
            const strength = this.getStatus(StatusType.STRENGTH) || 0;
            this.setIntent(IntentType.ATTACK, 18 + strength, `石击 ${18 + strength}`);
        }
    }

    /**
     * 收藏家 -  boss敌人
     * 会召唤小怪，使用多种攻击方式
     */
    generateCollectorIntent() {
        const random = Math.random();
        
        if (this.turnCount === 1) {
            this.setIntent(IntentType.BUFF, 1, '准备：召唤助手');
        } else if (random < 0.3) {
            this.setIntent(IntentType.ATTACK, 15, '挥刀 15');
        } else if (random < 0.6) {
            this.setIntent(IntentType.ATTACK, 20, '重击 20');
        } else {
            this.setIntent(IntentType.BUFF, 1, '召唤：召唤助手');
        }
    }

    generateRandomIntent() {
        const intents = [
            { type: IntentType.ATTACK, value: 10, desc: '攻击 10' },
            { type: IntentType.DEFEND, value: 8, desc: '防御 8' },
            { type: IntentType.ATTACK, value: 15, desc: '重击 15' }
        ];

        const intent = intents[Math.floor(Math.random() * intents.length)];
        this.setIntent(intent.type, intent.value, intent.desc);
    }

    onPlayerCardPlayed(card) {
        if (this.id === 'gremlin_nob' && card.type === 'skill') {
            this.applyStatus(StatusType.STRENGTH, 2);
            console.log(`[精英被动] ${this.name} 激怒触发：获得 2 层力量`);
        }
    }

    executeIntent(player) {
        const strength = this.getStatus(StatusType.STRENGTH) || 0;
        
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
                if (this.intentDescription.includes('力量')) {
                    this.applyStatus(StatusType.STRENGTH, this.intentValue);
                    console.log(`${this.name} 获得 ${this.intentValue} 层力量`);
                } else if (this.intentDescription.includes('格挡')) {
                    this.gainBlock(this.intentValue);
                    console.log(`${this.name} 获得 ${this.intentValue} 点格挡`);
                }
                break;
                
            case IntentType.DEBUFF:
                if (this.intentDescription.includes('脆弱')) {
                    player.applyStatus(StatusType.VULNERABLE, this.intentValue);
                    console.log(`${this.name} 给玩家施加 ${this.intentValue} 层脆弱`);
                } else if (this.intentDescription.includes('虚弱')) {
                    player.applyStatus(StatusType.WEAK, this.intentValue);
                    console.log(`${this.name} 给玩家施加 ${this.intentValue} 层虚弱`);
                } else if (this.intentDescription.includes('中毒')) {
                    player.applyStatus(StatusType.POISON, this.intentValue);
                    console.log(`${this.name} 给玩家施加 ${this.intentValue} 层中毒`);
                }
                break;
                
            case IntentType.UNKNOWN:
                console.log(`${this.name} 执行特殊行动：${this.intentDescription}`);
                break;
        }
    }

    getStatusInfo() {
        const baseInfo = super.getStatusInfo();
        return {
            ...baseInfo,
            intentType: this.intentType,
            intentValue: this.intentValue,
            intentDescription: this.intentDescription,
            intentIcon: this.intentIcon,
            turnCount: this.turnCount,
            isElite: this.isElite,
            isBoss: this.isBoss
        };
    }
}

/**
 * 敌人工厂 - 创建各种敌人
 */
export class EnemyFactory {
    static createCultist() {
        const enemy = new Enemy('cultist', '邪教徒', 48 + Math.floor(Math.random() * 10));
        return enemy;
    }

    static createJawWorm() {
        const enemy = new Enemy('jaw_worm', '颚虫', 40 + Math.floor(Math.random() * 6));
        return enemy;
    }

    static createGremlinNob() {
        const enemy = new Enemy('gremlin_nob', '地精大块头', 82 + Math.floor(Math.random() * 10));
        enemy.isElite = true;
        return enemy;
    }

    static createSlimeSmall(suffix = '') {
        const enemy = new Enemy(`slime_small${suffix ? '_' + suffix : ''}`, '小史莱姆', 10 + Math.floor(Math.random() * 5));
        return enemy;
    }

    static createLargeSlime() {
        const enemy = new Enemy('slime_large', '大史莱姆', 60 + Math.floor(Math.random() * 10));
        enemy.isElite = true;
        return enemy;
    }

    static createLooter() {
        const enemy = new Enemy('looter', '掠夺者', 40 + Math.floor(Math.random() * 6));
        return enemy;
    }

    static createFungiBeast() {
        const enemy = new Enemy('fungi_beast', '真菌兽', 22 + Math.floor(Math.random() * 6));
        return enemy;
    }

    static createExordiumThug() {
        const enemy = new Enemy('exordium_thug', '底层暴徒', 40 + Math.floor(Math.random() * 8));
        return enemy;
    }

    static createSlaverBlue() {
        const enemy = new Enemy('slaver_blue', '奴隶贩子', 44 + Math.floor(Math.random() * 6));
        return enemy;
    }

    static createHexaghost() {
        const enemy = new Enemy('hexaghost', '六面鬼', 250);
        enemy.isBoss = true;
        return enemy;
    }

    static createSkeletonWarrior() {
        const enemy = new Enemy('skeleton_warrior', '骷髅战士', 35 + Math.floor(Math.random() * 8));
        return enemy;
    }

    static createWraith() {
        const enemy = new Enemy('wraith', '幽灵', 28 + Math.floor(Math.random() * 6));
        return enemy;
    }

    static createSpider() {
        const enemy = new Enemy('spider', '毒蜘蛛', 22 + Math.floor(Math.random() * 4));
        return enemy;
    }

    static createGargoyle() {
        const enemy = new Enemy('gargoyle', '石像鬼', 50 + Math.floor(Math.random() * 10));
        enemy.isElite = true;
        return enemy;
    }

    static createTheCollector() {
        const enemy = new Enemy('the_collector', '收藏家', 300);
        enemy.isBoss = true;
        return enemy;
    }

    static getRandomEnemy(floor) {
        const basicEnemies = [
            EnemyFactory.createCultist,
            EnemyFactory.createJawWorm,
            EnemyFactory.createLooter,
            EnemyFactory.createFungiBeast,
            EnemyFactory.createSpider,
            EnemyFactory.createWraith
        ];
        
        const mediumEnemies = [
            EnemyFactory.createExordiumThug,
            EnemyFactory.createSlaverBlue,
            EnemyFactory.createSkeletonWarrior
        ];
        
        if (floor <= 2) {
            const creator = basicEnemies[Math.floor(Math.random() * basicEnemies.length)];
            return creator();
        } else {
            const allEnemies = [...basicEnemies, ...mediumEnemies];
            const creator = allEnemies[Math.floor(Math.random() * allEnemies.length)];
            return creator();
        }
    }

    static getEliteEnemy(floor) {
        if (floor <= 3) {
            const elites = [EnemyFactory.createGremlinNob, EnemyFactory.createLargeSlime, EnemyFactory.createGargoyle];
            return elites[Math.floor(Math.random() * elites.length)]();
        } else {
            const elites = [EnemyFactory.createGremlinNob, EnemyFactory.createLargeSlime, EnemyFactory.createGargoyle];
            return elites[Math.floor(Math.random() * elites.length)]();
        }
    }

    static getBossEnemy(floor) {
        const bosses = [EnemyFactory.createHexaghost, EnemyFactory.createTheCollector];
        return bosses[Math.floor(Math.random() * bosses.length)]();
    }

    static generateEncounter(floor, isElite = false, isBoss = false) {
        const enemies = [];
        
        if (isBoss) {
            enemies.push(EnemyFactory.getBossEnemy(floor));
        } else if (isElite) {
            enemies.push(EnemyFactory.getEliteEnemy(floor));
        } else {
            const encounterType = Math.random();
            
            if (floor <= 2) {
                if (encounterType < 0.6) {
                    enemies.push(EnemyFactory.getRandomEnemy(floor));
                } else {
                    enemies.push(EnemyFactory.createSlimeSmall('1'));
                    enemies.push(EnemyFactory.createSlimeSmall('2'));
                }
            } else if (floor <= 4) {
                if (encounterType < 0.4) {
                    enemies.push(EnemyFactory.getRandomEnemy(floor));
                } else if (encounterType < 0.7) {
                    enemies.push(EnemyFactory.createCultist());
                    enemies.push(EnemyFactory.createCultist());
                } else {
                    enemies.push(EnemyFactory.createSlimeSmall('1'));
                    enemies.push(EnemyFactory.createSlimeSmall('2'));
                }
            } else {
                if (encounterType < 0.3) {
                    enemies.push(EnemyFactory.getRandomEnemy(floor));
                } else if (encounterType < 0.6) {
                    enemies.push(EnemyFactory.createJawWorm());
                    enemies.push(EnemyFactory.createCultist());
                } else {
                    enemies.push(EnemyFactory.createSlaverBlue());
                    enemies.push(EnemyFactory.createLooter());
                }
            }
        }
        
        return enemies;
    }
}
