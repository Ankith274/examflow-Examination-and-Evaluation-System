# 🎓 ExamFlow — KLH University
### Smart Online Examination Platform · BCA Final Year Project 2026

**Student:** Tankthireddy | **Roll:** 2320520034 | **Dept:** BCA Final Year

---

## 📁 Project Structure

```
examflow-deploy/
├── index.html          ← Landing page (main website)
├── app.html            ← Full exam system (login + dashboards)
├── deploy.html         ← Hosting & deployment guide
├── login.html          ← Login page redirect
├── aws-deploy.sh       ← One-click AWS S3 deploy script
├── netlify.toml        ← Netlify configuration
├── vercel.json         ← Vercel configuration
├── .github/
│   └── workflows/
│       └── deploy.yml  ← GitHub Actions auto-deploy
└── README.md           ← This file
```

---

## 🚀 How to Deploy ExamFlow

### Option 1: AWS S3 (Recommended for BCA Project)

**Prerequisites:** AWS Account + AWS CLI installed

```bash
# Step 1: Configure AWS credentials
aws configure
# Enter: Access Key ID, Secret Key, Region: ap-south-1

# Step 2: Run the deploy script
chmod +x aws-deploy.sh
./aws-deploy.sh

# Your site will be live at:
# http://examflow-klh-university-2026.s3-website.ap-south-1.amazonaws.com
```

**Manual AWS steps (if script doesn't work):**
```bash
# Create bucket
aws s3api create-bucket --bucket examflow-klh-2026 --region ap-south-1 --create-bucket-configuration LocationConstraint=ap-south-1

# Enable website hosting
aws s3 website s3://examflow-klh-2026 --index-document index.html --error-document error.html

# Upload all files
aws s3 sync . s3://examflow-klh-2026/ --delete --exclude ".git/*" --exclude "*.sh"
```

---

### Option 2: Netlify (Easiest — 100% Free)

```bash
# Method A: Drag & drop
# Go to netlify.com → Drop this folder → Done!

# Method B: CLI
npm install -g netlify-cli
netlify login
netlify deploy --prod --dir=.

# Your URL: https://examflow-klh.netlify.app
```

---

### Option 3: Vercel (Best for React projects)

```bash
npm install -g vercel
vercel login
vercel --prod

# Your URL: https://examflow-klh.vercel.app
```

---

### Option 4: GitHub Pages (Free Forever)

```bash
git init
git add .
git commit -m "ExamFlow BCA Project 2026"
git remote add origin https://github.com/YOUR_USERNAME/examflow.git
git push -u origin main

# Then: GitHub → Settings → Pages → Source: main branch
# URL: https://YOUR_USERNAME.github.io/examflow
```

---

### Option 5: Auto-Deploy with GitHub Actions (CI/CD)

1. Push code to GitHub
2. Go to: **Settings → Secrets → Actions** → Add:
   - `AWS_ACCESS_KEY_ID`
   - `AWS_SECRET_ACCESS_KEY`
   - `CF_DISTRIBUTION_ID` (optional, for CloudFront)
3. Every `git push` to `main` → auto-deploys to AWS S3!

---

## 🌐 Pages

| Page | URL | Description |
|------|-----|-------------|
| Landing Page | `/index.html` | Marketing website |
| Full App | `/app.html` | Complete exam system |
| Deploy Guide | `/deploy.html` | Hosting tutorial |
| Login | `/login.html` | Student/Teacher login |

---

## 👥 Demo Credentials

| Role | Username | Password |
|------|----------|----------|
| 👨‍🏫 Teacher | teacher@klh.edu | pass123 |
| 🏛️ Faculty Admin | faculty@klh.edu | pass123 |
| 🎓 Tankthireddy | 2320520034 | pass123 |
| 🎓 Ravi Shankar | 2320520035 | pass123 |
| 🎓 Priya Reddy | 2320520036 | pass123 |

---

## ☁️ AWS Architecture

```
Users → CloudFront (CDN + HTTPS)
          ↓
       S3 Bucket (Static Website Hosting)
       ├── index.html   (Landing Page)
       ├── app.html     (ExamFlow System)
       ├── deploy.html  (Deploy Guide)
       └── login.html   (Auth Page)
```

**AWS Services Used:**
- **S3** — Static file storage + website hosting
- **CloudFront** — Global CDN + free SSL/HTTPS
- **Route 53** — Custom domain DNS (optional)
- **ACM** — Free SSL certificate (optional)

---

## 📊 Features

- ✅ AI-Powered Proctoring (Tab switch, face detection, noise)
- ✅ Real-time Violation Logging with severity levels
- ✅ Multi-role: Student, Teacher, HOD, Faculty Admin
- ✅ Live exam engine with timer and question navigation
- ✅ Complete BCA Final Year subject exams (8 subjects)
- ✅ Student profile, results, schedule, study materials
- ✅ Violation report with CSV export
- ✅ Responsive design (mobile + desktop)
- ✅ Zero dependencies — pure HTML/CSS/JS

---

## 📋 BCA Subjects Covered

| Code | Subject | Type |
|------|---------|------|
| BCA-601 | Advanced DBMS | Active |
| BCA-602 | Software Engineering | Active |
| BCA-603 | Web Development & Design | Active |
| BCA-604 | Computer Networks | Active |
| BCA-605 | Operating Systems | Closed |
| BCA-606 | Python Programming | Closed |
| BCA-607 | AI & ML Fundamentals | Draft |
| BCA-608 | Cloud Computing | Draft |

---

## 🏗️ Tech Stack

- **Frontend:** HTML5, CSS3, Vanilla JavaScript
- **Fonts:** Syne (headings) + DM Sans (body) — Google Fonts
- **Hosting:** AWS S3 + CloudFront / Netlify / Vercel
- **CI/CD:** GitHub Actions
- **Containerization:** Docker (optional)

---

## 👨‍💻 Developer Info

| Field | Value |
|-------|-------|
| Student | Tankthireddy |
| Roll No | 2320520034 |
| Programme | BCA Final Year |
| Semester | 6 (Final) |
| Section | BCA-A |
| University | KLH University, Hyderabad |
| Guide | Dr. Vikram Singh (HOD) |
| Year | 2023 – 2026 |

---

*ExamFlow — Transforming Online Examinations · KLH University 2026*
