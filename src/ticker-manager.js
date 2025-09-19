const EventEmitter = require('events');

class TickerManager extends EventEmitter {
    constructor() {
        super();
        this.tickers = new Map();
    }

    processMessage(message) {
        if (!message.topic || !message.topic.startsWith('tickers.')) {
            return;
        }

        const symbol = this.extractSymbol(message.topic);
        if (!symbol) return;

        if (message.type === 'snapshot') {
            this.handleSnapshot(symbol, message.data);
        } else if (message.type === 'delta') {
            this.handleDelta(symbol, message.data);
        }
    }

    extractSymbol(topic) {
        const parts = topic.split('.');
        return parts.length >= 2 ? parts[1] : null;
    }

    handleSnapshot(symbol, data) {
        const ticker = {
            symbol,
            price24hPcnt: data.price24hPcnt || '0',
            openInterestValue: data.openInterestValue || '0',
            volume24h: data.volume24h || '0',
            fundingRate: data.fundingRate || '0',
            lastPrice: data.lastPrice || '0',
            prevPrice24h: data.prevPrice24h || '0',
            highPrice24h: data.highPrice24h || '0',
            lowPrice24h: data.lowPrice24h || '0',
            turnover24h: data.turnover24h || '0',
            timestamp: data.ts || Date.now()
        };

        this.tickers.set(symbol, ticker);
        this.emit('tickerUpdate', ticker);
    }

    handleDelta(symbol, data) {
        const existingTicker = this.tickers.get(symbol) || {
            symbol,
            price24hPcnt: '0',
            openInterestValue: '0',
            volume24h: '0',
            fundingRate: '0',
            lastPrice: '0',
            prevPrice24h: '0',
            highPrice24h: '0',
            lowPrice24h: '0',
            turnover24h: '0',
            timestamp: Date.now()
        };

        const updatedTicker = {
            ...existingTicker,
            price24hPcnt: data.price24hPcnt || existingTicker.price24hPcnt,
            openInterestValue: data.openInterestValue || existingTicker.openInterestValue,
            volume24h: data.volume24h || existingTicker.volume24h,
            fundingRate: data.fundingRate || existingTicker.fundingRate,
            lastPrice: data.lastPrice || existingTicker.lastPrice,
            prevPrice24h: data.prevPrice24h || existingTicker.prevPrice24h,
            highPrice24h: data.highPrice24h || existingTicker.highPrice24h,
            lowPrice24h: data.lowPrice24h || existingTicker.lowPrice24h,
            turnover24h: data.turnover24h || existingTicker.turnover24h,
            timestamp: data.ts || Date.now()
        };

        this.tickers.set(symbol, updatedTicker);
        this.emit('tickerUpdate', updatedTicker);
    }

    getTicker(symbol) {
        return this.tickers.get(symbol) || {
            symbol,
            price24hPcnt: '0',
            openInterestValue: '0',
            volume24h: '0',
            fundingRate: '0',
            lastPrice: '0',
            prevPrice24h: '0',
            highPrice24h: '0',
            lowPrice24h: '0',
            turnover24h: '0',
            timestamp: Date.now()
        };
    }

    clear(symbol = null) {
        if (symbol) {
            this.tickers.delete(symbol);
        } else {
            this.tickers.clear();
        }
    }
}

module.exports = TickerManager;