# Quick Start Guide: View Blockchain Info Script

## What This Script Does

This script helps you inspect blockchain data for your Solpass events and tickets. You can:

1. ✅ **View event details** - See event info, tickets sold, royalty splits
2. ✅ **Check ticket resell history** - See how many times a ticket was resold
3. ✅ **View royalty escrow balance** - Check accumulated resale revenue
4. ✅ **See transaction logs** - View all blockchain transactions
5. ✅ **List all event tickets** - Get a complete list of tickets for an event

## Quick Examples

### Example 1: Check an Event
If you have an event PDA address:
```bash
npm run script:view 8xYzVvU2YTQ8pVp7nAHFKqPBQNmJqz9Xy5D6H8QkK4WL
```

Or if you have the event ID and authority:
```bash
npm run script:view --event-id "concert-2024" --authority 5Z3gH9rTq4pK8mL2nR5sX7wQ1vY6uE8jN4aB9cD3fT2k
```

**Output will show:**
- Event name, ID, and status
- Number of tickets sold
- Royalty split percentages
- Royalty escrow balance (accumulated from resales)
- Recent transaction history

### Example 2: Check a Ticket
If you have a ticket PDA address:
```bash
npm run script:view 9aB2cD4eF6gH8iJ0kL1mN3oP5qR7sT9uV1wX3yZ5aB7c
```

Or derive it from event and ticket ID:
```bash
npm run script:view --event-pda 8xYzVvU2YTQ8pVp7nAHFKqPBQNmJqz9Xy5D6H8QkK4WL --ticket-id "TKT-001"
```

**Output will show:**
- Current owner and previous seller
- Ticket price
- **Resell count** (how many times it was resold)
- Purchase date and time
- Transaction history for this ticket

### Example 3: View All Tickets for an Event
```bash
npm run script:view 8xYzVvU2YTQ8pVp7nAHFKqPBQNmJqz9Xy5D6H8QkK4WL --all-tickets
```

**This shows ALL tickets with:**
- Each ticket's resell count
- Current owners
- Prices
- Purchase dates
- Total ticket count

## How to Get PDAs

### If You Don't Have the PDA

**For Events:**
You need two things from your database:
1. Event ID (the `eventId` field from your events table)
2. Authority public key (usually the server wallet or event creator)

Then use:
```bash
npm run script:view --event-id "YOUR_EVENT_ID" --authority YOUR_AUTHORITY_PUBKEY
```

**For Tickets:**
You need:
1. Event PDA (from above)
2. Ticket ID (the `ticketId` field from your tickets table)

Then use:
```bash
npm run script:view --event-pda YOUR_EVENT_PDA --ticket-id YOUR_TICKET_ID
```

### If You Have the PDA

If you already stored the PDA in your database (recommended), just use it directly:
```bash
npm run script:view YOUR_PDA_ADDRESS
```

The script will automatically detect if it's an event or ticket.

## Understanding the Output

### Event Information
```
📋 EVENT INFORMATION
Event ID:            concert-2024
Tickets Sold:        150
Royalty Split:       40,30,30  ← Party percentages
Is Active:           ✅ Yes
```

### Royalty Escrow
```
💰 ROYALTY ESCROW INFORMATION
USDC Balance:     $1,250.50  ← Accumulated from all resales
```
This is the money collected from ticket resales that will be distributed to parties.

### Ticket Resell Data
```
🎫 TICKET INFORMATION
Current Owner:    user456
Seller:           user123  ← Who sold it to current owner
Ticket Price:     $75.00
Resell Count:     2  ← This ticket was resold 2 times
```

**Resell Count Explained:**
- `0` = Never resold (original buyer still owns it)
- `1` = Resold once (2nd owner)
- `2` = Resold twice (3rd owner)
- etc.

### All Tickets View
```
🎟️  ALL EVENT TICKETS

[1] Ticket: TKT-001
    Owner:        user123
    Resell Count: 0  ← Never resold

[2] Ticket: TKT-002
    Owner:        user789
    Resell Count: 3  ← Resold 3 times!
```

