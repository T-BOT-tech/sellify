# SC-03.5 — Customer Service Appointment Journey

**Status:** Implementation candidate on `feat/sc03-service-customer-appointment-journey`  
**Authority:** Existing Service Booking + Service Resource authorities  
**Channel adapter in this increment:** Telegram buyer storefront

## Why Telegram first

The repository already has a verified Telegram buyer identity boundary, seller-owned storefront capability configuration, buyer order history, and buyer fulfillment tracking. The general marketplace order tracking token is intentionally not a substitute for authenticated buyer identity. This increment composes the existing verified Telegram buyer context rather than inventing a new customer identity or tenant membership role.

The Service Booking record remains linked to the canonical seller order. The customer-facing journey is channel-specific UI over that shared Service contract; other customer channels can add their own identity adapters later.

## Customer journey

1. The buyer opens **My orders** in the published Telegram storefront.
2. If the seller has enabled `service_appointments`, the buyer sees service lines and existing appointment requests for seller orders they own.
3. The buyer selects a service line and enters a start/end interval in the seller organization's IANA timezone.
4. The buyer may request a feasibility assessment. It checks active matching Service Resources, declared working hours/date exceptions, and current ACTIVE resource commitments.
5. Assessment returns `FEASIBLE`, `UNAVAILABLE`, or `UNKNOWN`. It never returns a resource identity, reserves a slot, authorizes the booking, or confirms availability.
6. The buyer submits an idempotent appointment request. The canonical Service Booking is created in `REQUESTED` state and remains pending seller review.
7. Manager/Owner accepts and confirms through the existing Service Booking workspace. Confirmation rechecks resource eligibility, declared hours, and interval conflicts atomically under SC-03.4.
8. The buyer sees the current booking status in My orders and may cancel an eligible `REQUESTED`, `ACCEPTED`, or `CONFIRMED` booking. Cancellation is buyer-ownership checked and idempotent; if already confirmed, it releases the Service Resource commitment through the existing lifecycle.

## Security and ownership

- Every request verifies Telegram Mini App `initData` with the seller's configured credential provider.
- The buyer must own the exact Marketplace Order, the seller must match the route's tenant, and the supplied seller order must belong to that Marketplace Order.
- The service item must be a service line on the canonical seller order; physical product lines are rejected.
- Buyer ownership is rechecked inside the Service Booking transaction before create/cancel.
- No customer membership role, provider identity, resource assignment, or resource ID is created/exposed.
- Buyer audit evidence stores a one-way buyer identity hash, not the raw Telegram identity.
- The `service_appointments` capability automatically depends on `order_status`; disabling it hides service-line request controls and blocks new assessment/request commands, while existing appointment history and buyer cancellation remain available.

## State semantics

- **Loading:** order history or assessment is being fetched.
- **Ready / FEASIBLE:** a current declared-hours + commitment projection matches. This is not a reservation or confirmation.
- **UNAVAILABLE:** no known active resource currently matches; the buyer may still send a request for seller review.
- **UNKNOWN:** resources/schedules are insufficient or cannot be evaluated; a request remains pending, never reported as available.
- **Empty:** no service appointment requests exist for the seller order.
- **Offline / failed:** the command was not confirmed sent; the UI explicitly says it was not sent and does not queue a fake offline booking.
- **Stale:** no cached state is presented as a fresh server confirmation; the buyer can refresh My orders.

## Boundaries

- No duplicate Commerce order or Marketplace order authority.
- No Payment, Inventory, Fulfillment, or Logistics mutation.
- No Logistics Scheduling activity or dispatcher role expansion.
- No customer-side resource selection or resource commitment.
- No generic reservation/calendar authority.
- No assumption that a feasibility assessment authorizes or commits an appointment.

## Regression coverage

TG-11 covers verified buyer request/assessment/history/cancellation, idempotent replay, order ownership, service-line validation, resource commitment visibility/release, capability gating, privacy of resource IDs and buyer identity, and unchanged Logistics fulfillment state. TG-1 and TG-7 cover capability dependency and buyer history projection. CI runs these tests on Node >=24.
