# Workspace UX checkpoint — October 12, 2026

Baseline: origin/fix/batch-13-frontend-stabilization at 3c7d956.

## Implemented

- Shared staff navigation has consistent line icons, WashEase branding, readable labels and account controls. All nine staff areas keep their existing routes.
- Overview uses current orders and actual rider availability. Counts cover every booking date; they are not falsely labelled today's activity.
- Work queue links explain the next action. Search filters this queue only. Mutations still occur through the existing order/delivery forms.
- Visible overview checks orders/riders every 15 seconds and resumes when online or visible. Failed refresh retains data with an explicit stale-data message. Requests time out and cleanup aborts them.
- Deliveries summarizes ready-to-schedule orders, planned runs, started runs and completed runs awaiting return. The existing scheduler and assignment controls remain responsible for actions.
- Customer Home highlights an active order and uses a text-labelled vertical progress timeline. Requested delivery is clearly distinguished from a confirmed promise. Existing booking drafts, account management, notifications and bottom navigation remain.
- Staff pages use a shared navy/blue/slate palette. The existing business rules, database, endpoints and dependencies remain unchanged.

## Local acceptance checks

1. Staff: open Overview on desktop and phone. Check menu, account, queue search, refresh and all sidebar links. Confirm each order action opens the correct record or workspace. Confirm the rider's status matches Riders/Deliveries.
2. Customer: check Home/Book/Orders/Account. Create a booking; inspect requested times and preference. Verify the progress timeline after a staff update. Switching sections must preserve unfinished booking fields. Test an account with no active orders.
3. Regression: process a weighed order; schedule equal-time orders to verify heavier load comes first; assign/depart/deliver/confirm return/reuse rider; record payment while preserving booking preference. Temporarily disconnect the browser network and confirm refresh errors do not present empty data as success.

Run frontend lint, TypeScript and production build, and the existing backend feature suite before the local commit. Do not submit fictional bookings or payments as field-evaluation results.

## Defense evidence still required

- Preserve signed consent/certificate and notes from the initial client visit. Jac's account says this was an interview and demonstration, not client hands-on testing.
- Obtain hands-on observations (task, completion, assistance, errors, time) and evaluation responses using the instrument approved for this study.
- Validate zone/time/load rules with delivery operators and document a baseline/comparison if claiming the proposal's >=20% reduction in missed delivery slots. Algorithm ordering tests alone do not prove that business outcome.
- Confirm what the reported PHP50 fee covers and the receipt/job-order fields before adding new business behavior.
- Reconcile the manuscript's stated deployment and quality-evaluation method with actual implementation and adviser-approved changes.
- Verify restore from the SQL backup, client access and demo startup/recovery instructions. Document that local hosting depends on laptop/network/tunnel availability and offline booking synchronization is not implemented.
- Capture screenshots of the actual final version, complete Chapter 4 with collected evidence, and base Chapter 5 conclusions on those results.

The concept image is a design reference, not evidence of completed functionality or compliance. This checkpoint moves the real interface toward that direction; it is not a claim that the full system is defense-ready.
