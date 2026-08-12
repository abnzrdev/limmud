package com.abnzr.safcourse

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Test

class CourseModelsTest {
    @Test fun classificationMatchesDesktopScanner() {
        assertEquals("video", CourseClassification.kind("Lesson.MP4", false))
        assertEquals("subtitle", CourseClassification.kind("Lesson.srt", false))
        assertEquals("note", CourseClassification.kind("Lesson.md", false))
        assertEquals("directory", CourseClassification.kind("Week 1", true))
        assertEquals("other", CourseClassification.kind("archive.zip", false))
    }

    @Test fun naturalSortOrdersNumericLessons() {
        val values = listOf("Lesson 10", "Lesson 2", "Lesson 1").sortedWith(CourseClassification::compareNaturally)
        assertEquals(listOf("Lesson 1", "Lesson 2", "Lesson 10"), values)
    }

    @Test fun opaqueIdentityDoesNotRevealProviderValues() {
        val id = CoursePrivacy.opaqueId("course-safe", "provider-secret")
        assertEquals(64, id.length)
        assertFalse(id.contains("course-safe"))
        assertFalse(id.contains("provider-secret"))
    }

    @Test fun registryCodecMigratesLegacyReadOnlyValue() {
        val record = CourseRegistryCodec.decode("content://synthetic/tree")
        assertEquals("content://synthetic/tree", record.uri)
        assertEquals(android.content.Intent.FLAG_GRANT_READ_URI_PERMISSION, record.grantFlags)
    }

    @Test fun registryCodecRoundTripsGrantedFlagsWithoutDisplayMetadata() {
        val encoded = CourseRegistryCodec.encode(RegistryRecord("content://synthetic/tree", 3))
        assertEquals(RegistryRecord("content://synthetic/tree", 3), CourseRegistryCodec.decode(encoded))
        assertFalse(encoded.contains("courseName"))
    }
}
