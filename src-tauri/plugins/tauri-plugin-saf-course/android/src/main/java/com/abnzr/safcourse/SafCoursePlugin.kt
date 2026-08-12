package com.abnzr.safcourse

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.provider.DocumentsContract
import android.app.PictureInPictureParams
import android.content.pm.PackageManager
import android.os.Build
import android.util.Rational
import androidx.activity.result.ActivityResult
import app.tauri.annotation.ActivityCallback
import app.tauri.annotation.Command
import app.tauri.annotation.InvokeArg
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.JSArray
import app.tauri.plugin.JSObject
import app.tauri.plugin.Plugin
import java.util.UUID
import java.io.FileOutputStream
import java.io.File
import java.util.concurrent.Executors
import java.util.concurrent.ConcurrentHashMap
import org.json.JSONObject

@InvokeArg
class CourseArgs { var courseId: String? = null }

@InvokeArg
class EntryArgs { var courseId: String? = null; var entryId: String? = null; var generation: Int = 0 }

@InvokeArg
class SourceArgs { var sourceId: String? = null }

@InvokeArg
class NoteSaveArgs { var courseId: String? = null; var entryId: String? = null; var contents: String? = null; var expectedChecksum: String? = null }

@InvokeArg
class StateSaveArgs { var courseId: String? = null; var file: String? = null; var contentsJson: String? = null; var expectedRevision: String? = null }

@InvokeArg
class PictureInPictureArgs { var width: Int = 16; var height: Int = 9 }

@InvokeArg
class PlaybackStateArgs { var state: String? = null; var positionSeconds: Double = 0.0; var durationSeconds: Double = 0.0; var canPrevious: Boolean = false; var canNext: Boolean = false }

@TauriPlugin
class SafCoursePlugin(private val activity: Activity) : Plugin(activity) {
    private val registry = CourseRegistry(activity)
    private val scanner = CourseScanner(activity.contentResolver)
    private val mediaServer by lazy { SafMediaServer(activity.contentResolver) }
    private val recovery = NoteRecoveryStore(activity)
    private val stateStore by lazy {
        CourseStateStore(activity, activity.contentResolver, registry, ::hasPersistedReadGrant, ::hasPersistedWriteGrant)
    }
    private var activePlaybackSession: AndroidPlaybackSession? = null
    private val playbackSession get() = activePlaybackSession ?: AndroidPlaybackSession(activity).also { activePlaybackSession = it }
    private val worker = Executors.newSingleThreadExecutor()
    private val documents = ConcurrentHashMap<String, Map<String, NativeDocument>>()
    private var pendingCourseId: String? = null
    private var pendingUpgrade = false

    @Command
    fun pickCourse(invoke: Invoke) {
        pendingCourseId = null
        pendingUpgrade = false
        launchPicker(invoke)
    }

    @Command
    fun relinkCourse(invoke: Invoke) {
        pendingCourseId = invoke.parseArgs(CourseArgs::class.java).courseId
        if (pendingCourseId.isNullOrBlank() || registry.uri(pendingCourseId!!) == null) {
            pendingCourseId = null
            invoke.reject("Course access is unavailable.")
            return
        }
        pendingUpgrade = false
        launchPicker(invoke)
    }

    @Command
    fun upgradeCourseAccess(invoke: Invoke) {
        pendingCourseId = invoke.parseArgs(CourseArgs::class.java).courseId
        if (pendingCourseId.isNullOrBlank() || registry.uri(pendingCourseId!!) == null) {
            pendingCourseId = null
            invoke.reject("Course access is unavailable.")
            return
        }
        pendingUpgrade = true
        launchPicker(invoke)
    }

    @Command
    fun restoreCourses(invoke: Invoke) {
        worker.execute {
            val courses = registry.ids().map { courseId -> scanOrUnavailable(courseId) }
            invoke.resolve(JSObject().apply { put("courses", JSArray(courses)) })
        }
    }

