/**
 * ============================================
 * AssetManager - 游戏资源管理器
 * 负责预加载和管理所有图片资源
 * ============================================
 */

class AssetManager {
    constructor() {
        this.images = {};
        this.loaded = false;
        this.loadProgress = 0;
        this.totalAssets = 0;
        this.loadedAssets = 0;

        this.assetList = {
            bg: 'assets/images/bg.jpg',
            player: 'assets/images/player.png',
            enemy_cultist: 'assets/images/enemy_cultist.png',
            enemy_slime: 'assets/images/enemy_slime.png',
            enemy_jaw_worm: 'assets/images/enemy_jaw_worm.png',
            card_attack: 'assets/images/card_attack.png',
            card_skill: 'assets/images/card_skill.png',
            card_power: 'assets/images/card_power.png',
            card_bg: 'assets/images/card_bg.png',
            relic_vajra: 'assets/images/relic_vajra.png',
            relic_anchor: 'assets/images/relic_anchor.png',
            energy_orb: 'assets/images/energy_orb.png',
            shop_icon: 'assets/images/shop_icon.png',
            campfire: 'assets/images/campfire.png'
        };
    }

    async loadAll(onProgress = null) {
        const keys = Object.keys(this.assetList);
        this.totalAssets = keys.length;
        this.loadedAssets = 0;

        const loadPromises = keys.map(key => {
            return new Promise((resolve, reject) => {
                const img = new Image();
                img.onload = () => {
                    this.images[key] = img;
                    this.loadedAssets++;
                    this.loadProgress = this.loadedAssets / this.totalAssets;
                    if (onProgress) {
                        onProgress(this.loadProgress, key);
                    }
                    resolve(img);
                };
                img.onerror = () => {
                    console.warn(`资源加载失败: ${key} (${this.assetList[key]})`);
                    this.images[key] = null;
                    this.loadedAssets++;
                    this.loadProgress = this.loadedAssets / this.totalAssets;
                    if (onProgress) {
                        onProgress(this.loadProgress, key);
                    }
                    resolve(null);
                };
                img.src = this.assetList[key];
            });
        });

        await Promise.all(loadPromises);
        this.loaded = true;
        console.log(`资源加载完成: ${this.loadedAssets}/${this.totalAssets}`);
        return this.images;
    }

    getImage(key) {
        return this.images[key] || null;
    }

    hasImage(key) {
        return this.images[key] !== null && this.images[key] !== undefined;
    }

    isLoaded() {
        return this.loaded;
    }

    getProgress() {
        return this.loadProgress;
    }
}

const assetManager = new AssetManager();
export { assetManager, AssetManager };
