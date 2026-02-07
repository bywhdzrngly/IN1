## 🧭 Git4Unity 团队协作标准流程（GameJam 稳定版）

---

## **STEP 1 — 由 1 人创建 Unity 项目（仅此一人）**

### ① Unity Hub 新建项目

* Unity Hub → New Project
* 模板任选（2D / 3D）
* 项目名：`tuna-gamejam`（示例）
* 路径选择一个**空文件夹**

### ② 打开项目后立刻关闭 Unity（重要）

目的：

* 避免 Unity 自动生成 `Library / Temp / Logs`
* 保证 Git 首次提交**干净、可控**

---

## **STEP 2 — 创建 `.gitignore`（⚠ 必须在 git add 前完成）**

### ✅ 推荐方式（官方）

使用 GitHub 官方 Unity 模板：

👉 [https://github.com/github/gitignore/blob/main/Unity.gitignore](https://github.com/github/gitignore/blob/main/Unity.gitignore)

操作步骤：

1. 用 VS Code 打开项目根目录
2. 新建文件：`.gitignore`
3. 粘贴官方 Unity.gitignore 内容
4. 保存

❗ **原则**：

> `.gitignore` 必须在第一次 `git add .` 之前完成
> 否则被提交的文件不会自动移除

---

## **STEP 3 — 创建 GitHub 仓库（空仓库）**

GitHub → New Repository：

| 选项              | 设置               |
| --------------- | ---------------- |
| Repository name | tuna-gamejam     |
| Visibility      | Public / Private |
| README          | ❌ 不要             |
| License         | ❌ 不要             |
| .gitignore      | ❌ 不要             |

---

## **STEP 4 — 初始化 Git 并推送（项目创建者）**

在 Unity 项目根目录执行：

```bash
git init
git add .
git commit -m "chore: initial Unity project"
git branch -M main
git remote add origin <仓库地址>
git push -u origin main
```

---

## **STEP 5 —（推荐）创建 dev 分支**

由项目创建者执行一次：

```bash
git checkout -b dev
git push -u origin dev
```

### 分支约定：

* `main`：最终版本（只合并，不开发）
* `dev`：团队开发主线
* `feature/*`：个人功能分支

---

## **STEP 6 — 其他队友 Clone 项目**

```bash
git clone <仓库地址>
```

然后：

* Unity Hub → Open → 选择该文件夹

---

## 🔐 Git 基础配置（只需一次）

```bash
git config --global user.name "YourName"
git config --global user.email "your@email.com"
```

生成 SSH Key：

```bash
ssh-keygen -t rsa -C "your@email.com"
```

查看公钥（添加到 GitHub）：

```bash
cat ~/.ssh/id_rsa.pub
```
