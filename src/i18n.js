export const dictionaries = {
  zh: {
    rescueTitle:'独立应急入口', rescueLocation:'入口位于运行 DSH 的电脑上；即使 DSH 网页打不开也能使用。', createShortcut:'创建 / 修复入口', shortcutDesktop:'桌面应急入口已就绪。', shortcutSaved:'应急启动文件已保存；桌面入口未创建。', shortcutMissing:'还没有可用的应急入口，请点击创建。', shortcutConflict:'同名文件已存在，未覆盖；可以使用下方的应急启动文件。', shortcutUnsupported:'此平台暂不支持应急启动入口。',
    title:'恢复中心', subtitle:'给能正常工作的插件组合，留一个返回按钮。', badge:'本地备份', language:'语言',
    saveTitle:'保存当前插件状态', saveHelp:'安装或更新插件前保存一次。备份包含插件文件和加载配置，可离线恢复。',
    placeholder:'例如：安装新主题之前', label:'恢复点名称', capture:'保存恢复点', reading:'正在读取恢复点…',
    savedTitle:'已保存的恢复点', refresh:'刷新', rollback:'回滚', empty:'还没有恢复点。先保存一次当前正常状态。',
    footer:'只恢复当前 profile 的插件文件、依赖清单和加载配置；聊天记录、工作区、模型凭据与 DSH 主程序不参与回滚。恢复点保存在此电脑，可能含插件配置，请勿公开上传。',
    rescueHelp:'网页打不开时，使用已安装的“DSH 应急恢复”入口。恢复点不会自动清理。',
    confirmTitle:'恢复这个插件组合？', confirmBody:'将停止当前 DSH，未完成的任务会中断。恢复前会自动备份当前插件状态，然后恢复并重新启动。聊天记录和工作区文件保留。',
    cancel:'取消', restore:'恢复并重启', plugins:'个插件', points:'个恢复点。建议安装插件前手动保存。',
    managed:'此启动方式由外部程序管理，请关闭 DSH 后通过 CLI 恢复。', copying:'正在复制并校验插件文件，请暂时不要安装或更新插件…',
    saved:'恢复点已保存，可以继续安装插件。', accepted:'恢复已开始，请等待 DSH 重启…', reconnect:'DSH 正在重启，正在等待重新连接…',
    failed:'操作失败', manual:'手动保存', beforeRestore:'回滚前自动保存', verifying:'正在验证恢复点…', stopping:'正在停止 DSH…',
    restoring:'正在恢复插件；聊天记录保持原样…', starting:'正在重新启动 DSH…', done:'恢复完成，DSH 已重新启动。请刷新页面。',
    cliReady:'恢复中心仅在本机运行。关闭此窗口可退出。', repaired:'未完成事务已撤销。', noTransaction:'没有未完成事务。', emergency:'应急入口保存'
  },
  en: {
    rescueTitle:'Independent emergency recovery', rescueLocation:'This launcher is on the computer running DSH. It works even when the DSH webpage will not open.', createShortcut:'Create / repair launcher', shortcutDesktop:'Desktop recovery launcher is ready.', shortcutSaved:'Recovery launch file is saved; no desktop shortcut was created.', shortcutMissing:'No recovery launcher is available. Create one below.', shortcutConflict:'An existing file was left unchanged. Use the recovery launch file below.', shortcutUnsupported:'Emergency launchers are not supported on this platform yet.',
    title:'Recovery Center', subtitle:'Keep a way back to a working plugin setup.', badge:'Local backups', language:'Language',
    saveTitle:'Save your current plugin setup', saveHelp:'Save before installing or updating plugins. Includes plugin files and loading configuration for offline recovery.',
    placeholder:'For example: Before installing a new theme', label:'Recovery point name', capture:'Save recovery point', reading:'Loading recovery points…',
    savedTitle:'Saved recovery points', refresh:'Refresh', rollback:'Restore', empty:'No recovery points yet. Save your working setup first.',
    footer:'Restores only this profile’s plugin files, dependency manifests and loading configuration. Chats, workspaces, model credentials and DSH itself are not rolled back. Recovery points stay on this computer and may contain private plugin configuration. Do not publish them.',
    rescueHelp:'If DSH will not open, use your installed emergency recovery shortcut. Recovery points are not deleted automatically.',
    confirmTitle:'Restore this plugin setup?', confirmBody:'DSH will stop and unfinished tasks will be interrupted. Your current plugin setup will be backed up first, then the selected point will be restored and DSH restarted. Chats and workspace files are kept.',
    cancel:'Cancel', restore:'Restore and restart', plugins:'plugins', points:'recovery points. Save before installing plugins.',
    managed:'An external launcher manages this host. Stop DSH and restore through the CLI.', copying:'Copying and verifying plugin files. Please avoid installing or updating plugins…',
    saved:'Recovery point saved. You can continue installing plugins.', accepted:'Recovery started. Please wait for DSH to restart…', reconnect:'DSH is restarting. Waiting to reconnect…',
    failed:'Operation failed', manual:'Manual save', beforeRestore:'Automatic save before restore', verifying:'Verifying the recovery point…', stopping:'Stopping DSH…',
    restoring:'Restoring plugins. Chats are kept…', starting:'Restarting DSH…', done:'Recovery complete. DSH has restarted. Refresh the page.',
    cliReady:'Recovery Center is running locally. Close this terminal to stop it.', repaired:'Interrupted transaction rolled back.', noTransaction:'No interrupted transaction found.', emergency:'Emergency save'
  }
};
export function language(value) { return /^zh(?:[-_]|$)/i.test(value || '') ? 'zh' : 'en'; }
// Translate existing stored diagnostic text too, without rewriting old recovery points.
export const diagnostics = {
 '外部符号链接无法完整备份：':'Cannot fully back up an external symlink: ', '符号链接越界：':'Symlink escapes the captured tree: ', '不支持的文件类型：':'Unsupported file type: ',
 '恢复目录必须独立于 profile。':'The recovery directory must be outside the profile.', 'Profile 不能是符号链接。':'The profile cannot be a symlink.',
 '已有恢复操作进行中；如果上次异常退出，请用应急入口解除过期锁。':'Another operation is in progress. If it crashed, use emergency recovery to clear its stale lock.',
 '操作进程仍在运行，不能解除锁。':'The operation is still running; its lock cannot be cleared.', '配置父目录不能是符号链接。':'A configuration parent directory cannot be a symlink.',
 '不能备份或覆盖顶层符号链接：':'Cannot back up or overwrite a top-level symlink: ', '发现未完成的恢复事务，请先使用应急入口修复。':'An interrupted restore was found. Repair it using emergency recovery first.',
 '备份期间插件发生变化，请停止安装操作后重试。':'Plugins changed during backup. Stop package installation and try again.', '恢复点编号无效。':'Invalid recovery point ID.',
 '恢复点不能是符号链接。':'A recovery point cannot be a symlink.', '恢复点格式或所属环境不匹配。':'Recovery point format or profile mismatch.', '恢复点内容不匹配。':'Recovery point contents do not match.',
 '恢复点文件校验失败：':'Recovery point integrity check failed: ', '恢复事务记录损坏；保留原文件等待人工处理。':'The transaction journal is corrupt. Keep the original files for manual recovery.',
 '此启动方式未启用自动重启。请关闭 DSH 后使用 CLI 恢复。':'Automatic restart is disabled for this launcher. Stop DSH and restore using the CLI.',
 '已有备份/恢复操作进行中。':'A backup or restore is already running.', '已有恢复任务，请查看进度。':'A recovery job already exists. Check its progress.',
 '请先关闭 DSH，再修复未完成事务。':'Stop DSH before repairing an interrupted transaction.', '恢复 worker 仍在运行或归属不明，请保留任务记录。':'The recovery worker is still running or its owner is unknown. Keep the job record.',
 '请先关闭 DSH，或使用 serve 界面的自动重启恢复。':'Stop DSH first, or use the rescue page to restore and restart.', '确认恢复时加 --yes；聊天数据不会回滚。':'Add --yes to confirm the restore. Chats will not be rolled back.',
 '无效主机地址。':'Invalid host address.', '请求必须使用 JSON。':'The request must use JSON.', '请求过大。':'The request is too large.',
 '请从已登录的 DSH 打开恢复中心。':'Open Recovery Center from an authenticated DSH session.', '只接受本页面发出的操作。':'Only same-origin requests are accepted.',
 '已有操作进行中。':'An operation is already running.', '请先确认恢复并重启。':'Confirm restore and restart first.', '没有此操作。':'Unknown operation.', '请先登录 DSH。':'Sign in to DSH first.',
 'DSH 重启失败，请打开应急恢复入口查看日志。':'DSH failed to restart. Use emergency recovery and check the host log.',
 'DSH 已启动，但恢复插件尚未就绪；请检查应急入口中的日志。':'DSH started but Recovery Center is not ready. Check the recovery host log.',
 '未授权此启动方式自动重启。':'Automatic restart is not enabled for this launcher.', 'DSH 进程已变化，拒绝停止其他进程。':'The DSH process has changed. Refusing to stop a different process.',
 'DSH 没有正常退出；没有强制终止，也没有修改文件。':'DSH did not exit. It was not force-killed and no files were changed.',
 ' 已尝试重新启动 DSH。':' Attempted to restart DSH.', '用法：':'Usage: ', '<目录>':'<directory>'
};
export function translateDiagnostic(text, lang) {
  if (lang !== 'en') return text;
  let result = String(text).replace(/DSH 版本不同（恢复点 (.*?)，当前 (.*?)），不能直接恢复插件。/g, 'DSH version mismatch (saved: $1, current: $2). Plugin restore is blocked.');
  for (const [zh, en] of Object.entries(diagnostics)) result = result.split(zh).join(en);
  return result;
}
