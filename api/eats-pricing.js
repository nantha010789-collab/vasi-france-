const roundMoney = (value) => Number(Number(value).toFixed(2));

export const VASI_COURIER_RATES = Object.freeze({
  pickup: 1.5,
  perKm: 0.75,
  perMinute: 0.2,
  minimum: 4,
  guaranteedHourly: 20,
  pickupMinutes: 8,
});

export function calculateEatsPricing({
  subtotal,
  commissionRate = 0.1,
  deliveryMode = "vasi",
  distanceKm = 0,
  routeMinutes = 0,
  restaurantDeliveryFee = 2.99,
}) {
  const foodSubtotal = Math.max(0, Number(subtotal) || 0);
  const rate = Math.min(1, Math.max(0, Number(commissionRate) || 0));
  const serviceFee = roundMoney(Math.max(0.99, foodSubtotal * 0.05));
  const restaurantCommission = roundMoney(foodSubtotal * rate);

  if (deliveryMode === "own") {
    const deliveryFee = roundMoney(Math.max(0, Number(restaurantDeliveryFee) || 0));
    return {
      serviceFee,
      deliveryFee,
      courierOfferAmount: 0,
      estimatedDeliveryMinutes: 0,
      distanceKm: 0,
      restaurantCommission,
      total: roundMoney(foodSubtotal + deliveryFee + serviceFee),
    };
  }

  const km = Math.max(0, Number(distanceKm) || 0);
  const activeMinutes = Math.max(
    VASI_COURIER_RATES.pickupMinutes,
    Math.ceil((Number(routeMinutes) || 0) + VASI_COURIER_RATES.pickupMinutes),
  );
  const distanceTimePay =
    VASI_COURIER_RATES.pickup +
    km * VASI_COURIER_RATES.perKm +
    activeMinutes * VASI_COURIER_RATES.perMinute;
  const hourlyProtection =
    (activeMinutes / 60) * VASI_COURIER_RATES.guaranteedHourly;
  const courierOfferAmount = roundMoney(
    Math.max(VASI_COURIER_RATES.minimum, distanceTimePay, hourlyProtection),
  );
  const configuredMinimum = Math.max(0, Number(restaurantDeliveryFee) || 0);
  const deliveryFee = roundMoney(
    Math.max(configuredMinimum, courierOfferAmount - restaurantCommission),
  );

  return {
    serviceFee,
    deliveryFee,
    courierOfferAmount,
    estimatedDeliveryMinutes: activeMinutes,
    distanceKm: Number(km.toFixed(2)),
    restaurantCommission,
    total: roundMoney(foodSubtotal + deliveryFee + serviceFee),
  };
}
