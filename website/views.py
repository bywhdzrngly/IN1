# 聊天 App 的核心视图逻辑（处理页面跳转、图片上传、聊天数据展示）
from flask import Blueprint, request, jsonify, current_app, render_template
from flask_login import login_required, current_user
from .__init__ import User, db, Conversation, Message, FriendRequest, Friendship
from datetime import datetime
import os
import uuid
import re
from werkzeug.utils import secure_filename
from sqlalchemy.exc import IntegrityError

views = Blueprint("views", __name__)
HEX_COLOR_RE = re.compile(r'^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$')


def _user_room(username):
    return f"user_{username}"


def _emit_friend_data_changed(*usernames):
    socketio = current_app.extensions.get('socketio')
    if not socketio:
        return

    for username in set(u for u in usernames if u):
        socketio.emit('friendDataChanged', {'username': username}, room=_user_room(username))


def _related_usernames_for_user(user):
    if not user:
        return []

    usernames = {user.name}
    friendships = Friendship.query.filter(
        (Friendship.user1_id == user.id) | (Friendship.user2_id == user.id)
    ).all()

    for friendship in friendships:
        if friendship.user1 and friendship.user1.name:
            usernames.add(friendship.user1.name)
        if friendship.user2 and friendship.user2.name:
            usernames.add(friendship.user2.name)

    return list(usernames)


def _normalize_hex_color(value):
    if value is None:
        return None
    color = str(value).strip()
    if not HEX_COLOR_RE.match(color):
        return None
    if len(color) == 4:
        color = "#" + "".join(ch * 2 for ch in color[1:])
    return color.lower()

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
    # 清洗文件名，避免 ? 等特殊字符导致 URL 404
    original_name = file.filename or ''
    safe_name = secure_filename(original_name)
    if not safe_name:
        ext = os.path.splitext(original_name)[1]
        safe_name = f"upload{ext}" if ext else "upload"

    # 生成唯一文件名
    filename = f"{uuid.uuid4().hex}_{safe_name}"
    file_path = os.path.join(upload_folder, filename)
    file.save(file_path)
    # 返回本地访问路径
    return f"/uploads/{filename}"


def upload_bubble_local(file, upload_folder):
    """保存气泡图片到 uploads/bubbles 并返回可访问路径"""
    if not file or file.filename == '':
        return None

    bubble_folder = os.path.join(upload_folder, 'bubbles')
    os.makedirs(bubble_folder, exist_ok=True)

    original_name = file.filename or ''
    safe_name = secure_filename(original_name)
    if not safe_name:
        ext = os.path.splitext(original_name)[1]
        safe_name = f"bubble{ext}" if ext else "bubble"

    filename = f"{uuid.uuid4().hex}_{safe_name}"
    file_path = os.path.join(bubble_folder, filename)
    file.save(file_path)
    return f"/uploads/bubbles/{filename}"


@views.route("/")
@login_required
def index():
    return render_template(
        "index.html",
        user=current_user
    )
'''
到时候改前端需要改
render_template("/views/landingPage.html")：
渲染 templates/views/landingPage.html 模板（返回 App 首页）。
'''

@views.route('/authorization')
def main_page():
    return render_template('index.html')


@views.route('/user')
@views.route("/current_user")
@login_required
def get_current_user():
    print("current_user =", current_user)
    print("is_authenticated =", current_user.is_authenticated)
    return jsonify({
        "id": current_user.id,
        "name": current_user.name,
        "email": current_user.email,
        "image": current_user.image,
    })


