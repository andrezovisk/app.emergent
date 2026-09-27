# DeliveryHub - Multi-tenant Delivery Marketplace

## Vision
An iFood/Rappi-style multi-tenant delivery platform where a Super Admin manages companies and licenses, companies manage their own products/orders, and customers browse stores and place orders that are sent to the store's WhatsApp via a formatted deep link.

## Roles
1. **Super Admin** — platform owner. Manages companies (create/update/delete), licenses (Basic/Pro/Premium with expiration), and toggles active status.
2. **Company (Store Partner)** — manages products, receives and advances orders.
3. **Customer** — browses stores by segment, adds items to cart, checks out and sends order to WhatsApp.

## MVP Features
- Onboarding role selection screen
- JWT auth (email/password) with 3 roles
- Super Admin: stats, companies CRUD, license renewal, activate/deactivate
- Company Panel: stats, products CRUD, orders list, status advance (placed→confirmed→preparing→delivered)
- Customer: home feed (segment filter chips), store detail, product listing, cart, WhatsApp checkout, my orders
- License enforcement: expired/inactive stores hidden from customer feed and blocked from receiving orders
- WhatsApp deep link (wa.me) with formatted order message

## Design
iFood-inspired iOS-native clean palette. Brand `#EA1D2C`. Bottom sticky CTA on cart. Gradient scrim on store covers. Content-first premium feel.

## Backend
FastAPI + Motor + MongoDB. All routes prefixed `/api`. Users stored in MongoDB with UUIDs; ObjectId excluded from responses.

## Frontend
Expo Router (file-based). Three route groups: `(admin)`, `(company)`, `(customer)`. Auth gate redirects based on role after login.
