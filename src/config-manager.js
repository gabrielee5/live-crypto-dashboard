const fs = require('fs');
const path = require('path');
const EventEmitter = require('events');

class ConfigManager extends EventEmitter {
    constructor(configPath = './config.json') {
        super();
        this.configPath = path.resolve(configPath);
        this.config = {};
        this.defaultConfig = {
            appearance: {
                theme: "dark",
                compactMode: false
            },
            trading: {
                defaultSymbol: "BTCUSDT",
                defaultInterval: "5",
                bigTradesFilter: 50000,
                whaleThreshold: 500000,
                blockTradeThreshold: 1000000,
                alarmEnabled: false
            },
            display: {
                maxOrderbookDepth: 50,
                maxTradesHistory: 100,
                autoRefreshInterval: 1000,
                candleChartHeight: 300
            },
            symbols: {
                favorites: ["BTCUSDT", "ETHUSDT", "ADAUSDT", "SOLUSDT", "BNBUSDT"],
                recent: []
            },
            network: {
                isTestnet: false,
                reconnectDelay: 5000,
                maxReconnectAttempts: 10
            }
        };

        this.loadConfig();
    }

    loadConfig() {
        try {
            if (fs.existsSync(this.configPath)) {
                const configData = fs.readFileSync(this.configPath, 'utf8');
                this.config = { ...this.defaultConfig, ...JSON.parse(configData) };
                console.log('✓ Configuration loaded from', this.configPath);
            } else {
                this.config = { ...this.defaultConfig };
                this.saveConfig();
                console.log('✓ Default configuration created at', this.configPath);
            }
        } catch (error) {
            console.error('Error loading config:', error.message);
            this.config = { ...this.defaultConfig };
        }
    }

    saveConfig() {
        try {
            fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2));
            this.emit('configChanged', this.config);
            return true;
        } catch (error) {
            console.error('Error saving config:', error.message);
            return false;
        }
    }

    get(path) {
        const keys = path.split('.');
        let value = this.config;

        for (const key of keys) {
            if (value && typeof value === 'object' && key in value) {
                value = value[key];
            } else {
                return undefined;
            }
        }

        return value;
    }

    set(path, value) {
        const keys = path.split('.');
        let current = this.config;

        for (let i = 0; i < keys.length - 1; i++) {
            const key = keys[i];
            if (!(key in current) || typeof current[key] !== 'object') {
                current[key] = {};
            }
            current = current[key];
        }

        current[keys[keys.length - 1]] = value;
        return this.saveConfig();
    }

    getAll() {
        return { ...this.config };
    }

    update(updates) {
        this.config = this.deepMerge(this.config, updates);
        return this.saveConfig();
    }

    reset() {
        this.config = { ...this.defaultConfig };
        return this.saveConfig();
    }

    deepMerge(target, source) {
        const result = { ...target };

        for (const key in source) {
            if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
                result[key] = this.deepMerge(target[key] || {}, source[key]);
            } else {
                result[key] = source[key];
            }
        }

        return result;
    }

    // Convenience methods for common operations
    addFavoriteSymbol(symbol) {
        const favorites = this.get('symbols.favorites') || [];
        if (!favorites.includes(symbol)) {
            favorites.push(symbol);
            return this.set('symbols.favorites', favorites);
        }
        return true;
    }

    removeFavoriteSymbol(symbol) {
        const favorites = this.get('symbols.favorites') || [];
        const updated = favorites.filter(s => s !== symbol);
        return this.set('symbols.favorites', updated);
    }

    addRecentSymbol(symbol) {
        let recent = this.get('symbols.recent') || [];
        recent = recent.filter(s => s !== symbol);
        recent.unshift(symbol);
        recent = recent.slice(0, 10); // Keep only last 10
        return this.set('symbols.recent', recent);
    }

    getTheme() {
        return this.get('appearance.theme') || 'dark';
    }

    setTheme(theme) {
        return this.set('appearance.theme', theme);
    }

    getTradingDefaults() {
        return {
            symbol: this.get('trading.defaultSymbol'),
            interval: this.get('trading.defaultInterval'),
            bigTradesFilter: this.get('trading.bigTradesFilter'),
            whaleThreshold: this.get('trading.whaleThreshold'),
            blockTradeThreshold: this.get('trading.blockTradeThreshold'),
            alarmEnabled: this.get('trading.alarmEnabled')
        };
    }
}

module.exports = ConfigManager;