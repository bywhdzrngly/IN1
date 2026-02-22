/**
 * Socket.IO 连接管理
 * 处理实时通信逻辑
 */

const SocketManager = {
    /**
     * 初始化 Socket 连接
     */
    init() {
        if (State.socket) {
            return;
        }

        const socket = io(window.location.origin, {
            withCredentials: true,
            reconnection: true,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            reconnectionAttempts: 5,
        });

        socket.on('connect', () => {
            console.log('Socket 已连接');
            State.socketConnected = true;
            this.handleConnect();
        });

        socket.on('disconnect', () => {
            console.log('Socket 已断开连接');
            State.socketConnected = false;
            updateConnectionStatus();
        });

        socket.on('receiveConversationMessage', (message) => {
            this.handleReceiveMessage(message);
        });

        socket.on('receiveConversationMessages', (data) => {
            this.handleReceiveHistoryMessages(data);
        });

        socket.on('friendDataChanged', () => {
            if (typeof window.syncFriendsAndRequests === 'function') {
                window.syncFriendsAndRequests();
            }
        });

        socket.on('error', (error) => {
            console.error('Socket 错误:', error);
            showErrorToast('连接出错: ' + error);
        });

        State.socket = socket;
    },

    /**
     * 加入会话房间
     */
    joinConversation(conversationId) {
        if (!State.socket) return;

        State.socket.emit('joinConversation', {
            conversation_id: conversationId,
        });

        console.log('已加入会话房间:', conversationId);
    },

    /**
     * 发送文本消息
     */
    sendMessage(conversationId, content) {
        if (!State.socket) {
            showErrorToast('连接未建立');
            return;
        }

        State.socket.emit('conversationMessage', {
            conversation_id: conversationId,
            content: content,
        });

        console.log('消息已发送:', content);
    },

    /**
     * 发送图片
     */
    sendImage(conversationId, imageUrl) {
        if (!State.socket) {
            showErrorToast('连接未建立');
            return;
        }

        State.socket.emit('conversationImage', {
            conversation_id: conversationId,
            image_url: imageUrl,
        });

        console.log('图片已发送:', imageUrl);
    },

    /**
     * 获取历史消息
     */
    getHistoryMessages(conversationId) {
        if (!State.socket) return;

        State.socket.emit('getConversationMessages', {
            conversation_id: conversationId,
        });

        console.log('请求历史消息:', conversationId);
    },

    /**
     * 处理连接事件
     */
    handleConnect() {
        if (typeof window.syncFriendsAndRequests === 'function') {
            window.syncFriendsAndRequests();
        }

        // 重新加入之前的会话
        if (State.currentConversationId) {
            this.joinConversation(State.currentConversationId);
        }
    },

    /**
     * 处理接收消息
     */
    handleReceiveMessage(message) {
        console.log('收到消息:', message);

        // 检查消息是否属于当前会话
        if (message.conversation_id === State.currentConversationId) {
            State.addMessage(message);
            renderMessages();
            scrollMessagesToBottom();
        }
    },

    /**
     * 处理接收历史消息
     */
    handleReceiveHistoryMessages(data) {
        console.log('收到历史消息:', data);

        if (data.conversation_id === State.currentConversationId) {
            State.setMessages(data.messages || []);
            renderMessages();
            scrollMessagesToBottom();
        }
    },

    /**
     * 断开连接
     */
    disconnect() {
        if (State.socket) {
            State.socket.disconnect();
            State.socket = null;
            State.socketConnected = false;
        }
    },
};

/**
 * 更新连接状态显示
 */
function updateConnectionStatus() {
    // 可以在 UI 上显示连接状态
    console.log('连接状态:', State.socketConnected ? '已连接' : '已断开');
}