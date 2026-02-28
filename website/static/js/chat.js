/**
 * 聊天模块
 */

const ChatModule = {
    rebuildAvatarMap(conversation) {
        State.avatarMap = {};

        (State.friends || []).forEach(f => {
            const special =
                conversation.avatar_map &&
                conversation.avatar_map[String(f.id)]
                    ? conversation.avatar_map[String(f.id)].special
                    : null;

            State.avatarMap[String(f.id)] = {
                global: f.image,
                special: special
            };
        });

        const mySpecial =
            conversation.avatar_map &&
            conversation.avatar_map[String(State.currentUser.id)]
                ? conversation.avatar_map[String(State.currentUser.id)].special
                : null;

        State.avatarMap[String(State.currentUser.id)] = {
            global: State.currentUser.image,
            special: mySpecial
        };
    },

    async selectFriend(friendName) {
        if (!friendName) return;

        State.setSelectedFriend(friendName);
        localStorage.setItem('lastSelectedFriendName', friendName);
        FriendsModule.renderFriendsList();

        try {
            const conversation = await API.getOrCreateConversation(friendName);
            console.log("conversation =", conversation);

            State.setCurrentConversation(conversation.id);
            this.rebuildAvatarMap(conversation);
            console.log("built avatarMap", State.avatarMap);

            this.renderChatHeader(friendName);

            SocketManager.joinConversation(conversation.id);
            SocketManager.getHistoryMessages(conversation.id);
        } catch (error) {
            showErrorToast('打开会话失败: ' + error.message);
        }
    },

    async refreshCurrentConversationAvatarMap() {
        if (!State.selectedFriendName || !State.currentConversationId) {
            return;
        }

        try {
            const conversation = await API.getOrCreateConversation(State.selectedFriendName);
            this.rebuildAvatarMap(conversation);
            this.renderChatHeader(State.selectedFriendName);
            renderMessages();
        } catch (error) {
            console.warn('刷新会话头像映射失败:', error);
        }
    },
    
    getAvatarForUserId(userId, conversationId) {
        const avatar = State.avatarMap[String(userId)];
        if (avatar && avatar.special) {
            return avatar.special;
        }
        return avatar ? avatar.global : '/static/images/default-avatar.png';
    },

    renderChatHeader(friendName) {
        const header = document.getElementById('chat-header');
        const inputArea = document.getElementById('input-area');
        const nameEl = document.getElementById('chat-friend-name');
        const avatarEl = document.getElementById('chat-friend-avatar');
        const statusEl = document.getElementById('chat-status');

        const friend = State.friends.find(f => f.name === friendName);

        nameEl.textContent = friendName;
        const convId = (typeof State !== 'undefined' && State.currentConversationId) ? State.currentConversationId : null;
        const avatarUrl = friend ? ChatModule.getAvatarForUserId(friend.id, convId) : '/static/images/default-avatar.png';
        avatarEl.src = avatarUrl;
        statusEl.textContent = State.socketConnected ? '在线' : '离线';

        header.classList.remove('hidden');
        inputArea.classList.remove('hidden');
    },

    resetChatPanel() {
        State.setCurrentConversation(null);
        State.clearMessages();
        localStorage.removeItem('lastSelectedFriendName');

        document.getElementById('chat-header').classList.add('hidden');
        document.getElementById('input-area').classList.add('hidden');

        const container = document.getElementById('messages-container');
        container.innerHTML = '<div class="empty-state">选择好友开始聊天</div>';
    },

    bindEvents() {

        const avatar = document.getElementById("user-avatar");

        if (avatar) {

            const fileInput = document.createElement("input");
            fileInput.type = "file";
            fileInput.accept = "image/*";
            fileInput.style.display = "none";
            document.body.appendChild(fileInput);

            avatar.addEventListener("click", () => {
                fileInput.click();
            });

            fileInput.addEventListener("change", async () => {

                const file = fileInput.files[0];
                if (!file) return;

                const formData = new FormData();
                formData.append("image", file);

                try {

                    const res = await fetch("/user/avatar", {
                        method: "POST",
                        body: formData,
                        credentials: "include"
                    });

                    const data = await res.json();

                    if (data.status === "ok") {

                        avatar.src = data.image + "?t=" + Date.now();
                        alert("头像上传成功");

                    } else {
                        alert("头像上传失败");
                    }

                } catch (e) {
                    console.error(e);
                    alert("上传错误");
                }

            });

        }

        const sendBtn = document.getElementById('send-btn');
        const input = document.getElementById('message-input');
        const imageBtn = document.getElementById('image-btn');
        const imageInput = document.getElementById('image-input');

        sendBtn.addEventListener('click', () => this.handleSendMessage());

        input.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                this.handleSendMessage();
            }
        });

        imageBtn.addEventListener('click', () => imageInput.click());
        imageInput.addEventListener('change', (event) => this.handleSendImage(event));
    },

    handleSendMessage() {
        const conversationId = State.currentConversationId;
        const input = document.getElementById('message-input');
        const content = input.value.trim();

        if (!conversationId || !content) return;

        SocketManager.sendMessage(conversationId, content);
        input.value = '';
    },

    async handleSendImage(event) {
        const file = event.target.files[0];
        const conversationId = State.currentConversationId;

        if (!file || !conversationId) {
            event.target.value = '';
            return;
        }

        try {
            const uploaded = await API.uploadImage(conversationId, file);
            if (uploaded && uploaded.content) {
                SocketManager.sendImage(conversationId, uploaded.content);
            }
        } catch (error) {
            showErrorToast('发送图片失败: ' + error.message);
        } finally {
            event.target.value = '';
        }
    },
};

