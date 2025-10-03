// room_chat_users.js
// Fügt Userliste + Chat-Funktionalität hinzu, ohne euer Layout/Logos zu ändern.
// Erwartet vorhandene Elemente mit IDs: room-info, messages, chat-input, chat-form.
// Legt bei Bedarf automatisch einen User-Container an.

import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getDatabase, ref, push, onChildAdded, serverTimestamp,
         set, onDisconnect, onValue } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";

// === Firebase Config HIER eintragen ===
const firebaseConfig = {
  apiKey:        "DEIN_API_KEY",
  authDomain:    "DEIN_PROJEKT.firebaseapp.com",
  databaseURL:   "https://DEIN_PROJEKT-default-rtdb.europe-west1.firebasedatabase.app",
  projectId:     "DEIN_PROJEKT",
  storageBucket: "DEIN_PROJEKT.appspot.com",
  messagingSenderId: "DEINE_ID",
  appId: "DEINE_APP_ID"
};

const app = initializeApp(firebaseConfig);
const db  = getDatabase(app);

// === Parameter auslesen ===
const params = new URLSearchParams(location.search);
const klasse = (params.get("klasse") || "Allgemein").trim();
const nick   = (params.get("nick")   || "Gast").trim();

// Rauminfo (falls vorhanden) setzen
const infoEl = document.getElementById("room-info");
if (infoEl) infoEl.textContent = `Aktueller Raum: ${klasse} | Nickname: ${nick}`;

// Userliste-Container ggf. anlegen, ohne vorhandenes Layout zu entfernen
let usersWrap = document.getElementById("user-list");
let usersUl   = document.getElementById("users");
if (!usersUl) {
  usersWrap = usersWrap || document.createElement("div");
  usersWrap.id = "user-list";
  usersWrap.style.cssText = "margin:10px 0; padding:8px; background:#eef5ff; border-radius:8px;";

  const title = document.createElement("div");
  title.textContent = "👥 Aktive User im Raum:";
  usersUl = document.createElement("ul");
  usersUl.id = "users";
  usersUl.style.margin = "6px 0 0 18px";

  usersWrap.appendChild(title);
  usersWrap.appendChild(usersUl);

  const anchor = document.getElementById("messages") || document.body.firstChild;
  (anchor?.parentNode || document.body).insertBefore(usersWrap, anchor);
}

// === Nachrichten ===
const messagesEl = document.getElementById("messages");
const inputEl    = document.getElementById("chat-input");
const formEl     = document.getElementById("chat-form");
const roomRef    = ref(db, `rooms/${encodeURIComponent(klasse)}/messages`);

onChildAdded(roomRef, (snap) => {
  const m = snap.val();
  if (!m) return;
  appendMessage(m.nick, m.text, m.ts);
});

formEl?.addEventListener("submit", (e) => {
  e.preventDefault();
  const text = (inputEl?.value || "").trim();
  if (!text) return;
  push(roomRef, { nick, text: text.slice(0,500), ts: serverTimestamp() });
  if (inputEl) inputEl.value = "";
});

function appendMessage(sender, text, ts) {
  if (!messagesEl) return;
  const row = document.createElement("div");
  const who = sender === nick ? "Du" : sender;
  const when = ts ? new Date(ts).toLocaleTimeString() : "";
  row.textContent = `${who} ${when? "("+when+")":""}: ${text}`;
  messagesEl.appendChild(row);
  messagesEl.scrollTo({ top: messagesEl.scrollHeight, behavior: "smooth" });
}

// === Userliste ===
const myUserRef = ref(db, `rooms/${encodeURIComponent(klasse)}/users/${encodeURIComponent(nick)}`);

// Eigenen User eintragen & beim Disconnect entfernen
set(myUserRef, true);
onDisconnect(myUserRef).remove();

// Userliste beobachten
const usersRef = ref(db, `rooms/${encodeURIComponent(klasse)}/users`);
onValue(usersRef, (snap) => {
  const data = snap.val() || {};
  usersUl.innerHTML = "";
  Object.keys(data).forEach(u => {
    const li = document.createElement("li");
    li.textContent = u;
    if (u === nick) li.style.fontWeight = "bold";
    usersUl.appendChild(li);
  });
});

console.log("[room_chat_users.js] aktiv – Raum:", klasse, "Nick:", nick);
