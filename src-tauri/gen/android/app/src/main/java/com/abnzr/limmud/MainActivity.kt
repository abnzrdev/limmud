package com.abnzr.limmud

import android.os.Bundle
import android.content.res.Configuration
import android.webkit.WebView
import androidx.activity.enableEdgeToEdge
import com.abnzr.safcourse.PlaybackEventSink

class MainActivity : TauriActivity(), PlaybackEventSink {
  private var limmudWebView: WebView? = null

  override fun onCreate(savedInstanceState: Bundle?) {
    enableEdgeToEdge()
    super.onCreate(savedInstanceState)
  }

  override fun onWebViewCreate(webView: WebView) {
    limmudWebView = webView
  }

  override fun onPictureInPictureModeChanged(isInPictureInPictureMode: Boolean, newConfig: Configuration) {
    super.onPictureInPictureModeChanged(isInPictureInPictureMode, newConfig)
    dispatch("limmud:native-pip", if (isInPictureInPictureMode) "active" else "inactive")
  }

  override fun dispatchPlaybackAction(action: String) {
    if (action in setOf("play", "pause", "next", "previous")) dispatch("limmud:native-media-action", action)
  }

  private fun dispatch(name: String, value: String) {
    limmudWebView?.post {
      limmudWebView?.evaluateJavascript("window.dispatchEvent(new CustomEvent('$name',{detail:'$value'}));", null)
    }
  }
}
