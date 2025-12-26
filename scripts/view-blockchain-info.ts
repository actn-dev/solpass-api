#!/usr/bin/env ts-node

import { Connection, PublicKey } from '@solana/web3.js';
import { AnchorProvider, Program } from '@coral-xyz/anchor';
import { bs58 } from '@coral-xyz/anchor/dist/cjs/utils/bytes';
import * as fs from 'fs';
import * as path from 'path';
import idl from '../src/blockchain/solana-ticket/ticket-idl.json';

// Load environment variables from .env file
function loadEnv(): { SOLANA_RPC_URL: string; SOLANA_PROGRAM_ID: string } {
  const envPath = path.resolve(__dirname, '../.env');
  
  if (!fs.existsSync(envPath)) {
    console.error('❌ Error: .env file not found');
    process.exit(1);
  }

  const envFile = fs.readFileSync(envPath, 'utf-8');
  const env: any = {};

  envFile.split('\n').forEach((line) => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=');
      if (key && valueParts.length > 0) {
        env[key.trim()] = valueParts.join('=').trim().replace(/^["']|["']$/g, '');
      }
    }
  });

  return {
    SOLANA_RPC_URL: env.SOLANA_RPC_URL || 'https://api.devnet.solana.com',
    SOLANA_PROGRAM_ID: env.SOLANA_PROGRAM_ID,
  };
}

// Configuration
const { SOLANA_RPC_URL, SOLANA_PROGRAM_ID } = loadEnv();

if (!SOLANA_PROGRAM_ID) {
  console.error('❌ Error: SOLANA_PROGRAM_ID not found in environment variables');
  process.exit(1);
}

// Helper function to convert micro-USDC to USD
function microUsdcToUsd(microUsdc: number): number {
  return microUsdc / 1_000_000;
}

// Helper function to format date
function formatDate(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleString();
}

/**
 * Derive event PDA
 */
function deriveEventPDA(
  programId: PublicKey,
  authority: PublicKey,
  eventId: string,
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from('EVENT_STATE'),
      authority.toBuffer(),
      Buffer.from(eventId),
    ],
    programId,
  );
}

/**
 * Derive ticket PDA
 */
function deriveTicketPDA(
  programId: PublicKey,
  eventPDA: PublicKey,
  ticketId: string,
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('TICKET_STATE'), eventPDA.toBuffer(), Buffer.from(ticketId)],
    programId,
  );
}

/**
 * Derive royalty escrow PDA
 */
function deriveRoyaltyEscrowPDA(
  programId: PublicKey,
  eventPDA: PublicKey,
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('ROYALTY_ESCROW'), eventPDA.toBuffer()],
    programId,
  );
}

/**
 * Get event information from blockchain
 */
async function getEventInfo(
  program: Program,
  eventPda: PublicKey,
): Promise<any> {
  try {
    const eventAccount = await program.account.eventAccount.fetch(eventPda);
    return eventAccount;
  } catch (error) {
    throw new Error(`Failed to fetch event account: ${error.message}`);
  }
}

/**
 * Get ticket information from blockchain
 */
async function getTicketInfo(
  program: Program,
  ticketPda: PublicKey,
): Promise<any> {
  try {
    const ticketAccount = await program.account.ticketAccount.fetch(ticketPda);
    return ticketAccount;
  } catch (error) {
    throw new Error(`Failed to fetch ticket account: ${error.message}`);
  }
}

/**
 * Get royalty escrow information
 */
async function getEscrowInfo(
  program: Program,
  escrowPda: PublicKey,
): Promise<any> {
  try {
    const escrowAccount = await program.account.royaltyEscrow.fetch(escrowPda);
    return escrowAccount;
  } catch (error) {
    console.log('⚠️  Escrow account not found (no resales yet)');
    return null;
  }
}

/**
 * Get all tickets for an event
 */
async function getAllEventTickets(
  program: Program,
  eventPda: PublicKey,
): Promise<any[]> {
  try {
    const tickets = await program.account.ticketAccount.all([
      {
        memcmp: {
          offset: 8,
          bytes: bs58.encode(eventPda.toBuffer()),
        },
      },
    ]);

    return tickets.map((ticket) => ({
      publicKey: ticket.publicKey.toBase58(),
      ...ticket.account,
    }));
  } catch (error) {
    console.error('Error fetching tickets:', error.message);
    return [];
  }
}

/**
 * Get transaction signatures for an account
 */
async function getAccountTransactions(
  connection: Connection,
  accountPubkey: PublicKey,
  limit: number = 10,
): Promise<any[]> {
  try {
    const signatures = await connection.getSignaturesForAddress(accountPubkey, {
      limit,
    });

    const transactions: any[] = [];
    for (const sig of signatures) {
      const tx = await connection.getTransaction(sig.signature, {
        maxSupportedTransactionVersion: 0,
      });

      if (tx) {
        transactions.push({
          signature: sig.signature,
          slot: sig.slot,
          blockTime: sig.blockTime,
          err: sig.err,
          logs: tx.meta?.logMessages || [],
        });
      }
    }

    return transactions;
  } catch (error) {
    console.error('Error fetching transactions:', error.message);
    return [];
  }
}

