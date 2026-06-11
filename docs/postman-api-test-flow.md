# Postman API Test Flow

Tai lieu nay huong dan chay test API bang Postman theo dung thu tu. Khong giai thich code noi bo, chi tap trung vao request, body, bien Postman, va ket qua can kiem tra.

## 1. Chuan Bi

Import file:

```text
Quizzy.postman_collection.json
```

Chay backend local:

```text
http://localhost:3001
```

Collection variables can co:

| Variable | Gia tri / Y nghia |
| --- | --- |
| `baseUrl` | `http://localhost:3001` |
| `accessToken` | Token lay tu login |
| `deckId` | Id deck dang test |
| `cardId` | Id card dang test |
| `studySessionId` | Id study session dang test |
| `studyMode` | Mode hien tai: `flashcard`, `learn`, `test`, `match` |
| `reviewId` | Id review sau khi log review |

## 2. Flow Tong Quan Can Chay

Chay theo thu tu nay trong Postman:

```text
1. Health Checks -> Check Server Ping
2. Authentication -> Login User
3. Decks -> Create Deck
4. Cards -> Create Bulk Cards
5. Study Flow -> Study - Start Flashcard Session
6. Study Flow -> Study - Get Session Items
7. Study Flow -> Study - Log Flashcard Review (rating)
8. Study Flow -> Card Progress - Get Deck Progress Summary
9. Study Flow -> Study - Finish Study Session
```

Sau khi flow flashcard chay duoc, test tiep cac mode khac:

```text
Study - Start Learn Session
Study - Start Test Session
Study - Start Match Session
```

Moi lan start session moi, chay lai:

```text
Study - Get Session Items
Log review tuong ung voi mode
Study - Finish Study Session
```

## 3. Health Check

Request:

```http
GET {{baseUrl}}/ping
```

Ket qua mong doi:

```json
{
  "success": true,
  "data": {
    "status": "success",
    "message": "API is healthy"
  }
}
```

## 4. Authentication

### 4.1 Login

Request:

```http
POST {{baseUrl}}/v1/auth/login
```

Body:

```json
{
  "email": "student@gizmo.local",
  "password": "password123"
}
```

Ket qua mong doi:

```json
{
  "success": true,
  "data": {
    "accessToken": "...",
    "tokenType": "Bearer",
    "expiresIn": "7d",
    "user": {}
  }
}
```

Postman se tu luu:

```text
accessToken
```

### 4.2 Register

Request:

```http
POST {{baseUrl}}/v1/auth/register
```

Body:

```json
{
  "email": "new-user@example.com",
  "password": "password123",
  "name": "New User"
}
```

Ket qua dung:

```text
Register chi tra user, khong tra accessToken.
Muon co token thi goi Login.
```

## 5. Deck Flow

Trong Postman hien tai folder `Decks` nen co du cac request sau:

```text
Create Deck
Search Decks (Public - No Auth)
Search Decks (With Auth)
Get My Decks
Get Deck By Id (Optional Auth)
Star Deck
Search Starred Decks
Unstar Deck
Get Deck Cards Paginated
Update Deck
```

### 5.1 Create Deck

Request:

```http
POST {{baseUrl}}/v1/decks
Authorization: Bearer {{accessToken}}
```

Body:

```json
{
  "title": "English Vocabulary",
  "description": "Common English words for software developers",
  "visibility": "private",
  "tags": ["english", "software"]
}
```

Postman se tu luu:

```text
deckId
```

### 5.2 Search Decks Public - No Auth

Request nay khong gui Authorization:

```http
GET {{baseUrl}}/v1/decks?keyword=english&page=1&take=10&order=DESC
```

Ket qua mong doi:

```text
Chi thay deck public/link.
Khong thay private deck cua user.
Response item khong bat buoc co field star vi request khong co user context.
```

### 5.3 Search Decks With Auth

Request nay gui Bearer token:

```http
GET {{baseUrl}}/v1/decks?keyword=english&visibility=private&page=1&take=10&order=DESC
Authorization: Bearer {{accessToken}}
```

