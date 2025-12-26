# Blockchain Info Viewer - Complete Guide

## Overview

I've created a comprehensive script system for viewing blockchain event and ticket information in your Solpass API project. This allows you to inspect:

- ✅ Event details (name, ID, royalty splits, tickets sold)
- ✅ Ticket information (owner, seller, price, **resell count**)
- ✅ Royalty escrow balances (accumulated from resales)
- ✅ Transaction logs and history
- ✅ All tickets for an event with resell data

## Files Created

### 1. Main Script: `scripts/view-blockchain-info.ts`
The core script that fetches data directly from the Solana blockchain.

### 2. Helper Script: `scripts/view-by-db-id.ts` (Template)
A template for database-integrated viewing (requires implementation).

### 3. Documentation:
- `scripts/QUICK_START.md` - Quick examples and common use cases
- `scripts/VIEW_BLOCKCHAIN_README.md` - Complete detailed documentation

## Quick Start

### Basic Usage

**View Event by PDA:**
```bash
npm run script:view <EVENT_PDA_ADDRESS>
```

**View Event by ID and Authority:**
```bash
npm run script:view --event-id "your-event-id" --authority <AUTHORITY_PUBKEY>
```

**View Ticket by PDA:**
```bash
npm run script:view <TICKET_PDA_ADDRESS>
```

**View Ticket by Event + Ticket ID:**
```bash
npm run script:view --event-pda <EVENT_PDA> --ticket-id "your-ticket-id"
```

**View All Tickets for Event:**
```bash
npm run script:view <EVENT_PDA> --all-tickets
```

## What You'll See

### Event Information
```
📋 EVENT INFORMATION
================================================================================
Event PDA:           8xYzVvU2YTQ8pVp7nAHFKqPBQNmJqz9Xy5D6H8QkK4WL
Event ID:            summer-concert-2024
Name:                Summer Music Festival
Authority:           5Z3gH9rTq4pK8mL2nR5sX7wQ1vY6uE8jN4aB9cD3fT2k
Royalty Split:       40,30,30
Tickets Sold:        150
Is Active:           ✅ Yes
Royalty Distributed: ❌ No
================================================================================
```

### Royalty Escrow
```
💰 ROYALTY ESCROW INFORMATION
================================================================================
Escrow PDA:       7bC3dE5fG7hI9jK1lM3nO5pQ7rS9tU1vW3xY5zA7bC9d
Event PDA:        8xYzVvU2YTQ8pVp7nAHFKqPBQNmJqz9Xy5D6H8QkK4WL
USDC Balance:     $1,250.50
================================================================================
```

### Ticket Resell Information
```
🎫 TICKET INFORMATION
================================================================================
Ticket PDA:       9aB2cD4eF6gH8iJ0kL1mN3oP5qR7sT9uV1wX3yZ5aB7c
Ticket ID:        TKT-001
Current Owner:    user456
Seller:           user123
Ticket Price:     $75.00
Resell Count:     2  ← This ticket was resold 2 times!
Purchase Date:    12/26/2025, 10:30:45 AM
================================================================================
```

### All Event Tickets
```
🎟️  ALL EVENT TICKETS
================================================================================

[1] Ticket: TKT-001
    PDA:          9aB2cD4eF6gH8iJ0kL1mN3oP5qR7sT9uV1wX3yZ5aB7c
    Owner:        user123
    Seller:       platform
    Price:        $50.00
    Resell Count: 0  ← Never resold

[2] Ticket: TKT-002
    PDA:          1xY2zA3bC4dE5fG6hI7jK8lM9nO0pQ1rS2tU3vW4xY5z
    Owner:        user456
    Seller:       user123
    Price:        $75.00
    Resell Count: 2  ← Resold twice!

[3] Ticket: TKT-003
    PDA:          2yZ3aB4cD5eF6gH7iJ8kL9mN0oP1qR2sT3uV4wX5yZ6a
    Owner:        user789
    Seller:       user456
    Price:        $100.00
    Resell Count: 5  ← Hot ticket! Resold 5 times!

================================================================================
Total Tickets: 3
================================================================================
```

