// Signal Horse - Main JavaScript

// Global state
let selectedMode = null;
let selectedExchange = null;
let selectedOS = null;

// ==================== Mode Selection ====================

function selectMode(mode) {
    selectedMode = mode;
    
    // Update UI
    function buildApiDocsContent({ baseUrl, mode, exchange = 'okx', encToken = null, credentialsStr = null }) {
        const directCredentials = buildDirectCredentialsSnippet(exchange, credentialsStr);
        const onlineToken = encToken || 'YOUR_ENCRYPTED_TOKEN';
        const localReadQuery = buildDirectQueryString(exchange);
        const demoReadQuery = `${localReadQuery}&testnet=true`;
        const title = mode === 'online'
            ? '# Signal Horse API Documentation (Online Mode)'
            : '# Signal Horse API Documentation (Local Mode)';
        const authSummary = mode === 'online'
            ? '# Preferred auth in these examples: enc token'
            : '# Preferred auth in these examples: direct api_key, secret_key, and optional passphrase';
        const positionsExample = mode === 'online'
            ? `curl -X GET "${baseUrl}/positions?exchange=${exchange}&enc=${onlineToken}"`
            : `curl -X GET "${baseUrl}/positions?${localReadQuery}"`;
        const historyExample = mode === 'online'
            ? `curl -X GET "${baseUrl}/orders-history?exchange=${exchange}&enc=${onlineToken}&asset_type=swap&limit=100"`
            : `curl -X GET "${baseUrl}/orders-history?${localReadQuery}&asset_type=swap&limit=100"`;
        const directCredentialsLines = directCredentials
            .slice(1, -1)
            .replace(/, /g, ',\n      ');
        const localOrderAuthBlock = `"api_key": "YOUR_API_KEY",
        "secret_key": "YOUR_SECRET_KEY",${exchange === 'okx' || exchange === 'bitget' ? '\n        "passphrase": "YOUR_PASSPHRASE",' : ''}
        "testnet": false`;
        const localCloseAllAuthBlock = `"api_key": "YOUR_API_KEY",
        "secret_key": "YOUR_SECRET_KEY",${exchange === 'okx' || exchange === 'bitget' ? '\n        "passphrase": "YOUR_PASSPHRASE",' : ''}
        "testnet": false`;
        const orderAuthBlock = mode === 'online'
            ? `"enc": "${onlineToken}"`
            : localOrderAuthBlock;
        const closeAllAuthBlock = mode === 'online'
            ? `"enc": "${onlineToken}"`
            : localCloseAllAuthBlock;

        return `${title}
# Base URL: ${baseUrl}
# Exchange: ${exchange.toUpperCase()}
${authSummary}

================================================================================
## Quick Start
================================================================================

1. Call GET /health to confirm the service is online.
2. Call GET /positions or GET /orders-history to validate credentials and exchange access.
3. Set testnet=true when you want to target a supported demo or testnet environment.
4. Omit testnet or set it to false for live trading.

Important notes:
- Local mode uses direct api_key, secret_key, and passphrase fields.
- testnet=true is supported for all five exchanges: OKX, Binance, Bybit, Bitget, and Gate.
- Demo or testnet mode often requires exchange-specific demo API keys.

================================================================================
## Endpoint Summary
================================================================================

| Method | Endpoint         | Purpose |
|--------|------------------|---------|
| GET    | /                | Health alias for /health |
| GET    | /health          | Service readiness check |
| GET    | /positions       | Balances, holdings, futures positions |
| GET    | /orders-history  | Filled order history |
| POST   | /place-order     | Place a market or limit order |
| POST   | /cancel-order    | Cancel an open order by order_id |
| POST   | /close-all       | Close positions or liquidate holdings |
| POST   | /set-tpsl        | Place TP/SL conditional orders |
| POST   | /cancel-tpsl     | Cancel TP/SL orders by order_id |

================================================================================
## GET /positions
================================================================================

### Request Example:
${positionsExample}

### Demo/Testnet Example:
curl -X GET "${baseUrl}/positions?${demoReadQuery}"

### Query Parameters:
| Field      | Type   | Required | Description |
|------------|--------|----------|-------------|
| exchange   | string | Yes      | okx, binance, bitget, gate, bybit |
| enc        | string | Cond.    | Encrypted online credentials |
| api_key    | string | Cond.    | Direct local API key |
| secret_key | string | Cond.    | Direct local API secret |
| passphrase | string | Cond.    | Required for OKX / Bitget direct mode |
| testnet    | bool   | No       | Set true to read a supported demo/testnet account |

================================================================================
## GET /orders-history
================================================================================

### Request Example:
${historyExample}

### Demo/Testnet Example:
curl -X GET "${baseUrl}/orders-history?${demoReadQuery}&asset_type=swap&symbol=BTCUSDT&limit=50"

### Query Parameters:
| Field      | Type   | Required | Description |
|------------|--------|----------|-------------|
| exchange   | string | Yes      | okx, binance, bitget, gate, bybit |
| enc        | string | Cond.    | Encrypted online credentials |
| api_key    | string | Cond.    | Direct local API key |
| secret_key | string | Cond.    | Direct local API secret |
| passphrase | string | Cond.    | Required for OKX / Bitget direct mode |
| testnet    | bool   | No       | Set true to read a supported demo/testnet account |
| asset_type | string | No       | spot or swap |
| symbol     | string | No       | Symbol filter, e.g. BTCUSDT |
| limit      | number | No       | Max results, default 100 |

================================================================================
## POST /place-order
================================================================================

### Market Order Example:
curl -X POST "${baseUrl}/place-order" \\
  -H "Content-Type: application/json" \\
  -d '{
    "symbol": "BTCUSDT",
    "exchange": "${exchange}",
    "asset_type": "swap",
    "side": "buy",
    "quantity": 0.1,
    "leverage": 10,
    "margin_mode": "cross",
    "position_side": "long",
    "action": "open",
    "auto_reverse": 1,
    ${orderAuthBlock}
  }'

### Limit Order Example:
curl -X POST "${baseUrl}/place-order" \\
  -H "Content-Type: application/json" \\
  -d '{
    "symbol": "BTCUSDT",
    "exchange": "${exchange}",
    "asset_type": "swap",
    "side": "buy",
    "quantity": 0.1,
    "order_type": "limit",
    "price": 50000.0,
    "position_side": "long",
    "action": "open",
    ${orderAuthBlock}
  }'

### Body Fields:
| Field         | Type    | Required | Description |
|---------------|---------|----------|-------------|
| symbol        | string  | Yes      | BTCUSDT or BTC/USDT input accepted |
| exchange      | string  | Yes      | okx, binance, bitget, gate, bybit |
| asset_type    | string  | Yes      | spot or swap |
| side          | string  | Yes      | buy or sell |
| quantity      | number  | Yes      | Must be greater than zero |
| order_type    | string  | No       | market (default) or limit |
| price         | number  | Cond.    | Required when order_type=limit; must match exchange tick size |
| leverage      | number  | No       | Swap only, default 1 |
| margin_mode   | string  | No       | cross or isolated |
| position_side | string  | No       | long, short, or omit in one-way mode |
| action        | string  | No       | open or close |
| auto_reverse  | number  | No       | 1 closes opposite swap side before opening |
| enc           | string  | Cond.    | Online encrypted credentials |
| api_key       | string  | Cond.    | Direct local API key |
| secret_key    | string  | Cond.    | Direct local API secret |
| passphrase    | string  | Cond.    | Required for OKX / Bitget direct mode |
| testnet       | boolean | No       | Route the request to a supported demo/testnet environment when true |

Note: /order is accepted as a legacy alias for /place-order.

================================================================================
## POST /cancel-order
================================================================================

Cancel an open (non-TP/SL) order using the order_id from /place-order.

### Request Example:
curl -X POST "${baseUrl}/cancel-order" \\
  -H "Content-Type: application/json" \\
  -d '{
    "exchange": "${exchange}",
    "symbol": "BTCUSDT",
    "asset_type": "swap",
    "order_id": "ORDER_ID_FROM_PLACE_ORDER",
    ${orderAuthBlock}
  }'

### Body Fields:
| Field      | Type    | Required | Description |
|------------|---------|----------|-------------|
| exchange   | string  | Yes      | okx, binance, bitget, gate, bybit |
| symbol     | string  | Yes      | Trading pair |
| asset_type | string  | Yes      | spot or swap — must match original order |
| order_id   | string  | Yes      | The order_id returned by /place-order |
| enc        | string  | Cond.    | Online encrypted credentials |
| api_key    | string  | Cond.    | Direct local API key |
| secret_key | string  | Cond.    | Direct local API secret |
| passphrase | string  | Cond.    | Required for OKX / Bitget direct mode |
| testnet    | boolean | No       | Must match the environment of the original order |

================================================================================
## POST /cancel-tpsl
================================================================================

Cancel active TP/SL orders. For swap, passes both TP and SL IDs to clear them from the position.

### Request Example:
curl -X POST "${baseUrl}/cancel-tpsl" \\
  -H "Content-Type: application/json" \\
  -d '{
    "exchange": "${exchange}",
    "symbol": "BTCUSDT",
    "asset_type": "swap",
    "tp_order_id": "TP_ORDER_ID",
    "sl_order_id": "SL_ORDER_ID",
    ${orderAuthBlock}
  }'

### Body Fields:
| Field         | Type    | Required | Description |
|---------------|---------|----------|-------------|
| exchange      | string  | Yes      | okx, binance, bitget, gate, bybit |
| symbol        | string  | Yes      | Trading pair |
| asset_type    | string  | Yes      | spot or swap |
| tp_order_id   | string  | Cond.    | TP order_id from /set-tpsl; at least one of tp/sl required |
| sl_order_id   | string  | Cond.    | SL order_id from /set-tpsl |
| quantity      | number  | Cond.    | Required for spot cancel-tpsl on some exchanges |
| enc           | string  | Cond.    | Online encrypted credentials |
| api_key       | string  | Cond.    | Direct local API key |
| secret_key    | string  | Cond.    | Direct local API secret |
| passphrase    | string  | Cond.    | Required for OKX / Bitget direct mode |
| testnet       | boolean | No       | Must match the environment of the original TP/SL orders |

================================================================================
## POST /close-all
================================================================================

### Request Example:
curl -X POST "${baseUrl}/close-all" \\
  -H "Content-Type: application/json" \\
  -d '{
    "symbol": "BTCUSDT",
    "exchange": "${exchange}",
    "asset_type": "swap",
    ${closeAllAuthBlock}
  }'

### Alternative Direct Credentials Body:
{
  "symbol": "BTCUSDT",
  "exchange": "${exchange}",
  "asset_type": "swap",
  ${directCredentialsLines},
  "testnet": true
}

### Body Fields:
| Field      | Type    | Required | Description |
|------------|---------|----------|-------------|
| symbol     | string  | No       | Omit to close all positions / holdings for that asset_type |
| exchange   | string  | Yes      | okx, binance, bitget, gate, bybit |
| asset_type | string  | Yes      | spot or swap |
| enc        | string  | Cond.    | Online encrypted credentials |
| api_key    | string  | Cond.    | Direct local API key |
| secret_key | string  | Cond.    | Direct local API secret |
| passphrase | string  | Cond.    | Required for OKX / Bitget direct mode |
| testnet    | boolean | No       | Route the request to a supported demo/testnet environment when true |

================================================================================
## Common Failures
================================================================================

- 400: invalid parameters, missing symbol, invalid quantity, unsupported exchange
- 401: credentials cannot be resolved or decrypted
- 500: unexpected server-side failure
`;
    }
      "exchange": "${exchange}",
      "asset_type": "swap",
      "side": "buy",
      "quantity": 0.1,
      "credentials": ${directCredentials}
    }

    ### Body Fields:
    | Field              | Type    | Required | Description |
    |--------------------|---------|----------|-------------|
    | symbol             | string  | Yes      | BTCUSDT or BTC/USDT input accepted |
    | exchange           | string  | Yes      | okx, binance, bitget, gate, bybit |
    | asset_type         | string  | Yes      | spot or swap |
    | side               | string  | Yes      | buy or sell |
    | quantity           | number  | Yes      | Must be greater than zero |
    | leverage           | number  | No       | Swap only, default 1 |
    | margin_mode        | string  | No       | cross or isolated |
    | position_side      | string  | No       | long, short, or omit in one-way mode |
    | action             | string  | No       | open or close |
    | auto_reverse       | number  | No       | 1 closes opposite swap side before opening |
    | enc                | string  | Cond.    | Online encrypted credentials |
    | api_key            | string  | Cond.    | Direct local API key |
    | secret_key         | string  | Cond.    | Direct local API secret |
    | passphrase         | string  | Cond.    | Required for OKX / Bitget direct mode |
    | testnet            | boolean | No       | Route the request to a supported demo/testnet environment when true |

    Notes:
    - Choose exactly one auth path: enc or direct top-level API key fields.
    - For OKX perpetuals, quantity is documented here as coin quantity. The adapter converts to the exchange lot size internally.
    - When auto_reverse=1 on swap orders, the executor attempts to close the opposite side before opening the new side.

    ### Response:
    {
      "success": true,
      "data": {
        "success": true,
        "order_id": "123456789",
        "exchange": "${exchange.toUpperCase()}",
        "symbol": "BTC-USDT-SWAP",
        "side": "buy",
        "quantity": "0.1"
      }
    }


    ================================================================================
    ## POST /close-all
    ================================================================================

    Closes swap positions or liquidates spot holdings for the selected symbol, or all symbols if symbol is omitted.

    ### Request Example:
    curl -X POST "${baseUrl}/close-all" \\
      -H "Content-Type: application/json" \\
      -d '{
        "symbol": "BTCUSDT",
        "exchange": "${exchange}",
        "asset_type": "swap",
        ${closeAllAuthBlock}
      }'

    ### Alternative Direct Credentials Body:
    {
      "symbol": "BTCUSDT",
      "exchange": "${exchange}",
      "asset_type": "swap",
      ${directCredentialsLines},
      "testnet": true
    }

    ### Body Fields:
    | Field              | Type    | Required | Description |
    |--------------------|---------|----------|-------------|
    | symbol             | string  | No       | Omit to close all positions / holdings for that asset_type |
    | exchange           | string  | Yes      | okx, binance, bitget, gate, bybit |
    | asset_type         | string  | Yes      | spot or swap |
    | enc                | string  | Cond.    | Online encrypted credentials |
    | api_key            | string  | Cond.    | Direct local API key |
    | secret_key         | string  | Cond.    | Direct local API secret |
    | passphrase         | string  | Cond.    | Required for OKX / Bitget direct mode |
    | testnet            | boolean | No       | Route the request to a supported demo/testnet environment when true |

    ### Response:
    {
      "success": true,
      "data": [
        {
          "success": true,
          "order_id": "123456789",
          "exchange": "${exchange.toUpperCase()}",
          "symbol": "BTC-USDT-SWAP",
          "side": "sell",
          "quantity": "0.1"
        }
      ]
    }


    ================================================================================
    ## Supported Exchanges
    ================================================================================

    | Exchange  | ID      | Spot | Futures | Passphrase Required |
    |-----------|---------|------|---------|---------------------|
    | OKX       | okx     | ✓    | ✓       | Yes                 |
    | Binance   | binance | ✓    | ✓       | No                  |
    | Bitget    | bitget  | ✓    | ✓       | Yes                 |
    | Gate.io   | gate    | ✓    | ✓       | No                  |
    | Bybit     | bybit   | ✓    | ✓       | No                  |


    ================================================================================
    ## Error Shape and Common Local Validation Failures
    ================================================================================

    {
      "success": false,
      "error": "Error message description"
    }

    Common cases:
    - 400: invalid parameters, missing symbol, invalid quantity, unsupported exchange
    - 401: credentials cannot be resolved or decrypted
    - 400: testnet=true requested for an exchange that does not currently support demo/testnet mode in this executor
    - 500: unexpected server-side failure
    `;
    }
        "filled_at": "2026-01-31T10:00:01Z"
      }
    ],
    "total": 1
  }
}


================================================================================
## Your Encrypted Token
================================================================================

Keep this token secure. It contains your encrypted API credentials.

${encToken}

================================================================================
## Supported Exchanges
================================================================================

| Exchange  | ID      | Spot | Futures | Passphrase Required |
|-----------|---------|------|---------|---------------------|
| OKX       | okx     | ✓    | ✓       | Yes                 |
| Binance   | binance | ✓    | ✓       | No                  |
| Bitget    | bitget  | ✓    | ✓       | Yes                 |
| Gate.io   | gate    | ✓    | ✓       | No                  |
| Bybit     | bybit   | ✓    | ✓       | No                  |
`;
}

