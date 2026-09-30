# 服务器部署

访问地址：<http://172.22.1.100/>，创作页：<http://172.22.1.100/editor.html>。

站点使用服务器现有 Nginx，以独立 systemd 服务运行，监听 `172.22.1.100:80`。原有 Nginx 配置与其他容器保持原样。网站为静态文件，不依赖服务器 Node.js 版本。

- 服务：`inkplay.service`，已设置开机启动。
- 配置：`/etc/inkplay/nginx.conf`。
- 发布目录：`/opt/inkplay/releases/20260930T172438Z`。
- 当前版本：`/opt/inkplay/current` 符号链接。
- 日志：`/var/log/inkplay/access.log`、`/var/log/inkplay/error.log`。

常用维护命令（在服务器执行）：

```sh
systemctl status inkplay.service
nginx -t -c /etc/inkplay/nginx.conf
systemctl reload inkplay.service
```

更新时打包 `index.html`、`editor.html`、三个 CSS 文件、`src/`、`assets/`、`examples/` 到一个站点目录，连同本目录配置上传。执行 `bash deploy/install.sh SITE_DIRECTORY NEW_RELEASE_NAME`；发布目录名称必须唯一。脚本验证配置，切换版本链接，再启动或重新加载服务。旧发布版本保留以便回退。

浏览器中的自定义作品仍存储在当前访问地址的 IndexedDB。服务器不集中保存作品；从本机预览地址迁移作品时，需要先导出 JSON，再在服务器创作页导入。

部署验证：上传包 SHA-256 校验通过；服务 active/enabled；首页、JS、字体 HTTP 200，MIME 类型正确；浏览器中中文游戏、100 关列表和英文切换均正常；支持错落布局、小球弹性形变与接触箭头左右翻关；关卡整体位于画面中心；支持少量随机文字组交叠；支持主页面「中 / EN」语言切换；英文使用本地 Lora 正体；本次使用双语实际字宽与随机步幅安排路线，回折和少量交叠分散在不同接缝，保持统一字号；47 项测试通过，涵盖四个种子的 800 条中英文路线真实移动跳跃通关，未发现控制台错误。
