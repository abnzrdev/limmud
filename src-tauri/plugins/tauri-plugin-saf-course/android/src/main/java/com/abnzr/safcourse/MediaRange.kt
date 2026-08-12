package com.abnzr.safcourse

internal data class ByteRange(val start: Long, val endInclusive: Long) {
    val length: Long get() = endInclusive - start + 1
}

internal object MediaRange {
    fun parse(header: String?, length: Long): ByteRange? {
        if (header == null || length <= 0 || !header.startsWith("bytes=") || header.contains(',')) return null
        val value = header.removePrefix("bytes=")
        val separator = value.indexOf('-')
        if (separator < 0) return null
        val first = value.substring(0, separator)
        val second = value.substring(separator + 1)
        return try {
            if (first.isEmpty()) {
                val suffix = second.toLong()
                if (suffix <= 0) null else ByteRange((length - suffix).coerceAtLeast(0), length - 1)
            } else {
                val start = first.toLong()
                val end = if (second.isEmpty()) length - 1 else second.toLong().coerceAtMost(length - 1)
                if (start < 0 || start >= length || end < start) null else ByteRange(start, end)
            }
        } catch (_: NumberFormatException) {
            null
        }
    }
}
