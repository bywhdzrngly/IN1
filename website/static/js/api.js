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
        const { silent = false, ...requestOptions } = options;
        try {
            if (!silent) {
                State.setLoading(true);
            }
            
            const url = `${this.baseURL}${endpoint}`;
            const config = {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    ...requestOptions.headers,
                },
                credentials: 'include', // 包含 cookie
                ...requestOptions,
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
            if (!silent) {
                showErrorToast(error.message);
            }
            throw error;
        } finally {
            if (!silent) {
                State.setLoading(false);
            }
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
    async getCurrentUser(options = {}) {
        return this.request('GET', '/user', null, options);
    },

    /**
     * 修改当前用户账号名
     */
    async updateUserName(name) {
        return this.request('POST', '/user/name', { name });
    },

    /**
     * 登出
     */
    async logout() {
        return this.request('POST', '/logout');
    },

        // 在 API 对象内添加（或作为独立导出函数）
    async uploadGlobalAvatar(imageFile) {
        const formData = new FormData();
        formData.append('image', imageFile);
        // 如果你的 request 封装需要不同参数，请按你项目改动
        // 这里尝试兼容两种常见封装：
        if (this.request && typeof this.request === 'function') {
            // this.request(method, path, body, options)
            return this.request('POST', '/user/avatar', formData, { headers: {} });
        } 
        else {
            // 直接用 fetch 回退实现
            const resp = await fetch('/user/avatar', {
            method: 'POST',
            body: formData,
            credentials: 'include'
            });
            if (!resp.ok) throw new Error('上传接口返回 ' + resp.status);
            return resp.json();
        }
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
    async getFriends(options = {}) {
        return this.request('GET', '/friends', null, options);
    },

    /**
     * 获取好友申请列表
     */
    async getFriendRequests(options = {}) {
        return this.request('GET', '/friend/requests', null, options);
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
     * 设置与某个好友的专属聊天气泡
     */
    async setFriendBubble(friendName, imageFile) {
        const formData = new FormData();
        formData.append('friend', friendName);
        formData.append('image', imageFile);
        return this.request('POST', '/friend/set_bubble', formData, { headers: {} });
    },

    /**
     * 设置与某个好友会话的专属文字颜色
     */
    async setFriendBubbleTextColor(friendName, color) {
        return this.request('POST', '/friend/set_bubble_text_color', {
            friend: friendName,
            color,
        });
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
