// ============================================================
// HyLauncher — Offline UUID Generation
// ============================================================
//
// Generates UUID v3 (name-based, MD5) matching Minecraft's
// offline-mode algorithm: MD5("OfflinePlayer:" + username)

use md5::{Md5, Digest};

/// Generate an offline UUID for a username using the same algorithm as
/// Minecraft's offline-mode server (UUID v3 / MD5-based).
///
/// This is deterministic: the same username always produces the same UUID.
pub fn generate_offline_uuid(username: &str) -> String {
    let input = format!("OfflinePlayer:{}", username);
    let mut hasher = Md5::new();
    hasher.update(input.as_bytes());
    let hash = hasher.finalize();

    let mut bytes = [0u8; 16];
    bytes.copy_from_slice(&hash);

    // Set version to 3 (name-based MD5)
    bytes[6] = (bytes[6] & 0x0f) | 0x30;
    // Set variant to RFC 4122
    bytes[8] = (bytes[8] & 0x3f) | 0x80;

    // Format as UUID string (with dashes)
    format!(
        "{:08x}-{:04x}-{:04x}-{:04x}-{:012x}",
        u32::from_be_bytes([bytes[0], bytes[1], bytes[2], bytes[3]]),
        u16::from_be_bytes([bytes[4], bytes[5]]),
        u16::from_be_bytes([bytes[6], bytes[7]]),
        u16::from_be_bytes([bytes[8], bytes[9]]),
        // Last 6 bytes as a single u64 (only lower 48 bits used)
        ((bytes[10] as u64) << 40)
            | ((bytes[11] as u64) << 32)
            | ((bytes[12] as u64) << 24)
            | ((bytes[13] as u64) << 16)
            | ((bytes[14] as u64) << 8)
            | (bytes[15] as u64),
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_known_uuids() {
        // These match Java's UUID.nameUUIDFromBytes("OfflinePlayer:X".getBytes(UTF_8))
        assert_eq!(
            generate_offline_uuid("Notch"),
            "b50ad385-829d-3141-a216-7e7d7539ba7f"
        );
        assert_eq!(
            generate_offline_uuid("Steve"),
            "2ef3480e-8ae2-3ca0-a1a8-ac0b2e7cad11"
        );
    }
}
