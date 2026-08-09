package com.kollekt.repository

import com.kollekt.domain.ShoppingItem
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Modifying
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param

interface ShoppingItemRepository : JpaRepository<ShoppingItem, Long> {
    fun findAllByCollectiveCode(collectiveCode: String): List<ShoppingItem>

    fun findByIdAndCollectiveCode(
        id: Long,
        collectiveCode: String,
    ): ShoppingItem?

    @Modifying
    @Query("update ShoppingItem s set s.addedBy = :newName where s.addedBy = :oldName and s.collectiveCode = :collectiveCode")
    fun renameAddedBy(
        @Param("oldName") oldName: String,
        @Param("newName") newName: String,
        @Param("collectiveCode") collectiveCode: String,
    ): Int
}
