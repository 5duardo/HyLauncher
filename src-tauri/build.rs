fn main() {
    let cargo = std::fs::read_to_string("Cargo.toml").expect("read Cargo.toml");
    let tauri_conf =
        std::fs::read_to_string("tauri.conf.json").expect("read tauri.conf.json");
    let tauri: serde_json::Value =
        serde_json::from_str(&tauri_conf).expect("parse tauri.conf.json");
    let tauri_version = tauri["version"]
        .as_str()
        .expect("version field in tauri.conf.json");

    let cargo_version = cargo
        .lines()
        .find(|l| l.starts_with("version = "))
        .and_then(|l| l.split('"').nth(1))
        .expect("version in Cargo.toml");

    if cargo_version != tauri_version {
        panic!(
            "Version mismatch: Cargo.toml ({cargo_version}) != tauri.conf.json ({tauri_version}). \
             Keep package.json, Cargo.toml and tauri.conf.json in sync."
        );
    }

    tauri_build::build()
}
