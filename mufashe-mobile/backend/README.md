# MUFASHE — AI Legal Assistant (Mission Capstone MVP)

## Overview
**MUFASHE** is a mobile-based AI legal assistant that helps users access **trusted legal information** through:
- a curated legal **document library** (uploaded by Admin)
- an AI-powered **question-answering (Q&A)** experience grounded in those documents (**with sources/citations**)
- an **approved lawyer directory** where users can view lawyers and book appointments

This repository contains the **Mission Capstone MVP**, demonstrating an end-to-end full-stack solution:

**Tech Stack**
- **Mobile App:** Expo / React Native (Expo Router)
- **Backend API:** Node.js / Express
- **Database:** MongoDB Atlas
- **Document Pipeline:** PDF → Text → Chunks → Embeddings → Vector Search → Q&A (with citations)
- **Roles:** User / Lawyer / Admin (role-based access control)

---

## Links
- **GitHub Repository:** https://github.com/ndivine-eng/Mufashe-Application/tree/main/mufashe-mobile  
- **Figma Design:** https://www.figma.com/design/mgGlpzgqEt5BiD0dJLD8Tx/Mufashe-Design?node-id=0-1&t=8Vh7ZhUxAWiIoY3D-1  
- **App Demonstration Video:** https://www.awesomescreenshot.com/video/50068486?key=b986318cf6c78e0426617e67a2c5317a  

**Submission Links (Fill in before submitting)**
- **Backend deployed link (Render):** `https://mufashe-application-2.onrender.com`
- **Mobile APK / install link:** `PASTE_HERE`

---

## Core Features (Implemented)

### 1) Role-Based Authentication & Access Control
MUFASHE supports multiple roles with protected screens/routes:
- **User:** dashboard, consult (Q&A), legal library, lawyers, booking, history, notifications, profile, settings
- **Lawyer:** lawyer dashboard, notifications, profile update tools
- **Admin:** admin dashboard tools for managing the system

Role guards prevent unauthorized access (example: only Admin can upload/process documents and manage approvals).

---

### 2) Admin-Controlled Legal Document Library (Curated & Updated)
The legal library is curated and maintained by the **Admin** to ensure users consult **official and reliable sources**. When new laws, amendments, or official gazettes are released, the Admin:
- uploads the PDF
- assigns metadata (**title, category, docType, jurisdiction**)
- processes the document so it becomes searchable and usable for Q&A
- updates/re-uploads documents when laws are amended or replaced

---

### 3) Document Upload & Processing Pipeline (UPLOADED → PROCESSING → READY/FAILED)
When an Admin uploads a legal PDF, MUFASHE converts it into a searchable “knowledge base”.

**Document statuses**
- **UPLOADED:** PDF saved + metadata stored, not yet processed
- **PROCESSING:** extracting text, chunking, creating embeddings
- **READY:** completed; document is visible in user library and usable for Q&A
- **FAILED:** processing failed; error is stored so Admin can fix/reprocess

**What happens during PROCESSING**
1. **Text Extraction** from PDF  
2. **Chunking** (splitting text into smaller parts) stored in `DocumentChunk`  
3. **Embeddings** created per chunk (vector representation) stored in MongoDB Atlas  
4. **Vector Index Search** retrieves the most relevant chunks for a question  
5. Final status becomes **READY** or **FAILED**

Admin can process:
- one document at a time
- multiple documents using **Process All**

---

### 4) User Legal Library (READY Documents Only)
Users can browse/search legal documents that are **READY** (processed successfully).
- filter by category (**FAMILY, LAND, LABOR, BUSINESS**)
- search by title/keywords
- open documents for review

---

### 5) Consult / Q&A (AI Legal Guidance with Sources)
Users ask legal questions via Consult.
Flow:
1. user submits question  
2. question is embedded  
3. system performs vector search over READY document chunks  
4. system generates answer using retrieved chunks as context  
5. answer includes **sources/citations** (document evidence)

Users can view:
- recent questions on dashboard
- question details
- full question history

---

### 6) Lawyer Profiles, Admin Approval, and Booking Workflow

**A) Lawyer Registration & Profile Update**
Lawyers register/login, then complete profile:
- specialization, location, bio, languages
- years of experience
- license number (optional)
- fee range (min/max) + negotiable option
- availability (**AVAILABLE / BUSY / OFFLINE**)

**B) Admin Approval**
Lawyer profiles are reviewed:
- status: **PENDING / APPROVED / REJECTED**
- approved lawyers become visible to users

