package com.kollekt.service

import com.kollekt.repository.VisionApiUsageRepository
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.YearMonth

/**
 * Google Cloud's own quota UI can't enforce a precise monthly cap on Vision API calls (only
 * per-minute), so this tracks calls ourselves to stay within the free tier. See
 * [ImageSafetyService] for what happens once the limit is reached (fails open, by design).
 */
@Service
class VisionApiUsageTracker(
    private val repository: VisionApiUsageRepository,
) {
    /** True if a call may proceed (and is now counted); false once [limit] is reached for the current month. */
    @Transactional
    fun tryConsumeCall(limit: Int): Boolean {
        val period = YearMonth.now().toString()
        val current = repository.findByPeriod(period)?.callCount ?: 0
        if (current >= limit) return false
        repository.incrementForPeriod(period)
        return true
    }
}
