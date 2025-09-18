# Bybit V5 WebSocket Dashboard

A real-time cryptocurrency trading dashboard that connects to Bybit's V5 WebSocket API to display live orderbook data, candlestick charts, and liquidations for any trading pair.

![Dashboard Preview](https://img.shields.io/badge/status-live-brightgreen) ![Node.js](https://img.shields.io/badge/node.js-v16+-green) ![License](https://img.shields.io/badge/license-MIT-blue)

## Features

### 📊 Real-time Data Streams
- **Live Orderbook**: 50-level depth with bid/ask spread visualization
- **Candlestick Data**: Real-time OHLC data with multiple timeframes (1m, 3m, 5m, 15m, 30m, 1h, 4h, 1D)
- **Liquidations Feed**: Real-time liquidation events with size classification
- **Price Statistics**: Current price, 24h change, spread, and volume

### 🔧 Interactive Controls
- **Symbol Switching**: Change trading pairs dynamically (BTCUSDT, ETHUSDT, etc.)
- **Timeframe Selection**: Switch between different candlestick intervals
- **Environment Toggle**: Switch between mainnet and testnet
- **Auto-reconnection**: Robust WebSocket connection management

### 💻 Technical Features
- **WebSocket Integration**: Direct connection to Bybit V5 API
- **Real-time Updates**: Live data with minimal latency
- **Responsive Design**: Works on desktop and mobile devices
- **Error Handling**: Comprehensive error management and recovery
- **Memory Management**: Efficient data buffering and cleanup

## Quick Start

### Prerequisites
- Node.js 16+ installed
- Internet connection for WebSocket access

### Installation

1. **Clone or download the project**:
   ```bash
   git clone <repository-url>
   cd live-market-data
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Start the server**:
   ```bash
   npm start
   ```

4. **Open the dashboard**:
   ```
   http://localhost:3000
   ```

That's it! The dashboard will automatically connect to Bybit's WebSocket API and start displaying live data.

## Usage Guide

### Basic Operations

1. **View Live Data**: The dashboard automatically loads BTCUSDT data on startup
2. **Change Symbol**: Enter a trading pair (e.g., ETHUSDT, SOLUSDT) and click "Change"
3. **Switch Timeframe**: Use the interval dropdown to change candlestick timeframes
4. **Toggle Testnet**: Enable testnet mode for testing with simulated data

### Dashboard Sections

#### 📈 Orderbook (Left Panel - Top)
- **Asks (Red)**: Sell orders sorted by price (ascending)
- **Bids (Green)**: Buy orders sorted by price (descending)
- **Spread**: Price difference between best bid and ask
- **Columns**: Price, Size, Total Volume

#### 📊 Price Chart (Left Panel - Bottom)
- **OHLC Data**: Open, High, Low, Close, Volume for each candle
- **Real-time Updates**: Live updating candlesticks
- **Color Coding**: Green for bullish, Red for bearish candles
- **Status Indicators**: Shows if candle is confirmed or still updating

#### 💥 Liquidations (Right Panel)
- **Recent Events**: Latest liquidation transactions
- **Side Classification**: Long (red) vs Short (green) liquidations
- **Size Categories**: Small, Medium, Large, Huge liquidations
- **Value Display**: Formatted liquidation amounts (K, M notation)

### Supported Symbols

The dashboard supports Bybit's USDT perpetual contracts:
- Major pairs: BTCUSDT, ETHUSDT, SOLUSDT, ADAUSDT, DOTUSDT
- DeFi tokens: UNIUSDT, LINKUSDT, AAVEUSDT, COMPUSDT
- Meme coins: DOGEUSDT, SHIBUSDT, PEPEUSDT
- And many more...

### Timeframe Options

- **1m, 3m, 5m**: Short-term scalping timeframes
- **15m, 30m**: Intraday trading timeframes
- **1h, 4h**: Swing trading timeframes
- **1D**: Daily analysis timeframe

## Project Structure

```
bybit-dashboard/
├── package.json              # Dependencies and scripts
├── server.js                 # Main server with Socket.io
├── src/
│   ├── websocket-client.js   # Bybit WebSocket connection manager
│   ├── orderbook-manager.js  # Orderbook data processing
│   ├── kline-manager.js      # Candlestick data handling
│   └── liquidation-manager.js # Liquidation data processing
├── public/
│   ├── index.html           # Frontend interface
│   ├── style.css            # Dashboard styling
│   └── app.js               # Frontend JavaScript logic
└── README.md                # This file
```

## API Specifications

### Bybit V5 WebSocket Topics

The dashboard subscribes to the following Bybit V5 public WebSocket topics:

1. **Orderbook**: `orderbook.50.{SYMBOL}`
   - 50-level depth orderbook
   - Snapshot and delta updates
   - ~20ms push frequency

2. **Kline/Candlestick**: `kline.{INTERVAL}.{SYMBOL}`
   - Real-time OHLC data
   - 1-60s push frequency
   - Confirmed vs updating candle status

3. **All Liquidations**: `allLiquidation.{SYMBOL}`
   - Complete liquidation events
   - 500ms push frequency
   - Long/Short position liquidations

### WebSocket Endpoints

- **Mainnet**: `wss://stream.bybit.com/v5/public/linear`
- **Testnet**: `wss://stream-testnet.bybit.com/v5/public/linear`

## Configuration

### Environment Variables

You can customize the server behavior using environment variables:

```bash
PORT=3000                    # Server port (default: 3000)
```

### Default Settings

- **Symbol**: BTCUSDT
- **Interval**: 5 minutes
- **Environment**: Mainnet
- **Max Liquidations**: 100 events
- **Max Candles**: 100 candles
- **Orderbook Depth**: 50 levels

## Troubleshooting

### Common Issues

1. **Connection Failed**
   - Check internet connection
   - Verify Bybit API accessibility
   - Try switching to testnet mode

2. **No Data Displaying**
   - Wait 30-60 seconds for initial data
   - Check browser console for errors
   - Refresh the page

3. **Symbol Not Working**
   - Ensure symbol format is correct (e.g., BTCUSDT)
   - Verify symbol exists on Bybit
   - Try popular symbols like BTCUSDT, ETHUSDT

4. **Performance Issues**
   - Close other browser tabs
   - Check system resources
   - Reduce update frequency if needed

### Debug Mode

Check the browser console (F12) and server logs for detailed error messages and connection status.

## Development

### Local Development

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Start in development mode**:
   ```bash
   npm run dev
   ```

3. **Access the dashboard**:
   ```
   http://localhost:3000
   ```

### Code Structure

- **Backend**: Node.js with Express and Socket.io
- **Frontend**: Vanilla JavaScript with WebSocket client
- **Data Flow**: Bybit WebSocket → Server → Socket.io → Frontend
- **Styling**: CSS Grid and Flexbox for responsive design

### Adding New Features

1. **New Data Streams**: Extend managers in `/src/` folder
2. **UI Components**: Modify `/public/index.html` and `/public/style.css`
3. **API Endpoints**: Add routes in `server.js`
4. **Frontend Logic**: Update `/public/app.js`

## Performance Considerations

- **Memory Usage**: Data buffers are limited to prevent memory leaks
- **Update Frequency**: Optimized for real-time updates without overwhelming the browser
- **Connection Management**: Automatic reconnection with exponential backoff
- **Data Validation**: Input validation for symbols and intervals

## Security Notes

- No API keys required (public data only)
- No user authentication or data storage
- Client-side validation for user inputs
- Safe handling of WebSocket connections

## License

MIT License - see LICENSE file for details.

## Support

For issues, questions, or contributions:

1. Check the [troubleshooting section](#troubleshooting)
2. Review the [Bybit API documentation](https://bybit-exchange.github.io/docs/v5/websocket/public/orderbook)
3. Create an issue with detailed error information

## Changelog

### v1.0.0 (2024)
- Initial release with full Bybit V5 WebSocket integration
- Real-time orderbook, klines, and liquidations
- Responsive web interface
- Symbol and timeframe switching
- Testnet support
- Error handling and reconnection logic

---

**Built with ❤️ for the crypto trading community**