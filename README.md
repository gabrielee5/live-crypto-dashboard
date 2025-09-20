# Bybit WebSocket Dashboard

A comprehensive real-time cryptocurrency trading dashboard that connects directly to Bybit's V5 WebSocket API. This application provides live market data visualization including orderbook depth, candlestick charts, and liquidation feeds for any supported trading pair on the Bybit exchange.

## Overview

The dashboard offers a professional-grade interface for monitoring cryptocurrency markets with real-time data streams. Built with Node.js and vanilla JavaScript, it provides a lightweight yet powerful solution for traders and developers who need instant access to market data without the complexity of trading execution.

## Key Features

### Real-time Market Data
- **Live Orderbook**: 50-level depth orderbook displaying bid and ask prices with volume information
- **Candlestick Charts**: Real-time OHLC (Open, High, Low, Close) data with customizable timeframes
- **Liquidation Feed**: Live stream of liquidation events showing position closures and market sentiment
- **Price Statistics**: Current price, 24-hour change percentage, bid-ask spread, and trading volume

### Interactive Controls
- **Dynamic Symbol Switching**: Change between any Bybit USDT perpetual contracts (BTCUSDT, ETHUSDT, SOLUSDT, etc.)
- **Timeframe Selection**: Multiple candlestick intervals from 1-minute scalping to daily analysis
- **Environment Toggle**: Switch between live mainnet data and testnet for development/testing
- **Auto-reconnection**: Robust WebSocket connection management with automatic retry logic

### Technical Capabilities
- **WebSocket Integration**: Direct connection to Bybit V5 public API endpoints
- **Low Latency Updates**: Optimized data processing for minimal delay
- **Responsive Design**: Adaptive interface that works on desktop and mobile devices
- **Memory Management**: Efficient data buffering with automatic cleanup to prevent memory leaks
- **Error Handling**: Comprehensive error recovery and connection status monitoring

## Quick Start

### Prerequisites
- Node.js 16 or higher
- Active internet connection for WebSocket data streams

### Installation

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd live-market-dashboard
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Start the server**:
   ```bash
   npm start
   ```

4. **Access the dashboard**:
   Open your browser and navigate to `http://localhost:3000`

## Dashboard Interface

### Orderbook Panel
The left panel displays a real-time orderbook with 50 levels of market depth:
- **Ask Orders (Red)**: Sell orders arranged from lowest to highest price
- **Bid Orders (Green)**: Buy orders arranged from highest to lowest price
- **Spread Calculation**: Real-time bid-ask spread with percentage
- **Volume Aggregation**: Cumulative volume at each price level

### Candlestick Chart
The bottom section shows live candlestick data:
- **OHLC Information**: Complete price action for each time period
- **Volume Bars**: Trading volume visualization
- **Real-time Updates**: Live candle formation with confirmation status
- **Color Coding**: Green for bullish (close > open) and red for bearish (close < open) candles

### Liquidation Feed
The right panel streams liquidation events:
- **Position Details**: Long vs short liquidations with size classification
- **Value Formatting**: Smart formatting (K, M, B) for large liquidation amounts
- **Timing Information**: Timestamp for each liquidation event
- **Market Impact**: Visual indicators for liquidation size (Small, Medium, Large, Huge)

## Supported Markets

The dashboard supports all Bybit USDT perpetual contracts including:
- **Major Cryptocurrencies**: BTC, ETH, SOL, ADA, DOT, AVAX, MATIC
- **DeFi Tokens**: UNI, LINK, AAVE, COMP, SUSHI, CRV
- **Meme Coins**: DOGE, SHIB, PEPE, FLOKI
- **Emerging Assets**: And hundreds of other supported pairs

## Timeframe Options

Available candlestick intervals:
- **Scalping**: 1m, 3m, 5m for high-frequency analysis
- **Intraday**: 15m, 30m for day trading strategies
- **Swing Trading**: 1h, 4h for medium-term analysis
- **Position Trading**: 1D for long-term trend analysis

## Configuration

### Environment Variables
```bash
PORT=3000                    # Server port (default: 3000)
```

### Default Settings
- Initial symbol: BTCUSDT
- Default timeframe: 5 minutes
- Environment: Mainnet
- Maximum stored liquidations: 100 events
- Maximum stored candles: 100 periods

## Development

### Local Development Setup
```bash
npm install
cp config.example.json config.json  # Create your config file
npm run dev
```

## Configuration

The application uses a JSON configuration file to store user preferences and settings. When you first run the application, it will automatically create a `config.json` file from the default settings.

### Configuration File Setup
1. Copy the example configuration:
   ```bash
   cp config.example.json config.json
   ```

2. Customize your settings in `config.json`:

```json
{
  "appearance": {
    "theme": "dark"                    // UI theme: "dark" or "light"
  },
  "trading": {
    "defaultSymbol": "BTCUSDT",        // Initial trading pair to load
    "defaultInterval": "5",            // Default chart timeframe, format: 1, 3, 5, 15, 60, 240, D, W, M
    "bigTradesFilter": 50000,          // Minimum USD value for big trades alert
    "whaleThreshold": 500000,          // USD threshold for whale trade classification
    "blockTradeThreshold": 1000000,    // USD threshold for block trade classification
    "alarmEnabled": false              // Audio alert for significant events
  },
  "display": {
    "maxTradesHistory": 100            // Maximum number of trades to keep in memory
  },
  "symbols": {
    "favorites": ["BTCUSDT", "ETHUSDT"], // Quick-access favorite trading pairs
    "recent": []                        // Recently viewed symbols (auto-populated)
  },
  "network": {
    "isTestnet": false                 // Use Bybit testnet instead of mainnet
  }
}
```

### Configuration API
The application provides REST endpoints to modify configuration at runtime:

- `GET /api/config` - Get current configuration
- `PUT /api/config/:path` - Update specific setting (e.g., `/api/config/appearance.theme`)
- `POST /api/config` - Update multiple settings
- `POST /api/config/reset` - Reset to default configuration

Settings are automatically saved and persist between application restarts.

### Project Structure
```
├── server.js              # Express server with Socket.io
├── src/
│   ├── websocket-client.js # Bybit WebSocket connection
│   ├── orderbook-manager.js # Orderbook data processing
│   ├── kline-manager.js    # Candlestick data handling
│   └── liquidation-manager.js # Liquidation processing
├── public/
│   ├── index.html         # Frontend interface
│   ├── style.css          # Dashboard styling
│   └── app.js             # Client-side logic
└── package.json           # Dependencies and scripts
```

## API Integration

The application connects to Bybit's V5 WebSocket API using the following endpoints:
- **Mainnet**: `wss://stream.bybit.com/v5/public/linear`
- **Testnet**: `wss://stream-testnet.bybit.com/v5/public/linear`

### Subscribed Topics
- `orderbook.50.{SYMBOL}` - 50-level orderbook updates
- `kline.{INTERVAL}.{SYMBOL}` - Real-time candlestick data
- `allLiquidation.{SYMBOL}` - Complete liquidation events

## Troubleshooting

### Common Issues
1. **Connection Problems**: Verify internet connectivity and Bybit API status
2. **Symbol Errors**: Ensure correct symbol format (e.g., BTCUSDT, not BTC/USDT)
3. **Performance**: Close unnecessary browser tabs and check system resources
4. **Data Delays**: Allow 30-60 seconds for initial data population

## License

MIT License