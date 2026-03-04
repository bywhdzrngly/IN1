/**
 * 认证逻辑
 * 处理登录、注册、登出相关的交互
 */

const AuthModule = {
    /**
     * 初始化认证模块
     */
    init() {
        const loginForm = document.getElementById('login-form');
        const signupForm = document.getElementById('signup-form');

        loginForm.addEventListener('submit', (e) => this.handleLogin(e));
        signupForm.addEventListener('submit', (e) => this.handleSignup(e));

        document.getElementById('logout-btn').addEventListener('click', () => this.handleLogout());

        const userNameEl = document.getElementById('user-name');
        if (userNameEl) {
            userNameEl.style.cursor = 'pointer';
            userNameEl.title = '点击修改账号名';
            userNameEl.addEventListener('click', () => this.handleChangeUserName());
        }
    },

    /**
     * 清空搜索框及搜索结果 UI（用于账号切换）
     */
    resetSearchUI() {
        State.searchQuery = '';
        State.setSearchResults([]);

        const searchInput = document.getElementById('search-input');
        if (searchInput) {
            searchInput.value = '';
        }

        if (window.FriendsModule && typeof window.FriendsModule.renderSearchResults === 'function') {
            window.FriendsModule.renderSearchResults();
        }
    },

    /**
     * 处理登录
     */
    async handleLogin(event) {
        event.preventDefault();

        const name = document.getElementById('login-name').value.trim();
        const password = document.getElementById('login-password').value;
        const remember = document.getElementById('login-remember').checked;

        if (!name || !password) {
            this.showAuthError('请输入用户名和密码');
            return;
        }

        try {
            State.setLoading(true);
            State.resetForAccountSwitch();
            this.resetSearchUI();
            if (window.ChatModule && typeof window.ChatModule.resetChatPanel === 'function') {
                window.ChatModule.resetChatPanel();
            }
            const result = await API.login(name, password, remember);

            // 登录成功
            State.setCurrentUser({
                name: name,
            });

            // 加载用户信息和好友列表
            await this.loadUserData();

            // 切换到主页面
            showMainPage();

            // 初始化 Socket 连接
            SocketManager.init();
        } catch (error) {
            this.showAuthError('登录失败: ' + error.message);
        } finally {
            State.setLoading(false);
        }
    },

    /**
     * 处理注册
     */
    async handleSignup(event) {
        event.preventDefault();

        const name = document.getElementById('signup-name').value.trim();
        const email = document.getElementById('signup-email').value.trim();
        const password = document.getElementById('signup-password').value;
        const imageInput = document.getElementById('signup-image');

        if (!name || !email || !password) {
            this.showSignupError('请填写所有必要字段');
            return;
        }

        if (!this.validateEmail(email)) {
            this.showSignupError('邮箱格式不正确');
            return;
        }

        if (password.length < 6) {
            this.showSignupError('密码长度至少 6 个字符');
            return;
        }

        try {
            State.setLoading(true);

            const imageFile = imageInput.files[0] || null;
            const result = await API.signup(name, email, password, imageFile);

            // 注册成功，切换回登录表单
            this.showSignupError(''); // 清除错误
            this.switchToLogin();
            showAuthPage();

            // 填充登录表单
            document.getElementById('login-name').value = name;
            showErrorToast('注册成功，请登录！');
        } catch (error) {
            this.showSignupError('注册失败: ' + error.message);
        } finally {
            State.setLoading(false);
        }
    },

    /**
     * 处理登出
     */
    async handleLogout() {
        if (!confirm('确定要登出吗？')) {
            return;
        }

        try {
            State.setLoading(true);
            await API.logout();

            // 清空状态
            State.resetForAccountSwitch();
            this.resetSearchUI();
            localStorage.removeItem('lastSelectedFriendName');
            if (window.ChatModule && typeof window.ChatModule.resetChatPanel === 'function') {
                window.ChatModule.resetChatPanel();
            }
            FriendsModule.renderFriendsList();
            FriendsModule.renderRequestsList();
            updateRequestBadge();

            // 断开 Socket
            SocketManager.disconnect();

            // 切换到认证页面
            showAuthPage();
            this.switchToLogin();
        } catch (error) {
            showErrorToast('登出失败: ' + error.message);
        } finally {
            State.setLoading(false);
        }
    },

    /**
     * 修改账号名
     */
    async handleChangeUserName() {
        const currentName = (State.currentUser && State.currentUser.name) || '';
        const input = window.prompt('请输入新账号名', currentName);

        if (input === null) {
            return; // 用户点击取消
        }

        const newName = input.trim();
        if (!newName) {
            showErrorToast('账号名不能为空');
            return;
        }

        try {
            State.setLoading(true);
            const result = await API.updateUserName(newName);
            const updatedName = (result && result.name) ? result.name : newName;

            State.setCurrentUser({ name: updatedName });
            this.displayUserInfo(State.currentUser);

            // 本地已加载消息里仍是旧 sender 时，立即同步，避免头像/归属判断短暂异常
            if (Array.isArray(State.messages) && currentName && currentName !== updatedName) {
                State.setMessages(
                    State.messages.map((msg) =>
                        msg && msg.sender === currentName
                            ? { ...msg, sender: updatedName }
                            : msg
                    )
                );
                if (typeof window.renderMessages === 'function') {
                    window.renderMessages();
                }
            }

            // 重新拉取一次用户相关数据，保持搜索/好友等状态一致
            await this.loadUserData();

            // 改名后重新连接，确保加入新用户名对应的 socket room
            SocketManager.disconnect();
            SocketManager.init();

            showErrorToast('账号名修改成功');
        } catch (error) {
            showErrorToast('修改账号名失败: ' + error.message);
        } finally {
            State.setLoading(false);
        }
    },

    /**
     * 加载用户数据
     */
    async loadUserData() {
        try {
            // 获取当前用户信息
            const userInfo = await API.getCurrentUser();
            State.setCurrentUser(userInfo);
            this.displayUserInfo(userInfo);

            // 获取好友列表
            const friendsData = await API.getFriends();
            State.setFriends(friendsData.friends || []);

            // 获取好友申请
            const requests = await API.getFriendRequests();
            State.setFriendRequests(requests);

            // 获取所有用户列表（用于搜索）
            const allUsers = await API.getAllUsers();
            State.setAllUsers(allUsers);

            FriendsModule.renderFriendsList();
            FriendsModule.renderRequestsList();
            updateRequestBadge();
        } catch (error) {
            console.error('加载用户数据失败:', error);
        }
    },

    /**
     * 显示用户信息
     */
    displayUserInfo(user) {
        document.getElementById('user-name').textContent = user.name;
        document.getElementById('user-email').textContent = user.email || '';

        const avatar = document.getElementById('user-avatar');
        if (user.image) {
            avatar.src = user.image;
        } else {
            avatar.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor"%3E%3Ccircle cx="12" cy="12" r="10"/%3E%3Cpath d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/%3E%3C/svg%3E';
        }
    },

    /**
     * 显示认证错误
     */
    showAuthError(message) {
        const errorEl = document.getElementById('auth-error');
        if (message) {
            errorEl.textContent = message;
            errorEl.style.display = 'block';
        } else {
            errorEl.style.display = 'none';
        }
    },

    /**
     * 显示注册错误
     */
    showSignupError(message) {
        const errorEl = document.getElementById('signup-error');
        if (message) {
            errorEl.textContent = message;
            errorEl.style.display = 'block';
        } else {
            errorEl.style.display = 'none';
        }
    },

    /**
     * 切换到登录表单
     */
    switchToLogin() {
        document.getElementById('login-form').classList.add('active');
        document.getElementById('signup-form').classList.remove('active');
    },

    /**
     * 切换到注册表单
     */
    switchToSignup() {
        document.getElementById('login-form').classList.remove('active');
        document.getElementById('signup-form').classList.add('active');
    },

    /**
     * 验证邮箱格式
     */
    validateEmail(email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    },
};

// 供 main.js 中的会话恢复逻辑通过 window.AuthModule 访问
window.AuthModule = AuthModule;

/**
 * 全局函数：切换认证表单
 */
function switchAuthForm(event) {
    event.preventDefault();
    if (document.getElementById('login-form').classList.contains('active')) {
        AuthModule.switchToSignup();
    } else {
        AuthModule.switchToLogin();
    }
}
