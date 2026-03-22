/**
 * ============================================
 * 全局配置与常量
 * ============================================
 */

// 游戏帧率设置
export const CONFIG = {
    TARGET_FPS: 60,
    DEBUG: true,
    COLORS: {
        FPS_TEXT: '#00ff00',
        DEBUG_BOUNDS: '#ff0000',
        DEBUG_TEXT: '#ffff00',
        BACKGROUND: '#1a1a2e'
    }
};

// 卡牌类型枚举
export const CardType = {
    ATTACK: 'attack',
    SKILL: 'skill',
    POWER: 'power'
};

// 卡牌目标类型枚举
export const CardTarget = {
    ENEMY: 'enemy',
    ALL_ENEMIES: 'allEnemies',
    SELF: 'self',
    NONE: 'none'
};

// 敌人意图类型枚举
export const IntentType = {
    ATTACK: 'attack',
    DEFEND: 'defend',
    BUFF: 'buff',
    DEBUFF: 'debuff',
    UNKNOWN: 'unknown'
};

// 回合阶段枚举
export const TurnPhase = {
    PLAYER_TURN: 'player_turn',
    ENEMY_TURN: 'enemy_turn',
    GAME_OVER: 'game_over'
};

// 状态效果类型枚举
export const StatusType = {
    STRENGTH: 'strength',
    VULNERABLE: 'vulnerable',
    WEAK: 'weak',
    DEXTERITY: 'dexterity',
    FRAIL: 'frail',
    RETAIN_BLOCK: 'retain_block'
};

// UI 状态枚举
export const UIState = {
    BATTLE: 'battle',
    REWARD: 'reward',
    CAMPFIRE: 'campfire',
    MAP: 'map',
    GAME_WIN: 'game_win'
};

// 地图节点类型枚举
export const NodeType = {
    BATTLE: 'battle',
    ELITE: 'elite',
    CAMPFIRE: 'campfire'
};

// 辅助函数：延时
export const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