**C) User Books Appointment**
Users can:
- browse directory (approved lawyers)
- view lawyer profiles
- book appointments
- view booking history in **My bookings**

---

### 7) Notifications, Profile, and Settings
Included screens:
- notifications (user + lawyer)
- profile management (including profile photo)
- settings

---

## Admin Tools (Implemented)
Admin dashboard supports:
- Upload legal PDF documents
- Process documents (single or **Process All**)
- Review lawyer profiles (pending/approved/rejected)
- Review questions (moderation/quality)
- User role management (approve/revoke lawyer)

---

## Project Structure

### Frontend (Expo / React Native)
```
mufashe-mobile/
├── app/
│   ├── (auth)/                 # Login & Register
│   ├── (lawyer)/               # Lawyer dashboard, notifications, profile
│   ├── (user)/                 # User dashboard + admin tools + consult + library + lawyers + bookings
│   ├── _layout.tsx
│   ├── index.tsx
│   └── modal.tsx
├── assets/
├── app.json
├── package.json
└── tsconfig.json
```

### Backend (Node.js / Express)
```
backend/
├── src/
│   ├── config/                 # DB connection
│   ├── controllers/            # Request handlers
│   ├── middleware/             # Auth + role/admin guards + uploads
│   ├── models/                 # MongoDB schemas
│   ├── routes/                 # API routes
│   ├── services/               # Q&A + document processing + vector search
│   ├── app.js
│   └── server.js
├── data/                       # Uploaded PDFs storage (local/dev)
├── .env                        # Local env (DO NOT COMMIT)
├── package.json
└── README.md
```

---

## Instructions: Install & Run (Step-by-Step)

### Prerequisites
Install these first:
- Node.js **v18+**
- npm
- Expo Go (mobile testing) OR Android emulator
- MongoDB Atlas cluster
- Postman (optional for API testing)

---

## 1) Clone the Repository
```bash
git clone https://github.com/ndivine-eng/Mufashe-Application.git
cd Mufashe-Application/mufashe-mobile
```

---

## 2) Backend Setup (Local)

### Step 2.1 — Install backend dependencies
```bash
cd backend
npm install
```

### Step 2.2 — Create backend `.env`
Inside `backend/.env`:
```env
PORT=5000
MONGODB_URI=YOUR_MONGODB_ATLAS_URI
JWT_SECRET=YOUR_SECRET
ADMIN_EMAIL=admin@example.com
ADMIN_SETUP_KEY=YOUR_ADMIN_SETUP_KEY

# Optional local dev (Ollama)
OLLAMA_URL=http://localhost:11434
OLLAMA_CHAT_MODEL=gemma3:4b
OLLAMA_EMBED_MODEL=nomic-embed-text:latest

# MongoDB Vector Search
MONGO_VECTOR_INDEX=vector_index
MONGO_VECTOR_PATH=embedding
```

### Step 2.3 — MongoDB Atlas checklist
- Ensure your **IP is whitelisted** in Atlas (or use `0.0.0.0/0` for testing only).
- Ensure your database user has correct permissions.
- Ensure your vector index name matches:
  - `MONGO_VECTOR_INDEX=vector_index`
  - your chunk embedding field matches `MONGO_VECTOR_PATH=embedding`

### Step 2.4 — Run backend
```bash
npm run dev
```

Backend will run on:
- `http://localhost:5000`

---

## 3) Create/Bootstrap Admin (One Time)
Your backend includes a bootstrap admin flow (based on your routes/controllers). Use the endpoint your project exposes (example):
- `POST /api/auth/bootstrap-admin`

In Postman:
- set header/body as required by your endpoint
- include `ADMIN_SETUP_KEY` if your logic requires it

After this, you can login as Admin and upload/process documents.

---

## 4) Frontend Setup (Expo)

### Step 4.1 — Install frontend dependencies
From the project root (`mufashe-mobile/`):
```bash
npm install
```

### Step 4.2 — Set frontend env (API URL)
Create `.env.development` (or `.env`) in `mufashe-mobile/`:
```env
EXPO_PUBLIC_API_URL=http://localhost:5000/api
```

### Step 4.3 — Start Expo
```bash
npx expo start
```

If you need network access from your phone:
- Try `npx expo start --lan`
- If tunnel fails, it’s often ngrok-related (see Troubleshooting below)

---