function generateApiDocs(baseUrl, mode) {
    const encNote = mode === 'online' 
        ? '// Use "enc" field with your encrypted token' 
        : '// Use "credentials" object with your API keys';
    
    return `# Signal Horse API Documentation
# Base URL: ${baseUrl}

================================================================================
## POST /place-order - Place Trading Order
================================================================================

Place a market or limit order on the specified exchange.

### Market Order Example:
curl -X POST "${baseUrl}/place-order" \\
  -H "Content-Type: application/json" \\
  -d '{
    "symbol": "BTC/USDT",
    "exchange": "okx",
    "asset_type": "swap",
    "side": "buy",
    "quantity": 0.1,
    "leverage": 10,
    "margin_mode": "cross",
    "position_side": "long",
    "action": "open",
    "auto_reverse": 1,
    ${mode === 'online' ? '"enc": "YOUR_ENCRYPTED_TOKEN"' : '"credentials": {"api_key": "...", "secret_key": "...", "passphrase": "..."}'}
  }'

### Limit Order Example:
curl -X POST "${baseUrl}/place-order" \\
  -H "Content-Type: application/json" \\
  -d '{
    "symbol": "BTC/USDT",
    "exchange": "okx",
    "asset_type": "swap",
    "side": "buy",
    "quantity": 0.1,
    "order_type": "limit",
    "price": 50000.0,
    "leverage": 10,
    "position_side": "long",
    "action": "open",
    ${mode === 'online' ? '"enc": "YOUR_ENCRYPTED_TOKEN"' : '"credentials": {"api_key": "...", "secret_key": "...", "passphrase": "..."}'}
  }'

### Parameters:
| Field          | Type    | Required | Description                                              |
|----------------|---------|----------|----------------------------------------------------------|
| symbol         | string  | Yes      | Trading pair (e.g., "BTC/USDT")                         |
| exchange       | string  | Yes      | okx, binance, bitget, gate, bybit                       |
| asset_type     | string  | Yes      | "spot" or "swap" (perpetual)                            |
| side           | string  | Yes      | "buy" or "sell"                                         |
| quantity       | number  | Yes      | Order quantity                                          |
| order_type     | string  | No       | "market" (default) or "limit"                          |
| price          | number  | Cond.    | Required when order_type=limit; must match tick size    |
| leverage       | number  | No       | Leverage for futures (default: 1)                       |
| margin_mode    | string  | No       | "cross" or "isolated"                                   |
| position_side  | string  | No       | "long" or "short" (hedge mode)                          |
| action         | string  | No       | "open" or "close" (futures only)                        |
| auto_reverse   | number  | No       | 1 = close opposite position before opening (futures)   |
${mode === 'online' ? '| enc            | string  | Yes      | Encrypted credentials token                             |' : '| credentials    | object  | Yes      | API credentials object                                  |'}

Note: /order is accepted as a legacy alias for /place-order.

### Response:
{
  "success": true,
  "data": {
    "success": true,
    "order_id": "123456789",
    "exchange": "OKX",
    "symbol": "BTC-USDT-SWAP",
    "side": "buy",
    "quantity": "0.1"
  }
}


================================================================================
## POST /cancel-order - Cancel Order
================================================================================

Cancel an open (non-TP/SL) order using the order_id from /place-order.

### Request Example:
curl -X POST "${baseUrl}/cancel-order" \\
  -H "Content-Type: application/json" \\
  -d '{
    "exchange": "okx",
    "symbol": "BTC/USDT",
    "asset_type": "swap",
    "order_id": "ORDER_ID_FROM_PLACE_ORDER",
    ${mode === 'online' ? '"enc": "YOUR_ENCRYPTED_TOKEN"' : '"credentials": {"api_key": "...", "secret_key": "...", "passphrase": "..."}'}
  }'

### Parameters:
| Field          | Type    | Required | Description                                              |
|----------------|---------|----------|----------------------------------------------------------|
| exchange       | string  | Yes      | okx, binance, bitget, gate, bybit                       |
| symbol         | string  | Yes      | Trading pair                                            |
| asset_type     | string  | Yes      | "spot" or "swap" — must match original order            |
| order_id       | string  | Yes      | The order_id value from /place-order response           |
${mode === 'online' ? '| enc            | string  | Yes      | Encrypted credentials token                             |' : '| credentials    | object  | Yes      | API credentials object                                  |'}

### Response:
{
  "success": true,
  "data": { "exchange": "OKX", "symbol": "BTC-USDT-SWAP", "order_id": "123456789" }
}


================================================================================
## POST /close-all - Close All Positions
================================================================================

Close all positions for the specified exchange and asset type.

### Request Example:
curl -X POST "${baseUrl}/close-all" \\
  -H "Content-Type: application/json" \\
  -d '{
    "symbol": "BTC/USDT",
    "exchange": "okx",
    "asset_type": "swap",
    ${mode === 'online' ? '"enc": "YOUR_ENCRYPTED_TOKEN"' : '"credentials": {"api_key": "...", "secret_key": "...", "passphrase": "..."}'}
  }'

### Parameters:
| Field          | Type    | Required | Description                              |
|----------------|---------|----------|------------------------------------------|
| symbol         | string  | No       | Specific pair (omit to close all)       |
| exchange       | string  | Yes      | okx, binance, bitget, gate, bybit       |
| asset_type     | string  | Yes      | "spot" or "swap"                        |
${mode === 'online' ? '| enc            | string  | Yes      | Encrypted credentials token             |' : '| credentials    | object  | Yes      | API credentials object                  |'}

### Response:
{
  "success": true,
  "data": [
    {
      "success": true,
      "order_id": "123456789",
      "exchange": "OKX",
      "symbol": "BTC-USDT-SWAP",
      "side": "sell",
      "quantity": "0.1"
    }
  ]
}


================================================================================
## GET /positions - Get Account Positions
================================================================================

Get all positions, balances, and spot holdings.

### Request Example:
${mode === 'online' 
? `curl -X GET "${baseUrl}/positions?exchange=okx&enc=YOUR_ENCRYPTED_TOKEN"`
: `curl -X GET "${baseUrl}/positions?exchange=okx&api_key=YOUR_KEY&secret_key=YOUR_SECRET&passphrase=YOUR_PASSPHRASE"`}

### Parameters (Query String):
| Field          | Type    | Required | Description                              |
|----------------|---------|----------|------------------------------------------|
| exchange       | string  | Yes      | okx, binance, bitget, gate, bybit       |
${mode === 'online'
? `| enc            | string  | Yes      | Encrypted credentials token             |`
: `| api_key        | string  | Yes      | Your API key                            |
| secret_key     | string  | Yes      | Your secret key                         |
| passphrase     | string  | No       | Passphrase (required for OKX/Bitget)    |`}

### Response:
{
  "success": true,
  "data": {
    "exchange": "OKX",
    "futures_positions": [
      {
        "symbol": "BTC-USDT-SWAP",
        "side": "long",
        "size": "0.1",
        "entry_price": "45000.00",
        "unrealized_pnl": "50.00",
        "leverage": 10,
        "margin_mode": "cross"
      }
    ],
    "spot_holdings": [
      {
        "currency": "USDT",
        "available": "1000.00",
        "frozen": "0.00"
      }
    ],
    "balances": [
      {
        "currency": "USDT",
        "available": "1000.00",
        "frozen": "0.00",
        "total": "1000.00"
      }
    ]
  }
}


================================================================================
## GET /orders-history - Get Historical Filled Orders
================================================================================

Get historical filled orders for the account.

### Request Example:
${mode === 'online'
? `curl -X GET "${baseUrl}/orders-history?exchange=okx&enc=YOUR_ENCRYPTED_TOKEN&asset_type=swap&limit=100"`
: `curl -X GET "${baseUrl}/orders-history?exchange=okx&api_key=YOUR_KEY&secret_key=YOUR_SECRET&passphrase=YOUR_PASSPHRASE&asset_type=swap&limit=100"`}

### Parameters (Query String):
| Field          | Type    | Required | Description                              |
|----------------|---------|----------|------------------------------------------|
| exchange       | string  | Yes      | okx, binance, bitget, gate, bybit       |
${mode === 'online'
? `| enc            | string  | Yes      | Encrypted credentials token             |`
: `| api_key        | string  | Yes      | Your API key                            |
| secret_key     | string  | Yes      | Your secret key                         |
| passphrase     | string  | No       | Passphrase (required for OKX/Bitget)    |`}
| asset_type     | string  | No       | "spot" or "swap" (omit for both)        |
| symbol         | string  | No       | Filter by specific symbol               |
| limit          | number  | No       | Max orders to return (default: 100)     |

### Response:
{
  "success": true,
  "data": {
    "exchange": "OKX",
    "orders": [
      {
        "order_id": "123456789",
        "symbol": "BTC-USDT-SWAP",
        "side": "buy",
        "position_side": "long",
        "quantity": "0.1",
        "price": "50000.50",
        "value": "5000.05",
        "fee": "2.50",
        "fee_currency": "USDT",
        "leverage": 10,
        "margin_mode": "cross",
        "asset_type": "swap",
        "created_at": "2026-01-31T10:00:00Z",
        "filled_at": "2026-01-31T10:00:01Z"
      }
    ],
    "total": 1
  }
}


================================================================================
## Supported Exchanges
================================================================================

| Exchange  | ID      | Spot | Futures | Passphrase Required |
|-----------|---------|------|---------|---------------------|
| OKX       | okx     | ✓    | ✓       | Yes                 |
| Binance   | binance | ✓    | ✓       | No                  |
| Bitget    | bitget  | ✓    | ✓       | Yes                 |
| Gate.io   | gate    | ✓    | ✓       | No                  |
| Bybit     | bybit   | ✓    | ✓       | No                  |


================================================================================
## Error Responses
================================================================================

{
  "success": false,
  "error": "Error message description"
}

Common error codes:
- 400: Bad Request (invalid parameters)
- 401: Unauthorized (invalid credentials)
- 500: Internal Server Error
`;
}

// ==================== Initialize ====================

document.addEventListener('DOMContentLoaded', function() {
    // Generate default API docs
    const defaultDocs = generateApiDocs(window.API_BASE_URL || 'https://api.signal.horse', 'online');
  const apiDocsText = document.getElementById('api-docs-text');
  if (apiDocsText) {
    apiDocsText.value = defaultDocs;
  }
    
    // Smooth scroll for anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
    });
});
