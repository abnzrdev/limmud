use rusqlite::Connection;

#[test]
fn bundled_sqlite_supports_fts5() {
    let db = Connection::open_in_memory().expect("open bundled SQLite");
    db.execute("CREATE VIRTUAL TABLE words USING fts5(word)", [])
        .expect("bundled SQLite must include FTS5");
    db.execute("INSERT INTO words(word) VALUES ('running')", [])
        .expect("insert FTS row");
    let matched: String = db
        .query_row(
            "SELECT word FROM words WHERE words MATCH 'run*'",
            [],
            |row| row.get(0),
        )
        .expect("query FTS row");
    assert_eq!(matched, "running");
}
