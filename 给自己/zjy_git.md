# 🧭 GameJam 团队 Git 协作完整流程指南（建议保存）

> 适用于：Unity 项目 / 多人协作 / 有 dev 分支
> 远端仓库示例：
> `https://github.com/bywhdzrngly/tuna-gamejam.git`

---

## 一、第一次使用（Clone 仓库 & 切到 dev）

```bash
# 1. 切到你想放项目的位置
D:
cd D:\UnityProjects

# 2. 克隆仓库（只需做一次）
git clone https://github.com/bywhdzrngly/tuna-gamejam.git

cd tuna-gamejam

# 3. 获取远端信息并切到 dev
git fetch
git switch dev
```

📌 **基本原则**

* `dev` = 团队公共开发线
* ❌ 不在 dev 上直接写功能
* ✅ 从 dev 拉出自己的功能分支再开发

---

## 二、每天开始工作前（必须做）

```bash
git switch dev
git pull origin dev
```

📌 作用：

* 确保你本地的 `dev` 是**最新的**
* 避免后面 PR / 合并时产生不必要的冲突

---

## 三、创建你的功能分支（一个功能一个分支）

```bash
# 推荐新命令
git switch -c feature/你的名字-功能描述
# 例：
git switch -c feature/jiayi-start-ui
```

（等价老命令）

```bash
git checkout -b feature/jiayi-start-ui
```

📌 **规则**

* 每个功能 / 模块一个分支
* 功能没完成，不合进 dev

---

## 四、开发中常用命令（本地保存进度）

```bash
git add .
git commit -m "feat: start UI click to next image"
```

### 提交信息类型建议（统一风格）

* `feat:` 新功能
* `fix:` 修 bug
* `docs:` 文档
* `asset:` 美术 / 音频资源
* `chore:` 构建 / 配置 / 杂项

---

## 五、推送你的分支到远端（第一次要 -u）

```bash
git push -u origin feature/jiayi-start-ui
```

📌 之后只需要：

```bash
git push
```

---

## 六、在 GitHub 上发 Pull Request（PR）

* Base：`dev`
* Compare：`feature/xxx`
* 写清楚你做了什么
* 至少让一位队友看过

✅ **推荐合并方式**：
**Squash and Merge**

> 目的：保证 dev 的 commit 历史干净、清晰

---

## ⭐ 重要情境：队友 PR 已合并，但我正在自己分支开发，怎么办？

### ✅ 正确做法（强烈推荐）

> **不要在 dev 上直接继续写代码**

#### 1️⃣ 先保存你当前分支的工作

```bash
git add .
git commit -m "wip: current progress"
```

#### 2️⃣ 更新 dev

```bash
git switch dev
git pull origin dev
```

#### 3️⃣ 把最新 dev 同步到你的分支

```bash
git switch feature/jiayi-start-ui
git rebase dev
```

📌 结果：

* 你的分支基于 **最新 dev**
* commit 历史更线性、PR 更好看

#### 如果 rebase 冲突了：

```bash
git status
# 手动解决冲突文件

git add 冲突文件
git rebase --continue
```

❌ 如果发现搞乱了：

```bash
git rebase --abort
```

---

## 七、merge vs rebase（什么时候用）

### ✔ 推荐场景

* **个人分支同步 dev → 用 rebase**
* **团队通过 GitHub PR → merge（由 GitHub 处理）**

```bash
git rebase dev
```

❌ **禁止操作**

* 在 `dev` 上 rebase
* rebase 已经 push 给别人的公共分支

---

## 八、切分支的注意事项（非常重要）

> 切分支前，**工作区必须是干净的**

### 查看状态

```bash
git status
```

### 推荐做法

* 要么先 `commit`
* 要么用 `git stash`（进阶，用得不熟可以先不用）

### 不推荐但安全的土办法

> 复制改过的文件 → reset 当前分支 → 切分支 → 复制回来

---

## 九、合并完成后的本地清理（可选）

```bash
git switch dev
git pull origin dev

# 删除本地功能分支（确认已合并后）
git branch -d feature/jiayi-start-ui
```

---

## 十、撤销 / 后悔药合集

### 查看当前状态

```bash
git status      # 当前状态
git diff        # 未暂存的修改
git log --oneline  # 提交历史（简洁）
```

### 放弃修改（未 git add）

```bash
git restore 文件名
# 或老命令
git checkout 文件名
```

### 取消 git add

```bash
git reset 文件名
```

### 撤销 commit（⚠ 只在自己分支）

```bash
git reset --soft HEAD~1   # 撤销 commit，保留修改
git reset --hard HEAD~1   # 连文件一起删（危险）
# 这里的 1 可以换成 2、3，表示回退几个 commit
```

### 已 push 的 commit（公共分支禁止）

```bash
# 使用 revert：通过一个“反向提交”来撤销
git revert HEAD
git push
```

> 优点：
>
> * 可以撤销任意 commit
> * 已 push 到公共分支（如 dev）也安全

---

## 十一、忽略文件（.gitignore，强烈建议一开始就有）

在仓库根目录创建 `.gitignore`

```bash
# Windows 可手动新建该文件
touch .gitignore
```

示例内容：

```gitignore
# Python 虚拟环境
venv/

# 编译缓存
__pycache__/

# 日志文件
*.log

# macOS 系统文件
.DS_Store
```

```bash
git add .gitignore
git commit -m "chore: add gitignore rules"
```

📌 之后 Git 会自动忽略这些文件，不会被提交或出现在 `git status` 中。

---

## 十二、没有写权限怎么办？

* Fork 仓库
* 在自己 Fork 中建分支
* Push 到自己的仓库
* 向原仓库发 PR

---

## ✅ 一句话总结（给新人）

> **dev 只 pull，不直接写代码**
> **一个功能 = 一个分支**
> **PR 前先更新 dev**



### 一、VS Code 终端执行（推荐）
1. 打开 VS Code 终端（快捷键 `Ctrl + ``），先同步远端仓库的最新分支信息：
```bash
git fetch origin
```
2. 创建并切换到 `feature/zqm-avatar` 分支（`-c` = `--create`，即创建新分支）：
```bash
# 核心指令：基于远端 origin/feature/zqm-avatar 创建并切换本地同名分支
git switch -c feature/zqm-avatar origin/feature/zqm-avatar
```
3. 如果本地已有该分支，仅需切换并拉取最新代码：
```bash
# 先切换到该分支
git switch feature/zqm-avatar
# 拉取远端最新代码
git pull origin feature/zqm-avatar
```
