package com.kollekt.service

import com.kollekt.repository.CollectiveRepository
import org.springframework.boot.context.event.ApplicationReadyEvent
import org.springframework.context.event.EventListener
import org.springframework.scheduling.annotation.Scheduled
import org.springframework.stereotype.Service

@Service
class HouseCheckinMaintenanceService(
    private val collectiveRepository: CollectiveRepository,
    private val operations: HouseCheckinOperations,
) {
    @EventListener(ApplicationReadyEvent::class)
    fun generateOnStartup() = generateWeeklyCheckins()

    @Scheduled(cron = "0 0 3 * * MON")
    fun generateWeeklyCheckins() {
        collectiveRepository.findAll().forEach { operations.generateForCollective(it.joinCode) }
    }
}
