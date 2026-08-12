package com.abnzr.safcourse

import java.io.IOException
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertThrows
import org.junit.Test

class MediaRangeTest {
    @Test fun parsesClosedOpenAndSuffixRanges() {
        assertEquals(ByteRange(10, 19), MediaRange.parse("bytes=10-19", 100))
        assertEquals(ByteRange(90, 99), MediaRange.parse("bytes=90-", 100))
        assertEquals(ByteRange(95, 99), MediaRange.parse("bytes=-5", 100))
    }

    @Test fun rejectsMultipleMalformedAndUnsatisfiableRanges() {
        assertNull(MediaRange.parse("bytes=0-1,4-5", 100))
        assertNull(MediaRange.parse("bytes=word", 100))
        assertNull(MediaRange.parse("bytes=100-", 100))
        assertNull(MediaRange.parse("bytes=-0", 100))
    }

    @Test fun clientDisconnectsAreContainedWithoutHidingProgrammingErrors() {
        runMediaClientSafely { throw IOException("synthetic disconnect") }

        assertThrows(IllegalStateException::class.java) {
            runMediaClientSafely { throw IllegalStateException("synthetic bug") }
        }
    }
}