    @Command
    fun scanCourse(invoke: Invoke) {
        val courseId = invoke.parseArgs(CourseArgs::class.java).courseId
        if (courseId.isNullOrBlank() || registry.uri(courseId) == null) {
            invoke.reject("Course access is unavailable.")
            return
        }
        worker.execute { invoke.resolve(scanOrUnavailable(courseId)) }
    }

    @Command
    fun prepareMedia(invoke: Invoke) {
        val args = invoke.parseArgs(EntryArgs::class.java)
        worker.execute {
            try {
                val pair = resolve(args.courseId, args.entryId)
                val uri = documentUri(pair.first, pair.second.documentId)
                val prepared = mediaServer.prepare(uri, pair.second.mimeType, pair.second.size)
                invoke.resolve(JSObject().apply {
                    put("sourceId", prepared.sourceId); put("url", prepared.url)
                    put("mimeType", prepared.mimeType); put("generation", args.generation)
                })
            } catch (_: Exception) { invoke.reject("Lesson media is unavailable.") }
        }
    }

    @Command
    fun releaseMedia(invoke: Invoke) {
        invoke.parseArgs(SourceArgs::class.java).sourceId?.let(mediaServer::release)
        invoke.resolve()
    }

    @Command
    fun readSubtitle(invoke: Invoke) {
        val args = invoke.parseArgs(EntryArgs::class.java)
        worker.execute {
            try {
                val pair = resolve(args.courseId, args.entryId)
                val extension = pair.second.name.substringAfterLast('.', "").lowercase()
                if (extension !in setOf("vtt", "srt")) throw IllegalArgumentException()
                val contents = readBounded(documentUri(pair.first, pair.second.documentId), MAX_TEXT_BYTES)
                invoke.resolve(JSObject().apply { put("format", extension); put("contents", contents); put("generation", args.generation) })
            } catch (_: Exception) { invoke.reject("Lesson subtitles are unavailable.") }
        }
    }

    @Command
    fun loadLessonNote(invoke: Invoke) {
        val args = invoke.parseArgs(EntryArgs::class.java)
        worker.execute {
            try {
                val pair = resolve(args.courseId, args.entryId)
                invoke.resolve(noteSnapshot(pair.first, args.entryId!!, pair.second))
            } catch (_: Exception) { invoke.resolve(noteState("accessRequired")) }
        }
    }

    @Command
    fun saveLessonNote(invoke: Invoke) {
        val args = invoke.parseArgs(NoteSaveArgs::class.java)
        worker.execute {
            try {
                val contents = args.contents ?: throw IllegalArgumentException()
                if (contents.toByteArray(Charsets.UTF_8).size > MAX_TEXT_BYTES) throw IllegalArgumentException()
                val pair = resolve(args.courseId, args.entryId)
                invoke.resolve(saveNote(pair.first, args.entryId!!, pair.second, contents, args.expectedChecksum))
            } catch (_: Exception) { invoke.resolve(JSObject().apply { put("status", "failed") }) }
        }
    }

    @Command
    fun saveLessonDraft(invoke: Invoke) {
        val args = invoke.parseArgs(NoteSaveArgs::class.java)
        worker.execute {
            try {
                val contents = args.contents ?: throw IllegalArgumentException()
                if (contents.toByteArray(Charsets.UTF_8).size > MAX_TEXT_BYTES) throw IllegalArgumentException()
                val pair = resolve(args.courseId, args.entryId)
                val previous = sibling(pair.first, pair.second)?.let { readBounded(documentUri(pair.first, it.documentId), MAX_TEXT_BYTES) }
                recovery.put(pair.first, args.entryId!!, previous, contents, args.expectedChecksum)
                invoke.resolve()
            } catch (_: Exception) { invoke.reject("Draft protection is unavailable.") }
        }
    }

    @Command
    fun loadCourseState(invoke: Invoke) {
        val courseId = invoke.parseArgs(CourseArgs::class.java).courseId
        if (courseId.isNullOrBlank()) {
            invoke.reject("Course state is unavailable.")
            return
        }
        worker.execute {
            try {
                val snapshot = stateStore.load(courseId)
                invoke.resolve(stateSnapshotJson(snapshot))
            } catch (_: Exception) {
                invoke.reject("Course state is unavailable.")
            }
        }
    }