/**
 * Display event information
 */
function displayEventInfo(eventData: any, eventPda: PublicKey) {
  console.log('\n📋 EVENT INFORMATION');
  console.log('='.repeat(80));
  console.log(`Event PDA:           ${eventPda.toBase58()}`);
  console.log(`Event ID:            ${eventData.eventId}`);
  console.log(`Name:                ${eventData.name}`);
  console.log(`Authority:           ${eventData.authority.toBase58()}`);
  console.log(`Royalty Split:       ${eventData.royalty}`);
  console.log(`Tickets Sold:        ${eventData.ticketsSold}`);
  console.log(`Is Active:           ${eventData.isActive ? '✅ Yes' : '❌ No'}`);
  console.log(`Royalty Distributed: ${eventData.royaltyDistributed ? '✅ Yes' : '❌ No'}`);
  console.log('='.repeat(80));
}

/**
 * Display ticket information
 */
function displayTicketInfo(ticketData: any, ticketPda: PublicKey) {
  console.log('\n🎫 TICKET INFORMATION');
  console.log('='.repeat(80));
  console.log(`Ticket PDA:       ${ticketPda.toBase58()}`);
  console.log(`Ticket ID:        ${ticketData.ticketId}`);
  console.log(`Event PDA:        ${ticketData.event.toBase58()}`);
  console.log(`Current Owner:    ${ticketData.owner}`);
  console.log(`Seller:           ${ticketData.seller}`);
  console.log(`Ticket Price:     $${microUsdcToUsd(ticketData.ticketPrice)}`);
  console.log(`Resell Count:     ${ticketData.resellCount}`);
  console.log(`Purchase Date:    ${formatDate(ticketData.purchaseDate.toNumber())}`);
  console.log('='.repeat(80));
}

/**
 * Display escrow information
 */
function displayEscrowInfo(escrowData: any, escrowPda: PublicKey) {
  console.log('\n💰 ROYALTY ESCROW INFORMATION');
  console.log('='.repeat(80));
  console.log(`Escrow PDA:       ${escrowPda.toBase58()}`);
  console.log(`Event PDA:        ${escrowData.event.toBase58()}`);
  console.log(`USDC Balance:     $${microUsdcToUsd(escrowData.usdcAmount.toNumber())}`);
  console.log('='.repeat(80));
}

/**
 * Display all tickets for an event
 */
function displayAllTickets(tickets: any[]) {
  console.log('\n🎟️  ALL EVENT TICKETS');
  console.log('='.repeat(80));
  
  if (tickets.length === 0) {
    console.log('No tickets found for this event.');
    console.log('='.repeat(80));
    return;
  }

  tickets.forEach((ticket, index) => {
    console.log(`\n[${index + 1}] Ticket: ${ticket.ticketId}`);
    console.log(`    PDA:          ${ticket.publicKey}`);
    console.log(`    Owner:        ${ticket.owner}`);
    console.log(`    Seller:       ${ticket.seller}`);
    console.log(`    Price:        $${microUsdcToUsd(ticket.ticketPrice)}`);
    console.log(`    Resell Count: ${ticket.resellCount}`);
    console.log(`    Purchase:     ${formatDate(ticket.purchaseDate.toNumber())}`);
  });
  
  console.log('\n' + '='.repeat(80));
  console.log(`Total Tickets: ${tickets.length}`);
  console.log('='.repeat(80));
}

/**
 * Display transaction logs
 */
function displayTransactions(transactions: any[], accountType: string) {
  console.log(`\n📜 TRANSACTION HISTORY (${accountType})`);
  console.log('='.repeat(80));
  
  if (transactions.length === 0) {
    console.log('No transactions found.');
    console.log('='.repeat(80));
    return;
  }

  transactions.forEach((tx, index) => {
    console.log(`\n[${index + 1}] Transaction`);
    console.log(`    Signature:  ${tx.signature}`);
    console.log(`    Slot:       ${tx.slot}`);
    console.log(`    Time:       ${tx.blockTime ? formatDate(tx.blockTime) : 'N/A'}`);
    console.log(`    Status:     ${tx.err ? '❌ Failed' : '✅ Success'}`);
    
    if (tx.logs && tx.logs.length > 0) {
      console.log(`    Logs:`);
      tx.logs.slice(0, 5).forEach((log: string) => {
        console.log(`        ${log}`);
      });
      if (tx.logs.length > 5) {
        console.log(`        ... (${tx.logs.length - 5} more logs)`);
      }
    }
  });
  
  console.log('\n' + '='.repeat(80));
}

