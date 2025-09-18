const EventEmitter = require('events');

class KlineManager extends EventEmitter {
    constructor() {
        super();
        this.klineData = new Map();
        this.maxCandles = 100;
    }

    processMessage(message) {
        if (!message.topic || !message.topic.startsWith('kline.')) {
            return;
        }

        const topicParts = message.topic.split('.');
        if (topicParts.length < 3) return;

        const interval = topicParts[1];
        const symbol = topicParts[2];

        if (!message.data || !Array.isArray(message.data) || message.data.length === 0) {
            return;
        }

        const klineData = message.data[0];
        this.handleKlineUpdate(symbol, interval, klineData);
    }

    handleKlineUpdate(symbol, interval, klineData) {
        const key = `${symbol}_${interval}`;

        if (!this.klineData.has(key)) {
            this.klineData.set(key, {
                symbol,
                interval,
                candles: [],
                currentCandle: null
            });
        }

        const data = this.klineData.get(key);
        const candle = this.formatKlineData(klineData);

        if (klineData.confirm) {
            if (data.currentCandle && data.currentCandle.start === candle.start) {
                const index = data.candles.findIndex(c => c.start === candle.start);
                if (index !== -1) {
                    data.candles[index] = candle;
                } else {
                    data.candles.push(candle);
                }
                data.currentCandle = null;
            } else {
                data.candles.push(candle);
            }

            if (data.candles.length > this.maxCandles) {
                data.candles = data.candles.slice(-this.maxCandles);
            }

            console.log(`Confirmed candle for ${symbol} ${interval}: ${candle.close} (${candle.status})`);
        } else {
            data.currentCandle = candle;

            const existingIndex = data.candles.findIndex(c => c.start === candle.start);
            if (existingIndex !== -1) {
                data.candles[existingIndex] = candle;
            } else {
                data.candles.push(candle);
                if (data.candles.length > this.maxCandles) {
                    data.candles = data.candles.slice(-this.maxCandles);
                }
            }
        }

        this.emit('klineUpdate', {
            symbol,
            interval,
            candle,
            isConfirmed: klineData.confirm,
            allCandles: data.candles.slice(-50)
        });
    }

    formatKlineData(klineData) {
        const open = parseFloat(klineData.open);
        const close = parseFloat(klineData.close);
        const high = parseFloat(klineData.high);
        const low = parseFloat(klineData.low);
        const volume = parseFloat(klineData.volume);
        const turnover = parseFloat(klineData.turnover);

        return {
            start: parseInt(klineData.start),
            end: parseInt(klineData.end),
            interval: klineData.interval,
            open,
            close,
            high,
            low,
            volume,
            turnover,
            confirmed: klineData.confirm,
            status: klineData.confirm ? 'closed' : 'updating',
            change: close - open,
            changePercent: open > 0 ? ((close - open) / open) * 100 : 0,
            direction: close >= open ? 'bull' : 'bear',
            timestamp: parseInt(klineData.timestamp) || Date.now()
        };
    }

    getKlineData(symbol, interval, limit = 50) {
        const key = `${symbol}_${interval}`;
        const data = this.klineData.get(key);

        if (!data) return null;

        const candles = data.candles.slice(-limit);
        const currentCandle = data.currentCandle;

        return {
            symbol,
            interval,
            candles,
            currentCandle,
            candleCount: candles.length,
            lastUpdate: candles.length > 0 ? candles[candles.length - 1].timestamp : null
        };
    }

    getAllKlineData() {
        const result = {};
        for (const [key, data] of this.klineData.entries()) {
            result[key] = {
                symbol: data.symbol,
                interval: data.interval,
                candles: data.candles.slice(-50),
                currentCandle: data.currentCandle,
                candleCount: data.candles.length
            };
        }
        return result;
    }

    getLatestCandle(symbol, interval) {
        const key = `${symbol}_${interval}`;
        const data = this.klineData.get(key);

        if (!data) return null;

        if (data.currentCandle) {
            return data.currentCandle;
        }

        return data.candles.length > 0 ? data.candles[data.candles.length - 1] : null;
    }

    getOHLCStats(symbol, interval, period = 24) {
        const data = this.getKlineData(symbol, interval, period);
        if (!data || data.candles.length === 0) return null;

        const candles = data.candles;
        const latest = candles[candles.length - 1];
        const first = candles[0];

        const high24h = Math.max(...candles.map(c => c.high));
        const low24h = Math.min(...candles.map(c => c.low));
        const volume24h = candles.reduce((sum, c) => sum + c.volume, 0);
        const change24h = latest.close - first.open;
        const changePercent24h = first.open > 0 ? (change24h / first.open) * 100 : 0;

        return {
            symbol,
            interval,
            price: latest.close,
            change24h,
            changePercent24h,
            high24h,
            low24h,
            volume24h,
            lastUpdate: latest.timestamp,
            direction: change24h >= 0 ? 'bull' : 'bear'
        };
    }

    clear(symbol = null, interval = null) {
        if (symbol && interval) {
            const key = `${symbol}_${interval}`;
            this.klineData.delete(key);
        } else if (symbol) {
            for (const key of this.klineData.keys()) {
                if (key.startsWith(`${symbol}_`)) {
                    this.klineData.delete(key);
                }
            }
        } else {
            this.klineData.clear();
        }
    }

    getStats() {
        const stats = {};
        for (const [key, data] of this.klineData.entries()) {
            stats[key] = {
                symbol: data.symbol,
                interval: data.interval,
                candleCount: data.candles.length,
                hasCurrentCandle: !!data.currentCandle,
                lastUpdate: data.candles.length > 0
                    ? data.candles[data.candles.length - 1].timestamp
                    : null
            };
        }
        return stats;
    }

    getSupportedIntervals() {
        return ['1', '3', '5', '15', '30', '60', '120', '240', '360', '720', 'D', 'W', 'M'];
    }
}

module.exports = KlineManager;