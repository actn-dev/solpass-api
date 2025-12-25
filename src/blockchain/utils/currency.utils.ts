/**
 * Currency conversion utilities for USD ↔ Micro-USDC
 * 
 * USDC on Solana uses 6 decimals of precision:
 * - 1 USDC = 1,000,000 micro-USDC
 * - $100.00 = 100,000,000 micro-USDC
 */

export const USDC_DECIMALS = 6;
export const USDC_MULTIPLIER = Math.pow(10, USDC_DECIMALS); // 1,000,000

/**
 * Convert USD amount to micro-USDC (for blockchain)
 * @param usdAmount - Amount in USD (e.g., 100.50)
 * @returns Amount in micro-USDC (e.g., 100500000)
 */
export function usdToMicroUsdc(usdAmount: number): number {
  return Math.round(usdAmount * USDC_MULTIPLIER);
}

/**
 * Convert micro-USDC to USD amount (from blockchain)
 * @param microUsdc - Amount in micro-USDC (e.g., 100500000)
 * @returns Amount in USD (e.g., 100.50)
 */
export function microUsdcToUsd(microUsdc: number): number {
  return microUsdc / USDC_MULTIPLIER;
}

/**
 * Format USD amount for display
 * @param usdAmount - Amount in USD
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted string (e.g., "100.50")
 */
export function formatUsd(usdAmount: number, decimals: number = 2): string {
  return usdAmount.toFixed(decimals);
}

/**
 * Validate USD amount
 * @param usdAmount - Amount to validate
 * @returns true if valid, false otherwise
 */
export function isValidUsdAmount(usdAmount: number): boolean {
  return (
    typeof usdAmount === 'number' &&
    !isNaN(usdAmount) &&
    isFinite(usdAmount) &&
    usdAmount >= 0
  );
}
