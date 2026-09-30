# Inkplay 部署方案

本项目是纯静态网站。Node.js 用于本地开发、测试和打包；线上不需要 Node.js 服务或数据库。游戏素材与玩家存档在浏览器中运行和保存。

## 方案一：GitHub Actions → GitHub Pages

- 仓库：<https://github.com/wang-zhengxin/inkplay>
- 游戏：<https://wang-zhengxin.github.io/inkplay/>
- 工坊：<https://wang-zhengxin.github.io/inkplay/editor.html>
- 工作流：[pages.yml](../.github/workflows/pages.yml)

### 自动发布过程

1. `main` 收到提交，或手动触发 `workflow_dispatch`。
2. Ubuntu runner 检出代码，安装 Node.js 22。
3. `npm test` 验证游戏和随机双语路线。失败即停止发布。
4. `npm run build` 将静态网站复制到 `dist/`。
5. 上传 Pages artifact，部署到 `github-pages` environment。
6. Actions 的 deployment 输出本次网站地址。

PR 只执行第 2–4 步，不能发布网站。同一分支的运行排队，避免同时发布。测试任务只有 `contents: read`；部署任务使用 `pages: write` 与 `id-token: write`，通过 GitHub 的内置 `GITHUB_TOKEN` 和 OIDC 发布，无需服务器密码、SSH 私钥或 PAT secret。

工作流使用固定提交 SHA 的 GitHub 官方 Pages Actions，配置参考 [GitHub 官方自定义工作流文档](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)。

### 新仓库初始化

1. 将项目推送到仓库的 `main` 分支。
2. 进入 **Settings → Pages → Build and deployment → Source**，选择 **GitHub Actions**。
3. 进入 **Actions → Test and deploy Inkplay → Run workflow**，选择 `main`。
4. 确认 `test-and-build` 和 `deploy` 均为绿色，再打开 deployment URL。

已有 GitHub CLI 管理权限时，也可通过 API 初始化：

```sh
gh api --method POST repos/wang-zhengxin/inkplay/pages \
  -f build_type=workflow \
  -f 'source[branch]=main' \
  -f 'source[path]=/'
```

若 Pages 已存在，使用 `PUT` 更新 `build_type=workflow`。不需要创建 `gh-pages` 分支，不需要在运行时访问 API。

### 日常更新、失败排查与回滚

提交并推送 `main` 后自动更新。可用 GitHub CLI 查看：

```sh
gh run list --repo wang-zhengxin/inkplay --workflow pages.yml
gh run view RUN_ID --repo wang-zhengxin/inkplay --log-failed
```

若发布提示 Pages 未启用，检查发布源是否为 GitHub Actions；若 environment 等待审批，检查仓库的 `github-pages` environment 规则；若资源 404，确认 Pages artifact 是 `dist/` 而不是仓库根目录。所有资源保持相对路径，才能正常部署在 `/inkplay/`。

回滚使用 `git revert COMMIT_SHA`，推送 `main` 后重新经过测试与自动发布。临时服务故障可在 Actions 重跑失败任务。旧网站在新部署成功前继续提供服务。

## 方案二：局域网 Nginx + systemd

现有站点：<http://172.22.1.100/>；工坊：<http://172.22.1.100/editor.html>。配置和安装脚本见 [deploy/README.md](../deploy/README.md)。该方案使用服务器现有 Nginx，以独立服务和配置运行。

### 环境与目录

服务器需要 `/usr/sbin/nginx`、`/etc/nginx/mime.types`、`nginx` 用户、systemd、curl 和 GNU coreutils。当前配置监听 `172.22.1.100:80`；迁移服务器时同步修改 `deploy/nginx.conf` 和 `deploy/install.sh` 中的监听地址与健康检查 URL。

| 项目 | 位置 |
| --- | --- |
| 服务 | `inkplay.service` |
| Nginx 配置 | `/etc/inkplay/nginx.conf` |
| 发布版本 | `/opt/inkplay/releases/RELEASE_NAME` |
| 当前版本链接 | `/opt/inkplay/current` |
| 日志 | `/var/log/inkplay/access.log`、`error.log` |

### 手工发布

本地先测试与打包，然后将产物和部署脚本上传：

```sh
npm test
npm run build
release_name=$(date -u +%Y%m%dT%H%M%SZ)
remote_dir="/tmp/inkplay-$release_name"
ssh root@172.22.1.100 "mkdir '$remote_dir'"
scp -r dist deploy "root@172.22.1.100:$remote_dir/"
ssh root@172.22.1.100 \
  "bash '$remote_dir/deploy/install.sh' '$remote_dir/dist' '$release_name'"
```

安装脚本创建新版本目录，验证 Nginx 配置，原子切换 `current` 链接，再启动或重载服务并检查首页。版本名称不能重复；已发布版本保留。HTML、JS、CSS 使用 `no-cache`，字体缓存 7 天。登录通过 SSH 使用本机已有认证，不将登录凭据提交仓库。

检查服务：

```sh
systemctl status inkplay.service
/usr/sbin/nginx -t -c /etc/inkplay/nginx.conf
curl -I http://172.22.1.100/
```

回滚时将链接切换到一个已经验证的旧版本：

```sh
previous_release=YOUR_PREVIOUS_RELEASE_NAME
test -d "/opt/inkplay/releases/$previous_release"
ln -s "/opt/inkplay/releases/$previous_release" /opt/inkplay/rollback.next
mv -Tf /opt/inkplay/rollback.next /opt/inkplay/current
systemctl reload inkplay.service
curl --fail http://172.22.1.100/ >/dev/null
```

### GitHub 与内网自动部署的边界

本仓库的自动发布目标是 **GitHub Pages**。GitHub 托管 runner 无法直接连接 `172.22.1.100` 这样的局域网地址。若将来要自动同步内网服务器，需要在可访问内网的独立机器上配置 self-hosted runner，或提供受控网络通道，再单独配置部署身份和分支权限。当前工作流不包含内网服务器的登录凭据；上面的手工方案可更新现有站点。

## 发布内容与玩家作品

`dist/` 只包含 `index.html`、`editor.html`、三个 CSS 文件、`src/`、`assets/`、`examples/` 和 `.nojekyll`。不会发布测试、Git 元数据、部署脚本或开发截图。

玩家的自定义作品保存于当前 origin 的 IndexedDB。部署更新不集中上传、删除或迁移玩家作品；未编辑的默认关卡可以自动升级布局，手工编辑章节保留。GitHub Pages、localhost 和局域网地址的存档相互独立，迁移作品使用工坊「导出作品 / 导入」。
