# Study Session, Card Review, Card Progress Flow

Tai lieu nay mo ta luong hoc bai trong Quizzy backend. Ba collection lien quan la:

- `study_sessions`: luu mot phien hoc cua user trong mot deck.
- `card_reviews`: luu tung lan user tra loi mot card trong phien hoc.
- `card_progress`: luu trang thai hien tai cua tung card doi voi tung user, dung cho SRS va due cards.

## 1. Y Nghia Tung Bang

### study_sessions

Mot document trong `study_sessions` tuong ung vo hoc mooi mot lan user bam vat deck.

Vi du user vao deck "English Vocabulary", chon mode `flashcard`, hoc 10 card, roi bam ket thuc. Toan bo qua trinh do la mot study session.

Field chinh:

```ts
{
  userId: ObjectId,
  deckId: ObjectId,
  mode: 'flashcard' | 'learn' | 'test' | 'match',
  startedAt: Date,
  finishedAt?: Date,
  stats: {
    correct: number,
    wrong: number,
    skipped: number,
    timeSpentSec: number
  }
}
```

### card_reviews

Mot document trong `card_reviews` tuong ung voi mot lan user review/tra loi mot card.

Neu mot session co 10 card, co the co 10 `card_reviews`.

Field chinh:

```ts
{
  sessionId: ObjectId,
  userId: ObjectId,
  cardId: ObjectId,
  answer?: string,
  isCorrect: boolean,
  rating: 'again' | 'hard' | 'good' | 'easy',
  responseTimeMs: number,
  createdAt: Date
}
```

### card_progress

Mot document trong `card_progress` la trang thai hoc hien tai cua mot user voi mot card.

Bang nay khac `card_reviews`:

- `card_reviews` la lich su tung lan hoc.
- `card_progress` la trang thai moi nhat de biet card nao can on lai.

Field chinh:

```ts
{
  userId: ObjectId,
  cardId: ObjectId,
  deckId: ObjectId,
  mastery: number,
  status: 'new' | 'learning' | 'review' | 'mastered',
  easeFactor: number,
  intervalDays: number,
  dueAt: Date,
  correctCount: number,
  wrongCount: number
}
```

## 2. Flow Toi Thieu

### Buoc 1: Start Study Session

FE goi API khi user bam nut bat dau hoc.

```http
POST /v1/study/sessions
Authorization: Bearer <accessToken>
Content-Type: application/json
```

Body:

```json
{
  "deckId": "{{deckId}}",
  "mode": "flashcard"
}
```

BE lam:

1. Lay `userId` tu token.
2. Check deck ton tai.
3. Neu deck `private`, check user co quyen xem deck.
4. Tao `study_sessions`.
5. Tra ve `sessionId`.

Response mong muon:

```json
{
  "success": true,
  "data": {
    "_id": "{{sessionId}}",
    "userId": "{{userId}}",
    "deckId": "{{deckId}}",
    "mode": "flashcard",
    "stats": {
      "correct": 0,
      "wrong": 0,
      "skipped": 0,
      "timeSpentSec": 0
    },
    "startedAt": "2026-05-29T00:00:00.000Z"
  }
}
```

### Buoc 2: FE Lay Cards De Hoc

Co the dung API card/deck rieng.

```http
GET /v1/decks/:deckId/cards
```

Hoac route hien co:

```http
GET /v1/cards/deck/:deckId
```

BE nen sort theo `position`.

### Buoc 3: Log Card Review

Moi khi user tra loi mot card, FE goi API log review.

```http
POST /v1/study/reviews
Authorization: Bearer <accessToken>
Content-Type: application/json
```

Body:

```json
{
  "sessionId": "{{sessionId}}",
  "cardId": "{{cardId}}",
  "answer": "my answer",
  "isCorrect": true,
  "rating": "good",
  "responseTimeMs": 3200
}
```

BE lam:

1. Lay `userId` tu token.
2. Check session ton tai.
3. Check session thuoc user dang dang nhap.
4. Check card ton tai va thuoc deck cua session.
5. Tao `card_reviews`.
6. Cap nhat `card_progress` cua card do.
7. Cap nhat stats trong `study_sessions`.

Response mong muon:

```json
{
  "success": true,
  "data": {
    "_id": "{{reviewId}}",
    "sessionId": "{{sessionId}}",
    "userId": "{{userId}}",
    "cardId": "{{cardId}}",
    "answer": "my answer",
    "isCorrect": true,
    "rating": "good",
    "responseTimeMs": 3200,
    "createdAt": "2026-05-29T00:00:00.000Z"
  }
}
```

### Buoc 4: Update Card Progress

`card_progress` nen duoc update sau moi review.

Input can co:

