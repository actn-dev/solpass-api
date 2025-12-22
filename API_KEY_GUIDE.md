# API Key Authentication Guide

## 🎯 Overview

Solpass API now supports **dual authentication** for partner integration:

### **1. JWT Authentication** (Dashboard Access)
- **Purpose**: Partner admins access dashboard UI
- **Duration**: Short-lived tokens (1 hour)
- **Use**: Login, view events, manage profile, get API keys

### **2. API Key Authentication** (Programmatic Access)
- **Purpose**: Third-party platforms integrate via API
- **Duration**: Long-lived keys (until regenerated)
- **Use**: Initialize blockchain, sell tickets, distribute royalties

---

## 📋 Authentication Flow

### **Step 1: Partner Registration**
```bash
POST /api/v1/auth/register
Content-Type: application/json

{
  "email": "partner@example.com",
  "password": "secure_password",
  "walletAddress": "SoLaNa_WaLLeT_AdDrEsS"
}
```

**Response:**
```json
{
  "id": "uuid",
  "email": "partner@example.com",
  "walletAddress": "SoLaNa_WaLLeT_AdDrEsS",
  "role": "partner",
  "apiKey": "sk_abc123...",
  "message": "User registered successfully"
}
```

⚠️ **IMPORTANT:** Save the `apiKey` securely! It will be shown only once.

---

### **Step 2: Partner Login (Dashboard)**
```bash
POST /api/v1/auth/login
Content-Type: application/json

{
  "email": "partner@example.com",
  "password": "secure_password"
}
```

**Response:**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "uuid",
    "email": "partner@example.com",
    "walletAddress": "SoLaNa_WaLLeT_AdDrEsS",
    "role": "partner"
  }
}
```

---

### **Step 3: Get API Key (if lost)**
```bash
GET /api/v1/auth/api-key
Authorization: Bearer <JWT_TOKEN>
```

**Response:**
```json
{
  "apiKey": "sk_abc123..."
}
```

---

### **Step 4: Regenerate API Key**
```bash
POST /api/v1/auth/regenerate-key
Authorization: Bearer <JWT_TOKEN>
```

**Response:**
```json
{
  "apiKey": "sk_xyz789..."
}
```

⚠️ **WARNING:** Old API key will be invalidated immediately!

---

## 🔐 Using API Keys

### **API Key Format**
```
sk_<32_random_characters>
```

Example: `sk_aB3dEf7HiJ9kLmN2oPqR5sTuVwXyZ1aC`

### **Authentication Header**
```bash
Authorization: Bearer sk_aB3dEf7HiJ9kLmN2oPqR5sTuVwXyZ1aC
```

---

## 📚 API Endpoints by Authentication Type

### **JWT-Protected Endpoints** (Dashboard)
These require `Authorization: Bearer <JWT_TOKEN>`:

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/auth/me` | Get user profile |
| GET | `/api/v1/auth/api-key` | Retrieve API key |
| POST | `/api/v1/auth/regenerate-key` | Regenerate API key |
| POST | `/api/v1/events` | Create new event |
| PATCH | `/api/v1/events/:id` | Update event |
| DELETE | `/api/v1/events/:id` | Delete event |
| GET | `/api/v1/events/:id/stats` | View event statistics |
| GET | `/api/v1/events/:id/escrow` | Check escrow balance |
| POST | `/api/v1/events/:id/enable-partner-usdc` | Enable USDC accounts |

### **API Key-Protected Endpoints** (Integration)
These require `Authorization: Bearer <API_KEY>`:

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/events/:id/initialize-blockchain` | Initialize event on blockchain |
| POST | `/api/v1/events/:id/distribute` | Distribute royalties |
| POST | `/api/v1/events/:eventId/tickets` | Purchase/resell ticket |

### **Public Endpoints** (No Auth Required)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/events` | List all events |
| GET | `/api/v1/events/:id` | Get event details |
| GET | `/api/v1/events/:eventId/tickets` | List tickets |
| GET | `/api/v1/events/:eventId/tickets/:ticketId` | Get ticket details |
| GET | `/api/v1/events/:eventId/tickets/:ticketId/history` | Ticket history |

---

## 🚀 Integration Examples

### **Partner Dashboard Flow**

