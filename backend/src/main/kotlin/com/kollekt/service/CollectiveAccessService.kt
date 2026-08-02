package com.kollekt.service

import com.kollekt.domain.Collective
import com.kollekt.domain.Member
import com.kollekt.repository.CollectiveRepository
import org.springframework.stereotype.Service

/**
 * [requireMember] resolves the *calling* member — it is always invoked with a name the caller
 * already proved is their own (via [CurrentMemberContext.requireTokenSubject] one layer up), so
 * it resolves through the ambient authenticated identity rather than a bare, collective-unaware
 * name lookup, which would be ambiguous now that names are only unique within a collective.
 */
@Service
class CollectiveAccessService(
    private val currentMemberContext: CurrentMemberContext,
    private val collectiveRepository: CollectiveRepository,
) {
    fun requireMember(memberName: String): Member = currentMemberContext.current(memberName)

    fun requireCollectiveCodeByMemberName(memberName: String): String = requireCollectiveCode(requireMember(memberName))

    fun requireCollectiveCode(member: Member): String =
        member.collectiveCode
            ?: throw IllegalArgumentException("User '${member.name}' must join a collective first")

    fun requireCollectiveByCode(collectiveCode: String): Collective =
        collectiveRepository.findByJoinCode(collectiveCode)
            ?: throw IllegalArgumentException("Collective not found")
}
