/**
 * ============================================
 * SaveManager - 本地存档管理器
 * 使用 localStorage 实现游戏存档与读档
 * ============================================
 */

import { Card } from '../cards/Card.js';
import { Player } from '../entities/Player.js';
import { DeckManager } from './DeckManager.js';
import { VajraRelic, AnchorRelic, RedStoneRelic, FeatherRelic, CoinBagRelic, PenNibRelic, IceCreamRelic, PainWheelRelic, AmberRelic, BrokenCrownRelic } from './Relic.js';
import { CardType, CardTarget } from '../config/constants.js';

const SAVE_KEY = 'slay_the_spire_save';

export class SaveManager {
    static getRelicClassById(id) {
        const relicMap = {
            'vajra': VajraRelic,
            'anchor': AnchorRelic,
            'red_stone': RedStoneRelic,
            'feather': FeatherRelic,
            'coin_bag': CoinBagRelic,
            'pen_nib': PenNibRelic,
            'ice_cream': IceCreamRelic,
            'pain_wheel': PainWheelRelic,
            'amber': AmberRelic,
            'broken_crown': BrokenCrownRelic
        };
        return relicMap[id] || null;
    }

    static getCardDataById(id) {
        const cardTemplates = {
            'strike': { name: '打击', cost: 1, type: CardType.ATTACK, target: CardTarget.ENEMY, value: 6, desc: '造成 6 点伤害' },
            'defend': { name: '防御', cost: 1, type: CardType.SKILL, target: CardTarget.SELF, value: 5, desc: '获得 5 点格挡' },
            'heavy_strike': { name: '重击', cost: 2, type: CardType.ATTACK, target: CardTarget.ENEMY, value: 14, desc: '造成 14 点伤害' },
            'iron_skin': { name: '铁布衫', cost: 1, type: CardType.SKILL, target: CardTarget.SELF, value: 8, desc: '获得 8 点格挡' },
            'sword_qi': { name: '剑气', cost: 1, type: CardType.ATTACK, target: CardTarget.ENEMY, value: 8, desc: '造成 8 点伤害，抽 1 张牌', effects: [{ type: 'draw', value: 1 }] },
            'roar': { name: '怒吼', cost: 0, type: CardType.SKILL, target: CardTarget.SELF, value: 0, desc: '获得 2 层力量', effects: [{ type: 'apply_status', status: 'strength', value: 2 }] },
            'double_strike': { name: '双重打击', cost: 1, type: CardType.ATTACK, target: CardTarget.ENEMY, value: 5, desc: '造成 5 点伤害 2 次' },
            'flame_slash': { name: '火焰斩', cost: 2, type: CardType.ATTACK, target: CardTarget.ENEMY, value: 12, desc: '造成 12 点伤害，获得 2 层力量', effects: [{ type: 'apply_status', status: 'strength', value: 2 }] },
            'iron_wall': { name: '铁壁', cost: 2, type: CardType.SKILL, target: CardTarget.SELF, value: 12, desc: '获得 12 点格挡' },
            'deadly_poison': { name: '致命毒药', cost: 1, type: CardType.SKILL, target: CardTarget.ENEMY, value: 5, desc: '给予目标 5 层中毒', effects: [{ type: 'apply_status', status: 'poison', value: 5 }] },
            'catalyst': { name: '催化剂', cost: 1, type: CardType.SKILL, target: CardTarget.ENEMY, value: 0, desc: '使目标中毒层数翻倍', effects: [{ type: 'double_poison', value: 1 }] },
            'poison_sting': { name: '毒刺', cost: 1, type: CardType.ATTACK, target: CardTarget.ENEMY, value: 6, desc: '造成 6 点伤害，若目标中毒额外造成 6 点', effects: [{ type: 'poison_bonus', value: 6 }] }
        };

        const baseId = id.split('_')[0];
        if (cardTemplates[baseId]) {
            return cardTemplates[baseId];
        }

        for (const key of Object.keys(cardTemplates)) {
            if (id.startsWith(key)) {
                return cardTemplates[key];
            }
        }

        return cardTemplates['strike'];
    }

    static createCardFromSave(saveData) {
        const template = SaveManager.getCardDataById(saveData.id);
        return new Card(
            saveData.id,
            template.name,
            template.cost,
            template.type,
            template.target,
            template.value,
            template.desc,
            template.effects || [],
            saveData.keywords || {}
        );
    }

    static saveGame(gameState) {
        try {
            const saveData = {
                version: 1,
                timestamp: Date.now(),
                currentFloor: gameState.currentFloor,
                maxFloor: gameState.maxFloor,
                player: {
                    id: gameState.player.id,
                    name: gameState.player.name,
                    hp: gameState.player.hp,
                    maxHp: gameState.player.maxHp,
                    gold: gameState.player.gold,
                    relicIds: gameState.player.relics.map(r => r.id)
                },
                deck: {
                    cards: gameState.deckManager.getAllCards().map(card => ({
                        id: card.id,
                        keywords: card.keywords ? { ...card.keywords } : {}
                    }))
                }
            };

            localStorage.setItem(SAVE_KEY, JSON.stringify(saveData));
            console.log('游戏存档成功！');
            return true;
        } catch (error) {
            console.error('存档失败:', error);
            return false;
        }
    }

    static loadGame() {
        try {
            const saveStr = localStorage.getItem(SAVE_KEY);
            if (!saveStr) {
                console.log('没有找到存档');
                return null;
            }

            const saveData = JSON.parse(saveStr);
            console.log('读取存档成功，正在恢复游戏状态...');

            const player = new Player(
                saveData.player.id,
                saveData.player.name,
                saveData.player.maxHp
            );
            player.hp = saveData.player.hp;
            player.gold = saveData.player.gold;

            saveData.player.relicIds.forEach(relicId => {
                const RelicClass = SaveManager.getRelicClassById(relicId);
                if (RelicClass) {
                    player.relics.push(new RelicClass());
                }
            });

            const deckManager = new DeckManager();
            saveData.deck.cards.forEach(cardSave => {
                const card = SaveManager.createCardFromSave(cardSave);
                deckManager.addCard(card);
            });

            return {
                player,
                deckManager,
                currentFloor: saveData.currentFloor,
                maxFloor: saveData.maxFloor
            };
        } catch (error) {
            console.error('读档失败:', error);
            return null;
        }
    }

    static hasSave() {
        return localStorage.getItem(SAVE_KEY) !== null;
    }

    static deleteSave() {
        localStorage.removeItem(SAVE_KEY);
        console.log('存档已删除');
    }

    static getSaveInfo() {
        try {
            const saveStr = localStorage.getItem(SAVE_KEY);
            if (!saveStr) return null;

            const saveData = JSON.parse(saveStr);
            return {
                floor: saveData.currentFloor,
                maxFloor: saveData.maxFloor,
                hp: saveData.player.hp,
                maxHp: saveData.player.maxHp,
                gold: saveData.player.gold,
                relicCount: saveData.player.relicIds.length,
                deckSize: saveData.deck.cards.length,
                timestamp: saveData.timestamp
            };
        } catch (error) {
            return null;
        }
    }
}