Quy tac:

```text
Thay deck public/link + private deck cua chinh user.
Neu filter visibility=private thi chi private deck ma user duoc phep thay.
Moi item nen co field star theo user dang login.
```

Ket qua item can co:

```json
{
  "star": false
}
```

### 5.4 Get My Decks

Request:

```http
GET {{baseUrl}}/v1/decks/my?page=1&take=10&order=DESC
Authorization: Bearer {{accessToken}}
```

Ket qua mong doi:

```text
Chi tra deck do user dang login tao.
Moi item co field star.
```

### 5.5 Get Deck By Id Optional Auth

Request khong token:

```http
GET {{baseUrl}}/v1/decks/{{deckId}}
```

Request co token:

```http
GET {{baseUrl}}/v1/decks/{{deckId}}
Authorization: Bearer {{accessToken}}
```

Quy tac:

```text
Deck public/link: ai cung xem duoc.
Private deck: chi owner xem duoc.
Co token thi response co star dung theo user dang login.
Khong token thi star mac dinh false hoac khong dung de test trang thai da star.
```

### 5.6 Star Deck

Request:

```http
PUT {{baseUrl}}/v1/decks/{{deckId}}/star
Authorization: Bearer {{accessToken}}
```

Ket qua mong doi:

```json
{
  "success": true,
  "data": {
    "_id": "{{deckId}}",
    "star": true
  }
}
```

Postman nen luu/check:

```text
star = true
```

### 5.7 Search Starred Decks

Request:

```http
GET {{baseUrl}}/v1/decks/starred?page=1&take=10&order=DESC
Authorization: Bearer {{accessToken}}
```

Ket qua mong doi:

```text
Deck vua star nam trong danh sach.
Field star = true.
```

### 5.8 Unstar Deck

Request:

```http
DELETE {{baseUrl}}/v1/decks/{{deckId}}/star
Authorization: Bearer {{accessToken}}
```

Ket qua mong doi:

```json
{
  "success": true,
  "data": {
    "_id": "{{deckId}}",
    "star": false
  }
}
```

### 5.9 Get Deck Cards Paginated

Request:

```http
GET {{baseUrl}}/v1/decks/{{deckId}}/cards?page=1&take=20
Authorization: Bearer {{accessToken}}
```

Ket qua mong doi:

```text
Tra ve cards trong deck theo pagination.
Neu deck private thi user phai la owner.
```

### 5.10 Update Deck

Request:

```http
PATCH {{baseUrl}}/v1/decks/{{deckId}}
Authorization: Bearer {{accessToken}}
```

Body:

```json
{
  "title": "English Vocabulary Updated",
  "description": "Updated description",
  "visibility": "public",
  "tags": ["english", "software", "updated"]
}
```

Ket qua mong doi:

```text
Chi owner moi update duoc.
Response van giu field star theo user dang login.
```

## 6. Card Flow

### 6.1 Create Bulk Cards

Request:

```http
POST {{baseUrl}}/v1/cards/bulk
Authorization: Bearer {{accessToken}}
```

Body:

```json
{
  "cards": [
    {
      "deckId": "{{deckId}}",
      "front": "Consistent",
      "back": "On dinh, nhat quan",
      "hint": "Same behavior every time",
      "explanation": "A consistent API returns predictable response shapes.",
      "imageUrl": "",
      "examples": ["Consistent naming makes the code easier to read."],
      "position": 1
    },
    {
      "deckId": "{{deckId}}",
      "front": "Resilient",
      "back": "Ben bi, khoi phuc tot",
      "hint": "Can recover",
      "explanation": "A resilient service keeps working after temporary failures.",
      "imageUrl": "",
      "examples": ["The resilient worker retries failed jobs."],
      "position": 2
    }
  ]
}
```

Postman se tu luu card dau tien vao:

```text
cardId
```

### 6.2 Get Cards By Deck

Request:

```http
GET {{baseUrl}}/v1/cards/deck/{{deckId}}
Authorization: Bearer {{accessToken}}
```

