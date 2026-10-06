# SHOPRi8 — Shop Nearby. Live Local.

AI-powered hyperlocal commerce platform connecting Customers, Local Retailers, Delivery Workers, and Admins for ultra-fast, local commerce.

---

### Product image storage

Demo mode keeps retailer-uploaded product images in browser IndexedDB and
continues using the bundled SHOPRi8 catalogue. Firebase mode uploads JPG, PNG,
or WebP files (maximum 5 MB) to
`shops/{shopId}/products/{productId}/image-{generatedId}.{extension}`.
Firestore stores the download URL and Storage path as product image metadata;
image bytes are never written to Firestore. Uploads use the existing Firebase
app and Storage bucket, and product ownership is checked by Storage Rules
against the authenticated user's retailer capability, shop ownership, and
product-to-shop relationship.

Set `VITE_FIREBASE_STORAGE_BUCKET` to the Firebase web app's bucket. Validate
Storage permissions locally with `npm run verify:storage`; this runs only the
Auth, Firestore, and Storage emulators and does not deploy rules or modify
production data.

## 🚀 Key Modules & Capabilities

- **Customer App**: Browse nearby shops, discover local deals, search products, geolocated map view, multi-shop cart & instant checkout.
- **Retailer Dashboard**: Real-time order fulfillment pipeline (New ➔ Accepted ➔ Preparing ➔ Ready for Pickup), inventory management, product catalog control, shop profile & operating hours.
- **Delivery Worker App**: Dispatch coordination, pickup and drop-off tracking, route navigation.
- **Admin Console**: Hyperlocal analytics, retailer verification, platform oversight.

### Retailer onboarding

In Firebase mode, an authenticated customer submits a retailer application stored in
`retailerApplications/{uid}`. An administrator reviews it in the Admin portal. Approval
atomically creates the applicant-owned shop and adds the `retailer` capability to the
same `users/{uid}` profile; rejection stores a reason and allows resubmission. No second
Firebase Auth account is created. Demo mode does not persist applications or grant roles.

---

## 🛠️ Tech Stack

- **Framework**: React 19 + TypeScript
- **Routing & SSR**: TanStack Start + TanStack Router
- **Data Fetching**: TanStack Query v5
- **Styling**: Tailwind CSS v4 + Radix UI Primitives + Lucide Icons
- **Bundler & Server**: Vite 8 + Nitro Engine
- **Maps**: Leaflet + React Leaflet

---

## 📦 Getting Started

### Prerequisites

- Node.js (v20+ recommended)
- npm

### Installation & Run

```bash
# Install dependencies
npm install

# Run development server (accessible at http://localhost:8080)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

### UPI / QR Demo Payment

SHOPRi8 currently uses a **UPI / QR Demo Payment** flow for academic
demonstration. No real money is processed. The QR code contains only harmless
SHOPRi8 demo text, the order ID, the server-derived amount, and a no-real-payment
marker. It is not a UPI payment intent and does not open any banking app.

In Firebase mode, checkout sends product IDs, quantities, shop, saved address,
and an idempotency key to the existing `src/server.ts` Worker entrypoint. The
trusted server verifies Firebase Authentication and the customer capability,
re-reads prices and availability from Firestore, and creates the order and
pending payment record in one transaction. Confirming the simulated payment
uses a second trusted transaction to verify ownership, payability, and matching
server-stored order/payment amounts before atomically marking payment `SUCCESS`
and order `PAID`. Duplicate confirmation is safe. Retailer order processing
remains locked until that confirmation; COD uses the existing checkout and
order lifecycle unchanged.

Configure the Worker variables in `.env.example` for Firebase Auth/Firestore
access: `FIREBASE_PROJECT_ID`, `FIREBASE_WEB_API_KEY`,
`FIREBASE_SERVICE_ACCOUNT_EMAIL`, and `FIREBASE_SERVICE_ACCOUNT_PRIVATE_KEY`.
The service-account private key must be a Worker secret; the
service identity should have only the Firestore access needed by the payment
backend (for example, `roles/datastore.user`). Never put server credentials in
`VITE_*` variables, source control, or Firestore. No payment gateway, merchant
account, webhook, or payment-provider credentials are required.
