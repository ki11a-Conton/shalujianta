/**
 * ============================================
 * InputManager - 输入管理器 (移动端适配版)
 * ============================================
 */

export class InputManager {
    constructor(canvas) {
        this.canvas = canvas;
        this.mouseX = 0;
        this.mouseY = 0;
        this.isMouseDown = false;
        this.isClicked = false;
        
        this.isMobile = this.detectMobile();
        this.isTouching = false;
        this.touchStartX = 0;
        this.touchStartY = 0;
        this.lastTapTime = 0;
        this.doubleTapThreshold = 300;
        this.longPressTimer = null;
        this.longPressThreshold = 500;
        this.isLongPress = false;
        
        this.pinchDistance = 0;
        this.isPinching = false;
        this.scale = 1;
        
        this.bindEvents();
    }

    detectMobile() {
        const userAgent = navigator.userAgent || navigator.vendor || window.opera;
        const isMobileUA = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent.toLowerCase());
        const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
        const isSmallScreen = window.innerWidth <= 768 || window.innerHeight <= 500;
        return isMobileUA || (isTouchDevice && isSmallScreen);
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
            this.handleTouchStart(e);
        }, { passive: false });

        this.canvas.addEventListener('touchend', (e) => {
            this.handleTouchEnd(e);
        }, { passive: false });

        this.canvas.addEventListener('touchmove', (e) => {
            this.handleTouchMove(e);
        }, { passive: false });

        this.canvas.addEventListener('touchcancel', (e) => {
            this.handleTouchCancel(e);
        }, { passive: false });

        this.canvas.addEventListener('gesturestart', (e) => {
            e.preventDefault();
        }, { passive: false });

        this.canvas.addEventListener('gesturechange', (e) => {
            e.preventDefault();
        }, { passive: false });

        this.canvas.addEventListener('gestureend', (e) => {
            e.preventDefault();
        }, { passive: false });

        window.addEventListener('resize', () => {
            this.handleResize();
        });

        document.addEventListener('contextmenu', (e) => {
            e.preventDefault();
        });
    }

    handleTouchStart(e) {
        e.preventDefault();
        
        const touches = e.touches;
        
        if (touches.length === 1) {
            this.isMouseDown = true;
            this.isTouching = true;
            this.updateTouchPosition(touches[0]);
            
            this.touchStartX = this.mouseX;
            this.touchStartY = this.mouseY;
            
            this.longPressTimer = setTimeout(() => {
                this.isLongPress = true;
            }, this.longPressThreshold);
            
        } else if (touches.length === 2) {
            clearTimeout(this.longPressTimer);
            this.isPinching = true;
            this.pinchDistance = this.getPinchDistance(touches);
        }
    }

    handleTouchEnd(e) {
        e.preventDefault();
        
        clearTimeout(this.longPressTimer);
        
        if (this.isPinching) {
            this.isPinching = false;
            return;
        }
        
        if (this.isTouching) {
            const currentTime = Date.now();
            const timeDiff = currentTime - this.lastTapTime;
            
            if (timeDiff < this.doubleTapThreshold) {
                this.onDoubleTap && this.onDoubleTap(this.mouseX, this.mouseY);
            }
            
            this.lastTapTime = currentTime;
            
            if (!this.isLongPress) {
                this.isClicked = true;
            }
        }
        
        this.isMouseDown = false;
        this.isTouching = false;
        this.isLongPress = false;
    }

    handleTouchMove(e) {
        e.preventDefault();
        
        const touches = e.touches;
        
        if (touches.length === 1) {
            const dx = Math.abs(this.mouseX - this.touchStartX);
            const dy = Math.abs(this.mouseY - this.touchStartY);
            
            if (dx > 10 || dy > 10) {
                clearTimeout(this.longPressTimer);
                this.isLongPress = false;
            }
            
            this.updateTouchPosition(touches[0]);
        } else if (touches.length === 2 && this.isPinching) {
            const newDistance = this.getPinchDistance(touches);
            const scaleChange = newDistance / this.pinchDistance;
            this.scale *= scaleChange;
            this.scale = Math.max(0.5, Math.min(2, this.scale));
            this.pinchDistance = newDistance;
        }
    }

    handleTouchCancel(e) {
        e.preventDefault();
        clearTimeout(this.longPressTimer);
        this.isMouseDown = false;
        this.isTouching = false;
        this.isLongPress = false;
        this.isPinching = false;
    }

    getPinchDistance(touches) {
        const dx = touches[0].clientX - touches[1].clientX;
        const dy = touches[0].clientY - touches[1].clientY;
        return Math.sqrt(dx * dx + dy * dy);
    }

    handleResize() {
        this.isMobile = this.detectMobile();
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

    getTouchInfo() {
        return {
            startX: this.touchStartX,
            startY: this.touchStartY,
            isLongPress: this.isLongPress,
            scale: this.scale
        };
    }
}