/**
 * Main function
 */
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('\n❌ Error: Please provide a PDA address or ticket ID\n');
    console.log('Usage:');
    console.log('  View event by PDA:');
    console.log('    npm run script:view <EVENT_PDA>');
    console.log('');
    console.log('  View event by eventId and authority:');
    console.log('    npm run script:view --event-id <EVENT_ID> --authority <AUTHORITY_PUBKEY>');
    console.log('');
    console.log('  View ticket by PDA:');
    console.log('    npm run script:view <TICKET_PDA>');
    console.log('');
    console.log('  View ticket by eventPDA and ticketId:');
    console.log('    npm run script:view --event-pda <EVENT_PDA> --ticket-id <TICKET_ID>');
    console.log('');
    console.log('Options:');
    console.log('  --logs          Show transaction logs (default: true)');
    console.log('  --all-tickets   Show all tickets for the event');
    console.log('  --limit <n>     Limit number of transactions (default: 10)');
    console.log('');
    process.exit(1);
  }

  try {
    // Initialize connection and program
    console.log('\n🔗 Connecting to Solana...');
    console.log(`RPC URL: ${SOLANA_RPC_URL}`);
    console.log(`Program ID: ${SOLANA_PROGRAM_ID}\n`);

    const connection = new Connection(SOLANA_RPC_URL, 'confirmed');
    const programId = new PublicKey(SOLANA_PROGRAM_ID);
    
    // Create a dummy provider for read-only operations
    const provider = new AnchorProvider(
      connection,
      // @ts-ignore - We don't need a wallet for read-only operations
      { publicKey: PublicKey.default },
      { commitment: 'confirmed' },
    );
    
    const program = new Program(idl as any, programId, provider);

    // Parse arguments
    const showLogs = !args.includes('--no-logs');
    const showAllTickets = args.includes('--all-tickets');
    const limitIndex = args.indexOf('--limit');
    const txLimit = limitIndex !== -1 ? parseInt(args[limitIndex + 1]) || 10 : 10;

    let eventPda: PublicKey | null = null;
    let ticketPda: PublicKey | null = null;

    // Parse command-line arguments
    if (args.includes('--event-id')) {
      const eventIdIndex = args.indexOf('--event-id');
      const authorityIndex = args.indexOf('--authority');
      
      if (eventIdIndex === -1 || authorityIndex === -1) {
        throw new Error('Both --event-id and --authority are required');
      }
      
      const eventId = args[eventIdIndex + 1];
      const authority = new PublicKey(args[authorityIndex + 1]);
      
      [eventPda] = deriveEventPDA(programId, authority, eventId);
      console.log('✅ Derived Event PDA: ' + eventPda.toBase58() + '\n');
    } else if (args.includes('--event-pda')) {
      const eventPdaIndex = args.indexOf('--event-pda');
      const ticketIdIndex = args.indexOf('--ticket-id');
      
      eventPda = new PublicKey(args[eventPdaIndex + 1]);
      
      if (ticketIdIndex !== -1) {
        const ticketId = args[ticketIdIndex + 1];
        [ticketPda] = deriveTicketPDA(programId, eventPda, ticketId);
        console.log('✅ Derived Ticket PDA: ' + ticketPda.toBase58() + '\n');
      }
    } else {
      // Assume first argument is a PDA
      const pda = new PublicKey(args[0]);
      
      // Try to determine if it's an event or ticket by fetching
      try {
        const eventData = await program.account.eventAccount.fetch(pda);
        eventPda = pda;
        console.log('✅ Found Event Account\n');
      } catch {
        try {
          const ticketData: any = await program.account.ticketAccount.fetch(pda);
          ticketPda = pda;
          eventPda = ticketData.event;
          console.log('✅ Found Ticket Account\n');
        } catch {
          throw new Error('Invalid PDA: Not a valid event or ticket account');
        }
      }
    }

    // Fetch event information
    if (eventPda) {
      const eventData = await getEventInfo(program, eventPda);
      displayEventInfo(eventData, eventPda);

      // Fetch escrow information
      const [escrowPda] = deriveRoyaltyEscrowPDA(programId, eventPda);
      const escrowData = await getEscrowInfo(program, escrowPda);
      if (escrowData) {
        displayEscrowInfo(escrowData, escrowPda);
      }

      // Show transaction logs for event
      if (showLogs) {
        const eventTxs = await getAccountTransactions(connection, eventPda, txLimit);
        displayTransactions(eventTxs, 'Event');
      }

      // Show all tickets if requested
      if (showAllTickets) {
        const allTickets = await getAllEventTickets(program, eventPda);
        displayAllTickets(allTickets);
      }
    }

    // Fetch ticket information
    if (ticketPda) {
      const ticketData = await getTicketInfo(program, ticketPda);
      displayTicketInfo(ticketData, ticketPda);

      // Show transaction logs for ticket
      if (showLogs) {
        const ticketTxs = await getAccountTransactions(connection, ticketPda, txLimit);
        displayTransactions(ticketTxs, 'Ticket');
      }
    }

    console.log('\n✅ Done!\n');
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  }
}

// Run the script
main();