@views.route('/user/name', methods=['POST'])
def update_user_name():
    if not current_user.is_authenticated:
        return jsonify({"error": "unauthorized"}), 401

    data = request.get_json(silent=True) or {}
    new_name = data.get('name')
    if new_name is None:
        new_name = request.form.get('name')

    if new_name is None:
        return jsonify({"error": "missing new name"}), 400

    new_name = str(new_name).strip()
    if not new_name:
        return jsonify({"error": "name cannot be empty"}), 400

    user = User.query.get(current_user.id)
    if not user:
        return jsonify({"error": "user not found"}), 404

    old_name = user.name
    if new_name == old_name:
        return jsonify({"status": "ok", "name": new_name})

    exists = User.query.filter(User.name == new_name, User.id != user.id).first()
    if exists:
        return jsonify({"error": "username already taken"}), 400

    try:
        user.name = new_name

        # 级联更新依赖用户名的历史数据，避免改名后数据断链
        Conversation.query.filter_by(user1=old_name).update(
            {Conversation.user1: new_name},
            synchronize_session=False,
        )
        Conversation.query.filter_by(user2=old_name).update(
            {Conversation.user2: new_name},
            synchronize_session=False,
        )
        Message.query.filter_by(sender=old_name).update(
            {Message.sender: new_name},
            synchronize_session=False,
        )
        FriendRequest.query.filter_by(from_user=old_name).update(
            {FriendRequest.from_user: new_name},
            synchronize_session=False,
        )
        FriendRequest.query.filter_by(to_user=old_name).update(
            {FriendRequest.to_user: new_name},
            synchronize_session=False,
        )

        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return jsonify({"error": "username already taken"}), 400
    except Exception:
        db.session.rollback()
        current_app.logger.exception("update_user_name database error")
        return jsonify({"error": "database error"}), 500

    try:
        # old_name 用于兼容当前已连接但仍在旧房间的会话
        _emit_friend_data_changed(old_name, *_related_usernames_for_user(user))
    except Exception:
        current_app.logger.exception("emit friendDataChanged failed after username update")

    return jsonify({"status": "ok", "name": new_name})


@views.route('/user/avatar', methods=['POST'])
@login_required
def update_avatar():
    image = request.files.get('image')
    if not image or image.filename == '':
        return jsonify({"error": "missing image"}), 400

    image_url = upload_image_local(image, current_app.config['UPLOAD_FOLDER'])
    if not image_url:
        return jsonify({"error": "upload failed"}), 500

    # 重新查询当前用户，确保使用当前会话中的对象
    user = User.query.get(current_user.id)
    if not user:
        return jsonify({"error": "user not found"}), 404

    user.image = image_url
    try:
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        print(f"Database commit error: {e}")
        return jsonify({"error": "database error"}), 500

    _emit_friend_data_changed(*_related_usernames_for_user(user))

    # 返回新 URL 并再次查询确认
    return jsonify({
        "status": "ok",
        "image": image_url
    })

