// Shared by customer quotes and the booking API. No secrets or browser APIs.
globalThis.VasiRideFareGuard = function (fare, commissionPercent = 12, km = 0) {
  if (!Number.isFinite(fare) || fare < 0 || !Number.isFinite(km) || km < 0 ||
      !Number.isFinite(commissionPercent) || commissionPercent < 0 || commissionPercent > 50) {
    throw new RangeError('Invalid ride pricing');
  }
  const driverFloor = Math.max(900, Math.ceil(km * 100));
  let customerCents = Math.max(Math.round(fare * 100), Math.ceil(driverFloor / (1 - commissionPercent / 100)));
  while (customerCents - Math.round(customerCents * commissionPercent / 100) < driverFloor) customerCents++;
  return customerCents / 100;
};
