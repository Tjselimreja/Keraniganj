// app.js — Keraniganj.com Main Logic

import {
  auth, db, provider,
  signInWithPopup, signOut, onAuthStateChanged,
  collection, addDoc, getDocs, query, orderBy, serverTimestamp, updateDoc, doc, increment
} from './firebase.js';

// ── Current User State ──
let currentUser = null;
let currentPage = 'home';

// ── Auth State Listener ──
onAuthStateChanged(auth, (user) => {
  currentUser = user;
  updateAuthUI(user);
  if (currentPage === 'news') loadNews();
  if (currentPage === 'complaint') loadComplaints();
});

function updateAuthUI(user) {
  const loginBtn = document.getElementById('login-btn');
  const userInfo = document.getElementById('user-info');
  const userAvatar = document.getElementById('user-avatar');

  if (user) {
    if (loginBtn) loginBtn.style.display = 'none';
    if (userInfo) {
      userInfo.style.display = 'flex';
      if (userAvatar) userAvatar.src = user.photoURL || '';
    }
  } else {
    if (loginBtn) loginBtn.style.display = 'flex';
    if (userInfo) userInfo.style.display = 'none';
  }
}

// ── Google Login ──
window.googleLogin = async function () {
  try {
    await signInWithPopup(auth, provider);
    showToast('স্বাগতম! লগইন সফল হয়েছে ✅');
  } catch (err) {
    showToast('লগইন ব্যর্থ হয়েছে। আবার চেষ্টা করুন।');
  }
};

window.logout = async function () {
  await signOut(auth);
  showToast('লগআউট সফল হয়েছে');
};

// ── Page Navigation ──
window.goPage = function (name) {
  currentPage = name;
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('page-' + name).classList.add('active');
  document.getElementById('nav-' + name).classList.add('active');
  window.scrollTo(0, 0);

  if (name === 'news') loadNews();
  if (name === 'complaint') loadComplaints();
  if (name === 'home') loadHomePreview();
};

// ── News: Load ──
async function loadNews() {
  const container = document.getElementById('news-container');
  if (!container) return;
  container.innerHTML = '<div style="text-align:center;padding:30px;color:var(--text-3)">লোড হচ্ছে...</div>';

  try {
    const q = query(collection(db, 'news'), orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      container.innerHTML = '<div style="text-align:center;padding:30px;color:var(--text-3)">এখনো কোনো পোস্ট নেই</div>';
      return;
    }

    container.innerHTML = '';
    snapshot.forEach(docSnap => {
      const d = docSnap.data();
      const id = docSnap.id;
      const timeAgo = getTimeAgo(d.createdAt);
      const authorName = d.anonymous ? '익명 নাগরিক' : (d.authorName || 'অজ্ঞাত');
      const authorPhoto = d.anonymous ? '' : (d.authorPhoto || '');

      container.innerHTML += `
        <div class="card news-full-card">
          <div class="news-header">
            <div class="news-author">
              <div class="author-avatar">${authorPhoto ? `<img src="${authorPhoto}" style="width:38px;height:38px;border-radius:50%;object-fit:cover">` : '👤'}</div>
              <div>
                <div class="author-name">${authorName}</div>
                <div class="author-time">${timeAgo} • ${d.category || 'সাধারণ'}</div>
              </div>
            </div>
            ${d.verified === false ? '<span class="badge badge-unverified">অযাচাইকৃত</span>' : '<span class="badge badge-new">নতুন</span>'}
          </div>
          <div class="news-body">${d.body}</div>
          <div class="news-actions">
            <button class="news-action" onclick="likePost('news','${id}', this)">👍 ${d.likes || 0}</button>
            <button class="news-action">💬 ${d.comments || 0}</button>
            <button class="news-action" onclick="sharePost()">↗️ শেয়ার</button>
          </div>
        </div>`;
    });
  } catch (err) {
    container.innerHTML = '<div style="text-align:center;padding:30px;color:var(--danger)">ডেটা লোড করতে সমস্যা হয়েছে</div>';
  }
}

// ── News: Submit ──
window.submitPost = async function () {
  if (!currentUser) { showLoginPrompt(); return; }

  const title = document.getElementById('post-title').value.trim();
  const body = document.getElementById('post-body').value.trim();
  const category = document.getElementById('post-category').value;
  const anonymous = document.getElementById('anon-post').classList.contains('on');

  if (!title || !body) { showToast('শিরোনাম ও বিবরণ দিন'); return; }

  const btn = document.getElementById('submit-post-btn');
  btn.disabled = true;
  btn.textContent = 'পাঠানো হচ্ছে...';

  try {
    await addDoc(collection(db, 'news'), {
      title,
      body,
      category,
      anonymous,
      authorName: anonymous ? null : currentUser.displayName,
      authorPhoto: anonymous ? null : currentUser.photoURL,
      authorId: currentUser.uid,
      likes: 0,
      comments: 0,
      verified: false,
      createdAt: serverTimestamp()
    });

    closeModal('modal-post');
    showToast('পোস্ট পর্যালোচনার জন্য পাঠানো হয়েছে ✅');
    document.getElementById('post-title').value = '';
    document.getElementById('post-body').value = '';
    loadNews();
  } catch (err) {
    showToast('পোস্ট করতে সমস্যা হয়েছে');
  } finally {
    btn.disabled = false;
    btn.textContent = 'পোস্ট সাবমিট করুন';
  }
};

