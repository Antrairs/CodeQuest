#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."
DIR=/opt/oracle/oradata/codequest_backup
BACKUPS=backend/data/backups
DUMP=codequest_baseline.dmp

sql() {
    docker exec -i -e ORACLE_PDB_SID=FREEPDB1 ora-free sqlplus -s / as sysdba
}
pump() {
    docker exec -e ORACLE_PDB_SID=FREEPDB1 ora-free "$1" '"/ as sysdba"' "${@:2}" \
        SCHEMAS=CODEQUEST DIRECTORY=CODEQUEST_BACKUP DUMPFILE="$DUMP"
}

case "${1:-}" in
    backup)
        docker exec -u oracle ora-free mkdir -p "$DIR"
        sql <<SQL
WHENEVER SQLERROR EXIT SQL.SQLCODE
CREATE OR REPLACE DIRECTORY CODEQUEST_BACKUP AS '$DIR';
EXIT;
SQL
        pump expdp LOGFILE=codequest_baseline_export.log
        mkdir -p "$BACKUPS"
        docker cp "ora-free:$DIR/$DUMP" "$BACKUPS/"
        docker cp "ora-free:$DIR/codequest_baseline_export.log" "$BACKUPS/"
        chmod 600 "$BACKUPS/$DUMP" "$BACKUPS/codequest_baseline_export.log"
        echo "基准备份已保存：$BACKUPS/$DUMP"
        ;;
    restore)
        test -s "$BACKUPS/$DUMP" || { echo '请先执行 bun run backup'; exit 1; }
        PASSWORD=$(bun --env-file .env -e '
const password = process.env.ORACLE_PASSWORD;
if (!password || /["\r\n]/.test(password)) throw new Error("检查 .env 的 ORACLE_PASSWORD：不能为空或含双引号、换行");
console.log(password);
')
        docker cp "$BACKUPS/$DUMP" "ora-free:$DIR/$DUMP"
        docker exec -u root ora-free chown oracle "$DIR/$DUMP"
        # 先读取备份生成 DDL，成功后才删除 schema。
        pump impdp SQLFILE=codequest_check.sql LOGFILE=codequest_check.log
        docker exec ora-free grep -q 'CREATE TABLE "CODEQUEST"' "$DIR/codequest_check.sql"
        sql <<SQL
WHENEVER SQLERROR EXIT SQL.SQLCODE
SET DEFINE OFF
BEGIN
    FOR s IN (SELECT sid, serial# FROM v\$session WHERE username = 'CODEQUEST') LOOP
        EXECUTE IMMEDIATE 'ALTER SYSTEM DISCONNECT SESSION ''' || s.sid || ',' || s.serial# || ''' IMMEDIATE';
    END LOOP;
END;
/
DROP USER CODEQUEST CASCADE;
CREATE USER CODEQUEST IDENTIFIED BY "$PASSWORD"
    DEFAULT TABLESPACE USERS TEMPORARY TABLESPACE TEMP QUOTA UNLIMITED ON USERS;
GRANT CREATE SESSION, CREATE TABLE, CREATE SEQUENCE, CREATE TRIGGER, CREATE PROCEDURE TO CODEQUEST;
EXIT;
SQL
        pump impdp EXCLUDE=USER LOGFILE=codequest_restore.log
        echo '已恢复基准备份。运行 bun run dev，并重新登录。'
        ;;
    *) echo '用法：bun run backup 或 bun run reset'; exit 1 ;;
esac
