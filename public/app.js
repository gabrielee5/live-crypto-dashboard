class EnhancedOrderbook {
    constructor(maxDepth = 50) {
        this.maxDepth = maxDepth;
        this.bids = new Map();
        this.asks = new Map();
        this.totalBidVolume = 0;
        this.totalAskVolume = 0;
        this.lastUpdate = Date.now();
    }

    updateData(orderbook) {
        if (!orderbook) return;

        this.bids.clear();
        this.asks.clear();

        if (orderbook.bids) {
            orderbook.bids.forEach(bid => {
                this.bids.set(bid.price.toString(), bid.size);
            });
        }

        if (orderbook.asks) {
            orderbook.asks.forEach(ask => {
                this.asks.set(ask.price.toString(), ask.size);
            });
        }

        this.calculateTotalVolumes();
        this.lastUpdate = Date.now();
    }

    calculateTotalVolumes() {
        this.totalBidVolume = Array.from(this.bids.values()).reduce((sum, size) => sum + size, 0);
        this.totalAskVolume = Array.from(this.asks.values()).reduce((sum, size) => sum + size, 0);
    }

    calculateDepthData() {
        const bids = Array.from(this.bids.entries())
            .sort(([a], [b]) => parseFloat(b) - parseFloat(a))
            .slice(0, this.maxDepth);

        const asks = Array.from(this.asks.entries())
            .sort(([a], [b]) => parseFloat(a) - parseFloat(b))
            .slice(0, this.maxDepth);

        let bidCumulative = 0, askCumulative = 0;
        const maxBidVolume = Math.max(...bids.map(([_, size]) => parseFloat(size)));
        const maxAskVolume = Math.max(...asks.map(([_, size]) => parseFloat(size)));

        return {
            bids: bids.map(([price, size]) => {
                bidCumulative += parseFloat(size);
                return {
                    price: parseFloat(price),
                    size: parseFloat(size),
                    cumulative: bidCumulative,
                    percentage: maxBidVolume > 0 ? (parseFloat(size) / maxBidVolume) * 100 : 0
                };
            }),
            asks: asks.map(([price, size]) => {
                askCumulative += parseFloat(size);
                return {
                    price: parseFloat(price),
                    size: parseFloat(size),
                    cumulative: askCumulative,
                    percentage: maxAskVolume > 0 ? (parseFloat(size) / maxAskVolume) * 100 : 0
                };
            })
        };
    }

    getSpreadInfo() {
        if (this.bids.size === 0 || this.asks.size === 0) return null;

        const bestBid = Math.max(...Array.from(this.bids.keys()).map(parseFloat));
        const bestAsk = Math.min(...Array.from(this.asks.keys()).map(parseFloat));
        const spread = bestAsk - bestBid;
        const midPrice = (bestBid + bestAsk) / 2;
        const spreadPercent = (spread / midPrice) * 100;

        return {
            bestBid,
            bestAsk,
            spread,
            spreadPercent: spreadPercent.toFixed(4),
            midPrice
        };
    }

    getImbalanceInfo() {
        const total = this.totalBidVolume + this.totalAskVolume;
        if (total === 0) return { bidPercentage: 50, askPercentage: 50, ratio: 1 };

        const bidPercentage = (this.totalBidVolume / total) * 100;
        const askPercentage = (this.totalAskVolume / total) * 100;
        const ratio = this.totalBidVolume / this.totalAskVolume;

        return {
            bidPercentage: bidPercentage.toFixed(1),
            askPercentage: askPercentage.toFixed(1),
            ratio: ratio.toFixed(2)
        };
    }
}

class BybitDashboard {
    constructor() {
        console.log('Initializing Enhanced Bybit Dashboard...');
        this.socket = null;
        this.currentSymbol = 'BTCUSDT';
        this.currentInterval = '5';
        this.isConnected = false;
        this.enhancedOrderbook = new EnhancedOrderbook();
        this.liquidations = [];
        this.klineData = null;
        this.updateQueue = [];
        this.isUpdating = false;

        this.initializeElements();
        this.initializeSocket();
        this.setupEventListeners();
        this.startUpdateLoop();
        console.log('Enhanced Dashboard initialization complete');
    }

