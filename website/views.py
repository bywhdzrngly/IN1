from flask import Blueprint, render_template, session, request, redirect, url_for
views = Blueprint('views', __name__)
from flask_login import login_user, logout_user, login_required, current_user
from flask_socketio import SocketIO, send
from .__init__ import User, Workspace,db, Channel,Chats
import os
import uuid


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


@views.route('/')
def landing_page():
    return render_template("/views/landingPage.html")

@views.route('/authorization')
def main_page():
    return render_template("/auth/login-register.html")

@views.route('/imageUploadChat', methods=['POST'])
@login_required
def uploadImage():
    from flask import current_app
    image = request.files.get('image')
    print("hello image here")
    if image and image.filename != '':
        # 本地保存图片
        thumbnail_url1 = upload_image_local(image, current_app.config['UPLOAD_FOLDER'])
        print(thumbnail_url1)
        c = Chats()
        c.message = thumbnail_url1
        c.username = request.form.get('imageusername')
        c.wid = request.form.get('imagewid')
        c.channel_id = request.form.get('imagecid')
        c.image = 1
        room = Workspace.query.filter_by(id = request.form.get('imagewid')).first()
        session['name'] = room.name
        if c.message and c.username and c.wid and c.channel_id:
            db.session.add(c)
            db.session.commit()
            if Chats.query.filter_by(message = thumbnail_url1).count() == 1:
                image = Chats.query.filter_by(message = thumbnail_url1).first()
                session['imageid'] = image.id
    return redirect(url_for('views.chat'))


@views.route('/chat')
@login_required
def chat():
    Workspaces = []
    ChannelCount = 0
    count = 0
    if session.get("USERNAME") is None:
        username = current_user.name
    else:
        username = session['username']
    user = User.query.filter_by(name = username).first()
    if user.workspace_list:
        wlist = user.workspace_list.split()
        wlist = [int(i) for i in wlist]
        count = len(wlist)
        for w in wlist:
            Workspaces.append(Workspace.query.filter_by(id = w).first())
    print(username)
    chatscount = 0
    if len(Workspaces) > 0:
        Channels = Channel.query.filter_by(wid = Workspaces[0].id).all()
        print(Workspaces[0].id)
        ChannelCount = Channel.query.filter_by(wid = Workspaces[0].id).count()
        print(Channels)
        if ChannelCount > 0:
            chats = Chats.query.filter_by(wid = Workspaces[0].id, channel_id = Channels[0].id).all()
            chatscount = len(chats)
            if chatscount and chatscount > 0:
                print(chatscount, "chatscount")
                return render_template('/views/base.html', workspace = Workspaces, count = count, channels = Channels, channelCount = ChannelCount,username = username, chats= chats, chatscount = chatscount, image = user.image)
        return render_template('/views/base.html', workspace = Workspaces, count = count, channels = Channels, channelCount = ChannelCount,username = username, chatscount = chatscount, image = user.image)
    return render_template('/views/base.html', workspace = Workspaces, count = count, channelCount = ChannelCount, username = username, chatscount = chatscount, image = user.image)