## 5) How to Test the MVP (Quick Demo Flow)
1. **Login as Admin**
2. Upload a legal PDF → set metadata (title/category/docType)
3. Click **Process** (or **Process All**) until document becomes **READY**
4. Login as User
5. Open **Library** → confirm READY documents show
6. Go to **Consult** → ask a question → verify answer includes **sources/citations**
7. Login as Lawyer → complete profile → status becomes **PENDING**
8. Login as Admin → approve lawyer profile
9. Login as User → browse lawyers → book appointment

---

## Deploy Backend on Render (Step-by-Step)

### Step 1 — Create Web Service
1. Go to Render → **New** → **Web Service**
2. Connect your GitHub repo
3. Set **Root Directory** to:
   - `mufashe-mobile/backend`

### Step 2 — Build & Start Commands
- **Build Command:**
```bash
npm install
```
- **Start Command:**
```bash
node src/server.js
```

### Step 3 — Add Environment Variables (Render Dashboard)
Add the same variables as your backend `.env`:
- `MONGODB_URI`
- `JWT_SECRET`
- `ADMIN_EMAIL`
- `ADMIN_SETUP_KEY`
- `MONGO_VECTOR_INDEX`
- `MONGO_VECTOR_PATH`
- (Optional) `OLLAMA_URL`, `OLLAMA_CHAT_MODEL`, `OLLAMA_EMBED_MODEL`

### Step 4 — Deploy
Click **Deploy**.https://mufashe-application-2.onrender.com
- **Submission Links** section above

---

## Troubleshooting

### Expo tunnel error: `failed to start tunnel (remote gone away)`
This usually happens when ngrok has issues/outages.
Try:
```bash
npx expo start --lan
```
Or:
```bash
npx expo start --localhost
```

### MongoDB Atlas connection error
- Confirm your IP is whitelisted in Atlas
- Confirm correct username/password in `MONGODB_URI`
- Ensure cluster is running

---

## Related Files (Key Implementation Files)

### Mobile App Screens (Expo Router)
- `app/(auth)/login.tsx`
- `app/(auth)/Register.tsx`
- `app/(user)/dashboard.tsx`
- `app/(user)/consult.tsx`
- `app/(user)/library.tsx`
- `app/(user)/lawyers.tsx`
- `app/(user)/book-appointment.tsx`
- `app/(user)/appointments.tsx`
- `app/(user)/history.tsx`
- `app/(user)/notifications.tsx`
- `app/(user)/profile.tsx`
- `app/(user)/settings.tsx`

**Admin Screens (inside user group)**
- `app/(user)/admin-dashboard.tsx`
- `app/(user)/admin-upload.tsx`
- `app/(user)/admin-review-questions.tsx`
- `app/(user)/admin-lawyer-profiles.tsx`

**Lawyer Screens**
- `app/(lawyer)/dashboard.tsx`
- `app/(lawyer)/notifications.tsx`
- `app/(lawyer)/profile.tsx`

### Backend Core
**Controllers**
- `backend/src/controllers/auth.controller.js`
- `backend/src/controllers/document.controller.js`
- `backend/src/controllers/qa.controller.js`
- `backend/src/controllers/questions.controller.js`
- `backend/src/controllers/users.controller.js`
- `backend/src/controllers/notifications.controller.js`

**Routes**
- `backend/src/routes/auth.routes.js`
- `backend/src/routes/document.routes.js`
- `backend/src/routes/qa.routes.js`
- `backend/src/routes/questions.routes.js`
- `backend/src/routes/admin.routes.js`
- `backend/src/routes/users.routes.js`
- `backend/src/routes/notifications.routes.js`
- `backend/src/routes/appointments.routes.js`
- `backend/src/routes/lawyers.routes.js`

**Models**
- `backend/src/models/User.js`
- `backend/src/models/Document.js`
- `backend/src/models/DocumentChunk.js`
- `backend/src/models/Question.js`
- `backend/src/models/Appointment.js`
- `backend/src/models/Notification.js`

**Services (Pipeline + Q&A)**
- `backend/src/services/documentProcess.service.js`
- `backend/src/services/pdf.service.js`
- `backend/src/services/chunk.service.js`
- `backend/src/services/embedding.service.js`
- `backend/src/services/embedChunks.mongo.service.js`
- `backend/src/services/vectorSearch.mongo.service.js`
- `backend/src/services/qa.service.js`
- `backend/src/services/search.service.js`

**Middleware**
- `backend/src/middleware/auth.js`
- `backend/src/middleware/requireAdmin.js`
- `backend/src/middleware/requireRole.js`
- `backend/src/middleware/uploadPdf.js`

---

## License
This project is part of a **Mission Capstone MVP** submission and is provided for academic demonstration purposes.
