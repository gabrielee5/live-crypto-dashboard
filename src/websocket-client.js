const WebSocket = require('ws');
const EventEmitter = require('events');

class BybitWebSocketClient extends EventEmitter {
    constructor(isTestnet = false) {
        super();
        this.isTestnet = isTestnet;
        this.baseUrl = isTestnet
            ? 'wss://stream-testnet.bybit.com/v5/public/linear'
            : 'wss://stream.bybit.com/v5/public/linear';

        this.ws = null;
        this.isConnected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 10;
        this.reconnectDelay = 1000;
        this.pingInterval = null;
        this.pongTimeout = null;
        this.subscriptions = new Set();

        this.connect();
    }

    connect() {
        try {
            console.log(`Connecting to Bybit WebSocket: ${this.baseUrl}`);
            this.ws = new WebSocket(this.baseUrl);

            this.ws.on('open', this.onOpen.bind(this));
            this.ws.on('message', this.onMessage.bind(this));
            this.ws.on('close', this.onClose.bind(this));
            this.ws.on('error', this.onError.bind(this));

        } catch (error) {
            console.error('Failed to create WebSocket connection:', error);
            this.scheduleReconnect();
        }
    }

    onOpen() {
        console.log('WebSocket connected to Bybit');
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.emit('connected');

        this.startPingPong();
        this.resubscribe();
    }

    onMessage(data) {
        try {
            const message = JSON.parse(data.toString());

            if (message.op === 'pong' || message.ret_msg === 'pong') {
                this.handlePong();
                return;
            }

            if (message.topic) {
                this.emit('data', message);
            } else if (message.success !== undefined) {
                console.log('Subscription response:', message);
            }

        } catch (error) {
            console.error('Error parsing WebSocket message:', error);
        }
    }

    onClose(code, reason) {
        console.log(`WebSocket closed: ${code} ${reason}`);
        this.isConnected = false;
        this.stopPingPong();
        this.emit('disconnected');

        if (code !== 1000) {
            this.scheduleReconnect();
        }
    }

    onError(error) {
        console.error('WebSocket error:', error);
        this.emit('error', error);
    }

    startPingPong() {
        this.pingInterval = setInterval(() => {
            if (this.isConnected && this.ws.readyState === WebSocket.OPEN) {
                this.ws.send(JSON.stringify({ op: 'ping' }));

                this.pongTimeout = setTimeout(() => {
                    console.log('Pong timeout - reconnecting');
                    this.ws.terminate();
                }, 10000);
            }
        }, 20000);
    }

    stopPingPong() {
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
        }
        if (this.pongTimeout) {
            clearTimeout(this.pongTimeout);
            this.pongTimeout = null;
        }
    }

    handlePong() {
        if (this.pongTimeout) {
            clearTimeout(this.pongTimeout);
            this.pongTimeout = null;
        }
    }

    scheduleReconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.error('Max reconnection attempts reached');
            this.emit('maxReconnectAttemptsReached');
            return;
        }

        const delay = Math.min(this.reconnectDelay * Math.pow(2, this.reconnectAttempts), 30000);
        console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts + 1})`);

        setTimeout(() => {
            this.reconnectAttempts++;
            this.connect();
        }, delay);
    }

    resubscribe() {
        if (this.subscriptions.size > 0) {
            const topics = Array.from(this.subscriptions);
            this.send({
                op: 'subscribe',
                args: topics
            });
        }
    }

    subscribe(topic) {
        if (!this.subscriptions.has(topic)) {
            this.subscriptions.add(topic);

            if (this.isConnected) {
                this.send({
                    op: 'subscribe',
                    args: [topic]
                });
            }
        }
    }

    unsubscribe(topic) {
        if (this.subscriptions.has(topic)) {
            this.subscriptions.delete(topic);

            if (this.isConnected) {
                this.send({
                    op: 'unsubscribe',
                    args: [topic]
                });
            }
        }
    }

    send(data) {
        if (this.isConnected && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(data));
        } else {
            console.warn('Cannot send message: WebSocket not connected');
        }
    }

    close() {
        this.stopPingPong();
        if (this.ws) {
            this.ws.close(1000, 'Manual close');
        }
    }

    getConnectionStatus() {
        return {
            connected: this.isConnected,
            reconnectAttempts: this.reconnectAttempts,
            subscriptions: Array.from(this.subscriptions)
        };
    }
}

module.exports = BybitWebSocketClient;