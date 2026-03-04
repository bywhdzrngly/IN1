/**
 * 聊天模块
 */

const DEFAULT_AVATAR_DATA_URI = 'data:image/svg+xml,%3Csvg%20xmlns%3D%22http://www.w3.org/2000/svg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22currentColor%22%3E%3Ccircle%20cx%3D%2212%22%20cy%3D%2212%22%20r%3D%2210%22/%3E%3Cpath%20d%3D%22M12%2012c2.21%200%204-1.79%204-4s-1.79-4-4-4-4%201.79-4%204%201.79%204%204%204zm0%202c-2.67%200-8%201.34-8%204v2h16v-2c0-2.66-5.33-4-8-4z%22/%3E%3C/svg%3E';
const BUBBLE_DRAW_DEFAULT_BG = '#ffffff';
const BUBBLE_DRAW_DEFAULT_LINE = '#1f2937';
const BUBBLE_DRAW_DEFAULT_FILL = '#22c55e';

const BubbleComposer = {
    initialized: false,
    actionModal: null,
    drawModal: null,
    exportModal: null,
    textColorModal: null,
    canvas: null,
    ctx: null,
    bgInput: null,
    lineInput: null,
    fileInput: null,
    uploadExistingBtn: null,
    drawNewBtn: null,
    actionCancelBtn: null,
    drawCancelBtn: null,
    drawDoneBtn: null,
    drawUndoBtn: null,
    drawClearBtn: null,
    fillBtn: null,
    fillColorInput: null,
    exportUploadOnlyBtn: null,
    exportUploadSaveBtn: null,
    exportBackBtn: null,
    textColorInput: null,
    textColorPreview: null,
    textColorConfirmBtn: null,
    textColorCancelBtn: null,
    paintLayer: null,
    paintCtx: null,
    bgColor: BUBBLE_DRAW_DEFAULT_BG,
    lineColor: BUBBLE_DRAW_DEFAULT_LINE,
    fillColor: BUBBLE_DRAW_DEFAULT_FILL,
    lineWidth: 4,
    toolMode: 'draw',
    isDrawing: false,
    lastX: 0,
    lastY: 0,
    currentFriendName: null,
    pendingBlob: null,
    undoStack: [],
    pendingTextColorResolve: null,
};

