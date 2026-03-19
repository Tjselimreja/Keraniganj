// app.js — Keraniganj.com | Rewritten & Bug Fixed

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  getFirestore, collection, addDoc, getDocs, getDoc,
  query, orderBy, where, serverTimestamp,
  updateDoc, deleteDoc, doc, increment, setDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ── Firebase Init ──
const firebaseConfig = {
  apiKey: "AIzaSyBHagEJrvZCyD8XHIqdNzGE39hr7jiDiQw",
  authDomain: "keraniganj-dbf1b.firebaseapp.com",
  projectId: "keraniganj-dbf1b",
  storageBucket: "keraniganj-dbf1b.firebasestorage.app",
  messagingSenderId: "252291358700",
  appId: "1:252291358700:web:4a2318ccf1d172152b2ac9"
};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

// ── State ──
let currentUser = null;
let currentPage = 'home';

// ── Auth ──
onAuthStateChanged(auth, (user) => {
  currentUser = user;
  updateAuthUI(user);
});

function updateAuthUI(user) {
  const loginBtn = document.getElementById('login-btn');
  const userInfo = document.getElementById('user-info');
  const userAvatar = document.getElementById('user-avatar');
  if (user) {
    if (loginBtn) loginBtn.style.display = 'none';
    if (userInfo) userInfo.style.display = 'flex';
    if (userAvatar && user.photoURL) userAvatar.src = user.photoURL;
  } else {
    if (loginBtn) loginBtn.style.display = 'flex';
    if (userInfo) userInfo.style.display = 'none';
  }
}

window.googleLogin = async function () {
  try {
    await signInWithPopup(auth, provider);
    showToast('স্বাগতম! লগইন সফল হয়েছে ✅');
    closeLoginModal();
  } catch {
    showToast('লগইন ব্যর্থ হয়েছে। আবার চেষ্টা করুন।');
  }
};

window.logout = async function () {
  await signOut(auth);
  showToast('লগআউট সফল হয়েছে');
};

// ── Login Modal ──
function showLoginModal() {
  const overlay = document.getElementById('modal-login');
  if (overlay) overlay.classList.add('open');
}
function closeLoginModal() {
  const overlay = document.getElementById('modal-login');
  if (overlay) overlay.classList.remove('open');
}
window.closeLoginModal = closeLoginModal;

function requireLogin(action) {
  if (!currentUser) {
    showToast('এই কাজের জন্য লগইন করুন');
    setTimeout(showLoginModal, 600);
    return false;
  }
  return true;
}

// ── Navigation ──
window.goPage = function (name) {
  currentPage = name;
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('page-' + name)?.classList.add('active');
  document.getElementById('nav-' + name)?.classList.add('active');
  window.scrollTo(0, 0);
  if (name === 'news') loadNews();
  if (name === 'complaint') loadComplaints();
  if (name === 'home') loadHomePreview();
};

// ══════════════════════════
// NEWS
// ══════════════════════════

