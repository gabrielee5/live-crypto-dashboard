class BybitDashboard {
    constructor() {
        console.log('Initializing Bybit Dashboard...');
        this.socket = null;
        this.currentSymbol = 'BTCUSDT';
        this.currentInterval = '5';
        this.isConnected = false;
        this.orderbook = null;
        this.liquidations = [];
        this.klineData = null;

        this.initializeElements();
        this.initializeSocket();
        this.setupEventListeners();
        console.log('Dashboard initialization complete');
    }

    initializeElements() {
        this.elements = {
            statusIndicator: document.getElementById('statusIndicator'),
            statusText: document.getElementById('statusText'),
            symbolInput: document.getElementById('symbolInput'),
            symbolBtn: document.getElementById('symbolBtn'),
            intervalSelect: document.getElementById('intervalSelect'),
            testnetToggle: document.getElementById('testnetToggle'),
            currentPrice: document.getElementById('currentPrice'),
            priceChange: document.getElementById('priceChange'),
            spread: document.getElementById('spread'),
            volume24h: document.getElementById('volume24h'),
            orderbookStats: document.getElementById('orderbookStats'),
            asksContainer: document.getElementById('asksContainer'),
            bidsContainer: document.getElementById('bidsContainer'),
            spreadInfo: document.getElementById('spreadInfo'),
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
            this.updateOrderbook(data);
        });

        this.socket.on('kline', (data) => {
            this.updateKline(data);
        });

        this.socket.on('liquidation', (liquidation) => {
            this.addLiquidation(liquidation);
        });

        this.socket.on('liquidations', (liquidations) => {
            this.updateLiquidations(liquidations);
        });

        this.socket.on('symbolChanged', (data) => {
            this.currentSymbol = data.symbol;
            this.elements.symbolInput.value = data.symbol;
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
        document.getElementById('symbolBtn').addEventListener('click', () => {
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
    }

    updateConnectionStatus(connected) {
        this.isConnected = connected;
        this.elements.statusIndicator.className = `status-indicator ${connected ? 'connected' : 'disconnected'}`;
        this.elements.statusText.textContent = connected ? 'Connected' : 'Disconnected';
    }

    updateControls() {
        this.elements.symbolInput.value = this.currentSymbol;
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

    updateOrderbook(orderbook) {
        if (!orderbook) return;

        this.orderbook = orderbook;
        this.renderOrderbook();
        this.updateOrderbookStats();
        this.updateSpreadInfo();
    }

    renderOrderbook() {
        if (!this.orderbook) return;

        const { bids, asks } = this.orderbook;

        this.elements.asksContainer.innerHTML = asks.slice(0, 20).reverse().map(ask => `
            <div class="orderbook-row ask">
                <span>${ask.price.toFixed(2)}</span>
                <span>${ask.size.toFixed(4)}</span>
                <span>${ask.total.toFixed(4)}</span>
            </div>
        `).join('');

        this.elements.bidsContainer.innerHTML = bids.slice(0, 20).map(bid => `
            <div class="orderbook-row bid">
                <span>${bid.price.toFixed(2)}</span>
                <span>${bid.size.toFixed(4)}</span>
                <span>${bid.total.toFixed(4)}</span>
            </div>
        `).join('');

        if (bids.length > 0 && asks.length > 0) {
            this.elements.currentPrice.textContent = `$${((bids[0].price + asks[0].price) / 2).toFixed(2)}`;
        }
    }

    updateOrderbookStats() {
        if (!this.orderbook) return;

        this.elements.orderbookStats.textContent =
            `${this.orderbook.bidCount} bids, ${this.orderbook.askCount} asks`;
    }

    updateSpreadInfo() {
        if (!this.orderbook || !this.orderbook.spread) return;

        this.elements.spread.textContent = `$${this.orderbook.spread.toFixed(2)} (${this.orderbook.spreadPercent.toFixed(3)}%)`;
        this.elements.spreadInfo.innerHTML = `
            <span>Spread: $${this.orderbook.spread.toFixed(2)} (${this.orderbook.spreadPercent.toFixed(3)}%)</span>
        `;
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
                            <td>${candle.open.toFixed(2)}</td>
                            <td>${candle.high.toFixed(2)}</td>
                            <td>${candle.low.toFixed(2)}</td>
                            <td>${candle.close.toFixed(2)}</td>
                            <td>${candle.volume.toFixed(2)}</td>
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
            this.elements.priceChange.className = `stat-value ${latest.change >= 0 ? 'positive' : 'negative'}`;
            this.elements.priceChange.textContent =
                `${latest.change >= 0 ? '+' : ''}${latest.changePercent.toFixed(2)}%`;
        }
    }

    updateKlineStats() {
        if (!this.klineData) return;

        const status = this.klineData.isConfirmed ? 'Confirmed' : 'Updating';
        this.elements.klineStats.textContent =
            `${this.klineData.allCandles.length} candles (${status})`;
    }

    updateLiquidations(liquidations) {
        this.liquidations = liquidations.slice(0, 50);
        this.renderLiquidations();
        this.updateLiquidationStats();
    }

    addLiquidation(liquidation) {
        this.liquidations.unshift(liquidation);
        if (this.liquidations.length > 50) {
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

        this.elements.liquidationsList.innerHTML = this.liquidations.map(liq => {
            const sizeClass = this.getSizeClass(liq.value);
            return `
                <div class="liquidation-row ${liq.side.toLowerCase()} ${sizeClass}">
                    <span>${liq.time}</span>
                    <span>${liq.side}</span>
                    <span>${liq.volume.toFixed(3)}</span>
                    <span>${liq.price.toFixed(2)}</span>
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

    formatValue(value) {
        if (value >= 1000000) return (value / 1000000).toFixed(1) + 'M';
        if (value >= 1000) return (value / 1000).toFixed(1) + 'K';
        return value.toFixed(0);
    }

    flashLiquidation() {
        this.elements.liquidationsList.classList.add('flash');
        setTimeout(() => {
            this.elements.liquidationsList.classList.remove('flash');
        }, 500);
    }

    clearData() {
        this.orderbook = null;
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
        this.elements.orderbookStats.textContent = '-';
        this.elements.klineStats.textContent = '-';
        this.elements.liquidationStats.textContent = 'Recent: 0';
        this.elements.spreadInfo.innerHTML = '<span>Spread: -</span>';
    }

    clearKlineData() {
        this.klineData = null;
        this.elements.klineContainer.innerHTML = '<div class="loading">Loading chart data...</div>';
        this.elements.klineStats.textContent = '-';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, starting Bybit Dashboard...');
    try {
        window.dashboard = new BybitDashboard();
        console.log('Dashboard created successfully');
    } catch (error) {
        console.error('Failed to create dashboard:', error);
    }
});