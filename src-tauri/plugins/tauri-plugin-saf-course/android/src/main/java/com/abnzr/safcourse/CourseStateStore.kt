package com.abnzr.safcourse

import android.content.ContentResolver
import android.content.Context
import android.net.Uri
import android.provider.DocumentsContract
import org.json.JSONObject
import java.io.File
import java.io.FileOutputStream

internal data class StoredStateSnapshot(
    val storage: String,
    val files: Map<String, String>,
    val revisions: Map<String, String?>,
)

internal data class StoredStateSaveResult(
    val status: String,
    val storage: String,
    val revision: String? = null,
)

internal data class StoredStateSources(
    val portable: StoredStateSnapshot,
    val local: StoredStateSnapshot?,
)

private data class StateDocument(
    val id: String,
    val uri: Uri,
    val flags: Int,
    val mimeType: String,
)

internal class CourseStateStore(
    context: Context,
    private val resolver: ContentResolver,
    private val registry: CourseRegistry,
    private val hasReadGrant: (Uri) -> Boolean,
    private val hasWriteGrant: (Uri) -> Boolean,
) {
    private val localDirectory = File(context.noBackupFilesDir, "course-state-local").apply { mkdirs() }
    private val recoveryDirectory = File(context.noBackupFilesDir, "course-state-recovery").apply { mkdirs() }

    fun load(courseId: String): StoredStateSnapshot {
        val tree = registry.uri(courseId) ?: throw SecurityException()
        if (!hasReadGrant(tree)) throw SecurityException()
        val portable = readPortable(tree)
        val files = linkedMapOf<String, String>()
        val revisions = linkedMapOf<String, String?>()
        var local = false
        for (key in KEYS) {
            val fallback = localFile(courseId, key)
            val contents = if (fallback.isFile) {
                local = true
                readPrivate(fallback)
            } else portable[key] ?: defaultContents(key)
            validate(key, contents)
            files[key] = contents
            revisions[key] = if ((portable[key] == null && !fallback.isFile)) null else CourseStateDocuments.revision(contents)
        }
        return StoredStateSnapshot(if (local) "localOnly" else "portable", files, revisions)
    }

    fun save(courseId: String, key: String, contents: String, expectedRevision: String?): StoredStateSaveResult {
        CourseStateDocuments.fileName(key) ?: return StoredStateSaveResult("failed", "localOnly")
        if (!validate(key, contents)) return StoredStateSaveResult("malformed", "localOnly")
        val tree = registry.uri(courseId) ?: return StoredStateSaveResult("accessRequired", "localOnly")
        if (!hasReadGrant(tree)) return StoredStateSaveResult("accessRequired", "localOnly")
        return if (hasWriteGrant(tree) && canWritePortable(tree, key)) {
            savePortable(courseId, tree, key, contents, expectedRevision)
        } else {
            saveLocal(courseId, key, contents, expectedRevision, tree)
        }
    }

    fun loadSources(courseId: String): StoredStateSources {
        val tree = registry.uri(courseId) ?: throw SecurityException()
        if (!hasReadGrant(tree)) throw SecurityException()
        val portableContents = readPortable(tree)
        fun snapshot(overrides: Map<String, String>, storage: String): StoredStateSnapshot {
            val files = KEYS.associateWith { key -> overrides[key] ?: portableContents[key] ?: defaultContents(key) }
            files.forEach { (key, contents) -> if (!validate(key, contents)) throw IllegalStateException("portable_state_malformed") }
            return StoredStateSnapshot(storage, files, KEYS.associateWith { key ->
                val contents = if (storage == "portable") portableContents[key] else overrides[key] ?: portableContents[key]
                contents?.let(CourseStateDocuments::revision)
            })
        }
        val localContents = KEYS.mapNotNull { key ->
            val file = localFile(courseId, key)
            if (file.isFile) key to readPrivate(file) else null
        }.toMap()
        return StoredStateSources(snapshot(emptyMap(), "portable"), localContents.takeIf { it.isNotEmpty() }?.let { snapshot(it, "localOnly") })
    }

    fun clearLocal(courseId: String): Boolean {
        var cleared = true
        for (key in KEYS) {
            val file = localFile(courseId, key)
            if (file.exists() && !file.delete()) cleared = false
        }
        return cleared
    }

    private fun readPortable(tree: Uri): Map<String, String> {
        val rootId = DocumentsContract.getTreeDocumentId(tree)
        val directory = findChild(tree, rootId, STATE_DIRECTORY) ?: return emptyMap()
        if (directory.mimeType != DocumentsContract.Document.MIME_TYPE_DIR) return emptyMap()
        return KEYS.mapNotNull { key ->
            val document = findChild(tree, directory.id, CourseStateDocuments.fileName(key)!!) ?: return@mapNotNull null
            val contents = readBounded(document.uri)
            if (!validate(key, contents)) throw IllegalStateException("portable_state_malformed")
            key to contents
        }.toMap()
    }

    private fun canWritePortable(tree: Uri, key: String): Boolean {
        val rootId = DocumentsContract.getTreeDocumentId(tree)
        val root = document(DocumentsContract.buildDocumentUriUsingTree(tree, rootId)) ?: return false
        val directory = findChild(tree, rootId, STATE_DIRECTORY)
            ?: return root.flags and DocumentsContract.Document.FLAG_DIR_SUPPORTS_CREATE != 0
        val file = findChild(tree, directory.id, CourseStateDocuments.fileName(key)!!)
        return if (file == null) {
            directory.flags and DocumentsContract.Document.FLAG_DIR_SUPPORTS_CREATE != 0
        } else file.flags and DocumentsContract.Document.FLAG_SUPPORTS_WRITE != 0
    }

    private fun savePortable(
        courseId: String,
        tree: Uri,
        key: String,
        contents: String,
        expectedRevision: String?,
    ): StoredStateSaveResult {
        val rootId = DocumentsContract.getTreeDocumentId(tree)
        val root = document(DocumentsContract.buildDocumentUriUsingTree(tree, rootId)) ?: return StoredStateSaveResult("failed", "portable")
        val directory = findChild(tree, rootId, STATE_DIRECTORY) ?: run {
            if (root.flags and DocumentsContract.Document.FLAG_DIR_SUPPORTS_CREATE == 0) return StoredStateSaveResult("failed", "portable")
            val created = DocumentsContract.createDocument(
                resolver, root.uri, DocumentsContract.Document.MIME_TYPE_DIR, STATE_DIRECTORY,
            ) ?: return StoredStateSaveResult("failed", "portable")
            document(created) ?: return StoredStateSaveResult("failed", "portable")
        }
        var target = findChild(tree, directory.id, CourseStateDocuments.fileName(key)!!)
        val previous = target?.let { readBounded(it.uri) }
        val previousRevision = previous?.let(CourseStateDocuments::revision)
        if (previousRevision != expectedRevision) {
            return StoredStateSaveResult("conflict", "portable", previousRevision ?: CourseStateDocuments.revision(defaultContents(key)))
        }
        if (target == null) {
            if (directory.flags and DocumentsContract.Document.FLAG_DIR_SUPPORTS_CREATE == 0) return StoredStateSaveResult("failed", "portable")
            val created = DocumentsContract.createDocument(
                resolver, directory.uri, "application/json", CourseStateDocuments.fileName(key)!!,
            ) ?: return StoredStateSaveResult("failed", "portable")
            target = document(created)
                ?: return StoredStateSaveResult("failed", "portable")
        } else if (target.flags and DocumentsContract.Document.FLAG_SUPPORTS_WRITE == 0) {
            return saveLocal(courseId, key, contents, expectedRevision, tree)
        }
        val recovery = recoveryFile(courseId, key)
        writePrivate(recovery, JSONObject().apply {
            put("courseId", courseId)
            put("file", key)
            put("previous", previous ?: JSONObject.NULL)
            put("pending", contents)
            put("previousRevision", previousRevision ?: JSONObject.NULL)
        }.toString())
        return try {
            writeProvider(target.uri, contents)
            val verified = readBounded(target.uri)
            if (verified != contents || !validate(key, verified)) {
                StoredStateSaveResult("failed", "portable")
            } else {
                recovery.delete()
                StoredStateSaveResult("saved", "portable", CourseStateDocuments.revision(verified))
            }
        } catch (_: Exception) {
            StoredStateSaveResult("failed", "portable")
        }
    }

    private fun saveLocal(
        courseId: String,
        key: String,
        contents: String,
        expectedRevision: String?,
        tree: Uri,
    ): StoredStateSaveResult {
        val local = localFile(courseId, key)
        val current = if (local.isFile) readPrivate(local) else readPortable(tree)[key]
        val currentRevision = current?.let(CourseStateDocuments::revision)
        if (currentRevision != expectedRevision) {
            return StoredStateSaveResult("conflict", "localOnly", currentRevision ?: CourseStateDocuments.revision(defaultContents(key)))
        }
        val recovery = recoveryFile(courseId, key)
        writePrivate(recovery, JSONObject().apply {
            put("courseId", courseId)
            put("file", key)
            put("previous", current ?: JSONObject.NULL)
            put("pending", contents)
            put("previousRevision", currentRevision ?: JSONObject.NULL)
        }.toString())
        return try {
            writePrivate(local, contents)
            val verified = readPrivate(local)
            if (verified != contents || !validate(key, verified)) StoredStateSaveResult("failed", "localOnly")
            else {
                recovery.delete()
                StoredStateSaveResult("saved", "localOnly", CourseStateDocuments.revision(verified))
            }
        } catch (_: Exception) {
            StoredStateSaveResult("failed", "localOnly")
        }
    }

    private fun document(uri: Uri): StateDocument? = resolver.query(
        uri, PROJECTION, null, null, null,
    )?.use { cursor -> if (cursor.moveToFirst()) StateDocument(
        id = cursor.getString(0),
        uri = uri,
        flags = cursor.getInt(2),
        mimeType = cursor.getString(3) ?: "",
    ) else null }

    private fun findChild(tree: Uri, parentId: String, name: String): StateDocument? {
        val children = DocumentsContract.buildChildDocumentsUriUsingTree(tree, parentId)
        return resolver.query(children, PROJECTION, null, null, null)?.use { cursor ->
            while (cursor.moveToNext()) {
                if (cursor.getString(1) == name) return@use StateDocument(
                    id = cursor.getString(0),
                    uri = DocumentsContract.buildDocumentUriUsingTree(tree, cursor.getString(0)),
                    flags = cursor.getInt(2),
                    mimeType = cursor.getString(3) ?: "",
                )
            }
            null
        }
    }

    private fun readBounded(uri: Uri): String = resolver.openInputStream(uri)?.use { stream ->
        val bytes = stream.readNBytes(MAX_STATE_BYTES + 1)
        if (bytes.size > MAX_STATE_BYTES) throw IllegalArgumentException("state_too_large")
        bytes.toString(Charsets.UTF_8)
    } ?: throw SecurityException()

    private fun writeProvider(uri: Uri, contents: String) {
        resolver.openFileDescriptor(uri, "rwt")?.use { descriptor ->
            FileOutputStream(descriptor.fileDescriptor).use { output ->
                output.write(contents.toByteArray(Charsets.UTF_8))
                output.flush()
                output.fd.sync()
            }
        } ?: throw SecurityException()
    }

    private fun localFile(courseId: String, key: String) = File(localDirectory, CourseStateDocuments.privateKey(courseId, key) + ".json")
    private fun recoveryFile(courseId: String, key: String) = File(recoveryDirectory, CourseStateDocuments.privateKey(courseId, key) + ".json")

    private fun readPrivate(file: File): String {
        if (file.length() > MAX_STATE_BYTES) throw IllegalArgumentException("state_too_large")
        return file.readText(Charsets.UTF_8)
    }

    private fun writePrivate(file: File, contents: String) {
        val bytes = contents.toByteArray(Charsets.UTF_8)
        if (bytes.size > MAX_STATE_BYTES) throw IllegalArgumentException("state_too_large")
        file.parentFile?.mkdirs()
        val temporary = File(file.parentFile, file.name + ".tmp")
        temporary.outputStream().use { output -> output.write(bytes); output.flush() }
        if (!temporary.renameTo(file)) {
            temporary.delete()
            throw IllegalStateException("state_write_failed")
        }
    }

    private fun validate(key: String, contents: String): Boolean = if (key == "vocabulary") {
        CourseStateDocuments.validVocabulary(contents)
    } else CourseStateDocuments.validRecord(contents)

    private fun defaultContents(key: String) = if (key == "vocabulary") "[]" else "{}"

    companion object {
        private const val STATE_DIRECTORY = ".learningappoffline"
        private const val MAX_STATE_BYTES = 8 * 1024 * 1024
        private val KEYS = listOf("state", "progress", "todos", "vocabulary")
        private val PROJECTION = arrayOf(
            DocumentsContract.Document.COLUMN_DOCUMENT_ID,
            DocumentsContract.Document.COLUMN_DISPLAY_NAME,
            DocumentsContract.Document.COLUMN_FLAGS,
            DocumentsContract.Document.COLUMN_MIME_TYPE,
        )
    }
}
