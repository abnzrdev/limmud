package com.abnzr.safcourse

import org.json.JSONArray
import org.json.JSONObject
import java.security.MessageDigest

internal object CourseStateDocuments {
    private val names = mapOf(
        "state" to "state.json",
        "progress" to "progress.json",
        "todos" to "todos.json",
        "vocabulary" to "vocabulary.json",
    )

    fun fileName(key: String): String? = names[key]

    fun revision(contents: String): String = sha256(contents)

    fun privateKey(courseId: String, file: String): String = sha256("$courseId\u0000$file")

    fun validRecord(contents: String): Boolean = runCatching {
        val value = JSONObject(contents)
        value.keys().asSequence().all { key -> value.opt(key) is String }
    }.getOrDefault(false)

    fun validVocabulary(contents: String): Boolean = runCatching {
        JSONArray(contents)
        true
    }.getOrDefault(false)

    fun preserve(contents: String): String = contents

    private fun sha256(value: String): String = MessageDigest.getInstance("SHA-256")
        .digest(value.toByteArray(Charsets.UTF_8))
        .joinToString("") { "%02x".format(it) }
}
