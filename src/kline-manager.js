const EventEmitter = require('events');
const axios = require('axios');

class KlineManager extends EventEmitter {
    constructor(isTestnet = false) {
        super();
        this.klineData = new Map();
        this.maxCandles = 500;
        this.isTestnet = isTestnet;
        this.baseUrl = isTestnet
            ? 'https://api-testnet.bybit.com'
            : 'https://api.bybit.com';
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
            allCandles: data.candles.slice(-250)
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
                candles: data.candles.slice(-250),
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

    async fetchHistoricalData(symbol, interval, limit = 100) {
        try {
            const params = {
                category: 'linear',
                symbol,
                interval,
                limit: Math.min(limit, 1000)
            };

            const response = await axios.get(`${this.baseUrl}/v5/market/kline`, { params });

            if (response.data && response.data.retCode === 0 && response.data.result) {
                const klines = response.data.result.list;

                return klines.map(kline => ({
                    start: parseInt(kline[0]),
                    end: parseInt(kline[0]) + this.getIntervalMs(interval) - 1,
                    interval,
                    open: parseFloat(kline[1]),
                    high: parseFloat(kline[2]),
                    low: parseFloat(kline[3]),
                    close: parseFloat(kline[4]),
                    volume: parseFloat(kline[5]),
                    turnover: parseFloat(kline[6]),
                    confirmed: true,
                    status: 'closed',
                    change: parseFloat(kline[4]) - parseFloat(kline[1]),
                    changePercent: parseFloat(kline[1]) > 0 ? ((parseFloat(kline[4]) - parseFloat(kline[1])) / parseFloat(kline[1])) * 100 : 0,
                    direction: parseFloat(kline[4]) >= parseFloat(kline[1]) ? 'bull' : 'bear',
                    timestamp: parseInt(kline[0])
                })).reverse();
            }

            throw new Error('Invalid response from Bybit API');
        } catch (error) {
            console.error(`Failed to fetch historical data for ${symbol}:`, error.message);
            throw error;
        }
    }

    getIntervalMs(interval) {
        const intervals = {
            '1': 60 * 1000,
            '3': 3 * 60 * 1000,
            '5': 5 * 60 * 1000,
            '15': 15 * 60 * 1000,
            '30': 30 * 60 * 1000,
            '60': 60 * 60 * 1000,
            '120': 2 * 60 * 60 * 1000,
            '240': 4 * 60 * 60 * 1000,
            '360': 6 * 60 * 60 * 1000,
            '720': 12 * 60 * 60 * 1000,
            'D': 24 * 60 * 60 * 1000,
            'W': 7 * 24 * 60 * 60 * 1000,
            'M': 30 * 24 * 60 * 60 * 1000
        };
        return intervals[interval] || 5 * 60 * 1000;
    }

    async initializeHistoricalData(symbol, interval, limit = 100) {
        try {
            const key = `${symbol}_${interval}`;

            if (this.klineData.has(key)) {
                const data = this.klineData.get(key);
                if (data.candles.length > 0) {
                    return data.candles;
                }
            }

            const historicalCandles = await this.fetchHistoricalData(symbol, interval, limit);

            if (!this.klineData.has(key)) {
                this.klineData.set(key, {
                    symbol,
                    interval,
                    candles: [],
                    currentCandle: null
                });
            }

            const data = this.klineData.get(key);
            data.candles = historicalCandles.slice(-this.maxCandles);


            this.emit('historicalDataLoaded', {
                symbol,
                interval,
                candles: data.candles,
                candleCount: data.candles.length
            });

            return data.candles;
        } catch (error) {
            console.error(`Failed to initialize historical data for ${symbol} ${interval}:`, error.message);
            this.emit('error', {
                message: `Failed to load historical data: ${error.message}`,
                symbol,
                interval
            });
            return [];
        }
    }

    setTestnet(isTestnet) {
        this.isTestnet = isTestnet;
        this.baseUrl = isTestnet
            ? 'https://api-testnet.bybit.com'
            : 'https://api.bybit.com';
    }
}

module.exports = KlineManager;