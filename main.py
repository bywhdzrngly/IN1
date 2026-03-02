"""
main.py 的核心职责：
1.初始化 Flask 应用和 WebSocket 服务；
2.定义所有 WebSocket 事件处理函数（比如发消息、创工作区、图片实时推送）；
3.处理 404/405 错误页面；
4.启动带 WebSocket 的 Flask 应用。
"""

from website import create_app, db,  User, Conversation, Message, Friendship
from datetime import datetime
from flask_socketio import SocketIO, send, emit, join_room
'''
Flask-SocketIO 核心导入（实时通信关键）：
SocketIO:创建 WebSocket 服务对象；
send:简单发送消息（基础用法）；
emit:精准发送事件（指定事件名、房间、是否广播）；
join_room:让用户加入指定 “房间”(WebSocket 的房间机制，用于群聊 / 频道消息隔离）。
'''
from flask import session, request
# session:Flask 的会话对象,用来存临时数据(比如当前登录用户、聊天房间名,关闭浏览器前有效);
from flask_login import login_user, logout_user, login_required, current_user
import random  
import string
# random 和 string 模块用于生成随机字符串（比如工作区加入码）。
from flask import jsonify

app = create_app()

socketio = SocketIO(app,logger=True, engineio_logger=True)

def _conversation_room(conversation_id):
    return f"conversation_{conversation_id}"


def _user_room(username):
    return f"user_{username}"


@socketio.on('connect')
def handle_connect():
    if not current_user.is_authenticated:
        return

    username = current_user.name if session.get("USERNAME") is None else session['username']
    if username:
        join_room(_user_room(username))

"""
Flask-SocketIO 的核心配置：
logger=True 和 engineio_logger=True 用于开启详细日志，方便调试 WebSocket 连接和事件。
"""

# 前端触发事件名 → 后端对应 @socketio.on('事件名') 函数处理 → 后端推送事件给前端

@socketio.on('joinConversation')
def join_conversation(data):
    if not current_user.is_authenticated:
        return

    conversation_id = data.get('conversation_id')
    if not conversation_id:
        return

    conv = Conversation.query.filter_by(id=conversation_id).first()
    if not conv:
        return

    username = current_user.name if session.get("USERNAME") is None else session['username']
    if username not in (conv.user1, conv.user2):
        return

    join_room(_conversation_room(conversation_id))


@socketio.on('conversationMessage')
def conversation_message(data):
    if not current_user.is_authenticated:
        return

    conversation_id = data.get('conversation_id')
    content = (data.get('content') or '').strip()

    if not conversation_id or not content:
        return

    conv = Conversation.query.filter_by(id=conversation_id).first()
    if not conv:
        return

    if current_user.name not in (conv.user1, conv.user2):
        return

    other_username = conv.user1 if conv.user1 != current_user.name else conv.user2
    other_user = User.query.filter_by(name=other_username).first()
    if not other_user:
        return

    # 用 ID 检查友谊，确保 user1_id < user2_id
    user1_id = min(current_user.id, other_user.id)
    user2_id = max(current_user.id, other_user.id)
    friendship = Friendship.query.filter_by(user1_id=user1_id, user2_id=user2_id).first()
    if not friendship:
        return

    msg = Message(
        conversation_id=conversation_id,
        sender=current_user.name,
        content=content,
        timestamp=datetime.utcnow(),
    )
    db.session.add(msg)
    db.session.commit()

    payload = msg.getJsonData()
    join_room(_conversation_room(conversation_id))
    emit('receiveConversationMessage', payload, room=_conversation_room(conversation_id),broadcast=True)


@socketio.on('getConversationMessages')
def get_conversation_messages(data):
    if not current_user.is_authenticated:
        return
    
    conversation_id = data.get('conversation_id')
    if not conversation_id:
        return

    conv = Conversation.query.filter_by(id=conversation_id).first()
    if not conv:
        return

    username = current_user.name if session.get("USERNAME") is None else session['username']
    if username not in (conv.user1, conv.user2):
        return

    msgs = Message.query.filter_by(
        conversation_id=conversation_id
    ).order_by(Message.timestamp).all()

    join_room(_conversation_room(conversation_id))
    emit(
        'receiveConversationMessages',
        {"conversation_id": conversation_id, "messages": [m.getJsonData() for m in msgs]},
        room=_conversation_room(conversation_id),
        broadcast=True,
    )

@socketio.on('conversationImage')
def conversation_image(data):
    if not current_user.is_authenticated:
        return

    conversation_id = data.get('conversation_id')
    image_url = (data.get('image_url') or '').strip()

    if not conversation_id or not image_url:
        return

    conv = Conversation.query.filter_by(id=conversation_id).first()
    if not conv:
        return

    if current_user.name not in (conv.user1, conv.user2):
        return

    other_username = conv.user1 if conv.user1 != current_user.name else conv.user2
    other_user = User.query.filter_by(name=other_username).first()
    if not other_user:
        return

    # id检查
    user1_id = min(current_user.id, other_user.id)
    user2_id = max(current_user.id, other_user.id)
    friendship = Friendship.query.filter_by(user1_id=user1_id, user2_id=user2_id).first()
    if not friendship:
        return

    msg = Message(
        conversation_id=conversation_id,
        sender=current_user.name,
        content=image_url,
        timestamp=datetime.utcnow(),
    )
    db.session.add(msg)
    db.session.commit()

    payload = msg.getJsonData()
    join_room(_conversation_room(conversation_id))
    emit('receiveConversationMessage', payload, room=_conversation_room(conversation_id),broadcast=True)

    
def random_string(letter_count, digit_count):  
    str1 = ''.join((random.choice(string.ascii_letters) for x in range(letter_count)))  
    str1 += ''.join((random.choice(string.digits) for x in range(digit_count)))  
  
    sam_list = list(str1) # it converts the string to list.  
    random.shuffle(sam_list) # It uses a random.shuffle() function to shuffle the string.  
    final_string = ''.join(sam_list)  
    return final_string 

@app.errorhandler(405)
def method_not_allowed(e):
        return jsonify({"error": "method not allowed"}), 405


@app.errorhandler(404)
def not_found(e):
        return jsonify({"error": "not found"}), 404


if __name__ == '__main__':
    host = '0.0.0.0'
    port = 5001
    print(f"Local:   http://127.0.0.1:{port}")
    print(f"Local:   http://localhost:{port}")
    print(f"LAN:     http://<your-lan-ip>:{port}")
    socketio.run(app, host=host, debug=True, port=port)
