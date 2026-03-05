# IN1 💬

### A playful personalized chat experience

<img alt="Flask" src="https://img.shields.io/badge/flask-%23000.svg?&style=for-the-badge&logo=flask&logoColor=white"/><img alt="HTML5" src="https://img.shields.io/badge/html5-%23E34F26.svg?&style=for-the-badge&logo=html5&logoColor=white"/><img alt="CSS3" src="https://img.shields.io/badge/css3-%231572B6.svg?&style=for-the-badge&logo=css3&logoColor=white"/><img alt="JavaScript" src="https://img.shields.io/badge/javascript-%23323330.svg?&style=for-the-badge&logo=javascript&logoColor=%23F7DF1E"/><img alt="SQLite" src ="https://img.shields.io/badge/sqlite-%2307405e.svg?&style=for-the-badge&logo=sqlite&logoColor=white"/>

A lightweight web chat where conversations are not just messages — they’re **designed**.

---

# ✨ Introduction

IN1 is a lightweight web chat application that explores **personalized social interaction on top of basic messaging features**.

Beyond normal messaging, IN1 asks a small but fun question:

> What if every friendship looked a little different?

The system supports common chat functions such as **user registration, adding friends, private conversations, and sending text or image messages**. But it also introduces playful customization — users can assign **friend-specific avatars and chat bubbles**, making every conversation visually unique.

You can even open the **chat with yourself** and role-play both sides of the conversation — a surprisingly fun way to test ideas, simulate conversations, or just be a little chaotic.

IN1 is designed as a simple experimental project exploring how **visual identity and customization can reshape everyday chatting**.

---

# 🚀 Features

### 💬 Basic Chat Functions

* User registration and login
* Add and manage friends
* One-to-one private messaging
* Send **text messages**
* Send **image messages**
* Edit **friend remarks / nicknames**

---

### 🎨 Personalized Social Features

**Friend-specific avatars**

You can set **different avatars for different friends**, allowing each relationship to have its own visual identity.

---

**Custom chat bubbles**

Users can upload or draw images and use them as **custom chat bubbles for specific friends**.

Each friend can have **their own bubble style**, and once uploaded the bubble is stored and reused automatically in future conversations.

The bubbles support **9-slice scaling**, so they can stretch naturally while keeping corners intact.

---

**Self-chat roleplay mode**

The app naturally includes a **chat with yourself**.

Inside this conversation, you can simulate both sides of the dialogue — sending messages from the left and the right — allowing simple **role-play conversations, testing dialogue, or creative experimentation**.

---

# 🧱 Tech Stack

### Backend

* Python
* Flask
* Flask-SocketIO
* SQLite
* WebSocket (real-time messaging)

### Frontend

* HTML
* CSS
* JavaScript

### Tools

* Git
* GitHub

---

# ▶️ How to Run Locally

1. Clone repository

```
git clone https://github.com/bywhdzrngly/IN1.git
cd IN1
```

2. Install dependencies

```
pip install -r requirements.txt
```

3. Run

```
python main.py
```

4. Open in browser

```
http://localhost:5000
```

### Access from other devices (same WiFi)

If multiple devices are connected to the **same WiFi network**, they can access the chat server running on your computer.

Steps:

1. Run the project on your computer normally.
2. Find your **local IP address** (for example `192.168.1.12`).
3. Other devices on the same WiFi can open the site using:

```
http://YOUR_LOCAL_IP:5000
```

Example:

```
http://192.168.1.12:5000
```

This allows friends in the **same network (same router / same WiFi)** to join the chat and communicate with each other in real time.

---

# 📂 Project Structure

```text
IN1/
|-- main.py
|-- requirements.txt
|-- environment.yml
|-- Procfile
|-- LICENSE.md
|-- readme.md
|-- draft.md
|-- uploads/
|   `-- bubbles/
`-- website/
	|-- __init__.py
	|-- auth.py
	|-- views.py
	|-- db.sqlite
	|-- static/
	|   |-- css/
	|   |   `-- style.css
	|   |-- images/
	|   `-- js/
	|       |-- api.js
	|       |-- auth.js
	|       |-- chat.js
	|       |-- friend.js
	|       |-- main.js
	|       |-- socket.js
	|       `-- state.js
	`-- templates/
		`-- index.html
```


---

# 🔮 Future Improvements

* Deploy on a **cloud server**
* Use **Docker** for easier deployment
* Configure a **custom domain**
* Add **group chat**
* Add **audio and document sharing**
* Add **message reactions**

---

# 👨‍💻 Authors

- [Yinuo Chen](https://github.com/chaocyndrome)
- [Qiming Zhang](https://github.com/sherry-lee-23)
- [Jiayi Zhou](https://github.com/bywhdzrngly)

---

# 📸 Screenshots

Add screenshots here to showcase the UI.

```
![login](screenshots/login.png)

![chat](screenshots/chat.png)

![bubble](screenshots/bubble.png)
```

---

⭐ If you find this project interesting, feel free to star the repository!
