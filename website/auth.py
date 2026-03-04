from flask import Blueprint, request, redirect, url_for, session, jsonify
# Blueprint:一个功能模块;render_template:渲染html模板;request:获取请求数据;redirect:重定向;url_for:生成URL;session:会话对象;
from flask_login import login_user, logout_user, login_required, current_user
from . import db
# 等价于from website import db
from .__init__ import User, Friendship
from datetime import datetime
import os
import uuid
from werkzeug.utils import secure_filename
# uuid:生成唯一标识符的库

auth = Blueprint('auth', __name__)


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


@auth.route('/signup', methods=['POST', 'GET'])
def signup_post():
    if request.method == 'POST':
        thumbnail_url1 = None
        email = request.form.get('email')
        name = request.form.get('name')
        password = request.form.get('password')
        image = request.files.get('image')
        
        # 本地上传图片
        if image and image.filename != '':
            from flask import current_app
            thumbnail_url1 = upload_image_local(image, current_app.config['UPLOAD_FOLDER'])
        else:
            thumbnail_url1 = 'https://png.pngitem.com/pimgs/s/150-1503945_transparent-user-png-default-user-image-png-png.png'                
        
        if not password or not email or not name:
            return jsonify({"error": "Invalid Credentials. Please try again."}), 400

        if User.query.filter_by(name=name).count() == 1:
            return jsonify({"error": "Name already taken. Please try again."}), 400

        if User.query.filter_by(email=email).count() == 1:
            return jsonify({"error": "Email already taken. Please try again."}), 400

        u = User()
        u.name = name
        u.email = email
        u.image = thumbnail_url1
        u.set_password(password)
        session['username'] = name
        db.session.add(u)
        db.session.commit()

        # 注册成功后自动建立“自己-自己”友谊，保证好友列表初始包含自己
        self_friendship = Friendship.query.filter_by(user1_id=u.id, user2_id=u.id).first()
        if not self_friendship:
            self_friendship = Friendship(user1_id=u.id, user2_id=u.id, timestamp=datetime.utcnow())
            db.session.add(self_friendship)
            db.session.commit()

        return jsonify({
            "status": "ok",
            "user": {
                "id": u.id,
                "name": u.name,
                "email": u.email,
                "image": u.image,
            }
        })
    else:
        return redirect(url_for('views.landing_page'))


@auth.route('/login', methods=['POST'])
def login_post():
    name = request.form.get('name')
    password = request.form.get('password')
    remember = True if request.form.get('remember') else False

    if not name or not password:
        return jsonify({"error": "Missing Data"}), 400

    user = User.query.filter_by(name=name).first()
    if user is None or not user.check_password(password):
        return jsonify({"error": "Please check your login details and try again."}), 401

    session.pop('username', None)
    login_user(user, remember=remember)
    return jsonify({
        "status": "ok",
        "user": {
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "image": user.image,
        }
    })


@auth.route('/logout', methods=['GET', 'POST'])
@login_required
def logout():
    logout_user()
    session.pop('name', None)
    if request.method == 'POST':
        return jsonify({"status": "ok"})
    return redirect(url_for('views.landing_page'))
