/**
 * amount-words.js — Convert numbers to Indian English words
 *
 * Handles edge cases:
 * - 0 → "Zero Rupees Only"
 * - Decimals → "... and Fifty Paise"
 * - Negative → treated as 0
 * - NaN/undefined → "Zero Rupees Only"
 * - Very large numbers up to 99,99,99,99,999 (99 arab)
 */

const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
  'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen',
  'Eighteen', 'Nineteen'];

const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function twoDigitWords(n) {
  if (n < 0 || n > 99 || !Number.isFinite(n)) return '';
  n = Math.floor(n);
  if (n < 20) return ones[n];
  const t = Math.floor(n / 10);
  const o = n % 10;
  return tens[t] + (o ? ' ' + ones[o] : '');
}

function threeDigitWords(n) {
  if (n < 0 || n > 999 || !Number.isFinite(n)) return '';
  n = Math.floor(n);
  if (n < 100) return twoDigitWords(n);
  const h = Math.floor(n / 100);
  const rem = n % 100;
  return ones[h] + ' Hundred' + (rem ? ' ' + twoDigitWords(rem) : '');
}

/**
 * Convert an amount (in INR) to words using Indian number system.
 * Indian system: Units, Thousands, Lakhs, Crores, Arab
 */
export function amountToWords(amount) {
  // Safely parse
  if (amount === null || amount === undefined || amount === '') return 'Zero Rupees Only';
  let num = Number(amount);
  if (!isFinite(num) || num < 0) return 'Zero Rupees Only';
  
  // Round to 2 decimal places
  num = Math.round(num * 100) / 100;
  
  if (num === 0) return 'Zero Rupees Only';
  
  // Split into integer and decimal parts
  const intPart = Math.floor(num);
  const decPart = Math.round((num - intPart) * 100);
  
  let words = '';
  
  if (intPart === 0) {
    words = 'Zero';
  } else {
    words = integerToIndianWords(intPart);
  }
  
  let result = words + ' Rupee' + (intPart === 1 ? '' : 's');
  
  if (decPart > 0) {
    result += ' and ' + twoDigitWords(decPart) + ' Pais' + (decPart === 1 ? 'a' : 'e');
  } else {
    result += ' Only';
  }
  
  return result;
}

function integerToIndianWords(n) {
  if (n <= 0) return '';
  if (n > 9999999999) {
    // Beyond our range — just return the number as-is
    return String(n);
  }
  
  n = Math.floor(n);
  
  const parts = [];
  
  // Crores (1,00,00,000+)
  if (n >= 10000000) {
    const crores = Math.floor(n / 10000000);
    parts.push(threeDigitWords(crores) + ' Crore');
    n %= 10000000;
  }
  
  // Lakhs (1,00,000 – 99,99,999)
  if (n >= 100000) {
    const lakhs = Math.floor(n / 100000);
    parts.push(twoDigitWords(lakhs) + ' Lakh');
    n %= 100000;
  }
  
  // Thousands (1,000 – 99,999)
  if (n >= 1000) {
    const thousands = Math.floor(n / 1000);
    parts.push(twoDigitWords(thousands) + ' Thousand');
    n %= 1000;
  }
  
  // Hundreds and below
  if (n > 0) {
    parts.push(threeDigitWords(n));
  }
  
  return parts.join(' ');
}

export default amountToWords;