Ket qua mong doi:

```text
Tra ve danh sach cards trong deck, sap xep theo position.
```

## 7. Study Flow - Flashcard

### 7.1 Start Flashcard Session

Request:

```http
POST {{baseUrl}}/v1/study/sessions
Authorization: Bearer {{accessToken}}
```

Body:

```json
{
  "deckId": "{{deckId}}",
  "mode": "flashcard"
}
```

Postman se tu luu:

```text
studySessionId
studyMode
```

### 7.2 Get Session Items

Request:

```http
GET {{baseUrl}}/v1/study/sessions/{{studySessionId}}/items
Authorization: Bearer {{accessToken}}
```

Ket qua mong doi cho flashcard:

```json
{
  "success": true,
  "data": [
    {
      "cardId": "...",
      "type": "flashcard",
      "front": "Consistent",
      "back": "On dinh, nhat quan",
      "hint": "Same behavior every time",
      "explanation": "A consistent API returns predictable response shapes."
    }
  ]
}
```

Postman se tu luu card dau tien vao:

```text
cardId
```

### 7.3 Log Flashcard Review

Request:

```http
POST {{baseUrl}}/v1/study/reviews
Authorization: Bearer {{accessToken}}
```

Body:

```json
{
  "sessionId": "{{studySessionId}}",
  "cardId": "{{cardId}}",
  "rating": "easy",
  "responseTimeMs": 1200
}
```

Rating hop le:

```text
again | hard | good | easy
```

Ket qua mong doi:

```json
{
  "success": true,
  "data": {
    "reviewId": "...",
    "cardId": "{{cardId}}",
    "isCorrect": true,
    "correctAnswer": "On dinh, nhat quan",
    "progressUpdate": {
      "status": "review",
      "mastery": 25,
      "intervalDays": 7
    }
  }
}
```

## 8. Study Flow - Learn

### 8.1 Start Learn Session

Request:

```http
POST {{baseUrl}}/v1/study/sessions
Authorization: Bearer {{accessToken}}
```

Body:

```json
{
  "deckId": "{{deckId}}",
  "mode": "learn"
}
```

### 8.2 Get Learn Items

Request:

```http
GET {{baseUrl}}/v1/study/sessions/{{studySessionId}}/items
Authorization: Bearer {{accessToken}}
```

Ket qua mong doi:

```json
{
  "cardId": "...",
  "type": "written",
  "prompt": "Consistent",
  "hint": "Same behavior every time"
}
```

### 8.3 Log Written Review

Request:

```http
POST {{baseUrl}}/v1/study/reviews
Authorization: Bearer {{accessToken}}
```

Body:

```json
{
  "sessionId": "{{studySessionId}}",
  "cardId": "{{cardId}}",
  "userAnswer": "On dinh, nhat quan",
  "responseTimeMs": 3200
}
```

Ket qua:

```text
Backend tu cham dung/sai bang userAnswer.
Dung thi rating mac dinh la good.
Sai thi rating la again.
```

## 9. Study Flow - Test

### 9.1 Start Test Session

Body:

```json
{
  "deckId": "{{deckId}}",
  "mode": "test"
}
```

### 9.2 Get Test Items

Request:

```http
GET {{baseUrl}}/v1/study/sessions/{{studySessionId}}/items
Authorization: Bearer {{accessToken}}
```

Ket qua co the gom:

```text
written
multiple_choice
```

Vi du:

```json
{
  "cardId": "...",
  "questionId": "...",
  "type": "multiple_choice",
  "prompt": "Consistent",
  "options": [
    {
      "value": "On dinh, nhat quan",
      "label": "On dinh, nhat quan"
    }
  ]
}
```

### 9.3 Log Test Answer

Request:

```http
POST {{baseUrl}}/v1/study/reviews
Authorization: Bearer {{accessToken}}
```

Body:

```json
{
  "sessionId": "{{studySessionId}}",
  "cardId": "{{cardId}}",
  "userAnswer": "On dinh, nhat quan",
  "responseTimeMs": 2500
}
```