const ChatModule = {
    rebuildAvatarMap(conversation) {
        const conversationAvatarMap = conversation.avatar_map || conversation.map || {};
        State.avatarMap = {};

        (State.friends || []).forEach(f => {
            const friendMap = conversationAvatarMap[String(f.id)] || {};

            State.avatarMap[String(f.id)] = {
                global: f.image,
                special: friendMap.special || null,
                bubble: friendMap.bubble || null,
                text_color: friendMap.text_color || null,
            };
        });

        const myMap = conversationAvatarMap[String(State.currentUser.id)] || {};

        State.avatarMap[String(State.currentUser.id)] = {
            global: State.currentUser.image,
            special: myMap.special || null,
            bubble: myMap.bubble || null,
            text_color: myMap.text_color || null,
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
        return avatar ? avatar.global : DEFAULT_AVATAR_DATA_URI;
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
        const avatarUrl = friend ? ChatModule.getAvatarForUserId(friend.id, convId) : DEFAULT_AVATAR_DATA_URI;
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
        initBubbleComposerUI();
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
    const currentUser = State.currentUser || {};
    const myId = String(currentUser.id || '');

    // 当前用户自己的消息：直接用自己的会话头像规则（专属 > 全局）
    if ((currentUser.name && sender === currentUser.name) || (myId && String(sender) === myId)) {
        const meInfo = avatarMap[myId] || {};
        return (meInfo.special && meInfo.special.length)
            ? meInfo.special
            : (meInfo.global || currentUser.image || DEFAULT_AVATAR_DATA_URI);
    }

    // 若 sender 是数字字符串或数字直接查
    if (avatarMap[String(sender)]) {
        const info = avatarMap[String(sender)];
        return (info.special && info.special.length) ? info.special : (info.global || DEFAULT_AVATAR_DATA_URI);
    }

    // 否则尝试把 sender 当作用户名，找出对应 id（State.friends 有 id & name）
    const friendObj = (State.friends || []).find(f => f.name === sender || String(f.id) === String(sender));
    if (friendObj && avatarMap[String(friendObj.id)]) {
        const info = avatarMap[String(friendObj.id)];
        return (info.special && info.special.length) ? info.special : (info.global || DEFAULT_AVATAR_DATA_URI);
    }

    // 最后退回到 friend 列表里存的 image 字段（如果有），否则默认
    if (friendObj && friendObj.image) return friendObj.image;

    return DEFAULT_AVATAR_DATA_URI;
}

function getBubbleForSender(sender) {
    const avatarMap = State.avatarMap || {};
    const currentUser = State.currentUser || {};
    const myId = String(currentUser.id || '');

    if ((currentUser.name && sender === currentUser.name) || (myId && String(sender) === myId)) {
        const meInfo = avatarMap[myId] || {};
        return meInfo.bubble || null;
    }

    const direct = avatarMap[String(sender)];
    if (direct && direct.bubble) {
        return direct.bubble;
    }

    const friendObj = (State.friends || []).find(f => f.name === sender || String(f.id) === String(sender));
    if (friendObj && avatarMap[String(friendObj.id)] && avatarMap[String(friendObj.id)].bubble) {
        return avatarMap[String(friendObj.id)].bubble;
    }

    return null;
}

function getBubbleTextColorForSender(sender) {
    const avatarMap = State.avatarMap || {};
    const currentUser = State.currentUser || {};
    const myId = String(currentUser.id || '');

    if ((currentUser.name && sender === currentUser.name) || (myId && String(sender) === myId)) {
        const meInfo = avatarMap[myId] || {};
        return normalizeHexColor(meInfo.text_color);
    }

    const direct = avatarMap[String(sender)];
    if (direct && direct.text_color) {
        return normalizeHexColor(direct.text_color);
    }

    const friendObj = (State.friends || []).find(f => f.name === sender || String(f.id) === String(sender));
    if (friendObj && avatarMap[String(friendObj.id)] && avatarMap[String(friendObj.id)].text_color) {
        return normalizeHexColor(avatarMap[String(friendObj.id)].text_color);
    }

    return null;
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
        const bubbleUrl = getBubbleForSender(msg.sender);
        const textColor = isImage ? null : getBubbleTextColorForSender(msg.sender);

        const senderDisplay = escapeHtml(msg.sender || '');

        const contentHtml = isImage
            ? `<img src="${msg.content}" alt="图片消息" class="message-image">`
            : escapeHtml(msg.content || '');
        const bubbleClass = bubbleUrl
            ? `message-content message-content-custom-bubble${isImage ? ' message-content-custom-bubble-image' : ''}`
            : 'message-content';
        const bubbleStyle = bubbleUrl
            ? ` style="--bubble-image: url('${escapeUrlForCss(bubbleUrl)}');${textColor ? ` --bubble-text-color: ${textColor}; color: ${textColor};` : ''}"`
            : '';

        return `
            <div class="message-item ${mine ? 'mine' : 'other'}">
                <img class="message-avatar" src="${avatarUrl}" alt="avatar" />
                <div class="message-body">
                    <div class="message-meta">${senderDisplay}</div>
                    <div class="${bubbleClass}"${bubbleStyle}>${contentHtml}</div>
                </div>
            </div>
        `;
    }).join('');

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
    return String(text).replace(/[&<>"']/g, function (m) { return map[m]; });
}

function escapeUrlForCss(url) {
    return String(url || '')
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "\\'")
        .replace(/"/g, '\\"');
}

function normalizeHexColor(color) {
    if (!color) return null;
    const value = String(color).trim();
    if (!/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value)) {
        return null;
    }
    if (value.length === 4) {
        return (
            '#' +
            value[1] + value[1] +
            value[2] + value[2] +
            value[3] + value[3]
        ).toLowerCase();
    }
    return value.toLowerCase();
}

function resolveSelectedFriendName() {
    let friend = State.selectedFriend || State.selectedFriendName || null;
    if (!friend && Array.isArray(State.friends)) {
        const matched = State.friends.find(
            (fr) => String(fr.id) === String(State.selectedFriend) || fr.name === State.selectedFriend
        );
        if (matched) friend = matched.name;
    }
    return friend;
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
    if (!file) {
        alert("请选择图片");
        return;
    }

    let friend = resolveSelectedFriendName();

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

function hideAllBubbleModals() {
    if (BubbleComposer.actionModal) BubbleComposer.actionModal.classList.add('hidden');
    if (BubbleComposer.drawModal) BubbleComposer.drawModal.classList.add('hidden');
    if (BubbleComposer.exportModal) BubbleComposer.exportModal.classList.add('hidden');
    if (BubbleComposer.textColorModal) BubbleComposer.textColorModal.classList.add('hidden');
}

function openBubbleActionModal() {
    hideAllBubbleModals();
    if (BubbleComposer.actionModal) {
        BubbleComposer.actionModal.classList.remove('hidden');
    }
}

function openBubbleDrawModal(options) {
    const shouldReset = !options || options.reset !== false;
    hideAllBubbleModals();
    if (BubbleComposer.drawModal) {
        BubbleComposer.drawModal.classList.remove('hidden');
    }
    if (shouldReset) {
        resetBubbleComposerCanvas();
    } else {
        renderBubbleComposerCanvas();
    }
}

function openBubbleExportModal() {
    hideAllBubbleModals();
    if (BubbleComposer.exportModal) {
        BubbleComposer.exportModal.classList.remove('hidden');
    }
}

function updateBubbleTextColorPreview(color) {
    if (!BubbleComposer.textColorPreview) return;
    const normalized = normalizeHexColor(color) || '#111827';
    const preview = BubbleComposer.textColorPreview;
    preview.style.color = normalized;

    const myId = String((State.currentUser && State.currentUser.id) || '');
    const currentMap = (State.avatarMap && State.avatarMap[myId]) || {};
    const bubbleUrl = currentMap.bubble || null;

    if (bubbleUrl) {
        preview.classList.add('bubble-text-color-preview-custom');
        preview.classList.remove('bubble-text-color-preview-default');
        preview.style.setProperty('--bubble-image', `url('${escapeUrlForCss(bubbleUrl)}')`);
    } else {
        preview.classList.remove('bubble-text-color-preview-custom');
        preview.classList.add('bubble-text-color-preview-default');
        preview.style.removeProperty('--bubble-image');
    }
}

function closeBubbleTextColorModal(selectedColor) {
    if (BubbleComposer.textColorModal) {
        BubbleComposer.textColorModal.classList.add('hidden');
    }
    const resolve = BubbleComposer.pendingTextColorResolve;
    BubbleComposer.pendingTextColorResolve = null;
    if (resolve) {
        resolve(selectedColor || null);
    }
}

function openBubbleTextColorModal(initialColor) {
    const normalized = normalizeHexColor(initialColor) || '#111827';
    hideAllBubbleModals();
    if (BubbleComposer.textColorModal) {
        BubbleComposer.textColorModal.classList.remove('hidden');
    }
    if (BubbleComposer.textColorInput) {
        BubbleComposer.textColorInput.value = normalized;
    }
    updateBubbleTextColorPreview(normalized);
    if (BubbleComposer.textColorInput && typeof BubbleComposer.textColorInput.showPicker === 'function') {
        try {
            BubbleComposer.textColorInput.showPicker();
        } catch (error) {
            // ignore: some browsers require stricter user-activation timing
        }
    }

    return new Promise((resolve) => {
        BubbleComposer.pendingTextColorResolve = resolve;
    });
}

function ensureBubblePainterLayer() {
    if (BubbleComposer.paintLayer) return;
    const canvas = BubbleComposer.canvas;
    if (!canvas) return;
    BubbleComposer.paintLayer = document.createElement('canvas');
    BubbleComposer.paintLayer.width = canvas.width;
    BubbleComposer.paintLayer.height = canvas.height;
    BubbleComposer.paintCtx = BubbleComposer.paintLayer.getContext('2d');
    if (BubbleComposer.paintCtx) {
        BubbleComposer.paintCtx.lineCap = 'round';
        BubbleComposer.paintCtx.lineJoin = 'round';
    }
}

function getGuideLineColorByBackground(bgColor) {
    const color = String(bgColor || '').trim().toLowerCase();
    const match = color.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);

    let hex = '#ffffff';
    if (match) {
        if (match[1].length === 3) {
            hex = `#${match[1][0]}${match[1][0]}${match[1][1]}${match[1][1]}${match[1][2]}${match[1][2]}`.toLowerCase();
        } else {
            hex = `#${match[1].toLowerCase()}`;
        }
    }

    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;

    return luminance < 0.45 ? 'rgba(255, 255, 255, 0.78)' : 'rgba(0, 0, 0, 0.45)';
}

function drawBubbleNineSliceGuide(ctx, width, height) {
    const x1 = width / 3;
    const x2 = (width * 2) / 3;
    const y1 = height / 3;
    const y2 = (height * 2) / 3;

    ctx.save();
    ctx.setLineDash([6, 4]);
    ctx.strokeStyle = getGuideLineColorByBackground(BubbleComposer.bgColor);
    ctx.lineWidth = 1;

    ctx.beginPath();
    ctx.moveTo(x1, 0);
    ctx.lineTo(x1, height);
    ctx.moveTo(x2, 0);
    ctx.lineTo(x2, height);
    ctx.moveTo(0, y1);
    ctx.lineTo(width, y1);
    ctx.moveTo(0, y2);
    ctx.lineTo(width, y2);
    ctx.stroke();
    ctx.restore();
}

function renderBubbleComposerCanvas() {
    const { canvas, ctx, paintLayer, bgColor } = BubbleComposer;
    if (!canvas || !ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (paintLayer) {
        ctx.drawImage(paintLayer, 0, 0);
    }

    drawBubbleNineSliceGuide(ctx, canvas.width, canvas.height);
}

function setBubbleToolMode(mode) {
    BubbleComposer.toolMode = mode === 'fill' ? 'fill' : 'draw';
    if (BubbleComposer.fillBtn) {
        BubbleComposer.fillBtn.classList.toggle('bubble-tool-active', BubbleComposer.toolMode === 'fill');
    }
    if (BubbleComposer.canvas) {
        BubbleComposer.canvas.style.cursor = BubbleComposer.toolMode === 'fill' ? 'cell' : 'crosshair';
    }
}

function hexToRgba(hexColor, alpha) {
    const normalized = normalizeHexColor(hexColor);
    if (!normalized) return [34, 197, 94, alpha];
    return [
        parseInt(normalized.slice(1, 3), 16),
        parseInt(normalized.slice(3, 5), 16),
        parseInt(normalized.slice(5, 7), 16),
        alpha,
    ];
}

function updateBubbleUndoButtonState() {
    if (!BubbleComposer.drawUndoBtn) return;
    BubbleComposer.drawUndoBtn.disabled = BubbleComposer.undoStack.length === 0;
}

function pushBubbleUndoSnapshot() {
    const { paintCtx, paintLayer } = BubbleComposer;
    if (!paintCtx || !paintLayer) return;

    try {
        const snapshot = paintCtx.getImageData(0, 0, paintLayer.width, paintLayer.height);
        BubbleComposer.undoStack.push(snapshot);
        if (BubbleComposer.undoStack.length > 50) {
            BubbleComposer.undoStack.shift();
        }
        updateBubbleUndoButtonState();
    } catch (error) {
        console.warn('保存撤回快照失败:', error);
    }
}

function undoBubbleComposerStroke() {
    const { paintCtx, paintLayer } = BubbleComposer;
    if (!paintCtx || !paintLayer) return;
    if (!BubbleComposer.undoStack.length) return;

    const snapshot = BubbleComposer.undoStack.pop();
    paintCtx.clearRect(0, 0, paintLayer.width, paintLayer.height);
    if (snapshot) {
        paintCtx.putImageData(snapshot, 0, 0);
    }
    updateBubbleUndoButtonState();
    renderBubbleComposerCanvas();
}

function resetBubbleComposerCanvas() {
    ensureBubblePainterLayer();
    BubbleComposer.bgColor = BUBBLE_DRAW_DEFAULT_BG;
    BubbleComposer.lineColor = BUBBLE_DRAW_DEFAULT_LINE;
    BubbleComposer.fillColor = BUBBLE_DRAW_DEFAULT_FILL;
    if (BubbleComposer.bgInput) BubbleComposer.bgInput.value = BubbleComposer.bgColor;
    if (BubbleComposer.lineInput) BubbleComposer.lineInput.value = BubbleComposer.lineColor;
    if (BubbleComposer.fillColorInput) BubbleComposer.fillColorInput.value = BubbleComposer.fillColor;
    if (BubbleComposer.paintCtx && BubbleComposer.paintLayer) {
        BubbleComposer.paintCtx.clearRect(0, 0, BubbleComposer.paintLayer.width, BubbleComposer.paintLayer.height);
    }
    BubbleComposer.pendingBlob = null;
    BubbleComposer.undoStack = [];
    BubbleComposer.isDrawing = false;
    setBubbleToolMode('draw');
    updateBubbleUndoButtonState();
    renderBubbleComposerCanvas();
}

function getCanvasPoint(event) {
    const rect = BubbleComposer.canvas.getBoundingClientRect();
    const scaleX = BubbleComposer.canvas.width / rect.width;
    const scaleY = BubbleComposer.canvas.height / rect.height;
    return {
        x: (event.clientX - rect.left) * scaleX,
        y: (event.clientY - rect.top) * scaleY,
    };
}

function startBubbleDrawing(event) {
    if (!BubbleComposer.paintCtx) return;
    pushBubbleUndoSnapshot();
    setBubbleToolMode('draw');
    BubbleComposer.isDrawing = true;
    const p = getCanvasPoint(event);
    BubbleComposer.lastX = p.x;
    BubbleComposer.lastY = p.y;

    BubbleComposer.paintCtx.strokeStyle = BubbleComposer.lineColor;
    BubbleComposer.paintCtx.lineWidth = BubbleComposer.lineWidth;
    BubbleComposer.paintCtx.beginPath();
    BubbleComposer.paintCtx.moveTo(p.x, p.y);
    BubbleComposer.paintCtx.lineTo(p.x + 0.01, p.y + 0.01);
    BubbleComposer.paintCtx.stroke();
    renderBubbleComposerCanvas();
}

function continueBubbleDrawing(event) {
    if (!BubbleComposer.isDrawing || !BubbleComposer.paintCtx) return;
    const p = getCanvasPoint(event);
    BubbleComposer.paintCtx.strokeStyle = BubbleComposer.lineColor;
    BubbleComposer.paintCtx.lineWidth = BubbleComposer.lineWidth;
    BubbleComposer.paintCtx.beginPath();
    BubbleComposer.paintCtx.moveTo(BubbleComposer.lastX, BubbleComposer.lastY);
    BubbleComposer.paintCtx.lineTo(p.x, p.y);
    BubbleComposer.paintCtx.stroke();
    BubbleComposer.lastX = p.x;
    BubbleComposer.lastY = p.y;
    renderBubbleComposerCanvas();
}

function stopBubbleDrawing() {
    BubbleComposer.isDrawing = false;
}

function fillBubbleComposerAtPoint(x, y) {
    const { paintCtx, paintLayer } = BubbleComposer;
    if (!paintCtx || !paintLayer) return false;

    const width = paintLayer.width;
    const height = paintLayer.height;
    const startX = Math.floor(x);
    const startY = Math.floor(y);

    if (startX < 0 || startX >= width || startY < 0 || startY >= height) {
        return false;
    }

    let imageData;
    try {
        imageData = paintCtx.getImageData(0, 0, width, height);
    } catch (error) {
        console.warn('读取画布像素失败:', error);
        return false;
    }

    const data = imageData.data;
    const startOffset = (startY * width + startX) * 4;
    const targetR = data[startOffset];
    const targetG = data[startOffset + 1];
    const targetB = data[startOffset + 2];
    const targetA = data[startOffset + 3];
    const [fillR, fillG, fillB, fillA] = hexToRgba(BubbleComposer.fillColor, 255);

    if (
        targetR === fillR &&
        targetG === fillG &&
        targetB === fillB &&
        targetA === fillA
    ) {
        return false;
    }

    pushBubbleUndoSnapshot();

    const stack = [[startX, startY]];
    const visited = new Uint8Array(width * height);

    while (stack.length) {
        const point = stack.pop();
        const px = point[0];
        const py = point[1];

        if (px < 0 || py < 0 || px >= width || py >= height) continue;

        const pixelIndex = py * width + px;
        if (visited[pixelIndex]) continue;
        visited[pixelIndex] = 1;

        const idx = pixelIndex * 4;
        if (
            data[idx] !== targetR ||
            data[idx + 1] !== targetG ||
            data[idx + 2] !== targetB ||
            data[idx + 3] !== targetA
        ) {
            continue;
        }

        data[idx] = fillR;
        data[idx + 1] = fillG;
        data[idx + 2] = fillB;
        data[idx + 3] = fillA;

        stack.push([px + 1, py]);
        stack.push([px - 1, py]);
        stack.push([px, py + 1]);
        stack.push([px, py - 1]);
    }

    paintCtx.putImageData(imageData, 0, 0);
    renderBubbleComposerCanvas();
    return true;
}

function exportBubbleCanvasBlob() {
    return new Promise((resolve, reject) => {
        ensureBubblePainterLayer();
        if (!BubbleComposer.paintLayer) {
            reject(new Error('画布初始化失败'));
            return;
        }

        const exportCanvas = document.createElement('canvas');
        exportCanvas.width = BubbleComposer.paintLayer.width;
        exportCanvas.height = BubbleComposer.paintLayer.height;
        const exportCtx = exportCanvas.getContext('2d');
        if (!exportCtx) {
            reject(new Error('导出上下文创建失败'));
            return;
        }

        exportCtx.fillStyle = BubbleComposer.bgColor;
        exportCtx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
        exportCtx.drawImage(BubbleComposer.paintLayer, 0, 0);

        exportCanvas.toBlob((blob) => {
            if (!blob) {
                reject(new Error('导出图片失败'));
                return;
            }
            resolve(blob);
        }, 'image/png');
    });
}

function downloadBubbleBlob(blob, friendName) {
    const safeFriend = (friendName || 'friend').replace(/[^\w\u4e00-\u9fa5-]/g, '_');
    const filename = `bubble-${safeFriend}-${Date.now()}.png`;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function uploadBubbleImageForFriend(imageFile, friendName) {
    let data = null;
    if (typeof API !== 'undefined' && typeof API.setFriendBubble === 'function') {
        data = await API.setFriendBubble(friendName, imageFile);
    } else {
        const formData = new FormData();
        formData.append('friend', friendName);
        formData.append('image', imageFile);
        const response = await fetch('/friend/set_bubble', {
            method: 'POST',
            body: formData,
            credentials: 'include',
        });
        data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || `HTTP ${response.status}`);
        }
    }

    const bubbleUrl = data && (data.image_url || data.imageUrl || data.url);
    if (!bubbleUrl) {
        throw new Error('服务器未返回气泡图片地址');
    }

    const myId = String(State.currentUser && State.currentUser.id);
    if (!State.avatarMap) State.avatarMap = {};
    if (!State.avatarMap[myId]) State.avatarMap[myId] = {};
    State.avatarMap[myId].bubble = bubbleUrl;

    renderMessages();
    if (window.ChatModule && typeof window.ChatModule.refreshCurrentConversationAvatarMap === 'function') {
        await window.ChatModule.refreshCurrentConversationAvatarMap();
    }

    return bubbleUrl;
}

async function setBubbleTextColorForFriend(friendName, color) {
    const normalized = normalizeHexColor(color);
    if (!normalized) {
        throw new Error('字体颜色格式无效');
    }

    let data = null;
    if (typeof API !== 'undefined' && typeof API.setFriendBubbleTextColor === 'function') {
        data = await API.setFriendBubbleTextColor(friendName, normalized);
    } else {
        const response = await fetch('/friend/set_bubble_text_color', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ friend: friendName, color: normalized }),
        });
        data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || `HTTP ${response.status}`);
        }
    }

    const textColor = normalizeHexColor((data && (data.text_color || data.color)) || normalized) || normalized;
    const myId = String(State.currentUser && State.currentUser.id);
    if (!State.avatarMap) State.avatarMap = {};
    if (!State.avatarMap[myId]) State.avatarMap[myId] = {};
    State.avatarMap[myId].text_color = textColor;

    renderMessages();
    if (window.ChatModule && typeof window.ChatModule.refreshCurrentConversationAvatarMap === 'function') {
        await window.ChatModule.refreshCurrentConversationAvatarMap();
    }

    return textColor;
}

