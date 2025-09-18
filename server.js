const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const BybitWebSocketClient = require('./src/websocket-client');
const OrderbookManager = require('./src/orderbook-manager');
const KlineManager = require('./src/kline-manager');
const LiquidationManager = require('./src/liquidation-manager');

class BybitDashboardServer {
    constructor() {
        this.app = express();
        this.server = http.createServer(this.app);
        this.io = socketIo(this.server, {
            cors: {
                origin: "*",
                methods: ["GET", "POST"]
            }
        });

        this.io.on('connect_error', (error) => {
            console.error('Socket.IO connection error:', error);
        });

        this.wsClient = null;
        this.orderbookManager = new OrderbookManager();
        this.klineManager = new KlineManager();
        this.liquidationManager = new LiquidationManager();

        this.currentSymbol = 'BTCUSDT';
        this.currentInterval = '5';
        this.isTestnet = false;

        this.setupExpress();
        this.setupSocketIO();
        this.setupEventHandlers();
        this.connectToBybit();
    }

    setupExpress() {
        this.app.use(express.static(path.join(__dirname, 'public')));
        this.app.use(express.json());

        this.app.get('/', (req, res) => {
            res.sendFile(path.join(__dirname, 'public', 'index.html'));
        });

        this.app.get('/api/status', (req, res) => {
            res.json({
                connected: this.wsClient ? this.wsClient.isConnected : false,
                symbol: this.currentSymbol,
                interval: this.currentInterval,
                testnet: this.isTestnet,
                subscriptions: this.wsClient ? this.wsClient.getConnectionStatus().subscriptions : []
            });
        });

        this.app.post('/api/symbol', (req, res) => {
            const { symbol } = req.body;
            if (symbol && typeof symbol === 'string') {
                this.changeSymbol(symbol.toUpperCase());
                res.json({ success: true, symbol: this.currentSymbol });
            } else {
                res.status(400).json({ error: 'Invalid symbol' });
            }
        });

        this.app.post('/api/interval', (req, res) => {
            const { interval } = req.body;
            if (interval && typeof interval === 'string') {
                this.changeInterval(interval);
                res.json({ success: true, interval: this.currentInterval });
            } else {
                res.status(400).json({ error: 'Invalid interval' });
            }
        });

        this.app.post('/api/testnet', (req, res) => {
            const { testnet } = req.body;
            if (typeof testnet === 'boolean') {
                this.toggleTestnet(testnet);
                res.json({ success: true, testnet: this.isTestnet });
            } else {
                res.status(400).json({ error: 'Invalid testnet flag' });
            }
        });
    }

    setupSocketIO() {
        console.log('Setting up Socket.IO server...');

        this.io.on('connection', (socket) => {
            console.log('Client connected:', socket.id);

            socket.emit('status', {
                connected: this.wsClient ? this.wsClient.isConnected : false,
                symbol: this.currentSymbol,
                interval: this.currentInterval,
                testnet: this.isTestnet
            });

            socket.emit('orderbook', this.orderbookManager.getOrderbook(this.currentSymbol));
            socket.emit('kline', this.klineManager.getKlineData(this.currentSymbol, this.currentInterval));
            socket.emit('liquidations', this.liquidationManager.getLiquidations(this.currentSymbol));

            socket.on('changeSymbol', (data) => {
                if (data && data.symbol) {
                    this.changeSymbol(data.symbol.toUpperCase());
                }
            });

            socket.on('changeInterval', (data) => {
                if (data && data.interval) {
                    this.changeInterval(data.interval);
                }
            });

            socket.on('toggleTestnet', (data) => {
                if (data && typeof data.testnet === 'boolean') {
                    this.toggleTestnet(data.testnet);
                }
            });

            socket.on('disconnect', () => {
                console.log('Client disconnected:', socket.id);
            });
        });
    }

    setupEventHandlers() {
        this.orderbookManager.on('orderbookUpdate', (orderbook) => {
            if (orderbook.symbol === this.currentSymbol) {
                this.io.emit('orderbook', orderbook);
            }
        });

        this.klineManager.on('klineUpdate', (data) => {
            if (data.symbol === this.currentSymbol && data.interval === this.currentInterval) {
                this.io.emit('kline', data);
            }
        });

        this.liquidationManager.on('liquidation', (liquidation) => {
            if (liquidation.symbol === this.currentSymbol) {
                this.io.emit('liquidation', liquidation);
                this.io.emit('liquidations', this.liquidationManager.getLiquidations(this.currentSymbol));
            }
        });
    }

