// chat.js — main controller for chat.html
// Orchestrates: users sidebar, message list, socket events, typing

document.addEventListener('DOMContentLoaded', async () => {
  // ── Auth guard ─────────────────────────────────────────────
  const token = localStorage.getItem('fc_token');
  const me    = JSON.parse(localStorage.getItem('fc_user') || 'null');
  if (!token || !me) { window.location.href = 'index.html'; return; }

  // ── State ──────────────────────────────────────────────────
  let activeConvId   = null;  // userId of open conversation
  let typingTimer    = null;
  let isTyping       = false;
  let pendingImage   = null;  // { url, publicId, width, height }

  // ── DOM refs ───────────────────────────────────────────────
  const convList      = document.getElementById('conv-list');
  const searchInput   = document.getElementById('search-input');
  const searchResults = document.getElementById('search-results');
  const msgList       = document.getElementById('messages-list');
  const msgInput      = document.getElementById('msg-input');
  const sendBtn       = document.getElementById('send-btn');
  const imageBtn      = document.getElementById('image-btn');
  const imageFileInput= document.getElementById('image-file-input');
  const chatHeader    = document.getElementById('chat-header');
  const chatEmpty     = document.getElementById('chat-empty');
  const chatPanel     = document.getElementById('chat-panel');
  const typingEl      = document.getElementById('typing-indicator');
  const myAvatar      = document.getElementById('my-avatar');
  const myUsername    = document.getElementById('my-username');
  const logoutBtn     = document.getElementById('logout-btn');
  const backBtn       = document.getElementById('back-btn');
  const imagePreview  = document.getElementById('image-preview');
  const previewImg    = document.getElementById('preview-img');
  const cancelPreview = document.getElementById('cancel-preview');

  // ── My profile ─────────────────────────────────────────────
  myUsername.textContent = me.username;
  if (me.avatarUrl) myAvatar.src = me.avatarUrl;

  // ── Connect socket ─────────────────────────────────────────
  const socket = socketClient.connect(token);

  // ── Socket events ──────────────────────────────────────────

  socket.on('message:new', (data) => {
    const msg = data.message;
    // Only show if conversation is open
    if (msg.senderId === activeConvId || msg.senderId?._id === activeConvId) {
      appendMessage(msg);
      scrollToBottom();
    }
    // Refresh conversation list to update last message
    loadConversations();
  });

  socket.on('message:seen:ack', ({ messageId, expiresAt }) => {
    // My sent message was seen — start the countdown
    const el = document.querySelector(`[data-message-id="${messageId}"]`);
    if (el) msgRenderer.startCountdown(el, expiresAt, messageId);
  });

  socket.on('message:deleted', ({ messageId }) => {
    msgRenderer.removeMessageFromDOM(messageId);
  });

  socket.on('typing:start', ({ senderId }) => {
    if (senderId === activeConvId) typingEl.classList.remove('hidden');
  });

  socket.on('typing:stop', ({ senderId }) => {
    if (senderId === activeConvId) typingEl.classList.add('hidden');
  });

  socket.on('user:online', ({ userId }) => {
    updateOnlineBadge(userId, true);
  });

  socket.on('user:offline', ({ userId }) => {
    updateOnlineBadge(userId, false);
  });

  socket.on('online:list', ({ userIds }) => {
    userIds.forEach(id => updateOnlineBadge(id, true));
  });

  // ── Conversations sidebar ──────────────────────────────────

  async function loadConversations() {
    try {
      const { conversations } = await api.get('/users/conversations');
      renderConversations(conversations);
    } catch { /* ignore */ }
  }

  function renderConversations(conversations) {
    convList.innerHTML = '';
    if (!conversations.length) {
      convList.innerHTML = '<p class="sidebar__empty">No conversations yet.<br>Search for a user to start.</p>';
      return;
    }
    conversations.forEach(({ partner, lastMessage, unreadCount }) => {
      const item = buildConvItem(partner, lastMessage, unreadCount);
      convList.appendChild(item);
    });
  }

  function buildConvItem(partner, lastMsg, unread) {
    const el = document.createElement('div');
    el.className = 'conv-item' + (partner._id === activeConvId ? ' conv-item--active' : '');
    el.dataset.userId = partner._id;

    const initials = partner.username.slice(0, 2).toUpperCase();
    el.innerHTML = `
      <div class="conv-item__avatar-wrap">
        <div class="conv-item__avatar">${partner.avatarUrl
          ? `<img src="${partner.avatarUrl}" alt="${partner.username}">`
          : `<span>${initials}</span>`}
        </div>
        <span class="online-badge ${partner.isOnline ? 'online-badge--on' : ''}"
              data-badge-user="${partner._id}"></span>
      </div>
      <div class="conv-item__body">
        <div class="conv-item__top">
          <span class="conv-item__name">${partner.username}</span>
          ${lastMsg ? `<span class="conv-item__time">${formatTime(lastMsg.createdAt)}</span>` : ''}
        </div>
        <div class="conv-item__preview">
          ${lastMsg
            ? (lastMsg.imageUrl ? '📷 Image' : escHtml(lastMsg.text || ''))
            : '<em>Say hi!</em>'}
          ${unread > 0 ? `<span class="unread-badge">${unread}</span>` : ''}
        </div>
      </div>`;

    el.addEventListener('click', () => openConversation(partner));
    return el;
  }

  // ── Search users ───────────────────────────────────────────

  let searchDebounce = null;
  searchInput.addEventListener('input', () => {
    clearTimeout(searchDebounce);
    const q = searchInput.value.trim();
    if (!q) { searchResults.classList.add('hidden'); return; }
    searchDebounce = setTimeout(() => doSearch(q), 300);
  });

  async function doSearch(q) {
    try {
      const { users } = await api.get(`/users/search?q=${encodeURIComponent(q)}`);
      renderSearchResults(users);
    } catch { /* ignore */ }
  }

  function renderSearchResults(users) {
    searchResults.innerHTML = '';
    if (!users.length) {
      searchResults.innerHTML = '<p class="search-results__empty">No users found</p>';
      searchResults.classList.remove('hidden');
      return;
    }
    users.forEach(u => {
      const el = document.createElement('div');
      el.className = 'search-result-item';
      el.innerHTML = `
        <div class="conv-item__avatar conv-item__avatar--sm">
          ${u.avatarUrl ? `<img src="${u.avatarUrl}">` : `<span>${u.username.slice(0,2).toUpperCase()}</span>`}
        </div>
        <span>${escHtml(u.username)}</span>
        <span class="online-badge ${u.isOnline ? 'online-badge--on' : ''}"></span>`;
      el.addEventListener('click', () => {
        searchInput.value = '';
        searchResults.classList.add('hidden');
        openConversation(u);
      });
      searchResults.appendChild(el);
    });
    searchResults.classList.remove('hidden');
  }

  // Hide search results on outside click
  document.addEventListener('click', (e) => {
    if (!searchInput.contains(e.target) && !searchResults.contains(e.target)) {
      searchResults.classList.add('hidden');
    }
  });

  // ── Open conversation ──────────────────────────────────────

  async function openConversation(partner) {
    activeConvId = partner._id;

    // Mobile: show chat panel
    chatPanel.classList.remove('hidden');
    document.getElementById('sidebar').classList.add('sidebar--hidden');

    // Update header
    const initials = partner.username.slice(0,2).toUpperCase();
    chatHeader.innerHTML = `
      <button class="back-btn" id="back-btn-inner">‹</button>
      <div class="chat-header__avatar">
        ${partner.avatarUrl
          ? `<img src="${partner.avatarUrl}" alt="${partner.username}">`
          : `<span>${initials}</span>`}
        <span class="online-badge ${partner.isOnline ? 'online-badge--on' : ''}"
              data-badge-user="${partner._id}"></span>
      </div>
      <div class="chat-header__info">
        <span class="chat-header__name">${partner.username}</span>
        <span class="chat-header__status" id="header-status">
          ${partner.isOnline ? 'Online' : 'Offline'}
        </span>
      </div>`;

    document.getElementById('back-btn-inner')?.addEventListener('click', () => {
      chatPanel.classList.add('hidden');
      document.getElementById('sidebar').classList.remove('sidebar--hidden');
      activeConvId = null;
    });

    chatEmpty.classList.add('hidden');
    msgList.innerHTML = '';
    typingEl.classList.add('hidden');

    // Mark active in sidebar
    document.querySelectorAll('.conv-item').forEach(el => {
      el.classList.toggle('conv-item--active', el.dataset.userId === partner._id);
    });

    // Load messages
    await loadMessages(partner._id);
    scrollToBottom();
    msgInput.focus();
  }

  async function loadMessages(partnerId) {
    try {
      const { messages } = await api.get(`/messages/${partnerId}`);
      messages.forEach(msg => appendMessage(msg));
    } catch { /* ignore */ }
  }

  function appendMessage(msg) {
    const el = msgRenderer.renderMessage(msg, me._id);

    // Add delete button (both sides can delete)
    const delBtn = document.createElement('button');
    delBtn.className  = 'message__delete-btn';
    delBtn.title      = 'Delete';
    delBtn.innerHTML  = '✕';
    delBtn.addEventListener('click', async () => {
      try {
        await api.delete(`/messages/${msg._id}`);
        msgRenderer.fadeOutMessage(el);
      } catch { /* ignore */ }
    });
    el.appendChild(delBtn);

    msgList.appendChild(el);
  }

  function scrollToBottom() {
    msgList.scrollTop = msgList.scrollHeight;
  }

  // ── Send message ───────────────────────────────────────────

  async function sendMessage() {
    const text  = msgInput.value.trim();
    const hasImg = !!pendingImage;
    if (!text && !hasImg) return;
    if (!activeConvId) return;

    const body = {
      receiverId: activeConvId,
      text: text || null,
      ...( hasImg ? {
        imageUrl:      pendingImage.url,
        imagePublicId: pendingImage.publicId,
        imageWidth:    pendingImage.width,
        imageHeight:   pendingImage.height,
      } : {}),
    };

    msgInput.value = '';
    sendBtn.disabled = true;
    clearPendingImage();

    try {
      const { message } = await api.post('/messages/send', body);
      appendMessage(message);
      scrollToBottom();
      stopTyping();
      loadConversations();
    } catch (err) {
      msgInput.value = text;
      console.error('Send failed:', err.message);
    } finally {
      sendBtn.disabled = false;
    }
  }

  sendBtn.addEventListener('click', sendMessage);
  msgInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  });

  // ── Typing indicators ──────────────────────────────────────

  msgInput.addEventListener('input', () => {
    if (!activeConvId) return;
    if (!isTyping) {
      isTyping = true;
      socketClient.emit('typing:start', { receiverId: activeConvId });
    }
    clearTimeout(typingTimer);
    typingTimer = setTimeout(stopTyping, 1500);
  });

  function stopTyping() {
    if (!isTyping) return;
    isTyping = false;
    if (activeConvId) socketClient.emit('typing:stop', { receiverId: activeConvId });
    clearTimeout(typingTimer);
  }

  // ── Image upload flow ──────────────────────────────────────

  imageBtn.addEventListener('click', () => imageFileInput.click());

  imageFileInput.addEventListener('change', async () => {
    const file = imageFileInput.files[0];
    if (!file) return;

    imageUploader.previewFile(file, previewImg);
    imagePreview.classList.remove('hidden');
    sendBtn.disabled = true;
    imageBtn.disabled = true;

    try {
      pendingImage = await imageUploader.upload(file);
    } catch (err) {
      clearPendingImage();
      alert(err.message);
    } finally {
      sendBtn.disabled = false;
      imageBtn.disabled = false;
      imageFileInput.value = '';
    }
  });

  cancelPreview.addEventListener('click', clearPendingImage);

  function clearPendingImage() {
    pendingImage = null;
    previewImg.src = '';
    imagePreview.classList.add('hidden');
  }

  // ── Online badge helper ────────────────────────────────────

  function updateOnlineBadge(userId, online) {
    document.querySelectorAll(`[data-badge-user="${userId}"]`).forEach(badge => {
      badge.classList.toggle('online-badge--on', online);
    });
    // Also update header status text
    if (userId === activeConvId) {
      const statusEl = document.getElementById('header-status');
      if (statusEl) statusEl.textContent = online ? 'Online' : 'Offline';
    }
  }

  // ── Logout ─────────────────────────────────────────────────

  logoutBtn.addEventListener('click', () => {
    socketClient.disconnect();
    localStorage.removeItem('fc_token');
    localStorage.removeItem('fc_user');
    window.location.href = 'index.html';
  });

  // ── Helpers ────────────────────────────────────────────────

  function formatTime(iso) {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function escHtml(str) {
    return (str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  // ── Init ───────────────────────────────────────────────────
  await loadConversations();
});
