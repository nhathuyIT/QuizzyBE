# Study API Test Flow

Tai lieu nay mo ta luong API study hien tai cua backend Quizzy va cach chay bang Postman. File Postman duoc cap nhat tai `Quizzy.postman_collection.json`.

## 1. Tong Quan Flow

Study flow hien tai gom 4 nhom API:

1. Chuan bi du lieu: login, tao deck, tao cards.
2. Bat dau phien hoc: tao `study_session` voi mode mong muon.
3. Lay noi dung hoc: backend tra ve item theo mode.
4. Log review: frontend gui dap an hoac rating, backend cap nhat `card_reviews`, `study_sessions.stats`, va `card_progress`.

```text
Login
-> Create Deck
-> Create Card / Create Bulk Cards
-> Start Study Session
-> Get Session Items
-> Log Review
-> Get Progress Summary
-> Finish Study Session
```

Tat ca API study va card progress deu can header:

```http
Authorization: Bearer <accessToken>
```

Response cua he thong duoc boc boi `TransformInterceptor`, nen shape chung la:

```json
{
  "success": true,
  "data": {}
}
```

Neu endpoint tra ve phan trang thi co them `meta`.

## 2. Chuan Bi Trong Postman

Import collection:

```text
Quizzy.postman_collection.json
```

Collection variables can quan tam:

| Variable | Y nghia |
| --- | --- |
| `baseUrl` | Mac dinh `http://localhost:3001` |
| `accessToken` | Duoc luu sau request `Authentication -> Login User` |
| `deckId` | Duoc luu sau `Decks -> Create Deck` |
| `cardId` | Duoc luu sau `Cards -> Create Card`, `Create Bulk Cards`, `Study - Get Session Items`, hoac `Card Progress - Get Due Cards` |
| `studySessionId` | Duoc luu sau request start session |
| `studyMode` | Duoc luu sau request start session |
| `reviewId` | Duoc luu sau request log review |

Thu tu chay co ban trong Postman:

1. `Authentication -> Login User`
2. `Decks -> Create Deck`
3. `Cards -> Create Card` hoac `Cards -> Create Bulk Cards`
4. Chon mot request start session trong `Study Flow`
5. `Study Flow -> Study - Get Session Items`
6. Log review phu hop voi mode
7. `Card Progress - Get Deck Progress Summary`
8. `Study - Finish Study Session`

## 3. API Start Session

Endpoint:

```http
POST /v1/study/sessions
```

Body:

```json
{
  "deckId": "{{deckId}}",
  "mode": "flashcard"
}
```

`mode` hop le:

```text
flashcard | learn | test | match
```

Backend xu ly:

1. Lay `userId` tu JWT.
2. Check deck ton tai.
3. Neu deck la `private`, chi owner moi duoc hoc.
4. Tao document trong `study_sessions`.
5. Tra ve session va Postman luu `_id` vao `studySessionId`.

Response mau:

```json
{
  "success": true,
  "data": {
    "_id": "sessionId",
    "userId": "userId",
    "deckId": "deckId",
    "mode": "flashcard",
    "startedAt": "2026-06-11T00:00:00.000Z",
    "stats": {
      "correct": 0,
      "wrong": 0,
      "skipped": 0,
      "timeSpentSec": 0
    }
  }
}
```

Postman co 4 request start san:

```text
Study - Start Flashcard Session
Study - Start Learn Session
Study - Start Test Session
Study - Start Match Session
```

## 4. API Lay Item Theo Mode

Endpoint:

```http
GET /v1/study/sessions/{{studySessionId}}/items
```

Backend xu ly:

1. Check session ton tai.
2. Check session thuoc current user.
3. Lay cards trong deck cua session.
4. Neu mode la `learn`, uu tien cards den han tu `card_progress`.
5. Build response theo mode bang `StudyItemsBuilder`.

### 4.1 Flashcard Items

Response item:

```json
{
  "cardId": "cardId",
  "type": "flashcard",
  "front": "Consistent",
  "back": "On dinh, nhat quan",
  "hint": "Same behavior every time",
  "explanation": "A consistent API returns predictable response shapes.",
  "imageUrl": ""
}
```