function getAvatarForSender(sender) {
    // sender 可能是用户名，也可能是 user id（数字或字符串）
    // 优先使用 State.avatarMap（后端返回的会话级映射）
    const avatarMap = State.avatarMap || {};

    // 若 sender 是数字字符串或数字直接查
    if (avatarMap[String(sender)]) {
        const info = avatarMap[String(sender)];
        return (info.special && info.special.length) ? info.special : (info.global || '/static/images/default-avatar.png');
    }

    // 否则尝试把 sender 当作用户名，找出对应 id（State.friends 有 id & name）
    const friendObj = (State.friends || []).find(f => f.name === sender || String(f.id) === String(sender));
    if (friendObj && avatarMap[String(friendObj.id)]) {
        const info = avatarMap[String(friendObj.id)];
        return (info.special && info.special.length) ? info.special : (info.global || '/static/images/default-avatar.png');
    }

    // 最后退回到 friend 列表里存的 image 字段（如果有），否则默认
    if (friendObj && friendObj.image) return friendObj.image;

    return '/static/images/default-avatar.png';
}

function renderMessages() {
    const container = document.getElementById('messages-container');
    if (!State.messages.length) {
        container.innerHTML = '<div class="empty-state">暂无消息，开始聊天吧</div>';
        return;
    }

    container.innerHTML = State.messages.map(msg => {
        const mine = msg.sender === State.currentUser.name || msg.sender === String(State.currentUser.id);
        const isImage = typeof msg.content === 'string' && msg.content.startsWith('/uploads/');

        // avatar：从 avatar_map、friends 或默认中获取
        const avatarUrl = getAvatarForSender(msg.sender);

        // 发送者显示名（保持你现在的显示方式）
        const senderDisplay = escapeHtml(msg.sender || '');

        const contentHtml = isImage
            ? `<img src="${msg.content}" alt="图片消息" class="message-image">`
            : escapeHtml(msg.content || '');

        return `
            <div class="message-item ${mine ? 'mine' : 'other'}">
                <img class="message-avatar" src="${avatarUrl}" alt="avatar" />
                <div class="message-body">
                    <div class="message-meta">${senderDisplay}</div>
                    <div class="message-content">${contentHtml}</div>
                </div>
            </div>
        `;
    }).join('');

    // 滚到底部（保留你现有的滚动）
    scrollMessagesToBottom();
}