### Transaction Logs
```
📜 TRANSACTION HISTORY (Ticket)
================================================================================

[1] Transaction
    Signature:  5nR8mK3pL9qT2wE6yU4iO1sA7gH5dF8bN2cV9xZ3mQ7k
    Slot:       245678901
    Time:       12/26/2025, 10:30:45 AM
    Status:     ✅ Success
    Logs:
        Program log: Instruction: ResellTicket
        Program log: Ticket resold successfully
        Program log: Resell count: 2
        Program log: Royalty added to escrow: 10000000

================================================================================
```

## Understanding Resell Data

The **Resell Count** is the key metric that shows how many times a ticket has been resold:

- `resellCount: 0` = Original buyer, never resold
- `resellCount: 1` = Resold once (2nd owner)
- `resellCount: 2` = Resold twice (3rd owner)
- `resellCount: 3+` = Hot ticket! Multiple resales

### How It Works in Your Blockchain

When you call `resellTicket()`, the smart contract:
1. Transfers the ticket to the new owner
2. **Increments the resell count** by 1
3. Calculates royalty (price difference × royalty percentage)
4. Adds royalty to the escrow account
5. Logs the transaction

This data is stored on-chain in the `TicketAccount`:
```rust
pub struct TicketAccount {
    pub event: Pubkey,
    pub owner: String,
    pub seller: String,
    pub ticket_id: String,
    pub purchase_date: i64,
    pub ticket_price: u16,
    pub resell_count: u8,  ← This field!
}
```

## Common Use Cases

### 1. Track Ticket Resell Activity
```bash
npm run script:view <EVENT_PDA> --all-tickets
```
Shows all tickets with their resell counts. Perfect for:
- Identifying hot tickets (high resell count)
- Monitoring secondary market activity
- Detecting potential scalping

### 2. Verify Ticket Ownership
```bash
npm run script:view --event-pda <EVENT_PDA> --ticket-id "TKT-123"
```
Confirms:
- Who currently owns the ticket
- Who sold it to them
- How many times it's been resold
- When it was purchased

### 3. Check Royalty Revenue
```bash
npm run script:view <EVENT_PDA> --no-logs
```
Quick view of:
- Total royalty balance in escrow
- Event status
- Tickets sold
- Whether royalties have been distributed

### 4. Audit Event Activity
```bash
npm run script:view <EVENT_PDA> --all-tickets --limit 50
```
Complete audit showing:
- All tickets and their owners
- All resell counts
- Up to 50 recent transactions
- Total activity metrics

### 5. Investigate Specific Ticket
```bash
npm run script:view <TICKET_PDA> --limit 20
```
Deep dive into one ticket:
- Complete ownership history
- All resell transactions
- Price progression
- Detailed logs

## Options Reference

| Option | Description | Default |
|--------|-------------|---------|
| `--event-id <ID>` | Event ID from your database | - |
| `--authority <PUBKEY>` | Authority public key (used with event-id) | - |
| `--event-pda <PDA>` | Event PDA address | - |
| `--ticket-id <ID>` | Ticket ID from your database | - |
| `--all-tickets` | Show all tickets for the event | false |
| `--no-logs` | Hide transaction logs | false (logs shown) |
| `--limit <N>` | Max transactions to show | 10 |

## How to Get Data

### Method 1: Use Stored PDAs
If you store PDAs in your database (recommended):

```sql
SELECT blockchain_pda FROM events WHERE id = 123;
```

Then:
```bash
npm run script:view <BLOCKCHAIN_PDA>
```

### Method 2: Derive from IDs
If you only store event_id and ticket_id:

```sql
SELECT event_id FROM events WHERE id = 123;
```

Then:
```bash
npm run script:view --event-id "<EVENT_ID>" --authority <YOUR_SERVER_WALLET>
```

### Method 3: Database Integration (Advanced)
Implement the `view-by-db-id.ts` script to query your database directly:

```typescript
// In view-by-db-id.ts, implement:
async function queryDatabase(query: string): Promise<any> {
  // 1. Import your TypeORM connection
  // 2. Query events/tickets table
  // 3. Return blockchain_pda
}
```

Then use:
```bash
npm run script:view-db event 123
npm run script:view-db ticket 456
npm run script:view-db stats 123  # Get resell statistics
```

## PDA Derivation

The script uses the same PDA derivation as your smart contract:

**Event PDA:**
```typescript
seeds = ["EVENT_STATE", authority_pubkey, event_id]
```

**Ticket PDA:**
```typescript
seeds = ["TICKET_STATE", event_pda, ticket_id]
```