async function loadNews() {
  const container = document.getElementById('news-container');
  if (!container) return;
  container.innerHTML = '<div style="text-align:center;padding:30px;color:var(--text-3)">লোড হচ্ছে...</div>';
  try {
    // শুধু approved পোস্ট দেখাবে
    const q = query(
      collection(db, 'news'),
      where('status', '==', 'approved'),
      orderBy('createdAt', 'desc')
    );
    const snapshot = await getDocs(q);
    if (snapshot.empty) {
      container.innerHTML = '<div style="text-align:center;padding:30px;color:var(--text-3)">এখনো কোনো পোস্ট নেই</div>';
      return;
    }
    container.innerHTML = '';
    snapshot.forEach(docSnap => {
      const d = docSnap.data();
      const id = docSnap.id;
      const authorName = d.anonymous ? '익명 নাগরিক' : (d.authorName || 'অজ্ঞাত');
      const authorPhoto = d.anonymous ? '' : (d.authorPhoto || '');
      const avatarHtml = authorPhoto
        ? `<img src="${authorPhoto}" style="width:38px;height:38px;border-radius:50%;object-fit:cover">`
        : '👤';
      container.innerHTML += `
        <div class="card news-full-card">
          <div class="news-header">
            <div class="news-author">
              <div class="author-avatar">${avatarHtml}</div>
              <div>
                <div class="author-name">${authorName}</div>
                <div class="author-time">${getTimeAgo(d.createdAt)} • ${d.category || 'সাধারণ'}</div>
              </div>
            </div>
          </div>
          ${d.title ? `<div style="font-size:15px;font-weight:700;padding:0 14px 6px;font-family:'Hind Siliguri',sans-serif">${d.title}</div>` : ''}
          <div class="news-body">${d.body}</div>
          <div class="news-actions">
            <button class="news-action" id="like-btn-${id}" onclick="likePost('${id}', this)">👍 ${d.likes || 0}</button>
            <button class="news-action" onclick="toggleComments('${id}')">💬 ${d.commentCount || 0} মন্তব্য</button>
            <button class="news-action" onclick="sharePost()">↗️ শেয়ার</button>
          </div>
          <div class="comment-section" id="comments-${id}" style="display:none;border-top:1px solid var(--border);padding:10px 14px">
            <div id="comment-list-${id}"></div>
            <div style="display:flex;gap:8px;margin-top:8px">
              <input id="comment-input-${id}" class="form-input" placeholder="মন্তব্য লিখুন..." style="flex:1;padding:8px 12px;font-size:13px">
              <button onclick="submitComment('${id}')" style="background:var(--primary);color:white;border:none;border-radius:8px;padding:8px 14px;font-size:13px;font-weight:600;cursor:pointer;font-family:'Hind Siliguri',sans-serif">পাঠান</button>
            </div>
          </div>
        </div>`;
    });
  } catch (err) {
    console.error(err);
    container.innerHTML = '<div style="text-align:center;padding:30px;color:var(--danger)">ডেটা লোড করতে সমস্যা হয়েছে</div>';
  }
}

window.submitPost = async function () {
  if (!requireLogin()) return;
  const title = document.getElementById('post-title').value.trim();
  const body = document.getElementById('post-body').value.trim();
  const category = document.getElementById('post-category').value;
  const anonymous = document.getElementById('anon-post').classList.contains('on');
  if (!title || !body) { showToast('শিরোনাম ও বিবরণ দিন'); return; }
  const btn = document.getElementById('submit-post-btn');
  btn.disabled = true; btn.textContent = 'পাঠানো হচ্ছে...';
  try {
    await addDoc(collection(db, 'news'), {
      title, body, category, anonymous,
      authorName: anonymous ? null : currentUser.displayName,
      authorPhoto: anonymous ? null : currentUser.photoURL,
      authorId: currentUser.uid,
      likes: 0,
      commentCount: 0,
      status: 'pending',   // ← সবসময় pending
      verified: false,
      createdAt: serverTimestamp()
    });
    closeModal('modal-post');
    showToast('পোস্ট জমা হয়েছে! Admin অনুমোদনের পর দেখাবে ✅');
    document.getElementById('post-title').value = '';
    document.getElementById('post-body').value = '';
  } catch { showToast('পোস্ট করতে সমস্যা হয়েছে'); }
  finally { btn.disabled = false; btn.textContent = 'পোস্ট সাবমিট করুন'; }
};

// ── Like (একবারই) ──
window.likePost = async function (id, btn) {
  if (!requireLogin()) return;
  const uid = currentUser.uid;
  const likeRef = doc(db, 'news', id, 'likes', uid);
  try {
    const existing = await getDoc(likeRef);
    if (existing.exists()) {
      showToast('আপনি ইতিমধ্যে লাইক দিয়েছেন'); return;
    }
    await setDoc(likeRef, { likedAt: serverTimestamp() });
    await updateDoc(doc(db, 'news', id), { likes: increment(1) });
    const count = parseInt(btn.textContent.replace('👍 ', '')) + 1;
    btn.textContent = `👍 ${count}`;
    btn.style.color = 'var(--primary)';
    btn.style.fontWeight = '700';
  } catch { showToast('সমস্যা হয়েছে'); }
};

// ── Comments ──
window.toggleComments = async function (id) {
  const section = document.getElementById(`comments-${id}`);
  if (!section) return;
  if (section.style.display === 'none') {
    section.style.display = 'block';
    loadCommentList(id);
  } else {
    section.style.display = 'none';
  }
};

