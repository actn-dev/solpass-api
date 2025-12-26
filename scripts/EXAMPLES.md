# Example Usage

## Prerequisites

Make sure your `.env` file has:
```env
SOLANA_RPC_URL=https://api.devnet.solana.com
SOLANA_PROGRAM_ID=your_program_id_here
SERVER_WALLET_SECRET_KEY=your_secret_key_here
```

## Example 1: View Event Data

Let's say you created an event in your API and it returned:
```json
{
  "id": 123,
  "eventId": "summer-fest-2024",
  "name": "Summer Music Festival",
  "blockchainPda": "8xYzVvU2YTQ8pVp7nAHFKqPBQNmJqz9Xy5D6H8QkK4WL",
  "signature": "5abc..."
}
```

### Method A: Using the stored PDA
```bash
npm run script:view 8xYzVvU2YTQ8pVp7nAHFKqPBQNmJqz9Xy5D6H8QkK4WL
```

### Method B: Using event ID and authority
```bash
npm run script:view --event-id "summer-fest-2024" --authority <YOUR_SERVER_WALLET_PUBKEY>
```

## Example 2: View Ticket with Resell History

You have a ticket:
```json
{
  "id": 456,
  "ticketId": "TKT-001",
  "eventId": 123,
  "blockchainPda": "9aB2cD4eF6gH8iJ0kL1mN3oP5qR7sT9uV1wX3yZ5aB7c",
  "ownerId": "user123"
}
```

### View ticket details:
```bash
npm run script:view 9aB2cD4eF6gH8iJ0kL1mN3oP5qR7sT9uV1wX3yZ5aB7c
```

**Output:**
```
🎫 TICKET INFORMATION
================================================================================
Ticket PDA:       9aB2cD4eF6gH8iJ0kL1mN3oP5qR7sT9uV1wX3yZ5aB7c
Ticket ID:        TKT-001
Event PDA:        8xYzVvU2YTQ8pVp7nAHFKqPBQNmJqz9Xy5D6H8QkK4WL
Current Owner:    user456
Seller:           user123
Ticket Price:     $75.00
Resell Count:     2        ← This ticket was resold 2 times!
Purchase Date:    12/26/2025, 10:30:45 AM
================================================================================
```

### What the resell count tells you:
- Started with `user123` (original buyer)
- Resold once to someone (resellCount = 1)
- Resold again to `user456` (resellCount = 2, current owner)

## Example 3: Find All Resells for an Event

View all tickets to see which ones have been resold:

```bash
npm run script:view 8xYzVvU2YTQ8pVp7nAHFKqPBQNmJqz9Xy5D6H8QkK4WL --all-tickets
```

**Output:**
```
🎟️  ALL EVENT TICKETS
================================================================================

[1] Ticket: TKT-001
    PDA:          9aB2cD4eF6gH8iJ0kL1mN3oP5qR7sT9uV1wX3yZ5aB7c
    Owner:        user456
    Seller:       user123
    Price:        $75.00
    Resell Count: 2        ← Resold twice

[2] Ticket: TKT-002
    PDA:          1xY2zA3bC4dE5fG6hI7jK8lM9nO0pQ1rS2tU3vW4xY5z
    Owner:        user789
    Seller:       platform
    Price:        $50.00
    Resell Count: 0        ← Never resold (original buyer)

[3] Ticket: TKT-003
    PDA:          2yZ3aB4cD5eF6gH7iJ8kL9mN0oP1qR2sT3uV4wX5yZ6a
    Owner:        user101
    Seller:       user789
    Price:        $100.00
    Resell Count: 5        ← Hot ticket! Resold 5 times!

================================================================================
Total Tickets: 3
================================================================================
```

From this you can see:
- TKT-001: 2 resells (active secondary market)
- TKT-002: 0 resells (original buyer keeping it)
- TKT-003: 5 resells (very hot ticket!)

## Example 4: Check Royalty Escrow

