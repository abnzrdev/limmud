package com.abnzr.safcourse

import java.security.MessageDigest

internal object LessonNotes {
    fun canonicalName(lessonName: String): String {
        val dot = lessonName.lastIndexOf('.')
        val stem = if (dot > 0) lessonName.substring(0, dot) else lessonName
        return "$stem.notes.md"
    }

    fun checksum(contents: String): String = MessageDigest.getInstance("SHA-256")
        .digest(contents.toByteArray(Charsets.UTF_8))
        .joinToString("") { "%02x".format(it) }
}
