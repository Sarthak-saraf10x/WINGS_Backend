// Indian Currency Number to Words converter
function numberToWords(num) {
  if (num === 0) return 'Rupees Zero Only';
  if (!num || isNaN(num)) return '';

  const a = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
    'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'
  ];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function convertTwoDigits(n) {
    if (n < 20) return a[n];
    const tens = b[Math.floor(n / 10)];
    const units = a[n % 10];
    return units ? `${tens} ${units}` : tens;
  }

  function convertThreeDigits(n) {
    let str = '';
    if (Math.floor(n / 100) > 0) {
      str += `${a[Math.floor(n / 100)]} Hundred `;
      n %= 100;
    }
    if (n > 0) {
      str += convertTwoDigits(n);
    }
    return str.trim();
  }

  let n = Math.floor(Math.abs(num));
  let words = '';

  const crore = Math.floor(n / 10000000);
  n %= 10000000;
  const lakh = Math.floor(n / 100000);
  n %= 100000;
  const thousand = Math.floor(n / 1000);
  n %= 1000;

  if (crore > 0) words += `${convertTwoDigits(crore)} Crore `;
  if (lakh > 0) words += `${convertTwoDigits(lakh)} Lakh `;
  if (thousand > 0) words += `${convertTwoDigits(thousand)} Thousand `;
  if (n > 0) words += `${convertThreeDigits(n)} `;

  return `Rupees ${words.trim()} Only`;
}

// Compute billable extra hours based on rounding rule
function computeBillableExtraHours(rawExtraHours, rule) {
  if (rawExtraHours <= 0) return 0;
  switch (rule) {
    case 'EXACT':
      return Math.round(rawExtraHours * 100) / 100;
    case 'ROUND_30_MIN':
      return Math.ceil(rawExtraHours * 2) / 2;
    case 'ROUND_60_MIN':
    default:
      return Math.ceil(rawExtraHours);
  }
}

// Normalize state code (e.g., '27-MH' -> '27', 'MH' -> '27')
function normalizeStateCode(code) {
  if (!code) return '';
  const match = String(code).match(/\d+/);
  return match ? match[0] : String(code).trim().toUpperCase();
}

/**
 * Calculate full invoice line items, tax, and totals
 */
