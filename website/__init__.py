from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_login import UserMixin, LoginManager
from werkzeug.security import generate_password_hash, check_password_hash
from sqlalchemy import inspect, text
import random
import string

import os
# init SQLAlchemy so we can use it later in our models
db = SQLAlchemy()

# from . import db
# SQLAlchemy = Python 操作数据库的高级工具
# flask-login = 用户登录管理库，UserMixin：给 User 类加登录能力；LoginManager ：管理登录状态
# werkzeug.security = 密码哈希工具，generate_password_hash：生成密码哈希；check_password_hash：验证密码哈希



class User(UserMixin, db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(80), index=True, unique=True)# index=True：为该列创建索引，unique=True：确保该列的值唯一
    email = db.Column(db.String(80), index=True, unique=True)
    password_hash = db.Column(db.String(128))
    image = db.Column(db.String(256))

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

    def getJsonData(self):
        return {
            "name": self.name,
            "email": self.email,
        }


    
class Conversation(db.Model):
    __table_args__ = (
        db.UniqueConstraint('user1', 'user2', name='uq_conversation_users'),
    )
    id = db.Column(db.Integer, primary_key=True)
    user1 = db.Column(db.String(80), index=True)
    user2 = db.Column(db.String(80), index=True)

    def getJsonData(self):
        return {
            "id": self.id,
            "user1": self.user1,
            "user2": self.user2,
        }


