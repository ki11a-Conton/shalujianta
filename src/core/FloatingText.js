/**
 * ============================================
 * 漂浮文字类 - 战斗视觉反馈
 * ============================================
 */

export class FloatingText {
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
        this.velocityY = -1.5;
        this.fontSize = 24;
    }

    update() {
        this.y += this.velocityY;
        this.life--;
    }

    draw(ctx) {
        const alpha = this.life / this.maxLife;
        ctx.save();
        ctx.font = `bold ${this.fontSize}px Microsoft YaHei`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
        ctx.shadowBlur = 4;
        ctx.shadowOffsetX = 2;
        ctx.shadowOffsetY = 2;
        ctx.fillStyle = this.color;
        ctx.globalAlpha = alpha;
        ctx.fillText(this.text, this.x, this.y);
        ctx.restore();
    }

    isExpired() {
        return this.life <= 0;
    }
}