async function finishBubbleDrawing(options) {
    const { saveLocal } = options || {};
    const friend = BubbleComposer.currentFriendName || resolveSelectedFriendName();
    if (!friend) {
        throw new Error('找不到当前好友');
    }
    if (!BubbleComposer.pendingBlob) {
        throw new Error('没有可上传的绘制结果');
    }

    if (saveLocal) {
        downloadBubbleBlob(BubbleComposer.pendingBlob, friend);
    }

    const fileName = `bubble-${Date.now()}.png`;
    const file = new File([BubbleComposer.pendingBlob], fileName, { type: 'image/png' });
    await uploadBubbleImageForFriend(file, friend);

    BubbleComposer.pendingBlob = null;
    hideAllBubbleModals();
    if (typeof showErrorToast === 'function') {
        showErrorToast('专属气泡设置成功');
    }
}

function initBubbleComposerUI() {
    if (BubbleComposer.initialized) return;

    BubbleComposer.actionModal = document.getElementById('bubble-action-modal');
    BubbleComposer.drawModal = document.getElementById('bubble-draw-modal');
    BubbleComposer.exportModal = document.getElementById('bubble-export-modal');
    BubbleComposer.textColorModal = document.getElementById('bubble-text-color-modal');
    BubbleComposer.canvas = document.getElementById('bubble-draw-canvas');
    BubbleComposer.bgInput = document.getElementById('bubble-bg-color');
    BubbleComposer.lineInput = document.getElementById('bubble-line-color');
    BubbleComposer.fileInput = document.getElementById('specialBubbleInput');
    BubbleComposer.uploadExistingBtn = document.getElementById('bubble-upload-existing-btn');
    BubbleComposer.drawNewBtn = document.getElementById('bubble-draw-new-btn');
    BubbleComposer.actionCancelBtn = document.getElementById('bubble-action-cancel-btn');
    BubbleComposer.drawCancelBtn = document.getElementById('bubble-draw-cancel-btn');
    BubbleComposer.drawDoneBtn = document.getElementById('bubble-draw-done-btn');
    BubbleComposer.drawUndoBtn = document.getElementById('bubble-undo-btn');
    BubbleComposer.drawClearBtn = document.getElementById('bubble-clear-btn');
    BubbleComposer.fillBtn = document.getElementById('bubble-fill-btn');
    BubbleComposer.fillColorInput = document.getElementById('bubble-fill-color');
    BubbleComposer.exportUploadOnlyBtn = document.getElementById('bubble-upload-only-btn');
    BubbleComposer.exportUploadSaveBtn = document.getElementById('bubble-upload-save-local-btn');
    BubbleComposer.exportBackBtn = document.getElementById('bubble-export-back-btn');
    BubbleComposer.textColorInput = document.getElementById('bubble-text-color-input');
    BubbleComposer.textColorPreview = document.getElementById('bubble-text-color-preview');
    BubbleComposer.textColorConfirmBtn = document.getElementById('bubble-text-color-confirm-btn');
    BubbleComposer.textColorCancelBtn = document.getElementById('bubble-text-color-cancel-btn');

    if (!BubbleComposer.canvas) {
        return;
    }

    BubbleComposer.ctx = BubbleComposer.canvas.getContext('2d');
    ensureBubblePainterLayer();
    resetBubbleComposerCanvas();

    if (BubbleComposer.uploadExistingBtn) {
        BubbleComposer.uploadExistingBtn.addEventListener('click', () => {
            hideAllBubbleModals();
            if (BubbleComposer.fileInput) {
                BubbleComposer.fileInput.click();
            }
        });
    }

    if (BubbleComposer.drawNewBtn) {
        BubbleComposer.drawNewBtn.addEventListener('click', () => {
            openBubbleDrawModal({ reset: true });
        });
    }

    if (BubbleComposer.actionCancelBtn) {
        BubbleComposer.actionCancelBtn.addEventListener('click', () => {
            hideAllBubbleModals();
        });
    }

    if (BubbleComposer.drawCancelBtn) {
        BubbleComposer.drawCancelBtn.addEventListener('click', () => {
            openBubbleActionModal();
        });
    }

    if (BubbleComposer.drawClearBtn) {
        BubbleComposer.drawClearBtn.addEventListener('click', () => {
            if (BubbleComposer.paintCtx && BubbleComposer.paintLayer) {
                pushBubbleUndoSnapshot();
                BubbleComposer.paintCtx.clearRect(0, 0, BubbleComposer.paintLayer.width, BubbleComposer.paintLayer.height);
            }
            renderBubbleComposerCanvas();
        });
    }

    if (BubbleComposer.drawUndoBtn) {
        BubbleComposer.drawUndoBtn.addEventListener('click', () => {
            undoBubbleComposerStroke();
        });
    }

    if (BubbleComposer.bgInput) {
        BubbleComposer.bgInput.addEventListener('input', (event) => {
            BubbleComposer.bgColor = event.target.value || BUBBLE_DRAW_DEFAULT_BG;
            renderBubbleComposerCanvas();
        });
    }

    if (BubbleComposer.lineInput) {
        BubbleComposer.lineInput.addEventListener('click', () => {
            setBubbleToolMode('draw');
        });
        BubbleComposer.lineInput.addEventListener('input', (event) => {
            BubbleComposer.lineColor = event.target.value || BUBBLE_DRAW_DEFAULT_LINE;
            setBubbleToolMode('draw');
        });
        BubbleComposer.lineInput.addEventListener('change', (event) => {
            BubbleComposer.lineColor = event.target.value || BUBBLE_DRAW_DEFAULT_LINE;
            setBubbleToolMode('draw');
        });
    }

    if (BubbleComposer.fillColorInput) {
        BubbleComposer.fillColorInput.addEventListener('click', () => {
            setBubbleToolMode('fill');
        });
        BubbleComposer.fillColorInput.addEventListener('input', (event) => {
            BubbleComposer.fillColor = event.target.value || BUBBLE_DRAW_DEFAULT_FILL;
            setBubbleToolMode('fill');
        });
        BubbleComposer.fillColorInput.addEventListener('change', (event) => {
            BubbleComposer.fillColor = event.target.value || BUBBLE_DRAW_DEFAULT_FILL;
            setBubbleToolMode('fill');
        });
    }

    if (BubbleComposer.drawDoneBtn) {
        BubbleComposer.drawDoneBtn.addEventListener('click', async () => {
            try {
                BubbleComposer.pendingBlob = await exportBubbleCanvasBlob();
                openBubbleExportModal();
            } catch (error) {
                if (typeof showErrorToast === 'function') {
                    showErrorToast('导出失败: ' + (error.message || error));
                }
            }
        });
    }

    if (BubbleComposer.exportBackBtn) {
        BubbleComposer.exportBackBtn.addEventListener('click', () => {
            openBubbleDrawModal({ reset: false });
        });
    }

    if (BubbleComposer.exportUploadOnlyBtn) {
        BubbleComposer.exportUploadOnlyBtn.addEventListener('click', async () => {
            try {
                await finishBubbleDrawing({ saveLocal: false });
            } catch (error) {
                if (typeof showErrorToast === 'function') {
                    showErrorToast('上传失败: ' + (error.message || error));
                }
            }
        });
    }

    if (BubbleComposer.exportUploadSaveBtn) {
        BubbleComposer.exportUploadSaveBtn.addEventListener('click', async () => {
            try {
                await finishBubbleDrawing({ saveLocal: true });
            } catch (error) {
                if (typeof showErrorToast === 'function') {
                    showErrorToast('上传失败: ' + (error.message || error));
                }
            }
        });
    }

    if (BubbleComposer.textColorInput) {
        BubbleComposer.textColorInput.addEventListener('input', (event) => {
            updateBubbleTextColorPreview(event.target.value);
        });
    }

    if (BubbleComposer.textColorConfirmBtn) {
        BubbleComposer.textColorConfirmBtn.addEventListener('click', () => {
            const selected = normalizeHexColor(
                BubbleComposer.textColorInput && BubbleComposer.textColorInput.value
            );
            closeBubbleTextColorModal(selected);
        });
    }

    if (BubbleComposer.textColorCancelBtn) {
        BubbleComposer.textColorCancelBtn.addEventListener('click', () => {
            closeBubbleTextColorModal(null);
        });
    }

    BubbleComposer.canvas.addEventListener('pointerdown', (event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        if (BubbleComposer.toolMode === 'fill') {
            const point = getCanvasPoint(event);
            fillBubbleComposerAtPoint(point.x, point.y);
            return;
        }
        BubbleComposer.canvas.setPointerCapture(event.pointerId);
        startBubbleDrawing(event);
    });
    BubbleComposer.canvas.addEventListener('pointermove', (event) => {
        if (!BubbleComposer.isDrawing) return;
        event.preventDefault();
        continueBubbleDrawing(event);
    });
    BubbleComposer.canvas.addEventListener('pointerup', (event) => {
        event.preventDefault();
        stopBubbleDrawing();
        if (BubbleComposer.canvas.hasPointerCapture(event.pointerId)) {
            BubbleComposer.canvas.releasePointerCapture(event.pointerId);
        }
    });
    BubbleComposer.canvas.addEventListener('pointercancel', stopBubbleDrawing);
    BubbleComposer.canvas.addEventListener('pointerleave', stopBubbleDrawing);

    BubbleComposer.initialized = true;
}

