package com.abnzr.safcourse

import android.content.ContentResolver
import android.net.Uri
import android.provider.DocumentsContract

internal data class NativeDocument(
    val documentId: String,
    val parentId: String,
    val name: String,
    val mimeType: String,
    val flags: Int,
    val size: Long?,
)

internal data class CourseScan(
    val displayName: String,
    val entries: List<ProviderEntry>,
    val warningCount: Int,
    val documents: Map<String, NativeDocument>,
)

internal class CourseScanner(private val resolver: ContentResolver) {
    fun scan(courseId: String, treeUri: Uri): CourseScan {
        val rootId = DocumentsContract.getTreeDocumentId(treeUri)
        val rootUri = DocumentsContract.buildDocumentUriUsingTree(treeUri, rootId)
        val root = document(rootUri, rootId) ?: throw SecurityException("Course tree is unavailable")
        val warnings = intArrayOf(0)
        val documents = mutableMapOf<String, NativeDocument>()
        documents[CoursePrivacy.opaqueId(courseId, rootId)] = root
        return CourseScan(root.name, children(courseId, treeUri, rootId, "", warnings, documents), warnings[0], documents)
    }

    private fun document(uri: Uri, parentId: String): NativeDocument? = resolver.query(
        uri, PROJECTION, null, null, null
    )?.use { cursor -> if (cursor.moveToFirst()) NativeDocument(
        documentId = cursor.getString(0), parentId = parentId, name = cursor.getString(1),
        mimeType = cursor.getString(2) ?: "", flags = cursor.getInt(3),
        size = if (cursor.isNull(4)) null else cursor.getLong(4),
    ) else null }

    private fun children(
        courseId: String,
        treeUri: Uri,
        parentId: String,
        parentPath: String,
        warnings: IntArray,
        documents: MutableMap<String, NativeDocument>,
    ): List<ProviderEntry> {
        val childUri = DocumentsContract.buildChildDocumentsUriUsingTree(treeUri, parentId)
        val rows = mutableListOf<NativeDocument>()
        try {
            resolver.query(childUri, PROJECTION, null, null, null)?.use { cursor ->
                while (cursor.moveToNext()) {
                    val documentId = cursor.getString(0) ?: continue
                    val name = cursor.getString(1) ?: continue
                    if (name.startsWith('.')) continue
                    rows += NativeDocument(
                        documentId = documentId,
                        parentId = parentId,
                        name = name,
                        mimeType = cursor.getString(2) ?: "",
                        flags = cursor.getInt(3),
                        size = if (cursor.isNull(4)) null else cursor.getLong(4),
                    )
                }
            } ?: warnings.increment()
        } catch (_: SecurityException) {
            warnings.increment()
        } catch (_: RuntimeException) {
            warnings.increment()
        }
        return rows.sortedWith { a, b -> CourseClassification.compareNaturally(a.name, b.name) }
            .map { document ->
                val directory = document.mimeType == DocumentsContract.Document.MIME_TYPE_DIR
                val documentId = document.documentId
                val name = document.name
                val relativePath = if (parentPath.isEmpty()) name else "$parentPath/$name"
                documents[CoursePrivacy.opaqueId(courseId, documentId)] = document
                ProviderEntry(
                    id = CoursePrivacy.opaqueId(courseId, documentId),
                    name = name,
                    relativePath = relativePath,
                    kind = CourseClassification.kind(name, directory),
                    children = if (directory) children(courseId, treeUri, documentId, relativePath, warnings, documents) else null,
                )
            }
    }

    private fun IntArray.increment() { this[0] += 1 }

    companion object {
        private val PROJECTION = arrayOf(
            DocumentsContract.Document.COLUMN_DOCUMENT_ID,
            DocumentsContract.Document.COLUMN_DISPLAY_NAME,
            DocumentsContract.Document.COLUMN_MIME_TYPE,
            DocumentsContract.Document.COLUMN_FLAGS,
            DocumentsContract.Document.COLUMN_SIZE,
        )
    }
}
