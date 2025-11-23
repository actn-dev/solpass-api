# Solpass API - Getting Started

## ⚠️ IMPORTANT: Before Starting

### 1. Generate Server Wallet

You **MUST** generate a server wallet secret key before starting the application.

Run this command to generate a new keypair:

```bash
node -e "const {Keypair} = require('@solana/web3.js'); const kp = Keypair.generate(); console.log('Public Key:', kp.publicKey.toBase58()); console.log('Secret (base64):', Buffer.from(kp.secretKey).toString('base64'));"
```

### 2. Update .env File

Copy the **Secret (base64)** output and update `.env`:

```env
SERVER_WALLET_SECRET_KEY=YOUR_BASE64_SECRET_KEY_HERE
```

Replace `YOUR_BASE64_SECRET_KEY_HERE` with the actual base64 secret key.

### 3. Fund the Wallet (Devnet)

Visit the [Solana Devnet Faucet](https://faucet.solana.com/) and airdrop SOL to your public key.

Or use CLI:

```bash
solana airdrop 2 YOUR_PUBLIC_KEY --url devnet
```

---

## 🚀 Starting the Application

```bash
# Install dependencies
pnpm install

# Start in development mode
pnpm run start:dev
```

The server will start on `http://localhost:3000`

---

## 📚 API Documentation

Once started, visit:

- **Swagger UI**: http://localhost:3000/api/docs
- **API Base URL**: http://localhost:3000/api/v1/ticket

---

## 🧪 Testing the API

### 1. Test Connection

```bash
curl http://localhost:3000/dev/test/connection
```

Expected response:

```json
{
  "success": true,
  "status": "connected",
  "cluster": "devnet",
  "currentSlot": 123456789
}
```

### 2. Check Server Wallet

```bash
curl http://localhost:3000/dev/test/wallet
```

### 3. Test PDA Derivation

```bash
curl http://localhost:3000/dev/test/pda/event/concert-001
```

---

## 📝 API Endpoints

### Create Event

```bash
curl -X POST http://localhost:3000/api/v1/ticket/events \
  -H "Content-Type: application/json" \
  -d '{
    "eventId": "concert-001",
    "name": "Rock Show",
    "description": "Amazing rock concert",
    "royalty": "23,2,10",
    "venue": "Madison Square Garden",
    "eventDate": "2025-12-31T20:00:00Z",
    "totalTickets": 1000,
    "ticketPrice": 100,
    "authority": "YOUR_SERVER_WALLET_PUBLIC_KEY"
  }'
```

### Purchase Ticket

```bash
curl -X POST http://localhost:3000/api/v1/ticket/events/concert-001/tickets \
  -H "Content-Type: application/json" \
  -d '{
    "ticketId": "ticket-001",
    "buyerWallet": "BUYER_PUBLIC_KEY",
    "sellerWallet": "SELLER_PUBLIC_KEY",
    "newPrice": 120,
    "originalPrice": 100,
    "buyerId": "buyer-123",
    "sellerId": "seller-456"
  }'
```

### Get Event Details

```bash
curl http://localhost:3000/api/v1/ticket/events/concert-001
```

### Get Ticket Details

```bash
curl http://localhost:3000/api/v1/ticket/events/concert-001/tickets/ticket-001
```

### Check Escrow Balance

```bash
curl http://localhost:3000/api/v1/ticket/events/concert-001/escrow
```

### Distribute Royalties

```bash
curl -X POST http://localhost:3000/api/v1/ticket/events/concert-001/distribute \
  -H "Content-Type: application/json" \
  -d '{
    "authority": "YOUR_SERVER_WALLET_PUBLIC_KEY",
    "partyAddresses": [
      "PARTY1_PUBLIC_KEY",
      "PARTY2_PUBLIC_KEY",
      "PARTY3_PUBLIC_KEY"
    ]
  }'
```

---

## 🔍 Development Endpoints

These endpoints are for testing and development only:

- `GET /dev/test/connection` - Test Solana RPC connection
- `GET /dev/test/wallet` - Get server wallet info
- `GET /dev/test/pda/event/:eventId` - Derive event PDA
- `GET /dev/test/pda/ticket/:eventId/:ticketId` - Derive ticket PDA
- `GET /dev/test/usdc-balance/:walletAddress` - Check USDC balance
- `GET /dev/test/config` - Get configuration

---

## 🛠️ Configuration

All configuration is in `.env`:

```env
# Solana
SOLANA_RPC_URL=https://api.devnet.solana.com
SOLANA_CLUSTER=devnet
PROGRAM_ID=BVt1LbTYSFaZ7jZghdffdism86BdqcKPrcZ1caajiPAP
USDC_MINT=4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU

# Wallet
SERVER_WALLET_SECRET_KEY=base64_encoded_secret_key

# API
PORT=3000
```

---

## 📦 Project Structure

```
src/
├── blockchain/              # Blockchain infrastructure
│   ├── constants/          # Solana constants
│   ├── providers/          # Connection & wallet providers
│   └── services/           # Blockchain services
├── ticket/                 # Ticket module
│   ├── dto/               # Data transfer objects
│   ├── solana-ticket/     # Blockchain ticket service
│   ├── ticket.controller.ts
│   ├── ticket.service.ts
│   └── dev-test.controller.ts
└── config/                # Configuration
    └── configuration.ts
```

---

## ⚠️ Important Notes

1. **Server Wallet**: The API uses a server-side wallet for all transactions. This is a **custodial** approach suitable for MVP/testing.

2. **USDC Token Accounts**: Token accounts are auto-created if they don't exist. Make sure the server wallet has enough SOL for rent (~0.002 SOL per account).

3. **Transaction Confirmation**: The API waits up to 30 seconds for transaction confirmation. Adjust timeout in `SolanaService` if needed.

4. **Authority**: For now, the server wallet is used as the authority for event creation. In production, you'd support multiple authorities via database lookup.

5. **Error Handling**: All errors are caught and returned as standard HTTP error responses.

---

## 🐛 Troubleshooting

### "SERVER_WALLET_SECRET_KEY not configured"

- Make sure you generated a wallet and updated `.env`

### "Transaction failed"

- Check that server wallet has SOL for transaction fees
- Verify program ID matches deployed contract
- Check RPC node is responding

### "Escrow account not found"

- No tickets have been resold yet (escrow is empty)

### "Event not found"

- Verify event was created successfully
- Check event ID spelling
- Make sure using correct authority

---

## 📖 Next Steps

1. ✅ Test all endpoints with Swagger UI
2. ✅ Create a test event
3. ✅ Purchase test tickets
4. ✅ Check escrow accumulation
5. ✅ Distribute royalties
6. 🔜 Add database persistence (TypeORM)
7. 🔜 Add API key authentication
8. 🔜 Add webhook notifications
9. 🔜 Deploy to production

---

## 📞 Support

For issues, check the console logs. All operations are logged with detailed information.
