# View Blockchain Info Script

This script allows you to view detailed blockchain information for events and tickets, including resell history, transaction logs, and royalty escrow data.

## Prerequisites

- Node.js and npm/pnpm installed
- `.env` file configured with:
  - `SOLANA_RPC_URL` (e.g., `https://api.devnet.solana.com`)
  - `SOLANA_PROGRAM_ID` (your deployed program ID)

## Usage

### 1. View Event by PDA

View event details when you have the event PDA address:

```bash
npm run script:view <EVENT_PDA_ADDRESS>
```

Example:
```bash
npm run script:view 8xYzVvU2YTQ8pVp7nAHFKqPBQNmJqz9Xy5D6H8QkK4WL
```

**This will show:**
- ✅ Event information (name, ID, authority, royalty split, tickets sold, status)
- ✅ Royalty escrow balance (accumulated from resales)
- ✅ Transaction history for the event

### 2. View Event by Event ID and Authority

Derive the event PDA from event ID and authority public key:

```bash
npm run script:view --event-id <EVENT_ID> --authority <AUTHORITY_PUBKEY>
```

Example:
```bash
npm run script:view --event-id "EVT-001" --authority 5Z3gH9rTq4pK8mL2nR5sX7wQ1vY6uE8jN4aB9cD3fT2k
```

### 3. View Ticket by PDA

View ticket details when you have the ticket PDA address:

```bash
npm run script:view <TICKET_PDA_ADDRESS>
```

Example:
```bash
npm run script:view 9aB2cD4eF6gH8iJ0kL1mN3oP5qR7sT9uV1wX3yZ5aB7c
```

**This will show:**
- ✅ Ticket information (owner, seller, price, resell count, purchase date)
- ✅ Event information (the event this ticket belongs to)
- ✅ Transaction history for the ticket (all resell transactions)

### 4. View Ticket by Event PDA and Ticket ID

Derive the ticket PDA from event PDA and ticket ID:

```bash
npm run script:view --event-pda <EVENT_PDA> --ticket-id <TICKET_ID>
```

Example:
```bash
npm run script:view --event-pda 8xYzVvU2YTQ8pVp7nAHFKqPBQNmJqz9Xy5D6H8QkK4WL --ticket-id "TKT-001"
```

## Additional Options

### View All Tickets for an Event

Show all tickets associated with an event (useful to see all resell entries):

```bash
npm run script:view <EVENT_PDA> --all-tickets
```

Example:
```bash
npm run script:view 8xYzVvU2YTQ8pVp7nAHFKqPBQNmJqz9Xy5D6H8QkK4WL --all-tickets
```

**This will show:**
- All tickets for the event with their resell count
- Current owner and seller for each ticket
- Purchase prices and dates
- Total ticket count

### Disable Transaction Logs

If you don't want to see transaction logs:

```bash
npm run script:view <PDA> --no-logs
```

### Limit Transaction History

Limit the number of transactions shown (default is 10):

```bash
npm run script:view <PDA> --limit 20
```

## Complete Examples

### Example 1: Full Event Analysis with All Tickets

```bash
npm run script:view 8xYzVvU2YTQ8pVp7nAHFKqPBQNmJqz9Xy5D6H8QkK4WL --all-tickets --limit 20
```

This shows:
- Event details
- Royalty escrow balance
- Up to 20 recent transactions
- All tickets with resell history

### Example 2: Check Ticket Resell History

```bash
npm run script:view --event-pda 8xYzVvU2YTQ8pVp7nAHFKqPBQNmJqz9Xy5D6H8QkK4WL --ticket-id "TKT-123"
```

This shows:
- Ticket details including resell count
- Current owner and previous seller
- All transactions for this specific ticket

### Example 3: Quick Event Check (No Logs)

```bash
npm run script:view --event-id "summer-concert-2024" --authority 5Z3gH9rTq4pK8mL2nR5sX7wQ1vY6uE8jN4aB9cD3fT2k --no-logs
```

## Output Explained

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