    @Command
    fun loadCourseStateSources(invoke: Invoke) {
        val courseId = invoke.parseArgs(CourseArgs::class.java).courseId
        if (courseId.isNullOrBlank()) { invoke.reject("Course state is unavailable."); return }
        worker.execute {
            try {
                val sources = stateStore.loadSources(courseId)
                invoke.resolve(JSObject().apply {
                    put("portable", stateSnapshotJson(sources.portable))
                    put("local", sources.local?.let(::stateSnapshotJson) ?: JSONObject.NULL)
                })
            } catch (_: Exception) { invoke.reject("Course state is unavailable.") }
        }
    }

    @Command
    fun clearLocalCourseState(invoke: Invoke) {
        val courseId = invoke.parseArgs(CourseArgs::class.java).courseId
        if (courseId.isNullOrBlank()) { invoke.reject("Local course state could not be cleared."); return }
        worker.execute {
            if (stateStore.clearLocal(courseId)) invoke.resolve()
            else invoke.reject("Local course state could not be cleared.")
        }
    }

    @Command
    fun saveCourseStateFile(invoke: Invoke) {
        val args = invoke.parseArgs(StateSaveArgs::class.java)
        if (args.courseId.isNullOrBlank() || args.file.isNullOrBlank() || args.contentsJson == null) {
            invoke.reject("Course state could not be saved.")
            return
        }
        worker.execute {
            val result = try {
                stateStore.save(args.courseId!!, args.file!!, args.contentsJson!!, args.expectedRevision)
            } catch (_: Exception) {
                StoredStateSaveResult("failed", "localOnly")
            }
            invoke.resolve(JSObject().apply {
                put("status", result.status)
                put("storage", result.storage)
                result.revision?.let { put("revision", it) }
            })
        }
    }

    private fun stateSnapshotJson(snapshot: StoredStateSnapshot) = JSObject().apply {
        put("storage", snapshot.storage)
        put("revisions", JSObject().apply { snapshot.revisions.forEach { (key, value) -> put(key, value ?: JSONObject.NULL) } })
        put("files", JSObject().apply {
            put("state", JSONObject(snapshot.files.getValue("state")))
            put("progress", JSONObject(snapshot.files.getValue("progress")))
            put("todos", JSONObject(snapshot.files.getValue("todos")))
            put("vocabulary", org.json.JSONArray(snapshot.files.getValue("vocabulary")))
        })
    }

    @Command
    fun pickDictionaryPack(invoke: Invoke) {
        val intent = Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
            addCategory(Intent.CATEGORY_OPENABLE)
            type = "application/octet-stream"
            putExtra(Intent.EXTRA_MIME_TYPES, arrayOf("application/vnd.sqlite3", "application/x-sqlite3", "application/octet-stream"))
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
        startActivityForResult(invoke, intent, "dictionaryPickerResult")
    }

