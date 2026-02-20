/**
 * API 调用封装
 * 所有 HTTP 请求都通过这个模块
 */

const API = {
    // 基础 URL
    baseURL: window.location.origin,

    /**
     * 发送请求的通用方法
     */
    async request(method, endpoint, data = null, options = {}) {
        try {
            State.setLoading(true);
            
            const url = `${this.baseURL}${endpoint}`;
            const config = {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers,
                },
                credentials: 'include', // 包含 cookie
                ...options,
            };

            if (data) {
                if (data instanceof FormData) {
                    delete config.headers['Content-Type']; // FormData 自动设置
                    config.body = data;
                } else {
                    config.body = JSON.stringify(data);
                }
            }

            const response = await fetch(url, config);
            
            // 如果返回 401，说明未认证，需要回到登录页
            if (response.status === 401) {
                showAuthPage();
                throw new Error('认证失败，请重新登录');
            }

            if (!response.ok) {
                const error = await response.json().catch(() => ({}));
                throw new Error(error.error || `HTTP ${response.status}`);
            }

            const result = await response.json();
            State.setError(null);
            return result;
        } catch (error) {
            console.error('API 错误:', error);
            State.setError(error.message);
            showErrorToast(error.message);
            throw error;
        } finally {
            State.setLoading(false);
        }
    },

    /**
     * ==================== 认证相关 ====================
     */

    /**
     * 登录
     */
    async login(name, password, remember = false) {
        const formData = new FormData();
        formData.append('name', name);
        formData.append('password', password);
        formData.append('remember', remember ? 'on' : 'off');

        const result = await this.request('POST', '/login', formData, {
            headers: {},
        });
        
        return result;
    },

    /**
     * 注册
     */
    async signup(name, email, password, imageFile = null) {
        const formData = new FormData();
        formData.append('name', name);
        formData.append('email', email);
        formData.append('password', password);
        
        if (imageFile) {
            formData.append('image', imageFile);
        }

        const result = await this.request('POST', '/signup', formData, {
            headers: {},
        });

        return result;
    },

    /**
     * 获取当前用户信息
     */
    async getCurrentUser() {
        return this.request('GET', '/user');
    },

    /**
     * 登出
     */
    async logout() {
        return this.request('POST', '/logout');
    },

    /**
     * ==================== 好友管理相关 ====================
     */

    /**
     * 获取所有用户列表
     */
    async getAllUsers() {
        return this.request('GET', '/users');
    },

    /**
     * 获取好友列表
     */
    async getFriends() {
        return this.request('GET', '/friends');
    },

    /**
     * 获取好友申请列表
     */
    async getFriendRequests() {
        return this.request('GET', '/friend/requests');
    },

    /**
     * 发送好友申请
     */
    async sendFriendRequest(toUser) {
        return this.request('POST', '/friend/request', { to_user: toUser });
    },

    /**
     * 同意好友申请
     */
    async acceptFriendRequest(requestId) {
        return this.request('POST', '/friend/accept', { request_id: requestId });
    },

    /**
     * 拒绝好友申请
     */
    async rejectFriendRequest(requestId) {
        return this.request('POST', '/friend/reject', { request_id: requestId });
    },

    /**
     * 删除好友
     */
    async deleteFriend(friendName) {
        return this.request('POST', '/friend/delete', { friend: friendName });
    },

    /**
     * ==================== 聊天相关 ====================
     */

    /**
     * 获取或创建会话
     */
    async getOrCreateConversation(username) {
        return this.request('GET', `/conversation/${username}`);
    },

    /**
     * 获取历史消息
     */
    async getMessages(conversationId, limit = 50, offset = 0) {
        return this.request('GET', `/messages/${conversationId}?limit=${limit}&offset=${offset}`);
    },

    /**
     * 上传图片
     */
    async uploadImage(conversationId, imageFile) {
        const formData = new FormData();
        formData.append('conversation_id', conversationId);
        formData.append('image', imageFile);

        return this.request('POST', '/message/upload', formData, {
            headers: {},
        });
    },
};