/**
 * ============================================
 * DeckManager - 牌组管理器
 * 负责管理抽牌堆、手牌、弃牌堆、消耗堆的流转
 * ============================================
 */

export class DeckManager {
    constructor() {
        this.drawPile = [];      // 抽牌堆
        this.hand = [];          // 手牌
        this.discardPile = [];   // 弃牌堆
        this.exhaustPile = [];   // 消耗堆（永久移除）
        this.maxHandSize = 10;   // 最大手牌数
    }

    /**
     * 添加卡牌到牌组（通常在战斗外调用）
     * @param {Card} card - 卡牌对象
     */
    addCard(card) {
        this.drawPile.push(card);
    }

    /**
     * 洗牌 - 将弃牌堆洗回抽牌堆
     */
    shuffleDiscardIntoDraw() {
        console.log('弃牌堆洗回抽牌堆');
        this.drawPile.push(...this.discardPile);
        this.discardPile = [];
        this.shuffleDrawPile();
    }

    /**
     * 随机打乱抽牌堆
     */
    shuffleDrawPile() {
        for (let i = this.drawPile.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.drawPile[i], this.drawPile[j]] = [this.drawPile[j], this.drawPile[i]];
        }
    }

    /**
     * 抽牌
     * @param {number} count - 抽牌数量
     * @returns {number} 实际抽到的牌数
     */
    drawCards(count) {
        let drawn = 0;

        for (let i = 0; i < count; i++) {
            // 检查手牌上限
            if (this.hand.length >= this.maxHandSize) {
                console.log('手牌已满，无法继续抽牌');
                break;
            }

            // 如果抽牌堆为空，将弃牌堆洗回抽牌堆
            if (this.drawPile.length === 0) {
                if (this.discardPile.length === 0) {
                    console.log('牌堆已空，无法抽牌');
                    break;
                }
                this.shuffleDiscardIntoDraw();
            }

            // 从抽牌堆顶部抽一张牌
            const card = this.drawPile.pop();
            this.hand.push(card);
            drawn++;
        }

        console.log(`抽了 ${drawn} 张牌，手牌: ${this.hand.length}`);
        return drawn;
    }

    /**
     * 打出卡牌 - 将卡牌从手牌移到弃牌堆或消耗堆
     * @param {Card} card - 要打出的卡牌
     * @returns {boolean} 是否成功
     */
    playCard(card) {
        const index = this.hand.indexOf(card);
        if (index === -1) {
            console.log('手牌中没有这张牌！');
            return false;
        }

        // 从手牌移除
        this.hand.splice(index, 1);

        // 根据 keywords.exhaust 判断放入哪个牌堆
        if (card.keywords && card.keywords.exhaust) {
            this.exhaustPile.push(card);
            console.log(`卡牌 ${card.name} 被消耗`);
        } else {
            this.discardPile.push(card);
        }

        return true;
    }

    /**
     * 回合结束时弃掉所有手牌
     */
    discardHand() {
        const retainedCards = [];

        while (this.hand.length > 0) {
            const card = this.hand.pop();
            // 如果卡牌有 retain 关键字，保留在手牌中
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
     * 战斗开始时初始化
     * @param {number} drawCount - 初始抽牌数
     */
    initBattle(drawCount = 5) {
        // 将所有牌移到抽牌堆
        this.drawPile.push(...this.hand);
        this.drawPile.push(...this.discardPile);
        this.hand = [];
        this.discardPile = [];

        // 洗牌并抽初始手牌
        this.shuffleDrawPile();
        this.drawCards(drawCount);
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

    /**
     * 获取所有卡牌（用于保存或展示）
     * @returns {Array}
     */
    getAllCards() {
        return [
            ...this.drawPile,
            ...this.hand,
            ...this.discardPile,
            ...this.exhaustPile
        ];
    }
}
