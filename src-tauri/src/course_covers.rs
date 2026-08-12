use std::path::{Path, PathBuf};

pub fn install(course_root: &str, source: &Path, directory: &Path) -> Result<PathBuf, String> {
    let extension = source
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();
    if !matches!(extension.as_str(), "png" | "jpg" | "jpeg" | "webp") {
        return Err("Unsupported cover image type".into());
    }
    if !source.is_file() {
        return Err("Cover image is unavailable".into());
    }
    std::fs::create_dir_all(directory).map_err(|error| error.to_string())?;
    let target = directory.join(format!("{}.{}", cover_stem(course_root), extension));
    std::fs::copy(source, &target).map_err(|error| error.to_string())?;
    Ok(target)
}

pub fn remove(course_root: &str, directory: &Path) -> Result<(), String> {
    let stem = cover_stem(course_root);
    if !directory.exists() {
        return Ok(());
    }
    for entry in std::fs::read_dir(directory).map_err(|error| error.to_string())? {
        let path = entry.map_err(|error| error.to_string())?.path();
        if path.file_stem().and_then(|value| value.to_str()) == Some(&stem) {
            std::fs::remove_file(path).map_err(|error| error.to_string())?;
        }
    }
    Ok(())
}

fn cover_stem(course_root: &str) -> String {
    let hash = course_root
        .as_bytes()
        .iter()
        .fold(0xcbf29ce484222325_u64, |hash, byte| {
            (hash ^ u64::from(*byte)).wrapping_mul(0x100000001b3)
        });
    format!("course-{hash:016x}")
}

#[cfg(test)]
mod tests {
    use super::{install, remove};
    use std::fs;

    fn fixture(label: &str) -> std::path::PathBuf {
        std::env::temp_dir().join(format!("limmud-cover-{label}-{}", std::process::id()))
    }

    #[test]
    fn install_copies_supported_image_into_owned_directory() {
        let root = fixture("install");
        let source = root.join("source.webp");
        let covers = root.join("covers");
        fs::create_dir_all(&root).expect("fixture directory");
        fs::write(&source, b"synthetic-image").expect("fixture image");
        let installed = install("/synthetic/course-a", &source, &covers).expect("install cover");
        assert_eq!(
            fs::read(installed).expect("installed image"),
            b"synthetic-image"
        );
        fs::remove_dir_all(root).expect("remove fixture");
    }

    #[test]
    fn install_rejects_unsupported_extensions() {
        let root = fixture("reject");
        let source = root.join("source.svg");
        fs::create_dir_all(&root).expect("fixture directory");
        fs::write(&source, b"synthetic-image").expect("fixture image");
        assert!(install("/synthetic/course-a", &source, &root.join("covers")).is_err());
        fs::remove_dir_all(root).expect("remove fixture");
    }

    #[test]
    fn remove_deletes_only_the_matching_app_owned_cover() {
        let root = fixture("remove");
        let covers = root.join("covers");
        let first_source = root.join("first.png");
        let second_source = root.join("second.jpg");
        fs::create_dir_all(&root).expect("fixture directory");
        fs::write(&first_source, b"first").expect("first fixture");
        fs::write(&second_source, b"second").expect("second fixture");
        let first = install("/synthetic/course-a", &first_source, &covers).expect("first cover");
        let second = install("/synthetic/course-b", &second_source, &covers).expect("second cover");
        remove("/synthetic/course-a", &covers).expect("remove first cover");
        assert!(!first.exists());
        assert!(second.exists());
        fs::remove_dir_all(root).expect("remove fixture");
    }
}