    connectToBybit() {
        if (this.wsClient) {
            this.wsClient.close();
        }

        this.wsClient = new BybitWebSocketClient(this.isTestnet);

        this.wsClient.on('connected', () => {
            console.log('Connected to Bybit WebSocket');
            this.io.emit('status', { connected: true });
            this.subscribeToData();
        });

        this.wsClient.on('disconnected', () => {
            console.log('Disconnected from Bybit WebSocket');
            this.io.emit('status', { connected: false });
        });

        this.wsClient.on('error', (error) => {
            console.error('WebSocket error:', error);
            this.io.emit('error', { message: error.message, timestamp: Date.now() });
        });

        this.wsClient.on('maxReconnectAttemptsReached', () => {
            console.error('Max reconnection attempts reached - connection permanently failed');
            this.io.emit('error', {
                message: 'Connection to Bybit failed permanently. Please refresh the page.',
                type: 'connection_failed',
                timestamp: Date.now()
            });
        });

        this.wsClient.on('data', (message) => {
            this.orderbookManager.processMessage(message);
            this.klineManager.processMessage(message);
            this.liquidationManager.processMessage(message);
        });
    }

    subscribeToData() {
        if (!this.wsClient || !this.wsClient.isConnected) return;

        this.wsClient.subscribe(`orderbook.50.${this.currentSymbol}`);
        this.wsClient.subscribe(`kline.${this.currentInterval}.${this.currentSymbol}`);
        this.wsClient.subscribe(`allLiquidation.${this.currentSymbol}`);

        console.log(`Subscribed to data for ${this.currentSymbol} with ${this.currentInterval} interval`);
    }

    unsubscribeFromData(symbol = null, interval = null) {
        if (!this.wsClient || !this.wsClient.isConnected) return;

        const targetSymbol = symbol || this.currentSymbol;
        const targetInterval = interval || this.currentInterval;

        this.wsClient.unsubscribe(`orderbook.50.${targetSymbol}`);
        this.wsClient.unsubscribe(`kline.${targetInterval}.${targetSymbol}`);
        this.wsClient.unsubscribe(`allLiquidation.${targetSymbol}`);
    }

    changeSymbol(newSymbol) {
        if (newSymbol === this.currentSymbol) return;

        if (!this.isValidSymbol(newSymbol)) {
            console.warn(`Invalid symbol: ${newSymbol}`);
            this.io.emit('error', {
                message: `Invalid symbol: ${newSymbol}. Please use format like BTCUSDT, ETHUSDT`,
                type: 'invalid_symbol',
                timestamp: Date.now()
            });
            return;
        }

        console.log(`Changing symbol from ${this.currentSymbol} to ${newSymbol}`);

        this.unsubscribeFromData();

        this.currentSymbol = newSymbol;

        this.orderbookManager.clear(this.currentSymbol);
        this.klineManager.clear(this.currentSymbol);
        this.liquidationManager.clear(this.currentSymbol);

        this.subscribeToData();

        this.io.emit('symbolChanged', { symbol: this.currentSymbol });
        this.io.emit('status', {
            connected: this.wsClient ? this.wsClient.isConnected : false,
            symbol: this.currentSymbol,
            interval: this.currentInterval,
            testnet: this.isTestnet
        });
    }

    isValidSymbol(symbol) {
        if (!symbol || typeof symbol !== 'string') return false;
        return /^[A-Z0-9]{3,}USDT?$|^[A-Z0-9]{3,}USDC$|^[A-Z0-9]{3,}USD$/.test(symbol);
    }

    changeInterval(newInterval) {
        if (newInterval === this.currentInterval) return;

        console.log(`Changing interval from ${this.currentInterval} to ${newInterval}`);

        if (this.wsClient && this.wsClient.isConnected) {
            this.wsClient.unsubscribe(`kline.${this.currentInterval}.${this.currentSymbol}`);
        }

        this.currentInterval = newInterval;
        this.klineManager.clear(this.currentSymbol, this.currentInterval);

        if (this.wsClient && this.wsClient.isConnected) {
            this.wsClient.subscribe(`kline.${this.currentInterval}.${this.currentSymbol}`);
        }

        this.io.emit('intervalChanged', { interval: this.currentInterval });
        this.io.emit('status', {
            connected: this.wsClient ? this.wsClient.isConnected : false,
            symbol: this.currentSymbol,
            interval: this.currentInterval,
            testnet: this.isTestnet
        });
    }

    toggleTestnet(testnet) {
        if (testnet === this.isTestnet) return;

        console.log(`Switching to ${testnet ? 'testnet' : 'mainnet'}`);

        this.isTestnet = testnet;

        this.orderbookManager.clear();
        this.klineManager.clear();
        this.liquidationManager.clear();

        this.connectToBybit();

        this.io.emit('testnetChanged', { testnet: this.isTestnet });
    }

    start(port = 3000) {
        this.server.listen(port, () => {
            console.log(`Bybit Dashboard server running on http://localhost:${port}`);
            console.log(`Initial symbol: ${this.currentSymbol}`);
            console.log(`Initial interval: ${this.currentInterval}`);
            console.log(`Mode: ${this.isTestnet ? 'Testnet' : 'Mainnet'}`);
        });
    }

    stop() {
        if (this.wsClient) {
            this.wsClient.close();
        }
        this.server.close();
    }
}

const server = new BybitDashboardServer();
server.start(process.env.PORT || 3000);

process.on('SIGINT', () => {
    console.log('\nShutting down gracefully...');
    server.stop();
    process.exit(0);
});

module.exports = BybitDashboardServer;