    @Command
    fun enterPictureInPicture(invoke: Invoke) {
        val args = invoke.parseArgs(PictureInPictureArgs::class.java)
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O
            || !activity.packageManager.hasSystemFeature(PackageManager.FEATURE_PICTURE_IN_PICTURE)
            || args.width !in 1..100 || args.height !in 1..100) {
            invoke.resolve(JSObject().apply { put("status", "unsupported") })
            return
        }
        activity.runOnUiThread {
            val entered = runCatching {
                val builder = PictureInPictureParams.Builder().setAspectRatio(Rational(args.width, args.height))
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) builder.setTitle("Limmud")
                activity.enterPictureInPictureMode(builder.build())
            }.getOrDefault(false)
            invoke.resolve(JSObject().apply { put("status", if (entered) "entered" else "failed") })
        }
    }

    @Command
    fun updateAndroidPlayback(invoke: Invoke) {
        val args = invoke.parseArgs(PlaybackStateArgs::class.java)
        if (args.state !in setOf("idle", "playing", "paused", "ended")
            || !args.positionSeconds.isFinite() || !args.durationSeconds.isFinite()) {
            invoke.reject("Android playback state is invalid.")
            return
        }
        val granted = playbackSession.update(args.state!!, args.positionSeconds, args.durationSeconds, args.canPrevious, args.canNext)
        invoke.resolve(JSObject().apply { put("audioFocusGranted", granted) })
    }

    @Suppress("DEPRECATION")
    override fun onDestroy() {
        activePlaybackSession?.destroy()
        activePlaybackSession = null
        mediaServer.close()
        worker.shutdownNow()
        super.onDestroy()
    }

    @ActivityCallback
    fun dictionaryPickerResult(invoke: Invoke, result: ActivityResult) {
        if (result.resultCode == Activity.RESULT_CANCELED) {
            invoke.resolve(JSObject().apply { put("status", "cancelled") })
            return
        }
        val uri = result.data?.data
        if (result.resultCode != Activity.RESULT_OK || uri == null) {
            invoke.reject("Dictionary pack selection failed.")
            return
        }
        worker.execute {
            val directory = File(activity.filesDir, "dictionary").apply { mkdirs() }
            val temporary = File(directory, "dictionary.sqlite.pending.tmp")
            val pending = File(directory, "dictionary.sqlite.pending")
            try {
                val declaredSize = activity.contentResolver.query(uri, arrayOf(android.provider.OpenableColumns.SIZE), null, null, null)?.use { cursor ->
                    if (cursor.moveToFirst() && !cursor.isNull(0)) cursor.getLong(0) else null
                }
                if (declaredSize != null && (declaredSize <= 0 || declaredSize > MAX_DICTIONARY_BYTES || directory.usableSpace < declaredSize + MIN_FREE_BYTES)) {
                    throw IllegalArgumentException()
                }
                var copied = 0L
                activity.contentResolver.openInputStream(uri)?.use { input ->
                    temporary.outputStream().use { output ->
                        val buffer = ByteArray(64 * 1024)
                        while (true) {
                            val count = input.read(buffer)
                            if (count < 0) break
                            copied += count
                            if (copied > MAX_DICTIONARY_BYTES) throw IllegalArgumentException()
                            output.write(buffer, 0, count)
                        }
                        output.flush()
                    }
                } ?: throw SecurityException()
                if (copied <= 0 || directory.usableSpace < MIN_FREE_BYTES) throw IllegalArgumentException()
                if (pending.exists() && !pending.delete()) throw IllegalStateException()
                if (!temporary.renameTo(pending)) throw IllegalStateException()
                invoke.resolve(JSObject().apply { put("status", "selected") })
            } catch (_: Exception) {
                temporary.delete()
                invoke.reject("Dictionary pack could not be copied.")
            }
        }
    }

    private fun launchPicker(invoke: Invoke) {
        val intent = Intent(Intent.ACTION_OPEN_DOCUMENT_TREE).apply {
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION)
            addFlags(Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION)
        }
        startActivityForResult(invoke, intent, "coursePickerResult")
    }

    @ActivityCallback
    fun coursePickerResult(invoke: Invoke, result: ActivityResult) {
        if (result.resultCode == Activity.RESULT_CANCELED) {
            pendingCourseId = null
            pendingUpgrade = false
            invoke.resolve(JSObject().apply { put("status", "cancelled") })
            return
        }
        val uri = result.data?.data
        if (result.resultCode != Activity.RESULT_OK || uri == null) {
            pendingCourseId = null
            invoke.reject("Course folder selection failed.")
            return
        }
        try {
            val courseId = pendingCourseId ?: UUID.randomUUID().toString()
            pendingCourseId = null
            val oldUri = registry.uri(courseId)
            val oldFlags = registry.record(courseId)?.grantFlags ?: Intent.FLAG_GRANT_READ_URI_PERMISSION
            val resultFlags = result.data?.flags ?: 0
            if (pendingUpgrade && oldUri != uri) {
                pendingUpgrade = false
                invoke.reject("The selected folder does not match this course.")
                return
            }
            pendingUpgrade = false
            val granted = resultFlags and GRANT_FLAGS
            if (resultFlags and Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION != 0 && granted != 0) {
                activity.contentResolver.takePersistableUriPermission(uri, granted)
            }
            registry.save(courseId, uri, granted)
            if (oldUri != null && oldUri != uri && hasPersistedReadGrant(oldUri)) {
                try {
                    activity.contentResolver.releasePersistableUriPermission(oldUri, oldFlags)
                } catch (_: SecurityException) {
                    // The provider may already have revoked the superseded grant.
                }
            }
            worker.execute {
                invoke.resolve(JSObject().apply {
                    put("status", "selected")
                    put("course", scanOrUnavailable(courseId))
                })
            }
        } catch (_: SecurityException) {
            pendingCourseId = null
            invoke.reject("Course access was not granted.")
        } catch (_: RuntimeException) {
            pendingCourseId = null
            invoke.reject("The selected course could not be scanned.")
        }
    }

    private fun scanOrUnavailable(courseId: String): JSObject {
        val uri = registry.uri(courseId) ?: return unavailable(courseId)
        if (!hasPersistedReadGrant(uri)) return unavailable(courseId)
        return try {
            val result = scanner.scan(courseId, uri)
            documents[courseId] = result.documents
            JSObject().apply {
                put("courseId", courseId)
                put("displayName", result.displayName)
                put("access", "available")
                put("entries", JSArray(result.entries.map(ProviderEntry::toJs)))
                put("warningCount", result.warningCount)
            }
        } catch (_: SecurityException) {
            unavailable(courseId)
        } catch (_: RuntimeException) {
            unavailable(courseId)
        }
    }

    private fun hasPersistedReadGrant(uri: Uri): Boolean = activity.contentResolver.persistedUriPermissions.any {
        it.uri == uri && it.isReadPermission
    }

    private fun hasPersistedWriteGrant(uri: Uri): Boolean = activity.contentResolver.persistedUriPermissions.any {
        it.uri == uri && it.isWritePermission
    }

    private fun resolve(courseId: String?, entryId: String?): Pair<String, NativeDocument> {
        if (courseId.isNullOrBlank() || entryId.isNullOrBlank()) throw SecurityException()
        val uri = registry.uri(courseId) ?: throw SecurityException()
        if (!hasPersistedReadGrant(uri)) throw SecurityException()
        if (documents[courseId] == null) {
            val result = scanner.scan(courseId, uri)
            documents[courseId] = result.documents
        }
        return courseId to (documents[courseId]?.get(entryId) ?: throw SecurityException())
    }

    private fun documentUri(courseId: String, documentId: String): Uri {
        val tree = registry.uri(courseId) ?: throw SecurityException()
        return DocumentsContract.buildDocumentUriUsingTree(tree, documentId)
    }

    private fun readBounded(uri: Uri, limit: Int): String {
        val stream = activity.contentResolver.openInputStream(uri) ?: throw SecurityException()
        return stream.use {
            val bytes = it.readNBytes(limit + 1)
            if (bytes.size > limit) throw IllegalArgumentException()
            bytes.toString(Charsets.UTF_8)
        }
    }

    private fun sibling(courseId: String, lesson: NativeDocument): NativeDocument? {
        val name = LessonNotes.canonicalName(lesson.name)
        return documents[courseId]?.values?.firstOrNull { it.parentId == lesson.parentId && it.name == name }
    }

    private fun noteSnapshot(courseId: String, lessonId: String, lesson: NativeDocument): JSObject {
        val tree = registry.uri(courseId) ?: return noteState("accessRequired")
        val note = sibling(courseId, lesson)
        val parent = documents[courseId]?.values?.firstOrNull { it.documentId == lesson.parentId }
        val create = parent?.flags?.and(DocumentsContract.Document.FLAG_DIR_SUPPORTS_CREATE) != 0
        if (note == null) return noteState(
            if (hasPersistedWriteGrant(tree) && create) "absent" else if (create) "writeAccessRequired" else "creationUnsupported",
            canCreate = create,
            draft = recovery.pending(courseId, lessonId),
        )
        val contents = readBounded(documentUri(courseId, note.documentId), MAX_TEXT_BYTES)
        val writable = note.flags and DocumentsContract.Document.FLAG_SUPPORTS_WRITE != 0
        val status = if (hasPersistedWriteGrant(tree) && writable) "editable" else if (writable) "writeAccessRequired" else "readOnly"
        return noteState(status, contents, LessonNotes.checksum(contents), create, writable, recovery.pending(courseId, lessonId))
    }

    private fun noteState(status: String, contents: String = "", checksum: String? = null, canCreate: Boolean = false, canWrite: Boolean = false, draft: String? = null) = JSObject().apply {
        put("status", status); put("contents", contents); put("checksum", checksum ?: JSONObject.NULL)
        put("canCreate", canCreate); put("canWrite", canWrite)
        if (draft != null) put("draft", draft)
    }

    private fun saveNote(courseId: String, lessonId: String, lesson: NativeDocument, contents: String, expected: String?): JSObject {
        val tree = registry.uri(courseId) ?: return JSObject().apply { put("status", "accessRequired") }
        if (!hasPersistedWriteGrant(tree)) return JSObject().apply { put("status", "writeAccessRequired") }
        var note = sibling(courseId, lesson)
        val previous = note?.let { readBounded(documentUri(courseId, it.documentId), MAX_TEXT_BYTES) }
        val currentChecksum = previous?.let(LessonNotes::checksum)
        if (currentChecksum != expected) return JSObject().apply { put("status", "conflict"); put("checksum", currentChecksum ?: "absent") }
        recovery.put(courseId, lessonId, previous, contents, expected)
        var noteUri = note?.let { documentUri(courseId, it.documentId) }
        if (noteUri == null) {
            val parent = documents[courseId]?.values?.firstOrNull { it.documentId == lesson.parentId }
            if (parent?.flags?.and(DocumentsContract.Document.FLAG_DIR_SUPPORTS_CREATE) == 0) return JSObject().apply { put("status", "creationUnsupported") }
            note = sibling(courseId, lesson)
            noteUri = note?.let { documentUri(courseId, it.documentId) } ?: DocumentsContract.createDocument(
                activity.contentResolver, documentUri(courseId, lesson.parentId), "text/markdown", LessonNotes.canonicalName(lesson.name)
            ) ?: return JSObject().apply { put("status", "failed") }
        } else if (note!!.flags and DocumentsContract.Document.FLAG_SUPPORTS_WRITE == 0) {
            return JSObject().apply { put("status", "creationUnsupported") }
        }
        val descriptor = activity.contentResolver.openFileDescriptor(noteUri, "rwt") ?: return JSObject().apply { put("status", "failed") }
        descriptor.use { pfd -> FileOutputStream(pfd.fileDescriptor).use { stream -> stream.write(contents.toByteArray(Charsets.UTF_8)); stream.flush(); stream.fd.sync() } }
        val verified = readBounded(noteUri, MAX_TEXT_BYTES)
        if (verified != contents) return JSObject().apply { put("status", "failed") }
        recovery.clear(courseId, lessonId)
        documents.remove(courseId)
        val checksum = LessonNotes.checksum(contents)
        return JSObject().apply { put("status", "saved"); put("checksum", checksum) }
    }

    private fun unavailable(courseId: String) = JSObject().apply {
        put("courseId", courseId)
        put("displayName", "Saved course")
        put("access", "accessRequired")
        put("entries", JSArray())
        put("warningCount", 0)
    }

    companion object {
        private const val GRANT_FLAGS = Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION
        private const val MAX_TEXT_BYTES = 2 * 1024 * 1024
        private const val MAX_DICTIONARY_BYTES = 2L * 1024 * 1024 * 1024
        private const val MIN_FREE_BYTES = 16L * 1024 * 1024
    }
}
