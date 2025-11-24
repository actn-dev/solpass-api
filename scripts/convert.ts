// const { Keypair } = require('@solana/web3.js');
import { Keypair } from '@solana/web3.js';

const secretKeyBase64 = Buffer.from(
  '2gnxPqGKJs9Q1m9sfRohxn2B1BZegGmhW6YiqchTx8LqwKGesnS3a4oShVtx2GSyqSzGNMSVTAYkcSxy8rUyJtAj',
).toString('base64');

console.log('Secret Key (base64):', secretKeyBase64);

const keypair = Keypair.generate();
