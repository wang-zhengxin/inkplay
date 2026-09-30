#!/bin/bash
set -euo pipefail
site=${1:?Usage: install.sh SITE_DIRECTORY RELEASE_NAME}
release_name=${2:?Release name required}
[[ "$release_name" =~ ^[A-Za-z0-9._-]+$ ]] || exit 1
config_dir=$(cd "$(dirname "$0")" && pwd)
release="/opt/inkplay/releases/$release_name"
test ! -e "$release"
test -f "$site/index.html"
install -d "$release" /etc/inkplay /var/log/inkplay /run/inkplay
cp -R "$site/." "$release/"
find "$release" -type d -exec chmod 755 {} +
find "$release" -type f -exec chmod 644 {} +
install -m 644 "$config_dir/nginx.conf" /etc/inkplay/nginx.conf
install -m 644 "$config_dir/inkplay.service" /etc/systemd/system/inkplay.service
/usr/sbin/nginx -t -c /etc/inkplay/nginx.conf
ln -s "$release" /opt/inkplay/current.next
mv -Tf /opt/inkplay/current.next /opt/inkplay/current
systemctl daemon-reload
systemctl enable inkplay.service
if systemctl is-active --quiet inkplay.service; then
    systemctl reload inkplay.service
else
    systemctl start inkplay.service
fi
systemctl is-active inkplay.service
curl --fail --silent --output /dev/null http://172.22.1.100/