async function loadCommentList(postId) {
  const listEl = document.getElementById(`comment-list-${postId}`);
  if (!listEl) return;
  listEl.innerHTML = '<div style="font-size:12px;color:var(--text-3);padding:4px 0">লোড হচ্ছে...</div>';
  try {
    const q = query(collection(db, 'news', postId, 'comments'), orderBy('createdAt', 'asc'));
    const snap = await getDocs(q);
    if (snap.empty) { listEl.innerHTML = '<div style="font-size:12px;color:var(--text-3);padding:4px 0">এখনো কোনো মন্তব্য নেই</div>'; return; }
    listEl.innerHTML = '';
    snap.forEach(d => {
      const data = d.data();
      listEl.innerHTML += `
        <div style="padding:6px 0;border-bottom:1px solid var(--border)">
          <div style="font-size:12px;font-weight:600;color:var(--text-2);font-family:'DM Sans',sans-serif">${data.anonymous ? '익명' : (data.authorName || 'অজ্ঞাত')} <span style="font-weight:400;color:var(--text-3)">${getTimeAgo(data.createdAt)}</span></div>
          <div style="font-size:13px;color:var(--text);margin-top:2px;font-family:'Hind Siliguri',sans-serif">${data.body}</div>
        </div>`;
    });
  } catch { listEl.innerHTML = '<div style="font-size:12px;color:var(--danger)">লোড করতে সমস্যা</div>'; }
}

window.submitComment = async function (postId) {
  if (!requireLogin()) return;
  const input = document.getElementById(`comment-input-${postId}`);
  const body = input?.value.trim();
  if (!body) { showToast('মন্তব্য লিখুন'); return; }
  try {
    await addDoc(collection(db, 'news', postId, 'comments'), {
      body,
      authorName: currentUser.displayName,
      authorId: currentUser.uid,
      anonymous: false,
      createdAt: serverTimestamp()
    });
    await updateDoc(doc(db, 'news', postId), { commentCount: increment(1) });
    input.value = '';
    loadCommentList(postId);
    showToast('মন্তব্য যোগ হয়েছে ✅');
  } catch { showToast('মন্তব্য করতে সমস্যা হয়েছে'); }
};

// ══════════════════════════
// COMPLAINTS
// ══════════════════════════