Before distributing royalties, check how much is available:

```bash
npm run script:view 8xYzVvU2YTQ8pVp7nAHFKqPBQNmJqz9Xy5D6H8QkK4WL --no-logs
```

**Output:**
```
💰 ROYALTY ESCROW INFORMATION
================================================================================
Escrow PDA:       7bC3dE5fG7hI9jK1lM3nO5pQ7rS9tU1vW3xY5zA7bC9d
Event PDA:        8xYzVvU2YTQ8pVp7nAHFKqPBQNmJqz9Xy5D6H8QkK4WL
USDC Balance:     $1,250.50     ← Ready to distribute!
================================================================================
```

This $1,250.50 accumulated from all ticket resales and will be split according to your royalty percentages.

## Example 5: Investigate a Specific Resell

Let's say you got a report about TKT-003 being resold many times. Check its history:

```bash
npm run script:view 2yZ3aB4cD5eF6gH7iJ8kL9mN0oP1qR2sT3uV4wX5yZ6a --limit 20
```

**Output:**
```
📜 TRANSACTION HISTORY (Ticket)
================================================================================

[1] Transaction
    Signature:  5nR8mK3pL9qT2wE6yU4iO1sA7gH5dF8bN2cV9xZ3mQ7k
    Time:       12/26/2025, 2:45:30 PM
    Status:     ✅ Success
    Logs:
        Program log: Instruction: ResellTicket
        Program log: Seller: user789
        Program log: Buyer: user101
        Program log: Price: $100.00
        Program log: Resell count: 5

[2] Transaction
    Signature:  3kL7hF9pN2qS5wD8yT4iM1oP6gJ3cE1bM5vX8zY6lQ9h
    Time:       12/26/2025, 1:30:15 PM
    Status:     ✅ Success
    Logs:
        Program log: Instruction: ResellTicket
        Program log: Seller: user567
        Program log: Buyer: user789
        Program log: Price: $90.00
        Program log: Resell count: 4

[3] Transaction
    Signature:  2jK6gE8oM1pR4vC7xS3hL9nB5dA2fG4cY7zQ6mH8kP1l
    Time:       12/26/2025, 11:20:45 AM
    Status:     ✅ Success
    Logs:
        Program log: Instruction: ResellTicket
        Program log: Seller: user234
        Program log: Buyer: user567
        Program log: Price: $80.00
        Program log: Resell count: 3

... (more transactions)
================================================================================
```

This shows you the complete resell chain:
1. Original sale → user234 ($50)
2. Resell 1: user234 → user345 ($60)
3. Resell 2: user345 → user456 ($70)
4. Resell 3: user456 → user567 ($80)
5. Resell 4: user567 → user789 ($90)
6. Resell 5: user789 → user101 ($100) ← Current owner

## Example 6: Real-World Scenario

You want to analyze an event's secondary market activity:

```bash
# Step 1: Get all tickets
npm run script:view <EVENT_PDA> --all-tickets > tickets.txt

# Step 2: Analyze the output
cat tickets.txt | grep "Resell Count" | sort -nr
```

You might see:
```
    Resell Count: 8
    Resell Count: 5
    Resell Count: 5
    Resell Count: 3
    Resell Count: 2
    Resell Count: 1
    Resell Count: 0
    Resell Count: 0
    ... (many 0s)
```

This tells you:
- Most tickets (with resell count 0) are held by original buyers
- A few hot tickets are being actively traded
- One ticket has been resold 8 times! (possible scalping or high demand)

## Example 7: Quick Status Check

Before an event starts, verify everything:

```bash
npm run script:view --event-id "concert-2024" --authority <AUTHORITY> --all-tickets --limit 5
```

This gives you a quick overview:
- ✅ Event is active
- ✅ 150 tickets sold
- ✅ $2,500 in royalty escrow
- ✅ 5 most recent transactions
- ✅ All tickets and their status

## Tips for Your Workflow

