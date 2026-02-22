# 聊天 App 的核心视图逻辑（处理页面跳转、图片上传、聊天数据展示）
from flask import Blueprint, request, jsonify, current_app, render_template
from flask_login import login_required, current_user
from .__init__ import User, db, Conversation, Message, FriendRequest, Friendship
from datetime import datetime
import os
import uuid

views = Blueprint("views", __name__)


def _user_room(username):
    return f"user_{username}"


def _emit_friend_data_changed(*usernames):
    socketio = current_app.extensions.get('socketio')
    if not socketio:
        return

    for username in set(u for u in usernames if u):
        socketio.emit('friendDataChanged', {'username': username}, room=_user_room(username))

'''
路由(Route)本质是"URL 地址"与"后端处理函数"的映射关系,Flask 通过装饰器 @app.route() 来定义路由。比如 @app.route('/chat') 就是把 /chat 地址和 chat() 函数关联起来,当用户访问 /chat 时,就会执行 chat() 函数里的代码。
Blueprint:Flask 的"蓝图",用来拆分项目路由(把不同功能的路由分开管理,比如登录、聊天、上传各用一个蓝图);
render_template:渲染 templates 文件夹里的 HTML 模板(比如返回聊天页面);
session:Flask 的会话对象,用来存临时数据(比如当前登录用户、聊天房间名,关闭浏览器前有效);
request:获取前端发来的请求数据(比如上传的图片、表单里的用户名);
redirect:重定向到其他路由(比如上传图片后跳回聊天页);
url_for:根据路由函数名生成 URL(比如 url_for('views.chat') 生成 /chat 地址)。

flask_socketio 是实现 WebSocket 的库(实时聊天核心):
SocketIO:创建 WebSocket 服务;
send:发送实时消息(这里代码里没直接用,但导入了备用)。
'''
# 本地图片上传函数
def upload_image_local(file, upload_folder):
    """保存图片到本地uploads文件夹"""
    if not file or file.filename == '':
        return None
    # 生成唯一文件名
    filename = f"{uuid.uuid4().hex}_{file.filename}"
    file_path = os.path.join(upload_folder, filename)
    file.save(file_path)
    # 返回本地访问路径
    return f"/uploads/{filename}"


@views.route('/')#定义根路由（访问 http://127.0.0.1:5000/ 时触发）
def landing_page():
    return render_template('index.html')
'''
到时候改前端需要改
render_template("/views/landingPage.html")：
渲染 templates/views/landingPage.html 模板（返回 App 首页）。
'''

@views.route('/authorization')
def main_page():
    return render_template('index.html')


@views.route('/user', methods=['GET'])
@login_required
def get_current_user():
    return jsonify({
        "id": current_user.id,
        "name": current_user.name,
        "email": current_user.email,
        "image": current_user.image,
    })


@views.route('/conversation/<username>')
@login_required
def get_or_create_conversation(username):
    me = current_user.name
    if username == me:
        return jsonify({"error": "cannot chat with yourself"}), 400

    target = User.query.filter_by(name=username).first()
    if not target:
        return jsonify({"error": "user not found"}), 404

    user1, user2 = sorted([me, username])
    is_friend = Friendship.query.filter_by(user1=user1, user2=user2).first()
    if not is_friend:
        return jsonify({"error": "not friends"}), 403
    
    conv = Conversation.query.filter_by(user1=user1, user2=user2).first()

    if not conv:
        conv = Conversation(user1=user1, user2=user2)
        db.session.add(conv)
        db.session.commit()

    return jsonify(conv.getJsonData())


@views.route('/message/send', methods=['POST'])
@login_required
def send_message():
    data = request.get_json(silent=True) or {}
    conversation_id = data.get('conversation_id')
    content = (data.get('content') or '').strip()

    if not conversation_id or not content:
        return jsonify({"error": "missing conversation_id or content"}), 400

    conv = Conversation.query.filter_by(id=conversation_id).first()
    if not conv:
        return jsonify({"error": "conversation not found"}), 404

    if current_user.name not in (conv.user1, conv.user2):
        return jsonify({"error": "forbidden"}), 403

    user1, user2 = sorted([conv.user1, conv.user2])
    is_friend = Friendship.query.filter_by(user1=user1, user2=user2).first()
    if not is_friend:
        return jsonify({"error": "not friends"}), 403
    
    msg = Message(
        conversation_id=conversation_id,
        sender=current_user.name,
        content=content,
        timestamp=datetime.utcnow(),
    )
    db.session.add(msg)
    db.session.commit()

    return jsonify(msg.getJsonData())

@views.route('/message/upload', methods=['POST'])
@login_required
def upload_message_image():
    from flask import current_app

    conversation_id = request.form.get('conversation_id')
    if not conversation_id:
        return jsonify({"error": "missing conversation_id"}), 400

    conv = Conversation.query.filter_by(id=conversation_id).first()
    if not conv:
        return jsonify({"error": "conversation not found"}), 404

    if current_user.name not in (conv.user1, conv.user2):
        return jsonify({"error": "forbidden"}), 403

    user1, user2 = sorted([conv.user1, conv.user2])
    is_friend = Friendship.query.filter_by(user1=user1, user2=user2).first()
    if not is_friend:
        return jsonify({"error": "not friends"}), 403

    image = request.files.get('image')
    if not image or image.filename == '':
        return jsonify({"error": "missing image"}), 400

    image_url = upload_image_local(image, current_app.config['UPLOAD_FOLDER'])
    if not image_url:
        return jsonify({"error": "upload failed"}), 500

    msg = Message(
        conversation_id=conversation_id,
        sender=current_user.name,
        content=image_url,
        timestamp=datetime.utcnow(),
    )
    db.session.add(msg)
    db.session.commit()

    return jsonify(msg.getJsonData())

