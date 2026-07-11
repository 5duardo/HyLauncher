// ============================================================
// HyLauncher — Main Entry Point
// ============================================================

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    env_logger::init();
    hylauncher_lib::run()
}