function scrollMessagesToBottom() {
    const container = document.getElementById('messages-container');
    container.scrollTop = container.scrollHeight;
}

function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;',
    };
    return String(text).replace(/[&<>"']/g, function(m) { return map[m]; });
}

const currentFriend = "{{ friend_username }}";

// 必须挂到 window
window.chooseSpecialAvatar = function () {

    console.log("chooseSpecialAvatar triggered");

    const input = document.getElementById("specialAvatarInput");

    input.click();
};


window.uploadSpecialAvatar = async function () {
    console.log("uploadSpecialAvatar triggered");

    const file = document.getElementById("specialAvatarInput").files[0];
    if (!file){
        alert("请选择图片");
        return;
    }

    // Try several fallbacks for the friend identifier:
    // - State.selectedFriend (preferred if it is the username)
    // - State.selectedFriendName (some codebases use this)
    // - If we have a selected friend object in State.friends, use its name
    let friend = State.selectedFriend || State.selectedFriendName || null;
    if (!friend && Array.isArray(State.friends)) {
        const f = State.friends.find(fr => String(fr.id) === String(State.selectedFriend) || fr.name === State.selectedFriend);
        if (f) friend = f.name;
    }

    // Last resort: if none found, ask the user (avoids sending undefined)
    if (!friend) {
        console.warn("uploadSpecialAvatar: friend not found in State; aborting");
        alert("找不到当前好友，请先打开与好友的聊天窗口再设置专属头像。");
        return;
    }

    console.log("uploadSpecialAvatar friend =", friend);

    const formData = new FormData();
    formData.append("image", file);
    formData.append("friend", friend); // backend expects 'friend' (username). We'll extend backend to accept id too.

    const response = await fetch("/friend/set_avatar", {
        method: "POST",
        body: formData
    });

    const text = await response.text();
    let data;
    try {
        data = JSON.parse(text);
    } catch (e) {
        console.error("uploadSpecialAvatar: response not JSON:", text);
        alert("服务器返回了非 JSON 内容，查看后端日志。");
        return;
    }

    console.log("response status =", response.status, "data =", data);

    if (response.ok && data.status === "ok") {
        // update local avatar map immediately
        const myId = String(State.currentUser && State.currentUser.id);
        if (!State.avatarMap) State.avatarMap = {};
        if (!State.avatarMap[myId]) State.avatarMap[myId] = {};
        State.avatarMap[myId].special = data.image_url || data.imageurl || data.imageUrl;
        renderMessages();
        alert("专属头像设置成功");
    } else {
        console.warn("uploadSpecialAvatar failed:", data);
        alert("设置失败: " + (data.error || data.detail || JSON.stringify(data)));
    }
};

function setupGlobalAvatarUpload() {
  // 尝试找到左上角头像元素
  let userAvatarEl = document.getElementById('user-avatar') || document.querySelector('.user-info .avatar');
  // 尝试找到隐藏文件 input
  let globalAvatarInput = document.getElementById('global-avatar-input');

  // 如果模板没有 input，就动态创建一个隐藏的 input 放到 body 里（保底）
  if (!globalAvatarInput) {
    globalAvatarInput = document.createElement('input');
    globalAvatarInput.type = 'file';
    globalAvatarInput.accept = 'image/*';
    globalAvatarInput.id = 'global-avatar-input';
    globalAvatarInput.style.display = 'none';
    document.body.appendChild(globalAvatarInput);
  }

  // 如果找不到头像 DOM，就不绑定（可能页面尚未渲染某些区域）
  if (!userAvatarEl) return;

  // UX：指针样式
  userAvatarEl.style.cursor = 'pointer';

  // 点击头像打开文件选择
  userAvatarEl.addEventListener('click', () => globalAvatarInput.click());

  // 选择文件后上传
  globalAvatarInput.addEventListener('change', async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    // 上传状态样式（你已有的 CSS 会响应 .uploading）
    userAvatarEl.classList && userAvatarEl.classList.add('uploading');

    try {
      // 调用你 api.js 中的封装（优先 API.uploadGlobalAvatar）
      let res;
      if (typeof API !== 'undefined' && API.uploadGlobalAvatar) {
        res = await API.uploadGlobalAvatar(file);
      } else if (typeof uploadGlobalAvatar === 'function') {
        res = await uploadGlobalAvatar(file);
      } else {
        // 如果都没有，抛出错误，提示需把上传函数合并进 API
        throw new Error('找不到上传函数：请在 api.js 中实现 API.uploadGlobalAvatar(imageFile)');
      }

      // 兼容后端返回字段（你的后端示例返回 {status:"ok", image:"/uploads/xxx.png"}）
      const newImageUrl = res && (res.image || res.url || (res.data && res.data.image));
      if (!newImageUrl) throw new Error('服务器未返回头像 URL');

      // 更新前端状态（兼容 State / window.currentUser）
      try {
        if (typeof State !== 'undefined') {
          State.currentUser = State.currentUser || {};
          State.currentUser.image = newImageUrl;
          State.avatarMap = State.avatarMap || {};
          const myKey = String(State.currentUser.id || 'me');
          State.avatarMap[myKey] = State.avatarMap[myKey] || {};
          State.avatarMap[myKey].global = newImageUrl;
        } else {
          window.currentUser = window.currentUser || {};
          window.currentUser.image = newImageUrl;
          window.avatarMap = window.avatarMap || {};
          window.avatarMap[String(window.currentUser.id || 'me')] = window.avatarMap[String(window.currentUser.id || 'me')] || {};
          window.avatarMap[String(window.currentUser.id || 'me')].global = newImageUrl;
        }
      } catch (errState) {
        console.warn('更新本地 State 失败：', errState);
      }

      // 立即更新 DOM 上的左上角头像
      userAvatarEl.src = newImageUrl;

      // 触发 UI 刷新：尝试调用项目内的渲染函数（如果存在）
      try { if (typeof FriendsModule !== 'undefined' && FriendsModule.renderFriendsList) FriendsModule.renderFriendsList(); } catch(e){}
      try { if (typeof ChatModule !== 'undefined' && ChatModule.renderChatHeader) ChatModule.renderChatHeader(); } catch(e){}

      // 可选：拉取 /user 同步其余字段（兼容后端逻辑）
      try {
        if (typeof API !== 'undefined' && API.getCurrentUser) {
          const updatedUser = await API.getCurrentUser();
          if (updatedUser) {
            if (typeof State !== 'undefined') State.currentUser = updatedUser;
            else window.currentUser = updatedUser;
          }
        }
      } catch (e) { console.warn('刷新 /user 失败', e); }

      // 轻提示（项目有 toast 时替换）
      if (typeof showErrorToast === 'function') showErrorToast('全局头像已更新');
      else console.log('全局头像已更新');

    } catch (err) {
      console.error('上传全局头像失败：', err);
      if (typeof showErrorToast === 'function') showErrorToast('头像上传失败：' + (err.message || err));
      else alert('头像上传失败：' + (err.message || err));
    } finally {
      userAvatarEl.classList && userAvatarEl.classList.remove('uploading');
      e.target.value = ''; // 允许重复选择同一文件
    }
  });
}

// 暴露给外部（main.js 将调用）
window.setupGlobalAvatarUpload = setupGlobalAvatarUpload;
window.ChatModule = ChatModule;
window.renderMessages = renderMessages;
window.scrollMessagesToBottom = scrollMessagesToBottom;

console.log("chat.js loaded");