# HealthSync Engine

HealthSync is an offline-first, conflict-resolving health record system designed for community healthcare workers in low or no-connectivity areas (e.g., rural clinics, mobile health units, disaster response).

This project is currently in **Phase A**, which focuses on building a robust local-first Progressive Web App (PWA) providing full CRUD capabilities for patient records entirely offline using local browser storage.

## Features (Phase A)

*   **Fully Offline:** No network connection is required to add, view, list, search, edit, or delete patient records.
*   **Local Storage:** Uses IndexedDB (via Dexie.js) for reliable on-device data persistence.
*   **Responsive UI:** Clean, medical-themed interface optimized for mobile, tablet, and desktop devices.
*   **Patient Dashboard:** Quick overview of patient statistics and recent activity.
*   **Patient Management:** Comprehensive patient list with client-side search and filtering.

## Tech Stack

*   **Frontend Framework:** React 18
*   **Build Tool:** Vite
*   **Language:** TypeScript
*   **Styling:** TailwindCSS v3
*   **Routing:** React Router v6
*   **Local Database:** Dexie.js (IndexedDB wrapper)
*   **Forms & Validation:** React Hook Form + Zod
*   **PWA Support:** vite-plugin-pwa

## Getting Started

### Prerequisites

Ensure you have [Node.js](https://nodejs.org/) installed on your machine.

### Installation

1.  Clone the repository and navigate to the project directory:
    ```bash
    cd health-sync-engine
    ```
2.  Install the dependencies:
    ```bash
    npm install
    ```

### Running Locally

Start the Vite development server:

```bash
npm run dev
```

Open your browser and navigate to the local URL provided in the terminal (typically `http://localhost:5173`).

## Project Structure

*   `src/db/`: Dexie schema and typed CRUD helpers.
*   `src/types/`: Shared TypeScript interfaces (e.g., `Patient`).
*   `src/components/`: Reusable UI components (`Card`, `Toast`, etc.).
*   `src/pages/`: Application views (`Dashboard`, `PatientList`, etc.).
*   `src/hooks/`: Custom React hooks for data access (`usePatients`).
*   `src/context/`: Application context providers (e.g., Auth).

## Future Scope (Phase B)

Phase B will introduce a backend service to enable multi-device synchronization and conflict resolution using CRDTs (Conflict-free Replicated Data Types) and Vector Clocks. This will ensure critical medical data (like allergies and medication dosages) is never lost or silently overwritten during merges.