class Message(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    conversation_id = db.Column(db.Integer, index=True)
    sender = db.Column(db.String(80), index=True)
    content = db.Column(db.String(500))
    timestamp = db.Column(db.DateTime, index=True)

    def getJsonData(self):
        return {
            "id": self.id,
            "conversation_id": self.conversation_id,
            "sender": self.sender,
            "content": self.content,
            "timestamp": self.timestamp.isoformat() if self.timestamp else None,
        }

class FriendRequest(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    from_user = db.Column(db.String(80), index=True)
    to_user = db.Column(db.String(80), index=True)
    status = db.Column(db.String(20), index=True)  # pending/accepted/rejected
    timestamp = db.Column(db.DateTime, index=True)

    def getJsonData(self):
        return {
            "id": self.id,
            "from_user": self.from_user,
            "to_user": self.to_user,
            "status": self.status,
            "timestamp": self.timestamp.isoformat() if self.timestamp else None,
        }


class Friendship(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user1_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False, index=True)
    user2_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False, index=True)
    timestamp = db.Column(db.DateTime, index=True)
    image_by_user1 = db.Column(db.String(256), nullable=True)  # user1 设置的专属头像
    image_by_user2 = db.Column(db.String(256), nullable=True)  # user2 设置的专属头像
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
    bubble1 = db.Column(db.String(256), nullable=True)  # user1 气泡
    bubble2 = db.Column(db.String(256), nullable=True)  # user2 气泡
    bubble_text_color1 = db.Column(db.String(16), nullable=True)  # user1 文字颜色
    bubble_text_color2 = db.Column(db.String(16), nullable=True)  # user2 文字颜色
=======
    bubble1 = db.Column(db.String(256), nullable=True) # user1 气泡
    bubble2 = db.Column(db.String(256), nullable=True)  #user2 气泡
>>>>>>> 35a593c (Add bubble fields for user1 and user2)
=======
>>>>>>> e183948 (Revert "Merge pull request #7 from bywhdzrngly/feature/bubble")
=======
    bubble1 = db.Column(db.String(256), nullable=True) # user1 气泡
    bubble2 = db.Column(db.String(256), nullable=True)  #user2 气泡
>>>>>>> origin/dev

    # 关联 User 对象，便于获取用户名等信息
    user1 = db.relationship('User', foreign_keys=[user1_id])
    user2 = db.relationship('User', foreign_keys=[user2_id])

    __table_args__ = (
        db.UniqueConstraint('user1_id', 'user2_id', name='uq_friendship_users'),
    )

    def getJsonData(self):
        return {
            "id": self.id,
            "user1_id": self.user1_id,
            "user2_id": self.user2_id,
            "user1_name": self.user1.name if self.user1 else None,
            "user2_name": self.user2.name if self.user2 else None,
            "timestamp": self.timestamp.isoformat() if self.timestamp else None,
            "image_by_user1": self.image_by_user1,
            "image_by_user2": self.image_by_user2,
<<<<<<< HEAD
<<<<<<< HEAD
            "bubble1": self.bubble1,
            "bubble2": self.bubble2,
<<<<<<< HEAD
            "bubble_text_color1": self.bubble_text_color1,
            "bubble_text_color2": self.bubble_text_color2,
=======
>>>>>>> 35a593c (Add bubble fields for user1 and user2)
=======
>>>>>>> e183948 (Revert "Merge pull request #7 from bywhdzrngly/feature/bubble")
=======
            "bubble1": self.bubble1,
            "bubble2": self.bubble2,
>>>>>>> origin/dev
        }


def _ensure_friendship_columns():
    """为旧数据库补充新增字段。"""
    inspector = inspect(db.engine)
    if 'friendship' not in inspector.get_table_names():
        return

    existing_columns = {col['name'] for col in inspector.get_columns('friendship')}
    alter_sql = []

    if 'bubble_text_color1' not in existing_columns:
        alter_sql.append("ALTER TABLE friendship ADD COLUMN bubble_text_color1 VARCHAR(16)")
    if 'bubble_text_color2' not in existing_columns:
        alter_sql.append("ALTER TABLE friendship ADD COLUMN bubble_text_color2 VARCHAR(16)")

    if not alter_sql:
        return

    try:
        for sql in alter_sql:
            db.session.execute(text(sql))
        db.session.commit()
    except Exception:
        db.session.rollback()
        raise


def create_app():
    from .views import views
    from .auth import auth
    current_direc = os.getcwd()
    databasePath = os.path.join(current_direc, "db.sqlite")
    print(databasePath)
    app = Flask(__name__)
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    app.config['SECRET_KEY'] = 'xyzxyz xyzxyz xyzxyz'
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///db.sqlite'
    # app.config['SQLALCHEMY_DATABASE_URI'] = "sqlite:///:memory:"
    app.config['SESSION_COOKIE_DOMAIN'] = None
    app.config['SESSION_COOKIE_SAMESITE'] = "Lax"
    app.config['SESSION_COOKIE_SECURE'] = False
    
    # 配置本地文件上传文件夹
    UPLOAD_FOLDER = os.path.join(current_direc, 'uploads')
    os.makedirs(UPLOAD_FOLDER, exist_ok=True)
    app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

    with app.app_context():
        # from .models import user
        db.init_app(app)
        login_manager = LoginManager()
        login_manager.login_view = 'views.main_page'
        login_manager.init_app(app)
        db.create_all()
        try:
            _ensure_friendship_columns()
        except Exception as e:
            print(f"ensure friendship columns failed: {e}")
        
        # 注册 /uploads 路由来提供上传的文件
        @app.route('/uploads/<path:filename>')
        def uploaded_file(filename):
            from flask import send_from_directory, request
            from werkzeug.exceptions import NotFound

            upload_folder = app.config['UPLOAD_FOLDER']
            try:
                return send_from_directory(upload_folder, filename)
            except NotFound:
                # 兼容历史坏链接：文件名含 ? 时会被浏览器当作 query 截断
                raw_qs = request.query_string.decode('utf-8', errors='ignore')
                if raw_qs:
                    legacy_name = f"{filename}?{raw_qs}"
                    return send_from_directory(upload_folder, legacy_name)
                raise

        @login_manager.user_loader
        def load_user(user_id):
            # since the user_id is just the primary key of our user table, use it in the query for the user
            return User.query.get(int(user_id))

        app.register_blueprint(views, url_prefix='/')
        app.register_blueprint(auth, url_prefix='/')

    return app