    initializeElements() {
        this.elements = {
            statusIndicator: document.getElementById('statusIndicator'),
            statusText: document.getElementById('statusText'),
            latency: document.getElementById('latency'),
            symbolDisplay: document.getElementById('symbolDisplay'),
            symbolInput: document.getElementById('symbolInput'),
            symbolBtn: document.getElementById('symbolBtn'),
            intervalSelect: document.getElementById('intervalSelect'),
            testnetToggle: document.getElementById('testnetToggle'),
            currentPrice: document.getElementById('currentPrice'),
            priceChange: document.getElementById('priceChange'),
            spread: document.getElementById('spread'),
            volume24h: document.getElementById('volume24h'),

            // Enhanced orderbook elements
            bidVolume: document.getElementById('bidVolume'),
            askVolume: document.getElementById('askVolume'),
            imbalanceBar: document.getElementById('imbalanceBar'),
            bidPortion: document.getElementById('bidPortion'),
            askPortion: document.getElementById('askPortion'),
            imbalanceText: document.getElementById('imbalanceText'),
            asksContainer: document.getElementById('asksContainer'),
            bidsContainer: document.getElementById('bidsContainer'),
            midPrice: document.getElementById('midPrice'),
            spreadValue: document.getElementById('spreadValue'),

            // Chart and liquidations
            klineContainer: document.getElementById('klineContainer'),
            klineStats: document.getElementById('klineStats'),
            liquidationsList: document.getElementById('liquidationsList'),
            liquidationStats: document.getElementById('liquidationStats')
        };
    }

    initializeSocket() {
        console.log('Initializing Socket.io connection...');

        if (typeof io === 'undefined') {
            console.error('Socket.io client library not loaded!');
            return;
        }

        try {
            this.socket = io();
            console.log('Socket.io initialized');
        } catch (error) {
            console.error('Failed to initialize Socket.io:', error);
            return;
        }

        this.socket.on('connect', () => {
            console.log('Connected to server');
            this.updateConnectionStatus(true);
        });

        this.socket.on('disconnect', () => {
            console.log('Disconnected from server');
            this.updateConnectionStatus(false);
        });

        this.socket.on('status', (data) => {
            this.updateConnectionStatus(data.connected);
            if (data.symbol) this.currentSymbol = data.symbol;
            if (data.interval) this.currentInterval = data.interval;
            this.updateControls();
        });

        this.socket.on('orderbook', (data) => {
            this.queueUpdate(() => this.updateOrderbook(data));
        });

        this.socket.on('kline', (data) => {
            this.queueUpdate(() => this.updateKline(data));
        });

        this.socket.on('liquidation', (liquidation) => {
            this.queueUpdate(() => this.addLiquidation(liquidation));
        });

        this.socket.on('liquidations', (liquidations) => {
            this.queueUpdate(() => this.updateLiquidations(liquidations));
        });

        this.socket.on('symbolChanged', (data) => {
            this.currentSymbol = data.symbol;
            this.elements.symbolInput.value = data.symbol;
            this.elements.symbolDisplay.textContent = data.symbol;
            this.clearData();
        });

        this.socket.on('intervalChanged', (data) => {
            this.currentInterval = data.interval;
            this.elements.intervalSelect.value = data.interval;
            this.clearKlineData();
        });

        this.socket.on('connect_error', (error) => {
            console.error('Socket connection error:', error);
            this.updateConnectionStatus(false);
        });

        this.socket.on('error', (error) => {
            console.error('Socket error:', error);
        });
    }

