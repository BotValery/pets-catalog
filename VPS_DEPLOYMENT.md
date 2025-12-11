# Инструкция по развертыванию на виртуальном сервере (VPS)

## Содержание
1. [Требования к серверу](#требования-к-серверу)
2. [Подготовка сервера](#подготовка-сервера)
3. [Установка Node.js](#установка-nodejs)
4. [Загрузка проекта](#загрузка-проекта)
5. [Настройка приложения](#настройка-приложения)
6. [Запуск приложения](#запуск-приложения)
7. [Настройка веб-сервера](#настройка-веб-сервера)
8. [Настройка SSL (HTTPS)](#настройка-ssl-https)
9. [Настройка автозапуска](#настройка-автозапуска)
10. [Мониторинг и обслуживание](#мониторинг-и-обслуживание)
11. [Решение проблем](#решение-проблем)

---

## Требования к серверу

### Минимальные требования:
- **ОС:** Ubuntu 20.04+ / Debian 11+ / CentOS 8+ / AlmaLinux 8+ / Rocky Linux 8+
- **RAM:** минимум 1GB (рекомендуется 2GB+)
- **Диск:** минимум 10GB свободного места
- **Процессор:** 1 ядро (рекомендуется 2+)
- **Сеть:** статический IP-адрес
- **Домен:** привязанный к IP-адресу сервера (опционально, но рекомендуется)

### Программное обеспечение:
- **Node.js:** версия 16.0.0 или выше (рекомендуется 18+ LTS)
- **npm:** версия 7.0.0 или выше
- **PM2:** для управления процессами Node.js
- **Nginx** или **Apache:** веб-сервер для проксирования
- **Git:** для загрузки проекта (опционально)

---

## Подготовка сервера

### 1. Подключение к серверу

Подключитесь к серверу по SSH:
```bash
ssh username@your-server-ip
```

Если используете ключ SSH:
```bash
ssh -i /path/to/private-key username@your-server-ip
```

### 2. Обновление системы

**Для Ubuntu/Debian:**
```bash
sudo apt update
sudo apt upgrade -y
```

**Для CentOS/RHEL 8+, AlmaLinux, Rocky Linux:**
```bash
sudo dnf update -y
# или для старых версий CentOS 7:
sudo yum update -y
```

### 3. Установка базовых утилит

**Для Ubuntu/Debian:**
```bash
sudo apt install -y curl wget git build-essential
```

**Для CentOS/RHEL 8+, AlmaLinux, Rocky Linux:**
```bash
sudo dnf install -y curl wget git gcc-c++ make
# или для CentOS 7:
sudo yum install -y curl wget git gcc-c++ make
```

### 4. Настройка файрвола

**Для Ubuntu/Debian (ufw):**
```bash
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw enable
sudo ufw status
```

**Для CentOS/RHEL (firewalld):**
```bash
sudo firewall-cmd --permanent --add-service=ssh
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https
sudo firewall-cmd --reload
sudo firewall-cmd --list-all
```

**Для CentOS/RHEL (iptables, если firewalld не используется):**
```bash
sudo iptables -A INPUT -p tcp --dport 22 -j ACCEPT   # SSH
sudo iptables -A INPUT -p tcp --dport 80 -j ACCEPT   # HTTP
sudo iptables -A INPUT -p tcp --dport 443 -j ACCEPT  # HTTPS
sudo iptables-save > /etc/iptables/rules.v4
# Или для CentOS 7:
sudo service iptables save
```

---

## Установка Node.js

### Определение дистрибутива

Сначала определите, какой дистрибутив Linux установлен:
```bash
cat /etc/os-release
# или
lsb_release -a
```

### Вариант 1: Установка через nvm (рекомендуется)

NVM (Node Version Manager) позволяет легко управлять версиями Node.js и не требует прав sudo:

```bash
# Установка nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# Перезагрузите терминал или выполните:
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# Установка Node.js 18 LTS
nvm install 18
nvm use 18
nvm alias default 18

# Проверка версии
node --version  # Должно показать v18.x.x или выше
npm --version
```

**Важно:** Добавьте nvm в автозагрузку, добавив в `~/.bashrc` или `~/.profile`:
```bash
echo 'export NVM_DIR="$HOME/.nvm"' >> ~/.bashrc
echo '[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"' >> ~/.bashrc
echo '[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"' >> ~/.bashrc
source ~/.bashrc
```

### Вариант 2: Установка через NodeSource (требует sudo)

**Для Ubuntu/Debian:**
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
# или
sudo apt install -y nodejs
```

**Для CentOS/RHEL 7:**
```bash
curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
sudo yum install -y nodejs
```

**Для CentOS/RHEL 8+, AlmaLinux, Rocky Linux:**
```bash
curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
sudo dnf install -y nodejs
```

**Проверка установки:**
```bash
node --version
npm --version
```

### Вариант 3: Установка из репозитория дистрибутива (не рекомендуется)

**Для Ubuntu/Debian:**
```bash
sudo apt install -y nodejs npm
```

**Для CentOS/RHEL:**
```bash
sudo dnf install -y nodejs npm
# или для CentOS 7:
sudo yum install -y nodejs npm
```

⚠️ **Внимание:** Версия Node.js в репозиториях может быть устаревшей. Используйте nvm или NodeSource для получения актуальной версии.

---

## Загрузка проекта

### Вариант 1: Через Git (рекомендуется)

```bash
# Создайте директорию для проекта
sudo mkdir -p /var/www/pets-platform
sudo chown $USER:$USER /var/www/pets-platform

# Перейдите в директорию
cd /var/www/pets-platform

# Клонируйте репозиторий
git clone https://your-repository-url.git .

# Или если репозиторий приватный, используйте SSH:
# git clone git@github.com:username/repository.git .
```

### Вариант 2: Через SCP/SFTP

С вашего локального компьютера:
```bash
# Создайте архив проекта
tar -czf pets-platform.tar.gz /path/to/project

# Загрузите на сервер
scp pets-platform.tar.gz username@your-server-ip:/tmp/

# На сервере распакуйте
ssh username@your-server-ip
sudo mkdir -p /var/www/pets-platform
sudo chown $USER:$USER /var/www/pets-platform
cd /var/www/pets-platform
tar -xzf /tmp/pets-platform.tar.gz --strip-components=1
rm /tmp/pets-platform.tar.gz
```

### Вариант 3: Через веб-интерфейс панели управления

Если у вас есть панель управления (ISPmanager, cPanel, Plesk и т.д.):
1. Зайдите в файловый менеджер
2. Перейдите в директорию сайта
3. Загрузите файлы проекта
4. Распакуйте архив, если необходимо

---

## Настройка приложения

### 1. Установка зависимостей

```bash
cd /var/www/pets-platform
npm install --production
```

Если возникают проблемы с правами доступа:
```bash
npm install --production --unsafe-perm
```

### 2. Создание файла .env

Создайте файл `.env` в корне проекта:
```bash
nano .env
```

Добавьте следующие переменные:
```env
# Обязательно измените на случайную строку!
JWT_SECRET=ваш-случайный-секретный-ключ-минимум-32-символа

# Режим работы
NODE_ENV=production

# Порт приложения
PORT=3000

# URL API (замените на ваш домен или IP)
API_BASE_URL=https://ваш-домен.ru/api
# или если нет домена:
# API_BASE_URL=http://ваш-ip:3000/api
```

**Генерация JWT_SECRET:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Сохраните файл (Ctrl+O, Enter, Ctrl+X в nano).

### 3. Инициализация базы данных

```bash
npm run init-db
```

Это создаст файл `database.sqlite` в корне проекта.

### 4. Настройка прав доступа

```bash
# Убедитесь, что у приложения есть права на запись в директорию
chmod 755 /var/www/pets-platform
chmod 644 /var/www/pets-platform/database.sqlite

# Если нужно, измените владельца
sudo chown -R $USER:$USER /var/www/pets-platform
```

---

## Запуск приложения

### Установка PM2

PM2 - это менеджер процессов для Node.js, который обеспечивает автозапуск и мониторинг приложения.

**Глобальная установка (требует sudo):**
```bash
sudo npm install -g pm2
```

**Установка без sudo (если нет прав администратора):**

Если получаете ошибку `EACCES: permission denied`:

**Вариант A: Изменение директории для глобальных пакетов**
```bash
mkdir ~/.npm-global
npm config set prefix '~/.npm-global'
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.bashrc
source ~/.bashrc
npm install -g pm2
```

**Вариант B: Локальная установка**
```bash
npm install pm2 --save-dev
# Использование через npx:
npx pm2 start server.js --name pets-platform
```

**Проверка установки:**
```bash
pm2 --version
```

### Запуск приложения через PM2

```bash
cd /var/www/pets-platform
pm2 start server.js --name pets-platform
```

### Полезные команды PM2

```bash
pm2 list                    # Список всех процессов
pm2 logs pets-platform      # Просмотр логов
pm2 logs pets-platform --lines 50  # Последние 50 строк
pm2 restart pets-platform   # Перезапуск
pm2 stop pets-platform      # Остановка
pm2 delete pets-platform    # Удаление из списка
pm2 monit                   # Мониторинг в реальном времени
pm2 info pets-platform      # Детальная информация
pm2 save                    # Сохранить список процессов
```

### Проверка работы приложения

```bash
# Проверьте, что приложение запущено
pm2 list

# Проверьте логи
pm2 logs pets-platform

# Проверьте доступность API
curl http://localhost:3000/api/health
# Должен вернуть: {"status":"ok","message":"Server is running"}
```

---

## Настройка веб-сервера

Приложение работает на порту 3000, но для доступа из интернета нужно настроить веб-сервер (Nginx или Apache) для проксирования запросов.

### Вариант A: Настройка Nginx (рекомендуется)

#### 1. Установка Nginx

**Для Ubuntu/Debian:**
```bash
sudo apt install -y nginx
```

**Для CentOS/RHEL:**
```bash
sudo dnf install -y nginx
# или для CentOS 7:
sudo yum install -y nginx
```

#### 2. Запуск и автозапуск Nginx

```bash
sudo systemctl start nginx
sudo systemctl enable nginx
sudo systemctl status nginx
```

#### 3. Создание конфигурации сайта

Создайте файл конфигурации:
```bash
sudo nano /etc/nginx/sites-available/pets-platform
```

**Для Ubuntu/Debian** (используется `sites-available`):
```nginx
server {
    listen 80;
    server_name ваш-домен.ru www.ваш-домен.ru;
    # или если нет домена, используйте IP:
    # server_name ваш-ip-адрес;

    # Лимит размера загружаемых файлов (50MB)
    client_max_body_size 50M;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Таймауты для больших файлов
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Кэширование статических файлов
    location ~* \.(jpg|jpeg|png|gif|ico|css|js|svg|woff|woff2|ttf|eot)$ {
        proxy_pass http://localhost:3000;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
}
```

**Для CentOS/RHEL** (используется `conf.d`):
```bash
sudo nano /etc/nginx/conf.d/pets-platform.conf
```

Добавьте тот же конфиг, что выше.

#### 4. Активация конфигурации (только для Ubuntu/Debian)

```bash
sudo ln -s /etc/nginx/sites-available/pets-platform /etc/nginx/sites-enabled/
```

#### 5. Проверка и перезагрузка Nginx

```bash
# Проверка конфигурации
sudo nginx -t

# Если проверка успешна, перезагрузите Nginx
sudo systemctl reload nginx
```

### Вариант B: Настройка Apache

#### 1. Установка Apache

**Для Ubuntu/Debian:**
```bash
sudo apt install -y apache2
```

**Для CentOS/RHEL:**
```bash
sudo dnf install -y httpd
# или для CentOS 7:
sudo yum install -y httpd
```

#### 2. Включение необходимых модулей

```bash
# Для Ubuntu/Debian
sudo a2enmod proxy
sudo a2enmod proxy_http
sudo a2enmod rewrite
sudo a2enmod headers

# Для CentOS/RHEL
# Модули обычно уже включены, но проверьте:
sudo httpd -M | grep proxy
```

#### 3. Создание конфигурации

**Для Ubuntu/Debian:**
```bash
sudo nano /etc/apache2/sites-available/pets-platform.conf
```

**Для CentOS/RHEL:**
```bash
sudo nano /etc/httpd/conf.d/pets-platform.conf
```

Добавьте конфигурацию:
```apache
<VirtualHost *:80>
    ServerName ваш-домен.ru
    ServerAlias www.ваш-домен.ru
    
    # Лимит размера загружаемых файлов (50MB)
    LimitRequestBody 52428800

    ProxyPreserveHost On
    ProxyRequests Off

    <Proxy *>
        Order deny,allow
        Allow from all
    </Proxy>

    ProxyPass / http://localhost:3000/
    ProxyPassReverse / http://localhost:3000/

    <Location />
        Order allow,deny
        Allow from all
    </Location>
    
    # Заголовки для проксирования
    ProxyPassReverse / http://localhost:3000/
    RequestHeader set X-Forwarded-Proto "http"
    RequestHeader set X-Real-IP %{REMOTE_ADDR}s
</VirtualHost>
```

#### 4. Активация сайта (Ubuntu/Debian)

```bash
sudo a2ensite pets-platform.conf
```

#### 5. Перезагрузка Apache

```bash
# Для Ubuntu/Debian
sudo systemctl reload apache2

# Для CentOS/RHEL
sudo systemctl reload httpd
```

---

## Настройка SSL (HTTPS)

Для безопасности рекомендуется использовать HTTPS. Самый простой способ - использовать бесплатный сертификат Let's Encrypt.

### Установка Certbot

**Для Ubuntu/Debian:**
```bash
sudo apt install -y certbot python3-certbot-nginx
# или для Apache:
sudo apt install -y certbot python3-certbot-apache
```

**Для CentOS/RHEL 8+, AlmaLinux, Rocky Linux:**
```bash
sudo dnf install -y certbot python3-certbot-nginx
# или для Apache:
sudo dnf install -y certbot python3-certbot-apache
```

**Для CentOS/RHEL 7:**
```bash
sudo yum install -y epel-release
sudo yum install -y certbot python3-certbot-nginx
# или для Apache:
sudo yum install -y certbot python3-certbot-apache
```

### Получение SSL сертификата

**Для Nginx:**
```bash
sudo certbot --nginx -d ваш-домен.ru -d www.ваш-домен.ru
```

**Для Apache:**
```bash
sudo certbot --apache -d ваш-домен.ru -d www.ваш-домен.ru
```

Certbot автоматически:
- Получит сертификат
- Настроит веб-сервер для использования HTTPS
- Настроит автоматическое обновление сертификата

### Автоматическое обновление сертификата

Certbot автоматически настраивает cron-задачу для обновления сертификата. Проверить можно командой:
```bash
sudo certbot renew --dry-run
```

### Обновление конфигурации приложения

После настройки HTTPS обновите `.env`:
```env
API_BASE_URL=https://ваш-домен.ru/api
```

---

## Настройка автозапуска

### Настройка автозапуска PM2

PM2 должен автоматически запускать приложение после перезагрузки сервера:

```bash
# Настройка автозапуска
pm2 startup

# Выполните команду, которую выведет PM2 (обычно с sudo)
# Пример вывода:
# sudo env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u username --hp /home/username

# Сохраните список процессов
pm2 save
```

### Проверка автозапуска

```bash
# Перезагрузите сервер
sudo reboot

# После перезагрузки проверьте
pm2 list
# Приложение должно быть запущено автоматически
```

---

## Мониторинг и обслуживание

### Просмотр логов

```bash
# Логи приложения
pm2 logs pets-platform
pm2 logs pets-platform --lines 100  # Последние 100 строк

# Логи веб-сервера
# Для Nginx:
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log

# Для Apache:
sudo tail -f /var/log/apache2/access.log
sudo tail -f /var/log/apache2/error.log
# или для CentOS/RHEL:
sudo tail -f /var/log/httpd/access_log
sudo tail -f /var/log/httpd/error_log
```

### Мониторинг ресурсов

```bash
# Статистика PM2
pm2 monit

# Использование ресурсов системы
htop
# или
top
```

### Резервное копирование

Создайте скрипт для автоматического резервного копирования:

```bash
nano /var/www/pets-platform/backup.sh
```

Добавьте содержимое:
```bash
#!/bin/bash
BACKUP_DIR="/var/backups/pets-platform"
DATE=$(date +%Y%m%d_%H%M%S)
PROJECT_DIR="/var/www/pets-platform"

# Создаем директорию для бэкапов
mkdir -p "$BACKUP_DIR"

# Копируем базу данных
cp "$PROJECT_DIR/database.sqlite" "$BACKUP_DIR/database_$DATE.sqlite"

# Удаляем старые бэкапы (старше 30 дней)
find "$BACKUP_DIR" -name "database_*.sqlite" -mtime +30 -delete

echo "Backup completed: database_$DATE.sqlite"
```

Сделайте скрипт исполняемым:
```bash
chmod +x /var/www/pets-platform/backup.sh
```

Настройте cron для автоматического резервного копирования:
```bash
crontab -e
```

Добавьте строку (каждый день в 2:00 ночи):
```
0 2 * * * /var/www/pets-platform/backup.sh >> /var/log/pets-backup.log 2>&1
```

### Обновление приложения

```bash
# 1. Остановите приложение
pm2 stop pets-platform

# 2. Сделайте резервную копию базы данных
cp /var/www/pets-platform/database.sqlite /var/www/pets-platform/database.sqlite.backup

# 3. Обновите код
cd /var/www/pets-platform
git pull
# или загрузите новые файлы через SCP/SFTP

# 4. Установите новые зависимости
npm install --production

# 5. Запустите миграции (если есть)
npm run init-db

# 6. Запустите приложение
pm2 restart pets-platform

# 7. Проверьте логи
pm2 logs pets-platform
```

---

## Решение проблем

### Приложение не запускается

1. **Проверьте логи:**
   ```bash
   pm2 logs pets-platform
   ```

2. **Проверьте переменные окружения:**
   ```bash
   cat /var/www/pets-platform/.env
   ```

3. **Проверьте права доступа:**
   ```bash
   ls -la /var/www/pets-platform/database.sqlite
   chmod 644 /var/www/pets-platform/database.sqlite
   ```

4. **Проверьте, что порт не занят:**
   ```bash
   netstat -tulpn | grep 3000
   # или
   ss -tulpn | grep 3000
   ```

5. **Проверьте версию Node.js:**
   ```bash
   node --version  # Должна быть >= 16.0.0
   ```

### Сайт не открывается

1. **Проверьте, что приложение запущено:**
   ```bash
   pm2 list
   ```

2. **Проверьте конфигурацию веб-сервера:**
   ```bash
   # Для Nginx
   sudo nginx -t
   
   # Для Apache
   sudo apache2ctl configtest
   # или для CentOS/RHEL:
   sudo httpd -t
   ```

3. **Проверьте логи веб-сервера:**
   ```bash
   # Nginx
   sudo tail -f /var/log/nginx/error.log
   
   # Apache
   sudo tail -f /var/log/apache2/error.log
   ```

4. **Проверьте файрвол:**
   ```bash
   # Ubuntu/Debian
   sudo ufw status
   
   # CentOS/RHEL
   sudo firewall-cmd --list-all
   ```

5. **Проверьте доступность приложения локально:**
   ```bash
   curl http://localhost:3000/api/health
   ```

### Ошибки базы данных

1. **Проверьте права доступа:**
   ```bash
   ls -la /var/www/pets-platform/database.sqlite
   chmod 644 /var/www/pets-platform/database.sqlite
   chown $USER:$USER /var/www/pets-platform/database.sqlite
   ```

2. **Проверьте целостность базы:**
   ```bash
   sqlite3 /var/www/pets-platform/database.sqlite "PRAGMA integrity_check;"
   ```

3. **Восстановите из резервной копии:**
   ```bash
   cp /var/www/pets-platform/database.sqlite.backup /var/www/pets-platform/database.sqlite
   ```

### Проблемы с PM2

1. **PM2 не найден:**
   ```bash
   which pm2
   # Если не найден, добавьте в PATH:
   export PATH=~/.npm-global/bin:$PATH
   echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.bashrc
   source ~/.bashrc
   ```

2. **PM2 не запускается после перезагрузки:**
   ```bash
   pm2 startup
   # Выполните команду, которую выведет PM2
   pm2 save
   ```

3. **Ошибка при установке PM2:**
   - Если `EACCES: permission denied`, используйте nvm или измените директорию для глобальных пакетов (см. раздел "Установка PM2")
   - Если `Unsupported engine`, обновите Node.js до версии 16.0.0 или выше

### Проблемы с веб-сервером

1. **502 Bad Gateway:**
   - Проверьте, что приложение запущено: `pm2 list`
   - Проверьте, что порт 3000 открыт: `netstat -tulpn | grep 3000`
   - Проверьте логи Nginx/Apache

2. **413 Request Entity Too Large:**
   - Увеличьте `client_max_body_size` в Nginx (уже настроено на 50MB)
   - Или `LimitRequestBody` в Apache

3. **Сертификат SSL не обновляется:**
   ```bash
   sudo certbot renew --dry-run
   sudo certbot renew
   ```

---

## Чеклист развертывания

- [ ] Сервер обновлен и настроен
- [ ] Установлен Node.js версии 16.0.0 или выше
- [ ] Установлен PM2
- [ ] Проект загружен на сервер
- [ ] Установлены зависимости (`npm install`)
- [ ] Создан файл `.env` с правильными настройками
- [ ] Инициализирована база данных (`npm run init-db`)
- [ ] Приложение запущено через PM2
- [ ] Настроен автозапуск PM2
- [ ] Установлен и настроен веб-сервер (Nginx/Apache)
- [ ] Настроено проксирование на порт 3000
- [ ] Установлен SSL сертификат (HTTPS)
- [ ] Настроен файрвол
- [ ] Настроено резервное копирование
- [ ] Проверена работа сайта
- [ ] Изменен пароль администратора (если применимо)
- [ ] Настроен мониторинг

---

## Дополнительные ресурсы

- **Документация Node.js:** https://nodejs.org/docs/
- **Документация PM2:** https://pm2.keymetrics.io/docs/
- **Документация Nginx:** https://nginx.org/en/docs/
- **Документация Apache:** https://httpd.apache.org/docs/
- **Let's Encrypt:** https://letsencrypt.org/docs/

---

**Готово! Ваш сайт должен быть доступен по адресу https://ваш-домен.ru** 🎉
