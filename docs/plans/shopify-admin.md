# Shopify-inspired Jelly Shops admin

Approved scope: redesign the entire existing merchant admin using Shopify as the only external reference, keeping Jelly branding, existing commerce behavior and storefront styling. Add supported organization fields, manual collections and concurrency-safe stock management. No production deployment or automatic cleanup.

## Delivery groups
1. Admin shell, navigation/search/mobile drawer, scoped tokens and shared components; product editor with visible description, compact photo details, preview drawer, organization, explicit stock tracking, unified create/edit/digital/archive routes; collections and inventory API/UI.
2. Orders and customers: compact lists and clear detail sections, retaining all existing operations and historical snapshots.
3. Home and messages: real data, actionable tasks and existing exports.
4. Content and Online Store: existing management screens and editor chrome, preserving canvas behavior.
5. Payments, settings and onboarding: consistent sections, validation and save states.

## Contracts
Product draft/adapters preserve vendor, independent productType, tags, collectionIds and tracking. Add GET /catalog/inventory with query/cursor/limit and PATCH /catalog/inventory/:variantId { quantity, expectedRevision }. Every operation is store-scoped and permission checked; stale revisions return 409; reserved stock is protected. Reuse InventoryLevel.updatedAt, no new product schema or backfill.

## Verification
Affected tests/typechecks/builds per delivery group; catalog round trips, concurrency and tenant isolation; physical/configurable/variant/digital journeys; both standard and builder routes; viewport checks at 390/768/1440; keyboard focus and drawer restoration; storefront style isolation. Rich text/SEO, tax, advanced shipping, multiple locations, analytics and other new Shopify systems remain deferred.
