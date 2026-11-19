// 中文工程路径通过 ASCII 构建目录副本交给 GNU windres。
fn main() {
    println!("cargo:rerun-if-changed=icons/icon.ico");
    let attributes = if std::env::var("CARGO_CFG_TARGET_OS").as_deref() == Ok("windows") {
        let icon = std::path::PathBuf::from(std::env::var_os("OUT_DIR").unwrap()).join("native-icon.ico");
        std::fs::copy("icons/icon.ico", &icon).expect("copy native icon");
        tauri_build::Attributes::new().windows_attributes(tauri_build::WindowsAttributes::new().window_icon_path(icon))
    } else { tauri_build::Attributes::new() };
    tauri_build::try_build(attributes).expect("build platform resources");
}
