// Message rendering, 20s countdown, delete animations
// Depends on: api, socketClient, currentUser (set by chat.js)

// ── Render a single message bubble ────────────────────────────
function renderMessage(msg, currentUserId) {
  const isSent = msg.senderId === currentUserId ||
                 msg.senderId?._id === currentUserId;

  const el = document.createElement('div');
  el.className = `message message--${isSent ? 'sent' : 'recv'}`;
  el.dataset.messageId = msg._id;

  const bubble = document.createElement('div');
  bubble.className = 'message__bubble';

  // Text content
  if (msg.text) {
    const p = document.createElement('p');
    p.className = 'message__text';
    p.textContent = msg.text;
    bubble.appendChild(p);
  }

  // Image content
  if (msg.imageUrl) {
    const imgWrap = buildImageBubble(msg, isSent);
    bubble.appendChild(imgWrap);
  }

  // Timestamp
  const meta = document.createElement('span');
  meta.className = 'message__meta';
  meta.textContent = formatTime(msg.createdAt);
  bubble.appendChild(meta);

  el.appendChild(bubble);

  // Start countdown if already seen and expiresAt is set
  if (msg.seen && msg.expiresAt) {
    startCountdown(el, msg.expiresAt, msg._id);
  }

  return el;
}

// ── Image bubble with blur-to-reveal ──────────────────────────
function buildImageBubble(msg, isSent) {
  const wrap = document.createElement('div');
  wrap.className = 'message__image-wrapper';

  const img = document.createElement('img');
  img.src = msg.imageUrl;
  img.className = 'message__image';
  img.loading = 'lazy';
  if (msg.imageWidth && msg.imageHeight) {
    img.width  = Math.min(msg.imageWidth,  280);
    img.height = Math.round(Math.min(msg.imageWidth, 280) * (msg.imageHeight / msg.imageWidth));
  }

  // Receiver: blur until tapped
  if (!isSent && !msg.seen) {
    img.classList.add('message__image--blurred');
    const hint = document.createElement('div');
    hint.className = 'message__image-hint';
    hint.innerHTML = '<span>👁</span> Tap to view';
    wrap.appendChild(hint);

    wrap.addEventListener('click', async () => {
      if (!img.classList.contains('message__image--blurred')) return;
      img.classList.remove('message__image--blurred');
      wrap.querySelector('.message__image-hint')?.remove();

      try {
        const { expiresAt } = await api.patch(`/messages/${msg._id}/seen`);
        const msgEl = wrap.closest('.message');
        if (msgEl) startCountdown(msgEl, expiresAt, msg._id);
      } catch {/* silently ignore */}
    }, { once: true });
  }

  wrap.appendChild(img);
  return wrap;
}

// ── 20-second countdown bar ────────────────────────────────────
function startCountdown(msgEl, expiresAt, messageId) {
  const totalMs  = new Date(expiresAt) - Date.now();
  if (totalMs <= 0) {
    triggerDelete(msgEl, messageId);
    return;
  }

  // Add timer bar
  let bar = msgEl.querySelector('.message__timer-bar');
  if (!bar) {
    bar = document.createElement('div');
    bar.className = 'message__timer-bar';
    msgEl.querySelector('.message__bubble')?.appendChild(bar);
  }

  const startTime = Date.now();

  const tick = () => {
    if (!document.body.contains(msgEl)) return;
    const elapsed   = Date.now() - startTime;
    const remaining = totalMs - elapsed;
    const pct       = Math.max(0, (remaining / totalMs) * 100);
    bar.style.width = pct + '%';

    if (remaining <= 0) {
      triggerDelete(msgEl, messageId);
      return;
    }
    requestAnimationFrame(tick);
  };

  requestAnimationFrame(tick);
}

// ── Fire delete via API then animate out ──────────────────────
async function triggerDelete(msgEl, messageId) {
  try {
    await api.delete(`/messages/${messageId}`);
  } catch {/* 404 is fine — already deleted */}
  fadeOutMessage(msgEl);
}

// ── Fade-out animation ─────────────────────────────────────────
function fadeOutMessage(msgEl) {
  if (!msgEl || msgEl.classList.contains('message--fading')) return;
  msgEl.classList.add('message--fading');
  msgEl.addEventListener('animationend', () => msgEl.remove(), { once: true });
}

// ── Remove message from DOM by ID ─────────────────────────────
function removeMessageFromDOM(messageId) {
  const el = document.querySelector(`[data-message-id="${messageId}"]`);
  if (el) fadeOutMessage(el);
}

// ── Format timestamp ──────────────────────────────────────────
function formatTime(iso) {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

window.msgRenderer = {
  renderMessage,
  startCountdown,
  fadeOutMessage,
  removeMessageFromDOM,
  triggerDelete,
};
