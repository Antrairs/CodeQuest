# CodeQuest Python

面向 Python 初学者的在线练习网站 MVP。

第一版闭环：

- Django Admin 管理分类、题目和测试用例
- 用户注册、登录、退出
- 前端浏览题库和题目详情
- Pyodide 在 Web Worker 中运行 Python，避免死循环阻塞页面
- 自定义输入运行代码，不保存记录
- 正式提交时前端逐个运行测试用例并判题
- 后端保存提交记录，失败题进入错题本，通过后标记为已掌握

## 项目结构

```text
backend/
  config/
  apps/
    users/
    problems/
    submissions/
frontend/
  src/
    api/
    components/
    lib/
    pages/
    workers/
```

## 本地启动

后端使用 Oracle，所有业务继续通过 Django ORM 访问。先启动 Oracle 容器，确保
`CODEQUEST_LAB` 用户可以连接 `FREEPDB1`，并具备 Django 迁移所需的建表权限。
连接使用 python-oracledb Thin 模式，无需安装 Oracle Client。

在项目根目录的本地 `.env` 中配置以下参数（已有文件直接补充，不覆盖）：

```dotenv
ORACLE_USER=CODEQUEST_LAB
ORACLE_PASSWORD=填写本地数据库密码
ORACLE_HOST=127.0.0.1
ORACLE_PORT=1521
ORACLE_SERVICE=FREEPDB1
DJANGO_DEBUG=True
```

密码不提交到仓库。Oracle 与原 SQLite 文件的数据独立，不导入旧数据。
本地 HTTP 开发使用 `DJANGO_DEBUG=True`；部署时关闭并使用 HTTPS。

后端：

```bash
cd backend
uv run --env-file ../.env python manage.py migrate
uv run --env-file ../.env python manage.py createsuperuser
uv run --env-file ../.env python manage.py runserver
```

前端：

```bash
cd frontend
bun install
bun run dev
```

也可以在项目根目录运行 `bun run migrate` 初始化 Oracle 表，运行 `bun run csu`
创建管理员，再运行 `bun run dev` 同时启动前后端。迁移复用现有 Django migrations。

访问：

- 前端：http://localhost:5173
- Django Admin：http://localhost:8000/admin/

前端开发服务器已把 `/api` 代理到 `http://localhost:8000`。首次运行 Python 代码时，浏览器会从 Pyodide CDN 加载运行时。

## 录题流程

1. 进入 Django Admin。
2. 创建 `Category`。
3. 创建 `Problem`，填写题目描述、输入输出说明、示例、初始代码和解析。
4. 在 Problem 页面内联添加 `TestCase`。
5. 至少添加一个测试用例，并将题目 `is_published` 勾选为发布。

公开测试用例用于页面展示。第一版允许前端获取全部测试用例完成判题，不做隐藏测试点防作弊。

## 验证命令

后端：

```bash
cd backend
uv run --env-file ../.env python manage.py check
uv run --env-file ../.env python manage.py test
```

前端：

```bash
cd frontend
bun run lint
bun run build
```

## MVP 验收路径

管理员在 Django Admin 创建并发布题目后，用户可以注册登录，进入题库，打开题目练习页，输入 Python 代码并点击“运行代码”查看 stdout 或错误。点击“提交代码”后，前端使用该题测试用例判题，展示通过数量，并把正式提交保存到后端。未通过题会进入错题本；再次提交通过后，该错题会标记为已掌握。