Frontend dung `front/back` de flip card. Khi user tu danh gia muc do nho, goi log review bang `rating`.

### 4.2 Learn Items

Response item:

```json
{
  "cardId": "cardId",
  "type": "written",
  "prompt": "Consistent",
  "hint": "Same behavior every time"
}
```

Frontend hien prompt, user nhap dap an. Backend se so sanh `userAnswer` voi `card.back`.

### 4.3 Test Items

Response co the gom `written` va `multiple_choice`:

```json
{
  "cardId": "cardId",
  "questionId": "cardId",
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

Hien tai test mode la ban v1: backend sinh cau hoi, nhung chua co endpoint submit ca bai mot lan. Frontend log tung cau qua `POST /v1/study/reviews`.

### 4.4 Match Items

Response la danh sach tile da shuffle:

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

Frontend render game matching tu cac tile nay. Hien tai backend chua co endpoint rieng de submit ca game match, timer, hoac score tong. Ban v1 co the log tung pair bang `POST /v1/study/reviews`.

## 5. API Log Review

Endpoint:

```http
POST /v1/study/reviews
```

Backend luon check:

1. Session ton tai.
2. Session thuoc current user.
3. Card ton tai.
4. Card thuoc deck cua session.
5. Session chua finish.

Sau do backend:

1. Tinh `isCorrect`.
2. Tao `card_reviews`.
3. Cap nhat `card_progress` bang SRS.
4. Tang `study_sessions.stats.correct` hoac `study_sessions.stats.wrong`.
5. Tra ve ket qua review.

### 5.1 Flashcard Review

Dung khi session mode la `flashcard`.

Body:

```json
{
  "sessionId": "{{studySessionId}}",
  "cardId": "{{cardId}}",
  "rating": "easy",
  "responseTimeMs": 1200
}
```

`rating` hop le:

```text
again | hard | good | easy
```

Backend khong can `userAnswer` trong flashcard mode.

Mapping hien tai:

| Rating | isCorrect | SRS |
| --- | --- | --- |
| `again` | false | mastery -10, due today |
| `hard` | true | mastery +5, due in 1 day |
| `good` | true | mastery +15, due in 3 days |
| `easy` | true | mastery +25, due in 7 days |

### 5.2 Learn/Test Written Review

Dung khi session mode la `learn`, `test`, hoac khi can cham dap an text.

Body:

```json
{
  "sessionId": "{{studySessionId}}",
  "cardId": "{{cardId}}",
  "userAnswer": "On dinh, nhat quan",
  "responseTimeMs": 3200
}
```

Backend so sanh:

```text
normalize(userAnswer) === normalize(card.back)
```

Normalize hien tai:

```text
trim -> gom nhieu whitespace thanh 1 space -> lowercase
```

Neu dung:

```text
rating = request.rating || good
```

Neu sai:

```text
rating = again
```

### 5.3 Match Pair Review

Dung tam cho mode `match` ban v1.

Body:

```json
{
  "sessionId": "{{studySessionId}}",
  "cardId": "{{cardId}}",
  "userAnswer": "On dinh, nhat quan",
  "responseTimeMs": 1800
}
```

Frontend gui `cardId` cua pair dang check va `userAnswer` la text cua tile back user chon. Backend cham nhu written review.

Response mau:

```json
{
  "success": true,
  "data": {
    "reviewId": "reviewId",
    "cardId": "cardId",
    "isCorrect": true,
    "correctAnswer": "On dinh, nhat quan",
    "explanation": "A consistent API returns predictable response shapes.",
    "progressUpdate": {
      "status": "review",
      "mastery": 15,
      "easeFactor": 2.5,
      "intervalDays": 3,
      "dueAt": "2026-06-14T00:00:00.000Z"
    }
  }
}
```

## 6. Card Progress APIs

### 6.1 Get Due Cards

Endpoint:

```http
GET /v1/card-progress/decks/{{deckId}}/due
```

Dung de lay card den han on. Backend se initialize progress mac dinh cho cards trong deck neu user chua co progress.

Response la danh sach `card_progress` co:

```text
dueAt <= now
```

Postman request nay tu dong luu card dau tien vao `cardId`.

### 6.2 Get Deck Progress Summary

Endpoint:

```http
GET /v1/card-progress/decks/{{deckId}}/summary
```

Response mau:

```json
{
  "success": true,
  "data": {
    "total": 10,
    "new": 4,
    "learning": 2,
    "review": 3,
    "mastered": 1,
    "dueToday": 5
  }
}
```

### 6.3 Upsert Progress

Endpoint:

```http
PUT /v1/card-progress
```

Body:

```json
{
  "cardId": "{{cardId}}",
  "deckId": "{{deckId}}",
  "mastery": 50,
  "status": "learning",
  "easeFactor": 2.5,
  "intervalDays": 1,
  "dueAt": "2026-06-11T00:00:00.000Z",
  "correctCount": 1,
  "wrongCount": 0
}
```

API nay phu hop cho test/debug/admin flow. Luong hoc binh thuong nen cap nhat progress thong qua `POST /v1/study/reviews`.

## 7. Finish Session

Endpoint:

```http
PATCH /v1/study/sessions/{{studySessionId}}/finish
```

Backend:

1. Check session thuoc current user.
2. Tinh `timeSpentSec = now - startedAt`.
3. Set `finishedAt`.
4. Tra ve session da finish.

Sau khi finish, neu tiep tuc log review vao session do, backend tra loi:

```text
400 Study session is already finished
```

## 8. Cach Giai Thich Cho Nguoi Khac

Co the giai thich ngan gon nhu sau:

```text
Deck la bo bai, Card la tung flashcard.
Khi user bam hoc, backend tao StudySession voi mode: flashcard, learn, test, hoac match.
Sau do frontend goi Get Session Items de lay danh sach item da format theo mode.
Moi lan user tra loi hoac danh gia mot card, frontend goi Log Review.
Log Review se tao lich su trong card_reviews, cap nhat stats cua study_sessions, va cap nhat card_progress de tinh card nao den han on tiep.
```

Vai tro cua 3 collection study:

| Collection | Vai tro |
| --- | --- |
| `study_sessions` | Luu mot lan user vao hoc mot deck |
| `card_reviews` | Luu tung lan user tra loi/danh gia card |
| `card_progress` | Luu trang thai moi nhat cua user voi card, dung cho SRS va due cards |

## 9. Loi Hay Gap Khi Test

### Thieu token

Chay lai:

```text
Authentication -> Login User
```

### Thieu deckId

Chay:

```text
Decks -> Create Deck
```

### Thieu cardId

Chay mot trong cac request:

```text
Cards -> Create Card
Cards -> Create Bulk Cards
Study Flow -> Study - Get Session Items
Study Flow -> Card Progress - Get Due Cards
```

### Flashcard bi loi `rating is required`

Session dang la `flashcard`, request log review phai gui:

```json
{
  "rating": "easy"
}
```

### Learn/Test bi loi `userAnswer is required`

Session dang la `learn`, `test`, hoac `match`, request log review phai gui:

```json
{
  "userAnswer": "dap an cua user"
}
```

### Log review sau khi finish

Tao session moi bang mot trong cac request:

```text
Study - Start Flashcard Session
Study - Start Learn Session
Study - Start Test Session
Study - Start Match Session
```

## 10. Gioi Han Hien Tai

Hien tai backend da co luong v1 cho 4 mode, nhung con cac gioi han sau:

1. `test` chua co endpoint submit ca bai va tinh score tong.
2. `match` chua co endpoint submit ca game, luu timer, best score.
3. `learn` moi uu tien due cards, chua co thuat toan chon cau tiep theo phuc tap.
4. Multiple choice options lay tu cac card cung deck va shuffle don gian.

Day la nen tang tot cho MVP. Buoc tiep theo nen la them `POST /v1/study/tests/submit` va `POST /v1/study/match/finish` neu frontend can score tong theo mode.
