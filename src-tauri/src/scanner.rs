use std::cmp::Ordering;
use std::fs;
use std::io;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ScannedEntry {
    pub id: String,
    pub name: String,
    pub relative_path: String,
    pub absolute_path: String,
    pub kind: String,
    pub children: Option<Vec<ScannedEntry>>,
}

pub fn classify_extension(ext: &str) -> &'static str {
    match ext.to_ascii_lowercase().as_str() {
        "mp4" | "mkv" | "webm" => "video",
        "vtt" | "srt" => "subtitle",
        "md" | "txt" => "note",
        "png" | "jpg" | "jpeg" | "webp" => "image",
        "mp3" | "wav" | "m4a" | "ogg" => "audio",
        _ => "other",
    }
}

pub fn scan_course(root: &Path) -> io::Result<Vec<ScannedEntry>> {
    scan_dir(root, root)
}

fn scan_dir(root: &Path, current: &Path) -> io::Result<Vec<ScannedEntry>> {
    let mut paths: Vec<PathBuf> = fs::read_dir(current)?
        .map(|entry| entry.map(|entry| entry.path()))
        .collect::<io::Result<Vec<_>>>()?;
    paths.sort_by(|a, b| natural_path_cmp(a, b));

    let mut entries = Vec::with_capacity(paths.len());
    for path in paths {
        if should_skip_path(&path) {
            continue;
        }

        let metadata = fs::metadata(&path)?;
        let name = path
            .file_name()
            .and_then(|value| value.to_str())
            .unwrap_or_default()
            .to_string();
        let relative_path = normalize_relative_path(root, &path);
        let kind = if metadata.is_dir() {
            "directory".to_string()
        } else {
            path.extension()
                .and_then(|value| value.to_str())
                .map(classify_extension)
                .unwrap_or("other")
                .to_string()
        };

        let children = if metadata.is_dir() {
            Some(scan_dir(root, &path)?)
        } else {
            None
        };

        entries.push(ScannedEntry {
            id: relative_path.to_lowercase(),
            name,
            relative_path,
            absolute_path: path.to_string_lossy().to_string(),
            kind,
            children,
        });
    }

    Ok(entries)
}

fn normalize_relative_path(root: &Path, path: &Path) -> String {
    path.strip_prefix(root)
        .unwrap_or(path)
        .to_string_lossy()
        .replace('\\', "/")
}

fn should_skip_path(path: &Path) -> bool {
    path.file_name()
        .and_then(|value| value.to_str())
        .map(|name| {
            name.starts_with('.')
                || matches!(
                    name,
                    "node_modules"
                        | "target"
                        | "build"
                        | "dist"
                        | "state.json"
                        | "progress.json"
                        | "todos.json"
                )
        })
        .unwrap_or(false)
}

fn natural_path_cmp(a: &Path, b: &Path) -> Ordering {
    let a_name = a
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or_default();
    let b_name = b
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or_default();
    natural_cmp(a_name, b_name).then_with(|| a.cmp(b))
}

fn natural_cmp(a: &str, b: &str) -> Ordering {
    let mut a_pos = 0;
    let mut b_pos = 0;

    while a_pos < a.len() && b_pos < b.len() {
        let (a_chunk, next_a) = next_chunk(a, a_pos);
        let (b_chunk, next_b) = next_chunk(b, b_pos);
        let ordering = if is_ascii_number(a_chunk) && is_ascii_number(b_chunk) {
            compare_number_chunks(a_chunk, b_chunk)
        } else {
            a_chunk.to_lowercase().cmp(&b_chunk.to_lowercase())
        };

        if ordering != Ordering::Equal {
            return ordering;
        }

        a_pos = next_a;
        b_pos = next_b;
    }

    a.len().cmp(&b.len()).then_with(|| a.cmp(b))
}

fn next_chunk(value: &str, start: usize) -> (&str, usize) {
    let digit_chunk = value[start..]
        .chars()
        .next()
        .map(|char| char.is_ascii_digit())
        .unwrap_or(false);

    for (offset, char) in value[start..].char_indices().skip(1) {
        if char.is_ascii_digit() != digit_chunk {
            let end = start + offset;
            return (&value[start..end], end);
        }
    }

    (&value[start..], value.len())
}

fn is_ascii_number(value: &str) -> bool {
    value.as_bytes().iter().all(u8::is_ascii_digit)
}

fn compare_number_chunks(a: &str, b: &str) -> Ordering {
    let a_digits = a.trim_start_matches('0');
    let b_digits = b.trim_start_matches('0');
    let a_digits = if a_digits.is_empty() { "0" } else { a_digits };
    let b_digits = if b_digits.is_empty() { "0" } else { b_digits };

    a_digits
        .len()
        .cmp(&b_digits.len())
        .then_with(|| a_digits.cmp(b_digits))
        .then_with(|| a.len().cmp(&b.len()))
}

#[cfg(test)]
mod course_noise_filter_tests {
    use super::should_skip_path;
    use std::path::Path;

    #[test]
    fn hides_tooling_and_generated_folders() {
        assert!(should_skip_path(Path::new(".flutter_toolchain")));
        assert!(should_skip_path(Path::new(".git")));
        assert!(should_skip_path(Path::new("node_modules")));
        assert!(should_skip_path(Path::new("target")));
        assert!(should_skip_path(Path::new("build")));
    }

    #[test]
    fn keeps_normal_course_folders_and_videos() {
        assert!(!should_skip_path(Path::new("1. Introduction")));
        assert!(!should_skip_path(Path::new("lesson.mp4")));
    }
}