    setupEventListeners() {
        this.elements.symbolBtn.addEventListener('click', () => {
            const symbol = this.elements.symbolInput.value.trim().toUpperCase();
            if (symbol && symbol !== this.currentSymbol) {
                this.changeSymbol(symbol);
            }
        });

        this.elements.symbolInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const symbol = this.elements.symbolInput.value.trim().toUpperCase();
                if (symbol && symbol !== this.currentSymbol) {
                    this.changeSymbol(symbol);
                }
            }
        });

        this.elements.intervalSelect.addEventListener('change', () => {
            const interval = this.elements.intervalSelect.value;
            if (interval !== this.currentInterval) {
                this.changeInterval(interval);
            }
        });

        this.elements.testnetToggle.addEventListener('change', () => {
            this.toggleTestnet(this.elements.testnetToggle.checked);
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.target.tagName === 'INPUT') return;

            switch(e.key) {
                case ' ':
                    e.preventDefault();
                    this.toggleConnection();
                    break;
                case 'r':
                case 'R':
                    e.preventDefault();
                    this.refreshData();
                    break;
                case '1':
                    this.elements.intervalSelect.value = '1';
                    this.changeInterval('1');
                    break;
                case '5':
                    this.elements.intervalSelect.value = '5';
                    this.changeInterval('5');
                    break;
            }
        });
    }

    queueUpdate(updateFn) {
        this.updateQueue.push(updateFn);
    }

    startUpdateLoop() {
        setInterval(() => {
            if (this.isUpdating || this.updateQueue.length === 0) return;

            this.isUpdating = true;
            const update = this.updateQueue.shift();

            try {
                update();
            } catch (error) {
                console.error('Error during update:', error);
            }

            this.isUpdating = false;
        }, 16); // ~60fps
    }

    updateConnectionStatus(connected) {
        this.isConnected = connected;
        this.elements.statusIndicator.className = `status-indicator ${connected ? 'connected' : 'disconnected'}`;
        this.elements.statusText.textContent = connected ? 'Connected' : 'Disconnected';

        if (connected) {
            this.elements.latency.textContent = '< 100ms';
        } else {
            this.elements.latency.textContent = '';
        }
    }

    updateControls() {
        this.elements.symbolInput.value = this.currentSymbol;
        this.elements.symbolDisplay.textContent = this.currentSymbol;
        this.elements.intervalSelect.value = this.currentInterval;
    }

    changeSymbol(symbol) {
        this.socket.emit('changeSymbol', { symbol });
    }

    changeInterval(interval) {
        this.socket.emit('changeInterval', { interval });
    }

    toggleTestnet(testnet) {
        this.socket.emit('toggleTestnet', { testnet });
    }

    toggleConnection() {
        // Placeholder for connection toggle
        console.log('Connection toggle requested');
    }

    refreshData() {
        this.clearData();
        // Emit refresh request
        this.socket.emit('refresh');
    }

    updateOrderbook(orderbook) {
        if (!orderbook) return;

        this.enhancedOrderbook.updateData(orderbook);
        this.renderEnhancedOrderbook();
        this.updateOrderbookStats();
        this.updateSpreadInfo();
    }

    renderEnhancedOrderbook() {
        const depthData = this.enhancedOrderbook.calculateDepthData();

        // Render asks (highest to lowest)
        this.elements.asksContainer.innerHTML = depthData.asks.reverse().map(ask => {
            const depthPercentage = Math.min(ask.percentage, 100);
            return `
                <div class="orderbook-row ask" data-price="${ask.price}">
                    <div class="depth-background ask-depth" style="width: ${depthPercentage}%"></div>
                    <span class="price">${this.formatPrice(ask.price)}</span>
                    <span class="size">${this.formatSize(ask.size)}</span>
                    <span class="total">${this.formatSize(ask.cumulative)}</span>
                </div>
            `;
        }).join('');

        // Render bids (highest to lowest)
        this.elements.bidsContainer.innerHTML = depthData.bids.map(bid => {
            const depthPercentage = Math.min(bid.percentage, 100);
            return `
                <div class="orderbook-row bid" data-price="${bid.price}">
                    <div class="depth-background bid-depth" style="width: ${depthPercentage}%"></div>
                    <span class="price">${this.formatPrice(bid.price)}</span>
                    <span class="size">${this.formatSize(bid.size)}</span>
                    <span class="total">${this.formatSize(bid.cumulative)}</span>
                </div>
            `;
        }).join('');

        // Add click handlers for price levels
        this.addOrderbookClickHandlers();
    }

    addOrderbookClickHandlers() {
        document.querySelectorAll('.orderbook-row').forEach(row => {
            row.addEventListener('click', () => {
                const price = row.dataset.price;
                console.log(`Price level clicked: ${price}`);
                // Flash the row
                row.classList.add('updating-row');
                setTimeout(() => row.classList.remove('updating-row'), 300);
            });
        });
    }

    updateOrderbookStats() {
        const imbalance = this.enhancedOrderbook.getImbalanceInfo();

        this.elements.bidVolume.textContent = this.formatSize(this.enhancedOrderbook.totalBidVolume);
        this.elements.askVolume.textContent = this.formatSize(this.enhancedOrderbook.totalAskVolume);

        // Update imbalance bar
        if (this.elements.bidPortion && this.elements.askPortion) {
            this.elements.bidPortion.style.width = `${imbalance.bidPercentage}%`;
            this.elements.askPortion.style.width = `${imbalance.askPercentage}%`;
        }

        this.elements.imbalanceText.textContent = `${imbalance.bidPercentage}% | ${imbalance.askPercentage}%`;
    }

    updateSpreadInfo() {
        const spreadInfo = this.enhancedOrderbook.getSpreadInfo();
        if (!spreadInfo) return;

        this.elements.currentPrice.textContent = `$${this.formatPrice(spreadInfo.midPrice)}`;
        this.elements.midPrice.textContent = `$${this.formatPrice(spreadInfo.midPrice)}`;
        this.elements.spreadValue.textContent = `Spread: $${spreadInfo.spread.toFixed(2)} (${spreadInfo.spreadPercent}%)`;
        this.elements.spread.textContent = `$${spreadInfo.spread.toFixed(2)}`;
    }

    updateKline(data) {
        if (!data) return;

        this.klineData = data;
        this.renderKline();
        this.updateKlineStats();
    }

    renderKline() {
        if (!this.klineData || !this.klineData.allCandles) return;

        const candles = this.klineData.allCandles.slice(-30);

        this.elements.klineContainer.innerHTML = `
            <table class="kline-table">
                <thead>
                    <tr>
                        <th>Time</th>
                        <th>Open</th>
                        <th>High</th>
                        <th>Low</th>
                        <th>Close</th>
                        <th>Volume</th>
                        <th>Change</th>
                    </tr>
                </thead>
                <tbody>
                    ${candles.reverse().map(candle => `
                        <tr class="kline-row ${candle.direction} ${candle.status === 'updating' ? 'updating' : ''}">
                            <td>${new Date(candle.start).toLocaleTimeString()}</td>
                            <td>${this.formatPrice(candle.open)}</td>
                            <td>${this.formatPrice(candle.high)}</td>
                            <td>${this.formatPrice(candle.low)}</td>
                            <td>${this.formatPrice(candle.close)}</td>
                            <td>${this.formatVolume(candle.volume)}</td>
                            <td class="${candle.change >= 0 ? 'positive' : 'negative'}">
                                ${candle.changePercent >= 0 ? '+' : ''}${candle.changePercent.toFixed(2)}%
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;

        if (this.klineData.candle) {
            const latest = this.klineData.candle;
            this.elements.priceChange.className = `price-change ${latest.change >= 0 ? 'positive' : 'negative'}`;
            this.elements.priceChange.textContent = `${latest.change >= 0 ? '+' : ''}${latest.changePercent.toFixed(2)}%`;
        }
    }

    updateKlineStats() {
        if (!this.klineData) return;

        const status = this.klineData.isConfirmed ? 'Confirmed' : 'Live';
        this.elements.klineStats.textContent = `${this.klineData.allCandles.length} candles (${status})`;
    }

    updateLiquidations(liquidations) {
        this.liquidations = liquidations.slice(0, 100);
        this.renderLiquidations();
        this.updateLiquidationStats();
    }

    addLiquidation(liquidation) {
        this.liquidations.unshift(liquidation);
        if (this.liquidations.length > 100) {
            this.liquidations.pop();
        }
        this.renderLiquidations();
        this.updateLiquidationStats();
        this.flashLiquidation();
    }

    renderLiquidations() {
        if (this.liquidations.length === 0) {
            this.elements.liquidationsList.innerHTML = '<div class="loading">No liquidations yet...</div>';
            return;
        }

        this.elements.liquidationsList.innerHTML = this.liquidations.slice(0, 50).map(liq => {
            const sizeClass = this.getSizeClass(liq.value);
            return `
                <div class="liquidation-row ${liq.side.toLowerCase()} ${sizeClass}">
                    <span>${liq.time}</span>
                    <span>${liq.side}</span>
                    <span>${this.formatSize(liq.volume)}</span>
                    <span>${this.formatPrice(liq.price)}</span>
                    <span>$${this.formatValue(liq.value)}</span>
                </div>
            `;
        }).join('');
    }

    updateLiquidationStats() {
        const recent = this.liquidations.filter(liq =>
            Date.now() - liq.timestamp < 300000
        );
        this.elements.liquidationStats.textContent = `Recent (5m): ${recent.length}`;
    }

    getSizeClass(value) {
        if (value >= 1000000) return 'huge';
        if (value >= 100000) return 'large';
        if (value >= 10000) return 'medium';
        return 'small';
    }

    flashLiquidation() {
        this.elements.liquidationsList.classList.add('flash');
        setTimeout(() => {
            this.elements.liquidationsList.classList.remove('flash');
        }, 500);
    }

    formatPrice(price) {
        if (typeof price !== 'number') price = parseFloat(price);
        if (price >= 1000) return price.toFixed(2);
        if (price >= 100) return price.toFixed(3);
        if (price >= 1) return price.toFixed(4);
        return price.toFixed(6);
    }

    formatSize(size) {
        if (typeof size !== 'number') size = parseFloat(size);
        if (size >= 1000) return (size / 1000).toFixed(1) + 'K';
        if (size >= 100) return size.toFixed(1);
        if (size >= 10) return size.toFixed(2);
        return size.toFixed(3);
    }

    formatVolume(volume) {
        if (typeof volume !== 'number') volume = parseFloat(volume);
        if (volume >= 1000000) return (volume / 1000000).toFixed(1) + 'M';
        if (volume >= 1000) return (volume / 1000).toFixed(1) + 'K';
        return volume.toFixed(1);
    }

    formatValue(value) {
        if (typeof value !== 'number') value = parseFloat(value);
        if (value >= 1000000) return (value / 1000000).toFixed(1) + 'M';
        if (value >= 1000) return (value / 1000).toFixed(1) + 'K';
        return value.toFixed(0);
    }

    clearData() {
        this.enhancedOrderbook = new EnhancedOrderbook();
        this.liquidations = [];
        this.klineData = null;

        this.elements.asksContainer.innerHTML = '<div class="loading">Loading asks...</div>';
        this.elements.bidsContainer.innerHTML = '<div class="loading">Loading bids...</div>';
        this.elements.klineContainer.innerHTML = '<div class="loading">Loading chart data...</div>';
        this.elements.liquidationsList.innerHTML = '<div class="loading">Loading liquidations...</div>';

        this.elements.currentPrice.textContent = '-';
        this.elements.priceChange.textContent = '-';
        this.elements.spread.textContent = '-';
        this.elements.volume24h.textContent = '-';
        this.elements.bidVolume.textContent = '-';
        this.elements.askVolume.textContent = '-';
        this.elements.klineStats.textContent = '-';
        this.elements.liquidationStats.textContent = 'Recent: 0';
        this.elements.midPrice.textContent = '-';
        this.elements.spreadValue.textContent = 'Spread: -';
        this.elements.imbalanceText.textContent = '-';
    }

    clearKlineData() {
        this.klineData = null;
        this.elements.klineContainer.innerHTML = '<div class="loading">Loading chart data...</div>';
        this.elements.klineStats.textContent = '-';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, starting Enhanced Bybit Dashboard...');
    try {
        window.dashboard = new BybitDashboard();
        console.log('Enhanced Dashboard created successfully');
    } catch (error) {
        console.error('Failed to create dashboard:', error);
    }
});