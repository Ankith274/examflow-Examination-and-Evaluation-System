// flask_app/static/js/app.js — ExamFlow Flask Frontend

const API = {
  base: "/api",
  _headers() {
    const token = localStorage.getItem("token");
    return { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
  },
  async request(method, path, body) {
    try {
      const res  = await fetch(`${this.base}${path}`, { method, headers: this._headers(), ...(body ? { body: JSON.stringify(body) } : {}) });
      const data = await res.json();
      if (!res.ok) throw { status: res.status, message: data.message || "Request failed", data };
      return data;
    } catch (err) {
      if (err.status === 401) { Auth.logout(); return; }
      throw err;
    }
  },
  get:    (path)       => API.request("GET",    path),
  post:   (path, body) => API.request("POST",   path, body),
  put:    (path, body) => API.request("PUT",    path, body),
  delete: (path)       => API.request("DELETE", path),

  login:       (b) => API.post("/auth/login",    b),
  register:    (b) => API.post("/auth/register", b),
  me:          ()  => API.get("/auth/me"),
  exams:       ()  => API.get("/exams/"),
  exam:        (id)=> API.get(`/exams/${id}`),
  startExam:   (id)=> API.post(`/exams/${id}/start`),
  submitExam:  (id,b)=> API.post(`/exams/${id}/submit`, b),
  leaderboard: (id)=> API.get(`/exams/${id}/leaderboard`),
  createExam:  (b) => API.post("/exams/", b),
  updateExam:  (id,b)=> API.put(`/exams/${id}`, b),
  deleteExam:  (id)=> API.delete(`/exams/${id}`),
  publishExam: (id)=> API.post(`/exams/${id}/publish`),
  results:     ()  => API.get("/results/"),
  result:      (id)=> API.get(`/results/${id}`),
  analytics:   ()  => API.get("/results/analytics"),
  users:       ()  => API.get("/users/"),
  dashboard:   ()  => API.get("/users/dashboard"),
  updateProfile:(b)=> API.put("/users/profile", b),
};

const Auth = {
  save(token, user) { localStorage.setItem("token", token); localStorage.setItem("user", JSON.stringify(user)); },
  logout() { localStorage.removeItem("token"); localStorage.removeItem("user"); fetch("/api/auth/logout",{method:"POST"}).catch(()=>{}); window.location.href="/"; },
  user()      { try { return JSON.parse(localStorage.getItem("user")); } catch { return null; } },
  token()     { return localStorage.getItem("token"); },
  isLoggedIn(){ return !!this.token(); },
  isAdmin()   { return this.user()?.role === "admin"; },
  requireAuth()  { if (!this.isLoggedIn()) { window.location.href="/"; return false; } return true; },
  requireAdmin() { if (!this.isLoggedIn()||!this.isAdmin()) { window.location.href="/"; return false; } return true; },
};

const Toast = {
  show(message, type="info", duration=4000) {
    const el = document.getElementById("global-alert");
    if (!el) return;
    el.className=`alert alert-${type}`; el.textContent=message; el.style.display="block";
    clearTimeout(this._t); this._t = setTimeout(()=>{el.style.display="none";},duration);
  },
  success:(m)=>Toast.show(m,"success"),
  error:  (m)=>Toast.show(m,"error",5000),
  warn:   (m)=>Toast.show(m,"warn"),
  info:   (m)=>Toast.show(m,"info"),
};

const $ = (sel,ctx=document)=>ctx.querySelector(sel);
const $$= (sel,ctx=document)=>[...ctx.querySelectorAll(sel)];

function setLoading(btn,loading,label="Loading…"){
  if(!btn)return;
  if(loading){btn._orig=btn.innerHTML;btn.innerHTML=`<span class="spinner"></span> ${label}`;btn.disabled=true;}
  else{btn.innerHTML=btn._orig||btn.innerHTML;btn.disabled=false;}
}

function formatDate(d){
  if(!d)return"—";
  return new Date(d).toLocaleString("en-IN",{dateStyle:"medium",timeStyle:"short"});
}
function formatDuration(m){return m>=60?`${Math.floor(m/60)}h ${m%60}m`:`${m} min`;}
function formatTime(s){const m=Math.floor(s/60).toString().padStart(2,"0"),sec=(s%60).toString().padStart(2,"0");return`${m}:${sec}`;}
function pctColor(p){return p>=70?"green":p>=40?"yellow":"red";}
function gradeColor(g){return{O:"gold","A+":"gold",A:"green","B+":"green",B:"blue",C:"yellow",F:"red"}[g]||"gray";}
function statusBadge(s){
  const m={active:{cls:"badge-green",label:"Active"},upcoming:{cls:"badge-blue",label:"Upcoming"},ended:{cls:"badge-gray",label:"Ended"},draft:{cls:"badge-yellow",label:"Draft"}};
  const x=m[s]||{cls:"badge-gray",label:s};
  return`<span class="badge ${x.cls}">${x.label}</span>`;
}

function openModal(id) { document.getElementById(id)?.classList.add("open"); }
function closeModal(id){ document.getElementById(id)?.classList.remove("open"); }

document.addEventListener("click",(e)=>{
  if(e.target.matches(".modal-overlay")) e.target.classList.remove("open");
  if(e.target.matches(".modal-close")) e.target.closest(".modal-overlay")?.classList.remove("open");
});

function renderNavUser(){
  const user=Auth.user(); const el=document.getElementById("nav-user"); if(!el||!user)return;
  const initials=(user.name||"?").split(" ").map(w=>w[0]).slice(0,2).join("").toUpperCase();
  el.innerHTML=`<span class="text-muted" style="font-size:0.85rem">${user.name}</span>
    <div class="avatar" onclick="Auth.logout()" title="Logout">${initials}</div>`;
}

document.addEventListener("DOMContentLoaded",()=>{ renderNavUser(); });
