package com.puzzle.android

import android.os.Bundle
import androidx.activity.enableEdgeToEdge

class MainActivity : TauriActivity() {
  override fun onWebViewCreate(webView: android.webkit.WebView) {
    super.onWebViewCreate(webView)
    webView.addJavascriptInterface(object {
      @android.webkit.JavascriptInterface fun check() = runOnUiThread {
        if (webView.url.orEmpty().startsWith("http://tauri.localhost") || webView.url.orEmpty().startsWith("https://tauri.localhost")) appUpdates.check(true)
      }
      @android.webkit.JavascriptInterface fun website() = runOnUiThread {
        startActivity(android.content.Intent(android.content.Intent.ACTION_VIEW, android.net.Uri.parse("http://teddy-personal.cloud:22830/projects/puzzle")))
      }
    }, "InfluenceUpdates")
  }
  private val appUpdates by lazy { org.influence.updates.AndroidAppUpdates(this, "puzzle") }
  override fun onResume() { super.onResume(); appUpdates.resume() }
  override fun onCreate(savedInstanceState: Bundle?) {
    enableEdgeToEdge()
    super.onCreate(savedInstanceState)
    android.os.Handler(android.os.Looper.getMainLooper()).postDelayed({ if (!isDestroyed) appUpdates.check() }, 15000)
  }
  override fun onDestroy() { appUpdates.close(); super.onDestroy() }
}
