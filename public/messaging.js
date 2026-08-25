(function () {
  "use strict";

  var activeContact = { admin: null, student: null, parent: null };

  function esc(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (char) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char];
    });
  }

  function actor(role) {
    if (role === "admin") return { id: "admin", role: "admin", name: "المسؤول" };
    if (role === "student") return { id: String(currentUser.id), role: "student", name: currentUser.name };
    var parentName = currentUser && currentUser[0] ? currentUser[0].parent : "ولي الأمر";
    return { id: parentName, role: "parent", name: parentName };
  }

  function contacts(role) {
    var students = getData("students") || [];
    if (role === "admin") {
      var parents = [];
      students.forEach(function (student) {
        if (student.parent && !parents.some(function (parent) { return parent.id === student.parent; })) {
          parents.push({ id: student.parent, role: "parent", name: student.parent, subtitle: "ولي أمر" });
        }
      });
      return [
        { title: "الطلاب", items: students.map(function (student) { return { id: String(student.id), role: "student", name: student.name, subtitle: student.username || "طالب" }; }) },
        { title: "أولياء الأمور", items: parents }
      ];
    }
    if (role === "student") {
      return [{ title: "جهات الاتصال", items: [
        { id: "admin", role: "admin", name: "المسؤول", subtitle: "المعلم" },
        { id: currentUser.parent || "", role: "parent", name: currentUser.parent || "ولي الأمر", subtitle: "ولي الأمر" }
      ].filter(function (item) { return item.id; }) }];
    }
    return [{ title: "جهات الاتصال", items: [{ id: "admin", role: "admin", name: "المسؤول", subtitle: "المعلم" }].concat((currentUser || []).map(function (student) {
      return { id: String(student.id), role: "student", name: student.name, subtitle: "الابن / الابنة" };
    })) }];
  }

  function normalized(message) {
    var fromRole = message.senderRole || message.type || "admin";
    var fromId = message.senderId != null ? String(message.senderId) : (fromRole === "admin" ? "admin" : String(message.sender || ""));
    var toRole = message.recipientRole || message.receiverType || (fromRole === "admin" ? "student" : "admin");
    var toId = message.recipientId != null ? String(message.recipientId) : message.receiverId != null ? String(message.receiverId) : message.receiverName ? String(message.receiverName) : (toRole === "admin" ? "admin" : "");
    if (fromRole === "parent" && (!fromId || fromId === "0")) fromId = String(message.sender || "");
    return { raw: message, fromRole: fromRole, fromId: fromId, toRole: toRole, toId: toId };
  }

  function isBetween(message, me, contact) {
    var item = normalized(message);
    return (item.fromRole === me.role && item.fromId === me.id && item.toRole === contact.role && item.toId === contact.id) ||
      (item.fromRole === contact.role && item.fromId === contact.id && item.toRole === me.role && item.toId === me.id);
  }

  function allContacts(role) {
    return contacts(role).reduce(function (list, group) { return list.concat(group.items); }, []);
  }

  function contactButton(item, role) {
    var selected = activeContact[role] && activeContact[role].role === item.role && activeContact[role].id === item.id;
    return '<button type="button" class="messenger-contact'+(selected ? ' active' : '')+'" data-chat-role="'+esc(role)+'" data-contact-role="'+esc(item.role)+'" data-contact-id="'+esc(item.id)+'">'+
      '<span class="messenger-avatar" aria-hidden="true">'+esc((item.name || "؟").trim().charAt(0))+'</span><span class="messenger-contact-copy"><span class="messenger-contact-name">'+esc(item.name)+'</span><span class="messenger-contact-role">'+esc(item.subtitle)+'</span></span></button>';
  }

  function render(role) {
    var host = document.getElementById(role === "admin" ? "messagesList" : role + "InboxList");
    if (!host) return;
    var groups = contacts(role);
    if (!activeContact[role]) activeContact[role] = allContacts(role)[0] || null;
    var list = groups.map(function (group) {
      return '<div class="messenger-group-title">'+esc(group.title)+'</div>'+group.items.map(function (item) { return contactButton(item, role); }).join("");
    }).join("");
    host.innerHTML = '<div class="messenger-shell'+(activeContact[role] ? ' chat-open' : '')+'" data-messenger="'+role+'"><aside class="messenger-contacts"><div class="messenger-contacts-head"><h3>المحادثات</h3></div>'+list+'</aside><section class="messenger-chat">'+chatHtml(role)+'</section></div>';
    bind(host, role);
    scrollThread(host);
  }

  function chatHtml(role) {
    var contact = activeContact[role];
    if (!contact) return '<div class="messenger-placeholder">اختر شخصًا لبدء المحادثة</div>';
    var me = actor(role);
    var messages = (getData("messages") || []).filter(function (message) { return isBetween(message, me, contact); });
    var thread = messages.length ? messages.map(function (message) {
      var item = normalized(message);
      var sent = item.fromRole === me.role && item.fromId === me.id;
      return '<article class="messenger-bubble '+(sent ? 'sent' : 'received')+'"><p>'+esc(message.text || "رسالة صوتية")+'</p>'+voiceAudioHTML(message)+'<time>'+esc(message.time || "")+'</time></article>';
    }).join("") : '<div class="messenger-empty">لا توجد رسائل بعد. ابدأ المحادثة الآن.</div>';
    return '<header class="messenger-chat-head"><button type="button" class="messenger-back" aria-label="العودة إلى المحادثات">رجوع</button><span class="messenger-avatar" aria-hidden="true">'+esc(contact.name.charAt(0))+'</span><div><strong>'+esc(contact.name)+'</strong><div class="messenger-contact-role">'+esc(contact.subtitle)+'</div></div></header><div class="messenger-thread" aria-live="polite">'+thread+'</div><div class="messenger-composer"><textarea rows="1" aria-label="نص الرسالة" placeholder="اكتب رسالة..."></textarea><button type="button" class="messenger-send">إرسال</button></div>';
  }

  function bind(host, role) {
    host.querySelectorAll("[data-contact-id]").forEach(function (button) {
      button.addEventListener("click", function () {
        activeContact[role] = allContacts(role).find(function (item) { return item.role === button.dataset.contactRole && item.id === button.dataset.contactId; }) || null;
        render(role);
      });
    });
    var back = host.querySelector(".messenger-back");
    if (back) back.addEventListener("click", function () { host.querySelector(".messenger-shell").classList.remove("chat-open"); });
    var textarea = host.querySelector(".messenger-composer textarea");
    var send = host.querySelector(".messenger-send");
    if (send) send.addEventListener("click", function () { sendDirect(role, textarea); });
    if (textarea) textarea.addEventListener("keydown", function (event) {
      if (event.key === "Enter" && !event.shiftKey && !event.isComposing && event.keyCode !== 229) { event.preventDefault(); sendDirect(role, textarea); }
    });
  }

  function sendDirect(role, textarea) {
    var text = textarea ? textarea.value.trim() : "";
    var contact = activeContact[role];
    if (!text || !contact) return;
    var me = actor(role);
    var messages = getData("messages") || [];
    messages.push({
      id: "chat-"+Date.now()+"-"+Math.random().toString(16).slice(2),
      type: me.role, sender: me.name, senderId: me.id, senderRole: me.role,
      receiverType: contact.role, receiverId: contact.role === "parent" ? undefined : contact.id,
      receiverName: contact.role === "parent" ? contact.id : undefined,
      recipientRole: contact.role, recipientId: contact.id, recipientName: contact.name,
      text: text, time: new Date().toLocaleString("ar-EG"), read: false, approved: true
    });
    setData("messages", messages);
    textarea.value = "";
    render(role);
    showToast("تم إرسال الرسالة", "success");
  }

  function scrollThread(host) {
    var thread = host.querySelector(".messenger-thread");
    if (thread) thread.scrollTop = thread.scrollHeight;
  }

  window.renderUnifiedMessenger = render;
})();