### Royalty Escrow (Resale Revenue)
```
💰 ROYALTY ESCROW INFORMATION
================================================================================
Escrow PDA:       7bC3dE5fG7hI9jK1lM3nO5pQ7rS9tU1vW3xY5zA7bC9d
Event PDA:        8xYzVvU2YTQ8pVp7nAHFKqPBQNmJqz9Xy5D6H8QkK4WL
USDC Balance:     $1,250.50
================================================================================
```
*Note: This balance accumulates from all ticket resales and is distributed to parties based on royalty split*

### All Event Tickets
```
🎟️  ALL EVENT TICKETS
================================================================================

[1] Ticket: TKT-001
    PDA:          9aB2cD4eF6gH8iJ0kL1mN3oP5qR7sT9uV1wX3yZ5aB7c
    Owner:        user123
    Seller:       platform
    Price:        $50.00
    Resell Count: 2
    Purchase:     12/26/2025, 10:30:45 AM

[2] Ticket: TKT-002
    PDA:          1xY2zA3bC4dE5fG6hI7jK8lM9nO0pQ1rS2tU3vW4xY5z
    Owner:        user456
    Seller:       user123
    Price:        $75.00
    Resell Count: 1
    Purchase:     12/26/2025, 11:15:30 AM

================================================================================
Total Tickets: 2
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

[2] Transaction
    Signature:  3kL7hF9pN2qS5wD8yT4iM1oP6gJ3cE1bM5vX8zY6lQ9h
    Slot:       245670123
    Time:       12/26/2025, 9:15:20 AM
    Status:     ✅ Success
    Logs:
        Program log: Instruction: ResellTicket
        Program log: Ticket resold successfully
        Program log: Resell count: 1
        Program log: Royalty added to escrow: 5000000

================================================================================
```

## Understanding Resell Data

### Resell Count
The `resellCount` field shows how many times a ticket has been resold:
- `0` = Initial purchase (never resold)
- `1` = Resold once
- `2` = Resold twice
- etc.

### Royalty Escrow
- Accumulates USDC from all ticket resales
- Amount is calculated based on the difference between resale price and original price
- Distributed to party wallets based on royalty split percentages
- Can be distributed using the `distributeRoyalty` instruction

### Transaction Logs
Transaction logs show:
- All blockchain operations on the account
- Success/failure status
- Program logs with details about the operation
- Timestamps and slot numbers

## Common Use Cases

### 1. Verify Event Setup
```bash
npm run script:view --event-id "my-event" --authority <YOUR_AUTHORITY_PUBKEY>
```
Check if event was created correctly with proper royalty splits.

### 2. Track Ticket Resales
```bash
npm run script:view <TICKET_PDA>
```
See how many times a ticket has been resold and by whom.

### 3. Check Royalty Balance Before Distribution
```bash
npm run script:view <EVENT_PDA> --no-logs
```
Quick check of escrow balance before distributing royalties.

### 4. Audit Event Ticket Sales
```bash
npm run script:view <EVENT_PDA> --all-tickets --limit 50
```
Get complete overview of all tickets and their transaction history.

## Troubleshooting

### Error: "SOLANA_PROGRAM_ID not found"
- Make sure your `.env` file has `SOLANA_PROGRAM_ID` set

### Error: "Invalid PDA: Not a valid event or ticket account"
- The provided address is not a valid event or ticket account
- Double-check the PDA address
- If using event ID, ensure authority is correct

### Error: "Failed to fetch event account"
- The account doesn't exist on the blockchain
- Event may not have been created yet
- Check if you're connected to the correct network (devnet/mainnet)

### No transactions shown
- Account may be new with no transaction history yet
- Increase the limit: `--limit 50`
- Check if you're connected to the correct network

## PDA Derivation

The script automatically derives PDAs using these seeds:

**Event PDA:**
```
seeds = ["EVENT_STATE", authority_pubkey, event_id]
```

**Ticket PDA:**
```
seeds = ["TICKET_STATE", event_pda, ticket_id]
```

**Royalty Escrow PDA:**
```
seeds = ["ROYALTY_ESCROW", event_pda]
```

## Network Configuration

To switch between devnet/mainnet, update your `.env` file:

**Devnet:**
```env
SOLANA_RPC_URL=https://api.devnet.solana.com
```

**Mainnet:**
```env
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
```

Or use a custom RPC endpoint for better performance.
