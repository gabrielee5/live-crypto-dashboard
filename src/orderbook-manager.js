const EventEmitter = require('events');

class OrderbookManager extends EventEmitter {
    constructor() {
        super();
        this.orderbooks = new Map();
    }

    processMessage(message) {
        if (!message.topic || !message.topic.startsWith('orderbook.')) {
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
        return parts.length >= 3 ? parts[2] : null;
    }

    handleSnapshot(symbol, data) {
        const orderbook = {
            symbol,
            bids: new Map(),
            asks: new Map(),
            timestamp: data.ts || Date.now(),
            sequence: data.seq || 0
        };

        data.b.forEach(([price, size]) => {
            if (parseFloat(size) > 0) {
                orderbook.bids.set(price, parseFloat(size));
            }
        });

        data.a.forEach(([price, size]) => {
            if (parseFloat(size) > 0) {
                orderbook.asks.set(price, parseFloat(size));
            }
        });

        this.orderbooks.set(symbol, orderbook);
        this.emitOrderbookUpdate(symbol);

    }

    handleDelta(symbol, data) {
        const orderbook = this.orderbooks.get(symbol);
        if (!orderbook) {
            console.warn(`No orderbook found for ${symbol}, ignoring delta`);
            return;
        }

        orderbook.timestamp = data.ts || Date.now();
        orderbook.sequence = data.seq || orderbook.sequence + 1;

        if (data.b && data.b.length > 0) {
            data.b.forEach(([price, size]) => {
                const sizeFloat = parseFloat(size);
                if (sizeFloat === 0) {
                    orderbook.bids.delete(price);
                } else {
                    orderbook.bids.set(price, sizeFloat);
                }
            });
        }

        if (data.a && data.a.length > 0) {
            data.a.forEach(([price, size]) => {
                const sizeFloat = parseFloat(size);
                if (sizeFloat === 0) {
                    orderbook.asks.delete(price);
                } else {
                    orderbook.asks.set(price, sizeFloat);
                }
            });
        }

        this.emitOrderbookUpdate(symbol);
    }

    emitOrderbookUpdate(symbol) {
        const orderbook = this.getFormattedOrderbook(symbol);
        if (orderbook) {
            this.emit('orderbookUpdate', orderbook);
        }
    }

    getFormattedOrderbook(symbol, depth = 50) {
        const orderbook = this.orderbooks.get(symbol);
        if (!orderbook) return null;

        const sortedBids = Array.from(orderbook.bids.entries())
            .map(([price, size]) => ({
                price: parseFloat(price),
                size,
                total: 0
            }))
            .sort((a, b) => b.price - a.price)
            .slice(0, depth);

        const sortedAsks = Array.from(orderbook.asks.entries())
            .map(([price, size]) => ({
                price: parseFloat(price),
                size,
                total: 0
            }))
            .sort((a, b) => a.price - b.price)
            .slice(0, depth);

        let bidTotal = 0;
        sortedBids.forEach(bid => {
            bidTotal += bid.size;
            bid.total = bidTotal;
        });

        let askTotal = 0;
        sortedAsks.forEach(ask => {
            askTotal += ask.size;
            ask.total = askTotal;
        });

        const spread = sortedAsks.length > 0 && sortedBids.length > 0
            ? sortedAsks[0].price - sortedBids[0].price
            : 0;

        const spreadPercent = sortedBids.length > 0 && spread > 0
            ? (spread / sortedBids[0].price) * 100
            : 0;

        return {
            symbol,
            timestamp: orderbook.timestamp,
            sequence: orderbook.sequence,
            bids: sortedBids,
            asks: sortedAsks,
            spread,
            spreadPercent,
            bidCount: orderbook.bids.size,
            askCount: orderbook.asks.size
        };
    }

    getOrderbook(symbol) {
        return this.getFormattedOrderbook(symbol);
    }

    getAllOrderbooks() {
        const result = {};
        for (const symbol of this.orderbooks.keys()) {
            result[symbol] = this.getFormattedOrderbook(symbol);
        }
        return result;
    }

    hasOrderbook(symbol) {
        return this.orderbooks.has(symbol);
    }

    clear(symbol = null) {
        if (symbol) {
            this.orderbooks.delete(symbol);
        } else {
            this.orderbooks.clear();
        }
    }

    getStats() {
        const stats = {};
        for (const [symbol, orderbook] of this.orderbooks.entries()) {
            stats[symbol] = {
                bidCount: orderbook.bids.size,
                askCount: orderbook.asks.size,
                lastUpdate: orderbook.timestamp,
                sequence: orderbook.sequence
            };
        }
        return stats;
    }
}

module.exports = OrderbookManager;