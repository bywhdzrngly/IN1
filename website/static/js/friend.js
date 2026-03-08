/**
 * 好友管理模块
 * 处理好友列表、申请、搜索等交互
 */

const FriendsModule = {
    /**
     * 判断是否是当前登录用户自己
     */
    isSelfFriendName(friendName) {
        if (!friendName || !State.currentUser || !State.currentUser.name) {
            return false;
        }
        return String(friendName) === String(State.currentUser.name);
    },

    /**
     * 初始化好友模块
     */
    init() {
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.switchTab(e));
        });

        document.getElementById('search-input').addEventListener('input', (e) => {
            this.handleSearch(e);
        });

        document.getElementById('delete-friend-btn').addEventListener('click', () => {
            this.handleDeleteFriend();
        });

        this.renderFriendsList();
        this.renderRequestsList();
    },

    /**
     * 切换标签页
     */
    switchTab(event) {
        const tabBtn = event.target.closest('.tab-btn');
        if (!tabBtn) return;

        const tabName = tabBtn.dataset.tab;

        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        tabBtn.classList.add('active');

        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        document.getElementById(tabName + '-tab').classList.add('active');

        State.currentTab = tabName;

        if (tabName === 'search') {
            document.getElementById('search-input').focus();
        }
    },

    /**
     * 处理搜索
     */
    handleSearch(event) {
        const query = event.target.value.trim().toLowerCase();
        State.searchQuery = query;

        if (!query) {
            State.setSearchResults([]);
            this.renderSearchResults();
            return;
        }

        const results = State.allUsers.filter(user => {
            if ((user.name || '').toLowerCase().includes(query)) {
                const isSelf = user.name === State.currentUser.name;
                const isFriend = State.friends.some(f => f.name === user.name);
                const hasPending = State.friendRequests.some(r => r.from_user === user.name);
                return !isSelf && !isFriend && !hasPending;
            }
            return false;
        });

        State.setSearchResults(results);
        this.renderSearchResults();
    },

    /**
     * 渲染好友列表
     */
    renderFriendsList() {
        const friendsList = document.getElementById('friends-list');

        if (State.friends.length === 0) {
            friendsList.innerHTML = '<div class="empty-state">暂无好友</div>';
            return;
        }

        friendsList.innerHTML = State.friends.map(friend => `
            <div class="friend-item ${State.selectedFriendName === friend.name ? 'active' : ''}" data-friend="${friend.name}">
                <img src="${friend.image || this.getDefaultAvatar()}" alt="头像" class="friend-avatar">
                <div class="friend-info">
                    <div class="friend-name">${this.formatFriendDisplayName(friend)}</div>
                    <div class="friend-time">${this.escapeHtml(friend.last_message_preview || '暂无消息')}</div>
                </div>
            </div>
        `).join('');

        friendsList.querySelectorAll('.friend-item').forEach(item => {
            item.addEventListener('click', () => {
                const friendName = item.dataset.friend;
                ChatModule.selectFriend(friendName);
            });
        });
    },

    /**
     * 渲染待审核申请列表
     */
    renderRequestsList() {
        const requestsList = document.getElementById('requests-list');

        if (State.friendRequests.length === 0) {
            requestsList.innerHTML = '<div class="empty-state">暂无待审核申请</div>';
            return;
        }

        requestsList.innerHTML = State.friendRequests.map(request => `
            <div class="request-item" data-request-id="${request.id}">
                <img src="${request.from_user_image || this.getDefaultAvatar()}" alt="头像">
                <div class="request-info">
                    <div class="request-name">${this.escapeHtml(request.from_user || '')}</div>
                </div>
                <div class="request-actions">
                    <button class="btn btn-primary btn-small btn-accept" data-request-id="${request.id}">同意</button>
                    <button class="btn btn-danger btn-small btn-reject" data-request-id="${request.id}">拒绝</button>
                </div>
            </div>
        `).join('');

        requestsList.querySelectorAll('.btn-accept').forEach(btn => {
            btn.addEventListener('click', () => {
                const requestId = parseInt(btn.dataset.requestId, 10);
                this.handleAcceptRequest(requestId);
            });
        });

        requestsList.querySelectorAll('.btn-reject').forEach(btn => {
            btn.addEventListener('click', () => {
                const requestId = parseInt(btn.dataset.requestId, 10);
                this.handleRejectRequest(requestId);
            });
        });
    },

    /**
     * 渲染搜索结果
     */
    renderSearchResults() {
        const searchResults = document.getElementById('search-results');

        if (State.searchQuery === '') {
            searchResults.innerHTML = '<div class="empty-state">输入用户名搜索</div>';
            return;
        }

        if (State.searchResults.length === 0) {
            searchResults.innerHTML = '<div class="empty-state">未找到匹配的用户</div>';
            return;
        }

        searchResults.innerHTML = State.searchResults.map(user => `
            <div class="search-result-item" data-user="${user.name}">
                <img src="${user.image || this.getDefaultAvatar()}" alt="头像">
                <div class="search-result-info">
                    <div class="search-result-name">${this.escapeHtml(user.name || '')}</div>
                </div>
                <button class="btn btn-add-friend" data-user="${user.name}">+ 加好友</button>
            </div>
        `).join('');

        searchResults.querySelectorAll('.btn-add-friend').forEach(btn => {
            btn.addEventListener('click', () => {
                const username = btn.dataset.user;
                this.handleSendFriendRequest(username);
            });
        });
    },

    /**
     * 处理发送好友申请
     */
    async handleSendFriendRequest(toUser) {
        try {
            State.setLoading(true);
            await API.sendFriendRequest(toUser);

            showErrorToast(`已向 ${toUser} 发送好友申请`);

            State.setSearchResults(
                State.searchResults.filter(u => u.name !== toUser)
            );
            this.renderSearchResults();
        } catch (error) {
            showErrorToast('发送申请失败: ' + error.message);
        } finally {
            State.setLoading(false);
        }
    },

    /**
     * 处理同意好友申请
     */
    async handleAcceptRequest(requestId) {
        try {
            State.setLoading(true);
            await API.acceptFriendRequest(requestId);

            showErrorToast('已同意申请');

            const request = State.friendRequests.find(r => r.id === requestId);
            if (request) {
                State.addFriend({
                    name: request.from_user,
                    email: request.from_user_email || '',
                    image: request.from_user_image || '',
                    remark_name: '',
                    last_message_preview: '',
                    last_message_timestamp: null,
                });

                State.removeFriendRequest(requestId);

                this.renderFriendsList();
                this.renderRequestsList();
                updateRequestBadge();
            }
        } catch (error) {
            showErrorToast('操作失败: ' + error.message);
        } finally {
            State.setLoading(false);
        }
    },

    /**
     * 处理拒绝好友申请
     */
    async handleRejectRequest(requestId) {
        try {
            State.setLoading(true);
            await API.rejectFriendRequest(requestId);

            showErrorToast('已拒绝申请');

            State.removeFriendRequest(requestId);
            this.renderRequestsList();
            updateRequestBadge();
        } catch (error) {
            showErrorToast('操作失败: ' + error.message);
        } finally {
            State.setLoading(false);
        }
    },

    /**
     * 处理删除好友
     */
    async handleDeleteFriend() {
        if (!State.selectedFriendName) return;

        if (this.isSelfFriendName(State.selectedFriendName)) {
            showErrorToast('不能删除自己');
            return;
        }

        if (!confirm(`确定要删除好友 ${State.selectedFriendName} 吗？`)) {
            return;
        }

        try {
            State.setLoading(true);
            await API.deleteFriend(State.selectedFriendName);

            showErrorToast('好友已删除');

            State.removeFriend(State.selectedFriendName);
            State.selectedFriendName = null;

            this.renderFriendsList();
            ChatModule.resetChatPanel();
        } catch (error) {
            showErrorToast('删除好友失败: ' + error.message);
        } finally {
            State.setLoading(false);
        }
    },

    /**
     * 获取默认头像
     */
    getDefaultAvatar() {
        return 'data:image/svg+xml,%3Csvg%20xmlns%3D%22http://www.w3.org/2000/svg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22currentColor%22%3E%3Ccircle%20cx%3D%2212%22%20cy%3D%2212%22%20r%3D%2210%22/%3E%3Cpath%20d%3D%22M12%2012c2.21%200%204-1.79%204-4s-1.79-4-4-4-4%201.79-4%204%201.79%204%204%204zm0%202c-2.67%200-8%201.34-8%204v2h16v-2c0-2.66-5.33-4-8-4z%22/%3E%3C/svg%3E';
    },

    /**
     * 好友显示名：备注名（原账号名）
     */
    formatFriendDisplayName(friend) {
        const safeName = this.escapeHtml((friend && friend.name) || '');
        const remarkRaw = friend && typeof friend.remark_name === 'string'
            ? friend.remark_name.trim()
            : '';
        if (!remarkRaw) {
            return safeName;
        }
        const safeRemark = this.escapeHtml(remarkRaw);
        return `${safeRemark}<span class="remark-origin-name">（${safeName}）</span>`;
    },

    /**
     * 转义 HTML
     */
    escapeHtml(text) {
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;',
        };
        return String(text).replace(/[&<>"']/g, function(m) { return map[m]; });
    },
};

window.FriendsModule = FriendsModule;

/**
 * 更新好友申请徽章
 */
function updateRequestBadge() {
    const badge = document.getElementById('request-badge');
    const count = State.friendRequests.length;
    if (count > 0) {
        badge.textContent = count;
        badge.classList.remove('hidden');
    } else {
        badge.classList.add('hidden');
    }
}
