// netiquette_realtime_patch.js
// Script-only patch: adds realtime sync + profanity notice + diagnostics
// Does NOT modify layout, logos, or existing styles.

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { getDatabase, ref, push, onChildAdded, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js";

// --- URL params ---
const params = new URLSearchParams(location.search);
const ROOM = params.get('room') || 'default';
const NICK = params.get('nick') || 'Gast';

// --- Config: prefer window.FIREBASE_CONFIG if provided by the page ---
const FALLBACK_CONFIG = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  databaseURL: "https://netiquette-74729-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "YOUR_PROJECT",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};
const APP = initializeApp(window.FIREBASE_CONFIG || FALLBACK_CONFIG);
const DB  = getDatabase(APP);
const DBURL = (APP && APP.options && (APP.options.databaseURL || APP.options['databaseURL'])) || '(unbekannt)';

// --- Find existing DOM (no layout changes) ---
const $ = (sel) => document.querySelector(sel);

function findMessagesBox() {
  let el = $('#messages, .messages, #chat-log, #chatLog, .chat-log, .chatMessages, .message-list');
  if (el) return el;
  // Fallback: find element containing the typical hint text
  const cand = Array.from(document.querySelectorAll('div, section, article'))
    .find(n => /Hier erscheinen die Nachrichten/i.test((n.textContent||'').trim()));
  return cand || document.body;
}
function findForm() {
  return $('#chat-form, form.chat-form, form[action*="send"], form');
}
function findInput(formEl) {
  return formEl?.querySelector('#chat-input, input[type="text"], textarea') || $('#chat-input, input[type="text"], textarea');
}

const messagesBox = findMessagesBox();
const form        = findForm();
const input       = findInput(form);

// --- Minimal posting helper (no CSS dependencies) ---
function postLine(text, type='system') {
  if (!messagesBox) return;
  const p = document.createElement('p');
  p.setAttribute('data-type', type);
  p.textContent = text;
  messagesBox.appendChild(p);
  messagesBox.scrollTop = messagesBox.scrollHeight;
}

// --- Profanity: use existing global lists if available; DO NOT change them ---
function wordsRe(list) {
  if (!Array.isArray(list) || !list.length) return null;
  const escaped = list.map(w => String(w).trim()).filter(Boolean).map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  if (!escaped.length) return null;
  return new RegExp(`\\b(?:${escaped.join('|')})\\b`, 'i');
}
const LIST_PROF = window.PROFANITY_LIST || window.badWords || window.WORD_LIST || window.WORDLIST || window.blockList || window.BLOCKLIST || window.BLOCKLIST_ALL || [];
const LIST_HARD = window.BLOCKLIST_SEXIST_RACIST || window.HARD_BLOCKLIST || window.BLOCKLIST_HARD || [];
const reProf    = wordsRe(LIST_PROF);
const reHard    = wordsRe(LIST_HARD);

function normalize(s){ return String(s||'').toLocaleLowerCase('de-DE').normalize('NFKC').replace(/\s+/g,' ').trim(); }
function isProfane(text){
  const n = normalize(text);
  const hard = reHard ? reHard.test(n) : false;
  const soft = !hard && reProf ? reProf.test(n) : false;
  return { hard, soft, any: hard || soft };
}

// --- Realtime listeners ---
const roomRef = ref(DB, `/rooms/${encodeURIComponent(ROOM)}/messages`);
onChildAdded(roomRef, (snap) => {
  try {
    const msg = snap.val();
    if (!msg) return;
    const who = msg.user || '???';
    const text = msg.text || '';
    postLine(`${who}: ${text}`, (who === NICK) ? 'me' : 'other');
  } catch(err) {
    console.error('onChildAdded error', err);
    postLine('❗️ Empfangen fehlgeschlagen: ' + (err?.message || String(err)), 'warn');
  }
});

// --- Submit hook: show warning when profanity is typed ---
if (form && input) {
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = input.value || "";
    const chk = isProfane(text);
    if (chk.any) {
      postLine('⚠️ Unangemessene Sprache ist nicht erlaubt. Bitte formuliere respektvoll.', 'warn');
      input.focus();
      return;
    }
    try {
      push(roomRef, { user: NICK, text, ts: serverTimestamp() })
        .then(()=> { input.value=''; input.focus(); })
        .catch(err => { console.error('push error', err); postLine('❗️ Senden fehlgeschlagen (Firebase): ' + (err?.message || String(err)), 'warn'); });
    } catch(err) {
      console.error('push throw', err);
      postLine('❗️ Senden fehlgeschlagen (throw): ' + (err?.message || String(err)), 'warn');
    }
  });
} else {
  console.warn('Chat form or input not found; patch still loaded.');
}

// --- System/Diagnose lines ---
postLine(`✅ Netiquette aktiv. Du bist als ${NICK} im Raum ${ROOM}.`, 'system');
postLine(`ℹ️ Firebase verbunden: ${DBURL}`, 'system');
const cfg = (APP && APP.options) || {};
postLine(`🔍 Diagnose: projectId=${cfg.projectId||'(leer)'}, authDomain=${cfg.authDomain||'(leer)'}`, 'system');
try {
  push(roomRef, { user: NICK, text: "[PING] Verbindungstest", ts: serverTimestamp(), _diag: true })
    .then(()=> postLine('🟢 Test-Schreiben ok (Realtime Database nimmt Daten an).', 'system'))
    .catch(err=> { console.error('PING push error', err); postLine('🔴 Test-Schreiben FEHLER: ' + (err?.message || String(err)), 'warn'); });
} catch(err) {
  console.error('PING push throw', err);
  postLine('🔴 Test-Schreiben THROW: ' + (err?.message || String(err)), 'warn');
}