```bash
# 1. Login to dashboard
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "partner@example.com",
    "password": "password123"
  }'

# Save the accessToken from response

# 2. Create an event (JWT)
curl -X POST http://localhost:3000/api/v1/events \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -d '{
    "name": "Amazing Concert 2025",
    "eventId": "concert-2025-001",
    "date": "2025-12-31T20:00:00Z",
    "location": "Madison Square Garden",
    "totalTickets": 1000,
    "ticketPrice": 50.00
  }'

# 3. View event stats (JWT)
curl -X GET http://localhost:3000/api/v1/events/<EVENT_UUID>/stats \
  -H "Authorization: Bearer <JWT_TOKEN>"

# 4. Get API key for integration (JWT)
curl -X GET http://localhost:3000/api/v1/auth/api-key \
  -H "Authorization: Bearer <JWT_TOKEN>"
```

---

### **Third-Party Integration Flow**

```bash
# Use API key for programmatic operations

# 1. Initialize event on blockchain (API Key)
curl -X POST http://localhost:3000/api/v1/events/<EVENT_UUID>/initialize-blockchain \
  -H "Authorization: Bearer sk_abc123..."

# 2. Sell ticket from partner platform (API Key)
curl -X POST http://localhost:3000/api/v1/events/concert-2025-001/tickets \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk_abc123..." \
  -d '{
    "ticketId": "ticket-001",
    "buyerWallet": "BUYER_SOLANA_WALLET",
    "price": 50.00
  }'

# 3. Distribute royalties (API Key)
curl -X POST http://localhost:3000/api/v1/events/<EVENT_UUID>/distribute \
  -H "Authorization: Bearer sk_abc123..."
```

---

## 🔒 Security Best Practices

### ✅ **DO**
- Store API keys in environment variables
- Use HTTPS in production
- Rotate API keys periodically
- Monitor API key usage
- Implement rate limiting on your side
- Log all API calls for audit trails

### ❌ **DON'T**
- Commit API keys to version control
- Share API keys publicly
- Use same API key across multiple environments
- Hardcode API keys in frontend code
- Expose API keys in URLs or logs

---

## 🛠️ TypeScript/JavaScript SDK Example

```typescript
// solpass-client.ts
class SolpassClient {
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey: string, baseUrl = 'http://localhost:3000') {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
  }

  private async request(endpoint: string, options: RequestInit = {}) {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
        ...options.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.statusText}`);
    }

    return response.json();
  }

  async initializeEvent(eventUuid: string) {
    return this.request(`/api/v1/events/${eventUuid}/initialize-blockchain`, {
      method: 'POST',
    });
  }

  async purchaseTicket(eventId: string, data: {
    ticketId: string;
    buyerWallet: string;
    price: number;
  }) {
    return this.request(`/api/v1/events/${eventId}/tickets`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async distributeRoyalties(eventUuid: string) {
    return this.request(`/api/v1/events/${eventUuid}/distribute`, {
      method: 'POST',
    });
  }
}

// Usage
const client = new SolpassClient(process.env.SOLPASS_API_KEY!);

await client.initializeEvent('event-uuid');
await client.purchaseTicket('concert-001', {
  ticketId: 'ticket-001',
  buyerWallet: 'SoLaNa_WaLLeT',
  price: 50.00,
});
```

---

## 📊 Partner Dashboard (Recommended Features)

Your partner dashboard should display:

1. **API Key Management**
   - Current API key (masked)
   - Regenerate button
   - Last used timestamp

2. **Events Overview**
   - Total events created
   - Active/upcoming events
   - Blockchain status

3. **Ticket Sales**
   - Total tickets sold
   - Revenue generated
   - Recent transactions

4. **Analytics**
   - API usage statistics
   - Error rates
   - Top selling events

---

## 🐛 Troubleshooting

### **401 Unauthorized - Invalid API key**
- Check API key format (must start with `sk_`)
- Verify API key hasn't been regenerated
- Ensure `Authorization: Bearer` prefix is present

### **403 Forbidden - Not event owner**
- User/partner doesn't own the event
- Check event was created with same account

### **API key not working after regeneration**
- Old API key is immediately invalidated
- Update all integration points with new key

---

## 📞 Support

For questions or issues, contact:
- **Email**: support@solpass.io
- **Docs**: https://docs.solpass.io
- **GitHub**: https://github.com/solpass/api

---

## 🔄 Changelog

**v1.0.0** - December 21, 2025
- ✅ Added API key authentication
- ✅ Dual auth system (JWT + API Key)
- ✅ Partner dashboard endpoints
- ✅ Secure ticket purchase with API key
- ✅ Blockchain operations via API key
