package com.kollekt.service

/**
 * Avatar color palette assigned to members when they join a collective. Mirrors
 * MEMBER_COLORS in src/lib/memberColors.ts — keep both palettes in sync.
 */
object MemberColors {
    val PALETTE =
        listOf(
            "#1f563f",
            "#b84d6d",
            "#7fa7c9",
            "#d99a2b",
            "#356d53",
            "#e07a5f",
            "#6b6bb8",
            "#3f8a8a",
            "#9c5fb8",
            "#c98a3d",
        )

    /** Picks a palette color not already used by another member of the same collective. */
    fun nextAvailable(used: Collection<String>): String {
        val taken = used.map { it.lowercase() }.toSet()
        return PALETTE.firstOrNull { it.lowercase() !in taken } ?: PALETTE[used.size % PALETTE.size]
    }
}
