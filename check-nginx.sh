#!/bin/bash

echo "🔍 Проверка наличия Nginx..."
echo ""

# Проверка установки
if command -v nginx &> /dev/null; then
    echo "✅ Nginx установлен"
    nginx -v
else
    echo "❌ Nginx не установлен"
fi

echo ""
echo "🔍 Проверка статуса Nginx..."
echo ""

# Проверка статуса службы
if systemctl is-active --quiet nginx 2>/dev/null; then
    echo "✅ Nginx запущен (systemd)"
    systemctl status nginx --no-pager -l | head -5
elif service nginx status &> /dev/null; then
    echo "✅ Nginx запущен (service)"
    service nginx status | head -5
else
    echo "❌ Nginx не запущен"
fi

echo ""
echo "🔍 Проверка процессов Nginx..."
echo ""

if pgrep -x nginx > /dev/null; then
    echo "✅ Процесс Nginx найден:"
    ps aux | grep nginx | grep -v grep
else
    echo "❌ Процесс Nginx не найден"
fi

echo ""
echo "🔍 Проверка портов 80 и 443..."
echo ""

# Проверка порта 80
if netstat -tlnp 2>/dev/null | grep -q ':80 ' || ss -tlnp 2>/dev/null | grep -q ':80 '; then
    echo "✅ Порт 80 занят:"
    netstat -tlnp 2>/dev/null | grep ':80 ' || ss -tlnp 2>/dev/null | grep ':80 '
else
    echo "❌ Порт 80 свободен"
fi

echo ""

# Проверка порта 443
if netstat -tlnp 2>/dev/null | grep -q ':443 ' || ss -tlnp 2>/dev/null | grep -q ':443 '; then
    echo "✅ Порт 443 занят:"
    netstat -tlnp 2>/dev/null | grep ':443 ' || ss -tlnp 2>/dev/null | grep ':443 '
else
    echo "❌ Порт 443 свободен"
fi

echo ""
echo "🔍 Проверка конфигурации Nginx..."
echo ""

if [ -d "/etc/nginx" ]; then
    echo "✅ Директория /etc/nginx существует"
    if [ -f "/etc/nginx/nginx.conf" ]; then
        echo "✅ Файл конфигурации найден"
    fi
    if [ -d "/etc/nginx/sites-enabled" ]; then
        echo "✅ Директория sites-enabled найдена"
        echo "   Настроенные сайты:"
        ls -la /etc/nginx/sites-enabled/ 2>/dev/null | grep -v "^total" | grep -v "^d" | awk '{print "   - " $9}'
    fi
else
    echo "❌ Директория /etc/nginx не найдена"
fi

