#!/bin/bash
set -e
cd ~ || exit

run_db_cli() {
  local host="$1"
  local port="$2"
  local user="$3"
  local pass="$4"
  shift 4

  if command -v mariadb >/dev/null 2>&1; then
    mariadb --protocol=tcp --host "$host" --port "$port" -u "$user" "-p$pass" "$@"
  else
    mysql --protocol=tcp --host "$host" --port "$port" -u "$user" "-p$pass" "$@"
  fi
}

wait_for_mariadb() {
  local retries="${1:-60}"
  local delay="${2:-2}"
  local i
  for i in $(seq 1 "$retries"); do
    if run_db_cli 127.0.0.1 3306 root travis -e "SELECT 1" >/dev/null 2>&1; then
      echo "MariaDB is ready"
      return 0
    fi
    echo "Waiting for MariaDB ($i/$retries)..."
    sleep "$delay"
  done
  echo "MariaDB did not become ready in time" >&2
  return 1
}

run_sql_with_retry() {
  local sql="$1"
  local retries="${2:-10}"
  local delay="${3:-2}"
  local i
  for i in $(seq 1 "$retries"); do
    if run_db_cli 127.0.0.1 3306 root travis -e "$sql"; then
      return 0
    fi
    echo "Retry SQL ($i/$retries): $sql"
    sleep "$delay"
  done
  echo "Failed SQL after retries: $sql" >&2
  return 1
}

echo "::group::Install Bench"
pip install frappe-bench
echo "::endgroup::"

echo "::group::Init Bench"
bench -v init frappe-bench --skip-assets --python "$(which python)" --frappe-path "${GITHUB_WORKSPACE}"
cd ./frappe-bench || exit

bench -v setup requirements --dev
if [ "$TYPE" == "ui" ]
then
  bench -v setup requirements --node;
fi
echo "::endgroup::"

echo "::group::Create Test Site"
mkdir ~/frappe-bench/sites/test_site
cp "${GITHUB_WORKSPACE}/.github/helper/db/$DB.json" ~/frappe-bench/sites/test_site/site_config.json

if [ "$DB" == "mariadb" ]
then
  wait_for_mariadb

  run_sql_with_retry "SET GLOBAL character_set_server = 'utf8mb4'"
  run_sql_with_retry "SET GLOBAL collation_server = 'utf8mb4_unicode_ci'"

  run_sql_with_retry "CREATE DATABASE IF NOT EXISTS test_frappe"
  run_sql_with_retry "CREATE USER IF NOT EXISTS 'test_frappe'@'localhost' IDENTIFIED BY 'test_frappe'"
  run_sql_with_retry "GRANT ALL PRIVILEGES ON \`test_frappe\`.* TO 'test_frappe'@'localhost'"
  run_sql_with_retry "FLUSH PRIVILEGES"
fi
if [ "$DB" == "postgres" ]
then
  echo "travis" | psql -h 127.0.0.1 -p 5432 -c "CREATE DATABASE test_frappe" -U postgres;
  echo "travis" | psql -h 127.0.0.1 -p 5432 -c "CREATE USER test_frappe WITH PASSWORD 'test_frappe'" -U postgres;
fi
echo "::endgroup::"

echo "::group::Modify processes"
sed -i 's/^watch:/# watch:/g' Procfile
sed -i 's/^schedule:/# schedule:/g' Procfile

if [ "$TYPE" == "server" ]
then
  sed -i 's/^socketio:/# socketio:/g' Procfile
  sed -i 's/^redis_socketio:/# redis_socketio:/g' Procfile
fi

if [ "$TYPE" == "ui" ]
then
  sed -i 's/^web: bench serve/web: bench serve --with-coverage/g' Procfile
fi
echo "::endgroup::"

bench start &> ~/frappe-bench/bench_start.log &

echo "::group::Install site"
if [ "$TYPE" == "server" ]
then
  CI=Yes bench build --app frappe &
  build_pid=$!
fi

bench --site test_site reinstall --yes

if [ "$TYPE" == "server" ]
then
  # wait till assets are built succesfully
  wait $build_pid
fi
echo "::endgroup::"