@views.route('/messages/<int:conversation_id>')
@login_required
def get_messages(conversation_id):
    conv = Conversation.query.filter_by(id=conversation_id).first()
    if not conv:
        return jsonify({"error": "conversation not found"}), 404

    if current_user.name not in (conv.user1, conv.user2):
        return jsonify({"error": "forbidden"}), 403

    msgs = Message.query.filter_by(
        conversation_id=conversation_id
    ).order_by(Message.timestamp).all()

    return jsonify([m.getJsonData() for m in msgs])

@views.route('/friends', methods=['GET'])
@login_required
def list_friends():
    me = current_user.name
    friendships = Friendship.query.filter(
        (Friendship.user1 == me) | (Friendship.user2 == me)
    ).all()

    friends = []
    for f in friendships:
        friend_name = f.user2 if f.user1 == me else f.user1
        friend_user = User.query.filter_by(name=friend_name).first()
        friends.append({
            "name": friend_name,
            "email": friend_user.email if friend_user else "",
            "image": friend_user.image if friend_user else "",
        })

    return jsonify({"friends": friends})


@views.route('/friend/request', methods=['POST'])
@login_required
def send_friend_request():
    data = request.get_json(silent=True) or {}
    to_user = data.get('to_user')

    if not to_user:
        return jsonify({"error": "missing to_user"}), 400
    if to_user == current_user.name:
        return jsonify({"error": "cannot add yourself"}), 400
    if User.query.filter_by(name=to_user).first() is None:
        return jsonify({"error": "user not found"}), 404

    user1, user2 = sorted([current_user.name, to_user])
    if Friendship.query.filter_by(user1=user1, user2=user2).first():
        return jsonify({"error": "already friends"}), 400

    exists = FriendRequest.query.filter_by(
        from_user=current_user.name, to_user=to_user, status="pending"
    ).first()
    if exists:
        return jsonify({"error": "request already sent"}), 400

    req = FriendRequest(
        from_user=current_user.name,
        to_user=to_user,
        status="pending",
        timestamp=datetime.utcnow(),
    )
    db.session.add(req)
    db.session.commit()

    _emit_friend_data_changed(to_user)
    return jsonify(req.getJsonData())


@views.route('/friend/requests', methods=['GET'])
@login_required
def list_friend_requests():
    me = current_user.name
    reqs = FriendRequest.query.filter_by(to_user=me, status="pending").all()
    payload = []
    for r in reqs:
        from_user = User.query.filter_by(name=r.from_user).first()
        item = r.getJsonData()
        item["from_user_email"] = from_user.email if from_user else ""
        item["from_user_image"] = from_user.image if from_user else ""
        payload.append(item)
    return jsonify(payload)


@views.route('/friend/accept', methods=['POST'])
@login_required
def accept_friend_request():
    data = request.get_json(silent=True) or {}
    request_id = data.get('request_id')
    if not request_id:
        return jsonify({"error": "missing request_id"}), 400

    req = FriendRequest.query.filter_by(id=request_id, to_user=current_user.name).first()
    if not req or req.status != "pending":
        return jsonify({"error": "request not found"}), 404

    user1, user2 = sorted([req.from_user, req.to_user])
    if not Friendship.query.filter_by(user1=user1, user2=user2).first():
        f = Friendship(user1=user1, user2=user2, timestamp=datetime.utcnow())
        db.session.add(f)

    req.status = "accepted"
    db.session.commit()
    _emit_friend_data_changed(req.from_user, req.to_user)
    return jsonify({"status": "accepted"})


@views.route('/friend/reject', methods=['POST'])
@login_required
def reject_friend_request():
    data = request.get_json(silent=True) or {}
    request_id = data.get('request_id')
    if not request_id:
        return jsonify({"error": "missing request_id"}), 400

    req = FriendRequest.query.filter_by(id=request_id, to_user=current_user.name).first()
    if not req or req.status != "pending":
        return jsonify({"error": "request not found"}), 404

    req.status = "rejected"
    db.session.commit()
    _emit_friend_data_changed(req.from_user, req.to_user)
    return jsonify({"status": "rejected"})


@views.route('/friend/delete', methods=['POST'])
@login_required
def delete_friend():
    data = request.get_json(silent=True) or {}
    friend = data.get('friend')
    if not friend:
        return jsonify({"error": "missing friend"}), 400

    user1, user2 = sorted([current_user.name, friend])
    f = Friendship.query.filter_by(user1=user1, user2=user2).first()
    if not f:
        return jsonify({"error": "not friends"}), 404

    db.session.delete(f)
    db.session.commit()
    _emit_friend_data_changed(user1, user2)
    return jsonify({"status": "deleted"})

@views.route('/users', methods=['GET'])
@login_required
def list_all_users():
    me = current_user.name
    users = User.query.filter(User.name != me).all()
    return jsonify([{"name": u.name, "email": u.email, "image": u.image} for u in users])
