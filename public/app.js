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
        this.config = null;
        this.currentSymbol = 'BTCUSDT';
        this.currentInterval = '5';
        this.isConnected = false;
        this.enhancedOrderbook = new EnhancedOrderbook();
        this.liquidations = [];
        this.bigTrades = [];
        this.klineData = null;
        this.updateQueue = [];
        this.isUpdating = false;
        this.alarmEnabled = false;
        this.audioContext = null;
        this.initializeAudio();

        this.loadConfig().then(() => {
            this.initializeElements();
            this.initializeSocket();
            this.setupEventListeners();
            this.initializeTheme();
            this.startUpdateLoop();
            this.startPerformanceMonitoring();
            console.log('Enhanced Dashboard initialization complete');
        });
    }

    initializeElements() {
        this.elements = {
            statusIndicator: document.getElementById('statusIndicator'),
            statusText: document.getElementById('statusText'),
            latency: document.getElementById('latency'),
            symbolDisplay: document.getElementById('symbolDisplay'),
            symbolInput: document.getElementById('symbolInput'),
            symbolBtn: document.getElementById('symbolBtn'),
            favoritesSelect: document.getElementById('favoritesSelect'),
            favoriteBtn: document.getElementById('favoriteBtn'),
            intervalSelect: document.getElementById('intervalSelect'),
            alarmToggle: document.getElementById('alarmToggle'),
            themeToggle: document.getElementById('themeToggle'),
            currentPrice: document.getElementById('currentPrice'),
            priceChange: document.getElementById('priceChange'),
            spread: document.getElementById('spread'),
            volume24h: document.getElementById('volume24h'),
            price24hPcnt: document.getElementById('price24hPcnt'),
            openInterestValue: document.getElementById('openInterestValue'),
            fundingRate: document.getElementById('fundingRate'),

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

            // Enhanced chart elements
            klineContainer: document.getElementById('klineContainer'),
            candlestickChart: document.getElementById('candlestickChart'),
            chartCrosshair: document.getElementById('chartCrosshair'),
            chartInfoOverlay: document.getElementById('chartInfoOverlay'),
            chartInfoContent: document.getElementById('chartInfoContent'),
            chartLoading: document.getElementById('chartLoading'),
            klineStats: document.getElementById('klineStats'),

            // Depth chart elements
            depthChart: document.getElementById('depthChart'),
            depthTooltip: document.getElementById('depthTooltip'),

            // Liquidations
            liquidationsList: document.getElementById('liquidationsList'),
            liquidationStats: document.getElementById('liquidationStats'),

            // Big Trades
            bigTradesList: document.getElementById('bigTradesList'),
            bigTradesStats: document.getElementById('bigTradesStats'),
            tradeMinSize: document.getElementById('tradeMinSize')
        };

        // Initialize charts
        this.initializeChart();
        this.initializeDepthChart();
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

        this.socket.on('bigTrade', (trade) => {
            this.queueUpdate(() => this.addBigTrade(trade));
        });

        this.socket.on('bigTrades', (trades) => {
            this.queueUpdate(() => this.updateBigTrades(trades));
        });

        this.socket.on('ticker', (ticker) => {
            this.queueUpdate(() => this.updateTicker(ticker));
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

        this.elements.favoritesSelect.addEventListener('change', (e) => {
            const symbol = e.target.value;
            if (symbol) {
                this.changeSymbol(symbol);
                e.target.value = ''; // Reset selection
            }
        });

        this.elements.favoriteBtn.addEventListener('click', () => {
            this.toggleFavorite(this.currentSymbol);
        });

        this.elements.intervalSelect.addEventListener('change', () => {
            const interval = this.elements.intervalSelect.value;
            if (interval !== this.currentInterval) {
                this.changeInterval(interval);
            }
        });

        this.elements.alarmToggle.addEventListener('change', () => {
            this.toggleAlarm(this.elements.alarmToggle.checked);
            this.updateToggleState(this.elements.alarmToggle.parentElement, this.elements.alarmToggle.checked);
        });

        this.elements.themeToggle.addEventListener('change', () => {
            this.toggleTheme(this.elements.themeToggle.checked);
            this.updateToggleState(this.elements.themeToggle.parentElement, this.elements.themeToggle.checked);
        });

        this.elements.tradeMinSize.addEventListener('change', () => {
            const minValue = parseInt(this.elements.tradeMinSize.value);
            this.changeBigTradesFilter(minValue);
        });

        // Enhanced keyboard shortcuts
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
                case '3':
                    this.elements.intervalSelect.value = '3';
                    this.changeInterval('3');
                    break;
                case '5':
                    this.elements.intervalSelect.value = '5';
                    this.changeInterval('5');
                    break;
                case 'h':
                case 'H':
                    this.elements.intervalSelect.value = '60';
                    this.changeInterval('60');
                    break;
                case 'd':
                case 'D':
                    this.elements.intervalSelect.value = 'D';
                    this.changeInterval('D');
                    break;
                case 's':
                case 'S':
                    e.preventDefault();
                    this.elements.symbolInput.focus();
                    this.elements.symbolInput.select();
                    break;
                case 'Escape':
                    e.preventDefault();
                    document.activeElement.blur();
                    break;
                case 'F11':
                    e.preventDefault();
                    this.toggleFullscreen();
                    break;
            }
        });

        // Add visual feedback for interactions
        this.addVisualFeedback();
    }

    queueUpdate(updateFn) {
        this.updateQueue.push(updateFn);
    }

    startUpdateLoop() {
        const processUpdates = () => {
            if (this.isUpdating || this.updateQueue.length === 0) {
                requestAnimationFrame(processUpdates);
                return;
            }

            this.isUpdating = true;
            const startTime = performance.now();

            while (this.updateQueue.length > 0 && (performance.now() - startTime) < 8) {
                const update = this.updateQueue.shift();
                try {
                    update();
                } catch (error) {
                    console.error('Error during update:', error);
                }
            }

            this.isUpdating = false;
            requestAnimationFrame(processUpdates);
        };

        requestAnimationFrame(processUpdates);
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
        this.updateFavoriteButton();
        this.updateFavoritesDropdown();
    }

    updateFavoritesDropdown() {
        const favorites = this.config?.symbols?.favorites || [];
        const select = this.elements.favoritesSelect;

        // Clear existing options except the first one
        while (select.children.length > 1) {
            select.removeChild(select.lastChild);
        }

        // Add favorite symbols
        favorites.forEach(symbol => {
            const option = document.createElement('option');
            option.value = symbol;
            option.textContent = symbol;
            select.appendChild(option);
        });
    }

    updateFavoriteButton() {
        const favorites = this.config?.symbols?.favorites || [];
        const isFavorite = favorites.includes(this.currentSymbol);
        this.elements.favoriteBtn.classList.toggle('active', isFavorite);
        this.elements.favoriteBtn.title = isFavorite ? 'Remove from favorites' : 'Add to favorites';
    }

    async toggleFavorite(symbol) {
        const favorites = this.config?.symbols?.favorites || [];
        const isFavorite = favorites.includes(symbol);

        let newFavorites;
        if (isFavorite) {
            newFavorites = favorites.filter(s => s !== symbol);
        } else {
            newFavorites = [...favorites, symbol];
        }

        const result = await this.saveConfig('symbols.favorites', newFavorites);
        if (result.success) {
            this.updateFavoriteButton();
            this.updateFavoritesDropdown();
        }
    }

    changeSymbol(symbol) {
        this.socket.emit('changeSymbol', { symbol });
    }

    changeInterval(interval) {
        this.socket.emit('changeInterval', { interval });
    }

    toggleAlarm(enabled) {
        this.alarmEnabled = enabled;
    }

    async loadConfig() {
        try {
            const response = await fetch('/api/config');
            this.config = await response.json();

            // Update default values from config
            this.currentSymbol = this.config.trading?.defaultSymbol || 'BTCUSDT';
            this.currentInterval = this.config.trading?.defaultInterval || '5';
            this.alarmEnabled = this.config.trading?.alarmEnabled || false;

            console.log('Configuration loaded:', this.config);
        } catch (error) {
            console.error('Failed to load config:', error);
            this.config = this.getDefaultConfig();
        }
    }

    getDefaultConfig() {
        return {
            appearance: { theme: 'dark', compactMode: false },
            trading: {
                defaultSymbol: 'BTCUSDT',
                defaultInterval: '5',
                bigTradesFilter: 50000,
                alarmEnabled: false
            },
            symbols: { favorites: [], recent: [] }
        };
    }

    async saveConfig(path, value) {
        try {
            const response = await fetch(`/api/config/${path}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ value })
            });
            const result = await response.json();
            if (result.success) {
                // Update local config
                const keys = path.split('.');
                let current = this.config;
                for (let i = 0; i < keys.length - 1; i++) {
                    if (!current[keys[i]]) current[keys[i]] = {};
                    current = current[keys[i]];
                }
                current[keys[keys.length - 1]] = value;
            }
            return result;
        } catch (error) {
            console.error('Failed to save config:', error);
            return { success: false, error: error.message };
        }
    }

    initializeTheme() {
        const savedTheme = this.config?.appearance?.theme || 'dark';
        const isLightMode = savedTheme === 'light';

        this.elements.themeToggle.checked = isLightMode;
        document.body.classList.toggle('light-theme', isLightMode);
        this.updateToggleState(this.elements.themeToggle.parentElement, isLightMode);
    }

    updateToggleState(toggleElement, isActive) {
        toggleElement.classList.toggle('active', isActive);
    }

    toggleTheme(lightMode) {
        document.body.classList.toggle('light-theme', lightMode);
        const theme = lightMode ? 'light' : 'dark';
        this.saveConfig('appearance.theme', theme);
        // Keep localStorage for immediate theme persistence
        localStorage.setItem('dashboard-theme', theme);
    }

    initializeAudio() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) {
            console.warn('Web Audio API not supported');
        }
    }

    playAlarmSound(type = 'liquidation') {
        if (!this.alarmEnabled || !this.audioContext) return;

        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);

        if (type === 'liquidation') {
            oscillator.frequency.setValueAtTime(800, this.audioContext.currentTime);
            oscillator.frequency.setValueAtTime(400, this.audioContext.currentTime + 0.1);
        } else if (type === 'bigTrade') {
            oscillator.frequency.setValueAtTime(600, this.audioContext.currentTime);
            oscillator.frequency.setValueAtTime(900, this.audioContext.currentTime + 0.1);
        }

        gainNode.gain.setValueAtTime(0.1, this.audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.3);

        oscillator.start(this.audioContext.currentTime);
        oscillator.stop(this.audioContext.currentTime + 0.3);
    }

    changeBigTradesFilter(minValue) {
        this.socket.emit('changeBigTradesFilter', { minValue });
    }

    toggleConnection() {
        // Placeholder for connection toggle
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

        // Render bids (highest to lowest) - Left side
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

        // Render asks (lowest to highest) - Right side
        this.elements.asksContainer.innerHTML = depthData.asks.map(ask => {
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

        // Add click handlers for price levels
        this.addOrderbookClickHandlers();

        // Update depth chart
        this.renderDepthChart(depthData);
    }

    addOrderbookClickHandlers() {
        document.querySelectorAll('.orderbook-row').forEach(row => {
            row.addEventListener('click', () => {
                const price = row.dataset.price;
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

    initializeChart() {
        if (!this.elements.candlestickChart) return;

        this.chartCtx = this.elements.candlestickChart.getContext('2d');
        this.chartData = [];
        this.chartPadding = { top: 20, right: 60, bottom: 60, left: 20 };
        this.crosshairPosition = { x: 0, y: 0 };

        this.resizeChart();
        this.setupChartEvents();

        window.addEventListener('resize', () => this.resizeChart());
    }

    resizeChart() {
        if (!this.elements.candlestickChart || !this.elements.klineContainer) return;

        const container = this.elements.klineContainer;
        const rect = container.getBoundingClientRect();

        this.elements.candlestickChart.width = rect.width;
        this.elements.candlestickChart.height = rect.height;

        this.chartWidth = rect.width;
        this.chartHeight = rect.height;

        if (this.chartData.length > 0) {
            this.renderChart();
        }
    }

    setupChartEvents() {
        this.elements.candlestickChart.addEventListener('mousemove', (e) => {
            const rect = this.elements.candlestickChart.getBoundingClientRect();
            this.crosshairPosition.x = e.clientX - rect.left;
            this.crosshairPosition.y = e.clientY - rect.top;

            this.updateCrosshair();
            this.updateChartInfo(e);
        });

        this.elements.candlestickChart.addEventListener('mouseleave', () => {
            this.elements.chartCrosshair.style.display = 'none';
            this.elements.chartInfoContent.classList.remove('visible');
        });

        this.elements.candlestickChart.addEventListener('mouseenter', () => {
            this.elements.chartCrosshair.style.display = 'block';
        });
    }

    renderKline() {
        if (!this.klineData || !this.klineData.allCandles) return;

        this.chartData = this.klineData.allCandles.slice(-100);
        this.elements.chartLoading.style.display = 'none';
        this.renderChart();

        if (this.klineData.candle) {
            const latest = this.klineData.candle;
            this.elements.priceChange.className = `price-change ${latest.change >= 0 ? 'positive' : 'negative'}`;
            this.elements.priceChange.textContent = `${latest.change >= 0 ? '+' : ''}${latest.changePercent.toFixed(2)}%`;
        }
    }

    renderChart() {
        if (!this.chartCtx || !this.chartData.length) return;

        const ctx = this.chartCtx;
        const data = this.chartData;

        ctx.clearRect(0, 0, this.chartWidth, this.chartHeight);

        const chartArea = {
            x: this.chartPadding.left,
            y: this.chartPadding.top,
            width: this.chartWidth - this.chartPadding.left - this.chartPadding.right,
            height: (this.chartHeight - this.chartPadding.top - this.chartPadding.bottom) * 0.7
        };

        const volumeArea = {
            x: this.chartPadding.left,
            y: chartArea.y + chartArea.height + 10,
            width: chartArea.width,
            height: (this.chartHeight - this.chartPadding.top - this.chartPadding.bottom) * 0.25
        };

        const prices = data.flatMap(d => [d.high, d.low]);
        const volumes = data.map(d => d.volume);

        const minPrice = Math.min(...prices);
        const maxPrice = Math.max(...prices);
        const maxVolume = Math.max(...volumes);

        const priceRange = maxPrice - minPrice;
        const candleWidth = Math.max(2, chartArea.width / data.length - 2);
        const candleSpacing = chartArea.width / data.length;

        this.drawGrid(ctx, chartArea, minPrice, maxPrice);
        this.drawCandlesticks(ctx, data, chartArea, minPrice, priceRange, candleWidth, candleSpacing);
        this.drawVolume(ctx, data, volumeArea, maxVolume, candleWidth, candleSpacing);
        this.drawCurrentPriceLine(ctx, data, chartArea, minPrice, priceRange);
        this.drawPriceScale(ctx, minPrice, maxPrice, chartArea);
    }

    drawGrid(ctx, area, minPrice, maxPrice) {
        const isLightTheme = document.body.classList.contains('light-theme');
        ctx.strokeStyle = isLightTheme ? 'rgba(0, 0, 0, 0.2)' : 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = 1;

        const gridLines = 8;
        const priceStep = (maxPrice - minPrice) / gridLines;

        for (let i = 0; i <= gridLines; i++) {
            const y = area.y + (area.height / gridLines) * i;
            ctx.beginPath();
            ctx.moveTo(area.x, y);
            ctx.lineTo(area.x + area.width, y);
            ctx.stroke();
        }

        const timeGridLines = 6;
        for (let i = 0; i <= timeGridLines; i++) {
            const x = area.x + (area.width / timeGridLines) * i;
            ctx.beginPath();
            ctx.moveTo(x, area.y);
            ctx.lineTo(x, area.y + area.height);
            ctx.stroke();
        }
    }

    drawCandlesticks(ctx, data, area, minPrice, priceRange, candleWidth, candleSpacing) {
        data.forEach((candle, index) => {
            const x = area.x + index * candleSpacing + candleSpacing / 2;

            const openY = area.y + area.height - ((candle.open - minPrice) / priceRange) * area.height;
            const closeY = area.y + area.height - ((candle.close - minPrice) / priceRange) * area.height;
            const highY = area.y + area.height - ((candle.high - minPrice) / priceRange) * area.height;
            const lowY = area.y + area.height - ((candle.low - minPrice) / priceRange) * area.height;

            const isBullish = candle.close >= candle.open;
            const color = isBullish ? '#00D4AA' : '#FF6B6B';

            ctx.strokeStyle = color;
            ctx.lineWidth = 1;

            ctx.beginPath();
            ctx.moveTo(x, highY);
            ctx.lineTo(x, lowY);
            ctx.stroke();

            ctx.fillStyle = isBullish ? color : color;
            const rectY = Math.min(openY, closeY);
            const rectHeight = Math.abs(closeY - openY) || 1;

            ctx.fillRect(x - candleWidth / 2, rectY, candleWidth, rectHeight);
        });
    }

    drawVolume(ctx, data, area, maxVolume, candleWidth, candleSpacing) {
        data.forEach((candle, index) => {
            const x = area.x + index * candleSpacing + candleSpacing / 2;
            const height = (candle.volume / maxVolume) * area.height;
            const y = area.y + area.height - height;

            const isBullish = candle.close >= candle.open;
            ctx.fillStyle = isBullish ? 'rgba(0, 212, 170, 0.5)' : 'rgba(255, 107, 107, 0.5)';
            ctx.fillRect(x - candleWidth / 2, y, candleWidth, height);
        });
    }

    drawCurrentPriceLine(ctx, data, area, minPrice, priceRange) {
        if (!data.length) return;

        const latestCandle = data[data.length - 1];
        const currentPrice = latestCandle.close;

        const y = area.y + area.height - ((currentPrice - minPrice) / priceRange) * area.height;

        ctx.save();
        ctx.strokeStyle = '#F7931A';
        ctx.lineWidth = 2;
        ctx.setLineDash([8, 4]);

        ctx.beginPath();
        ctx.moveTo(area.x, y);
        ctx.lineTo(area.x + area.width, y);
        ctx.stroke();

        ctx.setLineDash([]);

        ctx.fillStyle = '#F7931A';
        ctx.font = '11px JetBrains Mono';
        ctx.textAlign = 'left';
        ctx.fillRect(area.x + area.width + 2, y - 8, 70, 16);
        ctx.fillStyle = '#000';
        ctx.fillText(this.formatPrice(currentPrice), area.x + area.width + 6, y + 3);

        ctx.restore();
    }

    drawPriceScale(ctx, minPrice, maxPrice, area) {
        ctx.fillStyle = '#B0B0B0';
        ctx.font = '11px JetBrains Mono';
        ctx.textAlign = 'left';

        const gridLines = 8;
        const priceStep = (maxPrice - minPrice) / gridLines;

        for (let i = 0; i <= gridLines; i++) {
            const price = minPrice + priceStep * i;
            const y = area.y + area.height - (area.height / gridLines) * i;
            ctx.fillText(this.formatPrice(price), area.x + area.width + 10, y + 4);
        }
    }

    updateCrosshair() {
        if (!this.elements.chartCrosshair) return;

        const crosshair = this.elements.chartCrosshair;
        crosshair.style.left = this.crosshairPosition.x + 'px';
        crosshair.style.top = this.crosshairPosition.y + 'px';
    }

    updateChartInfo(e) {
        if (!this.chartData.length) return;

        const rect = this.elements.candlestickChart.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const chartArea = {
            x: this.chartPadding.left,
            y: this.chartPadding.top,
            width: this.chartWidth - this.chartPadding.left - this.chartPadding.right,
            height: (this.chartHeight - this.chartPadding.top - this.chartPadding.bottom) * 0.7
        };

        if (x >= chartArea.x && x <= chartArea.x + chartArea.width &&
            y >= chartArea.y && y <= chartArea.y + chartArea.height) {

            const candleIndex = Math.floor((x - chartArea.x) / (chartArea.width / this.chartData.length));
            const candle = this.chartData[candleIndex];

            if (candle) {
                const time = new Date(candle.start).toLocaleString();

                this.elements.chartInfoContent.innerHTML = `
                    <span class="info-row">Time: ${time}</span>
                    <span class="info-row">O: ${this.formatPrice(candle.open)}</span>
                    <span class="info-row">H: ${this.formatPrice(candle.high)}</span>
                    <span class="info-row">L: ${this.formatPrice(candle.low)}</span>
                    <span class="info-row">C: ${this.formatPrice(candle.close)}</span>
                    <span class="info-row">Vol: ${this.formatVolume(candle.volume)}</span>
                `;

                this.elements.chartInfoContent.classList.add('visible');
            }
        } else {
            this.elements.chartInfoContent.classList.remove('visible');
        }
    }

    initializeDepthChart() {
        if (!this.elements.depthChart) return;

        this.depthCtx = this.elements.depthChart.getContext('2d');
        this.depthPadding = { top: 10, right: 50, bottom: 20, left: 20 };

        this.resizeDepthChart();
        this.setupDepthChartEvents();

        window.addEventListener('resize', () => this.resizeDepthChart());
    }

    resizeDepthChart() {
        if (!this.elements.depthChart) return;

        const container = this.elements.depthChart.parentElement;
        const rect = container.getBoundingClientRect();

        this.elements.depthChart.width = rect.width;
        this.elements.depthChart.height = rect.height;

        this.depthWidth = rect.width;
        this.depthHeight = rect.height;
    }

    setupDepthChartEvents() {
        this.elements.depthChart.addEventListener('mousemove', (e) => {
            this.updateDepthTooltip(e);
        });

        this.elements.depthChart.addEventListener('mouseleave', () => {
            this.elements.depthTooltip.classList.remove('visible');
        });
    }

    renderDepthChart(depthData) {
        if (!this.depthCtx || !depthData.bids.length || !depthData.asks.length) return;

        const ctx = this.depthCtx;
        ctx.clearRect(0, 0, this.depthWidth, this.depthHeight);

        const chartArea = {
            x: this.depthPadding.left,
            y: this.depthPadding.top,
            width: this.depthWidth - this.depthPadding.left - this.depthPadding.right,
            height: this.depthHeight - this.depthPadding.top - this.depthPadding.bottom
        };

        const allPrices = [...depthData.bids.map(b => b.price), ...depthData.asks.map(a => a.price)];
        const minPrice = Math.min(...allPrices);
        const maxPrice = Math.max(...allPrices);
        const priceRange = maxPrice - minPrice;

        const maxCumulative = Math.max(
            depthData.bids[depthData.bids.length - 1]?.cumulative || 0,
            depthData.asks[depthData.asks.length - 1]?.cumulative || 0
        );

        this.drawDepthGrid(ctx, chartArea);
        this.drawDepthCurves(ctx, depthData, chartArea, minPrice, priceRange, maxCumulative);
        this.drawDepthScale(ctx, chartArea, maxCumulative);
    }

    drawDepthGrid(ctx, area) {
        const isLightTheme = document.body.classList.contains('light-theme');
        ctx.strokeStyle = isLightTheme ? 'rgba(0, 0, 0, 0.15)' : 'rgba(255, 255, 255, 0.05)';
        ctx.lineWidth = 1;

        for (let i = 0; i <= 4; i++) {
            const y = area.y + (area.height / 4) * i;
            ctx.beginPath();
            ctx.moveTo(area.x, y);
            ctx.lineTo(area.x + area.width, y);
            ctx.stroke();
        }
    }

    drawDepthCurves(ctx, depthData, area, minPrice, priceRange, maxCumulative) {
        const spreadInfo = this.enhancedOrderbook.getSpreadInfo();
        if (!spreadInfo) return;

        const midPrice = spreadInfo.midPrice;
        const midX = area.x + ((midPrice - minPrice) / priceRange) * area.width;

        ctx.lineWidth = 2;

        ctx.beginPath();
        ctx.strokeStyle = '#00D4AA';
        ctx.fillStyle = 'rgba(0, 212, 170, 0.1)';

        let firstPoint = true;
        for (const bid of depthData.bids.reverse()) {
            const x = area.x + ((bid.price - minPrice) / priceRange) * area.width;
            const y = area.y + area.height - (bid.cumulative / maxCumulative) * area.height;

            if (firstPoint) {
                ctx.moveTo(x, area.y + area.height);
                ctx.lineTo(x, y);
                firstPoint = false;
            } else {
                ctx.lineTo(x, y);
            }
        }

        ctx.lineTo(midX, area.y + area.height);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.beginPath();
        ctx.strokeStyle = '#FF6B6B';
        ctx.fillStyle = 'rgba(255, 107, 107, 0.1)';

        firstPoint = true;
        for (const ask of depthData.asks) {
            const x = area.x + ((ask.price - minPrice) / priceRange) * area.width;
            const y = area.y + area.height - (ask.cumulative / maxCumulative) * area.height;

            if (firstPoint) {
                ctx.moveTo(midX, area.y + area.height);
                ctx.lineTo(x, y);
                firstPoint = false;
            } else {
                ctx.lineTo(x, y);
            }
        }

        ctx.lineTo(area.x + area.width, area.y + area.height);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.strokeStyle = '#F7931A';
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 2]);
        ctx.beginPath();
        ctx.moveTo(midX, area.y);
        ctx.lineTo(midX, area.y + area.height);
        ctx.stroke();
        ctx.setLineDash([]);
    }

    drawDepthScale(ctx, area, maxCumulative) {
        ctx.fillStyle = '#B0B0B0';
        ctx.font = '9px JetBrains Mono';
        ctx.textAlign = 'left';

        for (let i = 0; i <= 4; i++) {
            const volume = (maxCumulative / 4) * i;
            const y = area.y + area.height - (area.height / 4) * i;
            ctx.fillText(this.formatSize(volume), area.x + area.width + 5, y + 3);
        }
    }

    updateDepthTooltip(e) {
        const rect = this.elements.depthChart.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const chartArea = {
            x: this.depthPadding.left,
            y: this.depthPadding.top,
            width: this.depthWidth - this.depthPadding.left - this.depthPadding.right,
            height: this.depthHeight - this.depthPadding.top - this.depthPadding.bottom
        };

        if (x >= chartArea.x && x <= chartArea.x + chartArea.width &&
            y >= chartArea.y && y <= chartArea.y + chartArea.height) {

            const tooltip = this.elements.depthTooltip;
            tooltip.innerHTML = `Market Depth Chart<br>Cumulative Volume: ${this.formatSize((1 - (y - chartArea.y) / chartArea.height) * 1000)}`;

            tooltip.style.left = Math.min(e.clientX + 10, window.innerWidth - 150) + 'px';
            tooltip.style.top = Math.max(e.clientY - 10, 10) + 'px';
            tooltip.classList.add('visible');
        } else {
            this.elements.depthTooltip.classList.remove('visible');
        }
    }

    updateKlineStats() {
        if (!this.klineData) return;

        const status = this.klineData.isConfirmed ? 'Confirmed' : 'Live';
        this.elements.klineStats.textContent = `${this.klineData.allCandles.length} candles (${status})`;
    }

    updateTicker(ticker) {
        if (!ticker) {
            return;
        }

        // Update 24h price change percentage
        const priceChange = parseFloat(ticker.price24hPcnt) * 100; // Convert decimal to percentage
        this.elements.price24hPcnt.textContent = `${priceChange >= 0 ? '+' : ''}${priceChange.toFixed(2)}%`;
        this.elements.price24hPcnt.className = `stat-value ${priceChange >= 0 ? 'positive' : 'negative'}`;

        // Update 24h volume
        this.elements.volume24h.textContent = this.formatVolume(parseFloat(ticker.volume24h));

        // Update open interest value
        this.elements.openInterestValue.textContent = this.formatValue(parseFloat(ticker.openInterestValue));

        // Update funding rate
        const fundingRate = parseFloat(ticker.fundingRate) * 100;
        this.elements.fundingRate.textContent = `${fundingRate >= 0 ? '+' : ''}${fundingRate.toFixed(4)}%`;
        this.elements.fundingRate.className = `stat-value ${fundingRate >= 0 ? 'positive' : 'negative'}`;
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

        // Trigger alarm for big liquidations (>= $100K)
        if (liquidation.value >= 100000) {
            this.playAlarmSound('liquidation');
        }
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
        this.elements.liquidationsList.classList.add('liquidation-flash');
        setTimeout(() => {
            this.elements.liquidationsList.classList.remove('liquidation-flash');
        }, 500);
    }

    updateBigTrades(trades) {
        this.bigTrades = trades.slice(0, 100);
        this.renderBigTrades();
        this.updateBigTradesStats();
    }

    addBigTrade(trade) {
        this.bigTrades.unshift(trade);
        if (this.bigTrades.length > 100) {
            this.bigTrades.pop();
        }
        this.renderBigTrades();
        this.updateBigTradesStats();
        this.flashBigTrade();

        // Trigger alarm for whale trades (>= $250K)
        if (trade.value >= 250000) {
            this.playAlarmSound('bigTrade');
        }
    }

    renderBigTrades() {
        if (this.bigTrades.length === 0) {
            this.elements.bigTradesList.innerHTML = '<div class="loading">No big trades yet...</div>';
            return;
        }

        this.elements.bigTradesList.innerHTML = this.bigTrades.slice(0, 50).map(trade => {
            const sizeClass = this.getTradeSize(trade.value);
            const specialClass = trade.isBlockTrade ? 'block-trade' : (sizeClass === 'whale' ? 'whale' : '');

            return `
                <div class="big-trade-row ${trade.side.toLowerCase()} ${sizeClass} ${specialClass}">
                    <span>${trade.time}</span>
                    <span>${trade.side}</span>
                    <span>${this.formatSize(trade.size)}</span>
                    <span>${this.formatPrice(trade.price)}</span>
                    <span>$${this.formatValue(trade.value)}</span>
                </div>
            `;
        }).join('');
    }

    updateBigTradesStats() {
        const recent = this.bigTrades.filter(trade =>
            Date.now() - trade.timestamp < 300000
        );
        const whales = recent.filter(t => t.value >= 500000).length;
        const blocks = recent.filter(t => t.isBlockTrade).length;

        let statsText = `Trades: ${this.bigTrades.length}`;
        if (whales > 0) statsText += ` | Whales: ${whales}`;
        if (blocks > 0) statsText += ` | Blocks: ${blocks}`;

        this.elements.bigTradesStats.textContent = statsText;
    }

    getTradeSize(value) {
        if (value >= 1000000) return 'whale';
        if (value >= 500000) return 'large';
        if (value >= 100000) return 'medium';
        return 'small';
    }

    flashBigTrade() {
        this.elements.bigTradesList.classList.add('flash');
        setTimeout(() => {
            this.elements.bigTradesList.classList.remove('flash');
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
        this.bigTrades = [];
        this.klineData = null;
        this.chartData = [];

        this.elements.asksContainer.innerHTML = '<div class="loading">Loading asks...</div>';
        this.elements.bidsContainer.innerHTML = '<div class="loading">Loading bids...</div>';
        this.elements.liquidationsList.innerHTML = '<div class="loading">Loading liquidations...</div>';
        this.elements.bigTradesList.innerHTML = '<div class="loading">Loading trades...</div>';

        if (this.elements.chartLoading) {
            this.elements.chartLoading.style.display = 'flex';
        }

        if (this.chartCtx) {
            this.chartCtx.clearRect(0, 0, this.chartWidth, this.chartHeight);
        }

        this.elements.currentPrice.textContent = '-';
        this.elements.priceChange.textContent = '-';
        this.elements.spread.textContent = '-';
        this.elements.volume24h.textContent = '-';
        this.elements.price24hPcnt.textContent = '-';
        this.elements.openInterestValue.textContent = '-';
        this.elements.fundingRate.textContent = '-';
        this.elements.bidVolume.textContent = '-';
        this.elements.askVolume.textContent = '-';
        this.elements.klineStats.textContent = '-';
        this.elements.liquidationStats.textContent = 'Recent: 0';
        this.elements.bigTradesStats.textContent = 'Trades: 0';
        this.elements.midPrice.textContent = '-';
        this.elements.spreadValue.textContent = 'Spread: -';
        this.elements.imbalanceText.textContent = '-';
    }

    clearKlineData() {
        this.klineData = null;
        this.chartData = [];

        if (this.elements.chartLoading) {
            this.elements.chartLoading.style.display = 'flex';
        }

        if (this.chartCtx) {
            this.chartCtx.clearRect(0, 0, this.chartWidth, this.chartHeight);
        }

        this.elements.klineStats.textContent = '-';
    }

    addVisualFeedback() {
        // Add loading animations and smooth transitions
        const elements = [
            this.elements.symbolBtn,
            this.elements.intervalSelect,
            this.elements.alarmToggle,
            this.elements.themeToggle
        ];

        elements.forEach(element => {
            if (!element) return;

            element.addEventListener('click', () => {
                element.style.transform = 'scale(0.95)';
                setTimeout(() => {
                    element.style.transform = 'scale(1)';
                }, 100);
            });
        });

        // Add connection pulse animation
        this.updateConnectionAnimation();
    }

    updateConnectionAnimation() {
        const indicator = this.elements.statusIndicator;
        if (!indicator) return;

        if (this.isConnected) {
            indicator.style.animation = 'pulse 2s infinite';
        } else {
            indicator.style.animation = 'pulse 1s infinite';
        }
    }

    toggleFullscreen() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(err => {
                console.log('Error attempting to enable fullscreen:', err);
            });
        } else {
            document.exitFullscreen();
        }
    }

    // Enhanced error handling with user feedback
    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;

        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: var(--color-bg-card);
            border: 1px solid ${type === 'error' ? 'var(--color-ask)' : 'var(--color-bid)'};
            padding: 12px 16px;
            border-radius: 6px;
            font-family: var(--font-mono);
            font-size: 12px;
            color: var(--color-text-primary);
            z-index: 1000;
            opacity: 0;
            transform: translateX(100%);
            transition: all 0.3s ease;
        `;

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.style.opacity = '1';
            notification.style.transform = 'translateX(0)';
        }, 10);

        setTimeout(() => {
            notification.style.opacity = '0';
            notification.style.transform = 'translateX(100%)';
            setTimeout(() => {
                document.body.removeChild(notification);
            }, 300);
        }, 3000);
    }

    // Performance monitoring
    startPerformanceMonitoring() {
        let frameCount = 0;
        let lastTime = performance.now();

        const measureFPS = () => {
            frameCount++;
            const currentTime = performance.now();

            if (currentTime - lastTime >= 1000) {
                const fps = Math.round((frameCount * 1000) / (currentTime - lastTime));
                if (fps < 30) {
                    console.warn(`Low FPS detected: ${fps}`);
                }
                frameCount = 0;
                lastTime = currentTime;
            }

            requestAnimationFrame(measureFPS);
        };

        requestAnimationFrame(measureFPS);
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