@views.route('/conversation/<username>')
@login_required
def get_or_create_conversation(username):
    me = current_user
    if username == me.name:
        return jsonify({"error": "cannot chat with yourself"}), 400

    target = User.query.filter_by(name=username).first()
    if not target:
        return jsonify({"error": "user not found"}), 404

    # 获取记录（按 ID 排序）
    user1_id = min(me.id, target.id)
    user2_id = max(me.id, target.id)
    friendship = Friendship.query.filter_by(user1_id=user1_id, user2_id=user2_id).first()
    if not friendship:
        return jsonify({"error": "not friends"}), 403

    # 确定对话中 user1/user2 的顺序：ID 小的为 user1
    if me.id < target.id:
        conv_user1, conv_user2 = me.name, target.name
    else:
        conv_user1, conv_user2 = target.name, me.name

    # 获取或创建对话
    conv = Conversation.query.filter_by(user1=conv_user1, user2=conv_user2).first()
    if not conv:
        conv = Conversation(user1=conv_user1, user2=conv_user2)
        db.session.add(conv)
        db.session.commit()

    avatar_and_bubble_map = {
        str(me.id): {
            "global": me.image,
            "special": friendship.image_by_user1 if me.id == friendship.user1_id else friendship.image_by_user2,
            "bubble": friendship.bubble1 if me.id == friendship.user1_id else friendship.bubble2,
            "text_color": friendship.bubble_text_color1 if me.id == friendship.user1_id else friendship.bubble_text_color2,
        },
        str(target.id): {
            "global": target.image,
            "special": friendship.image_by_user2 if me.id == friendship.user1_id else friendship.image_by_user1,
            "bubble": friendship.bubble2 if me.id == friendship.user1_id else friendship.bubble1,
            "text_color": friendship.bubble_text_color2 if me.id == friendship.user1_id else friendship.bubble_text_color1,
        }
    }

    conversation_data = conv.getJsonData()
    # 兼容前端历史字段名：avatar_map（当前使用）与 map（旧字段）
    conversation_data['avatar_map'] = avatar_and_bubble_map
    conversation_data['map'] = avatar_and_bubble_map

    return jsonify(conversation_data)


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

    # 检查当前用户是否参与对话（用用户名）
    if current_user.name not in (conv.user1, conv.user2):
        return jsonify({"error": "forbidden"}), 403

    # 获取对话双方的 User 对象
    user1 = User.query.filter_by(name=conv.user1).first()
    user2 = User.query.filter_by(name=conv.user2).first()
    if not user1 or not user2:
        return jsonify({"error": "conversation participants invalid"}), 500

    # 检查是否仍是好友（用 ID）
    user1_id = min(user1.id, user2.id)
    user2_id = max(user1.id, user2.id)
    is_friend = Friendship.query.filter_by(user1_id=user1_id, user2_id=user2_id).first()
    if not is_friend:
        return jsonify({"error": "not friends"}), 403

    msg = Message(
        conversation_id=conversation_id,
        sender=current_user.name,   # 仍用用户名
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

    # 获取对话双方的用户对象（用于后续查询友谊）
    user1 = User.query.filter_by(name=conv.user1).first()
    user2 = User.query.filter_by(name=conv.user2).first()
    if not user1 or not user2:
        return jsonify({"error": "invalid conversation participants"}), 500

    # 使用 ID 检查友谊
    user1_id = min(user1.id, user2.id)
    user2_id = max(user1.id, user2.id)
    is_friend = Friendship.query.filter_by(user1_id=user1_id, user2_id=user2_id).first()
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
    me = current_user
    friendships = Friendship.query.filter(
        (Friendship.user1_id == me.id) | (Friendship.user2_id == me.id)
    ).all()

    friends = []
    for f in friendships:
        friend_user = f.user2 if f.user1_id == me.id else f.user1
        friends.append({
            "id": friend_user.id,
            "name": friend_user.name,
            "email": friend_user.email,
            "image": friend_user.image,
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

    target = User.query.filter_by(name=to_user).first()
    if not target:
        return jsonify({"error": "user not found"}), 404

    # 检查是否已是好友
    user1_id = min(current_user.id, target.id)
    user2_id = max(current_user.id, target.id)
    if Friendship.query.filter_by(user1_id=user1_id, user2_id=user2_id).first():
        return jsonify({"error": "already friends"}), 400

    # 后续代码不变（FriendRequest 仍用用户名）
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

    from_user = User.query.filter_by(name=req.from_user).first()
    to_user = User.query.filter_by(name=req.to_user).first()
    if not from_user or not to_user:
        return jsonify({"error": "user not found"}), 404

    # 用 ID 创建友谊
    user1_id = min(from_user.id, to_user.id)
    user2_id = max(from_user.id, to_user.id)
    if not Friendship.query.filter_by(user1_id=user1_id, user2_id=user2_id).first():
        f = Friendship(user1_id=user1_id, user2_id=user2_id, timestamp=datetime.utcnow())
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

    target = User.query.filter_by(name=friend).first()
    if not target:
        return jsonify({"error": "user not found"}), 404

    user1_id = min(current_user.id, target.id)
    user2_id = max(current_user.id, target.id)
    f = Friendship.query.filter_by(user1_id=user1_id, user2_id=user2_id).first()
    if not f:
        return jsonify({"error": "not friends"}), 404

    db.session.delete(f)
    db.session.commit()
    _emit_friend_data_changed(current_user.name, friend)
    return jsonify({"status": "deleted"})

@views.route('/friend/set_avatar', methods=['POST'])
@login_required
def set_friend_avatar():
    try:
        current_app.logger.info("SET AVATAR CALLED")
        friend_param = request.form.get('friend')
        image = request.files.get('image')
        current_app.logger.info("friend_name = %s", friend_param)
        current_app.logger.info("image = %r", image)

        if not friend_param or not image:
            return jsonify({"error": "Missing friend or image"}), 400

        # Accept either numeric id or username
        target = None
        if friend_param.isdigit():
            target = User.query.filter_by(id=int(friend_param)).first()
        if not target:
            target = User.query.filter_by(name=friend_param).first()

        if not target:
            return jsonify({"error": "User not found"}), 404

        # friendship stored by ordered ids
        user1_id = min(current_user.id, target.id)
        user2_id = max(current_user.id, target.id)
        friendship = Friendship.query.filter_by(user1_id=user1_id, user2_id=user2_id).first()
        if not friendship:
            return jsonify({"error": "Not friends"}), 403

        image_url = upload_image_local(image, current_app.config['UPLOAD_FOLDER'])
        if not image_url:
            return jsonify({"error": "Upload failed"}), 500

        if current_user.id == friendship.user1_id:
            friendship.image_by_user1 = image_url
        else:
            friendship.image_by_user2 = image_url

        db.session.commit()

        try:
            _emit_friend_data_changed(current_user.name, target.name)
        except Exception:
            current_app.logger.exception("emit friendDataChanged failed")

        return jsonify({"status": "ok", "image_url": image_url}), 200

    except Exception as e:
        current_app.logger.exception("set_friend_avatar exception")
        return jsonify({"error": "internal_server_error", "detail": str(e)}), 500

@views.route('/friend/set_bubble', methods=['POST'])
@login_required
def set_friend_bubble():
    friend_param = request.form.get('friend')
    image = request.files.get('image')

    if not friend_param or not image:
        return jsonify({"error": "Missing friend or image"}), 400

    # Accept either numeric id or username
    target = None
    if friend_param.isdigit():
        target = User.query.filter_by(id=int(friend_param)).first()
    if not target:
        target = User.query.filter_by(name=friend_param).first()

    if not target:
        return jsonify({"error": "User not found"}), 404

    # 使用 ID 查询友谊记录
    user1_id = min(current_user.id, target.id)
    user2_id = max(current_user.id, target.id)
    friendship = Friendship.query.filter_by(user1_id=user1_id, user2_id=user2_id).first()
    if not friendship:
        return jsonify({"error": "Not friends"}), 403

    image_url = upload_bubble_local(image, current_app.config['UPLOAD_FOLDER'])
    if not image_url:
        return jsonify({"error": "Upload failed"}), 500

    # 根据当前用户 ID 存入对应字段
    if current_user.id == friendship.user1_id:
        friendship.bubble1 = image_url
    else:
        friendship.bubble2 = image_url

    try:
        db.session.commit()
    except Exception:
        db.session.rollback()
        current_app.logger.exception("set_friend_bubble database error")
        return jsonify({"error": "database error"}), 500

    _emit_friend_data_changed(current_user.name, target.name)
    return jsonify({"status": "ok", "image_url": image_url})


@views.route('/friend/set_bubble_text_color', methods=['POST'])
@login_required
def set_friend_bubble_text_color():
    data = request.get_json(silent=True) or {}
    friend_param = data.get('friend')
    if friend_param is None:
        friend_param = request.form.get('friend')

    color = data.get('color')
    if color is None:
        color = request.form.get('color')
    if color is None:
        color = data.get('text_color')
    if color is None:
        color = request.form.get('text_color')

    if not friend_param:
        return jsonify({"error": "missing friend"}), 400
    if color is None:
        return jsonify({"error": "missing color"}), 400

    normalized_color = _normalize_hex_color(color)
    if not normalized_color:
        return jsonify({"error": "invalid color"}), 400

    target = None
    if str(friend_param).isdigit():
        target = User.query.filter_by(id=int(friend_param)).first()
    if not target:
        target = User.query.filter_by(name=str(friend_param)).first()
    if not target:
        return jsonify({"error": "user not found"}), 404

    user1_id = min(current_user.id, target.id)
    user2_id = max(current_user.id, target.id)
    friendship = Friendship.query.filter_by(user1_id=user1_id, user2_id=user2_id).first()
    if not friendship:
        return jsonify({"error": "not friends"}), 403

    if current_user.id == friendship.user1_id:
        friendship.bubble_text_color1 = normalized_color
    else:
        friendship.bubble_text_color2 = normalized_color

    try:
        db.session.commit()
    except Exception:
        db.session.rollback()
        current_app.logger.exception("set_friend_bubble_text_color database error")
        return jsonify({"error": "database error"}), 500

    _emit_friend_data_changed(current_user.name, target.name)
    return jsonify({"status": "ok", "text_color": normalized_color})

@views.route('/users', methods=['GET'])
@login_required
def list_all_users():
    me = current_user.name
    users = User.query.filter(User.name != me).all()
    return jsonify([{"name": u.name, "email": u.email, "image": u.image} for u in users])
