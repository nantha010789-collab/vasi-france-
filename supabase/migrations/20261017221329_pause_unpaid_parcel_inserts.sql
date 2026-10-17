-- Parcel checkout is not yet implemented. Prevent bypassing the website's
-- booking guard through a direct Data API insert. Read/lifecycle access remains.
-- A future authenticated server checkout must create orders only after its
-- payment lifecycle and courier compensation are implemented and verified.
revoke insert on table public.delivery_orders from anon, authenticated;
