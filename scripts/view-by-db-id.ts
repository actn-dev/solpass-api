#!/usr/bin/env ts-node

/**
 * Database-integrated blockchain info viewer
 * This script queries your database first to get PDAs, then shows blockchain info
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message: string, color: string = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

async function queryDatabase(query: string): Promise<any> {
  // Note: This is a placeholder. You'll need to implement actual database connection
  // using TypeORM like your NestJS app does.
  
  log('\n⚠️  Database integration not yet implemented', colors.yellow);
  log('This script is a template. To use it:', colors.yellow);
  log('1. Import your TypeORM configuration', colors.yellow);
  log('2. Query the events/tickets table', colors.yellow);
  log('3. Extract the blockchain_pda field', colors.yellow);
  log('4. Pass it to the view script\n', colors.yellow);
  
  throw new Error('Database connection not implemented');
}

async function viewEventById(eventId: number) {
  log(`\n🔍 Looking up Event ID: ${eventId}...`, colors.cyan);
  
  try {
    // This is where you'd query your database
    // Example:
    // const event = await eventRepository.findOne({ where: { id: eventId } });
    // const pda = event.blockchainPda;
    
    log('📝 Querying database...', colors.blue);
    const result = await queryDatabase(
      `SELECT blockchain_pda, event_id FROM events WHERE id = ${eventId}`,
    );
    
    const pda = result.blockchain_pda;
    
    log(`✅ Found PDA: ${pda}`, colors.green);
    log('\n📊 Fetching blockchain data...\n', colors.cyan);
    
    // Call the blockchain viewer script
    const { stdout } = await execAsync(
      `npm run script:view ${pda} -- --all-tickets`,
    );
    
    console.log(stdout);
  } catch (error) {
    log(`\n❌ Error: ${error.message}`, colors.red);
    process.exit(1);
  }
}

async function viewTicketById(ticketId: number) {
  log(`\n🔍 Looking up Ticket ID: ${ticketId}...`, colors.cyan);
  
  try {
    log('📝 Querying database...', colors.blue);
    const result = await queryDatabase(
      `SELECT blockchain_pda, ticket_id FROM tickets WHERE id = ${ticketId}`,
    );
    
    const pda = result.blockchain_pda;
    
    log(`✅ Found PDA: ${pda}`, colors.green);
    log('\n📊 Fetching blockchain data...\n', colors.cyan);
    
    const { stdout } = await execAsync(`npm run script:view ${pda}`);
    
    console.log(stdout);
  } catch (error) {
    log(`\n❌ Error: ${error.message}`, colors.red);
    process.exit(1);
  }
}

async function viewEventResellStats(eventId: number) {
  log(`\n📊 Getting resell statistics for Event ID: ${eventId}...`, colors.cyan);
  
  try {
    log('📝 Querying database...', colors.blue);
    const result = await queryDatabase(
      `SELECT blockchain_pda FROM events WHERE id = ${eventId}`,
    );
    
    const pda = result.blockchain_pda;
    
    log('📊 Fetching all tickets from blockchain...\n', colors.cyan);
    
    const { stdout } = await execAsync(
      `npm run script:view ${pda} -- --all-tickets --no-logs`,
    );
    
    // Parse the output to extract resell statistics
    const lines = stdout.split('\n');
    let totalTickets = 0;
    let totalResells = 0;
    const resellCounts: { [key: number]: number } = {};
    
    for (const line of lines) {
      if (line.includes('Resell Count:')) {
        const match = line.match(/Resell Count:\s*(\d+)/);
        if (match) {
          const count = parseInt(match[1]);
          totalTickets++;
          totalResells += count;
          resellCounts[count] = (resellCounts[count] || 0) + 1;
        }
      }
    }
    
    console.log(stdout);
    
    log('\n📈 RESELL STATISTICS', colors.bright + colors.cyan);
    log('='.repeat(60), colors.cyan);
    log(`Total Tickets:          ${totalTickets}`, colors.cyan);
    log(`Total Resells:          ${totalResells}`, colors.cyan);
    log(
      `Average Resells/Ticket: ${totalTickets > 0 ? (totalResells / totalTickets).toFixed(2) : 0}`,
      colors.cyan,
    );
    log('\nResell Distribution:', colors.cyan);
    
    for (let i = 0; i <= 10; i++) {
      const count = resellCounts[i] || 0;
      if (count > 0) {
        const bar = '█'.repeat(Math.ceil((count / totalTickets) * 40));
        log(
          `  ${i} resells: ${count.toString().padStart(3)} tickets ${bar}`,
          colors.blue,
        );
      }
    }
    log('='.repeat(60), colors.cyan);
  } catch (error) {
    log(`\n❌ Error: ${error.message}`, colors.red);
    process.exit(1);
  }
}

function showHelp() {
  log('\n📚 Database-Integrated Blockchain Viewer', colors.bright + colors.cyan);
  log('='.repeat(60), colors.cyan);
  log('\nUsage:', colors.yellow);
  log('  npm run script:view-db event <EVENT_DB_ID>', colors.green);
  log('  npm run script:view-db ticket <TICKET_DB_ID>', colors.green);
  log('  npm run script:view-db stats <EVENT_DB_ID>', colors.green);
  log('\nExamples:', colors.yellow);
  log('  npm run script:view-db event 123', colors.blue);
  log('    → View blockchain info for event with database ID 123\n');
  log('  npm run script:view-db ticket 456', colors.blue);
  log('    → View blockchain info for ticket with database ID 456\n');
  log('  npm run script:view-db stats 123', colors.blue);
  log('    → View resell statistics for event 123\n');
  log('Note:', colors.yellow);
  log(
    '  This script requires database integration to be implemented.',
    colors.yellow,
  );
  log(
    '  See the script source for integration instructions.\n',
    colors.yellow,
  );
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    showHelp();
    process.exit(0);
  }
  
  const command = args[0];
  const id = parseInt(args[1]);
  
  if (!id || isNaN(id)) {
    log('\n❌ Error: Invalid ID. Must be a number.', colors.red);
    showHelp();
    process.exit(1);
  }
  
  switch (command) {
    case 'event':
      await viewEventById(id);
      break;
    case 'ticket':
      await viewTicketById(id);
      break;
    case 'stats':
      await viewEventResellStats(id);
      break;
    default:
      log(`\n❌ Error: Unknown command "${command}"`, colors.red);
      showHelp();
      process.exit(1);
  }
}

main().catch((error) => {
  log(`\n❌ Fatal error: ${error.message}`, colors.red);
  process.exit(1);
});
