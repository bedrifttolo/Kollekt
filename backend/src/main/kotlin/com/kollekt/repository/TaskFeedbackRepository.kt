package com.kollekt.repository

import com.kollekt.domain.TaskFeedback
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Modifying
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param

interface TaskFeedbackRepository : JpaRepository<TaskFeedback, Long> {
    fun findAllByTaskId(taskId: Long): List<TaskFeedback>

    fun findAllByTaskIdIn(taskIds: Collection<Long>): List<TaskFeedback>

    // task_feedback has no collective_code column, so scoping goes through the task/task_history
    // rows it references — a plain JPQL subquery can't UNION two entities, hence the native query.
    @Modifying
    @Query(
        value =
            "update task_feedback set author = :newName where author = :oldName and task_id in " +
                "(select id from tasks where collective_code = :collectiveCode " +
                "union select id from task_history where collective_code = :collectiveCode)",
        nativeQuery = true,
    )
    fun renameAuthor(
        @Param("oldName") oldName: String,
        @Param("newName") newName: String,
        @Param("collectiveCode") collectiveCode: String,
    ): Int
}
