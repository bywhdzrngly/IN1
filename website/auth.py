from flask import Blueprint, render_template, request, redirect, url_for, session
# Blueprint:一个功能模块;render_template:渲染html模板;request:获取请求数据;redirect:重定向;url_for:生成URL;session:会话对象;
from flask_login import login_user, logout_user, login_required
from . import db
# 等价于from website import db
from .__init__ import User
import os
import uuid
# uuid:生成唯一标识符的库

auth = Blueprint('auth', __name__)


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


@auth.route('/signup', methods=['POST', 'GET'])
def signup_post():
    if request.method == 'POST':
        error = None
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
            error = "Invalid Credentials. Please try again."
            return render_template("/auth/login-register.html", error=error)

        if User.query.filter_by(name=name).count() == 1:
            error = "Name already taken. Please try again."
            return render_template("/auth/login-register.html", error=error)

        if User.query.filter_by(email=email).count() == 1:
            error = "Email already taken. Please try again."
            return render_template("/auth/login-register.html", error=error)

        u = User()
        u.name = name
        u.email = email
        u.image = thumbnail_url1
        u.set_password(password)
        session['username'] = name
        db.session.add(u)
        db.session.commit()

        return render_template("/auth/login-register.html")
    else:
        return render_template("/auth/login-register.html")


@auth.route('/login', methods=['POST'])
def login_post():
    error = None
    name = request.form.get('name')
    password = request.form.get('password')
    remember = True if request.form.get('remember') else False

    if not name or not password:
        error = "Missing Data"
        return render_template("/auth/login-register.html", error=error)

    user = User.query.filter_by(name=name).first()
    if user is None or not user.check_password(password):
        error = "Please check your login details and try again."
        return render_template("/auth/login-register.html", error=error)

    session.pop('username', None)
    login_user(user, remember=remember)
    return redirect(url_for('views.chat'))


@auth.route('/logout')
@login_required
def logout():
    logout_user()
    session.pop('name', None)
    return render_template('/auth/login-register.html')