Luu y:

```text
Test mode hien tai log tung cau.
Chua co endpoint submit ca bai test mot lan.
```

## 10. Study Flow - Match

### 10.1 Start Match Session

Body:

```json
{
  "deckId": "{{deckId}}",
  "mode": "match"
}
```

### 10.2 Get Match Items

Request:

```http
GET {{baseUrl}}/v1/study/sessions/{{studySessionId}}/items
Authorization: Bearer {{accessToken}}
```

Ket qua mong doi:

```json
{
  "tileId": "cardId:front",
  "cardId": "cardId",
  "side": "front",
  "text": "Consistent"
}
```

```json
{
  "tileId": "cardId:back",
  "cardId": "cardId",
  "side": "back",
  "text": "On dinh, nhat quan"
}
```

### 10.3 Log Match Pair

Request:

```http
POST {{baseUrl}}/v1/study/reviews
Authorization: Bearer {{accessToken}}
```

Body:

```json
{
  "sessionId": "{{studySessionId}}",
  "cardId": "{{cardId}}",
  "userAnswer": "On dinh, nhat quan",
  "responseTimeMs": 1800
}
```

Luu y:

```text
Match mode hien tai log tung pair.
Chua co endpoint submit ca game, timer, best score.
```

## 11. Card Progress

### 11.1 Get Due Cards

Request:

```http
GET {{baseUrl}}/v1/card-progress/decks/{{deckId}}/due
Authorization: Bearer {{accessToken}}
```

Ket qua:

```text
Tra ve cac card den han on cua user trong deck.
Postman se tu luu card dau tien vao cardId.
```

### 11.2 Get Deck Progress Summary

Request:

```http
GET {{baseUrl}}/v1/card-progress/decks/{{deckId}}/summary
Authorization: Bearer {{accessToken}}
```

Ket qua mong doi:

```json
{
  "success": true,
  "data": {
    "total": 2,
    "new": 0,
    "learning": 1,
    "review": 1,
    "mastered": 0,
    "dueToday": 1
  }
}
```

## 12. Finish Session

Request:

```http
PATCH {{baseUrl}}/v1/study/sessions/{{studySessionId}}/finish
Authorization: Bearer {{accessToken}}
```

Ket qua mong doi:

```json
{
  "success": true,
  "data": {
    "_id": "{{studySessionId}}",
    "finishedAt": "2026-06-11T00:00:00.000Z",
    "stats": {
      "correct": 1,
      "wrong": 0,
      "skipped": 0,
      "timeSpentSec": 60
    }
  }
}
```

Sau khi finish, khong nen log review tiep vao session cu. Hay start session moi.

## 13. Checklist Test Nhanh

### Flashcard

```text
Login
Create Deck
Create Bulk Cards
Study - Start Flashcard Session
Study - Get Session Items
Study - Log Flashcard Review (rating)
Card Progress - Get Deck Progress Summary
Study - Finish Study Session
```

### Learn

```text
Study - Start Learn Session
Study - Get Session Items
Study - Log Written Review (learn/test)
Card Progress - Get Deck Progress Summary
Study - Finish Study Session
```

### Test

```text
Study - Start Test Session
Study - Get Session Items
Study - Log Written Review (learn/test)
Study - Finish Study Session
```

### Match

```text
Study - Start Match Session
Study - Get Session Items
Study - Log Match Pair Review
Study - Finish Study Session
```

## 14. Loi Hay Gap

### 401 Unauthorized

Chay lai:

```text
Authentication -> Login User
```

### Khong co deckId

Chay:

```text
Decks -> Create Deck
```

### Khong co cardId

Chay:

```text
Cards -> Create Bulk Cards
Study - Get Session Items
```

### Flashcard bao thieu rating

Dung request:

```text
Study - Log Flashcard Review (rating)
```

### Learn/Test bao thieu userAnswer

Dung request:

```text
Study - Log Written Review (learn/test)
```

### Private deck khong thay khi khong login

Day la dung. Muon thay private deck cua minh thi phai login va gui Bearer token.
