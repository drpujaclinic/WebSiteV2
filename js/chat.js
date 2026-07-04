/**
 * DR. PUJA'S CLINIC — AI Chat Assistant
 * Powered by Claude via Anthropic API
 *
 * This is an AI-powered Q&A assistant that knows about the clinic,
 * Dr. Puja's specialties, services, timings, and can answer patient questions.
 * It NEVER gives personal medical diagnoses — it redirects to book an appointment.
 *
 * SETUP REQUIRED:
 *   This calls https://api.anthropic.com/v1/messages directly from the browser.
 *   That endpoint does NOT allow browser CORS requests with an exposed API key —
 *   you must proxy this through your own backend (Node/PHP/Cloudflare Worker etc.)
 *   that holds your ANTHROPIC_API_KEY server-side and forwards the request.
 *   Replace API_ENDPOINT below with your own backend proxy URL.
 */

const API_ENDPOINT = '/api/chat'; // ← replace with your backend proxy endpoint

const CHAT_SYSTEM_PROMPT = `You are a helpful, warm, and professional virtual assistant for Dr. Puja's Clinic — a gynaecology and fertility clinic in Patparganj, East Delhi, run by Dr. Puja Prasad (MBBS, MS Obs & Gyn, DMAS, FMAS) with 23+ years of experience.

Your role is to:
1. Answer questions about the clinic, services, timings, fees, and Dr. Puja's expertise.
2. Help patients understand what service they might need (e.g. if they describe symptoms, gently explain what kind of consultation is relevant).
3. Assist with booking information and direct them to book an appointment.
4. Be warm, reassuring, and culturally sensitive (patients are mostly from East Delhi, speak Hindi/English mix sometimes).

CLINIC FACTS:
- Primary clinic: A 128, Gali No 8, Sai Chowk, Madhu Vihar, IP Extension, Patparganj, New Delhi 110092
- Phone: +91-9899416040
- Timings: Mon–Sat 12:00 PM–2:00 PM and 6:00–8:30 PM; Sunday 12:00 PM–2:00 PM only
- Fee: ₹800 at primary clinic, ₹1000 at hospital OPDs
- Video consultations available
- Also available at: Pushpanjali Hospital (Karkardooma, Wed & Sat), Femmenest (Mon & Thu), Max Super Speciality Hospital (Tue & Sun)

SERVICES: High-risk pregnancy, infertility treatment, PCOD/PCOS management, laparoscopic surgery, hysteroscopy, antenatal care, cervical cancer screening, HPV vaccination, menopause management, contraception counselling, obstetric & gynaecological ultrasound, blood investigations.

IMPORTANT RULES:
- NEVER give a specific medical diagnosis or say "you have [disease]".
- If someone describes symptoms, say something like: "Those symptoms could have a few possible causes that Dr. Puja can evaluate. I'd recommend booking a consultation."
- Always end symptom-related queries with a suggestion to book an appointment.
- Keep responses concise — 2-4 sentences usually. No bullet lists unless the person asks for them.
- If asked something you don't know, say so honestly and suggest calling the clinic.
- Be supportive and non-judgmental, especially for sensitive topics (fertility, MTP, STIs).
- Do NOT discuss pricing for procedures (only consultation fees are listed above).
- You can respond in Hindi or Hinglish if the person writes that way.`;

// ─── State ─────────────────────────────────────────────────────────────────
const chatState = {
  open: false,
  messages: [],  // { role: 'user'|'assistant', content: string }
  isTyping: false,
};

const QUICK_REPLIES = [
  'What are the clinic timings?',
  'How do I book an appointment?',
  'What does PCOD treatment involve?',
  'Is video consultation available?',
];

// ─── Init ──────────────────────────────────────────────────────────────────
function initChat() {
  const panel = document.getElementById('chatPanel');
  if (!panel) return;
  renderQuickReplies();
  addChatMessage('assistant', `Hello! 👋 I'm the virtual assistant for Dr. Puja's Clinic. I can answer questions about our services, timings, and help you get the care you need. How can I help you today?`);
}

function toggleChat() {
  chatState.open = !chatState.open;
  const panel = document.getElementById('chatPanel');
  const badge = document.getElementById('chatBadge');
  panel.classList.toggle('open', chatState.open);
  if (badge) badge.style.display = 'none';
  if (chatState.open) {
    document.getElementById('chatInput').focus();
  }
}

