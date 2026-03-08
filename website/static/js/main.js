/**
 * 应用入口
 */

const LAST_SELECTED_FRIEND_KEY = 'lastSelectedFriendName';

function showAuthPage() {
    document.getElementById('auth-page').classList.remove('hidden');
    document.getElementById('main-page').classList.add('hidden');
}

function showMainPage() {
    document.getElementById('auth-page').classList.add('hidden');
    document.getElementById('main-page').classList.remove('hidden');
}

async function restoreLastSelectedConversation() {
    const friendName = localStorage.getItem(LAST_SELECTED_FRIEND_KEY);
    if (!friendName) {
        return;
    }

    const exists = (State.friends || []).some(friend => friend.name === friendName);
    if (!exists) {
        localStorage.removeItem(LAST_SELECTED_FRIEND_KEY);
        return;
    }

    if (window.ChatModule && typeof window.ChatModule.selectFriend === 'function') {
        await window.ChatModule.selectFriend(friendName);
    }
}

async function tryRestoreAuthenticatedSession() {
    try {
        const res = await fetch('/user', { credentials: 'include' });
        if (res.status !== 200) {
            return false;
        }

        const user = await res.json();
        State.setCurrentUser(user);

        if (window.AuthModule && typeof window.AuthModule.displayUserInfo === 'function') {
            window.AuthModule.displayUserInfo(user);
        }

        if (window.AuthModule && typeof window.AuthModule.loadUserData === 'function') {
            await window.AuthModule.loadUserData();
        }

        showMainPage();
        SocketManager.init();
        await restoreLastSelectedConversation();
        return true;
    } catch (error) {
        console.warn('恢复会话失败:', error);
        return false;
    }
}

function showErrorToast(message) {
    const toast = document.getElementById('error-toast');
    if (!toast) return;

    toast.textContent = message;
    toast.classList.remove('hidden');

    setTimeout(() => {
        toast.classList.add('hidden');
    }, 2500);
}

function updateLoadingIndicator() {
    const el = document.getElementById('loading-indicator');
    if (!el) return;

    if (State.loading) {
        el.classList.remove('hidden');
    } else {
        el.classList.add('hidden');
    }
}

async function syncFriendsAndRequests() {
    if (!State.currentUser || !State.currentUser.name) {
        return;
    }

    try {
        const [currentUser, friendsData, requests] = await Promise.all([
            API.getCurrentUser({ silent: true }),
            API.getFriends({ silent: true }),
            API.getFriendRequests({ silent: true }),
        ]);

        if (currentUser) {
            State.setCurrentUser(currentUser);
            if (window.AuthModule && typeof window.AuthModule.displayUserInfo === 'function') {
                window.AuthModule.displayUserInfo(currentUser);
            }
        }

        State.setFriends((friendsData && friendsData.friends) || []);
        State.setFriendRequests(requests || []);

        FriendsModule.renderFriendsList();
        FriendsModule.renderRequestsList();
        updateRequestBadge();

        if (window.ChatModule && typeof window.ChatModule.refreshCurrentConversationAvatarMap === 'function') {
            window.ChatModule.refreshCurrentConversationAvatarMap();
        }
    } catch (error) {
        console.warn('自动同步好友数据失败:', error);
    }
}

async function bootstrapApp() {

    AuthModule.init();
    FriendsModule.init();
    ChatModule.bindEvents();
    if (window.setupGlobalAvatarUpload) {
        try {
            window.setupGlobalAvatarUpload();
        } catch (err) {
            console.warn('初始化全局头像上传失败：', err);
        }
    } else {
        // 如果没有定义，打印一条调试信息（不是错误）
        console.warn('setupGlobalAvatarUpload 未定义 — 确认 chat.js 是否已正确加载');
    }

    const originalSetLoading = State.setLoading.bind(State);
    State.setLoading = function (loading) {
        originalSetLoading(loading);
        updateLoadingIndicator();
    };

    updateLoadingIndicator();

    const restored = await tryRestoreAuthenticatedSession();
    if (!restored) {
        showAuthPage();
    }
}

document.addEventListener('DOMContentLoaded', bootstrapApp);

window.showAuthPage = showAuthPage;
window.showMainPage = showMainPage;
window.showErrorToast = showErrorToast;
window.syncFriendsAndRequests = syncFriendsAndRequests;