**Royalty Escrow PDA:**
```typescript
seeds = ["ROYALTY_ESCROW", event_pda]
```

## Integration Examples

### Example 1: Add to Your Event Controller

```typescript
@Get(':id/blockchain')
async getBlockchainInfo(@Param('id') id: number) {
  const event = await this.eventsService.findOne(id);
  
  // Option A: Call the script
  const { stdout } = await exec(
    `npm run script:view ${event.blockchainPda} -- --no-logs`
  );
  
  // Option B: Use the service directly
  const eventData = await this.solanaTicketService.getEventAccount(
    new PublicKey(event.blockchainPda)
  );
  
  const tickets = await this.solanaTicketService.getEventTickets(
    new PublicKey(event.blockchainPda)
  );
  
  return {
    eventData,
    tickets: tickets.map(t => ({
      ticketId: t.ticketId,
      owner: t.owner,
      resellCount: t.resellCount,
      price: t.ticketPrice,
    })),
  };
}
```

### Example 2: Resell Analytics Endpoint

```typescript
@Get(':id/resell-stats')
async getResellStats(@Param('id') id: number) {
  const event = await this.eventsService.findOne(id);
  const tickets = await this.solanaTicketService.getEventTickets(
    new PublicKey(event.blockchainPda)
  );
  
  const stats = {
    totalTickets: tickets.length,
    totalResells: tickets.reduce((sum, t) => sum + t.resellCount, 0),
    avgResells: tickets.reduce((sum, t) => sum + t.resellCount, 0) / tickets.length,
    resellDistribution: {},
    hotTickets: tickets
      .filter(t => t.resellCount >= 3)
      .sort((a, b) => b.resellCount - a.resellCount)
      .slice(0, 10),
  };
  
  // Count distribution
  tickets.forEach(t => {
    stats.resellDistribution[t.resellCount] = 
      (stats.resellDistribution[t.resellCount] || 0) + 1;
  });
  
  return stats;
}
```

### Example 3: Monitor High Resell Activity

```typescript
// Cron job or scheduled task
@Cron('0 * * * *') // Every hour
async checkHighResellActivity() {
  const activeEvents = await this.eventsService.findActive();
  
  for (const event of activeEvents) {
    const tickets = await this.solanaTicketService.getEventTickets(
      new PublicKey(event.blockchainPda)
    );
    
    const highResellTickets = tickets.filter(t => t.resellCount > 5);
    
    if (highResellTickets.length > 0) {
      // Alert or log high activity
      this.logger.warn(
        `Event ${event.name} has ${highResellTickets.length} tickets with >5 resells`
      );
    }
  }
}
```

## Troubleshooting

**Error: SOLANA_PROGRAM_ID not found**
- Ensure `.env` file has `SOLANA_PROGRAM_ID=your_program_id`

**Error: Invalid PDA**
- Check the PDA address is correct
- Verify you're on the right network (devnet/mainnet)
- Ensure the event/ticket was actually created on blockchain

**No transactions shown**
- Account is new with no history
- Try increasing limit: `--limit 50`

**Escrow not found**
- This is normal if no resales have occurred yet
- Escrow is only created after first resell

## Performance Tips

1. **Use `--no-logs`** for faster queries when you don't need transaction history
2. **Limit transactions** with `--limit 5` for quick checks
3. **Cache PDAs** in your database to avoid re-deriving them
4. **Batch queries** if checking multiple tickets/events

## Next Steps

1. ✅ **Test the script** with your existing events/tickets
2. ✅ **Store PDAs** in your database for faster lookups
3. ✅ **Implement database integration** in `view-by-db-id.ts`
4. ✅ **Add analytics endpoints** to your API using the service methods
5. ✅ **Set up monitoring** for high resell activity

## Need Help?

- See [QUICK_START.md](QUICK_START.md) for quick examples
- See [VIEW_BLOCKCHAIN_README.md](VIEW_BLOCKCHAIN_README.md) for detailed documentation
- Check the inline comments in [view-blockchain-info.ts](view-blockchain-info.ts)

## Summary

You now have a powerful tool to:
- ✅ View any event or ticket data from blockchain
- ✅ Track ticket resell history and counts
- ✅ Monitor royalty escrow balances
- ✅ Audit transaction logs
- ✅ Analyze resell patterns

The key insight is the **resellCount** field on each ticket, which tells you exactly how many times it's been resold, giving you complete visibility into your secondary market!
