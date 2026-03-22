# ExamFlow — BCA 2023-2026 React Application

A complete, production-grade online exam evaluation system for BCA students.

## Quick Start

```bash
npm install
npm start        # http://localhost:3000
npm run build    # Production build
```

## Demo Accounts

| Student        | Roll No.   | Password   |
|----------------|------------|------------|
| Ankith Reddy   | 2320520034 | ankith123  |
| Priya Sharma   | 2320520035 | priya123   |
| Ravi Kumar     | 2320520036 | ravi123    |
| Sneha Patel    | 2320520037 | sneha123   |
| Admin User     | admin      | admin123   |

## Routes

| Path         | Component      | Guard          |
|--------------|----------------|----------------|
| `/auth`      | AuthPage       | Redirect if authed |
| `/dashboard` | DashboardPage  | RequireAuth    |
| `/exam`      | ExamPage       | RequireAuth + RequireExam |
| `/results`   | ResultsPage    | RequireAuth + RequireResult |

## Project Structure

```
src/
├── App.jsx                      # BrowserRouter + route guards + Toast
├── index.js                     # ReactDOM entry point
├── styles/
│   └── globals.css              # CSS variables, keyframes, reset
├── data/
│   └── questions.js             # 200 main + 100 mock MCQs + DEMO_ACCOUNTS
├── context/
│   └── AppContext.jsx           # useReducer state, login/register/exam logic
├── hooks/
│   ├── useExam.js               # useExamTimer, useExamNavigation, useAnswerSheet, useProctoringMonitor
│   └── useCamera.js             # getUserMedia + canvas demo fallback
├── utils/
│   ├── helpers.js               # pad, formatDuration, getGrade, validators, clsx
│   └── scoring.js               # evaluateExam, subjectPercent
├── components/
│   ├── ui/
│   │   ├── Button.jsx           # primary / secondary / danger / ghost / warn variants
│   │   ├── Input.jsx            # label + error + hint
│   │   ├── Badge.jsx            # success / warning / danger / info / teal
│   │   └── Toast.jsx            # fixed toast with auto-dismiss
│   ├── auth/
│   │   ├── LoginForm.jsx        # demo tiles + one-click login
│   │   └── RegisterForm.jsx     # full validation + password strength + avatar
│   ├── exam/
│   │   ├── QuestionCard.jsx     # question with 4 options, flag, difficulty tag
│   │   ├── QuestionGrid.jsx     # 5-column navigator grid with answer state colours
│   │   └── SubjectTabs.jsx      # 5 subject tabs with per-tab answer count
│   └── proctoring/
│       └── CameraFeed.jsx       # real webcam + canvas demo silhouette fallback
└── pages/
    ├── AuthPage.jsx             # 2-column: branding + login/register form
    ├── DashboardPage.jsx        # nav + welcome + stats + exam cards + profile
    ├── ExamPage.jsx             # 3-column: sidebar + question + timer/camera
    └── ResultsPage.jsx          # score ring + recharts bar + subject cards + detail table
```

## Design System

CSS variables in `globals.css`:

| Variable   | Value     | Usage                   |
|------------|-----------|-------------------------|
| `--bg`     | `#04070e` | Page background         |
| `--sf`     | `#0b1221` | Card surfaces           |
| `--a`      | `#4f7ef8` | Primary accent (blue)   |
| `--tl`     | `#0fb8a4` | Secondary accent (teal) |
| `--safe`   | `#1db854` | Pass / correct          |
| `--warn`   | `#f0a500` | Warning                 |
| `--danger` | `#e8404a` | Fail / wrong            |
| `--ds`     | `#4f7ef8` | Data Science subject    |
| `--os`     | `#0fb8a4` | Operating Systems       |
| `--js`     | `#e8c848` | JavaScript              |
| `--dsa`    | `#a855f7` | Data Structures         |
| `--ml`     | `#f97316` | ML & Algorithms         |

Fonts: **Syne** (display) · **Karla** (body) · **JetBrains Mono** (code/numbers)

## Key Technical Decisions

- **No localStorage** — all state in-memory via `useReducer` in `AppContext`
- **Camera** — `getUserMedia` with canvas demo silhouette fallback (works on `file://`)
- **Questions** — 200 main + 100 mock inline in `data/questions.js` (no fetch required)
- **Auth** — in-memory `Map` seeded with 5 demo accounts; register adds to the Map
- **Route guards** — `RequireAuth`, `RequireExam`, `RequireResult`, `RedirectIfAuthed`
- **Scoring** — subject-wise breakdown + grade + rank computed client-side in `scoring.js`
- **Proctoring** — `visibilitychange` violation listener + camera feed + violation log

## Exam Flow

1. Login → Dashboard
2. Click "Start" on an exam → `startExam()` sets `examSession`
3. `/exam` loads with 3-column layout: subject navigator | question | timer+camera
4. Answer, flag, navigate with subject tabs or grid
5. Submit → `submitExam()` evaluates answers, navigates to `/results`
6. Results shows score ring, recharts bar chart, subject breakdown, full detail table

## Dependencies

```json
{
  "react":           "^18.2.0",
  "react-dom":       "^18.2.0",
  "react-router-dom":"^6.22.0",
  "recharts":        "^2.12.0",
  "lucide-react":    "^0.383.0",
  "clsx":            "^2.1.0"
}
```