function closeChat() {
  chatState.open = false;
  document.getElementById('chatPanel').classList.remove('open');
}

// ─── Messages ──────────────────────────────────────────────────────────────
function addChatMessage(role, content) {
  chatState.messages.push({ role, content });
  renderMessages();
}

function renderMessages() {
  const container = document.getElementById('chatMessages');
  if (!container) return;

  const html = chatState.messages.map((msg) => {
    const isUser = msg.role === 'user';
    return `
      <div class="chat-msg ${isUser ? 'user' : ''}">
        <div class="chat-msg-avatar">${isUser ? 'You' : '🩺'}</div>
        <div class="chat-bubble">${escapeHtml(msg.content)}</div>
      </div>
    `;
  }).join('');

  container.innerHTML = html + (chatState.isTyping ? `
    <div class="chat-msg">
      <div class="chat-msg-avatar">🩺</div>
      <div class="chat-typing"><span></span><span></span><span></span></div>
    </div>
  ` : '');

  container.scrollTop = container.scrollHeight;
}

function renderQuickReplies() {
  const container = document.getElementById('quickReplies');
  if (!container) return;
  container.innerHTML = QUICK_REPLIES.map(q =>
    `<button class="quick-reply" onclick="sendQuickReply('${q}')">${q}</button>`
  ).join('');
}

function sendQuickReply(text) {
  document.getElementById('quickReplies').innerHTML = '';
  sendChatMessage(text);
}

async function handleChatInput(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    const input = document.getElementById('chatInput');
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    await sendChatMessage(text);
  }
}

async function sendChatFromBtn() {
  const input = document.getElementById('chatInput');
  const text = input.value.trim();
  if (!text) return;
  input.value = '';
  await sendChatMessage(text);
}

async function sendChatMessage(text) {
  addChatMessage('user', text);

  // Check for booking intent — handle locally, no API call needed
  const bookingKeywords = ['book', 'appointment', 'consult', 'slot', 'visit', 'schedule'];
  if (bookingKeywords.some(k => text.toLowerCase().includes(k))) {
    chatState.isTyping = true;
    renderMessages();
    await delay(800);
    chatState.isTyping = false;
    addChatMessage('assistant', "I'd be happy to help you book an appointment! You can click the button below, or I can answer any questions first.");
    appendBookingCTA();
    return;
  }

  // Call the backend proxy (which calls Claude)
  chatState.isTyping = true;
  renderMessages();

  try {
    const response = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 300,
        system: CHAT_SYSTEM_PROMPT,
        messages: chatState.messages.slice(-10).filter(m => m.role === 'user' || m.role === 'assistant'),
      }),
    });

    if (!response.ok) throw new Error('Backend proxy returned ' + response.status);

    const data = await response.json();
    chatState.isTyping = false;

    if (data.content && data.content[0]?.text) {
      const reply = data.content[0].text;
      addChatMessage('assistant', reply);
      if (/book|appointment|consult/i.test(reply)) {
        appendBookingCTA();
      }
    } else {
      addChatMessage('assistant', "I'm sorry, I couldn't get a response right now. Please call us at +91-9899416040 or WhatsApp for immediate help.");
    }
  } catch (err) {
    chatState.isTyping = false;
    addChatMessage('assistant', "I'm having trouble connecting right now. Please call us at +91-9899416040 or send us a WhatsApp message for immediate assistance.");
  }
}

function appendBookingCTA() {
  const container = document.getElementById('chatMessages');
  if (!container) return;
  const ctaDiv = document.createElement('div');
  ctaDiv.style.cssText = 'padding: 4px 8px 4px 36px;';
  ctaDiv.innerHTML = `
    <button onclick="closeChat();openBooking();" style="background:var(--teal);color:white;border:none;padding:9px 18px;border-radius:20px;font-size:13px;font-weight:600;cursor:pointer;font-family:var(--font-body);transition:background 0.2s;">
      📅 Book Appointment
    </button>
  `;
  container.appendChild(ctaDiv);
  container.scrollTop = container.scrollHeight;
}

// ─── Helpers ───────────────────────────────────────────────────────────────
function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/\n/g, '<br>');
}

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

// Init on load
document.addEventListener('DOMContentLoaded', initChat);
