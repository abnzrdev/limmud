package com.abnzr.safcourse

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class CourseStateDocumentsTest {
    @Test
    fun canonicalFilesMatchDesktopWithoutExposingArbitraryChildren() {
        assertEquals("state.json", CourseStateDocuments.fileName("state"))
        assertEquals("progress.json", CourseStateDocuments.fileName("progress"))
        assertEquals("todos.json", CourseStateDocuments.fileName("todos"))
        assertEquals("vocabulary.json", CourseStateDocuments.fileName("vocabulary"))
        assertEquals(null, CourseStateDocuments.fileName("../state"))
        assertEquals(null, CourseStateDocuments.fileName("notes"))
    }

    @Test
    fun revisionIsStableSha256AndChangesWithContent() {
        val first = CourseStateDocuments.revision("{\"todos\":\"[]\"}")
        assertEquals(64, first.length)
        assertEquals(first, CourseStateDocuments.revision("{\"todos\":\"[]\"}"))
        assertFalse(first == CourseStateDocuments.revision("{\"todos\":\"[1]\"}"))
    }

    @Test
    fun privateKeyDoesNotRevealCourseIdentity() {
        val key = CourseStateDocuments.privateKey("course-safe", "progress")
        assertEquals(64, key.length)
        assertFalse(key.contains("course-safe"))
        assertFalse(key.contains("progress"))
        assertTrue(key.matches(Regex("[a-f0-9]{64}")))
    }

    @Test
    fun outerRecordValidationRejectsMalformedAndNonStringValues() {
        assertTrue(CourseStateDocuments.validRecord("{\"timerMode\":\"focus\",\"future\":\"keep\"}"))
        assertFalse(CourseStateDocuments.validRecord("[]"))
        assertFalse(CourseStateDocuments.validRecord("{\"timerPreset\":25}"))
        assertFalse(CourseStateDocuments.validRecord("not-json"))
    }

    @Test
    fun vocabularyValidationRequiresAnArrayWithoutReformattingIt() {
        val contents = "[ {\"id\":\"safe\",\"future\":9} ]"
        assertTrue(CourseStateDocuments.validVocabulary(contents))
        assertEquals(contents, CourseStateDocuments.preserve(contents))
        assertFalse(CourseStateDocuments.validVocabulary("{}"))
        assertFalse(CourseStateDocuments.validVocabulary("not-json"))
    }
}
