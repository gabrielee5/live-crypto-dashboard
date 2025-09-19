const EventEmitter = require('events');

class BigTradesManager extends EventEmitter {
    constructor() {
        super();
        this.trades = [];
        this.maxTrades = 100;
        this.minTradeValue = 50000; // Default $50K minimum
        this.whaleThreshold = 500000; // $500K+ = whale trade
        this.blockTradeThreshold = 1000000; // $1M+ = block trade
    }

    setMinTradeValue(value) {
        this.minTradeValue = value;
    }

    addTrade(tradeData) {
        try {
            const trade = this.processTrade(tradeData);
            if (!trade) return null;

            // Only include trades above minimum value
            if (trade.value < this.minTradeValue) return null;

            // Add timestamp for sorting
            trade.timestamp = Date.now();
            trade.time = new Date(parseInt(trade.T)).toLocaleTimeString();

            // Add to beginning of array (newest first)
            this.trades.unshift(trade);

            // Keep only max trades
            if (this.trades.length > this.maxTrades) {
                this.trades = this.trades.slice(0, this.maxTrades);
            }


            // Emit the big trade event
            this.emit('bigTrade', trade);

            return trade;
        } catch (error) {
            console.error('Error processing trade:', error);
            return null;
        }
    }

    processTrade(tradeData) {
        if (!tradeData || !tradeData.data || !Array.isArray(tradeData.data)) {
            return null;
        }

        // Process all trades in the data array and find the largest
        let largestTrade = null;
        let largestValue = 0;

        for (const trade of tradeData.data) {
            const price = parseFloat(trade.p);
            const size = parseFloat(trade.v);
            const value = price * size;

            if (value > largestValue && value >= this.minTradeValue) {
                largestValue = value;
                largestTrade = {
                    id: trade.i,
                    symbol: trade.s,
                    side: trade.S,
                    price: price,
                    size: size,
                    value: value,
                    T: trade.T,
                    isBlockTrade: trade.BT || false,
                    sequence: trade.seq
                };
            }
        }

        return largestTrade;
    }

    getTradeSize(value) {
        if (value >= this.blockTradeThreshold) return 'block';
        if (value >= this.whaleThreshold) return 'whale';
        if (value >= 100000) return 'large';
        if (value >= 50000) return 'medium';
        return 'small';
    }

    getFilteredTrades(minValue = null) {
        const filterValue = minValue || this.minTradeValue;
        return this.trades.filter(trade => trade.value >= filterValue);
    }

    getRecentTrades(timeWindowMs = 300000) { // 5 minutes default
        const cutoff = Date.now() - timeWindowMs;
        return this.trades.filter(trade => trade.timestamp > cutoff);
    }

    getStats() {
        const recent = this.getRecentTrades();
        const totalValue = recent.reduce((sum, trade) => sum + trade.value, 0);
        const avgValue = recent.length > 0 ? totalValue / recent.length : 0;

        const whales = recent.filter(t => t.value >= this.whaleThreshold).length;
        const blocks = recent.filter(t => t.isBlockTrade).length;

        return {
            totalTrades: this.trades.length,
            recentTrades: recent.length,
            totalValue: totalValue,
            avgValue: avgValue,
            whales: whales,
            blockTrades: blocks
        };
    }

    processMessage(message) {
        try {
            if (!message || !message.topic) return;

            // Check if this is a trade message
            if (message.topic.startsWith('publicTrade.')) {
                this.addTrade(message);
            }
        } catch (error) {
            console.error('Error processing trade message:', error);
        }
    }

    clear() {
        this.trades = [];
    }
}

module.exports = BigTradesManager;