async function loadComplaints() {
  const container = document.getElementById('complaint-container');
  if (!container) return;
  container.innerHTML = '<div style="text-align:center;padding:30px;color:var(--text-3)">লোড হচ্ছে...</div>';
  try {
    const q = query(collection(db, 'complaints'), orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    let pending = 0, progress = 0, solved = 0;
    snapshot.forEach(d => {
      const s = d.data().status;
      if (s === 'pending') pending++;
      else if (s === 'progress') progress++;
      else if (s === 'solved') solved++;
    });
    const el = id => document.getElementById(id);
    if (el('stat-pending')) el('stat-pending').textContent = pending;
    if (el('stat-progress')) el('stat-progress').textContent = progress;
    if (el('stat-solved')) el('stat-solved').textContent = solved;

    if (snapshot.empty) {
      container.innerHTML = '<div style="text-align:center;padding:30px;color:var(--text-3)">এখনো কোনো অভিযোগ নেই</div>';
      return;
    }
    container.innerHTML = '';
    snapshot.forEach(docSnap => {
      const d = docSnap.data();
      const id = docSnap.id;
      const statusMap = {
        pending: ['badge-pending', 'অপেক্ষমাণ'],
        progress: ['badge-progress', 'চলমান'],
        solved: ['badge-solved', 'সমাধান']
      };
      const [badgeClass, badgeText] = statusMap[d.status] || ['badge-pending', 'অপেক্ষমাণ'];
      const catIcons = { রাস্তা:'🛣️', পানি:'💧', বিদ্যুৎ:'⚡', দুর্নীতি:'🚫', বর্জ্য:'🗑️', শিক্ষা:'🏫' };
      const icon = catIcons[d.category] || '📋';
      container.innerHTML += `
        <div class="card complaint-card">
          <div class="complaint-header">
            <div class="complaint-cat">${icon} ${d.category}</div>
            <span class="badge ${badgeClass}">${badgeText}</span>
          </div>
          <div class="complaint-title">${d.title}</div>
          <div class="complaint-body">${d.body}</div>
          <div class="complaint-footer">
            <span class="complaint-meta">${d.anonymous ? '익명' : (d.authorName || 'অজ্ঞাত')} • ${getTimeAgo(d.createdAt)}</span>
            <button class="upvote-btn" onclick="upvoteComplaint('${id}', this)">👍 ${d.votes || 0} ভোট</button>
          </div>
        </div>`;
    });
  } catch (err) {
    console.error(err);
    container.innerHTML = '<div style="text-align:center;padding:30px;color:var(--danger)">ডেটা লোড করতে সমস্যা হয়েছে</div>';
  }
}

window.submitComplaint = async function () {
  if (!requireLogin()) return;
  const title = document.getElementById('complaint-title').value.trim();
  const body = document.getElementById('complaint-body').value.trim();
  const category = document.querySelector('#cat-grid .cat-option.selected')?.dataset.cat || 'রাস্তা';
  const anonymous = document.getElementById('anon-complaint').classList.contains('on');
  if (!title || !body) { showToast('শিরোনাম ও বিবরণ দিন'); return; }
  const btn = document.getElementById('submit-complaint-btn');
  btn.disabled = true; btn.textContent = 'পাঠানো হচ্ছে...';
  try {
    await addDoc(collection(db, 'complaints'), {
      title, body, category, anonymous,
      authorName: anonymous ? null : currentUser.displayName,
      authorId: currentUser.uid,
      status: 'pending',
      votes: 0,
      createdAt: serverTimestamp()
    });
    closeModal('modal-complaint');
    showToast('অভিযোগ সফলভাবে জমা হয়েছে ✅');
    document.getElementById('complaint-title').value = '';
    document.getElementById('complaint-body').value = '';
    loadComplaints();
  } catch { showToast('জমা দিতে সমস্যা হয়েছে'); }
  finally { btn.disabled = false; btn.textContent = 'অভিযোগ জমা দিন'; }
};

// ── Upvote (একবারই) ──
window.upvoteComplaint = async function (id, btn) {
  if (!requireLogin()) return;
  const uid = currentUser.uid;
  const voteRef = doc(db, 'complaints', id, 'votes', uid);
  try {
    const existing = await getDoc(voteRef);
    if (existing.exists()) { showToast('আপনি ইতিমধ্যে ভোট দিয়েছেন'); return; }
    await setDoc(voteRef, { votedAt: serverTimestamp() });
    await updateDoc(doc(db, 'complaints', id), { votes: increment(1) });
    const count = parseInt(btn.textContent.replace('👍 ', '').replace(' ভোট', '')) + 1;
    btn.textContent = `👍 ${count} ভোট`;
    btn.style.color = 'var(--primary)';
  } catch { showToast('সমস্যা হয়েছে'); }
};

// ── Home Preview ──
async function loadHomePreview() {
  try {
    const q = query(collection(db, 'news'), where('status', '==', 'approved'), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    const el = document.querySelector('#home-news-card .news-title-home');
    if (el && !snap.empty) {
      const d = snap.docs[0].data();
      el.textContent = d.title || d.body?.substring(0, 80);
    }
  } catch { /* silent */ }
}

// ══════════════════════════
// HELPERS & UI
// ══════════════════════════

window.openPostModal = function () {
  if (!requireLogin()) return;
  document.getElementById('modal-post').classList.add('open');
};

window.openComplaintModal = function () {
  if (!requireLogin()) return;
  document.getElementById('modal-complaint').classList.add('open');
};

window.closeModal = function (id) {
  document.getElementById(id)?.classList.remove('open');
};

window.selectCat = function (el) {
  document.querySelectorAll('#cat-grid .cat-option').forEach(c => c.classList.remove('selected'));
  el.classList.add('selected');
};

window.sharePost = function () {
  if (navigator.share) {
    navigator.share({ title: 'কেরানীগঞ্জ.com', url: window.location.href });
  } else {
    navigator.clipboard?.writeText(window.location.href);
    showToast('লিংক কপি হয়েছে');
  }
};

function getTimeAgo(timestamp) {
  if (!timestamp) return 'এইমাত্র';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  const diff = Math.floor((new Date() - date) / 1000);
  if (diff < 60) return 'এইমাত্র';
  if (diff < 3600) return `${Math.floor(diff / 60)} মিনিট আগে`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} ঘণ্টা আগে`;
  return `${Math.floor(diff / 86400)} দিন আগে`;
}

let toastTimer;
window.showToast = function (msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2500);
};

// Chip selection + init
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.chips').forEach(group => {
    group.querySelectorAll('.chip').forEach(chip => {
      chip.addEventListener('click', () => {
        group.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
      });
    });
  });
  loadHomePreview();
});
