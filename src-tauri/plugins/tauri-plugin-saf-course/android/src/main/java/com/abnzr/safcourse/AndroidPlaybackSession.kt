package com.abnzr.safcourse

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.media.AudioManager
import android.media.MediaMetadata
import android.media.session.MediaSession
import android.media.session.PlaybackState
import android.os.Build

interface PlaybackEventSink {
    fun dispatchPlaybackAction(action: String)
}

internal class AndroidPlaybackSession(private val context: Context) {
    private val sink get() = context as? PlaybackEventSink
    private var noisyRegistered = false
    private val noisyReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            if (intent?.action == AudioManager.ACTION_AUDIO_BECOMING_NOISY) sink?.dispatchPlaybackAction("pause")
        }
    }
    private val session = MediaSession(context, "LimmudPlayback").apply {
        setMetadata(MediaMetadata.Builder()
            .putString(MediaMetadata.METADATA_KEY_TITLE, "Limmud")
            .putString(MediaMetadata.METADATA_KEY_DISPLAY_SUBTITLE, "Study session")
            .build())
        setCallback(object : MediaSession.Callback() {
            override fun onPlay() = sink?.dispatchPlaybackAction("play") ?: Unit
            override fun onPause() = sink?.dispatchPlaybackAction("pause") ?: Unit
            override fun onSkipToNext() = sink?.dispatchPlaybackAction("next") ?: Unit
            override fun onSkipToPrevious() = sink?.dispatchPlaybackAction("previous") ?: Unit
        })
    }

    fun update(state: String, positionSeconds: Double, durationSeconds: Double, canPrevious: Boolean, canNext: Boolean): Boolean {
        val playing = state == "playing"
        // Chromium owns the HTML5 player's audio focus. A second native focus request would
        // compete with the real player when WebView acquires focus after playback begins.
        val focusGranted = true
        val effectivePlaying = playing
        if (effectivePlaying) registerNoisy() else {
            unregisterNoisy()
        }
        var actions = PlaybackState.ACTION_PLAY or PlaybackState.ACTION_PAUSE or PlaybackState.ACTION_PLAY_PAUSE
        if (canPrevious) actions = actions or PlaybackState.ACTION_SKIP_TO_PREVIOUS
        if (canNext) actions = actions or PlaybackState.ACTION_SKIP_TO_NEXT
        val playbackState = when {
            effectivePlaying -> PlaybackState.STATE_PLAYING
            state == "ended" -> PlaybackState.STATE_STOPPED
            state == "idle" -> PlaybackState.STATE_NONE
            else -> PlaybackState.STATE_PAUSED
        }
        session.setPlaybackState(PlaybackState.Builder()
            .setActions(actions)
            .setState(playbackState, (positionSeconds.coerceAtLeast(0.0) * 1000).toLong(), if (effectivePlaying) 1f else 0f)
            .setBufferedPosition((durationSeconds.coerceAtLeast(0.0) * 1000).toLong())
            .build())
        session.isActive = state != "idle"
        return focusGranted
    }

    fun destroy() {
        unregisterNoisy()
        session.isActive = false
        session.release()
    }

    private fun registerNoisy() {
        if (noisyRegistered) return
        val filter = IntentFilter(AudioManager.ACTION_AUDIO_BECOMING_NOISY)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) context.registerReceiver(noisyReceiver, filter, Context.RECEIVER_NOT_EXPORTED)
        else {
            @Suppress("DEPRECATION")
            context.registerReceiver(noisyReceiver, filter)
        }
        noisyRegistered = true
    }

    private fun unregisterNoisy() {
        if (!noisyRegistered) return
        runCatching { context.unregisterReceiver(noisyReceiver) }
        noisyRegistered = false
    }
}
