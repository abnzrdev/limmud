package com.abnzr.safcourse

import android.content.Context
import org.json.JSONObject
import java.io.File

internal class NoteRecoveryStore(context: Context) {
    private val directory = File(context.noBackupFilesDir, "lesson-note-recovery").apply { mkdirs() }

    fun put(courseId: String, lessonId: String, previous: String?, pending: String, checksum: String?) {
        val target = target(courseId, lessonId)
        val temporary = File(target.parentFile, "${target.name}.tmp")
        val value = JSONObject().apply {
            put("courseId", courseId)
            put("lessonId", lessonId)
            put("previous", previous ?: JSONObject.NULL)
            put("pending", pending)
            put("checksum", checksum ?: JSONObject.NULL)
            put("timestamp", System.currentTimeMillis())
        }.toString()
        temporary.writeText(value, Charsets.UTF_8)
        if (!temporary.renameTo(target)) {
            target.writeText(value, Charsets.UTF_8)
            temporary.delete()
        }
    }

    fun clear(courseId: String, lessonId: String) { target(courseId, lessonId).delete() }

    fun pending(courseId: String, lessonId: String): String? = runCatching {
        val target = target(courseId, lessonId)
        if (!target.isFile) null else JSONObject(target.readText(Charsets.UTF_8)).getString("pending")
    }.getOrNull()

    private fun target(courseId: String, lessonId: String): File =
        File(directory, "${CoursePrivacy.opaqueId(courseId, lessonId)}.json")
}
