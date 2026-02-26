# MUFASHE – AI Legal Assistant (MVP)

## Description
MUFASHE is a mobile-based AI legal assistant designed to help users understand their legal rights and access simplified legal guidance. The application allows users to register and log in, submit legal questions, receive AI-generated legal analyses, and explore legal resources through a user-friendly interface.

This repository contains the **initial MVP** of the system and demonstrates the full-stack flow from UI design to backend logic, database structure, and deployment setup. The focus of this project is on **demonstrating functionality**, not full production readiness.

---

## GitHub Repository
🔗 **Repository link:**  
https://github.com/ndivine-eng/Mufahe-Application/tree/main/mufashe-mobile

## Figma Design 

https://www.figma.com/design/mgGlpzgqEt5BiD0dJLD8Tx/Mufashe-Design?node-id=0-1&t=8Vh7ZhUxAWiIoY3D-1

---
##
## Project Structure

### Frontend (Expo / React Native)
```
mufashe-mobile/
 ├── app/
 │   ├── (auth)/              # Login & Register screens
 │   ├── (user)/              # Dashboard, Consult, Library, Profile, Settings
 │   ├── _layout.tsx
 │   ├── index.tsx
 │   └── modal.tsx
 ├── assets/
 ├── app.json
 ├── package.json
 └── tsconfig.json
```

### Backend (Node.js)
```
backend/
 ├── src/
 │   ├── routes/              # API routes
 │   ├── controllers/         # Business logic
 │   ├── models/              # Database schemas
 │   └── middlewares/         # Authentication
 ├── .env
 ├── package.json
```

---

## Environment Setup & Running the Project

### Prerequisites
- Node.js (v18+)
- npm
- Expo CLI
- ngrok

---

### Backend Setup
```bash
cd backend
npm install
```

Create a `.env` file:
```env
PORT=5000
DATABASE_URL=your_database_url
JWT_SECRET=your_secret_key
```

Run backend:
```bash
npm run dev
```

---

### ngrok Setup (Development Deployment)
Expose the local backend:
```bash
npx ngrok http 5000
```

Copy the generated HTTPS URL and use it as the API base URL in the frontend.

---

### Frontend Setup
```bash
cd mufashe-mobile
npm install
npx expo start
```

Run the app on an emulator or physical device using Expo Go.

---

## Designs
The UI was designed using **Figma** and includes:
- Wireframes
- High-fidelity mockups
- Style guide (colors, typography, components, navigation)

Screenshots of designs and app interfaces are included in the submission.

---

## Backend Architecture
The backend uses a structured architecture with **routers, controllers, and models**:
- Routers define API endpoints
- Controllers handle application logic
- Models define database structure

Authentication (register & login) is fully implemented. Other features are planned and reflected in the schema and UI designs.

---

## Database Schema
The database schema includes the following entities:
- Users
- Cases
- Analyses
- Laws
- Precedents
- References
- Feedback

This structure supports AI legal analysis, traceability, and scalability.

---

## Deployment Plan

### Current (MVP / Development)
- Frontend runs locally using Expo
- Backend runs locally
- ngrok exposes backend publicly
- Database runs locally or in the cloud

### Future (Production)
- Backend hosted on a cloud platform
- Frontend deployed to app stores
- Managed cloud database
- Secure HTTPS and environment variables

---

## Video Demonstration
🎥 Demo videos:
- https://www.loom.com/share/25a122cf14d54224aa5181ea4a5a5498
- https://www.loom.com/share/ee76e654f4ab45c896f58847d1e76f2c

The videos demonstrate:
- UI walkthrough
- Authentication flow
- Core app functionality
- Backend interaction
- Database schema
- Deployment using ngrok

---

## Notes
- This project represents an **initial MVP**
- Focus is on demonstration of functionality
- Additional features are planned

---

## Author
MUFASHE – Mission Capstone Project
