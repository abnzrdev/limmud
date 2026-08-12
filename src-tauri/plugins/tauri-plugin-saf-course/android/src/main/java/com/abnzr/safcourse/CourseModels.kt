package com.abnzr.safcourse

import app.tauri.plugin.JSArray
import app.tauri.plugin.JSObject
import java.security.MessageDigest

internal data class ProviderEntry(
    val id: String,
    val name: String,
    val relativePath: String,
    val kind: String,
    val children: List<ProviderEntry>? = null,
) {
    fun toJs(): JSObject = JSObject().apply {
        put("id", id)
        put("name", name)
        put("relativePath", relativePath)
        put("kind", kind)
        children?.let { values -> put("children", JSArray(values.map(ProviderEntry::toJs))) }
    }
}

internal object CoursePrivacy {
    fun opaqueId(courseId: String, providerId: String): String {
        val bytes = MessageDigest.getInstance("SHA-256")
            .digest("$courseId\u0000$providerId".toByteArray(Charsets.UTF_8))
        return bytes.joinToString("") { "%02x".format(it) }
    }
}

internal object CourseClassification {
    fun kind(name: String, isDirectory: Boolean): String {
        if (isDirectory) return "directory"
        return when (name.substringAfterLast('.', "").lowercase()) {
            "mp4", "mkv", "webm" -> "video"
            "vtt", "srt" -> "subtitle"
            "md", "txt" -> "note"
            "png", "jpg", "jpeg", "webp" -> "image"
            "mp3", "wav", "m4a", "ogg" -> "audio"
            else -> "other"
        }
    }

    fun compareNaturally(left: String, right: String): Int {
        val parts = Regex("(\\d+|\\D+)")
        val a = parts.findAll(left.lowercase()).map { it.value }.toList()
        val b = parts.findAll(right.lowercase()).map { it.value }.toList()
        for (index in 0 until minOf(a.size, b.size)) {
            val av = a[index]
            val bv = b[index]
            val compared = if (av.first().isDigit() && bv.first().isDigit()) {
                av.trimStart('0').ifEmpty { "0" }.length.compareTo(bv.trimStart('0').ifEmpty { "0" }.length)
                    .takeIf { it != 0 } ?: av.toBigInteger().compareTo(bv.toBigInteger())
            } else av.compareTo(bv)
            if (compared != 0) return compared
        }
        return a.size.compareTo(b.size).takeIf { it != 0 } ?: left.compareTo(right)
    }
}
