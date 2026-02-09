# 聊天 App 的核心视图逻辑（处理页面跳转、图片上传、聊天数据展示）
from flask import Blueprint, render_template, session, request, redirect, url_for
views = Blueprint('views', __name__)
from flask_login import login_user, logout_user, login_required, current_user
from flask_socketio import SocketIO, send
from .__init__ import User, Workspace,db, Channel,Chats
import os
import uuid

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
    return render_template("/views/landingPage.html")
'''
到时候改前端需要改
render_template("/views/landingPage.html")：
渲染 templates/views/landingPage.html 模板（返回 App 首页）。
'''

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
@login_required  # 必须登录才能访问聊天页
def chat():
    # 1. 初始化变量：存放工作区、频道数量等
    Workspaces = []  # 用户的所有工作区
    ChannelCount = 0  # 第一个工作区的频道数量
    count = 0  # 用户的工作区数量
    
    # 2. 获取当前登录用户名（兼容session和flask_login两种方式）
    if session.get("USERNAME") is None:
        username = current_user.name  # 从flask_login的当前用户获取
    else:
        username = session['username']  # 从session获取
    
    # 3. 从数据库查当前用户对象
    user = User.query.filter_by(name = username).first()
    
    # 4. 如果用户有工作区列表，解析并加载所有工作区
    if user.workspace_list:
        # workspace_list是字符串（比如"1 2 3"），拆分成列表并转成整数
        wlist = user.workspace_list.split()
        wlist = [int(i) for i in wlist]
        count = len(wlist)  # 工作区数量
        
        # 遍历工作区ID，查询并添加到Workspaces列表
        for w in wlist:
            Workspaces.append(Workspace.query.filter_by(id = w).first())
    
    print(username)  # 调试用：打印当前用户名
    chatscount = 0  # 第一个频道的消息数量
    
    # 5. 如果用户有工作区，加载第一个工作区的频道和消息
    if len(Workspaces) > 0:
        # 查第一个工作区的所有频道
        Channels = Channel.query.filter_by(wid = Workspaces[0].id).all()
        print(Workspaces[0].id)  # 调试用：打印第一个工作区ID
        # 统计第一个工作区的频道数量
        ChannelCount = Channel.query.filter_by(wid = Workspaces[0].id).count()
        print(Channels)  # 调试用：打印频道列表
        
        # 6. 如果有频道，加载第一个频道的所有聊天记录
        if ChannelCount > 0:
            chats = Chats.query.filter_by(wid = Workspaces[0].id, channel_id = Channels[0].id).all()
            chatscount = len(chats)  # 消息数量
            print(chatscount, "chatscount")  # 调试用：打印消息数量
            
            # 7. 渲染聊天页，传入所有数据（前端模板用这些数据显示内容）
            return render_template('/views/base.html', 
                                   workspace = Workspaces, 
                                   count = count, 
                                   channels = Channels, 
                                   channelCount = ChannelCount,
                                   username = username, 
                                   chats= chats, 
                                   chatscount = chatscount, 
                                   image = user.image)
    
    # 8. 如果没有工作区/频道，仍渲染聊天页（只是数据为空）
    return render_template('/views/base.html', 
                           workspace = Workspaces, 
                           count = count, 
                           channelCount = ChannelCount, 
                           username = username, 
                           chatscount = chatscount, 
                           image = user.image)

"""
核心逻辑：
先获取当前登录用户，加载该用户的所有「工作区」（比如聊天空间）；
优先加载第一个工作区的所有「频道」（聊天房间）；
再加载第一个频道的所有「聊天记录」（文字 / 图片消息）；
把所有数据传给 base.html 模板，前端根据这些数据渲染聊天界面（显示工作区、频道、历史消息）；
如果用户没有任何工作区 / 频道，也会返回聊天页，只是页面上没有数据（空界面）。
"""
