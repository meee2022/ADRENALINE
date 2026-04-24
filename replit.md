# Adrenaline Meals Manager

## Overview

Adrenaline Meals Manager is a full-stack web application designed to replace manual Excel sheets for managing gym subscribers' meal plans. The system enables administrators to manage customers, create meal plans, coordinate kitchen preparation, and track delivery - all through a clean, bilingual (Arabic/English) interface with RTL support.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript, using Vite as the build tool
- **Routing**: Wouter for lightweight client-side routing
- **State Management**: Zustand for global state, TanStack Query for server state
- **UI Components**: shadcn/ui component library with Radix UI primitives
- **Styling**: Tailwind CSS with custom theme variables, Cairo font for Arabic support
- **Internationalization**: Custom i18n system supporting Arabic (RTL) and English (LTR)

### Backend Architecture
- **Framework**: Express.js with TypeScript
- **API Pattern**: RESTful API endpoints under `/api/*`
- **Database ORM**: Drizzle ORM with PostgreSQL dialect
- **Validation**: Zod schemas for request validation, integrated with drizzle-zod

### Data Storage
- **Database**: PostgreSQL (configured via DATABASE_URL environment variable)
- **Schema Location**: `shared/schema.ts` contains all table definitions
- **Migrations**: Drizzle Kit manages migrations in the `migrations/` folder

### Core Data Models
- **Users**: Authentication with role-based access (ADMIN, KITCHEN, DELIVERY)
- **Customers**: Gym subscribers with meal plan details, delivery preferences, dietary info
- **MealCategories**: Meal types (Breakfast, Lunch, Dinner, Snacks) with sort ordering
- **MenuItems**: Individual food items linked to categories
- **Addons**: Optional extras that can be added to meals
- **DailyPlans**: Daily meal assignments with status tracking (DRAFT → CONFIRMED → PREPARED → DELIVERED)

### Role-Based Access Control
- **ADMIN**: Full access to all features including customer management, menu configuration, and plan creation
- **KITCHEN**: View confirmed plans, mark as prepared, access print-friendly views
- **DELIVERY**: View prepared plans, mark as delivered, see delivery routes

### Build System
- **Development**: Vite dev server with HMR, tsx for running TypeScript server
- **Production**: esbuild bundles server code, Vite builds client assets to `dist/public`

## External Dependencies

### Database
- **PostgreSQL**: Primary database, connection via `DATABASE_URL` environment variable
- **Drizzle ORM**: Type-safe database queries and schema management

### UI Framework Dependencies
- **Radix UI**: Accessible component primitives (dialogs, dropdowns, tabs, etc.)
- **Recharts**: Chart components for dashboard visualizations
- **date-fns**: Date manipulation with locale support for Arabic/English

### Development Tools
- **Replit Plugins**: Runtime error overlay, cartographer for development, dev banner
- **Custom Vite Plugin**: `vite-plugin-meta-images` for OpenGraph image handling

### Key NPM Packages
- `@tanstack/react-query`: Server state management and caching
- `react-hook-form` with `@hookform/resolvers`: Form handling with Zod validation
- `zustand`: Lightweight state management
- `wouter`: Minimal React router
- `class-variance-authority`: Component variant styling