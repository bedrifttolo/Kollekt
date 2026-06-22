package com.kollekt.repository

import com.kollekt.domain.Collective
import jakarta.persistence.LockModeType
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Lock
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param

interface CollectiveRepository : JpaRepository<Collective, Long> {
    fun findByJoinCode(joinCode: String): Collective?

    fun existsByJoinCode(joinCode: String): Boolean

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select c from Collective c where c.joinCode = :joinCode")
    fun findByJoinCodeForUpdate(
        @Param("joinCode") joinCode: String,
    ): Collective?
}