## Common Use Cases

### Use Case 1: Verify Event Setup
After creating an event, check if it was set up correctly:
```bash
npm run script:view --event-id "my-new-event" --authority YOUR_AUTHORITY
```

### Use Case 2: Track Hot Tickets
See which tickets are being resold the most:
```bash
npm run script:view YOUR_EVENT_PDA --all-tickets
```
Look at the "Resell Count" column to find popular tickets.

### Use Case 3: Check Royalty Revenue
Before distributing royalties, check how much is available:
```bash
npm run script:view YOUR_EVENT_PDA --no-logs
```
This shows the escrow balance without transaction logs for a quick check.

### Use Case 4: Audit Ticket Ownership
Verify who owns a specific ticket:
```bash
npm run script:view --event-pda YOUR_EVENT_PDA --ticket-id "TKT-123"
```

### Use Case 5: Investigate Resell History
See the complete resell chain for a ticket:
```bash
npm run script:view YOUR_TICKET_PDA --limit 50
```
This shows up to 50 transactions for that ticket.

## Options Reference

| Option | Description | Example |
|--------|-------------|---------|
| `--event-id` | Event ID from database | `--event-id "concert-2024"` |
| `--authority` | Authority public key | `--authority 5Z3g...` |
| `--event-pda` | Event PDA address | `--event-pda 8xYz...` |
| `--ticket-id` | Ticket ID from database | `--ticket-id "TKT-001"` |
| `--all-tickets` | Show all event tickets | `--all-tickets` |
| `--no-logs` | Hide transaction logs | `--no-logs` |
| `--limit N` | Limit transactions shown | `--limit 20` |

## Integration with Your Database

### Getting Event Info

1. Query your database for the event:
```sql
SELECT event_id, blockchain_pda FROM events WHERE id = 123;
```

2. Use the PDA directly:
```bash
npm run script:view <blockchain_pda>
```

Or derive it:
```bash
npm run script:view --event-id "<event_id>" --authority <server_wallet>
```

### Getting Ticket Info

1. Query your database:
```sql
SELECT ticket_id, blockchain_pda, event_id FROM tickets WHERE id = 456;
```

2. Use the PDA:
```bash
npm run script:view <blockchain_pda>
```

Or derive it:
```bash
npm run script:view --event-pda <event_pda> --ticket-id "<ticket_id>"
```

### Finding High-Resell Tickets

You can use this script to build analytics:

```bash
# Get all tickets for an event
npm run script:view <EVENT_PDA> --all-tickets --no-logs > tickets.txt

# Then parse the output to find tickets with resellCount > 2
```

## Troubleshooting

**Problem:** "SOLANA_PROGRAM_ID not found"
- **Solution:** Check your `.env` file has `SOLANA_PROGRAM_ID=your_program_id`

**Problem:** "Invalid PDA: Not a valid event or ticket account"
- **Solution:** Double-check the PDA address or event ID/authority combination

**Problem:** "No transactions found"
- **Solution:** The account is new. Wait for some transactions or check you're on the right network

**Problem:** "Failed to fetch event account"
- **Solution:** Event doesn't exist on blockchain. Check if it was actually created

## Tips

1. **Store PDAs in Database**: When you create events/tickets, store the PDA in your database to avoid re-deriving it

2. **Regular Monitoring**: Run this script periodically to monitor:
   - Unusual resell activity
   - Royalty accumulation
   - Transaction patterns

3. **Combine with Your API**: You can call this script programmatically:
   ```typescript
   import { exec } from 'child_process';
   
   exec('npm run script:view ' + eventPda, (error, stdout) => {
     // Parse stdout for ticket data
   });
   ```

4. **Performance**: Use `--no-logs` for faster queries when you don't need transaction history

## Need More Help?

See the full [VIEW_BLOCKCHAIN_README.md](VIEW_BLOCKCHAIN_README.md) for:
- Detailed output explanations
- PDA derivation details
- Network configuration
- Advanced filtering options