// ── Complaints: Load ──
async function loadComplaints() {
  const container = document.getElementById('complaint-container');
  if (!container) return;
  container.innerHTML = '<div style="text-align:center;padding:30px;color:var(--text-3)">লোড হচ্ছে...</div>';

  try {
    const q = query(collection(db, 'complaints'), orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);

    // Update stats
    let pending = 0, progress = 0, solved = 0;
    snapshot.forEach(d => {
      const s = d.data().status;
      if (s === 'pending') pending++;
      else if (s === 'progress') progress++;
      else if (s === 'solved') solved++;
    });
    const el = (id) => document.getElementById(id);
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
      const timeAgo = getTimeAgo(d.createdAt);
      const statusMap = { pending: ['badge-pending', 'অপেক্ষমাণ'], progress: ['badge-progress', 'চলমান'], solved: ['badge-solved', 'সমাধান'] };
      const [badgeClass, badgeText] = statusMap[d.status] || ['badge-pending', 'অপেক্ষমাণ'];
      const catIcons = { রাস্তা: '🛣️', পানি: '💧', বিদ্যুৎ: '⚡', দুর্নীতি: '🚫', বর্জ্য: '🗑️', শিক্ষা: '🏫' };
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
            <span class="complaint-meta">${d.anonymous ? '익명' : d.authorName} • ${timeAgo}</span>
            <button class="upvote-btn" onclick="upvoteComplaint('${id}', this)">👍 ${d.votes || 0} ভোট</button>
          </div>
        </div>`;
    });
  } catch (err) {
    container.innerHTML = '<div style="text-align:center;padding:30px;color:var(--danger)">ডেটা লোড করতে সমস্যা হয়েছে</div>';
  }
}

// ── Complaints: Submit ──
window.submitComplaint = async function () {
  if (!currentUser) { showLoginPrompt(); return; }

  const title = document.getElementById('complaint-title').value.trim();
  const body = document.getElementById('complaint-body').value.trim();
  const category = document.querySelector('#cat-grid .cat-option.selected')?.dataset.cat || 'রাস্তা';
  const anonymous = document.getElementById('anon-complaint').classList.contains('on');

  if (!title || !body) { showToast('শিরোনাম ও বিবরণ দিন'); return; }

  const btn = document.getElementById('submit-complaint-btn');
  btn.disabled = true;
  btn.textContent = 'পাঠানো হচ্ছে...';

  try {
    await addDoc(collection(db, 'complaints'), {
      title,
      body,
      category,
      anonymous,
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
  } catch (err) {
    showToast('জমা দিতে সমস্যা হয়েছে');
  } finally {
    btn.disabled = false;
    btn.textContent = 'অভিযোগ জমা দিন';
  }
};

// ── Like / Upvote ──
window.likePost = async function (collectionName, id, btn) {
  if (!currentUser) { showLoginPrompt(); return; }
  try {
    await updateDoc(doc(db, collectionName, id), { likes: increment(1) });
    const current = parseInt(btn.textContent.replace('👍 ', '')) + 1;
    btn.textContent = `👍 ${current}`;
  } catch { showToast('সমস্যা হয়েছে'); }
};

window.upvoteComplaint = async function (id, btn) {
  if (!currentUser) { showLoginPrompt(); return; }
  try {
    await updateDoc(doc(db, 'complaints', id), { votes: increment(1) });
    const current = parseInt(btn.textContent.replace('👍 ', '').replace(' ভোট', '')) + 1;
    btn.textContent = `👍 ${current} ভোট`;
  } catch { showToast('সমস্যা হয়েছে'); }
};

// ── Home Preview ──
async function loadHomePreview() {
  try {
    const newsQ = query(collection(db, 'news'), orderBy('createdAt', 'desc'));
    const newsSnap = await getDocs(newsQ);
    const homeNews = document.getElementById('home-news-preview');
    if (homeNews && !newsSnap.empty) {
      const d = newsSnap.docs[0].data();
      homeNews.querySelector('.news-title-home').textContent = d.title || d.body?.substring(0, 80);
    }
  } catch { /* silent */ }
}

// ── Helpers ──
function getTimeAgo(timestamp) {
  if (!timestamp) return 'এইমাত্র';
  const now = new Date();
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  const diff = Math.floor((now - date) / 1000);
  if (diff < 60) return 'এইমাত্র';
  if (diff < 3600) return `${Math.floor(diff / 60)} মিনিট আগে`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} ঘণ্টা আগে`;
  return `${Math.floor(diff / 86400)} দিন আগে`;
}

function showLoginPrompt() {
  showToast('এই কাজের জন্য লগইন করুন');
  setTimeout(() => document.getElementById('login-btn')?.click(), 1000);
}

window.sharePost = function () {
  if (navigator.share) {
    navigator.share({ title: 'কেরানীগঞ্জ.com', url: window.location.href });
  } else {
    navigator.clipboard?.writeText(window.location.href);
    showToast('লিংক কপি হয়েছে');
  }
};

window.selectCat = function (el) {
  document.querySelectorAll('#cat-grid .cat-option').forEach(c => c.classList.remove('selected'));
  el.classList.add('selected');
};

window.openPostModal = function () {
  if (!currentUser) { showLoginPrompt(); return; }
  document.getElementById('modal-post').classList.add('open');
};

window.openComplaintModal = function () {
  if (!currentUser) { showLoginPrompt(); return; }
  document.getElementById('modal-complaint').classList.add('open');
};

window.closeModal = function (id) {
  document.getElementById(id).classList.remove('open');
};

let toastTimer;
window.showToast = function (msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2500);
};

// Chip selection
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
