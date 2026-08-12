package com.abnzr.safcourse

import android.content.Context
import android.net.Uri

internal data class RegistryRecord(val uri: String, val grantFlags: Int)

internal object CourseRegistryCodec {
    private const val PREFIX = "v2|"

    fun encode(record: RegistryRecord): String = "$PREFIX${record.grantFlags}|${record.uri}"

    fun decode(value: String): RegistryRecord {
        if (!value.startsWith(PREFIX)) {
            return RegistryRecord(value, android.content.Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
        val separator = value.indexOf('|', PREFIX.length)
        require(separator > PREFIX.length)
        return RegistryRecord(
            uri = value.substring(separator + 1),
            grantFlags = value.substring(PREFIX.length, separator).toInt(),
        )
    }
}

internal class CourseRegistry(context: Context) {
    private val preferences = context.getSharedPreferences("saf-course-registry", Context.MODE_PRIVATE)

    fun ids(): List<String> {
        val ids = preferences.all.keys.filterNot { it == SELECTED_KEY }.sorted()
        val selected = preferences.getString(SELECTED_KEY, null)
        return if (selected != null && ids.contains(selected)) listOf(selected) + ids.filterNot { it == selected } else ids
    }

    fun record(courseId: String): RegistryRecord? = preferences.getString(courseId, null)?.let {
        runCatching { CourseRegistryCodec.decode(it) }.getOrNull()
    }

    fun uri(courseId: String): Uri? = record(courseId)?.uri?.let(Uri::parse)

    fun save(courseId: String, uri: Uri, grantFlags: Int) {
        val encoded = CourseRegistryCodec.encode(RegistryRecord(uri.toString(), grantFlags))
        preferences.edit().putString(courseId, encoded).putString(SELECTED_KEY, courseId).apply()
    }

    companion object { private const val SELECTED_KEY = "__selected_course_id" }
}
