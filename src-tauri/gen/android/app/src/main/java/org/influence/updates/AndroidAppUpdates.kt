package org.influence.updates

import android.app.Activity
import android.app.AlertDialog
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.core.content.FileProvider
import org.json.JSONObject
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest
import java.util.concurrent.Executors

/** 独立 APK 更新：下载后核对包名、版本与安装签名，再交给系统安装器。 */
class AndroidAppUpdates(private val activity: Activity, private val product: String) {
    private val worker = Executors.newSingleThreadExecutor()
    private val base = "http://teddy-personal.cloud:22830/files/$product/"
    private var pending: File? = null
    private var waitingPermission = false
    private fun ui(action: () -> Unit) = activity.runOnUiThread {
        if (!activity.isFinishing && !activity.isDestroyed) action()
    }
    private fun connection(address: String): HttpURLConnection {
        val url = URL(address)
        require(url.protocol == "http" && url.host == "teddy-personal.cloud" && url.port == 22830 && url.path.startsWith("/files/$product/"))
        return (url.openConnection() as HttpURLConnection).apply {
            connectTimeout = 15000; readTimeout = 30000; instanceFollowRedirects = false
            require(responseCode == 200) { "更新服务暂不可用" }
        }
    }
    @Suppress("DEPRECATION")
    private fun info(file: File? = null) = if (file == null)
        activity.packageManager.getPackageInfo(activity.packageName, if (Build.VERSION.SDK_INT >= 28) PackageManager.GET_SIGNING_CERTIFICATES else PackageManager.GET_SIGNATURES)
    else activity.packageManager.getPackageArchiveInfo(file.path, if (Build.VERSION.SDK_INT >= 28) PackageManager.GET_SIGNING_CERTIFICATES else PackageManager.GET_SIGNATURES)
        ?: error("安装包无法识别")
    @Suppress("DEPRECATION")
    private fun version(value: android.content.pm.PackageInfo) = if (Build.VERSION.SDK_INT >= 28) value.longVersionCode else value.versionCode.toLong()
    @Suppress("DEPRECATION")
    private fun certificates(value: android.content.pm.PackageInfo) = (if (Build.VERSION.SDK_INT >= 28) value.signingInfo?.apkContentsSigners else value.signatures)
        ?.map { MessageDigest.getInstance("SHA-256").digest(it.toByteArray()).joinToString("") { byte -> "%02x".format(byte) } }?.toSet() ?: emptySet()
    private fun website() {
        try { activity.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("http://teddy-personal.cloud:22830/projects/$product"))) }
        catch (_: Exception) { ui { AlertDialog.Builder(activity).setMessage("请使用浏览器访问 teddy-personal.cloud:22830 下载新版。").setPositiveButton("知道了", null).show() } }
    }
    private fun policy(): JSONObject {
        var request: HttpURLConnection? = null
        return try {
            request = URL("http://teddy-personal.cloud:22830/updates/$product-android.json").openConnection() as HttpURLConnection
            request.connectTimeout = 2500; request.readTimeout = 2500; request.instanceFollowRedirects = false
            require(request.responseCode == 200)
            request.inputStream.use { JSONObject(String(it.readBytesBounded(16384), Charsets.UTF_8)) }
        } catch (_: Exception) { JSONObject() } finally { request?.disconnect() }
    }
    fun check(manual: Boolean = false) { worker.execute {
        try {
            val request = connection(base + "android.json")
            val bytes = try { request.inputStream.use { it.readBytesBounded(65536) } } finally { request.disconnect() }
            val release = JSONObject(String(bytes, Charsets.UTF_8))
            if (release.getLong("versionCode") <= version(info())) {
                if (manual) ui { AlertDialog.Builder(activity).setTitle("检查更新").setMessage("当前已是最新版本。").setPositiveButton("知道了", null).show() }
                return@execute
            }
            val template = policy()
            if (!template.optBoolean("enabled", true)) {
                if (manual) ui { AlertDialog.Builder(activity).setMessage("更新提醒暂未启用。").setPositiveButton("知道了", null).show() }
                return@execute
            }
            val mode = template.optString("mode", "auto")
            val packageBytes = release.optLong("bytes", template.optLong("packageBytes", 0))
            val useWebsite = mode == "website" || (mode == "auto" && (packageBytes <= 0 || packageBytes > template.optLong("maxDirectMB", 128) * 1024 * 1024))
            val name = release.getString("version")
            val message = template.optString("message", "{product} {version}\n{notes}").replace("{product}", "Puzzle").replace("{version}", name).replace("{notes}", release.optString("notes", ""))
            ui { AlertDialog.Builder(activity).setTitle(template.optString("title", "发现新版本"))
                .setMessage(message.take(2400) + if (useWebsite) "\n请前往网站下载新版并覆盖安装。" else "")
                .setNegativeButton("稍后", null).setPositiveButton(if (useWebsite) "前往网站" else "下载更新") { _, _ -> if (useWebsite) website() else download(release) }.show() }
        } catch (_: Exception) {
            if (manual) ui { AlertDialog.Builder(activity).setTitle("检查更新").setMessage("暂时无法检查更新，请稍后重试。").setNegativeButton("稍后", null).setPositiveButton("前往网站") { _, _ -> website() }.show() }
        }
    } }
    private fun java.io.InputStream.readBytesBounded(limit: Int): ByteArray {
        val output = java.io.ByteArrayOutputStream()
        val buffer = ByteArray(8192)
        while (true) { val count = read(buffer); if (count < 0) break; require(output.size() + count <= limit); output.write(buffer, 0, count) }
        return output.toByteArray()
    }
    private fun download(release: JSONObject) {
        val progress = AlertDialog.Builder(activity).setTitle("正在下载更新").setMessage("下载并校验安装包，请稍候…").setCancelable(false).show()
        worker.execute {
            val file = File(activity.cacheDir, "updates/update.apk")
            try {
                file.parentFile?.mkdirs()
                val request = connection(release.getString("url"))
                val digest = MessageDigest.getInstance("SHA-256")
                try { request.inputStream.use { input -> file.outputStream().use { output ->
                    val buffer = ByteArray(65536); var total = 0L
                    while (true) { val count = input.read(buffer); if (count < 0) break
                        require(!Thread.currentThread().isInterrupted); total += count; require(total <= 512L * 1024 * 1024)
                        output.write(buffer, 0, count); digest.update(buffer, 0, count)
                    }
                } } } finally { request.disconnect() }
                require(digest.digest().joinToString("") { "%02x".format(it) }.equals(release.getString("sha256"), true)) { "文件校验失败" }
                val installed = info(); val downloaded = info(file)
                require(downloaded.packageName == activity.packageName && version(downloaded) == release.getLong("versionCode") && version(downloaded) > version(installed)) { "安装包与当前应用不匹配" }
                val signers = certificates(installed)
                require(signers.isNotEmpty() && certificates(downloaded) == signers) { "安装包签名与当前应用不一致" }
                pending = file
                ui { progress.dismiss(); install() }
            } catch (_: Exception) {
                file.delete(); pending = null
                ui { progress.dismiss(); AlertDialog.Builder(activity).setTitle("更新失败").setMessage("下载或校验失败，当前版本未更改，请稍后重新启动应用重试。").setPositiveButton("知道了", null).show() }
            }
        }
    }
    private fun install() {
        val file = pending ?: return
        try {
            if (Build.VERSION.SDK_INT >= 26 && !activity.packageManager.canRequestPackageInstalls()) {
                waitingPermission = true
                activity.startActivity(Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:${activity.packageName}")))
                return
            }
            val uri = FileProvider.getUriForFile(activity, activity.packageName + ".fileprovider", file)
            activity.startActivity(Intent(Intent.ACTION_VIEW).setDataAndType(uri, "application/vnd.android.package-archive")
                .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION))
            pending = null
        } catch (_: Exception) { AlertDialog.Builder(activity).setMessage("无法打开安装器，请从网站下载新版本安装。").setPositiveButton("知道了", null).show() }
    }
    fun resume() { if (waitingPermission) { waitingPermission = false
        if (Build.VERSION.SDK_INT < 26 || activity.packageManager.canRequestPackageInstalls()) install()
        else { pending?.delete(); pending = null }
    } }
    fun close() { worker.shutdownNow() }
}