function calculateInvoiceForBooking(booking, company = {}, brokerProfile = {}) {
  const readings = booking.dutyCloseReadings || {};
  const totalKms = Number(readings.totalKms || 0);
  const totalHours = Number(readings.totalHours || 0);
  const totalDays = Number(readings.totalDays || 1);
  const sacCode = brokerProfile.sacCode || '996601';

  // Find rate card for vehicle category & package
  const rateCards = company.rateCards || [];
  let matchedCard = rateCards.find(rc =>
    rc.vehicleCategory.toLowerCase() === (booking.vehicleType || '').toLowerCase() &&
    rc.packageName.toLowerCase() === (booking.packageType || '').toLowerCase()
  );

  // Partial/fallback match
  if (!matchedCard) {
    matchedCard = rateCards.find(rc =>
      rc.vehicleCategory.toLowerCase().includes((booking.vehicleType || '').toLowerCase().split(' ')[0]) ||
      (booking.vehicleType || '').toLowerCase().includes(rc.vehicleCategory.toLowerCase().split(' ')[0])
    ) || rateCards[0];
  }

  const baseHours = matchedCard ? Number(matchedCard.baseHours || 8) : 8;
  const baseKms = matchedCard ? Number(matchedCard.baseKms || 80) : 80;
  const basePackageRate = matchedCard ? Number(matchedCard.basePackageRate || 2200) : 2200;
  const extraKmRate = matchedCard ? Number(matchedCard.extraKmRate || 18) : 18;
  const extraHourRate = matchedCard ? Number(matchedCard.extraHourRate || 200) : 200;
  const cardDriverAllowance = matchedCard ? Number(matchedCard.driverDayAllowance || 300) : 300;
  const cardNightAllowance = matchedCard ? Number(matchedCard.nightLateAllowance || 250) : 250;

  const lineItems = [];

  // 1. Base Package
  const pkgDesc = `Package: ${booking.vehicleType || 'Vehicle'} (${booking.packageType || '8 Hrs / 80 Km'})`;
  lineItems.push({
    description: pkgDesc,
    hsn: sacCode,
    qty: 1,
    rate: basePackageRate,
    amount: basePackageRate
  });

  // 2. Extra KMs
  const extraKms = Math.max(0, totalKms - baseKms);
  if (extraKms > 0) {
    const extraKmAmount = extraKms * extraKmRate;
    lineItems.push({
      description: `Extra KMs: ${extraKms} Km @ ₹${extraKmRate.toFixed(2)}/km`,
      hsn: sacCode,
      qty: extraKms,
      rate: extraKmRate,
      amount: extraKmAmount
    });
  }

  // 3. Extra Hours
  const rawExtraHours = Math.max(0, totalHours - baseHours);
  const roundingRule = company.extraHourRoundingRule || 'ROUND_60_MIN';
  const billableExtraHours = computeBillableExtraHours(rawExtraHours, roundingRule);
  if (billableExtraHours > 0) {
    const extraHourAmount = billableExtraHours * extraHourRate;
    const ruleLabel = roundingRule === 'ROUND_60_MIN' ? 'Round 60M' : roundingRule === 'ROUND_30_MIN' ? 'Round 30M' : 'Exact';
    lineItems.push({
      description: `Extra Hours: ${billableExtraHours} Hr (${ruleLabel}) @ ₹${extraHourRate.toFixed(2)}/hr`,
      hsn: sacCode,
      qty: billableExtraHours,
      rate: extraHourRate,
      amount: extraHourAmount
    });
  }

  // 4. Driver Day Allowance
  const enteredAllowance = Number(readings.driverAllowance);
  const driverAllowanceRate = !isNaN(enteredAllowance) && enteredAllowance > 0 ? enteredAllowance : cardDriverAllowance;
  if (driverAllowanceRate > 0) {
    const allowanceTotal = driverAllowanceRate * totalDays;
    lineItems.push({
      description: `Driver Day Allowance (${totalDays} day${totalDays > 1 ? 's' : ''})`,
      hsn: sacCode,
      qty: totalDays,
      rate: driverAllowanceRate,
      amount: allowanceTotal
    });
  }

  // 5. Late Night Charges
  const enteredNight = Number(readings.lateNightCharges);
  const nightTotal = !isNaN(enteredNight) && enteredNight > 0 ? enteredNight : (readings.totalNights ? readings.totalNights * cardNightAllowance : 0);
  if (nightTotal > 0) {
    lineItems.push({
      description: 'Night / Late Night Allowance Charges',
      hsn: sacCode,
      qty: 1,
      rate: nightTotal,
      amount: nightTotal
    });
  }

  // 6. Permit / State Charges
  const permitCharges = Number(readings.permitCharges || 0);
  if (permitCharges > 0) {
    lineItems.push({
      description: 'Border Permit & State Toll Entry Charges',
      hsn: sacCode,
      qty: 1,
      rate: permitCharges,
      amount: permitCharges
    });
  }

  // 7. Fuel Surcharge
  let fuelSurchargeAmount = Number(readings.fuelSurcharge || 0);
  if (fuelSurchargeAmount === 0 && company.fuelSurchargeRule) {
    if (company.fuelSurchargeRule.ruleType === 'PERCENTAGE_OF_BASE') {
      fuelSurchargeAmount = (basePackageRate * (company.fuelSurchargeRule.value || 0)) / 100;
    } else if (company.fuelSurchargeRule.ruleType === 'PER_KM') {
      fuelSurchargeAmount = totalKms * (company.fuelSurchargeRule.value || 0);
    }
  }
  if (fuelSurchargeAmount > 0) {
    lineItems.push({
      description: 'Fuel Price Surcharge',
      hsn: sacCode,
      qty: 1,
      rate: Math.round(fuelSurchargeAmount * 100) / 100,
      amount: Math.round(fuelSurchargeAmount * 100) / 100
    });
  }

  // 8. Toll & Parking (Taxable check)
  const tollCharges = Number(readings.tollCharges || 0);
  const parkingCharges = Number(readings.parkingCharges || 0);
  const totalTollParking = tollCharges + parkingCharges;

  let tollParkingNonTaxable = 0;
  if (totalTollParking > 0) {
    if (company.tollParkingTaxable) {
      lineItems.push({
        description: `Toll & Parking Charges (Taxable)`,
        hsn: sacCode,
        qty: 1,
        rate: totalTollParking,
        amount: totalTollParking
      });
    } else {
      tollParkingNonTaxable = totalTollParking;
    }
  }

  // Calculate Taxable Subtotal
  const taxableAmount = lineItems.reduce((acc, item) => acc + item.amount, 0);

  // Same state (CGST+SGST) vs Inter-State (IGST)
  const brokerState = normalizeStateCode(brokerProfile.stateCode || '27-MH');
  const clientState = normalizeStateCode(company.stateCode || '27-MH');
  const isSameState = !brokerState || !clientState || brokerState === clientState;

  const gstRate = Number(company.gstRate !== undefined ? company.gstRate : 5.0);
  let cgstRate = 0, cgstAmount = 0;
  let sgstRate = 0, sgstAmount = 0;
  let igstRate = 0, igstAmount = 0;

  if (isSameState) {
    cgstRate = gstRate / 2;
    sgstRate = gstRate / 2;
    cgstAmount = Math.round((taxableAmount * (cgstRate / 100)) * 100) / 100;
    sgstAmount = Math.round((taxableAmount * (sgstRate / 100)) * 100) / 100;
  } else {
    igstRate = gstRate;
    igstAmount = Math.round((taxableAmount * (igstRate / 100)) * 100) / 100;
  }

  const rawGrandTotal = taxableAmount + cgstAmount + sgstAmount + igstAmount + tollParkingNonTaxable;
  const grandTotal = Math.round(rawGrandTotal); // Round to nearest rupee

  const creditDays = Number(company.creditPeriodDays || 30);
  const invoiceDate = new Date();
  const dueDate = new Date(invoiceDate.getTime() + creditDays * 24 * 60 * 60 * 1000);

  return {
    invoiceNo: String(booking.dutySlipNo || booking.bookingNo),
    invoiceDate,
    dueDate,
    lineItems,
    taxableAmount: Math.round(taxableAmount * 100) / 100,
    isSameState,
    cgstRate,
    cgstAmount,
    sgstRate,
    sgstAmount,
    igstRate,
    igstAmount,
    tollParkingNonTaxable,
    grandTotal,
    amountInWords: numberToWords(grandTotal)
  };
}

module.exports = {
  numberToWords,
  computeBillableExtraHours,
  calculateInvoiceForBooking
};
