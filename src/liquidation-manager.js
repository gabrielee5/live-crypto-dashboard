const EventEmitter = require('events');

class LiquidationManager extends EventEmitter {
    constructor() {
        super();
        this.liquidations = new Map();
        this.maxLiquidations = 100;
    }

    processMessage(message) {
        if (!message.topic || !message.topic.startsWith('allLiquidation.')) {
            return;
        }

        const symbol = this.extractSymbol(message.topic);
        if (!symbol) return;

        if (message.data && Array.isArray(message.data)) {
            message.data.forEach(liquidationData => {
                this.handleLiquidation(symbol, liquidationData);
            });
        }
    }

    extractSymbol(topic) {
        const parts = topic.split('.');
        return parts.length >= 2 ? parts[1] : null;
    }

    handleLiquidation(symbol, liquidationData) {
        const liquidation = this.formatLiquidationData(symbol, liquidationData);

        if (!this.liquidations.has(symbol)) {
            this.liquidations.set(symbol, []);
        }

        const symbolLiquidations = this.liquidations.get(symbol);
        symbolLiquidations.push(liquidation);

        if (symbolLiquidations.length > this.maxLiquidations) {
            symbolLiquidations.splice(0, symbolLiquidations.length - this.maxLiquidations);
        }

        this.emit('liquidation', liquidation);

        console.log(`Liquidation: ${symbol} ${liquidation.side} ${liquidation.volume} @ ${liquidation.price}`);
    }

    formatLiquidationData(symbol, data) {
        const price = parseFloat(data.p || data.price);
        const volume = parseFloat(data.v || data.volume);
        const side = data.S || data.side;
        const timestamp = parseInt(data.T || data.timestamp) || Date.now();

        const liquidation = {
            symbol,
            side: side === 'Buy' ? 'Long' : 'Short',
            price,
            volume,
            value: price * volume,
            timestamp,
            time: new Date(timestamp).toLocaleTimeString(),
            color: side === 'Buy' ? 'red' : 'green',
            id: `${symbol}_${timestamp}_${Math.random().toString(36).substr(2, 9)}`
        };

        return liquidation;
    }

    getLiquidations(symbol, limit = 50) {
        const symbolLiquidations = this.liquidations.get(symbol);
        if (!symbolLiquidations) return [];

        return symbolLiquidations
            .slice(-limit)
            .sort((a, b) => b.timestamp - a.timestamp);
    }

    getAllLiquidations(limit = 100) {
        const allLiquidations = [];

        for (const [symbol, liquidations] of this.liquidations.entries()) {
            allLiquidations.push(...liquidations.map(liq => ({ ...liq, symbol })));
        }

        return allLiquidations
            .sort((a, b) => b.timestamp - a.timestamp)
            .slice(0, limit);
    }

    getLiquidationStats(symbol, timeWindow = 3600000) {
        const now = Date.now();
        const windowStart = now - timeWindow;
        const symbolLiquidations = this.liquidations.get(symbol) || [];

        const recentLiquidations = symbolLiquidations.filter(
            liq => liq.timestamp >= windowStart
        );

        if (recentLiquidations.length === 0) {
            return {
                symbol,
                timeWindow: timeWindow / 1000,
                totalCount: 0,
                longCount: 0,
                shortCount: 0,
                totalVolume: 0,
                longVolume: 0,
                shortVolume: 0,
                totalValue: 0,
                longValue: 0,
                shortValue: 0,
                averagePrice: 0,
                maxLiquidation: null,
                dominantSide: 'none'
            };
        }

        const longLiquidations = recentLiquidations.filter(liq => liq.side === 'Long');
        const shortLiquidations = recentLiquidations.filter(liq => liq.side === 'Short');

        const totalVolume = recentLiquidations.reduce((sum, liq) => sum + liq.volume, 0);
        const totalValue = recentLiquidations.reduce((sum, liq) => sum + liq.value, 0);
        const longVolume = longLiquidations.reduce((sum, liq) => sum + liq.volume, 0);
        const shortVolume = shortLiquidations.reduce((sum, liq) => sum + liq.volume, 0);
        const longValue = longLiquidations.reduce((sum, liq) => sum + liq.value, 0);
        const shortValue = shortLiquidations.reduce((sum, liq) => sum + liq.value, 0);

        const maxLiquidation = recentLiquidations.reduce((max, liq) =>
            liq.value > max.value ? liq : max
        );

        const averagePrice = totalVolume > 0 ? totalValue / totalVolume : 0;

        let dominantSide = 'none';
        if (longValue > shortValue * 1.2) {
            dominantSide = 'Long';
        } else if (shortValue > longValue * 1.2) {
            dominantSide = 'Short';
        }

        return {
            symbol,
            timeWindow: timeWindow / 1000,
            totalCount: recentLiquidations.length,
            longCount: longLiquidations.length,
            shortCount: shortLiquidations.length,
            totalVolume,
            longVolume,
            shortVolume,
            totalValue,
            longValue,
            shortValue,
            averagePrice,
            maxLiquidation,
            dominantSide,
            longPercentage: (longValue / totalValue) * 100,
            shortPercentage: (shortValue / totalValue) * 100
        };
    }

    getRecentActivity(minutes = 5) {
        const timeWindow = minutes * 60 * 1000;
        const allRecent = [];

        for (const [symbol, liquidations] of this.liquidations.entries()) {
            const recent = liquidations.filter(
                liq => Date.now() - liq.timestamp < timeWindow
            );
            allRecent.push(...recent);
        }

        return allRecent
            .sort((a, b) => b.timestamp - a.timestamp)
            .slice(0, 50);
    }

    clear(symbol = null) {
        if (symbol) {
            this.liquidations.delete(symbol);
        } else {
            this.liquidations.clear();
        }
    }

    getStats() {
        const stats = {};
        for (const [symbol, liquidations] of this.liquidations.entries()) {
            const recent = liquidations.filter(
                liq => Date.now() - liq.timestamp < 3600000
            );

            stats[symbol] = {
                totalCount: liquidations.length,
                recentCount: recent.length,
                lastLiquidation: liquidations.length > 0
                    ? liquidations[liquidations.length - 1].timestamp
                    : null
            };
        }
        return stats;
    }

    formatLiquidationDisplay(liquidation) {
        const time = new Date(liquidation.timestamp).toLocaleTimeString();
        const price = liquidation.price.toFixed(2);
        const volume = liquidation.volume.toFixed(4);
        const value = liquidation.value.toFixed(2);

        return {
            ...liquidation,
            displayTime: time,
            displayPrice: price,
            displayVolume: volume,
            displayValue: value,
            sizeClass: this.getSizeClass(liquidation.value)
        };
    }

    getSizeClass(value) {
        if (value >= 1000000) return 'huge';
        if (value >= 100000) return 'large';
        if (value >= 10000) return 'medium';
        return 'small';
    }
}

module.exports = LiquidationManager;