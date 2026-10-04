# SHOPRi8 — Agent & Development Guidelines

SHOPRi8 is an AI-powered hyperlocal commerce platform connecting:
- **Customer**
- **Local Retailer**
- **Delivery Worker**
- **Admin**

## Core Stack
- React 19 + TypeScript
- TanStack Start (SSR) + TanStack Router + TanStack Query
- Vite 8 + Tailwind CSS v4
- Nitro Server Engine

## Architecture Guidelines
- **Modularity**: Customer, Retailer, Delivery Worker, and Admin interfaces are modularized with their own layout, state management, and routing hierarchies.
- **Data Layer**: Clean separation between data store/services and UI components so backend providers (e.g. Firebase/Firestore) can be connected cleanly.
- **Git Hygiene**: Always keep the branch in a working, cleanly buildable state. Push updates to the repository after implementing changes.
