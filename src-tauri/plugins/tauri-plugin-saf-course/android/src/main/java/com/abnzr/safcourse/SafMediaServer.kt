package com.abnzr.safcourse

import android.content.ContentResolver
import android.net.Uri
import java.io.BufferedInputStream
import java.io.BufferedOutputStream
import java.io.FileInputStream
import java.io.IOException
import java.net.InetAddress
import java.net.ServerSocket
import java.net.Socket
import java.security.SecureRandom
import java.util.Base64
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.Executors

internal data class PreparedSource(val sourceId: String, val url: String, val mimeType: String)

internal inline fun runMediaClientSafely(block: () -> Unit) {
    try {
        block()
    } catch (_: IOException) {
        // Browsers routinely cancel obsolete range requests during seeking and source changes.
    }
}

internal class SafMediaServer(private val resolver: ContentResolver) {
    private data class Source(val uri: Uri, val mimeType: String, val length: Long, val expiresAtEpochMs: Long)
    private val sources = ConcurrentHashMap<String, Source>()
    private val sourceTokens = ConcurrentHashMap<String, String>()
    private val executor = Executors.newCachedThreadPool()
    private val socket = ServerSocket(0, 16, InetAddress.getByName("127.0.0.1"))
    private val random = SecureRandom()

    init { executor.execute(::acceptLoop) }

    fun prepare(uri: Uri, mimeType: String, declaredLength: Long?): PreparedSource {
        val descriptor = resolver.openAssetFileDescriptor(uri, "r") ?: throw IllegalStateException("media_unavailable")
        val length = descriptor.use { afd -> if (afd.length >= 0) afd.length else declaredLength ?: -1L }
        if (length <= 0) throw IllegalStateException("media_length_unavailable")
        val tokenBytes = ByteArray(24).also(random::nextBytes)
        val token = Base64.getUrlEncoder().withoutPadding().encodeToString(tokenBytes)
        val sourceId = UUID.randomUUID().toString()
        sources[token] = Source(uri, mimeType.ifBlank { "application/octet-stream" }, length, System.currentTimeMillis() + SOURCE_LIFETIME_MS)
        sourceTokens[sourceId] = token
        return PreparedSource(sourceId, "http://127.0.0.1:${socket.localPort}/media/$token", mimeType.ifBlank { "application/octet-stream" })
    }

    fun release(sourceId: String) {
        sourceTokens.remove(sourceId)?.let(sources::remove)
    }

    fun close() {
        sources.clear()
        sourceTokens.clear()
        socket.close()
        executor.shutdownNow()
    }

    private fun acceptLoop() {
        while (!socket.isClosed) {
            try {
                val client = socket.accept()
                executor.execute { runMediaClientSafely { handle(client) } }
            } catch (_: Exception) { return }
        }
    }

    private fun handle(client: Socket) {
        client.use { connection ->
            connection.soTimeout = 15_000
            val input = BufferedInputStream(connection.getInputStream())
            val output = BufferedOutputStream(connection.getOutputStream())
            val request = readLine(input) ?: return
            val parts = request.split(' ')
            if (parts.size < 2 || parts[0] !in setOf("GET", "HEAD")) return respond(output, 405, "Method Not Allowed", emptyMap())
            val token = parts[1].removePrefix("/media/").takeIf { parts[1] == "/media/$it" }
            val source = token?.let(sources::get) ?: return respond(output, 404, "Not Found", emptyMap())
            if (source.expiresAtEpochMs < System.currentTimeMillis()) {
                sources.remove(token)
                sourceTokens.entries.removeIf { it.value == token }
                return respond(output, 404, "Not Found", emptyMap())
            }
            var rangeHeader: String? = null
            var headerCount = 0
            while (headerCount < MAX_HEADER_LINES) {
                val line = readLine(input) ?: break
                if (line.isEmpty()) break
                if (line.startsWith("Range:", true)) rangeHeader = line.substringAfter(':').trim()
                headerCount += 1
            }
            val range = if (rangeHeader == null) ByteRange(0, source.length - 1) else MediaRange.parse(rangeHeader, source.length)
            if (range == null) return respond(output, 416, "Range Not Satisfiable", mapOf("Content-Range" to "bytes */${source.length}"))
            val partial = rangeHeader != null
            val headers = linkedMapOf(
                "Content-Type" to source.mimeType,
                "Content-Length" to range.length.toString(),
                "Accept-Ranges" to "bytes",
                "Access-Control-Allow-Origin" to "*",
                "Cache-Control" to "no-store",
            )
            if (partial) headers["Content-Range"] = "bytes ${range.start}-${range.endInclusive}/${source.length}"
            writeHeaders(output, if (partial) 206 else 200, if (partial) "Partial Content" else "OK", headers)
            if (parts[0] == "HEAD") { output.flush(); return }
            val afd = resolver.openAssetFileDescriptor(source.uri, "r") ?: return
            afd.use { descriptor ->
                FileInputStream(descriptor.fileDescriptor).use { stream ->
                    val channel = stream.channel
                    channel.position(descriptor.startOffset + range.start)
                    var remaining = range.length
                    val buffer = ByteArray(64 * 1024)
                    while (remaining > 0) {
                        val count = stream.read(buffer, 0, minOf(buffer.size.toLong(), remaining).toInt())
                        if (count < 0) break
                        output.write(buffer, 0, count)
                        remaining -= count
                    }
                    output.flush()
                }
            }
        }
    }

    private fun readLine(input: BufferedInputStream): String? {
        val bytes = ArrayList<Byte>()
        while (bytes.size <= 8192) {
            val value = input.read()
            if (value < 0) return if (bytes.isEmpty()) null else bytes.toByteArray().toString(Charsets.US_ASCII)
            if (value == '\n'.code) break
            if (value != '\r'.code) bytes.add(value.toByte())
        }
        return bytes.toByteArray().toString(Charsets.US_ASCII)
    }

    private fun respond(output: BufferedOutputStream, code: Int, reason: String, headers: Map<String, String>) {
        writeHeaders(output, code, reason, headers + ("Content-Length" to "0")); output.flush()
    }

    private fun writeHeaders(output: BufferedOutputStream, code: Int, reason: String, headers: Map<String, String>) {
        output.write("HTTP/1.1 $code $reason\r\nConnection: close\r\n".toByteArray(Charsets.US_ASCII))
        headers.forEach { (name, value) -> output.write("$name: $value\r\n".toByteArray(Charsets.US_ASCII)) }
        output.write("\r\n".toByteArray(Charsets.US_ASCII))
    }

    companion object {
        private const val SOURCE_LIFETIME_MS = 12L * 60 * 60 * 1000
        private const val MAX_HEADER_LINES = 100
    }
}
