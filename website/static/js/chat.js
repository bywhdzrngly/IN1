/**
 * 聊天模块
 */

const ChatModule = {
    async selectFriend(friendName) {
        if (!friendName) return;

        State.setSelectedFriend(friendName);
        FriendsModule.renderFriendsList();

        try {
            const conversation = await API.getOrCreateConversation(friendName);
            State.setCurrentConversation(conversation.id);
            this.renderChatHeader(friendName);

            SocketManager.joinConversation(conversation.id);
            SocketManager.getHistoryMessages(conversation.id);
        } catch (error) {
            showErrorToast('打开会话失败: ' + error.message);
        }
    },

    renderChatHeader(friendName) {
        const header = document.getElementById('chat-header');
        const inputArea = document.getElementById('input-area');
        const nameEl = document.getElementById('chat-friend-name');
        const avatarEl = document.getElementById('chat-friend-avatar');
        const statusEl = document.getElementById('chat-status');

        const friend = State.friends.find(f => f.name === friendName);

        nameEl.textContent = friendName;
        avatarEl.src = (friend && friend.image) || '/static/images/default-avatar.png';
        statusEl.textContent = State.socketConnected ? '在线' : '离线';

        header.classList.remove('hidden');
        inputArea.classList.remove('hidden');
    },

    resetChatPanel() {
        State.setCurrentConversation(null);
        State.clearMessages();

        document.getElementById('chat-header').classList.add('hidden');
        document.getElementById('input-area').classList.add('hidden');

        const container = document.getElementById('messages-container');
        container.innerHTML = '<div class="empty-state">选择好友开始聊天</div>';
    },

    bindEvents() {
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

function renderMessages() {
    const container = document.getElementById('messages-container');
    if (!State.messages.length) {
        container.innerHTML = '<div class="empty-state">暂无消息，开始聊天吧</div>';
        return;
    }

    container.innerHTML = State.messages.map(msg => {
        const mine = msg.sender === State.currentUser.name;
        const isImage = typeof msg.content === 'string' && msg.content.startsWith('/uploads/');

        return `
            <div class="message-item ${mine ? 'mine' : 'other'}">
                <div class="message-meta">${escapeHtml(msg.sender || '')}</div>
                <div class="message-content">
                    ${isImage ? `<img src="${msg.content}" alt="图片消息" class="message-image">` : escapeHtml(msg.content || '')}
                </div>
            </div>
        `;
    }).join('');
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

window.ChatModule = ChatModule;
window.renderMessages = renderMessages;
window.scrollMessagesToBottom = scrollMessagesToBottom;
