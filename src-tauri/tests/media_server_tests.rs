#[path = "../src/media_server.rs"]
mod media_server;

use std::fs;
use std::io::{Cursor, Read, Write};
use std::net::TcpStream;
use std::path::PathBuf;
use std::thread;
use std::time::Duration;
use std::time::{SystemTime, UNIX_EPOCH};

fn make_temp_course_dir() -> PathBuf {
    let unique = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("time went backwards")
        .as_nanos();
    let root = std::env::temp_dir().join(format!("limmud-media-{unique}"));
    fs::create_dir_all(&root).expect("create temp dir");
    root
}

#[test]
fn creates_http_media_url_for_nested_video_with_spaces() {
    let root = make_temp_course_dir();
    let lesson_dir = root.join("0. Introduction");
    let video_path = lesson_dir.join("01. Course introduction.mp4");
    fs::create_dir_all(&lesson_dir).expect("create lesson dir");
    fs::write(&video_path, b"fake mp4 bytes").expect("write video");

    let url = media_server::course_media_url(
        root.to_string_lossy().to_string(),
        video_path.to_string_lossy().to_string(),
    )
    .expect("build media url");

    assert!(url.starts_with("http://127.0.0.1:"));
    assert!(url.contains("0.%20Introduction/01.%20Course%20introduction.mp4"));
    assert!(!url.contains("asset://"));

    fs::remove_dir_all(root).expect("cleanup");
}

#[test]
fn rejects_media_paths_outside_course_root() {
    let root = make_temp_course_dir();
    let outside = make_temp_course_dir().join("outside.mp4");
    fs::write(&outside, b"video").expect("write outside video");

    let result = media_server::course_media_url(
        root.to_string_lossy().to_string(),
        outside.to_string_lossy().to_string(),
    );

    assert!(result.is_err());

    fs::remove_dir_all(root).expect("cleanup root");
    fs::remove_file(outside).expect("cleanup outside");
}

#[test]
fn serves_byte_ranges_for_video_elements() {
    let root = make_temp_course_dir();
    let video_path = root.join("lesson.mp4");
    fs::write(&video_path, b"0123456789").expect("write video");

    let url = media_server::course_media_url(
        root.to_string_lossy().to_string(),
        video_path.to_string_lossy().to_string(),
    )
    .expect("build media url");
    let (host_port, path) = url
        .trim_start_matches("http://")
        .split_once('/')
        .expect("split url");
    let mut stream = TcpStream::connect(host_port).expect("connect media server");
    write!(
        stream,
        "GET /{path} HTTP/1.1\r\nHost: {host_port}\r\nRange: bytes=2-5\r\n\r\n"
    )
    .expect("write request");

    let mut response = String::new();
    stream.read_to_string(&mut response).expect("read response");

    assert!(response.starts_with("HTTP/1.1 206 Partial Content"));
    assert!(response.contains("Content-Range: bytes 2-5/10"));
    assert!(response.ends_with("2345"));

    fs::remove_dir_all(root).expect("cleanup");
}

#[test]
fn serves_full_video_responses() {
    let root = make_temp_course_dir();
    let video_path = root.join("lesson.mp4");
    fs::write(&video_path, b"0123456789").expect("write video");

    let url = media_server::course_media_url(
        root.to_string_lossy().to_string(),
        video_path.to_string_lossy().to_string(),
    )
    .expect("build media url");
    let (host_port, path) = url
        .trim_start_matches("http://")
        .split_once('/')
        .expect("split url");
    let mut stream = TcpStream::connect(host_port).expect("connect media server");
    write!(stream, "GET /{path} HTTP/1.1\r\nHost: {host_port}\r\n\r\n").expect("write request");

    let mut response = String::new();
    stream.read_to_string(&mut response).expect("read response");

    assert!(response.starts_with("HTTP/1.1 200 OK"));
    assert!(response.contains("Content-Type: video/mp4"));
    assert!(response.contains("Content-Length: 10"));
    assert!(response.contains("Accept-Ranges: bytes"));
    assert!(response.ends_with("0123456789"));

    fs::remove_dir_all(root).expect("cleanup");
}

