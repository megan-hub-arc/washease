# Remaining staff pages: UI review

Batch 33 extends the blue and white reference style across Orders, Deliveries,
Customers, Riders, Payments, Reports, Zones and Settings. It adds a shared page
heading, keeps the next workspace link, removes duplicate introductions, uses
blue primary actions, improves pale secondary text, enlarges staff control touch
targets, and adds table column headers for assistive technology. Rider creation
is collapsed until requested; editing opens the contact form.

This is a visual consistency and hierarchy pass. It does not establish complete
reference parity, full accessibility conformance or operational readiness.
It introduces no business fees, receipt fields or scheduling rule changes.

## Review on the installed system

1. Desktop: open all eight pages. Confirm the title, instructions and next-area
   link appear once. Check filters, forms, lists and empty states remain usable.
2. Riders: expand Add a rider. Open Edit contact from an existing rider, confirm
   the form expands, then cancel without saving. Verify duty filters still work.
3. Phone and keyboard: open navigation, use filters, scroll wide tables within
   their container, Tab through controls and check the visible focus outline.
   Check long customer names and validation/success messages.

## Technical verification

Assistant checks: ESLint, TypeScript and Next production build passed. The local
installed Next binary reports 16.3.5 while the repository pins 16.3.8; verify the
build with the user's pinned installation as well. No dependencies were changed.
Browser rendering and real backend workflows were not tested for this batch in
this environment. User review remains required before accepting the UI changes.
