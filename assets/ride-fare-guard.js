// Shared by customer quotes and the booking API. No secrets or browser APIs.
globalThis.VasiRideFareGuard = function (fare, commissionPercent = 12, km = 0) {
  if (!Number.isFinite(fare) || fare < 0 || !Number.isFinite(km) || km < 0 ||
      !Number.isFinite(commissionPercent) || commissionPercent < 0 || commissionPercent > 50) {
    throw new RangeError('Invalid ride pricing');
  }
  const driverFloor = Math.max(900, Math.ceil(km * 101));
  let customerCents = Math.max(Math.round(fare * 100), Math.ceil(driverFloor / (1 - commissionPercent / 100)));
  while (customerCents - Math.round(customerCents * commissionPercent / 100) < driverFloor) customerCents++;
  return customerCents / 100;
};

// Builds a customer offer without reducing the protected driver amount.
// The discount is capped at VASI's gross commission, so VASI funds the offer.
globalThis.VasiFundedRideQuote = function (
  fare,
  commissionPercent = 12,
  km = 0,
  discountPercent = 0,
  maxDiscountEur = null,
) {
  if (!Number.isFinite(discountPercent) || discountPercent < 0 || discountPercent > 100 ||
      (maxDiscountEur !== null && (!Number.isFinite(maxDiscountEur) || maxDiscountEur < 0))) {
    throw new RangeError('Invalid funded ride offer');
  }
  const settlementCents = Math.round(
    globalThis.VasiRideFareGuard(fare, commissionPercent, km) * 100,
  );
  const grossCommissionCents = Math.round(
    settlementCents * commissionPercent / 100,
  );
  const requestedDiscountCents = Math.round(
    settlementCents * discountPercent / 100,
  );
  const discountCapCents = maxDiscountEur === null
    ? requestedDiscountCents
    : Math.round(maxDiscountEur * 100);
  const fundedDiscountCents = Math.max(0, Math.min(
    requestedDiscountCents,
    discountCapCents,
    grossCommissionCents,
  ));
  const driverCents = settlementCents - grossCommissionCents;
  const customerCents = settlementCents - fundedDiscountCents;
  const netCommissionCents = grossCommissionCents - fundedDiscountCents;
  return {
    settlement_fare: settlementCents / 100,
    customer_fare: customerCents / 100,
    customer_discount: fundedDiscountCents / 100,
    platform_funded_discount: fundedDiscountCents / 100,
    gross_vasi_commission: grossCommissionCents / 100,
    vasi_commission: netCommissionCents / 100,
    driver_amount: driverCents / 100,
  };
};
