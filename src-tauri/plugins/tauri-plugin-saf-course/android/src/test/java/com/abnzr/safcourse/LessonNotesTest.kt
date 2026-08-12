package com.abnzr.safcourse

import org.junit.Assert.assertEquals
import org.junit.Test

class LessonNotesTest {
    @Test fun canonicalNameMatchesDesktopWithExtensionConvention() {
        assertEquals("lesson_01.notes.md", LessonNotes.canonicalName("lesson_01.mp4"))
        assertEquals("lesson.with.dots.notes.md", LessonNotes.canonicalName("lesson.with.dots.mkv"))
    }

    @Test fun checksumPreservesExactMarkdownBytes() {
        assertEquals(
            "86196fc716acc9983a95b9d17089ce915ac3df528b2429caeb62c285bcd4bd96",
            LessonNotes.checksum("# Synthetic\n\nUnicode: שלום\n"),
        )
    }
}
