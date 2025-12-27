# Database Migration Note: Revenue Calculation Update

## Date: December 26, 2025

## Overview
Updated revenue calculation logic to use blockchain escrow balance as source of truth instead of summing all transaction amounts.

## Database Schema Changes

### Added Columns to `ticket_transactions` table:

```sql
-- Add previousPrice column to track price before resale
ALTER TABLE ticket_transactions 
ADD COLUMN previous_price DECIMAL(10, 2) NULL;

-- Add profitAmount column to store calculated profit
ALTER TABLE ticket_transactions 
ADD COLUMN profit_amount DECIMAL(10, 2) DEFAULT 0;
```

## Migration Steps

### 1. Run SQL Migration
Execute the above SQL statements on your database.

### 2. Backfill Existing Data (Optional)
For existing resale transactions, you may want to backfill `previousPrice` and `profitAmount`:

```sql
-- This is a best-effort backfill
-- You may need to adjust based on your data
UPDATE ticket_transactions tt
SET 
  previous_price = (
    SELECT price 
    FROM ticket_transactions tt2 
    WHERE tt2.ticket_id = tt.ticket_id 
      AND tt2.created_at < tt.created_at
    ORDER BY tt2.created_at DESC
    LIMIT 1
  ),
  profit_amount = CASE 
    WHEN transaction_type = 'resell' 
    THEN GREATEST(0, tt.price - COALESCE(
      (SELECT price 
       FROM ticket_transactions tt2 
       WHERE tt2.ticket_id = tt.ticket_id 
         AND tt2.created_at < tt.created_at
       ORDER BY tt2.created_at DESC
       LIMIT 1), 
      tt.price
    ))
    ELSE 0
  END
WHERE transaction_type = 'resell';
```

### 3. Restart API Server
```bash
cd /home/ih/Code/nextjs/solpass-repos/solpass-api
npm run build
npm run start:prod
```

### 4. Rebuild Client
```bash
cd /home/ih/Code/nextjs/solpass-repos/solpass-api-client
npm run build
npm run start
```

## Key Changes

### API Changes:
1. **getRevenueBreakdown()**: Now uses escrow balance as totalDistributableRevenue
2. **getStats()**: Uses escrow balance for revenue instead of summing ticket prices
3. **Transaction Recording**: Stores previousPrice and profitAmount for resales

### UI Changes:
1. **Revenue Tab**: Shows distributable revenue from escrow, not transaction sums
2. **Overview Tab**: Uses escrow balance for revenue display
3. **Analytics Tab**: Clarified as transaction volume, not revenue

## Revenue Calculation Logic

### Before (WRONG):
```
revenue = sum(all primary sales) + sum(all resales)
```

### After (CORRECT):
```
revenue = blockchain escrow balance (only resale profits)

Where:
- Primary sales = NOT revenue, just volume
- Resale profit = (resale price - previous price)
- Escrow accumulates only the profit portions
- Partner share = escrow balance × partner percentage
```

## Testing

### 1. Verify Escrow Balance
```bash
npm run script:view <TICKET_PDA>
```
Check that "USDC Balance" in escrow matches API revenue.

### 2. Test New Transaction Recording
Create a resale transaction and verify:
- `previousPrice` is set
- `profitAmount` is calculated correctly
- Escrow balance increases by profit amount × royalty%

### 3. Verify Dashboard Display
- Revenue tab should show escrow balance
- Primary sales shown as "volume" not "revenue"
- Partner shares calculated from escrow

## Rollback Plan

If issues occur:

1. **Revert Database Changes:**
```sql
ALTER TABLE ticket_transactions DROP COLUMN previous_price;
ALTER TABLE ticket_transactions DROP COLUMN profit_amount;
```

2. **Revert Code:**
```bash
git revert <commit-hash>
```

3. **Redeploy previous version**

## Notes

- **Escrow balance is source of truth** - this comes from blockchain
- **DB transactions are for breakdown only** - detailed history
- **No data loss** - old transaction records remain unchanged
- **Backwards compatible** - handles null previousPrice gracefully