#[test]
fn waits_for_complete_http_headers_before_responding() {
    let root = make_temp_course_dir();
    let video_path = root.join("lesson.mp4");
    fs::write(&video_path, b"0123456789").expect("write video");

    let url = media_server::course_media_url(
        root.to_string_lossy().to_string(),
        video_path.to_string_lossy().to_string(),
    )
    .expect("build media url");
    let (host_port, path) = url
        .trim_start_matches("http://")
        .split_once('/')
        .expect("split url");
    let mut stream = TcpStream::connect(host_port).expect("connect media server");
    write!(
        stream,
        "GET /{path} HTTP/1.1\r\nHost: {host_port}\r\nRange:"
    )
    .expect("write first request segment");
    thread::sleep(Duration::from_millis(20));
    write!(stream, " bytes=2-5\r\n\r\n").expect("write final request segment");

    let mut response = String::new();
    stream.read_to_string(&mut response).expect("read response");

    assert!(response.starts_with("HTTP/1.1 206 Partial Content"));
    assert!(response.ends_with("2345"));

    fs::remove_dir_all(root).expect("cleanup");
}

#[test]
fn serves_open_ended_byte_ranges() {
    let root = make_temp_course_dir();
    let video_path = root.join("lesson.mp4");
    fs::write(&video_path, b"0123456789").expect("write video");

    let response = request_media(&root, &video_path, "GET", Some("bytes=6-"));

    assert!(response.starts_with(b"HTTP/1.1 206 Partial Content"));
    assert!(header_contains(&response, b"Content-Length: 4"));
    assert!(header_contains(&response, b"Content-Range: bytes 6-9/10"));
    assert_eq!(response_body(&response), b"6789");

    fs::remove_dir_all(root).expect("cleanup");
}

#[test]
fn head_responses_preserve_full_and_range_lengths_without_a_body() {
    let root = make_temp_course_dir();
    let video_path = root.join("lesson.mp4");
    fs::write(&video_path, b"0123456789").expect("write video");

    let full = request_media(&root, &video_path, "HEAD", None);
    assert!(full.starts_with(b"HTTP/1.1 200 OK"));
    assert!(header_contains(&full, b"Content-Length: 10"));
    assert!(response_body(&full).is_empty());

    let range = request_media(&root, &video_path, "HEAD", Some("bytes=2-5"));
    assert!(range.starts_with(b"HTTP/1.1 206 Partial Content"));
    assert!(header_contains(&range, b"Content-Length: 4"));
    assert!(header_contains(&range, b"Content-Range: bytes 2-5/10"));
    assert!(response_body(&range).is_empty());

    fs::remove_dir_all(root).expect("cleanup");
}

#[test]
fn copies_large_bodies_with_bounded_reads() {
    let bytes = vec![7_u8; 200_000];
    let mut reader = MeasuringReader::new(bytes.clone());
    let mut output = Vec::new();

    media_server::copy_exact(&mut reader, &mut output, bytes.len() as u64)
        .expect("copy body");

    assert_eq!(output, bytes);
    assert!(reader.max_requested <= 64 * 1024);
}

fn request_media(
    root: &std::path::Path,
    video_path: &std::path::Path,
    method: &str,
    range: Option<&str>,
) -> Vec<u8> {
    let url = media_server::course_media_url(
        root.to_string_lossy().to_string(),
        video_path.to_string_lossy().to_string(),
    )
    .expect("build media url");
    let (host_port, path) = url
        .trim_start_matches("http://")
        .split_once('/')
        .expect("split url");
    let mut stream = TcpStream::connect(host_port).expect("connect media server");
    write!(stream, "{method} /{path} HTTP/1.1\r\nHost: {host_port}\r\n")
        .expect("write request line");
    if let Some(range) = range {
        write!(stream, "Range: {range}\r\n").expect("write range");
    }
    write!(stream, "\r\n").expect("finish request");
    let mut response = Vec::new();
    stream.read_to_end(&mut response).expect("read response");
    response
}

fn header_contains(response: &[u8], expected: &[u8]) -> bool {
    response
        .windows(expected.len())
        .any(|window| window == expected)
}

fn response_body(response: &[u8]) -> &[u8] {
    let separator = b"\r\n\r\n";
    let start = response
        .windows(separator.len())
        .position(|window| window == separator)
        .expect("response header separator")
        + separator.len();
    &response[start..]
}

struct MeasuringReader {
    inner: Cursor<Vec<u8>>,
    max_requested: usize,
}

impl MeasuringReader {
    fn new(bytes: Vec<u8>) -> Self {
        Self {
            inner: Cursor::new(bytes),
            max_requested: 0,
        }
    }
}

impl Read for MeasuringReader {
    fn read(&mut self, buffer: &mut [u8]) -> std::io::Result<usize> {
        self.max_requested = self.max_requested.max(buffer.len());
        self.inner.read(buffer)
    }
}
