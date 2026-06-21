/* NS-Mesaj — arka plan bildirim service worker'ı (FCM) */
importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyDhtihZfZzwFk1cGCRbaQmF1VS414SW7yI",
  authDomain: "ns-mesaj-b19a7.firebaseapp.com",
  databaseURL: "https://ns-mesaj-b19a7-default-rtdb.firebaseio.com",
  projectId: "ns-mesaj-b19a7",
  storageBucket: "ns-mesaj-b19a7.firebasestorage.app",
  messagingSenderId: "39713613784",
  appId: "1:39713613784:web:d17c4656bc04096ce1f4ad"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage(function(payload){
  const n = payload.notification || {};
  self.registration.showNotification(n.title || "NS-Mesaj", {
    body: n.body || "Yeni mesaj",
    icon: "./icon-192.png",
    badge: "./icon-192.png",
    tag: "ns-mesaj"
  });
});

self.addEventListener("notificationclick", function(e){
  e.notification.close();
  e.waitUntil(clients.matchAll({type:"window"}).then(cs=> cs.length ? cs[0].focus() : clients.openWindow("./ns-mesaj.html")));
});
