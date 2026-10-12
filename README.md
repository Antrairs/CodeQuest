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

## 演示数据备份与恢复

先运行 `backend/oracle/seed_demo.sql` 初始化演示数据，并确认前端展示符合预期。
停止后端后，在项目根目录执行：

```bash
bun run backup   # 保存当前 CODEQUEST schema 为基准，不覆盖已有备份
bun run reset    # 删除并重建 CODEQUEST，恢复基准备份
bun run dev
```

脚本使用 `ora-free` 容器中的 `FREEPDB1`，本地备份保存在
`backend/data/backups/codequest_baseline.dmp`。数据库密码读取本地 `.env`；
Data Pump 使用容器内管理员认证，避免密码中的 `@` 被解析成连接地址。
恢复前关闭后端和 CODEQUEST 的 SQL 客户端，脚本先校验备份可读取，再重建用户。
恢复会清除基准备份之后的全部数据库修改；上传图片不在备份中。
恢复后重新登录；基准中的活动起止时间也原样恢复。
若导入失败，基准备份仍保留，查看容器备份目录中的 `codequest_restore.log`；
修复错误后重新执行 `bun run reset`，不要启动后端继续写入不完整的数据。

## 录题流程

1. 进入 Django Admin。
2. 创建 `Category`。
3. 创建 `Problem`，填写题目描述、输入输出说明、示例、初始代码和解析。
4. 在 Problem 页面内联添加 `TestCase`。
5. 至少添加一个测试用例，并将题目 `is_published` 勾选为发布。

公开测试用例用于页面展示。第一版允许前端获取全部测试用例完成判题，不做隐藏测试点防作弊。

## 验证命令

### 演示 SQL 日志

本地 `.env` 设置 `DJANGO_DEBUG=True` 后，运行 `bun run dev`，在后端终端查看
`[SQL]` 日志：

| 前端操作 | 打印的 SQL |
| --- | --- |
| 登录后进入题目答题页，点击“提交代码” | 新增提交记录的 `INSERT` |
| 提交失败，且该题首次进入错题本 | 新增错题记录的 `INSERT`，以及增加错误次数的 `UPDATE` |
| 再次提交失败 | 更新错误次数和未解决状态的 `UPDATE` |
| 提交通过 | 将已有错题标记为已解决的 `UPDATE`；即使没有错题记录，也会执行这条更新语句 |
| 登录后点击导航中的“我的练习”，或刷新 `/practice-log` 页面 | 统计练习题数、通过题数的聚合 `SELECT`，每次请求打印一次 |

浏览或筛选题库、点击“运行代码”、查看错题本和活动，不触发演示 SQL 打印。
“运行代码”仅在浏览器中执行 Python，不保存提交记录。

日志是 ORM 实际执行的 SQL，保留参数占位符，不打印参数值；
不输出分页计数、Session 等辅助查询。关闭 DEBUG 后不打印。
