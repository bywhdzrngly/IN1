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
        const [friendsData, requests] = await Promise.all([
            API.getFriends({ silent: true }),
            API.getFriendRequests({ silent: true }),
        ]);

        State.setFriends((friendsData && friendsData.friends) || []);
        State.setFriendRequests(requests || []);

        FriendsModule.renderFriendsList();
        FriendsModule.renderRequestsList();
        updateRequestBadge();
    } catch (error) {
        console.warn('自动同步好友数据失败:', error);
    }
}

function bootstrapApp() {
    showAuthPage();

    AuthModule.init();
    FriendsModule.init();
    ChatModule.bindEvents();

    const originalSetLoading = State.setLoading.bind(State);
    State.setLoading = function(loading) {
        originalSetLoading(loading);
        updateLoadingIndicator();
    };

    updateLoadingIndicator();
}

document.addEventListener('DOMContentLoaded', bootstrapApp);

window.showAuthPage = showAuthPage;
window.showMainPage = showMainPage;
window.showErrorToast = showErrorToast;
window.syncFriendsAndRequests = syncFriendsAndRequests;
