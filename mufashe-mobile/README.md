# MUFASHE — AI Legal Assistant (Mission Capstone MVP)

## Overview
MUFASHE is a mobile-based AI legal assistant that helps users access **trusted legal information** through a curated document library and an AI-powered question-answering experience grounded in uploaded laws (with sources/citations). The platform also includes a lawyer directory where **approved lawyers** can be viewed and booked by users.

This repository contains the **Mission Capstone MVP**, demonstrating an end-to-end full-stack solution:
- Mobile App: **Expo / React Native (Expo Router)**
- Backend API: **Node.js / Express**
- Database: **MongoDB Atlas**
- Document Processing Pipeline: **PDF → Text → Chunks → Embeddings → Searchable Q&A**
- Role-based workflows: **User / Lawyer / Admin**

---

## Links
- **GitHub Repository:** https://github.com/ndivine-eng/Mufahe-Application/tree/main/mufashe-mobile  
- **Figma Design:** https://www.figma.com/design/mgGlpzgqEt5BiD0dJLD8Tx/Mufashe-Design?node-id=0-1&t=8Vh7ZhUxAWiIoY3D-1  
- **Demo Videos (Loom):**
  - https://www.loom.com/share/25a122cf14d54224aa5181ea4a5a5498
  - https://www.loom.com/share/ee76e654f4ab45c896f58847d1e76f2c

---

## Core Features (Implemented)

### 1) Role-Based Authentication & Access Control
MUFASHE supports multiple roles with protected routes:
- **User:** user dashboard, consult (Q&A), legal library, lawyers, bookings, history, notifications, profile, settings
- **Lawyer:** lawyer dashboard, notifications, profile update tools
- **Admin:** admin dashboard tools for managing the system

Role guards prevent unauthorized access (e.g., only Admin can upload and process legal documents and manage roles).

---

### 2) Admin-Controlled Legal Document Library (Curated & Updated)
The legal library is curated and maintained by the **Admin** to ensure users consult **official and reliable sources**. When new laws, amendments, or official gazettes are released (e.g., from the Rwanda Government portal), the Admin:
- uploads the PDF
- assigns metadata (**title, category, docType, jurisdiction**)
- processes the document so it becomes searchable and usable for Q&A
- updates/re-uploads documents when laws are amended or replaced

This keeps the platform up-to-date and reduces misinformation.

---

### 3) Document Upload & Processing Pipeline (UPLOADED → PROCESSING → READY/FAILED)
When an Admin uploads a legal PDF, MUFASHE converts it into a searchable “knowledge base” through a processing pipeline.

**Document statuses:**
- **UPLOADED:** PDF saved and metadata stored, not yet processed
- **PROCESSING:** system is extracting text, chunking, and creating embeddings
- **READY:** processing completed; document is visible in the user library and usable by Q&A
- **FAILED:** processing failed; error is stored so Admin can fix and reprocess

**What happens during PROCESSING:**
1. **Text Extraction**
   - Extracts readable text from the uploaded PDF.
2. **Chunking**
   - Splits text into smaller sections (**chunks**) to improve search accuracy.
   - Each chunk is stored in the `DocumentChunk` collection.
3. **Embeddings (Vector Representations)**
   - Each chunk is converted into an **embedding** (numeric vector representing meaning).
   - Embeddings enable semantic search: retrieve relevant content by meaning, not only keywords.
   - Stored in MongoDB Atlas and queried using a vector index (e.g., `vector_index`).
4. **Indexing**
   - After embeddings exist, the system can quickly retrieve the best chunks for user questions.
5. **Final Status**
   - Success → **READY**
   - Failure → **FAILED**

Admin processing options:
- process one document at a time
- process multiple documents using “Process All”

---

### 4) User Legal Library (READY Documents Only)
Users can browse and search legal documents that are **READY** (processed successfully). This ensures:
- users only see documents that are readable and searchable
- Q&A is grounded in processed laws

Library features:
- filter by category (**FAMILY, LAND, LABOR, BUSINESS**)
- search by title/keywords
- open and review legal documents to guide decisions

---

### 5) Consult / Q&A (AI Legal Guidance with Sources)
Users ask legal questions through the Consult feature. Answers are grounded in the uploaded documents.

How Q&A works:
1. user submits a question
2. system converts the question into an embedding
3. system performs vector search over embeddings to retrieve the most relevant chunks from READY documents
4. system generates an answer using those chunks as context
5. response includes **sources/citations** showing which documents informed the answer