```ts
{
  userId: string,
  deckId: string,
  cardId: string,
  isCorrect: boolean,
  rating: 'again' | 'hard' | 'good' | 'easy'
}
```

Logic toi thieu:

```text
again:
  status = learning
  mastery giam hoac giu thap
  intervalDays = 0
  dueAt = now
  wrongCount + 1

hard:
  status = learning hoac review
  mastery tang it
  intervalDays = 1
  dueAt = tomorrow

good:
  status = review
  mastery tang vua
  intervalDays tang
  dueAt = now + intervalDays
  correctCount + 1

easy:
  status = mastered neu mastery cao
  mastery tang nhieu
  intervalDays tang nhieu
  dueAt = now + intervalDays
  correctCount + 1
```

Cong thuc don gian de lam version 1:

```ts
const ratingConfig = {
  again: { masteryDelta: -10, intervalDays: 0, status: 'learning' },
  hard: { masteryDelta: 5, intervalDays: 1, status: 'learning' },
  good: { masteryDelta: 15, intervalDays: 3, status: 'review' },
  easy: { masteryDelta: 25, intervalDays: 7, status: 'review' },
};
```

Sau do clamp mastery:

```ts
mastery = Math.max(0, Math.min(100, mastery));
```

Neu `mastery >= 90`, co the set:

```ts
status = 'mastered';
```

### Buoc 5: Finish Session

Khi user bam ket thuc hoc:

```http
PATCH /v1/study/sessions/:sessionId/finish
Authorization: Bearer <accessToken>
```

BE lam:

1. Check session ton tai.
2. Check session thuoc user dang dang nhap.
3. Set `finishedAt = new Date()`.
4. Co the cap nhat `timeSpentSec` neu FE gui len hoac BE tu tinh tu `startedAt`.
5. Co the cap nhat user streak/points.

Response mong muon:

```json
{
  "success": true,
  "data": {
    "_id": "{{sessionId}}",
    "finishedAt": "2026-05-29T00:10:00.000Z",
    "stats": {
      "correct": 8,
      "wrong": 2,
      "skipped": 0,
      "timeSpentSec": 600
    }
  }
}
```

## 3. API De Xuat

### Study APIs

```http
POST  /v1/study/sessions
POST  /v1/study/reviews
PATCH /v1/study/sessions/:sessionId/finish
GET   /v1/study/sessions
GET   /v1/study/sessions/:sessionId
```

### Card Progress APIs

```http
PUT /v1/card-progress
GET /v1/card-progress/decks/:deckId/due
GET /v1/card-progress/decks/:deckId/summary
```

## 4. Relation Check

Khi log review, nen check day du:

```text
session.userId == currentUser.id
session.deckId == card.deckId
card.deckId == progress.deckId
```

Neu khong check, user co the log review cho card khong thuoc session.

## 5. Suggested Implementation Order

1. Expose `StudyController` routes.
2. Check session owner trong `StudyService`.
3. Log review vao `card_reviews`.
4. Update stats trong `study_sessions`.
5. Expose `CardProgressController` routes.
6. Implement SRS update logic trong `CardProgressService`.
7. Khi log review, goi `CardProgressService` de update progress.
8. Them Postman requests.

## 6. Task Split

### Task A: Study Controller

Lam routes:

```http
POST /v1/study/sessions
POST /v1/study/reviews
PATCH /v1/study/sessions/:sessionId/finish
```

Can dung:

- `JwtAuthGuard`
- `CurrentUser`
- `CreateStudySessionDto`
- `LogCardReviewDto`

### Task B: Session Ownership And Validation

Trong `StudyService`:

- Check session thuoc current user.
- Check card thuoc deck cua session.
- Khong cho finish session cua user khac.

### Task C: Card Progress Controller

Lam routes:

```http
PUT /v1/card-progress
GET /v1/card-progress/decks/:deckId/due
```

### Task D: SRS Logic

Viet ham:

```ts
calculateNextProgress(currentProgress, review)
```

Output:

```ts
{
  mastery,
  status,
  easeFactor,
  intervalDays,
  dueAt,
  correctCount,
  wrongCount
}
```

### Task E: Stats

Lam summary:

```http
GET /v1/card-progress/decks/:deckId/summary
```

Tra ve:

```json
{
  "total": 100,
  "new": 20,
  "learning": 30,
  "review": 40,
  "mastered": 10,
  "dueToday": 12
}
```

## 7. Postman Test Flow

1. `Authentication -> Login User`
2. `Decks -> Create Deck`
3. `Cards -> Create Bulk Cards`
4. `Study -> Start Study Session`
5. `Study -> Log Card Review`
6. `Card Progress -> Get Due Cards`
7. `Study -> Finish Study Session`
8. `Card Progress -> Get Deck Progress Summary`

