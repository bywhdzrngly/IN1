/**
 * 全局状态管理
 * 维护应用的所有状态数据
 */

const State = {
    // 用户信息
    currentUser: {
        id: null,
        name: null,
        email: null,
        image: null,
    },

    // 好友相关
    allUsers: [],              // 所有用户列表
    friends: [],               // 好友列表
    friendRequests: [],        // 待审核申请列表
    selectedFriendName: null,  // 当前选中的好友用户名

    // 聊天相关
    currentConversationId: null,
    messages: [],              // 当前会话的消息列表
    messageInput: '',          // 输入框内容

    // Socket 连接
    socket: null,
    socketConnected: false,

    // UI 状态
    currentTab: 'friends',     // 当前标签页：friends, requests, search
    searchQuery: '',           // 搜索关键词
    searchResults: [],         // 搜索结果
    loading: false,
    error: null,

    /**
     * 更新用户信息
     */
    setCurrentUser(user) {
        this.currentUser = { ...this.currentUser, ...user };
    },

    /**
     * 设置好友列表
     */
    setFriends(friends) {
        this.friends = friends;
    },

    /**
     * 添加好友
     */
    addFriend(friend) {
        if (!this.friends.find(f => f.name === friend.name)) {
            this.friends.push(friend);
        }
    },

    /**
     * 删除好友
     */
    removeFriend(friendName) {
        this.friends = this.friends.filter(f => f.name !== friendName);
    },

    /**
     * 设置好友申请列表
     */
    setFriendRequests(requests) {
        this.friendRequests = requests;
    },

    /**
     * 添加好友申请
     */
    addFriendRequest(request) {
        if (!this.friendRequests.find(r => r.id === request.id)) {
            this.friendRequests.push(request);
        }
    },

    /**
     * 移除好友申请
     */
    removeFriendRequest(requestId) {
        this.friendRequests = this.friendRequests.filter(r => r.id !== requestId);
    },

    /**
     * 设置所有用户列表
     */
    setAllUsers(users) {
        this.allUsers = users;
    },

    /**
     * 设置搜索结果
     */
    setSearchResults(results) {
        this.searchResults = results;
    },

    /**
     * 设置当前会话
     */
    setCurrentConversation(conversationId) {
        this.currentConversationId = conversationId;
    },

    /**
     * 设置消息列表
     */
    setMessages(messages) {
        this.messages = messages;
    },

    /**
     * 添加消息
     */
    addMessage(message) {
        this.messages.push(message);
    },

    /**
     * 清除消息
     */
    clearMessages() {
        this.messages = [];
    },

    /**
     * 设置选中的好友
     */
    setSelectedFriend(friendName) {
        this.selectedFriendName = friendName;
    },

    /**
     * 设置加载状态
     */
    setLoading(loading) {
        this.loading = loading;
    },

    /**
     * 设置错误
     */
    setError(error) {
        this.error = error;
    },

    /**
     * 清除错误
     */
    clearError() {
        this.error = null;
    },
};