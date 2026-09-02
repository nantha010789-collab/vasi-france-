# VASI Production Completion Checklist

This checklist tracks the final production-readiness pass for the unified VASI app.

## Ride
- [ ] Rider login and session restore
- [ ] Pickup and destination validation
- [ ] Route distance/duration pricing
- [ ] Ride creation in production Supabase
- [ ] Driver offer/accept flow
- [ ] Rider live driver ETA/GPS
- [ ] Trip start/complete lifecycle
- [ ] Rider cancellation and cancellation fee handling
- [ ] Card authorization/capture lifecycle
- [ ] Rider receipt and trip history

## Driver
- [ ] Partner registration and driver profile creation
- [ ] Approval status synchronization
- [ ] Online/offline state
- [ ] Ride offer reception
- [ ] Accept/decline flow
- [ ] Pickup navigation state
- [ ] Start/complete trip actions
- [ ] Stripe onboarding/payout readiness

## Delivery
- [ ] Pickup/drop-off validation
- [ ] Real route distance/duration pricing
- [ ] Delivery order creation API
- [ ] Delivery driver assignment
- [ ] Delivery status lifecycle
- [ ] Customer live status and completion

## Eats
- [ ] Restaurant/menu browsing
- [ ] Cart state
- [ ] Checkout validation
- [ ] Order creation
- [ ] Payment flow
- [ ] Order status tracking
- [ ] Delivery-driver handoff

## Authentication
- [ ] Rider role redirect
- [ ] Driver role redirect
- [ ] Admin login isolation
- [ ] Session expiry/recovery
- [ ] Logout flow

## Admin
- [ ] Dashboard loads with production data
- [ ] Driver approval workflow
- [ ] Booking/order visibility
- [ ] Document review
- [ ] Live GPS view
- [ ] Operational stats

## Production safety
- [ ] No exposed secrets in client code
- [ ] Server APIs validate authenticated users and allowed transitions
- [ ] Payment APIs are idempotent where required
- [ ] Production routes return expected pages
- [ ] No runtime errors in Vercel logs
- [ ] Smoke test production URL after merge

## Release rule
VASI is marked complete only after every critical Ride, Driver, Delivery, Eats, Auth, Payment and Admin path passes an end-to-end production smoke test.
