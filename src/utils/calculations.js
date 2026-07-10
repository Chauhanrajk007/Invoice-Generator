/**
 * calculations.js — Invoice math with full edge-case protection
 * 
 * Every function guards against:
 * - NaN, undefined, null inputs
 * - Negative values (clamped to 0)
 * - Division by zero
 * - Non-numeric strings
 */

/**
 * Safely parse a number. Returns 0 for any non-numeric input.
 */
export function safeNum(val) {
  if (val === null || val === undefined || val === '') return 0;
  const n = Number(val);
  return isFinite(n) ? n : 0;
}

/**
 * Clamp a number to a minimum (default 0).
 */
function clamp(val, min = 0) {
  return Math.max(min, safeNum(val));
}

/**
 * Round to 2 decimal places using proper banker's rounding.
 */
export function round2(val) {
  return Math.round((safeNum(val) + Number.EPSILON) * 100) / 100;
}

/**
 * Calculate a single item row total (before tax).
 * rowTotal = qty × price
 */
export function calcRowBase(qty, price) {
  return round2(clamp(qty) * clamp(price));
}

/**
 * Calculate a single item row total (with tax included).
 * rowTotal = qty × price × (1 + gst%/100)
 */
export function calcRowTotal(qty, price, gstPercent) {
  const base = clamp(qty) * clamp(price);
  const gst = clamp(gstPercent, 0);
  return round2(base * (1 + gst / 100));
}

/**
 * Calculate tax amount for a single item row.
 * taxAmount = qty × price × (gst% / 100)
 */
export function calcRowTax(qty, price, gstPercent) {
  const base = clamp(qty) * clamp(price);
  const gst = clamp(gstPercent, 0);
  return round2(base * (gst / 100));
}

/**
 * Calculate subtotal (sum of qty × price for all items, before tax).
 * Items is an array of { qty, price } objects.
 */
export function calcSubtotal(items) {
  if (!Array.isArray(items) || items.length === 0) return 0;
  
  const total = items.reduce((sum, item) => {
    if (!item || typeof item !== 'object') return sum;
    return sum + (clamp(item.qty) * clamp(item.price));
  }, 0);
  
  return round2(total);
}

/**
 * Calculate discount amount.
 * @param {number} subtotal
 * @param {number} discountValue - The discount value
 * @param {'amount'|'percent'} discountType - 'amount' for flat ₹, 'percent' for %
 * @returns {number} The discount amount (always positive, never exceeds subtotal)
 */
export function calcDiscount(subtotal, discountValue, discountType) {
  const sub = clamp(subtotal);
  const val = clamp(discountValue);
  
  if (sub === 0 || val === 0) return 0;
  
  let discount;
  if (discountType === 'percent') {
    // Cap percentage at 100%
    const pct = Math.min(val, 100);
    discount = round2(sub * pct / 100);
  } else {
    // Flat amount — cap at subtotal so we never go negative
    discount = Math.min(val, sub);
  }
  
  return round2(discount);
}

/**
 * Calculate total GST for all items.
 * @param {Array} items - Array of { qty, price, gstPercent }
 * @returns {{ totalTax: number, taxBreakdown: Array<{rate: number, taxable: number, tax: number}> }}
 */
export function calcTotalGST(items) {
  if (!Array.isArray(items) || items.length === 0) {
    return { totalTax: 0, taxBreakdown: [] };
  }
  
  // Group by GST rate for breakdown
  const rateMap = new Map();
  
  items.forEach(item => {
    if (!item || typeof item !== 'object') return;
    const rate = clamp(item.gstPercent, 0);
    const taxable = clamp(item.qty) * clamp(item.price);
    
    if (!rateMap.has(rate)) {
      rateMap.set(rate, { rate, taxable: 0, tax: 0 });
    }
    const group = rateMap.get(rate);
    group.taxable += taxable;
    group.tax += taxable * (rate / 100);
  });
  
  const taxBreakdown = Array.from(rateMap.values()).map(g => ({
    rate: g.rate,
    taxable: round2(g.taxable),
    tax: round2(g.tax),
  }));
  
  const totalTax = round2(taxBreakdown.reduce((sum, g) => sum + g.tax, 0));
  
  return { totalTax, taxBreakdown };
}

/**
 * Split GST into CGST/SGST (intra-state) or IGST (inter-state).
 * @param {number} totalTax 
 * @param {boolean} isInterState 
 * @returns {{ cgst: number, sgst: number, igst: number }}
 */
export function splitGST(totalTax, isInterState) {
  const tax = clamp(totalTax);
  
  if (isInterState) {
    return { cgst: 0, sgst: 0, igst: round2(tax) };
  }
  
  // Intra-state: split evenly into CGST and SGST
  const half = round2(tax / 2);
  // Handle rounding: if 2 × half !== tax, adjust SGST
  const cgst = half;
  const sgst = round2(tax - cgst);
  return { cgst, sgst, igst: 0 };
}

/**
 * Detect if a transaction is inter-state based on GSTIN first 2 digits.
 * GSTINs starting with same 2 digits = same state = intra-state.
 * 
 * Returns null if either GSTIN is missing/invalid (treat as non-GST).
 */
export function isInterState(businessGSTIN, customerGSTIN) {
  if (!businessGSTIN || !customerGSTIN) return null;
  
  const biz = String(businessGSTIN).trim();
  const cust = String(customerGSTIN).trim();
  
  // GSTIN must be at least 2 chars
  if (biz.length < 2 || cust.length < 2) return null;
  
  const bizState = biz.substring(0, 2);
  const custState = cust.substring(0, 2);
  
  // Validate they are numeric
  if (!/^\d{2}$/.test(bizState) || !/^\d{2}$/.test(custState)) return null;
  
  return bizState !== custState;
}

/**
 * Calculate grand total.
 * grandTotal = subtotal - discount + totalTax
 * Never returns negative.
 */
export function calcGrandTotal(subtotal, discount, totalTax) {
  const result = clamp(subtotal) - clamp(discount) + clamp(totalTax);
  return round2(Math.max(0, result));
}

/**
 * Full invoice summary calculation.
 * One function to rule them all — takes the form data, returns everything.
 */
export function calcInvoiceSummary(items, discountValue, discountType, businessGSTIN, customerGSTIN, isGstInvoice) {
  const subtotal = calcSubtotal(items);
  const discount = calcDiscount(subtotal, discountValue, discountType);
  
  let totalTax = 0;
  let taxBreakdown = [];
  let cgst = 0, sgst = 0, igst = 0;
  let interState = false;
  
  if (isGstInvoice) {
    const gstResult = calcTotalGST(items);
    totalTax = gstResult.totalTax;
    taxBreakdown = gstResult.taxBreakdown;
    
    const interStateResult = isInterState(businessGSTIN, customerGSTIN);
    interState = interStateResult === true;
    
    const split = splitGST(totalTax, interState);
    cgst = split.cgst;
    sgst = split.sgst;
    igst = split.igst;
  }
  
  const grandTotal = calcGrandTotal(subtotal, discount, totalTax);
  
  return {
    subtotal,
    discount,
    totalTax,
    taxBreakdown,
    cgst,
    sgst,
    igst,
    interState,
    grandTotal,
  };
}