Users can:
- see recent questions on the dashboard
- open question details
- view full question history

---

### 6) Lawyer Profiles, Admin Approval, and Booking Workflow

#### A) Lawyer Registration & Profile Update
Lawyers register and log in, then complete their professional profile:
- specialization
- location and office address
- bio
- languages
- years of experience
- license number (optional)
- fee range (min/max) + negotiable option
- availability status (**AVAILABLE / BUSY / OFFLINE**)

#### B) Admin Approval of Lawyer Profiles
To protect users from fake or incomplete profiles, lawyers are reviewed:
- profile status: **PENDING / APPROVED / REJECTED**
- Admin reviews lawyer profiles in the Admin dashboard tools
- Approved profiles become visible to users
- Rejected profiles require improvement and re-submission

#### C) User Views Lawyers and Books Appointments
From the user dashboard, users can:
- browse the lawyer directory (approved lawyers)
- view full lawyer profiles
- book appointments
- view booking history in **My bookings**

This connects legal information access (library + Q&A) with professional support (lawyer booking).

---

### 7) Notifications, Profile, and Settings
The app includes:
- notifications screens (user and lawyer)
- profile management (including profile photo)
- settings screen

---

## Admin Tools (Implemented)
Admin dashboard includes:
- Upload legal PDF documents
- Process documents (single or batch “Process All”)
- Review lawyer profiles (pending/approved/rejected)
- Review questions (moderation/quality)
- User role management (approve/revoke lawyer)

---

## Testing & Demonstration Strategy (Submission)
The MVP is demonstrated under different testing strategies:
- **Functional testing:** upload → process → READY → Q&A with citations; lawyer booking flow
- **Negative testing:** missing file, wrong file type, unauthorized access, invalid input values
- **Data variation testing:** different PDFs (short/long), categories, question types
- **Performance evidence:** processing time and Q&A response time under different conditions
- **Platform/spec testing:** emulator vs physical device (or different OS versions if available)

Screenshots and demo videos are included in the submission.

---

## Project Structure

### Frontend (Expo / React Native)

mufashe-mobile/
├── app/
│ ├── (auth)/ # Login & Register screens
│ ├── (lawyer)/ # Lawyer dashboard, notifications, profile
│ ├── (user)/ # User dashboard + admin tools + consult + library + lawyers + bookings
│ ├── _layout.tsx
│ ├── index.tsx
│ └── modal.tsx
├── assets/
├── app.json
├── package.json
└── tsconfig.json


### Backend (Node.js / Express)

backend/
├── src/
│ ├── config/ # DB connection
│ ├── controllers/ # Request handlers
│ ├── middleware/ # Auth + admin guards + uploads
│ ├── models/ # MongoDB schemas
│ ├── routes/ # API routes
│ ├── services/ # Q&A + document processing services
│ ├── app.js
│ └── server.js
├── data/ # Uploaded PDFs storage (data/laws)
├── .env # Local env (DO NOT COMMIT)
├── package.json
└── README.md


---

## Environment Setup & Running the Project

### Prerequisites
- Node.js (v18+)
- npm
- Expo Go (for mobile testing)
- MongoDB Atlas (database)
- Postman (for API testing)
- Optional: Ollama (local LLM + embeddings in development)

---

## Backend Setup (Local)
```bash
cd backend
npm install
npm run dev

---

## Backend Setup (Local)

MONGODB_URI=YOUR_MONGODB_ATLAS_URI
PORT=5000
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

## Backend runs at:

http://localhost:5000

## Frontend Setup (Expo)

npm install
npx expo start --tunnel

Run on:

Expo Go (phone)

Android emulator / iOS simulator (if available)

Postman Testing (Admin Document Upload)

Upload endpoint:

POST /api/documents/upload (multipart/form-data)

file (File)

title (Text)

category (Text: FAMILY/LAND/LABOR/BUSINESS)

docType (Text: LAW/CASE/CONTRACT/OTHER)

jurisdiction (Text)

Process one document:

POST /api/documents/:id/process

Deployment / Install (Submission)

Backend deployed link: <PASTE BACKEND DEPLOYMENT URL HERE>

Mobile APK / install link: <PASTE EAS APK LINK OR DRIVE LINK HERE>

Notes (MVP Scope)

This submission represents an MVP focused on demonstrating functionality and end-to-end system flow. Future improvements may include:

OCR for scanned PDFs

multilingual support (Kinyarwanda/English)

improved citation precision (page-level references)

performance optimizations (caching, faster retrieval)

enhanced appointment scheduling & notifications