### Tip 1: Create Aliases in Your Shell
Add to `~/.bashrc` or `~/.zshrc`:
```bash
alias view-event='npm run script:view'
alias view-tickets='npm run script:view -- --all-tickets'
```

Then use:
```bash
view-event <PDA>
view-tickets <EVENT_PDA>
```

### Tip 2: Save Common PDAs
Keep a file `pdas.txt` with your frequently checked PDAs:
```
# Summer Festival
EVENT: 8xYzVvU2YTQ8pVp7nAHFKqPBQNmJqz9Xy5D6H8QkK4WL
TICKET_001: 9aB2cD4eF6gH8iJ0kL1mN3oP5qR7sT9uV1wX3yZ5aB7c

# Winter Concert
EVENT: 7cY8zB9aC0bD1cE2dF3eG4fH5gI6hJ7iK8jL9kM0lN1m
```

### Tip 3: Monitor Hot Tickets
Create a simple monitoring script:
```bash
#!/bin/bash
EVENT_PDA="8xYzVvU2YTQ8pVp7nAHFKqPBQNmJqz9Xy5D6H8QkK4WL"

echo "Checking for hot tickets..."
npm run script:view $EVENT_PDA --all-tickets --no-logs | \
  grep -B1 "Resell Count: [5-9]" | \
  grep "Ticket:"

echo "Done!"
```

This finds all tickets with 5+ resells.

### Tip 4: Export to CSV
Parse the output for data analysis:
```bash
npm run script:view <EVENT_PDA> --all-tickets --no-logs | \
  awk '/\[.*\] Ticket:/ {ticket=$3} /Owner:/ {owner=$2} /Resell Count:/ {print ticket","owner","$3}' > resells.csv
```

## What Each Field Means

### Resell Count
- **What it is:** Number of times the ticket changed hands after initial purchase
- **Range:** 0 to 255 (it's a `u8` in the smart contract)
- **0 means:** Original buyer still owns it
- **High numbers mean:** Active secondary market for this ticket

### Owner vs Seller
- **Owner:** Current ticket holder
- **Seller:** Person who sold it to current owner
- **Why it matters:** Shows the last transaction in the resell chain

### Ticket Price
- **What it is:** Price paid in the last transaction
- **Unit:** USD (converted from micro-USDC)
- **Tracks:** Current market value

### Purchase Date
- **What it is:** Unix timestamp of last purchase/resell
- **Format:** Automatically converted to readable date
- **Use:** Track timing of resells

### Escrow Balance
- **What it is:** Total USDC accumulated from resale royalties
- **Calculation:** Sum of (resale_price - original_price) × royalty_percentage
- **Distribution:** Split among parties based on royalty percentages

## Common Questions

**Q: Can I see the full resell chain for a ticket?**
A: Yes! View the ticket with transaction logs:
```bash
npm run script:view <TICKET_PDA> --limit 50
```

**Q: How do I find the most resold ticket?**
A: Get all tickets and look for highest resell count:
```bash
npm run script:view <EVENT_PDA> --all-tickets | grep "Resell Count:" | sort -nr | head -1
```

**Q: Can I track resells in real-time?**
A: Yes! Run periodically or set up a monitor:
```bash
while true; do
  npm run script:view <EVENT_PDA> --all-tickets --no-logs
  sleep 60
done
```

**Q: What if a ticket shows resellCount: 0 but has a seller?**
A: The first purchase (from platform to user) shows:
- Owner: user123
- Seller: platform
- resellCount: 0

**Q: How do I calculate total secondary market volume?**
A: Get all tickets, sum up: (resellCount × average_price) for each ticket

## Summary

The script gives you complete visibility into:
- ✅ Who owns each ticket
- ✅ How many times it's been resold
- ✅ Complete transaction history
- ✅ Royalty accumulation
- ✅ Event status and metrics

The **resellCount** field is your key metric for understanding secondary market activity!
