/**
 * ============================================
 * InputManager - 输入管理器
 * ============================================
 */

export class InputManager {
    constructor(canvas) {
        this.canvas = canvas;
        this.mouseX = 0;
        this.mouseY = 0;
        this.isMouseDown = false;
        this.isClicked = false;
        this.bindEvents();
    }

    bindEvents() {
        this.canvas.addEventListener('mousemove', (e) => {
            this.updateMousePosition(e);
        });

        this.canvas.addEventListener('mousedown', (e) => {
            this.isMouseDown = true;
            this.updateMousePosition(e);
        });

        this.canvas.addEventListener('mouseup', (e) => {
            this.isMouseDown = false;
            this.isClicked = true;
            this.updateMousePosition(e);
        });

        this.canvas.addEventListener('mouseleave', () => {
            this.isMouseDown = false;
        });

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

    updateMousePosition(e) {
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        this.mouseX = (e.clientX - rect.left) * scaleX;
        this.mouseY = (e.clientY - rect.top) * scaleY;
    }

    updateTouchPosition(touch) {
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        this.mouseX = (touch.clientX - rect.left) * scaleX;
        this.mouseY = (touch.clientY - rect.top) * scaleY;
    }

    update() {
        this.isClicked = false;
    }
}
