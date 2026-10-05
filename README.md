# SHOPRi8 — Shop Nearby. Live Local.

AI-powered hyperlocal commerce platform connecting Customers, Local Retailers, Delivery Workers, and Admins for ultra-fast, local commerce.

---

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
