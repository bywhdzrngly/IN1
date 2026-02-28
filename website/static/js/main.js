/**
 * 应用入口
 */

function showAuthPage() {
    document.getElementById('auth-page').classList.remove('hidden');
    document.getElementById('main-page').classList.add('hidden');
}

function showMainPage() {
    document.getElementById('auth-page').classList.add('hidden');
    document.getElementById('main-page').classList.remove('hidden');
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

function bootstrapApp() {
    showAuthPage();

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
    State.setLoading = function(loading) {
        originalSetLoading(loading);
        updateLoadingIndicator();
    };

    updateLoadingIndicator();
}

document.addEventListener('DOMContentLoaded', bootstrapApp);

async function restoreSession() {

    const res = await fetch("/user", {
        credentials: "include"
    });

    console.log("user status =", res.status);

    if (res.status === 401) {
        window.location.href = "/login";
        return;
    }

    const user = await res.json();

    State.currentUser = user;

    console.log("session restored", user);
}

restoreSession();

window.showAuthPage = showAuthPage;
window.showMainPage = showMainPage;
window.showErrorToast = showErrorToast;
window.syncFriendsAndRequests = syncFriendsAndRequests;
