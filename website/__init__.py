from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_login import UserMixin, LoginManager
from werkzeug.security import generate_password_hash, check_password_hash
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
    user1 = db.Column(db.String(80), index=True)
    user2 = db.Column(db.String(80), index=True)
    timestamp = db.Column(db.DateTime, index=True)

    __table_args__ = (
        db.UniqueConstraint('user1', 'user2', name='uq_friendship_users'),
    )

    def getJsonData(self):
        return {
            "id": self.id,
            "user1": self.user1,
            "user2": self.user2,
            "timestamp": self.timestamp.isoformat() if self.timestamp else None,
        }


def create_app():
    current_direc = os.getcwd()
    databasePath = os.path.join(current_direc, "db.sqlite")
    print(databasePath)
    app = Flask(__name__)
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    app.config['SECRET_KEY'] = 'xyzxyz xyzxyz xyzxyz'
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///db.sqlite'
    # app.config['SQLALCHEMY_DATABASE_URI'] = "sqlite:///:memory:"
    
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
        
        # 注册 /uploads 路由来提供上传的文件
        @app.route('/uploads/<filename>')
        def uploaded_file(filename):
            from flask import send_from_directory
            return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

        @login_manager.user_loader
        def load_user(user_id):
            # since the user_id is just the primary key of our user table, use it in the query for the user
            return User.query.get(int(user_id))
        # db.create_all()
        from .views import views
        from .auth import auth

        app.register_blueprint(views, url_prefix='/')
        app.register_blueprint(auth, url_prefix='/')

    return app