window.chooseSpecialBubble = function () {
    initBubbleComposerUI();
    const friend = resolveSelectedFriendName();
    if (!friend) {
        alert("找不到当前好友，请先打开与好友的聊天窗口再设置专属气泡。");
        return;
    }
    BubbleComposer.currentFriendName = friend;
    openBubbleActionModal();
};

window.chooseSpecialTextColor = async function () {
    initBubbleComposerUI();
    const friend = resolveSelectedFriendName();
    if (!friend) {
        alert("找不到当前好友，请先打开与好友的聊天窗口再设置专属文字颜色。");
        return;
    }

    BubbleComposer.currentFriendName = friend;
    const myId = String(State.currentUser && State.currentUser.id);
    const initialColor = normalizeHexColor(
        State.avatarMap &&
        State.avatarMap[myId] &&
        State.avatarMap[myId].text_color
    ) || '#111827';

    try {
        const selectedColor = await openBubbleTextColorModal(initialColor);
        if (!selectedColor) {
            return;
        }
        await setBubbleTextColorForFriend(friend, selectedColor);
        hideAllBubbleModals();
        if (typeof showErrorToast === 'function') {
            showErrorToast('专属文字颜色设置成功');
        }
    } catch (error) {
        hideAllBubbleModals();
        if (typeof showErrorToast === 'function') {
            showErrorToast('设置专属文字颜色失败: ' + (error.message || error));
        } else {
            alert('设置专属文字颜色失败');
        }
    }
};

window.uploadSpecialBubble = async function () {
    initBubbleComposerUI();
    const input = document.getElementById("specialBubbleInput");
    const file = input && input.files ? input.files[0] : null;
    if (!file) {
        return;
    }

    const friend = BubbleComposer.currentFriendName || resolveSelectedFriendName();
    if (!friend) {
        alert("找不到当前好友，请先打开与好友的聊天窗口再设置专属气泡。");
        if (input) input.value = '';
        return;
    }

    try {
        await uploadBubbleImageForFriend(file, friend);
        hideAllBubbleModals();
        if (typeof showErrorToast === 'function') {
            showErrorToast('专属气泡设置成功');
        }
    } catch (error) {
        if (typeof showErrorToast === 'function') {
            showErrorToast('设置专属气泡失败: ' + (error.message || error));
        } else {
            alert('设置专属气泡失败');
        }
    } finally {
        if (input) input.value = '';
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
            try { if (typeof FriendsModule !== 'undefined' && FriendsModule.renderFriendsList) FriendsModule.renderFriendsList(); } catch (e) { }
            try { if (typeof ChatModule !== 'undefined' && ChatModule.renderChatHeader) ChatModule.renderChatHeader(); } catch (e) { }

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
