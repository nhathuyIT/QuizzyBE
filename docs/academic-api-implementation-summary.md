# Academic API Implementation Summary

> Updated: 2026-07-01  
> Scope: Backend Academic Module, Postman collection, chatbot token optimization

## 1. What Was Implemented

### Academic Module

Created a new `AcademicModule` for FPT University academic documents.

Main folder:

```txt
src/modules/academic/
|-- academic.module.ts
|-- controllers/
|   |-- department.controller.ts
|   |-- subject.controller.ts
|   `-- document.controller.ts
|-- dto/
|   |-- create-document.dto.ts
|   |-- query-documents.dto.ts
|   `-- query-subjects.dto.ts
|-- repositories/
|   |-- department.repository.ts
|   |-- subject.repository.ts
|   `-- document.repository.ts
|-- schemas/
|   |-- department.schema.ts
|   |-- subject.schema.ts
|   `-- academic-document.schema.ts
|-- seed/
|   `-- academic.seed.ts
`-- services/
    |-- department.service.ts
    |-- subject.service.ts
    `-- document.service.ts
```

### Database Collections

Added three MongoDB collections:

```txt
departments
subjects
academic_documents
```

Schema relationship:

```txt
departments 1:N subjects 1:N academic_documents
academic_documents N:1 users
```

Indexes added:

```ts
DepartmentSchema: unique code
SubjectSchema: unique { code, departmentId }
SubjectSchema: { departmentId, semester }
AcademicDocumentSchema: { subjectId, createdAt }
AcademicDocumentSchema: { uploadedBy, createdAt }
AcademicDocumentSchema: text index for title, description, tags
```

### App Module Wiring

Registered `AcademicModule` in:

```txt
src/app.module.ts
```

### Seed Script

Added academic seed script:

```bash
npm run seed:academic
```

This script only upserts departments and subjects. It does not delete old data.

Important difference:

```bash
npm run seed:academic
```

Safe for existing data.

```bash
npm run seed
```

Deletes many old collections such as users, decks, cards, study sessions, etc.

### Postman Collection

Updated:

```txt
Quizzy.postman_collection.json
```

Added folder:

```txt
Academic Documents
```

Added collection variables:

```txt
academicDepartmentId
academicSubjectId
academicDocumentId
academicFileUrl
academicStoragePath
```

Added requests:

```txt
Academic - List Departments
Academic - List Subjects By Department
Academic - List Subject Documents
Academic - Create Document Metadata
Academic - My Documents
Academic - Increment Download Count
Academic - Delete Document
```

### Chatbot Token Optimization

Updated chatbot defaults:

```txt
CHATBOT_MAX_HISTORY=4
CHATBOT_MAX_CARD_CONTEXT=10
```

Changed deck context formatting from verbose card metadata to a shorter format:

```txt
1. Front -> Back
```

This reduces repeated input tokens when chatting with a deck context.

### Redis Dependency Cleanup

Removed unused package:

```txt
@upstash/redis
```

The project still uses Redis through `ioredis` for BullMQ.

## 2. Implemented API Endpoints

### Departments

```http
GET /v1/academic/departments
```

Purpose:

```txt
Get active departments such as AI and SE.
```

Auth:

```txt
Public
```

### Subjects

```http
GET /v1/academic/departments/:deptId/subjects
GET /v1/academic/departments/:deptId/subjects?semester=1
```

Purpose:

```txt
Get active subjects by department, optionally filtered by semester.
```

Auth:

```txt
Public
```

### Documents By Subject

```http
GET /v1/academic/subjects/:subjectId/documents?page=1&limit=20
```

Optional query:

```txt
keyword
fileType: pdf | docx | pptx | xlsx | other
```

Purpose:

```txt
Get active documents for one subject.
```

Auth:

```txt
Public
```

### Create Document Metadata

```http
POST /v1/academic/documents
```

Auth:

```txt
JWT required
```

Body:

```json
{
  "title": "Slide OOP Basics",
  "description": "Sample academic document",
  "subjectId": "{{academicSubjectId}}",
  "fileUrl": "{{academicFileUrl}}",
  "fileName": "sample-oop.pdf",
  "fileType": "pdf",
  "fileSize": 204800,
  "storagePath": "{{academicStoragePath}}",
  "tags": ["slide", "oop", "chapter-1"]
}
```

Notes:

```txt
The backend only stores Firebase metadata.
The actual file upload should happen directly from frontend to Firebase Storage.
```

Validation:

```txt
subjectId must exist and be active.
fileUrl must be a valid HTTP/HTTPS URL.
storagePath must start with documents/.
fileName extension must match fileType, except fileType = other.
```

Side effects:

```txt
Creates one academic_documents record.
Increments subjects.documentCount by 1.
```

### My Documents

```http
GET /v1/academic/documents/my?page=1&limit=20
```

Optional query:

```txt
keyword
fileType: pdf | docx | pptx | xlsx | other
status: active | archived | all
```

Purpose:

```txt
Get documents uploaded by the current user.
```

Auth:

```txt
JWT required
```

### Increment Download Count

```http
PATCH /v1/academic/documents/:id/download-count
```

Purpose:

```txt
Increment downloadCount when user downloads a document.
```

Auth:

```txt
Public
```

### Delete Document

```http
DELETE /v1/academic/documents/:id
```

Purpose:

```txt
Soft delete document by setting status = archived.
```

Auth:

```txt
JWT required
```

Permission:

```txt
Owner or admin only.
```

Side effects:

```txt
If document was active, decrements subjects.documentCount by 1.
If document was already archived, it returns the archived record and does not decrement again.
```

## 3. Recommended API Test Flow

### Step 1: Start Server

```bash
npm run start:dev
```

### Step 2: Seed Academic Data

```bash
npm run seed:academic
```

This creates or updates sample departments and subjects:

```txt
AI
SE
PRF192
MAE101
CEA201
MAD101
PRO192
AIE301M
AIM301M
SWP391
SWD392
```

### Step 3: Login In Postman

Run an existing login request and save:

```txt
accessToken
```

### Step 4: Run Academic Requests In Order

```txt
1. Academic - List Departments
2. Academic - List Subjects By Department
3. Academic - List Subject Documents
4. Academic - Create Document Metadata
5. Academic - My Documents
6. Academic - Increment Download Count
7. Academic - Delete Document
```

The first two requests save:

```txt
academicDepartmentId
academicSubjectId
```

The create request saves:

```txt
academicDocumentId
```

## 4. Frontend Implementation Plan

### Phase 1: Firebase Upload Setup

Tasks:

```txt
Install Firebase client SDK in frontend.
Create Firebase app config.
Configure Firebase Storage.
Create upload helper.
```

Upload path convention:

```txt
documents/{departmentCode}/{semester}/{subjectCode}/{timestamp}_{fileName}
```

Example:

```txt
documents/AI/1/PRF192/1719388800_slide-c1.pdf
```

### Phase 2: Academic Browse UI

Screens/components:

```txt
Department selector
Semester selector, 1-9
Subject list
Document list
Document detail/download action
```

API usage:

```txt
GET /v1/academic/departments
GET /v1/academic/departments/:deptId/subjects?semester=1
GET /v1/academic/subjects/:subjectId/documents?page=1&limit=20
```

### Phase 3: Upload Document UI

Flow:

```txt
1. User selects department.
2. User selects semester.
3. User selects subject.
4. User selects file.
5. Frontend uploads file directly to Firebase Storage.
6. Firebase returns download URL.
7. Frontend sends metadata to backend.
```

Backend request:

```http
POST /v1/academic/documents
```

Payload comes from Firebase result:

```json
{
  "title": "Document title",
  "description": "Optional description",
  "subjectId": "subject id",
  "fileUrl": "Firebase download URL",
  "fileName": "original-file-name.pdf",
  "fileType": "pdf",
  "fileSize": 204800,
  "storagePath": "documents/AI/1/PRF192/1719388800_file.pdf",
  "tags": ["slide", "chapter-1"]
}
```

### Phase 4: My Documents UI

API usage:

```http
GET /v1/academic/documents/my?page=1&limit=20
DELETE /v1/academic/documents/:id
```

Features:

```txt
Show uploaded documents.
Filter by fileType/status.
Soft delete own documents.
Show archived documents when needed.
```

### Phase 5: Download Tracking

When user clicks download:

```txt
1. Call PATCH /v1/academic/documents/:id/download-count.
2. Open fileUrl in a new tab or trigger browser download.
```

## 5. Backend Follow-Up Plan

Recommended next improvements:

```txt
Add e2e tests for academic endpoints.
Add admin endpoints to manage departments and subjects.
Add document moderation status if public uploads need review.
Add Firebase Admin SDK delete integration for removing files from Storage.
Add rate limit for document create/delete if public upload is abused.
Add stronger Firebase URL validation if production bucket name is known.
Add Swagger/OpenAPI docs if the team uses generated API documentation.
```

## 6. Verification Already Done

Commands run:

```bash
npm run build
npm test -- --runInBand
```

Result:

```txt
Build passed.
8 test suites passed.
26 tests passed.
```

Postman collection validation:

```txt
Quizzy.postman_collection.json was parsed successfully with JSON.parse.
```
