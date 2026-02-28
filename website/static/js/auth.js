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
            State.setCurrentUser({ id: null, name: null, email: null, image: null });
            State.setFriends([]);
            State.setFriendRequests([]);
            State.clearMessages();
            localStorage.removeItem('lastSelectedFriendName');

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